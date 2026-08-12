import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhaseTokenBudget, defaultWeights, defaultBudgetForTier, PHASES } from '../token/budget.js';

test('budget: distribui total pelos pesos com exatidão', () => {
  const b = new PhaseTokenBudget(32000);
  const sum = PHASES.reduce((acc, p) => acc + b.allocation[p], 0);
  assert.ok(b.total >= 30000 && b.total <= 32000);
  assert.ok(Math.abs(32000 - sum) <= 4, `soma ${sum} deve ≈ alocação total`);
  assert.ok(b.remaining('execution') > 0);
});

test('budget: spend respeita teto da fase', () => {
  const b = new PhaseTokenBudget(1000, { planning: 0.1, execution: 0.9, evaluation: 0, recovery: 0 });
  assert.equal(b.spend('execution', 800), true);
  assert.equal(b.spend('execution', 200), false);
  assert.equal(b.exhausted('execution'), false);
  assert.equal(b.spend('execution', 100), true);
  assert.equal(b.exhausted('execution'), true);
  assert.equal(b.remaining('execution'), 0);
});

test('budget: spend com tokens inválidos não conta', () => {
  const b = new PhaseTokenBudget(1000);
  assert.equal(b.spend('execution', 0), true);
  assert.equal(b.spend('execution', -5), true);
  assert.equal(b.totalSpent(), 0);
});

test('budget: weights variam por complexidade', () => {
  const wLow = defaultWeights(1);
  const wHigh = defaultWeights(5);
  assert.ok(wLow.recovery < wHigh.recovery);
  assert.ok(wLow.execution > wHigh.execution);
});

test('budget: defaultBudgetForTier ordena premium > balanced > fast', () => {
  assert.ok(defaultBudgetForTier('premium') > defaultBudgetForTier('balanced'));
  assert.ok(defaultBudgetForTier('balanced') > defaultBudgetForTier('fast'));
});

test('budget: usage report com ratio e exhausted', () => {
  const b = new PhaseTokenBudget(1000, { planning: 0.5, execution: 0.5, evaluation: 0, recovery: 0 });
  b.spend('planning', 250);
  const usage = b.usage();
  const planning = usage.find((u) => u.phase === 'planning')!;
  assert.equal(planning.spent, 250);
  assert.equal(planning.ratio, 0.5);
  assert.equal(planning.exhausted, false);
  const execution = usage.find((u) => u.phase === 'execution')!;
  assert.equal(execution.exhausted, false);
});

test('budget: summary contém as 4 fases', () => {
  const b = new PhaseTokenBudget(32000);
  const s = b.summary();
  assert.deepEqual(Object.keys(s).sort(), [...PHASES].sort());
  assert.ok(s.execution.remaining > 0);
});