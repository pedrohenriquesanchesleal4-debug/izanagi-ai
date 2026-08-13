import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DecisionJournal } from '../memory/decisions.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-decisions-'));
}

test('decision journal: record + list (mais recente primeiro)', () => {
  const journal = new DecisionJournal({ baseDir: tmpDir() });
  journal.record({
    kind: 'model-routing',
    chosen: 'claude-sonnet-4-5',
    alternatives: [{ option: 'claude-sonnet-4-5', score: 0.8 }, { option: 'gpt-4o', score: 0.5 }],
    reason: 'complexidade 3/5, raciocínio medium',
    runId: 'run-1',
  });
  journal.record({
    kind: 'agent-routing',
    chosen: 'senior-engineer',
    alternatives: [{ option: 'senior-engineer', score: 0.9 }],
    reason: 'melhor relevância semântica',
    runId: 'run-1',
  });

  const list = journal.list();
  assert.equal(list.length, 2);
  assert.equal(list[0].kind, 'agent-routing', 'mais recente primeiro');
  assert.ok(list.every((d) => d.id.startsWith('dec-')));
});

test('decision journal: confidence é inferida pela distância entre escolhida e melhor concorrente', () => {
  const journal = new DecisionJournal({ baseDir: tmpDir() });
  const obvia = journal.record({
    kind: 'model-routing',
    chosen: 'a',
    alternatives: [{ option: 'a', score: 0.95 }, { option: 'b', score: 0.2 }],
    reason: 'r',
  });
  const apertada = journal.record({
    kind: 'model-routing',
    chosen: 'a',
    alternatives: [{ option: 'a', score: 0.51 }, { option: 'b', score: 0.5 }],
    reason: 'r',
  });
  assert.ok(obvia.confidence > apertada.confidence, 'decisão óbvia deve ter mais confiança que uma apertada');
});

test('decision journal: confidence explícita tem prioridade sobre a inferida', () => {
  const journal = new DecisionJournal({ baseDir: tmpDir() });
  const d = journal.record({ kind: 'x', chosen: 'a', alternatives: [], reason: 'r', confidence: 0.42 });
  assert.equal(d.confidence, 0.42);
});

test('decision journal: forRun filtra por runId', () => {
  const journal = new DecisionJournal({ baseDir: tmpDir() });
  journal.record({ kind: 'model-routing', chosen: 'a', alternatives: [], reason: 'r', runId: 'run-1' });
  journal.record({ kind: 'model-routing', chosen: 'b', alternatives: [], reason: 'r', runId: 'run-2' });
  assert.equal(journal.forRun('run-1').length, 1);
  assert.equal(journal.forRun('run-1')[0].chosen, 'a');
});

test('decision journal: search busca por kind/chosen/reason', () => {
  const journal = new DecisionJournal({ baseDir: tmpDir() });
  journal.record({ kind: 'model-routing', chosen: 'claude-sonnet-4-5', alternatives: [], reason: 'risco alto' });
  assert.equal(journal.search('sonnet').length, 1);
  assert.equal(journal.search('risco alto').length, 1);
  assert.equal(journal.search('inexistente-xyz').length, 0);
});

test('decision journal: persiste em disco e recarrega em nova instância', () => {
  const baseDir = tmpDir();
  const j1 = new DecisionJournal({ baseDir });
  j1.record({ kind: 'model-routing', chosen: 'a', alternatives: [], reason: 'r', runId: 'run-1' });

  const j2 = new DecisionJournal({ baseDir });
  assert.equal(j2.list().length, 1);
});
