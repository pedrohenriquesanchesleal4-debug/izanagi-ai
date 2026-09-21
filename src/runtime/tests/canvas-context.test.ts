/**
 * Canvas Orchestration — testes das POLÍTICAS DE CONTEXTO por nó.
 *
 * Contrato sob teste (src/runtime/canvas/context-policy.ts):
 *   - cada nó recebe SÓ o que a política dele permite (contexto controlado);
 *   - `selective` resolve caminhos por acesso de propriedade simples;
 *   - `summary` trunca entradas grandes e marca `truncated: true`;
 *   - `message-only` entrega só as mensagens ENDEREÇADAS ao nó.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, resolveStatePath, stateSnapshot } from '../canvas/context-policy.js';
import type { AgentMessage, CanvasNodeResult, WorkflowState } from '../canvas/types.js';

function message(from: string, to: string | string[], type: AgentMessage['type'], payload: Record<string, unknown>): AgentMessage {
  return {
    id: `m-${from}-${to.toString()}`,
    runId: 'run-1',
    from,
    to,
    type,
    payload,
    metadata: { timestamp: '2026-01-01T00:00:00.000Z' },
  };
}

function nodeResult(nodeId: string, output: unknown, score?: number): CanvasNodeResult {
  return { nodeId, status: 'succeeded', output, ...(score !== undefined ? { score } : {}) };
}

function makeState(over: Partial<WorkflowState> = {}): WorkflowState {
  return {
    runId: 'run-1',
    input: { task: 'refatorar módulo', nested: { deep: 1 } },
    // Artefatos são indexados POR NÓ (`architect.result`): é o único formato
    // que `resolveStatePath` sabe resolver (o head vira a primeira propriedade).
    artifacts: { architect: { result: 'A'.repeat(40) }, qa: { result: 'aprovado' } },
    messages: [
      message('input', 'architect', 'task', { summary: 'faça isso' }),
      message('architect', 'qa', 'critique', { summary: 'revise' }),
      message('qa', ['architect', 'devops'], 'handoff', { summary: 'passe adiante' }),
    ],
    nodeResults: { architect: nodeResult('architect', { ok: true }, 0.95), qa: nodeResult('qa', { ok: true }) },
    variables: { tentativas: 2, branch: 'main' },
    memoryRefs: ['mem-1'],
    metrics: { totalTokens: 120, totalLatencyMs: 30 },
    status: 'running',
    ...over,
  };
}

test('context: resolveStatePath resolve input, artefatos, resultados, variáveis e mensagens', () => {
  const state = makeState();
  assert.equal(resolveStatePath(state, 'input.task'), 'refatorar módulo');
  assert.equal(resolveStatePath(state, 'input.nested.deep'), 1);
  assert.equal(resolveStatePath(state, 'architect.result'), 'A'.repeat(40));
  assert.equal(resolveStatePath(state, 'qa.result'), 'aprovado');
  assert.deepEqual(resolveStatePath(state, 'result.architect.output'), { ok: true });
  assert.equal(resolveStatePath(state, 'node.architect.score'), 0.95);
  assert.equal(resolveStatePath(state, 'state.variables.tentativas'), 2);
  assert.equal(resolveStatePath(state, 'workflow.status'), 'running');
  assert.equal(resolveStatePath(state, 'workflow.runId'), 'run-1');
  assert.equal(resolveStatePath(state, 'msg.0.from'), 'input');
  assert.equal(resolveStatePath(state, 'messages.2.type'), 'handoff');
});

test('context: resolveStatePath devolve undefined para caminho inexistente ou fora de objeto', () => {
  const state = makeState();
  assert.equal(resolveStatePath(state, 'artefato.que.nao.existe'), undefined);
  assert.equal(resolveStatePath(state, 'input.task.profundo'), undefined);
  assert.equal(resolveStatePath(state, 'state.nada'), undefined);
});

test('context: política ausente equivale a full e entrega o estado inteiro', () => {
  const state = makeState();
  const routed = buildContext(state, undefined, 'architect');
  assert.equal(routed.content, state);
  assert.deepEqual(routed.sources, ['state']);
  assert.equal(routed.truncated, false);
});

test('context: selective inclui só os caminhos declarados (e ignora os ausentes)', () => {
  const routed = buildContext(makeState(), { mode: 'selective', include: ['input.task', 'architect.result', 'nao.existe'] }, 'qa');
  assert.deepEqual(routed.content, { 'input.task': 'refatorar módulo', 'architect.result': 'A'.repeat(40) });
  assert.deepEqual(routed.sources, ['input.task', 'architect.result']);
  assert.equal(routed.truncated, false);
});

test('context: selective respeita exclude mesmo em caminho incluído', () => {
  const routed = buildContext(
    makeState(),
    { mode: 'selective', include: ['input.task', 'architect.result'], exclude: ['architect.result'] },
    'qa',
  );
  assert.deepEqual(routed.content, { 'input.task': 'refatorar módulo' });
});

test('context: mode=artifact entrega os artefatos e remove os excluídos', () => {
  const todos = buildContext(makeState(), { mode: 'artifact' }, 'qa');
  assert.deepEqual(todos.content, { architect: { result: 'A'.repeat(40) }, qa: { result: 'aprovado' } });
  assert.deepEqual(todos.sources, ['artifact.architect', 'artifact.qa']);

  const filtrado = buildContext(makeState(), { mode: 'artifact', exclude: ['qa'] }, 'qa');
  assert.deepEqual(filtrado.content, { architect: { result: 'A'.repeat(40) } });
});

test('context: mode=message-only entrega só as mensagens endereçadas ao nó', () => {
  const routed = buildContext(makeState(), { mode: 'message-only' }, 'architect');
  assert.equal((routed.content as unknown[]).length, 2, 'direct + broadcast endereçado a architect');
  const de = (routed.content as Array<{ from: string; type: string }>).map((m) => `${m.from}:${m.type}`);
  assert.deepEqual(de, ['input:task', 'qa:handoff']);
  assert.deepEqual(routed.sources, ['messages']);
});

test('context: mode=message-only não entrega mensagens de terceiros', () => {
  const routed = buildContext(makeState(), { mode: 'message-only' }, 'devops');
  const de = (routed.content as Array<{ from: string }>).map((m) => m.from);
  assert.deepEqual(de, ['qa']);
});

test('context: mode=full entrega o estado inteiro e marca a fonte', () => {
  const state = makeState();
  const routed = buildContext(state, { mode: 'full' }, 'qa');
  assert.equal(routed.content, state);
  assert.deepEqual(routed.sources, ['state']);
});

test('context: mode=summary entrega input/artifacts/variables como seções', () => {
  const routed = buildContext(makeState(), { mode: 'summary' }, 'qa');
  assert.deepEqual(Object.keys(routed.content as Record<string, unknown>), ['input', 'artifacts', 'variables']);
  assert.deepEqual(routed.sources, ['input', 'artifacts', 'variables']);
  assert.equal(routed.truncated, false);
});

test('context: mode=summary trunca string acima de summarizeAbove e marca truncated', () => {
  const state = makeState({ input: 'x'.repeat(500) });
  // O limiar é maior que o JSON dos artefatos (que é um objeto) e menor que a
  // string longa: só a entrada grande é resumida.
  const routed = buildContext(state, { mode: 'summary', summarizeAbove: 200 }, 'qa');
  const conteudo = routed.content as { input: string };
  assert.equal(routed.truncated, true);
  assert.ok(conteudo.input.startsWith('x'.repeat(200)));
  assert.match(conteudo.input, /\[resumido: 500 chars\]/);
});

test('context: mode=summary com summarizeAbove generoso não trunca', () => {
  const state = makeState({ input: 'curto' });
  const routed = buildContext(state, { mode: 'summary', summarizeAbove: 10_000 }, 'qa');
  assert.equal(routed.truncated, false);
  assert.equal((routed.content as { input: string }).input, 'curto');
});

test('context: stateSnapshot compacta o estado em envelope serializável', () => {
  const snapshot = stateSnapshot(makeState());
  assert.deepEqual(snapshot, {
    runId: 'run-1',
    status: 'running',
    metrics: { totalTokens: 120, totalLatencyMs: 30 },
    nodeCount: 2,
    messageCount: 3,
    artifactKeys: ['architect', 'qa'],
  });
});
