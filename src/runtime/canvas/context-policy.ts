/**
 * Canvas Orchestration — políticas de contexto por nó.
 *
 * Cada nó recebe SÓ o contexto que a política dele permite — nunca o estado
 * do run inteiro (evita crescimento de contexto descontrolado).
 *
 * Modos:
 *   full          → todo o estado (input + artefatos + variáveis + mensagens)
 *   selective     → somente caminhos em `include` (entradas por path)
 *   summary       → todo o estado, com entradas grandes resumidas (cauda)
 *   artifact      → somente artefatos (por path de `include` ou todos)
 *   message-only  → somente mensagens recebidas pelo o nó
 *
 * Caminhos: `input`, `architect.result`, `state.variables.x`, `msg.<idx>`…
 * A resolução usa acesso de propriedade simples (mesma disciplina do
 * evaluator de condições: sem chamadas, sem indexação dinâmica).
 */

import type { NodeContextPolicy, WorkflowState } from './types.js';

export interface RoutedContext {
  /** Contexto efetivo para o nó. */
  content: unknown;
  /** Fontes que alimentaram o contexto (rastreabilidade). */
  sources: string[];
  /** `true` quando o contexto foi truncado/resumido. */
  truncated: boolean;
}

function getByPath(root: unknown, segments: string[]): unknown {
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** Resolve caminho no formato "architect.result" contra os compartimentos do estado. */
export function resolveStatePath(state: WorkflowState, path: string): unknown {
  const segments = path.split('.');
  const head = segments[0]!;
  const tail = segments.slice(1);
  if (head === 'input') return getByPath(state.input, tail);
  if (head === 'state' || head === 'workflow') {
    const map: Record<string, unknown> = { variables: state.variables, runId: state.runId, status: state.status };
    return getByPath(map, tail);
  }
  if (head === 'msg' || head === 'messages') return getByPath(state.messages, tail);
  if (head === 'result' || head === 'node') return getByPath(state.nodeResults, tail);
  // compartimento de artefatos
  return getByPath(state.artifacts, segments);
}

/** Monta o contexto conforme a política. */
export function buildContext(state: WorkflowState, policy: NodeContextPolicy | undefined, nodeId: string): RoutedContext {
  const p = policy ?? { mode: 'full' as const };
  const sources: string[] = [];
  let truncated = false;

  const exclude = new Set(p.exclude ?? []);
  const isExcluded = (path: string): boolean => exclude.has(path);

  const summarize = (value: unknown): unknown => {
    if (p.mode !== 'summary') return value;
    if (typeof value === 'string' && p.summarizeAbove && value.length > p.summarizeAbove) {
      truncated = true;
      return `${value.slice(0, p.summarizeAbove)}\n…[resumido: ${value.length} chars]`;
    }
    if (typeof value === 'object' && value !== null) {
      const json = JSON.stringify(value);
      if (p.summarizeAbove && json && json.length > p.summarizeAbove) {
        truncated = true;
        return JSON.parse(json.slice(0, p.summarizeAbove)) as unknown;
      }
    }
    return value;
  };

  switch (p.mode) {
    case 'message-only': {
      const msgs = state.messages.filter((m) => m.to === nodeId || (Array.isArray(m.to) && m.to.includes(nodeId)));
      sources.push('messages');
      return { content: msgs.map((m) => ({ from: m.from, type: m.type, payload: summarize(m.payload) })), sources, truncated };
    }
    case 'artifact': {
      const entries = Object.entries(state.artifacts).filter(([k]) => !isExcluded(k));
      sources.push(...entries.map(([k]) => `artifact.${k}`));
      return { content: Object.fromEntries(entries.map(([k, v]) => [k, summarize(v)])), sources, truncated };
    }
    case 'selective': {
      const content: Record<string, unknown> = {};
      for (const inc of p.include ?? []) {
        if (isExcluded(inc)) continue;
        const value = resolveStatePath(state, inc);
        if (value !== undefined) {
          content[inc] = summarize(value);
          sources.push(inc);
        }
      }
      return { content, sources, truncated };
    }
    case 'summary': {
      const content = {
        input: summarize(state.input),
        artifacts: summarize(state.artifacts),
        variables: summarize(state.variables),
      };
      sources.push('input', 'artifacts', 'variables');
      return { content, sources, truncated };
    }
    case 'full':
    default: {
      const content = summarize(state);
      sources.push('state');
      return { content, sources, truncated };
    }
  }
}

/** Compacta o estado em um "envelope" serializável para o trace (sem payloads gigantes). */
export function stateSnapshot(state: WorkflowState): Record<string, unknown> {
  return {
    runId: state.runId,
    status: state.status,
    metrics: state.metrics,
    nodeCount: Object.keys(state.nodeResults).length,
    messageCount: state.messages.length,
    artifactKeys: Object.keys(state.artifacts),
  };
}