/**
 * Canvas Orchestration — compilador Canvas → WorkflowIR.
 *
 * O runtime opera sobre o IR (WorkflowIR), nunca sobre o JSON cru do canvas.
 * Nesta camada:
 *   - nós semânticos `parallel`/`merge`/`group` são extraídos como marcadores
 *     estruturais (o fluxo real é dado pelas arestas);
 *   - `graphKind` mapeia o kind semântico para o GraphNode kind do runtime
 *     (agente → agent, tool → tool, human-review → approval, condition → gate,
 *     demais kinds de interface não bloqueiam execução e são tolerados);
 *   - campos desconhecidos de apps compatíveis são preservados em `extra`.
 */

import type { CanvasDefinition, IzanagiNodeKind, IzanagiNodeMetadata, RuntimeEdge, RuntimeNode, WorkflowIR } from './types.js';

/** Mapeamento kind semântico → kind do GraphNode do runtime. */
export const KIND_TO_GRAPH_KIND: Record<IzanagiNodeKind, import('../types.js').GraphNode['kind'] | 'structural' | 'latent'> = {
  agent: 'agent',
  orchestrator: 'agent',
  evaluator: 'agent',
  skill: 'agent',
  model: 'structural', // seleção de modelo decidida em execução
  router: 'structural',
  memory: 'structural',
  tool: 'tool',
  webhook: 'latent', // sem executor embutido — exige nó de tool com permissão de rede
  condition: 'gate',
  parallel: 'structural',
  merge: 'structural',
  input: 'structural',
  output: 'structural',
  'human-review': 'approval',
  group: 'structural',
};

const STRUCTURAL_KINDS = new Set<IzanagiNodeKind>(['parallel', 'merge', 'input', 'output', 'model', 'router', 'memory', 'group']);

/** Preserva campos desconhecidos do nó (tudo que não está no schema do spec/izanagi). */
function extraOf(node: Record<string, unknown>): Record<string, unknown> {
  const known = new Set([
    'id', 'type', 'x', 'y', 'width', 'height', 'text', 'file', 'url', 'children', 'color', 'izanagi',
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!known.has(k)) extra[k] = v;
  }
  return extra;
}

function extraOfEdge(edge: Record<string, unknown>): Record<string, unknown> {
  const known = new Set(['id', 'fromNode', 'toNode', 'fromSide', 'toSide', 'endArrow', 'color', 'label', 'izanagi']);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(edge)) {
    if (!known.has(k)) extra[k] = v;
  }
  return extra;
}

export function compileCanvas(canvas: CanvasDefinition): WorkflowIR {
  const meta = canvas as CanvasDefinition & { id?: string; name?: string };

  const nodes: RuntimeNode[] = canvas.nodes.map((n) => {
    const iz: IzanagiNodeMetadata = n.izanagi ?? ({} as IzanagiNodeMetadata);
    const kind: IzanagiNodeKind = iz.kind ?? 'agent';
    const graphKind = KIND_TO_GRAPH_KIND[kind];
    return {
      id: n.id,
      kind,
      label: n.text ?? n.file ?? n.url ?? n.id,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      agent: iz.agent ?? (kind === 'orchestrator' ? 'orchestrator' : undefined),
      skills: iz.skills,
      model: iz.model,
      context: iz.context,
      retry: iz.retry,
      timeoutMs: iz.timeoutMs,
      tokenBudget: iz.tokenBudget,
      condition: iz.condition,
      permissions: iz.permissions,
      loop: iz.loop,
      tool: iz.tool,
      prompt: iz.prompt,
      graphKind: graphKind === 'structural' ? undefined : graphKind === 'latent' ? undefined : graphKind,
      extra: { ...extraOf(n as unknown as Record<string, unknown>), izanagi_extra: extraOf((iz ?? {}) as Record<string, unknown>) },
    };
  });

  const edges: RuntimeEdge[] = canvas.edges.map((e) => {
    const iz = e.izanagi ?? {};
    return {
      id: e.id,
      from: e.fromNode,
      to: e.toNode,
      label: e.label,
      messageType: iz.messageType,
      condition: iz.condition,
      extra: extraOfEdge(e as unknown as Record<string, unknown>),
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const hasIncoming = new Set(edges.map((e) => e.to));
  /** Entrada: nós sem aresta chegando. `group`/estruturais não contam como entrada. */
  const entryCandidates = nodes.filter((n) => !hasIncoming.has(n.id) && !STRUCTURAL_KINDS.has(n.kind));
  const entryNodes = entryCandidates.length > 0 ? entryCandidates.map((n) => n.id) : nodes.filter((n) => n.kind === 'input').map((n) => n.id);
  /** Saída: nós sem aresta saindo, não-estruturais. */
  const hasOutgoing = new Set(edges.map((e) => e.from));
  const exitNodes = nodes.filter((n) => !hasOutgoing.has(n.id) && !STRUCTURAL_KINDS.has(n.kind)).map((n) => n.id);

  const capabilities = {
    hasLoops: nodes.some((n) => n.loop !== undefined) || hasCycle(nodeIds, edges),
    hasParallelBranches: nodes.some((n) => n.kind === 'parallel' || n.kind === 'merge') || branching(edges) > 1,
    hasExternalEndpoints: nodes.some((n) => n.kind === 'webhook'),
  };

  return {
    id: meta.id ?? `canvas-${Math.random().toString(36).slice(2, 10)}`,
    name: meta.name,
    nodes,
    edges,
    entryNodes,
    exitNodes,
    capabilities,
  };
}

function branching(edges: RuntimeEdge[]): number {
  const out = new Map<string, number>();
  for (const e of edges) out.set(e.from, (out.get(e.from) ?? 0) + 1);
  return Math.max(0, ...out.values());
}

function hasCycle(nodeIds: Set<string>, edges: RuntimeEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);
  const state = new Map<string, 0 | 1 | 2>();
  const dfs = (node: string): boolean => {
    state.set(node, 1);
    for (const next of adj.get(node) ?? []) {
      const st = state.get(next);
      if (st === 1) return true;
      if (st === undefined && dfs(next)) return true;
    }
    state.set(node, 2);
    return false;
  };
  for (const id of nodeIds) {
    if (state.get(id) === undefined && dfs(id)) return true;
  }
  return false;
}