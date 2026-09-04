import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator } from '../orchestrator.js';
import type { ExecuteCtx } from '../orchestrator.js';
import type { GraphNode } from '../types.js';
import { MemoryStore } from '../memory/store.js';
import { Commander } from '../orchestration/commander.js';
import { classifyFailure, isRecoverable } from '../recovery/healing.js';

/**
 * Tetos do Budget Controller que EXISTIAM e não limitavam nada.
 *
 * `maxRetries` e `maxAgents` chegavam do SDK e da CLI até o `ExecutionBudget`,
 * eram contados e o resultado da contagem era descartado. `telemetry.retries`
 * saía 0 em `izanagi budget`, no `izanagi trace` e no dashboard mesmo num run
 * que retentou três vezes — enquanto a Arena, contando por `node.attempts`,
 * relatava o número certo. Duas contas do mesmo fato e só uma verdadeira.
 */

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-ceiling-'));
}

const LONG_TEXT = 'Artefato completo e extenso, com corpo suficiente para validação de tamanho. '.repeat(12);

/** Conteúdo válido por kind, para o nó passar na validação de schema. */
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

test('budget: retentativa de nó aparece em telemetry.retries', async () => {
  const baseDir = tmpDir();
  let calls = 0;
  const plan = new Commander().plan({ objective: 'Auditar a segurança da API de pagamentos', mode: 'orchestrated' });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan,
    // Falha só na PRIMEIRA chamada de cada nó: força exatamente uma retentativa
    // no nó de cabeça e deixa o resto do grafo terminar.
    produce: (node: GraphNode, _ctx: ExecuteCtx) => {
      calls++;
      if (calls === 1) throw new Error('429 rate limit do provider');
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();

  const retried = result.graph.nodes.filter((n) => (n.attempts ?? 0) > 1);
  assert.ok(retried.length > 0, 'algum nó foi reexecutado');
  assert.ok(
    (result.telemetry?.retries ?? 0) > 0,
    `telemetry.retries deveria contar a retentativa, veio ${result.telemetry?.retries}`,
  );
  // A conta da telemetria e a conta da Arena falam do mesmo fato.
  const byAttempts = result.graph.nodes.reduce((sum, n) => sum + Math.max(0, (n.attempts ?? 0) - 1), 0);
  assert.equal(result.telemetry?.retries, byAttempts, 'telemetria e node.attempts contam o mesmo');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('budget: run sem retentativa reporta retries 0, e isso é medida e não default', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({ objective: 'Auditar a segurança da API', mode: 'orchestrated' });
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
  assert.equal(result.telemetry?.retries, 0);
  assert.ok(result.graph.nodes.every((n) => (n.attempts ?? 0) <= 1), 'nenhum nó reexecutado');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('budget: maxRetries barra a reexecução em vez de só contá-la', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({ objective: 'Auditar a segurança da API', mode: 'autonomous' });
  let calls = 0;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan,
    // maxRetries 0: nenhuma reexecução é permitida.
    budgetLimits: { maxRetries: 0 },
    produce: (_node: GraphNode) => {
      calls++;
      throw new Error('429 rate limit do provider');
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();

  assert.notEqual(result.status, 'PASS');
  const blocked = result.graph.nodes.filter((n) => /teto de retentativas/i.test(n.error ?? ''));
  assert.ok(blocked.length > 0, `algum nó recusado pelo teto: ${result.graph.nodes.map((n) => n.error).join(' | ')}`);
  // O ponto do teto: a chamada de modelo da retentativa recusada NÃO acontece.
  // O nó de cabeça roda uma vez; a segunda tentativa morre antes do producer.
  assert.ok(calls >= 1, 'o producer rodou na primeira tentativa');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('budget: maxAgents barra o agente além do teto antes de gastar a chamada', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({ objective: 'Construir um SaaS completo de cobrança com dashboard e autenticação', mode: 'autonomous' });
  const distinctAgents = new Set(plan.graph.nodes.map((n) => n.agent).filter(Boolean));
  assert.ok(distinctAgents.size >= 2, `o plano precisa de 2+ agentes distintos para este teste (veio ${distinctAgents.size})`);

  const seen = new Set<string>();
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: 'fullstack',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    budgetLimits: { maxAgents: 1 },
    produce: (node: GraphNode) => {
      if (node.agent) seen.add(node.agent);
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();

  assert.equal(seen.size, 1, `só um agente deveria ter chegado ao producer, chegaram: ${[...seen].join(', ')}`);
  assert.ok(
    result.graph.nodes.some((n) => /teto de agentes/i.test(n.error ?? '')),
    'algum nó recusado pelo teto de agentes',
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('healing: teto de run estourado é non-recoverable, não falha transitória de tool', () => {
  // A mensagem do teto de tool calls contém a palavra "tool" e casava com a
  // regra `/tool|mcp|exec|command failed|exit code/` ANTES de qualquer regra de
  // teto: o runtime retentava um limite que não se move entre tentativas.
  const toolCeiling = 'teto de tool calls do run excedido antes de executar "fs.write"';
  assert.equal(classifyFailure(toolCeiling), 'non-recoverable');
  assert.equal(isRecoverable(classifyFailure(toolCeiling)), false);

  const retryCeiling = 'teto de retentativas do run excedido (maxRetries) antes de reexecutar "execute"';
  assert.equal(classifyFailure(retryCeiling), 'non-recoverable');

  const agentCeiling = 'teto de agentes distintos do run excedido (maxAgents) antes de acionar "qa"';
  assert.equal(classifyFailure(agentCeiling), 'non-recoverable');

  // A regra não pode capturar falha de tool comum: essa continua recuperável.
  assert.equal(classifyFailure('tool fs.read falhou: exit code 1'), 'tool');
  assert.equal(isRecoverable(classifyFailure('tool fs.read falhou: exit code 1')), true);
});
