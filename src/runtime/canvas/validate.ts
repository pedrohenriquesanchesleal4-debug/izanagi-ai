/**
 * Canvas Orchestration — validação schema + semântica.
 *
 * Schema: estrutura mínima do JSON Canvas + namespace Izanagi.
 * Semântica: referências a agentes/skills existentes, arestas válidas, nós
 * órfãos/inacessíveis, ciclos sem semântica de loop, configuração de modelo
 * inválida (contra o catálogo do ModelRouter), webhooks inseguros.
 *
 * NUNCA executa: apenas inspeção estática do workflow declarativo.
 */

import type { CanvasDefinition, CanvasEdge, CanvasNode, EdgeConditionType, IzanagiEdgeMetadata, WorkflowIR } from './types.js';
import { CAN_CODES, makeDiagnostic, validateResult, type Diagnostic, type ValidationResult } from './diagnostics.js';
import { isValidCondition } from './condition.js';
import { compileCanvas } from './compiler.js';
import type { ModelRouter } from '../model/router.js';
import type { Stack } from '../types.js';

/** Construtor: injeta conhecimento do runtime (registry de agentes/skills + catálogo de modelos). */
export interface CanvasValidatorDeps {
  /** Registry de agentes do runtime (id → genome). Ids conhecidos quando ausente: vazio. */
  agents?: ReadonlySet<string>;
  /** Registry de skills do runtime (nome → manifesto). */
  skills?: ReadonlySet<string>;
  /** ModelRouter para validar provider/model/reasoning contra o catálogo. */
  router?: ModelRouter;
}

