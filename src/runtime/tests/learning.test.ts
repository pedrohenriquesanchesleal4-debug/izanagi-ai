import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryStore } from '../memory/store.js';
import { LearningEngine } from '../evolution/learning.js';
import type { EvaluationReport } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-learn-'));
}

function makeReport(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    taskId: 'run-1',
    task: 'Implementar feature X com testes',
    agentId: 'senior-engineer',
    verdict: 'PASS',
    score: 0.92,
    confidence: 0.9,
    metrics: { correctness: 0.95, security: 0.9, architecture: 0.9 },
    tests: { passed: 12, failed: 0 },
    regressions: [],
    recommendations: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test('learning: PASS registra stats de agente e skills + learning textual', () => {
  const memory = new MemoryStore({ baseDir: tmpDir() });
  const engine = new LearningEngine(memory);

  const outcome = engine.process(makeReport(), { agentId: 'senior-engineer', skillIds: ['frontend', 'qa'], tokens: 1200 });

  assert.equal(memory.agentStats('senior-engineer')?.runs, 1);
  assert.equal(memory.skillStats('frontend')?.uses, 1);
  assert.equal(memory.skillStats('qa')?.uses, 1);
  assert.equal(outcome.learnings.length, 1);
  assert.ok(outcome.learnings[0].includes('[PASS]'));
  assert.equal(outcome.patternsRecorded, 0);
  assert.ok(memory.listLearnings().length >= 1);
});

test('learning: regressões viram FailurePattern reutilizável', () => {
  const memory = new MemoryStore({ baseDir: tmpDir() });
  const engine = new LearningEngine(memory);

  const outcome = engine.process(
    makeReport({ verdict: 'FAIL', score: 0.4, confidence: 0.5, regressions: ['login quebra com 2FA ativo'] }),
    { agentId: 'qa', skillIds: [] },
  );

  assert.equal(outcome.patternsRecorded, 1);
  const failures = memory.listFailures();
  assert.equal(failures.length, 1);
  assert.ok(failures[0].pattern.startsWith('REGRESSION-'));
  assert.equal(failures[0].kind, 'validation');
  assert.equal(failures[0].occurrences, 1);
  assert.ok(memory.findRelevantFailures('login quebra com 2FA').length === 1, 'padrão recuperável por busca');
});

test('learning: segunda ocorrência da mesma regressão consolida (occurrences=2)', () => {
  const memory = new MemoryStore({ baseDir: tmpDir() });
  const engine = new LearningEngine(memory);
  const report = makeReport({ verdict: 'FAIL', score: 0.4, regressions: ['erro de validação no checkout'] });

  engine.process(report, { agentId: 'qa' });
  engine.process(report, { agentId: 'qa' });

  const failures = memory.listFailures();
  assert.equal(failures.length, 1);
  assert.equal(failures[0].occurrences, 2);
  assert.ok(failures[0].confidence > 0.6, 'confiança aumenta com ocorrências');
});

test('learning: métricas escassas geram recomendação anti-prompt-bloat', () => {
  const memory = new MemoryStore({ baseDir: tmpDir() });
  const engine = new LearningEngine(memory);

  const outcome = engine.process(makeReport({ metrics: { correctness: 0.9 } }), {});

  assert.ok(outcome.recommendations.some((r) => r.includes('Medir mais métricas')));
});

test('learning: baixa confiança recomenda validators', () => {
  const memory = new MemoryStore({ baseDir: tmpDir() });
  const engine = new LearningEngine(memory);

  const outcome = engine.process(makeReport({ confidence: 0.4, score: 0.6, verdict: 'PASS_WITH_WARNINGS' }), {});

  assert.ok(outcome.recommendations.some((r) => r.includes('validators')));
});
