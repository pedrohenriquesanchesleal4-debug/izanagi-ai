/**
 * Canvas Orchestration — testes do COMPILADOR Canvas → WorkflowIR.
 *
 * Contrato sob teste (src/runtime/canvas/compiler.ts):
 *   - o runtime opera sobre o IR, nunca sobre o JSON cru;
 *   - kinds estruturais (parallel/merge/input/output/…) não viram GraphNode
 *     executável; webhook é `latent` (sem executor embutido);
 *   - campos desconhecidos do editor são preservados em `extra`;
 *   - entrada/saída e capacidades (loops, ramos, endpoints) são DERIVADOS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileCanvas, KIND_TO_GRAPH_KIND } from '../canvas/compiler.js';
import type { CanvasDefinition, CanvasEdge, CanvasNode, IzanagiNodeKind } from '../canvas/types.js';

function node(id: string, izanagi: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}): CanvasNode {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    text: `texto ${id}`,
    ...(izanagi ? { izanagi: izanagi as CanvasNode['izanagi'] } : {}),
    ...extra,
  };
}

function edge(id: string, fromNode: string, toNode: string, izanagi?: Record<string, unknown>): CanvasEdge {
  return { id, fromNode, toNode, ...(izanagi ? { izanagi: izanagi as CanvasEdge['izanagi'] } : {}) };
}

function def(nodes: CanvasNode[], edges: CanvasEdge[] = [], meta: Record<string, unknown> = {}): CanvasDefinition {
  return { nodes, edges, ...meta };
}

test('compiler: KIND_TO_GRAPH_KIND mapeia cada kind semântico para o kind do runtime', () => {
  assert.deepEqual(KIND_TO_GRAPH_KIND, {
    agent: 'agent',
    orchestrator: 'agent',
    evaluator: 'agent',
    skill: 'agent',
    model: 'structural',
    router: 'structural',
    memory: 'structural',
    tool: 'tool',
    webhook: 'latent',
    condition: 'gate',
    parallel: 'structural',
    merge: 'structural',
    input: 'structural',
    output: 'structural',
    'human-review': 'approval',
    group: 'structural',
  });
});

test('compiler: cada nó do canvas vira RuntimeNode com o graphKind correspondente', () => {
  const kinds: IzanagiNodeKind[] = ['agent', 'orchestrator', 'evaluator', 'skill', 'tool', 'human-review', 'condition'];
  const nodes = kinds.map((k, i) => node(`n${i}`, { kind: k }));
  const ir = compileCanvas(def(nodes));
  const porId = new Map(ir.nodes.map((n) => [n.id, n]));
  assert.equal(porId.get('n0')!.graphKind, 'agent');
  assert.equal(porId.get('n1')!.graphKind, 'agent');
  assert.equal(porId.get('n2')!.graphKind, 'agent');
  assert.equal(porId.get('n3')!.graphKind, 'agent');
  assert.equal(porId.get('n4')!.graphKind, 'tool');
  assert.equal(porId.get('n5')!.graphKind, 'approval');
  assert.equal(porId.get('n6')!.graphKind, 'gate');
});

test('compiler: kinds estruturais e webhook não viram GraphNode executável', () => {
  const estruturais: IzanagiNodeKind[] = ['parallel', 'merge', 'input', 'output', 'model', 'router', 'memory', 'group'];
  const ir = compileCanvas(def([...estruturais.map((k, i) => node(`s${i}`, { kind: k })), node('w', { kind: 'webhook', url: 'https://x.example.com' })]));
  for (const n of ir.nodes) {
    assert.equal(n.graphKind, undefined, `kind ${n.kind} deveria ser estrutural`);
  }
  assert.equal(ir.nodes.find((n) => n.id === 'w')!.kind, 'webhook');
});

test('compiler: nó sem izanagi usa kind agent; orchestrator ganha agente default', () => {
  const ir = compileCanvas(
    def([node('semMeta', undefined), node('orq', { kind: 'orchestrator' }), node('comAgente', { kind: 'orchestrator', agent: 'architect' })]),
  );
  assert.equal(ir.nodes[0]!.kind, 'agent');
  assert.equal(ir.nodes[0]!.agent, undefined);
  assert.equal(ir.nodes[1]!.agent, 'orchestrator');
  assert.equal(ir.nodes[2]!.agent, 'architect');
});

test('compiler: metadados do nó são transportados (agent, skills, model, context, loop, tool, prompt)', () => {
  const ir = compileCanvas(
    def([
      node('a', {
        kind: 'agent',
        agent: 'qa',
        skills: ['qa', 'tdd'],
        model: { mode: 'auto' },
        context: { mode: 'selective', include: ['input.task'] },
        retry: { maxAttempts: 3 },
        timeoutMs: 5000,
        tokenBudget: 900,
        condition: "result.score >= 0.8",
        permissions: ['fs:read'],
        loop: { maxIterations: 4 },
        prompt: 'revise tudo',
      }),
    ]),
  );
  const n = ir.nodes[0]!;
  assert.equal(n.agent, 'qa');
  assert.deepEqual(n.skills, ['qa', 'tdd']);
  assert.deepEqual(n.model, { mode: 'auto' });
  assert.deepEqual(n.context, { mode: 'selective', include: ['input.task'] });
  assert.deepEqual(n.retry, { maxAttempts: 3 });
  assert.equal(n.timeoutMs, 5000);
  assert.equal(n.tokenBudget, 900);
  assert.equal(n.condition, 'result.score >= 0.8');
  assert.deepEqual(n.permissions, ['fs:read']);
  assert.deepEqual(n.loop, { maxIterations: 4 });
  assert.equal(n.prompt, 'revise tudo');
});

test('compiler: campos desconhecidos do nó e do namespace izanagi vão para extra', () => {
  const ir = compileCanvas(
    def([node('a', { kind: 'agent', campoFuturo: 'x' }, { zIndex: 3, obsidian: { id: 'zzz' } })]),
  );
  const extra = ir.nodes[0]!.extra;
  assert.equal(extra.zIndex, 3);
  assert.deepEqual(extra.obsidian, { id: 'zzz' });
  assert.deepEqual((extra.izanagi_extra as Record<string, unknown>).campoFuturo, 'x');
});

test('compiler: label cai em text → file → url → id', () => {
  const comFile = node('f', { kind: 'file' });
  delete (comFile as { text?: string }).text;
  comFile.file = 'notas.md';
  const comUrl = node('u', { kind: 'link' });
  delete (comUrl as { text?: string }).text;
  comUrl.url = 'https://exemplo.com';
  const semNada = node('i', { kind: 'agent' });
  delete (semNada as { text?: string }).text;
  const ir = compileCanvas(def([comFile, comUrl, semNada]));
  assert.deepEqual(
    ir.nodes.map((n) => n.label),
    ['notas.md', 'https://exemplo.com', 'i'],
  );
});

test('compiler: arestas preservam messageType, condição, label e campos extra', () => {
  const ir = compileCanvas(
    def(
      [node('a', { kind: 'input' }), node('b', { kind: 'output' })],
      [edge('e1', 'a', 'b', { messageType: 'task', condition: { type: 'success' } }), { ...edge('e2', 'a', 'b'), label: 'extra', strokeWidth: 2 }],
    ),
  );
  assert.equal(ir.edges[0]!.from, 'a');
  assert.equal(ir.edges[0]!.to, 'b');
  assert.equal(ir.edges[0]!.messageType, 'task');
  assert.deepEqual(ir.edges[0]!.condition, { type: 'success' });
  assert.equal(ir.edges[1]!.label, 'extra');
  assert.equal(ir.edges[1]!.extra.strokeWidth, 2);
});

test('compiler: entryNodes = nós input + não-estruturais sem aresta chegando', () => {
  const ir = compileCanvas(
    def(
      [node('in', { kind: 'input' }), node('solta', { kind: 'agent' }), node('meio', { kind: 'agent' }), node('fim', { kind: 'output' })],
      [edge('e1', 'in', 'meio'), edge('e2', 'meio', 'fim')],
    ),
  );
  assert.deepEqual(ir.entryNodes, ['solta', 'in']);
});

test('compiler: exitNodes = nós output + não-estruturais sem aresta saindo', () => {
  const ir = compileCanvas(
    def(
      [node('in', { kind: 'input' }), node('meio', { kind: 'agent' }), node('fim', { kind: 'output' })],
      [edge('e1', 'in', 'meio'), edge('e2', 'meio', 'fim')],
    ),
  );
  assert.deepEqual(ir.exitNodes, ['fim']);
});

test('compiler: nós puramente estruturais não entram em entrada/saída', () => {
  const ir = compileCanvas(def([node('p', { kind: 'parallel' }), node('out', { kind: 'output' })], [edge('e1', 'p', 'out')]));
  assert.deepEqual(ir.entryNodes, []);
  assert.deepEqual(ir.exitNodes, ['out']);
});

test('compiler: capabilities.hasLoops é verdadeiro para loop declarado OU ciclo', () => {
  const comLoop = compileCanvas(def([node('a', { kind: 'agent', loop: { maxIterations: 2 } })]));
  assert.equal(comLoop.capabilities.hasLoops, true);

  const semLoop = compileCanvas(
    def([node('a', { kind: 'agent' }), node('b', { kind: 'agent' })], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]),
  );
  assert.equal(semLoop.capabilities.hasLoops, true);

  const dag = compileCanvas(
    def(
      [node('a', { kind: 'input' }), node('b', { kind: 'output' })],
      [edge('e1', 'a', 'b')],
    ),
  );
  assert.equal(dag.capabilities.hasLoops, false);
});

test('compiler: capabilities.hasParallelBranches detecta nós parallel/merge e ramificação real', () => {
  const porKind = compileCanvas(def([node('p', { kind: 'parallel' })]));
  assert.equal(porKind.capabilities.hasParallelBranches, true);

  const porRamo = compileCanvas(
    def(
      [node('a', { kind: 'agent' }), node('b', { kind: 'agent' }), node('c', { kind: 'agent' })],
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'c')],
    ),
  );
  assert.equal(porRamo.capabilities.hasParallelBranches, true);

  const linear = compileCanvas(
    def([node('a', { kind: 'agent' }), node('b', { kind: 'agent' })], [edge('e1', 'a', 'b')]),
  );
  assert.equal(linear.capabilities.hasParallelBranches, false);
});

test('compiler: capabilities.hasExternalEndpoints só é verdadeiro com webhook', () => {
  assert.equal(compileCanvas(def([node('w', { kind: 'webhook' })])).capabilities.hasExternalEndpoints, true);
  assert.equal(compileCanvas(def([node('a', { kind: 'agent' })])).capabilities.hasExternalEndpoints, false);
});

test('compiler: id e name vêm do canvas quando declarados; id ganha default estável em formato', () => {
  const comId = compileCanvas(def([node('a', { kind: 'agent' })], [], { id: 'izanagi:meu-wf', name: 'meu-wf' }));
  assert.equal(comId.id, 'izanagi:meu-wf');
  assert.equal(comId.name, 'meu-wf');

  const semId = compileCanvas(def([node('a', { kind: 'agent' })]));
  assert.match(semId.id, /^canvas-[a-z0-9]+$/);
  assert.equal(semId.name, undefined);
});
