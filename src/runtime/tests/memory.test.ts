import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-mem-'));
}

test('memory: persiste e recarrega estado', () => {
  const dir = tmpDir();
  const m1 = new MemoryStore({ baseDir: dir });
  m1.recordFailure({ pattern: 'X-1', symptoms: ['a'], rootCause: 'b', solution: 'c', confidence: 0.8 });
  m1.recordAgentRun('qa', { success: true, score: 0.9, tokens: 100 });
  m1.addLearning('sempre rodar build antes do doctor', 'test');
  m1.save();
  assert.ok(fs.existsSync(path.join(dir, '.izanagi', 'state', 'runtime-state.json')));
  const m2 = new MemoryStore({ baseDir: dir });
  assert.equal(m2.raw.failures['X-1'].occurrences, 1);
  assert.equal(m2.agentStats('qa')?.runs, 1);
  assert.equal(m2.listLearnings(5).length, 1);
});

test('memory: recordFailure consolida por pattern (ocorrências + confiança)', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  m.recordFailure({ pattern: 'X-1', symptoms: ['a'], rootCause: 'b', solution: 'c', confidence: 0.6 });
  m.recordFailure({ pattern: 'X-1', symptoms: ['a', 'novo'], rootCause: 'b', solution: 'c', confidence: 0.6 });
  const p = m.raw.failures['X-1'];
  assert.equal(p.occurrences, 2);
  assert.ok(p.confidence > 0.6, 'confiança deve subir com ocorrências');
  assert.deepEqual(p.symptoms.sort(), ['a', 'novo']);
});

test('memory: findRelevantFailures encontra por symptom overlap', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  m.recordFailure({ pattern: 'NEXT-HYDRATION-017', symptoms: ['hydration'], rootCause: 'window', solution: 'guard', confidence: 0.9 });
  const found = m.findRelevantFailures('erro de hydration null no Next');
  assert.ok(found.length >= 1);
  assert.equal(found[0].pattern, 'NEXT-HYDRATION-017');
});

test('memory: findRelevantFailures vazio para query desconexa', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  m.recordFailure({ pattern: 'A-1', symptoms: ['gpu'], rootCause: 'r', solution: 's', confidence: 0.9 });
  assert.equal(m.findRelevantFailures('login quebrado').length, 0);
});

test('memory: listFailures ordena por ocorrências', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  m.recordFailure({ pattern: 'LOW', symptoms: ['a'], rootCause: 'r', solution: 's', confidence: 0.3 });
  m.recordFailure({ pattern: 'HIGH', symptoms: ['a'], rootCause: 'r', solution: 's', confidence: 0.3 });
  m.recordFailure({ pattern: 'HIGH', symptoms: ['a'], rootCause: 'r', solution: 's', confidence: 0.3 });
  const list = m.listFailures();
  assert.equal(list[0].pattern, 'HIGH');
  assert.equal(list[0].occurrences, 2);
});

test('memory: recordAgentRun acumula stats corretas', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  m.recordAgentRun('qa', { success: true, score: 0.9, tokens: 1000 });
  m.recordAgentRun('qa', { success: false, score: 0.4, tokens: 500 });
  const stats = m.agentStats('qa')!;
  assert.equal(stats.runs, 2);
  assert.equal(stats.successes, 1);
  assert.equal(stats.failures, 1);
  assert.equal(stats.avgScore, 0.65);
  assert.equal(stats.avgTokens, 750);
});

test('memory: recordSkillRun acumula uso', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  m.recordSkillRun('qa', { success: true, score: 0.9, tokens: 100 });
  m.recordSkillRun('qa', { success: true, score: 0.8, tokens: 200 });
  assert.equal(m.skillStats('qa')?.uses, 2);
});

test('memory: recordModelRun acumula stats e historicalPerformance reflete taxa de sucesso', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  m.recordModelRun('claude-sonnet-4-5', { success: true, score: 0.9, tokens: 1000 });
  m.recordModelRun('claude-sonnet-4-5', { success: true, score: 0.8, tokens: 500 });
  m.recordModelRun('claude-sonnet-4-5', { success: false, score: 0.3, tokens: 700 });
  const stats = m.modelStats('claude-sonnet-4-5')!;
  assert.equal(stats.runs, 3);
  assert.equal(stats.successes, 2);
  assert.equal(stats.failures, 1);
  const perf = m.historicalPerformance();
  assert.equal(Math.round(perf['claude-sonnet-4-5'] * 100) / 100, 0.67);
  assert.equal(perf['modelo-nunca-usado'], undefined);
});

test('memory: estado antigo sem campo models carrega sem quebrar (migração)', () => {
  const dir = tmpDir();
  const stateDir = path.join(dir, '.izanagi', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'runtime-state.json'),
    JSON.stringify({ schemaVersion: 1, agents: {}, skills: {}, failures: {}, learnings: [], updatedAt: 'x' }),
  );
  const m = new MemoryStore({ baseDir: dir });
  assert.deepEqual(m.historicalPerformance(), {});
  m.recordModelRun('gpt-4o', { success: true, score: 1, tokens: 10 });
  assert.equal(m.modelStats('gpt-4o')?.runs, 1);
});

test('memory: addLearning limita a 200 entradas', () => {
  const m = new MemoryStore({ baseDir: tmpDir() });
  for (let i = 0; i < 250; i++) m.addLearning(`learning ${i}`, 'test');
  assert.equal(m.listLearnings(1000).length, 200);
});

test('memory: search consulta entradas markdown', () => {
  const dir = tmpDir();
  const m = new MemoryStore({ baseDir: dir });
  fs.mkdirSync(path.join(dir, '.agents', 'memoria'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.agents', 'memoria', 'contexto.md'), '# Contexto\nSempre rodar build antes do doctor.', 'utf-8');
  const hits = m.search('build');
  assert.ok(hits.length >= 1);
  assert.ok(hits[0].score > 0);
  assert.equal(m.search('termo-inexistente-xyz').length, 0);
});
