/**
 * Canvas Orchestration — testes do PROTOCOLO DE EVENTOS.
 *
 * Contrato sob teste (src/runtime/canvas/workflow-events.ts):
 *   - todo evento carrega `type`, `runId` e `at` (ISO), e é um FATO do run;
 *   - o bus guarda a timeline (`all()`) E notifica assinantes por tipo;
 *   - as factories omitem campos opcionais ausentes em vez de gravá-los como
 *     `undefined` (o consumidor distingue "não houve" de "veio vazio").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeMessageSent,
  makeModelResolved,
  makeNodeCompleted,
  makeNodeFailed,
  makeNodeStarted,
  makeWorkflowLifecycle,
  WorkflowEventBus,
} from '../canvas/workflow-events.js';
import type { NodeStartedEvent, WorkflowEvent } from '../canvas/workflow-events.js';

const isoTimestamp = (value: string): boolean => !Number.isNaN(Date.parse(value)) && value.endsWith('Z');

test('workflow-events: node.started carrega runId, nó, kind e omite opcionais ausentes', () => {
  const simples = makeNodeStarted('run-1', 'a', 'agent');
  assert.equal(simples.type, 'node.started');
  assert.equal(simples.runId, 'run-1');
  assert.equal(simples.nodeId, 'a');
  assert.equal(simples.kind, 'agent');
  assert.ok(isoTimestamp(simples.at));
  assert.equal('agent' in simples, false);
  assert.equal('attempt' in simples, false);

  const completo = makeNodeStarted('run-1', 'b', 'tool', 'devops', 2);
  assert.equal(completo.agent, 'devops');
  assert.equal(completo.attempt, 2);
});

test('workflow-events: node.completed normaliza status/latência/tokens com defaults', () => {
  const vazio = makeNodeCompleted('run-1', 'a', {});
  assert.equal(vazio.status, 'succeeded');
  assert.equal(vazio.latencyMs, 0);
  assert.equal(vazio.tokens, 0);
  assert.equal('model' in vazio, false);
  assert.equal('outputSummary' in vazio, false);

  const cheio = makeNodeCompleted('run-1', 'a', {
    status: 'skipped',
    latencyMs: 42,
    tokens: 100,
    model: 'llama3.1',
    provider: 'ollama',
    outputSummary: 'ok',
  });
  assert.deepEqual(cheio, {
    type: 'node.completed',
    runId: 'run-1',
    at: cheio.at,
    nodeId: 'a',
    status: 'skipped',
    latencyMs: 42,
    tokens: 100,
    model: 'llama3.1',
    provider: 'ollama',
    outputSummary: 'ok',
  });
});

test('workflow-events: node.failed guarda o erro e expõe attempt só quando informado', () => {
  const semAttempt = makeNodeFailed('run-1', 'a', 'provider indisponível');
  assert.equal(semAttempt.error, 'provider indisponível');
  assert.equal('attempt' in semAttempt, false);

  const comAttempt = makeNodeFailed('run-1', 'a', 'timeout', 3);
  assert.equal(comAttempt.attempt, 3);
});

test('workflow-events: message.sent expõe chaves do payload, nunca o payload', () => {
  const ev = makeMessageSent('run-1', {
    messageId: 'run-1-m1',
    from: 'architect',
    to: ['qa', 'devops'],
    messageType: 'critique',
    tokenEstimate: 12,
    payloadKeys: ['summary', 'files'],
  });
  assert.deepEqual(ev.to, ['qa', 'devops']);
  assert.equal(ev.messageType, 'critique');
  assert.equal(ev.tokenEstimate, 12);
  assert.deepEqual(ev.payloadKeys, ['summary', 'files']);
  assert.equal('payload' in ev, false, 'o segredo/artefato nunca entra no evento');
});

test('workflow-events: model.resolved registra a decisão de roteamento de um nó', () => {
  const ev = makeModelResolved('run-1', { nodeId: 'a', model: 'llama3.1', provider: 'ollama', source: 'auto', reasons: ['papel "specialist"'] });
  assert.equal(ev.model, 'llama3.1');
  assert.equal(ev.provider, 'ollama');
  assert.equal(ev.source, 'auto');
  assert.deepEqual(ev.reasons, ['papel "specialist"']);
});

test('workflow-events: lifecycle inclui status/score/razão só quando presentes', () => {
  const comTudo = makeWorkflowLifecycle('run-1', 'workflow.completed', { status: 'PASS', score: 1 });
  assert.equal(comTudo.status, 'PASS');
  assert.equal(comTudo.score, 1);
  assert.equal('reason' in comTudo, false);

  const vazio = makeWorkflowLifecycle('run-1', 'workflow.started');
  assert.equal('status' in vazio, false);
  assert.equal('score' in vazio, false);
  assert.equal(vazio.type, 'workflow.started');

  const comScoreZero = makeWorkflowLifecycle('run-1', 'workflow.failed', { status: 'FAIL', score: 0, reason: 'nó reprovado' });
  assert.equal(comScoreZero.score, 0, 'score 0 é um fato, não ausência');
  assert.equal(comScoreZero.reason, 'nó reprovado');
});

test('workflow-events: bus registra a timeline e notifica assinantes do tipo', () => {
  const bus = new WorkflowEventBus('run-1');
  const vistos: NodeStartedEvent[] = [];
  const off = bus.on('node.started', (e) => vistos.push(e));

  bus.emit(makeNodeStarted('run-1', 'a', 'agent'));
  bus.emit(makeNodeCompleted('run-1', 'a', {}));
  bus.emit(makeNodeStarted('run-1', 'b', 'agent'));

  assert.deepEqual(vistos.map((e) => e.nodeId), ['a', 'b'], 'só os eventos do tipo assinado');
  assert.equal(bus.all().length, 3, 'timeline guarda tudo, inclusive não assinado');

  off();
  bus.emit(makeNodeStarted('run-1', 'c', 'agent'));
  assert.equal(vistos.length, 2, 'unsubscribe corta o fluxo');
  assert.equal(bus.all().length, 4, 'mas a timeline continua');
});

test('workflow-events: múltiplos assinantes do mesmo tipo recebem o mesmo evento', () => {
  const bus = new WorkflowEventBus('run-2');
  const um: string[] = [];
  const dois: string[] = [];
  bus.on('message.sent', () => um.push('um'));
  bus.on('message.sent', () => dois.push('dois'));
  bus.emit(makeMessageSent('run-2', { messageId: 'm1', from: 'a', to: 'b', messageType: 'task', payloadKeys: [] }));
  assert.deepEqual([um, dois], [['um'], ['dois']]);
});

test("workflow-events: assinante '*' recebe todo evento, inclusive os de tipo específico", () => {
  const bus = new WorkflowEventBus('run-5');
  const vistos: string[] = [];
  const off = bus.on('*', (e) => vistos.push(e.type));
  bus.emit(makeNodeStarted('run-5', 'a', 'agent'));
  bus.emit(makeMessageSent('run-5', { messageId: 'm1', from: 'a', to: 'b', messageType: 'task', payloadKeys: [] }));
  assert.deepEqual(vistos, ['node.started', 'message.sent'], "'*' vê os dois canais, não só o canal 'all'");
  off();
  bus.emit(makeNodeCompleted('run-5', 'a', {}));
  assert.equal(vistos.length, 2, "unsubscribe corta o fluxo de '*' também");
});

test('workflow-events: emit devolve o evento em si (permite encadear)', () => {
  const bus = new WorkflowEventBus('run-3');
  const ev = makeNodeStarted('run-3', 'a', 'agent');
  assert.equal(bus.emit(ev), ev);
  assert.deepEqual(bus.all(), [ev]);
});

test('workflow-events: close remove listeners sem apagar a timeline', () => {
  const bus = new WorkflowEventBus('run-4');
  const vistos: WorkflowEvent[] = [];
  bus.on('node.started', (e) => vistos.push(e));
  bus.emit(makeNodeStarted('run-4', 'a', 'agent'));
  bus.close();
  bus.emit(makeNodeStarted('run-4', 'b', 'agent'));
  assert.equal(vistos.length, 1, 'após close ninguém é notificado');
  assert.equal(bus.all().length, 2, 'a timeline do run permanece para replay');
});
