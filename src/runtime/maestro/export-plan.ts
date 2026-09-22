/**
 * `Commander ExecutionGraph` -> Auto Run docs do RunMaestro.
 *
 * Regras (spec `docs/MAESTRO-BRIDGE.md` §3.1):
 * 1. `kind: 'tool'` (survey, materialize, deliver, verify-tests, qualquer outro)
 *    NUNCA vira task: o Maestro roda direto no repo real com o agente, e esses
 *    nós são overhead do runtime Izanagi.
 * 2. `kind: 'gate'` idem: validação é responsabilidade do agente Maestro +
 *    markers HITL.
 * 3. `kind: 'approval'` vira task com marker `MAESTRO:HITL` (reason do
 *    `metadata.reason`, senão default).
 * 4. os demais kinds de execução (agent/skill/validator/evaluator/aggregator/
 *    parallel) viram checkbox `- [ ] <descrição>`.
 * 5. uma doc por parallelBatch, na ordem do grafo (posição no array = fase).
 * 6. marker `MAESTRO:MODEL` por task com tier mapeado do hint do modelo
 *    (premium->high, balanced->medium, fast->low).
 * 8. saída em `<out>/<slug>/` com `01-<fase>.md`, `02-<fase>.md`, ...
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionGraph, GraphNode } from '../types.js';
import { ModelRouter } from '../model/router.js';
import { slugify } from '../orchestration/delivery.js';
import type { MaestroDoc, MaestroExport, MaestroTask } from './types.js';

export interface ExportOptions {
  /**
   * Diretório raiz de saída. A doc cai em `<out>/<slug>/`. Default:
   * `./.maestro/playbooks` (resolvido contra o cwd do processo).
   */
  out?: string;
  /** Rodapé opcional (ex.: comando/modo que gerou o plano). */
  footer?: string;
}

/** Kinds que são overhead do runtime Izanagi e NUNCA viram task. */
const SKIPPED_KINDS: ReadonlySet<GraphNode['kind']> = new Set(['tool', 'gate']);

/** Kinds de execução que viram checkbox Auto Run. */
const TASK_KINDS: ReadonlySet<GraphNode['kind']> = new Set([
  'agent',
  'skill',
  'validator',
  'evaluator',
  'aggregator',
  'parallel',
]);

/**
 * Mapa local de hint -> tier Maestro, usado ANTES do `ModelRouter`: hints
 * conhecidos não dependem do estado do roteador. O que escapa do mapa cai no
 * `tierForHint` (que entende `premium/balanced/fast` e variações). Unknown
 * permanece unknown: nenhum marker é emitido para tier não resolvido.
 */
const LOCAL_HINT_TIERS: Record<string, 'low' | 'medium' | 'high'> = {
  opus: 'high',
  'opus-4-5': 'high',
  'claude-opus-5': 'high',
  premium: 'high',
  strong: 'high',
  sonnet: 'medium',
  'sonnet-4-5': 'medium',
  'claude-sonnet-5': 'medium',
  balanced: 'medium',
  medium: 'medium',
  haiku: 'low',
  'haiku-4-5': 'low',
  'claude-haiku-4-5': 'low',
  fast: 'low',
  cheap: 'low',
  weak: 'low',
};

/** Mapeia o hint de modelo do nó para o tier Maestro (`low|medium|high`). */
export function tierFromModelHint(hint: string | undefined): 'low' | 'medium' | 'high' | undefined {
  if (!hint) return undefined;
  const h = hint.trim().toLowerCase();
  const local = LOCAL_HINT_TIERS[h];
  if (local) return local;
  const tier = ModelRouter.tierForHint(h);
  if (tier === 'premium') return 'high';
  if (tier === 'balanced') return 'medium';
  if (tier === 'fast') return 'low';
  return undefined;
}

