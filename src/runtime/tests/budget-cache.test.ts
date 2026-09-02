import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ExecutionBudget, DEGRADATION_LADDER } from '../token/execution-budget.js';
import { ResponseCache, cacheKey } from '../cache/response-cache.js';

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('budget: gasto dentro do teto é aceito e contabilizado', () => {
  const budget = new ExecutionBudget({ maxTokens: 10_000 });
  assert.equal(budget.spend({ phase: 'execution', tokens: 1000, costUsd: 0.01 }).ok, true);
  assert.equal(budget.totalTokens, 1000);
  assert.equal(budget.spentUsd, 0.01);
});

test('budget: gasto que estouraria o teto de custo é RECUSADO, não contabilizado', () => {
  const budget = new ExecutionBudget({ maxTokens: 100_000, maxCostUsd: 0.05 });
  assert.equal(budget.spend({ phase: 'execution', tokens: 100, costUsd: 0.04 }).ok, true);
  const denied = budget.spend({ phase: 'execution', tokens: 100, costUsd: 0.02 });
  assert.equal(denied.ok, false);
  assert.equal(denied.limit, 'cost');
  assert.equal(budget.spentUsd, 0.04, 'gasto recusado não pode entrar na conta');
});

test('budget: teto de tokens da fase bloqueia sem estourar em silêncio', () => {
  const budget = new ExecutionBudget({ maxTokens: 1000 }, 3);
  const allocated = budget.phases.allocation.execution;
  assert.equal(budget.spend({ phase: 'execution', tokens: allocated }).ok, true);
  const denied = budget.spend({ phase: 'execution', tokens: 1 });
  assert.equal(denied.ok, false);
  assert.equal(denied.limit, 'phase-tokens');
});

test('budget: tempo excedido recusa novo gasto', () => {
  const budget = new ExecutionBudget({ maxTokens: 10_000, maxTimeMs: 10 }, 3, Date.now() - 1000);
  const denied = budget.spend({ phase: 'execution', tokens: 10 });
  assert.equal(denied.ok, false);
  assert.equal(denied.limit, 'time');
});

test('budget: pressão sobe conforme o consumo e destrava a escada de degradação', () => {
  const budget = new ExecutionBudget({ maxTokens: 1000 }, 2);
  assert.equal(budget.nextDegradation(), null, 'sem pressão não há degradação');
  budget.spend({ phase: 'execution', tokens: 690 });
  assert.ok(budget.pressure() >= 0.6, `pressão inesperada: ${budget.pressure()}`);
  assert.equal(budget.nextDegradation(), 'reduce-context');
  assert.equal(budget.nextDegradation(), 'reduce-output');
  assert.deepEqual(budget.degradations(), ['reduce-context', 'reduce-output']);
});

test('budget: escada nunca repete degrau e termina em aprovação humana', () => {
  const budget = new ExecutionBudget({ maxTokens: 100 }, 2);
  budget.spend({ phase: 'execution', tokens: 70 });
  const steps: string[] = [];
  for (let i = 0; i < DEGRADATION_LADDER.length + 2; i++) {
    const step = budget.nextDegradation();
    if (step) steps.push(step);
  }
  assert.deepEqual(steps, DEGRADATION_LADDER);
  assert.equal(budget.nextDegradation(), null, 'escada esgotada não devolve mais nada');
});

test('budget: tetos de retry, tool call e agentes são respeitados', () => {
  const budget = new ExecutionBudget({ maxTokens: 10_000, maxRetries: 1, maxToolCalls: 1, maxAgents: 1 });
  assert.equal(budget.recordRetry(), true);
  assert.equal(budget.recordRetry(), false);
  assert.equal(budget.recordToolCall(), true);
  assert.equal(budget.recordToolCall(), false);
  assert.equal(budget.recordAgent('senior-engineer'), true);
  assert.equal(budget.recordAgent('senior-engineer'), true, 'mesmo agente não conta duas vezes');
  assert.equal(budget.recordAgent('qa'), false);
});

test('budget: telemetria expõe as métricas exigidas pelo Token Economy Engine', () => {
  const budget = new ExecutionBudget({ maxTokens: 10_000, maxCostUsd: 1 });
  budget.spend({ phase: 'execution', tokens: 1000, costUsd: 0.02, cachedTokens: 300 });
  budget.recordCacheHit(800);
  budget.recordCacheMiss();
  budget.recordContextSaving(15_000);
  budget.recordParallelBatch(3);
  budget.recordEscalation();
  budget.recordRetry();
  const t = budget.telemetry();
  assert.equal(t.totalTokens, 1000);
  assert.equal(t.savedTokens, 800);
  assert.equal(t.providerCachedTokens, 300);
  assert.equal(t.cacheHits, 1);
  assert.equal(t.cacheMisses, 1);
  assert.equal(t.contextCharsSaved, 15_000);
  assert.equal(t.parallelTasks, 3);
  assert.equal(t.modelEscalations, 1);
  assert.equal(t.retries, 1);
  const line = ExecutionBudget.formatTelemetry(t);
  assert.ok(line.includes('cache 1/2 (50%)'), line);
});

