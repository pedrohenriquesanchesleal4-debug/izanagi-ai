import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, ALL_EVENTS } from '../observability/events.js';

test('events: emite e entrega para assinante do nome específico', () => {
  const bus = new EventBus('run-1');
  const received: unknown[] = [];
  bus.on('healing.started', (e) => received.push(e));

  bus.emit('healing.started', { nodeId: 'n1' });

  assert.equal(received.length, 1);
  assert.deepEqual(received[0], { name: 'healing.started', runId: 'run-1', at: (received[0] as { at: string }).at, data: { nodeId: 'n1' } });
});

test('events: assinante de ALL_EVENTS recebe todos os eventos, na ordem de emissão', () => {
  const bus = new EventBus('run-1');
  const names: string[] = [];
  bus.on(ALL_EVENTS, (e) => names.push(e.name));

  bus.emit('run.started', { task: 'x' });
  bus.emit('node.started', { nodeId: 'n1' });
  bus.emit('node.completed', { nodeId: 'n1', status: 'ok' });
  bus.emit('run.completed', { verdict: 'PASS' });

  assert.deepEqual(names, ['run.started', 'node.started', 'node.completed', 'run.completed']);
});

test('events: on() retorna unsubscribe funcional', () => {
  const bus = new EventBus('run-1');
  const received: unknown[] = [];
  const unsubscribe = bus.on('quality_gate.passed', (e) => received.push(e));

  bus.emit('quality_gate.passed', {});
  unsubscribe();
  bus.emit('quality_gate.passed', {});

  assert.equal(received.length, 1, 'só o evento antes do unsubscribe chega');
});

test('events: once() dispara só uma vez', () => {
  const bus = new EventBus('run-1');
  let count = 0;
  bus.once('run.started', () => count++);

  bus.emit('run.started', {});
  bus.emit('run.started', {});

  assert.equal(count, 1);
});

test('events: eventos de runs diferentes carregam o runId correto', () => {
  const busA = new EventBus('run-a');
  const busB = new EventBus('run-b');
  const seen: string[] = [];
  busA.on(ALL_EVENTS, (e) => seen.push(e.runId));
  busB.on(ALL_EVENTS, (e) => seen.push(e.runId));

  busA.emit('run.started', {});
  busB.emit('run.started', {});

  assert.deepEqual(seen, ['run-a', 'run-b']);
});
