/**
 * Sub-orquestração: uma tarefa que descobre, executando, que é maior do que o
 * planejamento previu.
 *
 * O Commander decompõe ANTES de executar, e para a maioria dos objetivos isso
 * basta. O caso que ele não cobre é o da tarefa cuja decomposição depende de
 * algo que só se sabe depois de olhar: "auditar a segurança deste sistema" só
 * revela quantas frentes existem quando o sistema é examinado.
 *
 * A resposta aqui NÃO é deixar agentes se decomporem à vontade — isso é a
 * colmeia que a arquitetura proíbe, com custo exponencial. É um pedido
 * explícito, validado, com teto de profundidade, teto de largura e orçamento
 * herdado do nó pai. Um nó que pede decomposição não ganha orçamento novo:
 * ele divide o que já tinha.
 */

import type { ExecutionGraph, GraphNode } from '../types.js';
import { ExecutionGraphBuilder } from './graph.js';
import { attachContract, contractOf, type TaskContract } from '../contracts/task-contract.js';
import { extractJsonObject } from '../protocol/messages.js';
import { validateDecomposition, type DecomposedTask } from './commander.js';

/** Profundidade máxima de sub-orquestração. 0 = o grafo do run. */
export const DEFAULT_MAX_ORCHESTRATION_DEPTH = 2;
/** Sub-tarefas por decomposição. Mais que isto não é decompor, é replanejar. */
export const MAX_SUBTASKS = 5;

export interface DecompositionRequest {
  /** Por que a tarefa não cabe numa entrega só. Entra no trace. */
  reason: string;
  tasks: DecomposedTask[];
}

/**
 * Extrai um pedido de decomposição da saída de um nó. Nunca lança: saída sem
 * pedido devolve `null`, e o nó segue como entrega normal.
 *
 * Tolerante ao embrulho (prosa, cerca de código) pelo mesmo motivo da crítica:
 * o formato é pedido no prompt, mas o parsing não pode depender de obediência.
 */
export function parseDecomposition(content: unknown): DecompositionRequest | null {
  const text = typeof content === 'string' ? content : JSON.stringify(content ?? {});
  const json = extractJsonObject(text);
  if (!json) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
  const list = raw.decompose;
  if (!Array.isArray(list) || list.length === 0) return null;

  const tasks: DecomposedTask[] = list
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .slice(0, MAX_SUBTASKS)
    .map((t, i) => ({
      id: String(t.id ?? `sub-${i + 1}`).trim(),
      objective: String(t.objective ?? '').trim(),
      ...(typeof t.agent === 'string' ? { agent: t.agent } : {}),
      ...(typeof t.outputKind === 'string' ? { outputKind: t.outputKind } : {}),
      ...(Array.isArray(t.dependencies) ? { dependencies: (t.dependencies as unknown[]).map(String) } : {}),
    }));

  if (tasks.length === 0) return null;
  return { reason: String(raw.reason ?? '').trim() || 'tarefa maior do que o planejamento previu', tasks };
}

export interface SubgraphBuild {
  graph: ExecutionGraph;
  /** Ids das sub-tarefas, na ordem em que entram no grafo. */
  taskIds: string[];
  /** Problemas que impediram a construção. Vazio = subgrafo utilizável. */
  issues: string[];
}

/**
 * Constrói o subgrafo de um nó pai.
 *
 * Regras que não são negociáveis aqui, porque cada uma delas é a diferença
 * entre sub-orquestração e explosão combinatória:
 *
 *  - ids das sub-tarefas são PREFIXADOS pelo nó pai, então não colidem com o
 *    grafo de cima nem com o subgrafo de um irmão;
 *  - o orçamento de tokens do pai é DIVIDIDO entre as sub-tarefas, nunca
 *    multiplicado: decompor não é motivo para gastar mais;
 *  - o contrato de cada sub-tarefa herda restrições e política de verificação
 *    do pai, então o filho não afrouxa o que o pai prometeu;
 *  - sub-tarefa não é decomponível: a profundidade seguinte se resolve pelo
 *    teto, não pela boa vontade do agente.
 */
