import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Healer, classifyFailure, isRecoverable } from '../recovery/healing.js';
import { MemoryStore } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-hl-'));
}

function memoryWith(dir: string, patterns: Array<Record<string, unknown>> = []): MemoryStore {
  const m = new MemoryStore({ baseDir: dir });
  for (const p of patterns) {
    m.recordFailure(p as never);
  }
  return m;
}

test('healing: classifica falhas por tipo', () => {
  assert.equal(classifyFailure('request timed out after 30s'), 'recoverable');
  assert.equal(classifyFailure('429 rate limit exceeded'), 'recoverable');
  assert.equal(classifyFailure('502 bad gateway'), 'recoverable');
  assert.equal(classifyFailure('invalid artifact: issues encontradas'), 'validation');
  assert.equal(classifyFailure('Cannot find module xyz'), 'dependency');
  assert.equal(classifyFailure('cyclic graph detected'), 'planning');
  assert.equal(classifyFailure('comando falhou: exit code 1'), 'tool');
  assert.equal(classifyFailure('agente retornou saída inconsistente'), 'agent');
  assert.equal(classifyFailure('algo misterioso aconteceu'), 'unknown');
});

test('healing: isRecoverable correto', () => {
  assert.equal(isRecoverable('recoverable'), true);
  assert.equal(isRecoverable('validation'), true);
  assert.equal(isRecoverable('tool'), true);
  assert.equal(isRecoverable('planning'), false);
  assert.equal(isRecoverable('unknown'), false);
});

test('healing: retry com backoff para falha transitória', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    agent: 'architect',
    error: 'request timed out',
    attempt: 0,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'retry');
  assert.equal(d.retryNow, true);
});

test('healing: abort após exceder maxAttempts', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    error: 'request timed out',
    attempt: 3,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'abort');
  assert.ok(d.abortReason?.includes('tentativas'));
});

test('healing: abort com estouro de tokens', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    error: 'x',
    attempt: 0,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 40000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'abort');
  assert.ok(d.abortReason?.includes('token'));
});

test('healing: abort com estouro de tempo', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    error: 'x',
    attempt: 0,
    maxAttempts: 3,
    elapsedMs: 1200000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'abort');
  assert.ok(d.abortReason?.includes('tempo'));
});

test('healing: padrão conhecido gera local_repair e consolida memória', () => {
  const dir = tmpDir();
  const m = memoryWith(dir, [
    { pattern: 'NEXT-HYDRATION-017', symptoms: ['hydration'], rootCause: 'window no SSR', solution: 'guard typeof window', confidence: 0.94, occurrences: 3 },
  ]);
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    error: 'Cannot read properties of null (hydration)',
    attempt: 1,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: m,
  });
  assert.equal(d.action.kind, 'local_repair');
  assert.equal(d.action.matchedPattern, 'NEXT-HYDRATION-017');
  assert.ok(d.retryNow);
  assert.equal(m.raw.failures['NEXT-HYDRATION-017'].occurrences, 2);
});

test('healing: validação → skill replacement', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    skill: 'frontend',
    error: 'artifact invalid: schema contract não satisfeito',
    attempt: 1,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'skill_replacement');
  assert.equal(d.action.replacement, 'qa');
  assert.ok(d.retryNow);
});

test('healing: planejamento → replan', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    error: 'dependência cíclica no graph de execução',
    attempt: 1,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'replan');
});

test('healing: dependency → handoff bug-hunter', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    error: 'Cannot find module qrcode',
    attempt: 1,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'handoff');
  assert.equal(d.replacement?.agent, 'bug-hunter');
});

test('healing: desconhecida sem estratégia → abort', () => {
  const dir = tmpDir();
  const healer = new Healer();
  const d = healer.heal({
    nodeId: 'n1',
    error: 'algo misterioso aconteceu',
    attempt: 1,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 600000,
    tokensUsed: 1000,
    maxTokens: 32000,
    memory: memoryWith(dir),
  });
  assert.equal(d.action.kind, 'abort');
});

test('healing: backoff exponencial com cap', () => {
  assert.equal(Healer.backoff(500, 0), 500);
  assert.ok(Healer.backoff(500, 2) > 1000 && Healer.backoff(500, 2) < 2000);
  assert.ok(Healer.backoff(500, 10) > 40000 && Healer.backoff(500, 10) < 60000);
  assert.equal(Healer.backoff(500, 20), 60000);
  assert.equal(Healer.backoff(500, 50), 60000);
});

test('healing: retentativa do mesmo incidente não recontabiliza o padrão na memória', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-heal-count-'));
  const memory = new MemoryStore({ baseDir });
  memory.recordFailure({
    pattern: 'provider-timeout',
    symptoms: ['request timed out'],
    rootCause: 'provider lento',
    solution: 'retry com backoff',
    confidence: 0.7,
  });
  // O NÚMERO, não o objeto: `findRelevantFailures` devolve a referência
  // guardada no estado, então segurar o objeto seria compará-lo consigo mesmo
  // depois de ele ter sido incrementado.
  const antes = memory.findRelevantFailures('request timed out')[0].occurrences;

  const healer = new Healer();
  const input = {
    nodeId: 'scan',
    error: 'request timed out',
    attempt: 1,
    maxAttempts: 5,
    elapsedMs: 10,
    maxTimeMs: 600_000,
    tokensUsed: 10,
    maxTokens: 100_000,
    memory,
  };
  healer.heal({ ...input, attempt: 1 });
  healer.heal({ ...input, attempt: 2 });
  healer.heal({ ...input, attempt: 3 });

  const depois = memory.findRelevantFailures('request timed out')[0].occurrences;
  assert.equal(
    depois,
    antes + 1,
    'três retries do MESMO incidente são um incidente: contar três faria a memória medir teimosia do runtime, não recorrência do problema',
  );

  // Nó diferente no mesmo run é outro incidente, e conta.
  healer.heal({ ...input, nodeId: 'deep-analysis' });
  assert.equal(memory.findRelevantFailures('request timed out')[0].occurrences, antes + 2);

  // Run novo (Healer novo) conta de novo: entre runs é recorrência de verdade.
  new Healer().heal(input);
  assert.equal(memory.findRelevantFailures('request timed out')[0].occurrences, antes + 3);
  fs.rmSync(baseDir, { recursive: true, force: true });
});
