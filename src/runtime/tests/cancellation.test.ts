import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator } from '../orchestrator.js';
import type { ExecuteCtx } from '../orchestrator.js';
import type { GraphNode } from '../types.js';
import { MemoryStore } from '../memory/store.js';
import { CheckpointStore } from '../recovery/checkpoint.js';
import { Commander } from '../orchestration/commander.js';
import { RunAbortedError, withDeadline } from '../orchestration/deadline.js';
import { Healer, classifyFailure } from '../recovery/healing.js';

/**
 * Cancelamento cooperativo. Antes disto o único `AbortSignal` do repositório era
 * o timeout de `fetch` do cliente de modelo: não havia como parar um run, e o
 * prazo por nó interrompia a espera deixando a requisição em voo consumindo
 * cota de um run que ninguém mais esperava.
 *
 * O que faz o cancelamento valer a pena é a combinação com o checkpoint por
 * batch: parar no INÍCIO do próximo batch preserva em disco tudo que já foi
 * concluído e pago, e `izanagi resume` retoma dali.
 */

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-cancel-'));
}

const LONG_TEXT = 'Artefato completo e extenso, com corpo suficiente para a validação de tamanho. '.repeat(12);

function validContentFor(kind: string | undefined): string {
  const req: Record<string, string> = {
    requirements: 'title functional acceptance',
    architecture: 'context decision layers',
    'database-schema': 'model relations @id primary key references',
    'api-contract': 'method path request response',
    'security-report': 'severity vulnerabilities remediation',
    'test-plan': 'unit integration scenarios',
    'implementation-plan': 'steps files',
    research: 'findings sources',
    evaluation: 'verdict score metrics',
    critique: 'status issues',
    delivery: 'written',
    'qa-report': 'summary results',
  };
  return LONG_TEXT + ((kind && req[kind]) || '');
}

test('cancelamento: withDeadline rejeita com RunAbortedError e carrega o motivo', async () => {
  const controller = new AbortController();
  const promise = withDeadline(
    () => new Promise((resolve) => setTimeout(() => resolve('tarde'), 5000)),
    undefined,
    'no-x',
    controller.signal,
  );
  controller.abort('interrompido pelo usuário (Ctrl-C)');
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof RunAbortedError);
    assert.match(err.message, /run cancelado/i);
    assert.match(err.message, /Ctrl-C/);
    return true;
  });
});

test('cancelamento: sinal já abortado não gasta a chamada', async () => {
  let called = false;
  const controller = new AbortController();
  controller.abort('cancelado antes');
  await assert.rejects(
    () => withDeadline(async () => { called = true; return 'x'; }, 5000, 'no-y', controller.signal),
    RunAbortedError,
  );
  assert.equal(called, false, 'o trabalho não deve ter começado');
});

test('cancelamento: sem sinal, o comportamento de prazo é idêntico ao anterior', async () => {
  assert.equal(await withDeadline(async () => 'ok', 5000, 'no-z'), 'ok');
  assert.equal(await withDeadline(async () => 'ok', undefined, 'no-z'), 'ok');
});

test('cancelamento: run cancelado é non-recoverable, e curar seria desobedecer', () => {
  assert.equal(classifyFailure('run cancelado: interrompido pelo usuário (Ctrl-C) durante "execute"'), 'non-recoverable');
});

test('cancelamento: falha non-recoverable não é retentada nem quando casa com padrão da memória', () => {
  // Esta era a brecha: o passo de "padrão de falha conhecido" vinha ANTES da
  // classificação decidir, e devolvia `retryNow: true`. Uma permissão negada (ou
  // um teto, ou um cancelamento) que casasse com um padrão gravado na memória
  // era retentada, contra a regra que o próprio `KIND_RULES` declara no topo.
  const baseDir = tmpDir();
  try {
    const memory = new MemoryStore({ baseDir });
    const error = 'permissão negada para fs.write no nó "deliver"';
    memory.recordFailure({
      pattern: 'permissao-negada-fs-write',
      symptoms: ['permissão negada', 'fs.write'],
      rootCause: 'trust tier community não recebe fs:write',
      solution: 'conceder a permissão no contrato ou elevar o trust tier',
      confidence: 0.9,
      kind: 'non-recoverable',
    });
    // Confirma que o padrão realmente casa: sem isso o teste passaria por não
    // haver padrão nenhum, o que não prova nada.
    assert.ok(memory.findRelevantFailures(error).length > 0, 'o padrão precisa casar com o erro');

    const decision = new Healer().heal({
      nodeId: 'deliver',
      error,
      attempt: 1,
      maxAttempts: 3,
      elapsedMs: 100,
      maxTimeMs: 900_000,
      tokensUsed: 100,
      maxTokens: 32_000,
      memory,
    });
    assert.equal(decision.action.kind, 'abort');
    assert.notEqual(decision.retryNow, true);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('cancelamento: run abortado no meio do grafo para, e o progresso fica no checkpoint', async () => {
  const baseDir = tmpDir();
  try {
    const plan = new Commander().plan({ objective: 'Auditar a segurança da API de pagamentos', mode: 'orchestrated' });
    assert.ok(plan.graph.parallelBatches.length >= 2, 'o teste precisa de 2+ batches');

    const controller = new AbortController();
    const checkpoints = new CheckpointStore({ baseDir });
    let executed = 0;

    const orchestrator = new Orchestrator({
      baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: [],
      plan,
      signal: controller.signal,
      produce: (node: GraphNode, _ctx: ExecuteCtx) => {
        executed++;
        // Cancela depois do primeiro nó: o batch em voo termina, e o
        // cancelamento é conferido no início do próximo.
        if (executed === 1) controller.abort('cancelado no teste');
        return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
      },
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));
    orchestrator.setCheckpointStore(checkpoints);

    const result = await orchestrator.run();

    assert.notEqual(result.status, 'PASS');
    assert.ok(executed >= 1, 'ao menos um nó rodou');
    assert.ok(
      executed < plan.graph.nodes.length,
      `o run precisa ter PARADO: rodou ${executed} de ${plan.graph.nodes.length} nós`,
    );

    // O progresso do batch concluído está em disco: é o que faz o resume valer.
    const saved = checkpoints.load(result.trace.runId);
    assert.ok(saved, 'checkpoint persistido');
    assert.ok(
      saved.graph.nodes.some((n) => n.status === 'succeeded'),
      'o checkpoint carrega o nó já concluído',
    );

    // Cancelar não é curar: não deve haver retentativa nem healing de retry.
    assert.ok(
      result.healing.every((h) => h.kind !== 'retry'),
      `cancelamento não gera retry: ${result.healing.map((h) => h.kind).join(', ')}`,
    );
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('cancelamento: sem sinal o run completa normalmente', async () => {
  const baseDir = tmpDir();
  try {
    const plan = new Commander().plan({ objective: 'Auditar a segurança da API de pagamentos', mode: 'orchestrated' });
    const orchestrator = new Orchestrator({
      baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: [],
      plan,
      produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));
    const result = await orchestrator.run();
    assert.equal(result.status, 'PASS');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
