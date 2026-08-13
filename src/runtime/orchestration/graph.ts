/**
 * Execution Graph — grafo explícito de execução para tarefas complexas.
 *
 * Cada node declara id, kind, agent/skills, inputs/outputs, dependencies,
 * conditions, retryPolicy, timeout, tokenBudget e validator.
 *
 * O planner detecta dependências e computa:
 *  - ordem topológica (execução serial correta)
 *  - batches paralelos (nós independentes executáveis juntos)
 */

import crypto from 'crypto';
import type { ExecutionGraph, GraphNode } from '../types.js';
import { safeEvaluate } from './safe-eval.js';

export interface GraphInput {
  id?: string;
  task: string;
  nodes: GraphNode[];
  budget?: { maxAttempts?: number; maxTokens?: number; maxTimeMs?: number };
}

export class ExecutionGraphBuilder {
  /**
   * Constrói o grafo, valida ciclos, computa ordem topológica e batches.
   */
  build(input: GraphInput): ExecutionGraph {
    const id = input.id ?? `graph-${crypto.randomBytes(3).toString('hex')}`;
    const nodes = input.nodes.map((n) => ({ ...n, status: (n.status ?? 'pending') as GraphNode['status'] }));

    const ids = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      for (const dep of n.dependencies ?? []) {
        if (!ids.has(dep)) {
          throw new Error(`ExecutionGraph: nó "${n.id}" depende de "${dep}" que não existe no grafo`);
        }
      }
    }

    const { order, parallelBatches } = this.topologicalSort(nodes);

    return {
      id,
      task: input.task,
      createdAt: new Date().toISOString(),
      nodes,
      order,
      parallelBatches,
      budget: {
        maxAttempts: input.budget?.maxAttempts ?? 3,
        maxTokens: input.budget?.maxTokens ?? 16000,
        maxTimeMs: input.budget?.maxTimeMs ?? 600_000,
      },
    };
  }

  /**
   * Kahn's algorithm + agrupamento por níveis de paralelismo.
   * Retorna (ordem topológica, batches de nós independentes).
   */
  topologicalSort(nodes: GraphNode[]): { order: string[]; parallelBatches: string[][] } {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const n of nodes) {
      indegree.set(n.id, n.dependencies?.length ?? 0);
      dependents.set(n.id, []);
    }
    for (const n of nodes) {
      for (const dep of n.dependencies ?? []) {
        dependents.get(dep)!.push(n.id);
      }
    }

    const order: string[] = [];
    const parallelBatches: string[][] = [];
    const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
    const visited = new Set<string>();

    while (queue.length > 0) {
      const batch: string[] = [];
      const nextQueue: string[] = [];
      for (const id of queue) {
        if (visited.has(id)) continue;
        visited.add(id);
        batch.push(id);
        for (const child of dependents.get(id)!) {
          const d = indegree.get(child)! - 1;
          indegree.set(child, d);
          if (d === 0) nextQueue.push(child);
        }
      }
      if (batch.length > 0) {
        parallelBatches.push(batch);
        order.push(...batch);
      }
      queue.length = 0;
      queue.push(...nextQueue);
    }

    if (order.length !== nodes.length) {
      const cyclic = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
      throw new Error(`ExecutionGraph: dependência cíclica detectada nos nós: ${cyclic.join(', ')}`);
    }

    return { order, parallelBatches };
  }

  /** Busca um nó por id. */
  getNode(graph: ExecutionGraph, id: string): GraphNode | undefined {
    return graph.nodes.find((n) => n.id === id);
  }

  /** Verifica se todos os nós estão concluídos (succeeded/skipped). */
  isComplete(graph: ExecutionGraph): boolean {
    return graph.nodes.every((n) => n.status === 'succeeded' || n.status === 'skipped');
  }

  /** Verifica se algum nó falhou definitivamente. */
  hasHardFailure(graph: ExecutionGraph): boolean {
    return graph.nodes.some((n) => n.status === 'failed' && n.retryPolicy === undefined);
  }

  /** Subgrafo de um node: ele + dependências transitivas (para replan local). */
  subgraphOf(graph: ExecutionGraph, nodeId: string): GraphNode[] {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const result: GraphNode[] = [];
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const node = byId.get(id);
      if (!node) return;
      for (const dep of node.dependencies ?? []) visit(dep);
      result.push(node);
    };
    visit(nodeId);
    return result;
  }
}

/**
 * Helpers de condição simples — avalia expressões booleanas sobre o estado
 * do grafo (ex.: `artifact.architecture.valid == true` → dependências prontas).
 */
export function evaluateCondition(cond: string | undefined, state: Record<string, unknown>): boolean {
  if (!cond) return true;
  try {
    return Boolean(safeEvaluate(cond, state));
  } catch {
    return false;
  }
}