export function buildSubgraph(
  parent: GraphNode,
  request: DecompositionRequest,
  opts: { depth: number; maxDepth: number },
): SubgraphBuild {
  const issues: string[] = [];
  if (opts.depth >= opts.maxDepth) {
    return {
      graph: emptyGraph(parent),
      taskIds: [],
      issues: [`profundidade máxima de orquestração (${opts.maxDepth}) atingida no nó "${parent.id}": a tarefa precisa ser entregue, não decomposta de novo`],
    };
  }

  const structural = validateDecomposition(request.tasks);
  if (structural.length > 0) {
    return { graph: emptyGraph(parent), taskIds: [], issues: structural };
  }

  const parentContract = contractOf(parent);
  const prefix = `${parent.id}/`;
  const localIds = new Set(request.tasks.map((t) => t.id));
  // Orçamento dividido, com piso: uma sub-tarefa com 40 tokens não produz nada
  // e só gasta a chamada.
  const share = Math.max(512, Math.floor((parent.tokenBudget ?? 4000) / request.tasks.length));

  const nodes: GraphNode[] = request.tasks.map((t) => {
    const id = `${prefix}${t.id}`;
    const kind = t.outputKind ?? parent.outputs?.[0] ?? 'raw';
    const dependencies = (t.dependencies ?? []).filter((d) => localIds.has(d)).map((d) => `${prefix}${d}`);
    const node: GraphNode = {
      id,
      kind: 'agent',
      agent: t.agent ?? parent.agent ?? 'senior-engineer',
      ...(parent.skills ? { skills: parent.skills } : {}),
      outputs: [kind],
      dependencies,
      status: 'pending',
      tokenBudget: share,
      ...(parent.timeoutMs ? { timeoutMs: parent.timeoutMs } : {}),
      retryPolicy: { maxAttempts: 2, backoffMs: 0, retryOnValidation: true },
      metadata: { subgraphOf: parent.id, depth: opts.depth + 1 },
    };
    if (!parentContract) return node;
    const contract: TaskContract = {
      ...parentContract,
      id,
      objective: t.objective,
      agent: node.agent!,
      inputs: dependencies,
      dependencies,
      expectedOutput: { ...parentContract.expectedOutput, kind },
      budget: { ...parentContract.budget, maxTokens: share },
      // Critérios de aceite do pai referenciam o id do pai; reescrevê-los para
      // o filho manteria a exigência sem quebrar a rastreabilidade.
      acceptance: parentContract.acceptance.map((c) => ({ ...c, id: c.id.replace(parentContract.id, id) })),
      // Sub-tarefa não decompõe: a profundidade se resolve por teto, não por
      // boa vontade do agente.
      decomposable: false,
      // Herda `tool`? Não: o pai pediu decomposição em vez de executar a tool.
      ...(parentContract.tool ? { tool: undefined } : {}),
    };
    return attachContract(node, contract);
  });

  const graph = new ExecutionGraphBuilder().build({
    id: `${parent.id}-subgraph`,
    task: request.reason,
    nodes,
    budget: {
      maxAttempts: 2,
      maxTokens: parent.tokenBudget ?? 4000,
      maxTimeMs: parent.timeoutMs ?? 300_000,
    },
  });

  return { graph, taskIds: nodes.map((n) => n.id), issues };
}

/**
 * Agrega os artefatos das sub-tarefas no artefato do nó pai.
 *
 * Concatenação rotulada, não síntese: sintetizar exigiria outra chamada de
 * modelo, e o pai já gastou a dele pedindo a decomposição. Quem quiser síntese
 * declara um nó de agregação no plano.
 */
export function aggregateSubgraph(
  parentId: string,
  taskIds: string[],
  artifacts: Map<string, { kind: string; content: unknown; valid: boolean }>,
): { content: string; produced: number; missing: string[] } {
  const missing: string[] = [];
  const blocks: string[] = [];
  for (const id of taskIds) {
    const artifact = artifacts.get(id);
    if (!artifact) {
      missing.push(id);
      continue;
    }
    const text = typeof artifact.content === 'string' ? artifact.content : JSON.stringify(artifact.content, null, 2);
    blocks.push(`## ${id.slice(parentId.length + 1)} (${artifact.kind}${artifact.valid ? '' : ', INVÁLIDO'})\n${text}`);
  }
  const header = `# ${parentId}: entrega composta por ${blocks.length} sub-tarefa(s)`;
  const aviso = missing.length > 0 ? `\n\nSub-tarefas sem artefato: ${missing.join(', ')}.` : '';
  return { content: `${header}\n\n${blocks.join('\n\n')}${aviso}`, produced: blocks.length, missing };
}

function emptyGraph(parent: GraphNode): ExecutionGraph {
  return new ExecutionGraphBuilder().build({
    id: `${parent.id}-subgraph-vazio`,
    task: parent.id,
    nodes: [],
    budget: { maxAttempts: 1, maxTokens: 0, maxTimeMs: 1000 },
  });
}