const VALID_NODE_TYPES = new Set(['text', 'file', 'link', 'group']);
const VALID_KINDS = new Set([
  'agent', 'orchestrator', 'evaluator', 'skill', 'model', 'router', 'memory', 'tool',
  'webhook', 'condition', 'parallel', 'merge', 'input', 'output', 'human-review', 'group',
]);
const CONDITION_TYPES: EdgeConditionType[] = ['success', 'failure', 'score', 'output', 'message', 'custom'];
const SAFE_WEBHOOK_HOSTS = /^(https?):\/\/([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/|$)/;

export function validateCanvas(canvas: CanvasDefinition, deps: CanvasValidatorDeps = {}): ValidationResult {
  const diags: Diagnostic[] = [];

  /* ---------- schema estrutural ---------- */
  const seenIds = new Set<string>();
  for (const node of canvas.nodes) {
    if (seenIds.has(node.id)) diags.push(makeDiagnostic('ERROR', CAN_CODES.DUPLICATE_ID, `id duplicado de nó: "${node.id}"`, node.id));
    seenIds.add(node.id);

    if (typeof node.id !== 'string' || !node.id) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_NODE_TYPE, 'nó sem id válido'));
      continue;
    }
    if (!VALID_NODE_TYPES.has(node.type)) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_NODE_TYPE, `nó "${node.id}": tipo "${String(node.type)}" inválido (text|file|link|group)`, node.id));
    }
    if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_NODE_TYPE, `nó "${node.id}": x/y são obrigatórios no JSON Canvas`, node.id));
    }

    const meta = node.izanagi;
    if (!meta || typeof meta !== 'object') continue;
    const kind = meta.kind as string | undefined;
    if (!kind) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_KIND, `nó "${node.id}": "izanagi.kind" ausente — nó sem semântica de execução`, node.id));
      continue;
    }
    if (!VALID_KINDS.has(kind)) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_KIND, `nó "${node.id}": kind "${kind}" desconhecido`, node.id));
      continue;
    }

    // Referências a agentes/skills existentes no runtime
    if ((kind === 'agent' || kind === 'orchestrator' || kind === 'evaluator') && meta.agent) {
      if (deps.agents && !deps.agents.has(meta.agent)) {
        diags.push(makeDiagnostic('ERROR', CAN_CODES.UNKNOWN_AGENT, `nó "${node.id}": agente "${meta.agent}" não existe no registry`, node.id));
      }
    }
    if (meta.skills && meta.skills.length > 0 && deps.skills) {
      for (const s of meta.skills) {
        if (!deps.skills.has(s)) diags.push(makeDiagnostic('ERROR', CAN_CODES.MISSING_SKILL, `nó "${node.id}": skill "${s}" não existe no catálogo`, node.id));
      }
    }
    // Condição de execução do próprio nó
    if (meta.condition && !isValidCondition(meta.condition)) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_CONDITION, `nó "${node.id}": condição inválida "${meta.condition}"`, node.id));
    }
    // Loop exige condição de término ou teto de iterações explícito (teto é obrigatório; condição recomendada)
    if (meta.loop && !meta.loop.maxIterations) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.LOOP_NO_TERMINATION, `nó "${node.id}": loop sem maxIterations — execução poderia ser infinita`, node.id));
    }
    if (meta.loop && meta.loop.maxIterations > 50) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.LOOP_TOO_MANY, `nó "${node.id}": maxIterations ${meta.loop.maxIterations} excede o teto de 50`, node.id));
    }
    if (meta.loop?.terminationCondition && !isValidCondition(meta.loop.terminationCondition)) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_CONDITION, `nó "${node.id}": condição de término do loop inválida`, node.id));
    }
    // Modelo manual: provider+model devem existir no catálogo
    if (meta.model?.mode === 'manual') {
      const m = meta.model;
      if (!m.provider || !m.model) {
        diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_MODEL, `nó "${node.id}": modelo manual exige provider e model`, node.id));
      } else if (deps.router) {
        const specs = deps.router.catalog();
        const found = specs.find((s) => s.id === m.model);
        if (!found) {
          diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_MODEL, `nó "${node.id}": modelo "${m.model}" não existe no catálogo do ModelRouter`, node.id));
        } else if (deps.router.providerOf(m.model) !== m.provider) {
          diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_MODEL, `nó "${node.id}": "${m.model}" pertence ao provider "${deps.router.providerOf(m.model)}", não "${m.provider}"`, node.id));
        } else if (m.reasoning?.effort) {
          const rank = { low: 0, medium: 1, high: 2 } as const;
          if (rank[m.reasoning.effort] > rank[found.reasoning]) {
            diags.push(makeDiagnostic('WARNING', CAN_CODES.UNSUPPORTED_REASONING, `nó "${node.id}": modelo "${m.model}" suporta raciocínio "${found.reasoning}", pedido "${m.reasoning.effort}" — será degradado em execução`, node.id));
          }
        }
      }
    }
  }

  /* ---------- arestas ---------- */
  const nodeIds = new Set(canvas.nodes.map((n) => n.id));
  const usedFrom = new Set<string>();
  for (const edge of canvas.edges) {
    if (typeof edge.id !== 'string' || !edge.id) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.EDGE_UNKNOWN_NODE, 'aresta sem id válido'));
      continue;
    }
    if (!nodeIds.has(edge.fromNode)) diags.push(makeDiagnostic('ERROR', CAN_CODES.EDGE_UNKNOWN_NODE, `aresta "${edge.id}": fromNode "${edge.fromNode}" não existe`, edge.id));
    if (!nodeIds.has(edge.toNode)) diags.push(makeDiagnostic('ERROR', CAN_CODES.EDGE_UNKNOWN_NODE, `aresta "${edge.id}": toNode "${edge.toNode}" não existe`, edge.id));
    if (edge.fromNode === edge.toNode) {
      const selfNode = canvas.nodes.find((n) => n.id === edge.fromNode);
      if (!selfNode?.izanagi?.loop) {
        diags.push(makeDiagnostic('ERROR', CAN_CODES.CYCLE_NO_LOOP, `aresta "${edge.id}": auto-aresta exige loop declarado no nó "${edge.fromNode}"`, edge.id));
      }
    }
    usedFrom.add(edge.fromNode);
    const em = edge.izanagi;
    validateEdgeMeta(em, edge.id, diags);
  }

  /* ---------- semântica de grafo ---------- */
  const compiled = compileCanvas(canvas);
  if (compiled) {
    // Órfãos: sem entrada (sem aresta chegando) e não é nó de entrada (input/orchestrator raiz)
    const hasIncoming = new Set(canvas.edges.map((e) => e.toNode));
    for (const n of canvas.nodes) {
      const kind = n.izanagi?.kind;
      const isEntryLike = kind === 'input' || kind === 'orchestrator';
      if (!hasIncoming.has(n.id) && !isEntryLike && kind !== 'group') {
        diags.push(makeDiagnostic('WARNING', CAN_CODES.ORPHAN_NODE, `nó "${n.id}" não tem aresta chegando e não é nó de entrada`, n.id));
      }
    }
    // Ciclos sem semântica de loop → ERROR (grafos de execução devem ser DAG + loops explícitos)
    for (const cycle of findCycles(nodeIds, canvas.edges)) {
      const hasLoopNode = canvas.nodes.some((n) => cycle.includes(n.id) && n.izanagi?.loop);
      if (!hasLoopNode) {
        diags.push(makeDiagnostic('ERROR', CAN_CODES.CYCLE_NO_LOOP, `ciclo detectado (${cycle.join(' → ')}) sem nó com semântica de loop — workflows são DAG + loops explícitos`, cycle[0]));
      }
    }
    // Webhooks: URL segura e só http(s)
    for (const n of canvas.nodes) {
      if (n.izanagi?.kind === 'webhook') {
        const url = n.izanagi.url ?? n.url;
        if (!url || !SAFE_WEBHOOK_HOSTS.test(String(url))) {
          diags.push(makeDiagnostic('ERROR', CAN_CODES.WEBHOOK_UNSAFE, `nó "${n.id}": webhook com URL não-http(s) ou malformada`, n.id));
        }
      }
    }
  }

  return validateResult(diags);
}