test('budget: restore recompõe gasto de um checkpoint', () => {
  const budget = new ExecutionBudget({ maxTokens: 10_000 });
  budget.restore({ phaseSpent: { execution: 500 }, costUsd: 0.3, inputTokens: 400, outputTokens: 100, retries: 2 });
  assert.equal(budget.totalTokens, 500);
  assert.equal(budget.spentUsd, 0.3);
  assert.equal(budget.phases.spentIn('execution'), 500);
});

test('cache: desligado por padrão, nunca lê nem grava', () => {
  const dir = tmp('izanagi-cache-off-');
  const cache = new ResponseCache({ baseDir: dir });
  const key = { provider: 'openai', model: 'gpt-4o', messages: [{ role: 'user', content: 'oi' }] };
  cache.set(key, { text: 'resposta', tokens: 10, model: 'gpt-4o', provider: 'openai' });
  assert.equal(cache.get(key), null);
  assert.equal(fs.existsSync(path.join(dir, '.izanagi', 'state', 'cache', 'responses')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache: hit devolve a resposta gravada e conta os tokens economizados', () => {
  const dir = tmp('izanagi-cache-on-');
  const cache = new ResponseCache({ baseDir: dir, enabled: true });
  const key = { provider: 'anthropic', model: 'claude-sonnet-4-5', system: 'sys', messages: [{ role: 'user', content: 'tarefa' }] };
  assert.equal(cache.get(key), null);
  cache.set(key, { text: 'artefato', tokens: 1234, model: 'claude-sonnet-4-5', provider: 'anthropic' });
  const hit = cache.get(key);
  assert.ok(hit);
  assert.equal(hit!.text, 'artefato');
  assert.equal(hit!.originalTokens, 1234);
  assert.deepEqual(cache.stats, { hits: 1, misses: 1 });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache: qualquer mudança de entrada muda a chave (sem colisão silenciosa)', () => {
  const base = { provider: 'openai', model: 'gpt-4o', system: 's', messages: [{ role: 'user', content: 'a' }], maxTokens: 100, temperature: 0.4 };
  const k = cacheKey(base);
  assert.notEqual(k, cacheKey({ ...base, model: 'gpt-4o-mini' }));
  assert.notEqual(k, cacheKey({ ...base, system: 's2' }));
  assert.notEqual(k, cacheKey({ ...base, messages: [{ role: 'user', content: 'b' }] }));
  assert.notEqual(k, cacheKey({ ...base, maxTokens: 200 }));
  assert.notEqual(k, cacheKey({ ...base, temperature: 0 }));
  assert.equal(k, cacheKey({ ...base }));
});

test('cache: entrada expirada por TTL é descartada em vez de servida', () => {
  const dir = tmp('izanagi-cache-ttl-');
  const write = new ResponseCache({ baseDir: dir, enabled: true });
  const key = { provider: 'openai', model: 'gpt-4o', messages: [{ role: 'user', content: 'x' }] };
  write.set(key, { text: 'velho', tokens: 5, model: 'gpt-4o', provider: 'openai' });
  const expired = new ResponseCache({ baseDir: dir, enabled: true, ttlMs: -1 });
  assert.equal(expired.get(key), null);
  assert.deepEqual(expired.stats, { hits: 0, misses: 1 });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache: eviction mantém o cache dentro do teto de entradas', () => {
  const dir = tmp('izanagi-cache-evict-');
  const cache = new ResponseCache({ baseDir: dir, enabled: true, maxEntries: 3 });
  for (let i = 0; i < 8; i++) {
    cache.set({ provider: 'openai', model: 'gpt-4o', messages: [{ role: 'user', content: `msg-${i}` }] }, { text: `r${i}`, tokens: 1, model: 'gpt-4o', provider: 'openai' });
  }
  const files = fs.readdirSync(path.join(dir, '.izanagi', 'state', 'cache', 'responses'));
  assert.ok(files.length <= 3, `esperava no máximo 3 entradas, veio ${files.length}`);
  fs.rmSync(dir, { recursive: true, force: true });
});
