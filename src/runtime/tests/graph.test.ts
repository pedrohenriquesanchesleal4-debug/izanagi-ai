import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionGraphBuilder, evaluateCondition } from '../orchestration/graph.js';
import { Planner, templateForCategory } from '../orchestration/planner.js';

const builder = new ExecutionGraphBuilder();

test('graph: ordem topológica correta', () => {
  const graph = builder.build({
    task: 't',
    nodes: [
      { id: 'a', kind: 'agent', dependencies: [] },
      { id: 'b', kind: 'agent', dependencies: ['a'] },
      { id: 'c', kind: 'agent', dependencies: ['a'] },
      { id: 'd', kind: 'evaluator', dependencies: ['b', 'c'] },
    ],
  });
  assert.deepEqual(graph.order, ['a', 'b', 'c', 'd']);
});

test('graph: paralelismo detectado (b e c juntos)', () => {
  const graph = builder.build({
    task: 't',
    nodes: [
      { id: 'a', kind: 'agent', dependencies: [] },
      { id: 'b', kind: 'agent', dependencies: ['a'] },
      { id: 'c', kind: 'agent', dependencies: ['a'] },
    ],
  });
  const batch = graph.parallelBatches.find((b) => b.includes('b') && b.includes('c'));
  assert.ok(batch, 'b e c deveriam estar no mesmo batch paralelo');
});

test('graph: dependência inexistente lança erro', () => {
  assert.throws(
    () => builder.build({ task: 't', nodes: [{ id: 'x', kind: 'agent', dependencies: ['ghost'] }] }),
    /não existe|ghost/,
  );
});

test('graph: ciclo lança erro', () => {
  assert.throws(
    () =>
      builder.build({
        task: 't',
        nodes: [
          { id: 'x', kind: 'agent', dependencies: ['y'] },
          { id: 'y', kind: 'agent', dependencies: ['x'] },
        ],
      }),
    /cícl|cycle|ciclo/,
  );
});

test('graph: topologicalSort agrupa níveis', () => {
  const { order, parallelBatches } = builder.topologicalSort([
    { id: 'a', kind: 'agent', dependencies: [] },
    { id: 'b', kind: 'agent', dependencies: ['a'] },
    { id: 'c', kind: 'agent', dependencies: ['a'] },
  ]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(parallelBatches, [['a'], ['b', 'c']]);
});

test('graph: evaluateCondition simples e ausente', () => {
  assert.equal(evaluateCondition('ok === true', { ok: true }), true);
  assert.equal(evaluateCondition('ok === true', { ok: false }), false);
  assert.equal(evaluateCondition(undefined, {}), true);
});

test('planner: templateForCategory mapeia corretamente', () => {
  assert.equal(templateForCategory('fullstack'), 'fullstack');
  assert.equal(templateForCategory('saas'), 'fullstack');
  assert.equal(templateForCategory('debugging'), 'debugging');
  assert.equal(templateForCategory('unknown-x'), 'implementation');
});

test('planner: fullstack gera grafo com avaliação e paralelismo', () => {
  const planner = new Planner();
  const graph = planner.plan({
    task: 'saas completo',
    category: 'fullstack',
    primaryAgent: 'senior-engineer',
    skillChain: [],
  });
  assert.ok(graph.nodes.some((n) => n.id === 'evaluation' && n.kind === 'evaluator'));
  assert.ok(graph.nodes.some((n) => n.id === 'critic' && n.agent === 'adversarial-critic'));
  const parallel = graph.parallelBatches.some((b) => b.length >= 3);
  assert.ok(parallel, 'fullstack deve ter frentes paralelas (security ∥ database ∥ product)');
  assert.equal(graph.budget.maxTokens, 32000);
});

test('planner: debugging segue fluxo de causa raiz', () => {
  const planner = new Planner();
  const graph = planner.plan({
    task: 'corrigir bug de hydration',
    category: 'debugging',
    primaryAgent: 'bug-hunter',
    skillChain: ['systematic-debugging'],
  });
  const ids = graph.nodes.map((n) => n.id);
  assert.deepEqual(ids, ['reproduce', 'root-cause', 'fix', 'regression-test', 'evaluation']);
});

test('planner: implementation usa primaryAgent e skillChain', () => {
  const planner = new Planner();
  const graph = planner.plan({
    task: 'criar login page',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: ['frontend', 'ui-ux-pro-max'],
  });
  const impl = graph.nodes.find((n) => n.id === 'execute');
  assert.equal(impl?.agent, 'senior-engineer');
  assert.deepEqual(impl?.skills, ['frontend', 'ui-ux-pro-max']);
});

test('planner: replan marca concluídos como skipped e substitui agente', () => {
  const planner = new Planner();
  const graph = planner.plan({
    task: 't',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
  });
  graph.nodes[0].status = 'succeeded';
  graph.nodes[1].status = 'failed';
  const replanned = planner.replan(graph, graph.nodes[1].id, { agent: 'qa' });
  assert.equal(replanned.nodes[0].status, 'skipped');
  const failed = replanned.nodes.find((n) => n.id === graph.nodes[1].id)!;
  assert.equal(failed.status, 'pending');
  assert.equal(failed.agent, 'qa');
  assert.ok(failed.metadata?.replanned);
});