/** Lê uma string de `metadata` (Record<string, unknown>) sem lançar. */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** Limpa atributo HTML/markdown de caracteres que quebrariam o marker. */
function cleanAttr(value: string): string {
  return value.replace(/["<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Papel inferido do kind, usado como `reason` do marker MAESTRO:MODEL. */
function inferRole(node: GraphNode): string {
  if (node.agent) return node.agent;
  switch (node.kind) {
    case 'validator':
      return 'validator';
    case 'evaluator':
      return 'evaluator';
    case 'aggregator':
    case 'parallel':
      return 'aggregator';
    case 'skill':
      return 'skill';
    default:
      return 'agent';
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove o prefixo do objective gerado pelo Commander (`<id> (<agent>): `),
 * deixando o texto útil da task. Não casa, devolve o texto original.
 */
function stripContractPrefix(id: string, objective: string): string {
  const prefix = new RegExp(`^${escapeRegExp(id)}\\s*(?:\\([^)]*\\))?:\\s*`);
  const cleaned = objective.replace(prefix, '').trim();
  return cleaned.length > 0 ? cleaned : objective;
}

/**
 * Melhor descrição disponível da task: `metadata.description` (declarada) >
 * `metadata.contract.objective` (texto real do Commander, sem o prefixo
 * `<id> (<agente>): `) > `node.id` (último recurso). O spec pede "melhor campo
 * disponível": cair direto no `node.id` quando o contrato tem objetivo real
 * produziria docs com checkboxes "execute", "verify" e nenhuma instrução.
 */
function taskDescription(node: GraphNode): string {
  const declared = asString(node.metadata?.description);
  if (declared) return declared;
  const contract = node.metadata?.contract;
  if (contract && typeof contract === 'object' && !Array.isArray(contract)) {
    const objective = asString((contract as Record<string, unknown>).objective);
    if (objective) return stripContractPrefix(node.id, objective);
  }
  return node.id;
}

/** Constrói a task Auto Run de um nó do grafo. */
function taskFor(node: GraphNode): MaestroTask {
  if (node.kind === 'approval') {
    const reason = cleanAttr(asString(node.metadata?.reason) ?? 'aprovação humana');
    const artifact = asString(node.metadata?.artifact);
    return {
      text: reason,
      done: false,
      ...(artifact ? { hitl: { reason, artifact: cleanAttr(artifact) } } : { hitl: { reason } }),
    };
  }
  const description = taskDescription(node);
  const hint = node.model ?? asString(node.metadata?.modelHint);
  const tier = tierFromModelHint(hint);
  return {
    text: description,
    done: false,
    ...(tier ? { model: { tier, reason: cleanAttr(inferRole(node)) } } : {}),
  };
}

/** Nome da fase: `Fase N` com o agente quando TODOS os nós usam o mesmo. */
function phaseNameFor(batch: string[], byId: Map<string, GraphNode>, index: number): string {
  const agents = new Set<string>();
  for (const id of batch) {
    const node = byId.get(id);
    if (!node) continue;
    if (node.agent) agents.add(node.agent);
  }
  if (agents.size === 1) return `Fase ${index}: ${[...agents][0]!}`;
  return `Fase ${index}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function buildContent(doc: MaestroDoc, context: string, taskCountNote: string, footer?: string): string {
  const lines: string[] = [];
  lines.push(doc.title);
  lines.push('');
  lines.push(context);
  lines.push('');
  lines.push(taskCountNote);
  lines.push('');
  for (const task of doc.tasks) {
    if (task.model) {
      lines.push(`<!-- MAESTRO:MODEL tier="${task.model.tier}" reason="${task.model.reason}" -->`);
    }
    if (task.hitl) {
      const artifact = task.hitl.artifact ? ` artifact="${task.hitl.artifact}"` : '';
      lines.push(`<!-- MAESTRO:HITL reason="${task.hitl.reason}"${artifact} -->`);
    }
    lines.push(`${task.done ? '- [x]' : '- [ ]'} ${task.text}`);
    lines.push('');
  }
  if (footer) {
    lines.push(`> ${footer}`);
  }
  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Converte um grafo do Commander em docs Auto Run, gravando as docs em
 * `<out>/<slug>/`. Nós tool/gate são pulados e reportados; approval vira HITL.
 */
export function exportGraphToDocs(graph: ExecutionGraph, opts: ExportOptions = {}): MaestroExport {
  const slug = slugify(graph.task);
  const skipped: string[] = [];
  const docs: MaestroDoc[] = [];
  let taskCount = 0;
  let hitlCount = 0;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const orderIdx = new Map(graph.order.map((id, i) => [id, i]));
  const batches = graph.parallelBatches.length > 0 ? graph.parallelBatches : [graph.nodes.map((n) => n.id)];

  let phaseIndex = 0;
  for (const batch of batches) {
    const ordered = [...batch].sort((a, b) => (orderIdx.get(a) ?? 0) - (orderIdx.get(b) ?? 0));
    const tasks: MaestroTask[] = [];
    let hitlInBatch = 0;
    for (const id of ordered) {
      const node = byId.get(id);
      if (!node) continue;
      if (SKIPPED_KINDS.has(node.kind)) {
        skipped.push(node.id);
        continue;
      }
      if (node.kind === 'approval') {
        hitlInBatch += 1;
        tasks.push(taskFor(node));
        continue;
      }
      if (TASK_KINDS.has(node.kind)) {
        tasks.push(taskFor(node));
        continue;
      }
      // Kind futuro desconhecido: não fabricar task para o que não entendemos.
      skipped.push(node.id);
    }
    if (tasks.length === 0) continue;

    phaseIndex += 1;
    const phase = phaseNameFor(batch, byId, phaseIndex);
    const filename = `${String(phaseIndex).padStart(2, '0')}-${slugify(phase)}.md`;
    const context = `Objetivo: ${truncate(graph.task, 140)}`;
    const note =
      `Fase ${phaseIndex} de ${batches.length}: ${tasks.length} task(s). O Maestro executa ` +
      'as checkboxes de cima para baixo; tasks marcadas - [x] já estão concluídas. ' +
      'Markers MAESTRO:MODEL (dica de modelo por task) e MAESTRO:HITL (aprovação humana) orientam a execução.';
    const doc: MaestroDoc = {
      phase,
      filename,
      title: `# ${slug} - ${phase}`,
      context,
      tasks,
      content: '',
    };
    doc.content = buildContent(doc, context, note, opts.footer);
    docs.push(doc);
    taskCount += tasks.length;
    hitlCount += hitlInBatch;
  }

  if (docs.length === 0) {
    return { slug, dir: '', docs, skipped, taskCount, hitlCount };
  }

  const out = opts.out ?? path.join('.maestro', 'playbooks');
  const dir = path.join(out, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const doc of docs) {
    fs.writeFileSync(path.join(dir, doc.filename), doc.content, 'utf8');
  }
  return { slug, dir, docs, skipped, taskCount, hitlCount };
}