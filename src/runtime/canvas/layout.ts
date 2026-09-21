/**
 * Canvas Orchestration — auto-layout determinístico.
 *
 * Posiciona nós do IR em camadas derivadas do agendamento real do workflow
 * (batches paralelos do scheduler). Puramente determinístico: o mesmo IR com
 * a mesma direção produz SEMPRE as mesmas coordenadas — nunca há aleatoriedade
 * (o editor visual também depende disso para snapshots estáveis).
 *
 * O usuário continua mandando: o auto-layout é uma aceleração aplicada sob
 * pedido (`izanagi canvas export --layout horizontal`, botão no editor); posições
 * manuais do canvas são preservadas quando não há layout.
 */

import type { WorkflowIR } from './types.js';
import { schedule } from './scheduler.js';

export type LayoutDirection = 'horizontal' | 'vertical' | 'tree' | 'dag';

export interface LayoutOptions {
  /** Largura de referência do nó (px). Default: 260. */
  nodeWidth?: number;
  /** Altura de referência do nó (px). Default: 120. */
  nodeHeight?: number;
  /** Gap entre camadas (px). Default: 160. */
  gapX?: number;
  /** Gap dentro da camada (px). Default: 40. */
  gapY?: number;
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

export interface LayoutResult {
  positions: NodePosition[];
  direction: LayoutDirection;
  /** Nome do algoritmo/layout usado (para o editor exibir). */
  algorithm: string;
}

const DEFAULTS: Required<LayoutOptions> = {
  nodeWidth: 260,
  nodeHeight: 120,
  gapX: 160,
  gapY: 40,
};

/**
 * Calcula posições em camadas (layered layout) a partir do agendamento.
 *
 * - camada = índice do batch paralelo no DAG (topológico);
 * - dentro da camada, nós ordenados por id e centralizados;
 * - `tree` e `dag` usam as mesmas camadas topológicas: a diferença é de
 *   comportamento no editor (tree preserva hierarquia pai→filho ao criar
 *   nós; dag aceita cruzamentos). Para o layout em si, batch = camada;
 * - nós fora do agendamento (órfãos) vão para uma camada final reservada.
 */
export function autoLayout(ir: WorkflowIR, direction: LayoutDirection = 'horizontal', opts: LayoutOptions = {}): LayoutResult {
  const cfg = { ...DEFAULTS, ...opts };
  const sch = schedule(ir);

  // Mapa nó → camada (primeira ocorrência no DAG topológico).
  const rankOf = new Map<string, number>();
  sch.parallelBatches.forEach((batch, rank) => {
    for (const id of batch) {
      if (!rankOf.has(id)) rankOf.set(id, rank);
    }
  });

  const orphanIds = ir.nodes.filter((n) => !rankOf.has(n.id)).map((n) => n.id);
  const maxRank = sch.parallelBatches.length; // camada livre além da última batch

  const positions: NodePosition[] = [];
  const place = (id: string, rank: number, inRank: number, count: number): void => {
    const offset = inRank - (count - 1) / 2;
    if (direction === 'vertical') {
      positions.push({ id, x: offset * cfg.gapY, y: rank * cfg.gapX });
    } else {
      positions.push({ id, x: rank * cfg.gapX, y: offset * cfg.gapY });
    }
  };

  // Órfãos: linha única na última camada (evita colisão com o fluxo principal).
  orphanIds.forEach((id, i) => place(id, maxRank, i, orphanIds.length));

  for (const node of ir.nodes) {
    if (orphanIds.includes(node.id)) continue;
    const rank = rankOf.get(node.id) as number;
    const batch = sch.parallelBatches[rank] as string[];
    place(node.id, rank, batch.indexOf(node.id), batch.length);
  }

  positions.sort((a, b) => a.id.localeCompare(b.id));
  return { positions, direction, algorithm: `layered-${direction}` };
}

/** Aplica posições sobre o IR (retorna novo IR com x/y atualizados). */
export function applyLayout(ir: WorkflowIR, positions: LayoutResult['positions']): WorkflowIR {
  const byId = new Map(positions.map((p) => [p.id, p]));
  return {
    ...ir,
    nodes: ir.nodes.map((n) => {
      const p = byId.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    }),
  };
}