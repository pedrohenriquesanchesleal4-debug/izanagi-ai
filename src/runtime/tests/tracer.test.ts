import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Tracer, TraceStore } from '../observability/tracer.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-tr-'));
}

function makeEval(verdict: 'PASS' | 'FAIL', score: number) {
  return {
    taskId: 'run-test',
    task: 'tarefa teste',
    createdAt: new Date().toISOString(),
    verdict,
    score,
    confidence: 0.9,
    metrics: {},
    regressions: [],
    recommendations: [],
  };
}

test('tracer: registra spans, tokens e persiste', () => {
  const dir = tmpDir();
  const store = new TraceStore({ baseDir: dir });
  const tracer = new Tracer(store, { task: 'criar saas', command: 'run' });
  tracer.markAgent('architect');
  tracer.markSkill('qa');
  tracer.addTokens(1000, 500);
  const close = tracer.span('node:architecture', 'agent');
  close();
  const { trace, file } = tracer.finishAndSave({ evaluation: makeEval('PASS', 0.95) });
  assert.ok(trace.runId.startsWith('izanagi-'));
  assert.deepEqual(trace.agents, ['architect']);
  assert.deepEqual(trace.skills, ['qa']);
  assert.equal(trace.tokens?.total, 1500);
  assert.equal(trace.spans.length, 1);
  assert.equal(trace.spans[0].status, 'ok');
  assert.equal(trace.evaluation?.verdict, 'PASS');
  assert.ok(trace.durationMs <= 100);
  assert.ok(fs.existsSync(file));
});

test('tracer: list ordena runs por data desc', () => {
  const dir = tmpDir();
  const store = new TraceStore({ baseDir: dir });
  const t1 = new Tracer(store, { task: 'a', command: 'run' });
  const trace1 = t1.finishAndSave({}).trace;
  const t2 = new Tracer(store, { task: 'b', command: 'run' });
  const trace2 = t2.finishAndSave({}).trace;
  const list = store.list();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((r) => r.runId), [trace2.runId, trace1.runId]);
});

test('tracer: load recupera trace completo', () => {
  const dir = tmpDir();
  const store = new TraceStore({ baseDir: dir });
  const tracer = new Tracer(store, { task: 'x', command: 'run' });
  const { trace } = tracer.finishAndSave({ evaluation: makeEval('FAIL', 0.5) });
  const loaded = store.load(trace.runId);
  assert.equal(loaded?.runId, trace.runId);
  assert.equal(loaded?.evaluation?.verdict, 'FAIL');
});

test('tracer: close(false) com retry registra falha e retry', () => {
  const dir = tmpDir();
  const store = new TraceStore({ baseDir: dir });
  const tracer = new Tracer(store, { task: 'x', command: 'run' });
  const close = tracer.span('node:implementation', 'agent', { retry: true });
  close(false, 'timeout');
  const { trace } = tracer.finishAndSave({});
  assert.equal(trace.failures, 1);
  assert.equal(trace.retries, 1);
  assert.equal(trace.spans[0].status, 'error');
  assert.equal(trace.spans[0].error, 'timeout');
});

test('tracer: markTool e runId pré-definido', () => {
  const dir = tmpDir();
  const store = new TraceStore({ baseDir: dir });
  const tracer = new Tracer(store, { runId: 'izanagi-custom-0001', task: 'x', command: 'run' });
  tracer.markTool('bash');
  const { trace } = tracer.finishAndSave({});
  assert.equal(trace.runId, 'izanagi-custom-0001');
  assert.deepEqual(trace.tools, ['bash']);
});

test('tracer: crash-safety — cada span fechado já fica persistido em disco, antes do finishAndSave', () => {
  const dir = tmpDir();
  const store = new TraceStore({ baseDir: dir });
  const tracer = new Tracer(store, { task: 'run interrompido', command: 'run' });

  const close1 = tracer.span('node:execute', 'agent');
  close1(true);

  // "Fechou a CLI" aqui — finishAndSave() nunca é chamado. O que já rodou
  // deve estar salvo mesmo assim (senão um Ctrl+C no meio perde tudo).
  const partial = store.load(tracer.runId);
  assert.ok(partial, 'snapshot parcial persistido sem finishAndSave');
  assert.equal(partial!.spans.length, 1);
  assert.equal(partial!.spans[0].name, 'node:execute');
  assert.equal(partial!.evaluation, undefined, 'sem evaluation = sinal de que o run ainda está em andamento');

  const close2 = tracer.span('node:verify', 'agent');
  close2(true);
  const partial2 = store.load(tracer.runId);
  assert.equal(partial2!.spans.length, 2, 'segundo span também persiste incrementalmente');
});

test('tracer: load inexistente retorna null e list vazio sem diretório', () => {
  const dir = tmpDir();
  const store = new TraceStore({ baseDir: dir });
  assert.equal(store.load('nao-existe'), null);
  assert.equal(store.list().length, 0);
});
