/**
 * Teto esgotado é diferente de falha por bug.
 *
 * Os dois terminavam idênticos (`abort` + veredito `FAIL`), e a diferença é
 * justamente o que decide o passo seguinte: subir o teto e rodar de novo, ou
 * investigar a causa. Estes testes protegem a distinção e o teto de custo, que
 * o Healer não consultava.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Healer } from '../recovery/healing.js';
import { MemoryStore } from '../memory/store.js';

function baseInput(over: Record<string, unknown> = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-heal-'));
  return {
    dir: baseDir,
    input: {
      nodeId: 'execute',
      error: 'falha generica de modelo',
      attempt: 1,
      maxAttempts: 3,
      elapsedMs: 100,
      maxTimeMs: 300_000,
      tokensUsed: 100,
      maxTokens: 10_000,
      memory: new MemoryStore({ baseDir }),
      ...over,
    },
  };
}

test('healer: o teto de CUSTO barra antes de decidir curar', () => {
  const { dir, input } = baseInput({ costUsd: 0.51, maxCostUsd: 0.5 });
  const decision = new Healer().heal(input as never);
  assert.equal(decision.action.kind, 'abort');
  assert.equal(decision.action.exhausted, 'cost');
  assert.match(decision.action.message, /teto de custo/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('healer: sem teto de custo declarado, nada muda', () => {
  // Falha transitória: com teto declarado e estourado, aborta; sem teto,
  // continua sendo a retentativa que sempre foi. O par é o que prova que o
  // corte é do TETO e não do gasto.
  const semTeto = baseInput({ error: 'HTTP 429 rate limit', costUsd: 999 });
  const seguiu = new Healer().heal(semTeto.input as never);
  assert.equal(seguiu.action.kind, 'retry', 'custo sem teto não pode barrar');
  fs.rmSync(semTeto.dir, { recursive: true, force: true });

  const comTeto = baseInput({ error: 'HTTP 429 rate limit', costUsd: 999, maxCostUsd: 0.5 });
  const barrou = new Healer().heal(comTeto.input as never);
  assert.equal(barrou.action.kind, 'abort');
  assert.equal(barrou.action.exhausted, 'cost');
  fs.rmSync(comTeto.dir, { recursive: true, force: true });
});

test('healer: cada teto esgotado se identifica, e falha irrecuperável NÃO marca teto', () => {
  const casos: Array<[Record<string, unknown>, string]> = [
    [{ attempt: 3, maxAttempts: 3 }, 'attempts'],
    [{ elapsedMs: 999_999, maxTimeMs: 1_000 }, 'time'],
    [{ tokensUsed: 99_999, maxTokens: 1_000 }, 'tokens'],
    [{ costUsd: 1, maxCostUsd: 0.5 }, 'cost'],
  ];
  for (const [over, esperado] of casos) {
    const { dir, input } = baseInput(over);
    const d = new Healer().heal(input as never);
    assert.equal(d.action.kind, 'abort');
    assert.equal(d.action.exhausted, esperado, `esperava teto "${esperado}"`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Permissão negada aborta pelo mesmo caminho e NÃO é teto: é um "não" que
  // não muda subindo orçamento nenhum.
  const { dir, input } = baseInput({ error: 'permissão negada: shell não concedida' });
  const d = new Healer().heal(input as never);
  assert.equal(d.action.kind, 'abort');
  assert.equal(d.action.exhausted, undefined, 'permissão negada não é teto esgotado');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('orchestrator: teto esgotado termina HUMAN_REQUIRED, e a avaliação continua FAIL', async () => {
  const { Orchestrator } = await import('../orchestrator.js');
  const { TraceStore } = await import('../observability/tracer.js');
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-hr-'));
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'auditar a segurança da API',
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    // Teto baixíssimo: a fase de recovery esgota antes de o nó fechar.
    budgetLimits: { maxTokens: 200 },
    produce: () => {
      throw new Error('HTTP 429 rate limit');
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.equal(result.status, 'HUMAN_REQUIRED');
  assert.equal(result.evaluation?.verdict, 'FAIL', 'a avaliação mede a ENTREGA, e a entrega não fechou');
  assert.ok(
    result.healing.some((h) => h.exhausted),
    'o teto esgotado precisa estar registrado na ação de healing, não só no status',
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('orchestrator: falha sem teto esgotado continua FAIL', async () => {
  const { Orchestrator } = await import('../orchestrator.js');
  const { TraceStore } = await import('../observability/tracer.js');
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-fail-'));
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'auditar a segurança da API',
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    // Permissão negada não é teto: não muda subindo orçamento nenhum.
    produce: () => {
      throw new Error('permissão negada: shell não concedida');
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.equal(result.status, 'FAIL', 'um "não" que não muda com orçamento não vira HUMAN_REQUIRED');
  assert.equal(result.healing.find((h) => h.exhausted), undefined);
  fs.rmSync(baseDir, { recursive: true, force: true });
});
