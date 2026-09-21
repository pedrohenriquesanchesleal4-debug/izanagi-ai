/**
 * Canvas Orchestration — testes do SCHEDULER (ordem topológica + batches).
 *
 * Contrato sob teste (src/runtime/canvas/scheduler.ts):
 *   - a ordem respeita dependências; batches agrupam nós paralelizáveis;
 *   - aresta de retorno para nó COM loop NÃO vira dependência (o loop é
 *     controlado pelo executor, com teto e condição de término);
 *   - ciclo sem semântica de loop vira `blockingCycles` (o scheduler planeja,
 *     nunca executa).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomingEdges, outgoingEdges, schedule } from '../canvas/scheduler.js';
import { compileCanvas } from '../canvas/compiler.js';
import type { CanvasDefinition, CanvasEdge, CanvasNode } from '../canvas/types.js';

function node(id: string, izanagi: Record<string, unknown> = {}): CanvasNode {
  return { id, type: 'text', x: 0, y: 0, text: id, izanagi: izanagi as CanvasNode['izanagi'] };
}

function edge(id: string, fromNode: string, toNode: string): CanvasEdge {
  return { id, fromNode, toNode };
}

function ir(nodes: CanvasNode[], edges: CanvasEdge[], meta: Record<string, unknown> = {}) {
  return compileCanvas({ nodes, edges, ...meta } as CanvasDefinition);
}

test('scheduler: cadeia linear tem uma ordem topológica previsível', () => {
  const plan = schedule(
    ir(
      [node('out', { kind: 'output' }), node('b', { kind: 'agent' }), node('a', { kind: 'agent' }), node('in', { kind: 'input' })],
      [edge('e1', 'in', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'out')],
    ),
  );
  assert.deepEqual(plan.order, ['in', 'a', 'b', 'out']);
  assert.deepEqual(plan.parallelBatches, [['in'], ['a'], ['b'], ['out']]);
  assert.deepEqual(plan.blockingCycles, []);
  assert.deepEqual(plan.loopNodes, []);
});

test('scheduler: ramos independentes caem no mesmo batch paralelo', () => {
  const plan = schedule(
    ir(
      [node('in', { kind: 'input' }), node('a', { kind: 'agent' }), node('b', { kind: 'agent' }), node('out', { kind: 'output' })],
      [edge('e1', 'in', 'a'), edge('e2', 'in', 'b'), edge('e3', 'a', 'out'), edge('e4', 'b', 'out')],
    ),
  );
  assert.deepEqual(plan.parallelBatches, [['in'], ['a', 'b'], ['out']]);
  assert.equal(plan.order.length, 4);
  assert.equal(plan.order[0], 'in');
  assert.equal(plan.order[3], 'out');
});

test('scheduler: entryNodes/exitNodes vêm do compilador, sem recálculo', () => {
  const workflow = ir(
    [node('in', { kind: 'input' }), node('a', { kind: 'agent' }), node('out', { kind: 'output' })],
    [edge('e1', 'in', 'a'), edge('e2', 'a', 'out')],
  );
  const plan = schedule(workflow);
  assert.deepEqual(plan.entryNodes, workflow.entryNodes);
  assert.deepEqual(plan.exitNodes, workflow.exitNodes);
});

test('scheduler: ciclo sem loop vira blockingCycles e some da ordem', () => {
  const plan = schedule(
    ir(
      [node('in', { kind: 'input' }), node('a', { kind: 'agent' }), node('b', { kind: 'agent' })],
      [edge('e1', 'in', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')],
    ),
  );
  assert.deepEqual(plan.blockingCycles, [['a', 'b']]);
  assert.deepEqual(plan.order, ['in']);
  assert.deepEqual(plan.parallelBatches, [['in']]);
});

test('scheduler: aresta que entra no loop continua dependência; retorno (que fecha ciclo) é ignorado', () => {
  const plan = schedule(
    ir(
      [
        node('in', { kind: 'input' }),
        node('a', { kind: 'agent' }),
        node('b', { kind: 'agent', loop: { maxIterations: 3, terminationCondition: "result == 'ok'" } }),
        node('out', { kind: 'output' }),
      ],
      [edge('e1', 'in', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'out')],
    ),
  );
  assert.deepEqual(plan.loopNodes, ['b']);
  assert.deepEqual(plan.blockingCycles, []);
  assert.equal(plan.order.length, 4, 'todos os nós são agendáveis');
  // Sem aresta de retorno no fixture, a entrada a→b NÃO é retorno: b espera a.
  assert.ok(plan.order.indexOf('a') < plan.order.indexOf('b'), 'a vem antes de b: a→b é dependência normal');
  // Cadeia linear in → a → b(loop) → out, cada nó numa camada.
  assert.deepEqual(plan.parallelBatches, [['in'], ['a'], ['b'], ['out']]);
});

test('scheduler: retorno de loop (b→a com b loop) fecha ciclo e é ignorado no DAG', () => {
  const plan = schedule(
    ir(
      [
        node('in', { kind: 'input' }),
        node('a', { kind: 'agent' }),
        node('b', { kind: 'agent', loop: { maxIterations: 3 } }),
      ],
      [edge('e1', 'in', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')],
    ),
  );
  assert.deepEqual(plan.blockingCycles, []);
  assert.equal(plan.order.length, 3, 'o ciclo a→b→a é quebrado pela aresta de retorno b→a');
  assert.deepEqual(plan.order, ['in', 'a', 'b']);
  assert.deepEqual(plan.parallelBatches, [['in'], ['a'], ['b']]);
});

test('scheduler: auto-loop explícito não gera ciclo bloqueante', () => {
  const plan = schedule(ir([node('a', { kind: 'agent', loop: { maxIterations: 2 } })], [edge('e1', 'a', 'a')]));
  assert.deepEqual(plan.blockingCycles, []);
  assert.deepEqual(plan.order, ['a']);
  assert.deepEqual(plan.parallelBatches, [['a']]);
});

test('scheduler: nó isolado (sem arestas) é agendado como raiz', () => {
  const plan = schedule(ir([node('sozinho', { kind: 'agent' })], []));
  assert.deepEqual(plan.order, ['sozinho']);
  assert.deepEqual(plan.parallelBatches, [['sozinho']]);
});

test('scheduler: outgoingEdges/incomingEdges devolvem as arestas do nó', () => {
  const workflow = ir(
    [node('in', { kind: 'input' }), node('a', { kind: 'agent' }), node('b', { kind: 'agent' })],
    [edge('e1', 'in', 'a'), edge('e2', 'a', 'b'), edge('e3', 'in', 'b')],
  );
  assert.deepEqual(
    outgoingEdges(workflow, 'in').map((e) => e.id),
    ['e1', 'e3'],
  );
  assert.deepEqual(
    incomingEdges(workflow, 'b').map((e) => e.id),
    ['e2', 'e3'],
  );
  assert.deepEqual(outgoingEdges(workflow, 'b'), []);
  assert.deepEqual(incomingEdges(workflow, 'in'), []);
});
