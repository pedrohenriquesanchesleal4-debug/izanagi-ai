/**
 * Canvas Orchestration — testes do MESSAGE BUS e do estado do workflow.
 *
 * Contrato sob teste (src/runtime/canvas/message-bus.ts):
 *   - comunicação agente-a-agente é por MENSAGEM ESTRUTURADA, não por
 *     concatenação de output;
 *   - request/reply usa `correlationId` (sem instanciar o nó duas vezes);
 *   - métricas do run (tokens, latência, custo) são acumuladas no estado.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accrueTokens,
  createWorkflowState,
  MessageBus,
  recordNodeResult,
  setWorkflowStatus,
  summarizeMessage,
} from '../canvas/message-bus.js';
import type { AgentMessage } from '../canvas/types.js';

const bus = (runId = 'run-1'): MessageBus => new MessageBus(runId);

test('message-bus: send cria mensagem com id estável do run e metadata', () => {
  const b = bus('run-x');
  const msg = b.send('architect', 'qa', 'critique', { summary: 'revise' });
  assert.match(msg.id, /^run-x-m\d+$/);
  assert.equal(msg.runId, 'run-x');
  assert.equal(msg.from, 'architect');
  assert.equal(msg.to, 'qa');
  assert.equal(msg.type, 'critique');
  assert.deepEqual(msg.payload, { summary: 'revise' });
  assert.ok(!Number.isNaN(Date.parse(msg.metadata.timestamp)));
  assert.equal(msg.metadata.priority, undefined, 'prioridade ausente não vira "normal"');
  assert.equal(msg.metadata.tokenEstimate, undefined);
  assert.equal(msg.metadata.correlationId, undefined);
});

test('message-bus: send preserva opts (prioridade, estimativa de token, correlação) e destinatários múltiplos', () => {
  const b = bus();
  const msg = b.send('a', ['b', 'c'], 'handoff', { x: 1 }, { priority: 'high', tokenEstimate: 7, correlationId: 'c-1' });
  assert.deepEqual(msg.to, ['b', 'c']);
  assert.equal(msg.metadata.priority, 'high');
  assert.equal(msg.metadata.tokenEstimate, 7);
  assert.equal(msg.metadata.correlationId, 'c-1');
});

test('message-bus: ids são únicos e a ordem de envio é preservada em all()', () => {
  const b = bus('run-seq');
  const primeira = b.send('a', 'b', 'task', {});
  const segunda = b.send('b', 'a', 'answer', {});
  assert.notEqual(primeira.id, segunda.id);
  assert.deepEqual(b.all().map((m) => m.from), ['a', 'b']);
});

test('message-bus: broadcast vai sem destinatário fixo e com prioridade alta', () => {
  const b = bus();
  const msg = b.broadcast('orchestrator', 'task', { plano: true });
  assert.deepEqual(msg.to, []);
  assert.equal(msg.metadata.priority, 'high');

  const direcionado = b.broadcast('orchestrator', 'task', { plano: true }, ['a', 'b']);
  assert.deepEqual(direcionado.to, ['a', 'b']);
});

test('message-bus: receivedBy cobre destinatário direto e lista de destinatários', () => {
  const b = bus();
  b.send('a', 'qa', 'task', {});
  b.send('a', ['qa', 'devops'], 'handoff', {});
  b.send('a', 'outro', 'task', {});
  assert.equal(b.receivedBy('qa').length, 2);
  assert.equal(b.receivedBy('devops').length, 1);
  assert.equal(b.receivedBy('ninguem').length, 0);
});

test('message-bus: between é direcional (from → to) e não mistura terceiros', () => {
  const b = bus();
  b.send('architect', 'qa', 'handoff', {});
  b.send('qa', 'architect', 'answer', {});
  b.send('devops', 'qa', 'task', {});
  assert.equal(b.between('architect', 'qa').length, 1, 'só a mensagem que SAI de architect para qa');
  assert.equal(b.between('qa', 'architect').length, 1, 'a resposta é contada na direção inversa');
  assert.equal(b.between('qa', 'devops').length, 0, 'qa respondeu, devops não');
  assert.equal(b.between('devops', 'qa').length, 1);
});

test('message-bus: replyTo preenche correlationId e herda a prioridade da pergunta', () => {
  const b = bus();
  const pergunta = b.send('qa', 'architect', 'question', { duvida: 'qual módulo?' }, { priority: 'high' });
  const resposta = b.replyTo(pergunta, 'architect', { resposta: 'src/runtime' });
  assert.equal(resposta.type, 'answer');
  assert.equal(resposta.from, 'architect');
  assert.equal(resposta.to, 'qa');
  assert.equal(resposta.metadata.correlationId, pergunta.id);
  assert.equal(resposta.metadata.priority, 'high');
  assert.equal(b.findByCorrelation(pergunta.id), resposta);
});

test('message-bus: request resolve quando chega a resposta correlacionada', async () => {
  const b = bus('run-req');
  const { message, reply } = b.request('qa', 'architect', { duvida: 'qual arquivo?' });
  assert.equal(message.type, 'question');
  b.replyTo(message, 'architect', { resposta: 'canvas/types.ts' });
  const resposta = await reply;
  assert.equal(resposta.from, 'architect');
  assert.deepEqual(resposta.payload, { resposta: 'canvas/types.ts' });
});

test('message-bus: createWorkflowState nasce vazio e com status pending', () => {
  const state = createWorkflowState('run-1', { task: 'x' });
  assert.deepEqual(state, {
    runId: 'run-1',
    input: { task: 'x' },
    artifacts: {},
    messages: [],
    nodeResults: {},
    variables: {},
    memoryRefs: [],
    metrics: { totalTokens: 0, totalLatencyMs: 0 },
    status: 'pending',
  });
});

test('message-bus: recordNodeResult acumula latência, custo e indexa por nó', () => {
  const state = createWorkflowState('run-1', null);
  recordNodeResult(state, { nodeId: 'a', status: 'succeeded', latencyMs: 10, costUsd: 0.002 });
  recordNodeResult(state, { nodeId: 'b', status: 'succeeded', latencyMs: 5 });
  recordNodeResult(state, { nodeId: 'a', status: 'failed', latencyMs: 1 });
  assert.equal(state.metrics.totalLatencyMs, 16);
  assert.equal(state.metrics.estimatedCost, 0.002, 'sem custo declarado não soma nada');
  assert.equal(state.nodeResults.a!.status, 'failed', 'o último resultado do nó vence');
  assert.equal(Object.keys(state.nodeResults).length, 2);
});

test('message-bus: accrueTokens soma entrada e saída, e setWorkflowStatus escreve o estado', () => {
  const state = createWorkflowState('run-1', null);
  accrueTokens(state, { input: 100, output: 20 });
  accrueTokens(state, { input: 5, output: 5 });
  assert.equal(state.metrics.totalTokens, 130);
  setWorkflowStatus(state, 'completed');
  assert.equal(state.status, 'completed');
});

test('message-bus: summarizeMessage resume payload sem despejar conteúdo', () => {
  const msg: AgentMessage = {
    id: 'run-1-m1',
    runId: 'run-1',
    from: 'a',
    to: 'b',
    type: 'task',
    payload: { x: 1 },
    metadata: { timestamp: '2026-01-01T00:00:00.000Z' },
  };
  const resumo = summarizeMessage(msg);
  assert.match(resumo, /^task de a \(1 chave\(s\), ~\d+ bytes\)$/);

  const vazio = summarizeMessage({ ...msg, payload: {} });
  assert.match(vazio, /0 chave\(s\)/);
});
