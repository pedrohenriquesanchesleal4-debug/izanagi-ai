import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EvaluationEngine, DEFAULT_WEIGHTINGS } from '../evaluation/engine.js';

const engine = new EvaluationEngine();

test('evaluation: PASS com métricas excelentes', () => {
  const result = engine.evaluate({
    metrics: { correctness: 0.95, security: 0.9, architecture: 0.9, testResults: 0.95 },
    tests: { passed: 42, failed: 0 },
  });
  assert.equal(result.verdict, 'PASS');
  assert.ok(result.score >= 0.85);
  assert.ok(result.confidence > 0.5);
});

test('evaluation: FAIL com testes falhando mesmo com score alto', () => {
  const result = engine.evaluate({
    metrics: { correctness: 0.95 },
    tests: { passed: 10, failed: 3 },
  });
  assert.equal(result.verdict, 'FAIL');
  assert.ok(result.recommendations.length > 0);
});

test('evaluation: BLOCKED sem nenhum teste passando', () => {
  const result = engine.evaluate({
    metrics: { correctness: 0.9 },
    tests: { passed: 0, failed: 5 },
  });
  assert.equal(result.verdict, 'BLOCKED');
});

test('evaluation: FAIL com regressões', () => {
  const result = engine.evaluate({
    metrics: { correctness: 0.95, testResults: 0.95 },
    regressions: ['login quebrado'],
  });
  assert.equal(result.verdict, 'FAIL');
  assert.deepEqual(result.regressions, ['login quebrado']);
});

test('evaluation: PASS_WITH_WARNINGS para score médio', () => {
  const result = engine.evaluate({
    metrics: { correctness: 0.72 },
    thresholds: { pass: 0.85, passWithWarnings: 0.7 },
  });
  assert.equal(result.verdict, 'PASS_WITH_WARNINGS');
});

test('evaluation: FAIL para score baixo', () => {
  const result = engine.evaluate({ metrics: { correctness: 0.4 } });
  assert.equal(result.verdict, 'FAIL');
});

test('evaluation: UNKNOWN sem evidência mensurada (nenhuma métrica ou teste)', () => {
  const result = engine.evaluate({ metrics: {} });
  assert.equal(result.verdict, 'UNKNOWN');
  assert.equal(result.score, 0);
  assert.ok(result.recommendations.some((r) => /evidência|métrica/i.test(r)), 'recomenda coletar evidência');
});

test('evaluation: weightedScore ignora métricas ausentes', () => {
  const score = engine.weightedScore({ correctness: 1 }, DEFAULT_WEIGHTINGS);
  assert.equal(score, 1);
});

test('evaluation: weightedScore pondera corretamente', () => {
  const score = engine.weightedScore({ correctness: 1, security: 1 }, DEFAULT_WEIGHTINGS);
  assert.equal(score, 1);
});

test('evaluation: testMetrics penaliza falhas', () => {
  const perfect = engine.testMetrics({ passed: 100, failed: 0 });
  assert.equal(perfect.testResults, 1);
  assert.ok(perfect.confidence > 0.85);
  const withFailure = engine.testMetrics({ passed: 99, failed: 1 });
  assert.ok(withFailure.testResults < 1, 'falha deve penalizar testResults');
  assert.ok(withFailure.testResults > 0.7);
  assert.ok(withFailure.confidence < perfect.confidence);
});

test('evaluation: buildReport inclui metadados', () => {
  const report = engine.buildReport({
    taskId: 'run-1',
    task: 'tarefa teste',
    agentId: 'qa',
    metrics: { correctness: 0.95, testResults: 0.95 },
    tests: { passed: 10, failed: 0 },
  });
  assert.equal(report.taskId, 'run-1');
  assert.equal(report.agentId, 'qa');
  assert.ok(report.createdAt);
  assert.equal(report.verdict, 'PASS');
});

test('evaluation: thresholds customizáveis', () => {
  const strict = new EvaluationEngine({ thresholds: { pass: 0.9, passWithWarnings: 0.8 } });
  const result = strict.evaluate({ metrics: { correctness: 0.85 } });
  assert.equal(result.verdict, 'PASS_WITH_WARNINGS');
});
