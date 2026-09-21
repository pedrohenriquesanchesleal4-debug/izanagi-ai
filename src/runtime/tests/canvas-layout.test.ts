/**
 * Canvas Orchestration — testes do AUTO-LAYOUT determinístico.
 *
 * Contrato sob teste (src/runtime/canvas/layout.ts):
 *   - MESMO IR + MESMA direção ⇒ MESMAS coordenadas (o editor depende disso
 *     para snapshots estáveis; nada de aleatoriedade);
 *   - camada = batch do scheduler; dentro da camada, ordem por id e
 *     centralização;
 *   - `applyLayout` devolve IR NOVO (não muta o original).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLayout, autoLayout } from '../canvas/layout.js';
import { compileCanvas } from '../canvas/compiler.js';
import type { CanvasDefinition, CanvasEdge, CanvasNode, WorkflowIR } from '../canvas/types.js';

function node(id: string, x = 0, y = 0, izanagi: Record<string, unknown> = { kind: 'agent' }): CanvasNode {
  return { id, type: 'text', x, y, text: id, izanagi: izanagi as CanvasNode['izanagi'] };
}

function edge(id: string, fromNode: string, toNode: string): CanvasEdge {
  return { id, fromNode, toNode };
}

function ir(nodes: CanvasNode[], edges: CanvasEdge[]): WorkflowIR {
  return compileCanvas({ nodes, edges } as CanvasDefinition);
}

const pos = (r: ReturnType<typeof autoLayout>, id: string) => r.positions.find((p) => p.id === id)!;

const linear = (): WorkflowIR =>
  ir(
    [node('in', 999, 999, { kind: 'input' }), node('a', 999, 999), node('out', 999, 999, { kind: 'output' })],
    [edge('e1', 'in', 'a'), edge('e2', 'a', 'out')],
  );

test('layout: é determinístico — duas chamadas produzem posições idênticas', () => {
  const workflow = linear();
  const primeira = autoLayout(workflow);
  const segunda = autoLayout(workflow);
  assert.deepEqual(primeira.positions, segunda.positions);
  assert.equal(primeira.algorithm, 'layered-horizontal');
  assert.equal(segunda.algorithm, 'layered-horizontal');
});

test('layout: camadas horizontais avançam em x e centralizam em y', () => {
  const r = autoLayout(linear());
  assert.equal(r.direction, 'horizontal');
  assert.equal(r.positions.length, 3);
  assert.deepEqual(pos(r, 'in'), { id: 'in', x: 0, y: 0 });
  assert.deepEqual(pos(r, 'a'), { id: 'a', x: 160, y: 0 });
  assert.deepEqual(pos(r, 'out'), { id: 'out', x: 320, y: 0 });
});

test('layout: nós da mesma camada são deslocados para cima/baixo (ordem por id)', () => {
  const workflow = ir(
    [node('in', 0, 0, { kind: 'input' }), node('z', 0, 0), node('a', 0, 0), node('out', 0, 0, { kind: 'output' })],
    [edge('e1', 'in', 'a'), edge('e2', 'in', 'z'), edge('e3', 'a', 'out'), edge('e4', 'z', 'out')],
  );
  const r = autoLayout(workflow);
  assert.equal(pos(r, 'a').x, 160);
  assert.equal(pos(r, 'z').x, 160);
  assert.equal(pos(r, 'a').y, -20, 'primeiro por id fica acima');
  assert.equal(pos(r, 'z').y, 20, 'segundo por id fica abaixo');
  assert.equal(pos(r, 'in').y, 0);
});

test('layout: direção vertical espelha os eixos', () => {
  const r = autoLayout(linear(), 'vertical');
  assert.equal(r.algorithm, 'layered-vertical');
  assert.deepEqual(pos(r, 'in'), { id: 'in', x: 0, y: 0 });
  assert.deepEqual(pos(r, 'a'), { id: 'a', x: 0, y: 160 });
  assert.deepEqual(pos(r, 'out'), { id: 'out', x: 0, y: 320 });
});

test('layout: tree e dag usam as mesmas camadas topológicas do horizontal', () => {
  const workflow = linear();
  const horizontal = autoLayout(workflow, 'horizontal');
  const tree = autoLayout(workflow, 'tree');
  const dag = autoLayout(workflow, 'dag');
  assert.deepEqual(tree.positions, horizontal.positions);
  assert.deepEqual(dag.positions, horizontal.positions);
  assert.equal(tree.algorithm, 'layered-tree');
  assert.equal(dag.algorithm, 'layered-dag');
});

test('layout: gapX/gapY customizados são respeitados', () => {
  const r = autoLayout(linear(), 'horizontal', { gapX: 100, gapY: 10 });
  assert.equal(pos(r, 'a').x, 100);
  assert.equal(pos(r, 'out').x, 200);

  const duas = autoLayout(
    ir([node('in', 0, 0, { kind: 'input' }), node('a', 0, 0), node('b', 0, 0), node('out', 0, 0, { kind: 'output' })], [
      edge('e1', 'in', 'a'),
      edge('e2', 'in', 'b'),
      edge('e3', 'a', 'out'),
      edge('e4', 'b', 'out'),
    ]),
    'horizontal',
    { gapY: 10 },
  );
  assert.equal(pos(duas, 'a').y, -5);
  assert.equal(pos(duas, 'b').y, 5);
});

test('layout: nós fora do agendamento (ciclo bloqueante) vão para a camada final', () => {
  const workflow = ir([node('a', 0, 0), node('b', 0, 0)], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]);
  const r = autoLayout(workflow);
  assert.equal(r.positions.length, 2);
  assert.equal(pos(r, 'a').x, 0, 'camada reservada é a última batch (nenhuma): rank 0');
  assert.equal(pos(r, 'b').x, 0);
  assert.equal(pos(r, 'a').y, -20);
  assert.equal(pos(r, 'b').y, 20);
});

test('layout: nó solto entra no primeiro batch e o fluxo principal segue na camada seguinte', () => {
  // 'solta' não tem arestas: cai no batch 0 junto de 'in' (ambos são raízes do
  // DAG). O layout soma camadas por batch — não inventa dependência.
  const workflow = ir(
    [node('in', 0, 0, { kind: 'input' }), node('solta', 0, 0), node('out', 0, 0, { kind: 'output' })],
    [edge('e1', 'in', 'out')],
  );
  const r = autoLayout(workflow);
  const ranks = new Map(r.positions.map((p) => [p.id, p.x]));
  assert.equal(ranks.get('in'), 0, 'batch 0 contém in e solta');
  assert.equal(ranks.get('solta'), 0);
  assert.equal(ranks.get('out'), 160);
});

test('layout: applyLayout devolve IR novo com x/y atualizados e não muta o original', () => {
  const workflow = linear();
  const original = {
    in: { x: workflow.nodes[0]!.x, y: workflow.nodes[0]!.y },
    a: { x: workflow.nodes[1]!.x, y: workflow.nodes[1]!.y },
  };
  const aplicado = applyLayout(workflow, autoLayout(workflow).positions);
  assert.notEqual(aplicado, workflow, 'IR novo, não o mesmo objeto');
  const porId = new Map(aplicado.nodes.map((n) => [n.id, n]));
  assert.equal(porId.get('a')!.x, 160);
  assert.equal(porId.get('in')!.x, 0);
  assert.equal(workflow.nodes[0]!.x, original.in.x, 'IR original intacto');
  assert.equal(workflow.nodes[1]!.x, original.a.x, 'IR original intacto');
  assert.equal(aplicado.edges, workflow.edges, 'arestas preservadas por referência');
});

test('layout: nós sem posição em applyLayout mantêm x/y originais', () => {
  const workflow = linear();
  const aplicado = applyLayout(workflow, [{ id: 'a', x: 7, y: 8 }]);
  const porId = new Map(aplicado.nodes.map((n) => [n.id, n]));
  assert.equal(porId.get('a')!.x, 7);
  assert.equal(porId.get('in')!.x, 999);
  assert.equal(porId.get('out')!.y, 999);
});
