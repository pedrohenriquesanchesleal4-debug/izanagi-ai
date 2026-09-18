/**
 * Canvas Orchestration — scheduler DAG.
 *
 * Calcula ordem topológica e batches paralelos do WorkflowIR, no mesmo
 * formato que o runtime existente espera (`ExecutionGraph.parallelBatches`).
 *
 * Ciclos com semântica de loop (nós com `loop` declarado) são "quebrados"
 * para o cálculo de batches: a aresta de retorno é ignorada na indicação de
 * dependência direcional, e o loop é materializado como re-execução do nó
 * (com `maxIterations` e condição de término) — o scheduler nunca executa
 * nada, apenas planeja.
 */

import type { WorkflowIR, RuntimeEdge } from './types.js';

export interface SchedulePlan {
  /** Ordem topológica (nós com dependências satisfeitas primeiro). */
  order: string[];
  /** Grupos de nós executáveis em paralelo. */
  parallelBatches: string[][];
  /** Nós de entrada/saída calculados pelo compilador. */
  entryNodes: string[];
  exitNodes: string[];
  /** Nós que participam de loop (para o executor iterar). */
  loopNodes: string[];
  /** Ciclos não-Loop detectados (impedem execução). */
  blockingCycles: string[][];
}

/**
 * Arestas de retorno de loop: aresta que volta para um nó que declara `loop`.
 * Essas arestas NÃO viram dependência direcional no batch — o fluxo de
 * iteração é controlado pelo executor (condição de término + maxIterations).
 */
function backEdges(ir: WorkflowIR): Set<string> {
  const backs = new Set<string>();
  const loopNodes = new Set(ir.nodes.filter((n) => n.loop).map((n) => n.id));
  for (const e of ir.edges) {
    if (loopNodes.has(e.to)) backs.add(e.id);
  }
  return backs;
}

export function schedule(ir: WorkflowIR): SchedulePlan {
  const backs = backEdges(ir);
  // Grafo direcional SEM arestas de retorno de loop
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const n of ir.nodes) {
    incoming.set(n.id, new Set());
    outgoing.set(n.id, new Set());
  }
  for (const e of ir.edges) {
    if (backs.has(e.id)) continue;
    incoming.get(e.to)?.add(e.from);
    outgoing.get(e.from)?.add(e.to);
  }

  // Kahn: ordem topológica
  const order: string[] = [];
  const ready = ir.nodes.filter((n) => (incoming.get(n.id)?.size ?? 0) === 0).map((n) => n.id);
  const indegree = new Map([...incoming].map(([id, deps]) => [id, deps.size]));
  const queue = [...ready];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of outgoing.get(node) ?? []) {
      const remain = indegree.get(next)! - 1;
      indegree.set(next, remain);
      if (remain === 0) queue.push(next);
    }
  }

  // Ciclos bloqueantes: nós que ficaram de fora da ordem topológica
  const visited = new Set(order);
  const blockingCycles = ir.nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);

  // Batches paralelos: camadas — cada nó na primeira camada onde todos os
  // dependentes (sem back-edges) já foram alocados.
  const batches: string[][] = [];
  const doneInBatch = new Map<string, number>();
  const rank = new Map<string, number>();
  for (const node of order) {
    const deps = [...(incoming.get(node) ?? [])];
    const layer = deps.length === 0 ? 0 : Math.max(...deps.map((d) => rank.get(d) ?? 0)) + 1;
    rank.set(node, layer);
    let batch = batches[layer];
    if (!batch) {
      batch = [];
      batches[layer] = batch;
    }
    batch.push(node);
    doneInBatch.set(node, layer);
  }

  const loopNodes = ir.nodes.filter((n) => n.loop).map((n) => n.id);

  return {
    order,
    parallelBatches: batches.filter((b) => b.length > 0),
    entryNodes: ir.entryNodes,
    exitNodes: ir.exitNodes,
    loopNodes,
    blockingCycles: blockingCycles.length > 0 ? [[...blockingCycles]] : [],
  };
}

/** Arestas que o executor deve avaliar como condição de roteamento (todas). */
export function outgoingEdges(ir: WorkflowIR, nodeId: string): RuntimeEdge[] {
  return ir.edges.filter((e) => e.from === nodeId);
}

/** Arestas de entrada de um nó (para inspeção de comunicação). */
export function incomingEdges(ir: WorkflowIR, nodeId: string): RuntimeEdge[] {
  return ir.edges.filter((e) => e.to === nodeId);
}