function validateEdgeMeta(em: IzanagiEdgeMetadata | undefined, edgeId: string, diags: Diagnostic[]): void {
  if (!em || typeof em !== 'object') return;
  const cond = em.condition;
  if (cond) {
    if (!CONDITION_TYPES.includes(cond.type)) {
      diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_CONDITION, `aresta "${edgeId}": tipo de condição "${String((cond.type as string) ?? '')}" inválido`, edgeId));
    }
    if (cond.type === 'custom' || cond.type === 'score' || cond.type === 'output' || cond.type === 'message') {
      if (cond.expression && !isValidCondition(cond.expression)) {
        diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_CONDITION, `aresta "${edgeId}": expressão inválida "${cond.expression}"`, edgeId));
      }
      if (cond.type === 'score' && cond.threshold === undefined && !cond.expression) {
        diags.push(makeDiagnostic('ERROR', CAN_CODES.INVALID_CONDITION, `aresta "${edgeId}": condição score exige threshold ou expression`, edgeId));
      }
    }
  }
}

/** Detecta ciclos simples no grafo (DFS com estados). */
export function findCycles(nodeIds: Set<string>, edges: Array<{ fromNode: string; toNode: string }>): string[][] {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.fromNode)?.push(e.toNode);
  }
  const cycles: string[][] = [];
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const inStack = new Set<string>();

  const dfs = (node: string): void => {
    state.set(node, 1);
    stack.push(node);
    inStack.add(node);
    for (const next of adj.get(node) ?? []) {
      const st = state.get(next);
      if (st === 1) {
        // ciclo: do índice de `next` no stack até o topo
        const idx = stack.indexOf(next);
        if (idx >= 0) cycles.push([...stack.slice(idx), next]);
      } else if (st === undefined) {
        dfs(next);
      }
    }
    stack.pop();
    inStack.delete(node);
    state.set(node, 2);
  };

  for (const id of nodeIds) {
    if (state.get(id) === undefined) dfs(id);
  }
  return cycles;
}