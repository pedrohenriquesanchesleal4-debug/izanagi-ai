/**
 * Parse da stream JSONL do maestro-cli e sumarização (spec §3.2 e §6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRunEvent,
  parseGoalEvent,
  parseMaestroEvent,
  summarizeRun,
  summarizeGoal,
} from '../maestro/events.js';
import type { RunEvent, GoalEvent } from '../maestro/types.js';

test('events: task_complete com todos os campos', () => {
  const e = parseRunEvent(
    '{"type":"task_complete","taskIndex":0,"success":true,"summary":"implementei","elapsedMs":12,"usageStats":{"input":100}}',
  );
  assert.equal(e?.type, 'task_complete');
  if (e?.type !== 'task_complete') return;
  assert.equal(e.taskIndex, 0);
  assert.equal(e.success, true);
  assert.equal(e.summary, 'implementei');
  assert.equal(e.elapsedMs, 12);
  assert.deepEqual(e.usageStats, { input: 100 });
});

test('events: documento com campos mínimos parseia; extras ignorados', () => {
  const e = parseRunEvent('{"type":"document_start","document":"01.md","taskCount":3,"extra":"ignorado"}');
  assert.deepEqual(e, { type: 'document_start', document: '01.md', taskCount: 3 });
});

test('events: linha inválida vira null sem lançar', () => {
  assert.equal(parseRunEvent(''), null);
  assert.equal(parseRunEvent('   '), null);
  assert.equal(parseRunEvent('não é json'), null);
  assert.equal(parseRunEvent('{"type":"tipo-desconhecido"}'), null);
  assert.equal(parseRunEvent('[1,2]'), null);
  assert.equal(parseRunEvent('42'), null);
  assert.equal(parseRunEvent('{"type":"task_start"}'), null, 'task_start sem taskIndex é inválido');
  assert.equal(parseRunEvent('{"type":"complete","success":false}'), null, 'complete sem totalTasksCompleted é inválido');
});

test('events: parse dos eventos de parada stall/halt/gated', () => {
  assert.deepEqual(parseRunEvent('{"type":"document_stalled","document":"b.md","reason":"deadlock","remaining":2}'), {
    type: 'document_stalled',
    document: 'b.md',
    reason: 'deadlock',
    remaining: 2,
  });
  assert.deepEqual(parseRunEvent('{"type":"halt","reason":"abortado"}'), { type: 'halt', reason: 'abortado' });
  assert.deepEqual(parseRunEvent('{"type":"document_gated","document":"c.md","reason":"HITL"}'), {
    type: 'document_gated',
    document: 'c.md',
    reason: 'HITL',
  });
  assert.deepEqual(parseRunEvent('{"type":"model_resolution","tier":"high","model":"x-1"}'), {
    type: 'model_resolution',
    tier: 'high',
    model: 'x-1',
  });
});

test('events: goal_complete parseia', () => {
  const e = parseGoalEvent('{"type":"goal_complete","success":true,"exitReason":"criteria-met","finalProgress":1,"iterations":3}');
  assert.deepEqual(e, {
    type: 'goal_complete',
    success: true,
    exitReason: 'criteria-met',
    finalProgress: 1,
    iterations: 3,
  });
});

test('events: parseMaestroEvent cobre run e goal', () => {
  assert.equal(parseMaestroEvent('{"type":"complete","success":true,"totalTasksCompleted":1}')?.type, 'complete');
  assert.equal(parseMaestroEvent('{"type":"goal_complete","success":false}')?.type, 'goal_complete');
  assert.equal(parseMaestroEvent('lixo'), null);
});

test('events: summarizeRun agrega stalled, halt, gated, custo e docs', () => {
  const events: RunEvent[] = [
    { type: 'document_start', document: '01.md', taskCount: 3 },
    { type: 'task_complete', taskIndex: 0, success: true },
    { type: 'document_stalled', document: '02.md', reason: 'deadlock', remaining: 2 },
    { type: 'halt', reason: 'abortado pelo usuário' },
    { type: 'document_gated', document: '03.md', reason: 'precisa de aprovação' },
    { type: 'complete', success: false, totalTasksCompleted: 1, totalElapsedMs: 500, totalCost: 0.42 },
  ];
  const s = summarizeRun(events);

  assert.equal(s.success, false);
  assert.equal(s.totalTasksCompleted, 1);
  assert.equal(s.totalCost, 0.42);
  assert.equal(s.stalled.length, 1);
  assert.deepEqual(s.stalled[0], { document: '02.md', reason: 'deadlock', remaining: 2 });
  assert.equal(s.halted, true);
  assert.equal(s.haltedReason, 'abortado pelo usuário');
  assert.equal(s.gated.length, 1);
  assert.deepEqual(s.gated[0], { document: '03.md', reason: 'precisa de aprovação' });
  assert.deepEqual(s.documents, ['01.md', '02.md', '03.md']);
});

test('events: summarizeRun sem complete fica success null', () => {
  const s = summarizeRun([{ type: 'document_start', document: 'a.md', taskCount: 1 }]);
  assert.equal(s.success, null);
  assert.equal(s.totalTasksCompleted, 0);
  assert.equal(s.halted, false);
  assert.deepEqual(s.stalled, []);
  assert.deepEqual(s.gated, []);
});

test('events: summarizeGoal conta iterações e deadlocks', () => {
  const events: GoalEvent[] = [
    { type: 'goal_start', objective: 'refatorar', maxIterations: 5 },
    { type: 'goal_iteration_complete', iteration: 1, progress: 0.4, rationale: 'segue', complete: false, deadlock: false },
    { type: 'goal_iteration_complete', iteration: 2, progress: 0.4, rationale: 'travou', complete: false, deadlock: true },
    { type: 'goal_complete', success: true, exitReason: 'criteria-met', finalProgress: 1, iterations: 3 },
  ];
  const s = summarizeGoal(events);
  assert.equal(s.success, true);
  assert.equal(s.exitReason, 'criteria-met');
  assert.equal(s.finalProgress, 1);
  assert.equal(s.iterations, 3);
  assert.equal(s.deadlocks, 1);
  assert.equal(s.lastRationale, 'travou');
});