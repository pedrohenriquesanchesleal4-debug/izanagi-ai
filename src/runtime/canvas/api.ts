/**
 * Canvas Orchestration — API programática.
 *
 * Frente pública do subsistema: carregar/workflow .canvas como objeto,
 * validar, compilar, inspecionar, salvar, e EXECUTAR contra o runtime real
 * (nunca contra uma simulação de canvas). Esta é a camada que o CLI
 * (`izanagi canvas ...`), o SDK (`izanagi.orchestrate`) e o editor visual
 * consomem — o executável e o visual devem produzir EXATAMENTE o mesmo
 * comportamento: a fonte da verdade é o Orchestrator, não esta API.
 */

import { promises as fs, existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import type { OrchestrationResult, OrchestratorOptions } from '../orchestrator.js';
import type { CommanderPlan } from '../orchestration/commander.js';
import type { EvaluationReport } from '../types.js';
import { ModelRouter } from '../model/router.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import {
  parseCanvas,
  parseCanvasFromFile,
  type ParsedCanvas,
} from './parser.js';
import {
  validateCanvas,
  type CanvasValidatorDeps,
} from './validate.js';
import type { Diagnostic, ValidationResult } from './diagnostics.js';
import { compileCanvas } from './compiler.js';
import {
  executeCanvasWorkflow,
  buildCanvasPlan,
  type CanvasExecutorDeps,
  type CanvasProduce,
} from './executor.js';
import {
  WorkflowEventBus,
  makeWorkflowLifecycle,
  makeModelResolved,
  type WorkflowEvent,
} from './workflow-events.js';
import type { CanvasDefinition, CanvasNodeResult, WorkflowIR, WorkflowState, WorkflowStatus, AgentMessage } from './types.js';

/** Erro fatal de execução de canvas (validação reprovada ou IR insolvente). */
export class CanvasExecutionError extends Error {
  constructor(
    message: string,
    readonly diagnostics?: ValidationResult,
  ) {
    super(message);
    this.name = 'CanvasExecutionError';
  }
}

export interface CanvasInspection {
  name: string;
  nodeCount: number;
  edgeCount: number;
  entryNodes: string[];
  exitNodes: string[];
  capabilities: WorkflowIR['capabilities'];
  nodes: WorkflowIR['nodes'];
  hasErrors: boolean;
}

export interface ExecuteWorkflowOptions {
  /** Entrada declarada do workflow (preenchida no estado compartilhado). */
  input?: unknown;
  /** Task texto (título do run). Fallback: nome do workflow. */
  task?: string;
  /** Raiz do framework do projeto (onde vivem agents/skills/catálogo). Default: cwd. */
  baseDir?: string;
  workspaceDir?: string;
  stateDir?: string;
  /** Orçamento de tokens do run (passa ao budget do grafo). */
  budget?: number;
  /** Tempo máximo por nó (ms) — via contrato do nó. */
  timeoutMs?: number;
  /** Planeja sem executar: compila, agenda, resolve modelos e devolve o plano. */
  dryRun?: boolean;
  verbose?: boolean;
  signal?: AbortSignal;
  allowedTools?: string[];
  availableProviders?: string[];
  /** Producer do canvas (recebe estado controlado + ponte do ExecuteCtx do run). Ausente: headless. */
  produce?: CanvasProduce;
  consume?: OrchestratorOptions['consume'];
  /** Eventos do runtime do Orchestrator (run.started/node.started/...). */
  onEvent?: OrchestratorOptions['onEvent'];
  /** Eventos de workflow do canvas (protocolo estável para editor/SSE). */
  onWorkflowEvent?: (event: WorkflowEvent) => void;
  /** Executa a partir deste nó (inclui todos os alcançáveis a jusante). */
  fromNode?: string;
  /** Executa até este nó (inclui todos os que chegam nele). */
  untilNode?: string;
}

export interface WorkflowRunResult {
  runId: string;
  /** Veredito do Orchestrator (PASS/FAIL/BLOCKED/HUMAN_REQUIRED/UNKNOWN) ou DRY_RUN/SKIPPED. */
  status: OrchestrationResult['status'] | 'DRY_RUN' | 'CANCELLED';
  score: number;
  workflowStatus: WorkflowStatus;
  nodes: Array<{
    id: string;
    status: CanvasNodeResult['status'];
    latencyMs?: number;
    tokensUse?: CanvasNodeResult['tokensUse'];
    error?: string;
    attempts?: number;
    output?: unknown;
  }>;
  messages: AgentMessage[];
  metrics: WorkflowState['metrics'];
  modelByNode: Record<string, { model: string; provider: string; source: 'auto' | 'manual' | 'inherit' }>;
  plan?: CommanderPlan;
  traceFile: string;
  headless: boolean;
  dryRun: boolean;
  /** Timeline completa de eventos do run — replay possível no editor via SSP/SDK. */
  events: WorkflowEvent[];
  evaluation?: EvaluationReport;
  state: {
    input: unknown;
    artifacts: Record<string, unknown>;
    variables: Record<string, unknown>;
    nodeResults: Record<string, CanvasNodeResult>;
    memoryRefs: string[];
  };
}

/* ============================ WORKFLOW (CARGA/SAVE) ============================ */

export class CanvasWorkflow {
  private constructor(
    readonly name: string,
    private readonly def: CanvasDefinition,
  ) {}

  /** Carrega de um arquivo `.canvas`/`.json` (caminho relativo resolvido contra cwd). */
  static async load(source: string, baseDir?: string): Promise<CanvasWorkflow> {
    const file = path.isAbsolute(source) ? source : path.resolve(baseDir ?? process.cwd(), source);
    const raw = await fs.readFile(file, 'utf-8');
    const { name, canvas } = parseCanvasFromFile(file, raw);
    return new CanvasWorkflow(name, stripDiagnostics(canvas));
  }

  /** Cria a partir de um JSON (string ou objeto) — usado pelo editor visual. */
  static fromJson(json: string | CanvasDefinition, name = 'workflow'): CanvasWorkflow {
    const parsed = typeof json === 'string' ? parseCanvas(json) : (json as ParsedCanvas);
    return new CanvasWorkflow(name, stripDiagnostics(parsed));
  }

  /** Scaffold mínimo: input → agente → output. Útil para começar a editar. */
  static createTemplate(name: string, opts: { agent?: string; label?: string } = {}): CanvasWorkflow {
    const agent = opts.agent ?? 'senior-engineer';
    const label = opts.label ?? 'Desenvolvimento da feature';
    const now = Date.now();
    const nodes = [
      { id: 'in', type: 'text' as const, x: 0, y: 0, text: 'Entrada do workflow', izanagi: { kind: 'input' as const } },
      { id: 'dev', type: 'text' as const, x: 320, y: 0, text: label, izanagi: { kind: 'agent' as const, agent, skills: ['agentic-coding'] } },
      { id: 'out', type: 'text' as const, x: 640, y: 0, text: 'Saída entregue', izanagi: { kind: 'output' as const } },
    ];
    const edges = [
      { id: `e1-${now}`, fromNode: 'in', toNode: 'dev', fromSide: 'right', toSide: 'left', endArrow: 'arrow' as const, izanagi: { messageType: 'task' as const } },
      { id: `e2-${now}`, fromNode: 'dev', toNode: 'out', fromSide: 'right', toSide: 'left', endArrow: 'arrow' as const, izanagi: { messageType: 'result' as const } },
    ];
    return new CanvasWorkflow(name, {
      nodes,
      edges,
      id: `izanagi:${name}`,
      name,
      description: 'Workflow declarativo JSON Canvas 1.0 com namespace izanagi (control plane)',
      createdAt: new Date().toISOString(),
    });
  }

  /** Lista workflows `.canvas` de um diretório (default `canvases/`). */
  static async list(dir = 'canvases'): Promise<string[]> {
    if (!existsSync(dir)) return [];
    const entries = await fs.readdir(dir);
    return entries
      .filter((e) => e.endsWith('.canvas') || e.endsWith('.json'))
      .sort();
  }

  /** Cópia defensiva da definição (mutações externas não vazam para o estado interno). */
  get definition(): Readonly<CanvasDefinition> {
    return structuredClone(this.def);
  }

  /** Valida contra schema + semântica (registry de agentes/skills + catálogo de modelos). */
  validate(baseDir?: string, deps?: CanvasValidatorDeps): ValidationResult {
    const loaded = loadValidatorDeps(baseDir ?? process.cwd());
    return validateCanvas(this.def, { ...loaded, ...deps });
  }

  /** Compila o canvas para WorkflowIR (sem validação semântica — use `validate` antes). */
  compile(): WorkflowIR {
    return compileCanvas(this.def);
  }

  inspect(baseDir?: string): CanvasInspection {
    const ir = this.compile();
    const validation = this.validate(baseDir);
    return {
      name: this.name,
      nodeCount: ir.nodes.length,
      edgeCount: ir.edges.length,
      entryNodes: ir.entryNodes,
      exitNodes: ir.exitNodes,
      capabilities: ir.capabilities,
      nodes: ir.nodes,
      hasErrors: !validation.valid,
    };
  }

  /** Grava o canvas no disco. Retorna o caminho absoluto gravado. */
  async save(target?: string): Promise<string> {
    const file = path.resolve(target ?? `${this.name}.canvas`);
    const payload: unknown = this.def;
    await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8');
    return file;
  }
}

/* ============================ EXECUÇÃO ============================ */

/**
 * Executa (ou planeja, com `dryRun`) um workflow contra o runtime real.
 *
 * Fluxo: valida → compila → (podas from/until) → roda via `executeCanvasWorkflow`
 * (Orchestrator) → agrega estado/mensagens/eventos no resultado unificado.
 * Sem `produce` o run é HEADLESS (simula conteúdo dos nós), mesma convenção da CLI.
 */
export async function executeWorkflow(workflow: CanvasWorkflow | string, opts: ExecuteWorkflowOptions = {}): Promise<WorkflowRunResult> {
  const baseDir = opts.baseDir ?? process.cwd();
  const wf = typeof workflow === 'string' ? await CanvasWorkflow.load(workflow, baseDir) : workflow;

  // Validação ANTES de qualquer execução: canvas inválido não roda.
  const validation = wf.validate(baseDir);
  const errors = (validation.errors ?? []).filter((d) => d.level === 'ERROR');
  if (errors.length > 0) {
    throw new CanvasExecutionError(
      `canvas "${wf.name}" inválido (${errors.length} erro(s)): ${errors.map((e) => `[${e.code}] ${e.message}`).join(' · ')}`,
      validation,
    );
  }

  let ir = wf.compile();
  ir = pruneIR(ir, opts.fromNode, opts.untilNode);

  const runId = opts.dryRun ? `dry-${Date.now()}` : `canvas-${Date.now()}`;
  const events = new WorkflowEventBus(runId);
  const forward = (e: WorkflowEvent): void => {
    events.emit(e);
    opts.onWorkflowEvent?.(e);
  };
  const task = opts.task ?? ir.name ?? `workflow ${wf.name}`;

  // Plano + resolução de modelos (reusado por dry-run E para o resultado real).
  const planInfo = buildPlanSnapshot(ir, baseDir, opts, task);
  forward(makeWorkflowLifecycle(runId, 'workflow.started', { status: opts.dryRun ? 'DRY_RUN' : 'running' }));
  // Modelos resolvidos por nó: pré-planejados (auto/manual/inherit) — fatos do plano, emitidos cedo.
  for (const [nodeId, info] of Object.entries(planInfo.modelByNode)) {
    forward(makeModelResolved(runId, { nodeId, model: info.model, provider: info.provider, source: info.source, reasons: [] }));
  }

  if (opts.dryRun) {
    forward(makeWorkflowLifecycle(runId, 'workflow.completed', { status: 'DRY_RUN', reason: 'dry-run: plano gerado sem executar nós' }));
    const dryNodes = ir.nodes.map((n) => ({ id: n.id, status: 'pending' as const }));
    return {
      runId,
      status: 'DRY_RUN',
      score: 0,
      workflowStatus: 'pending',
      nodes: dryNodes,
      messages: [],
      metrics: { totalTokens: 0, totalLatencyMs: 0 },
      modelByNode: planInfo.modelByNode,
      plan: planInfo.plan,
      traceFile: '',
      headless: true,
      dryRun: true,
      events: [...events.all()],
      state: { input: opts.input, artifacts: {}, variables: {}, nodeResults: {}, memoryRefs: [] },
    };
  }

  const deps: Parameters<typeof executeCanvasWorkflow>[1] = {
    baseDir,
    ...(opts.workspaceDir ? { workspaceDir: opts.workspaceDir } : {}),
    ...(opts.stateDir ? { stateDir: opts.stateDir } : {}),
    ...(opts.budget !== undefined ? { budgets: { maxTokens: opts.budget } } : {}),
    runId,
    task,
    command: 'canvas',
    verbose: opts.verbose,
    availableProviders: opts.availableProviders,
    agentHints: planInfo.agentHints,
    onWorkflowEvent: forward,
    ...(opts.produce ? { produce: opts.produce } : {}),
    ...(opts.consume ? { consume: opts.consume } : {}),
    ...(opts.onEvent ? { onEvent: opts.onEvent } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.allowedTools ? { allowedTools: opts.allowedTools } : {}),
  };

  let result: OrchestrationResult & { workflowState: WorkflowState };
  try {
    result = await executeCanvasWorkflow(ir, deps);
  } catch (err) {
    forward(makeWorkflowLifecycle(runId, 'workflow.failed', { reason: err instanceof Error ? err.message : String(err) }));
    throw err;
  }

  const state = result.workflowState;
  const { workflowStatus, status } = mapStatus(result);
  forward(makeWorkflowLifecycle(runId, workflowStatus === 'paused' ? 'workflow.paused' : workflowStatus === 'failed' ? 'workflow.failed' : 'workflow.completed', {
    status: result.status,
    score: result.score,
    reason: undefined,
  }));

  const nodes = buildNodeSnapshot(ir, state);
  return {
    runId,
    status,
    score: result.score,
    workflowStatus,
    nodes,
    messages: state.messages,
    metrics: state.metrics,
    modelByNode: planInfo.modelByNode,
    plan: planInfo.plan,
    traceFile: result.traceFile,
    headless: opts.produce === undefined,
    dryRun: false,
    events: [...events.all()],
    ...(result.evaluation ? { evaluation: result.evaluation } : {}),
    state: {
      input: state.input,
      artifacts: state.artifacts,
      variables: state.variables,
      nodeResults: state.nodeResults,
      memoryRefs: state.memoryRefs,
    },
  };
}

function mapStatus(result: OrchestrationResult): { workflowStatus: WorkflowStatus; status: WorkflowRunResult['status'] } {
  if (result.pendingApproval) return { workflowStatus: 'paused', status: result.status };
  if (result.status === 'PASS' || result.status === 'PASS_WITH_WARNINGS') return { workflowStatus: 'completed', status: result.status };
  if (result.status === 'FAIL') return { workflowStatus: 'failed', status: result.status };
  return { workflowStatus: 'cancelled', status: 'CANCELLED' };
}

function buildNodeSnapshot(ir: WorkflowIR, state: WorkflowState): WorkflowRunResult['nodes'] {
  return ir.nodes.map((n) => {
    const r = state.nodeResults[n.id];
    return r
      ? { id: n.id, status: r.status, latencyMs: r.latencyMs, tokensUse: r.tokensUse, error: r.error, attempts: r.attempts, output: r.output }
      : { id: n.id, status: 'pending' as const };
  });
}

/* ============================ ORCHESTRATE (ALIAS SDK-AMIGÁVEL) ============================ */

/**
 * Alias de execução: `orchestrate(workflow, input?, opts?)`.
 * `workflow` pode ser instância, caminho de arquivo ou JSON string inline.
 */
export async function orchestrate(
  workflow: CanvasWorkflow | string,
  input?: unknown,
  opts: Omit<ExecuteWorkflowOptions, 'input' | 'baseDir'> & { baseDir?: string } = {},
): Promise<WorkflowRunResult> {
  return executeWorkflow(workflow, { input, ...opts });
}

/* ============================ HELPERS ============================ */

function stripDiagnostics(canvas: ParsedCanvas): CanvasDefinition {
  const { diagnostics: _keepOut, ...clean } = canvas;
  return clean as CanvasDefinition;
}

/** Registry de agentes + skills + roteador do catálogo para validação semântica. */
export function loadValidatorDeps(baseDir: string): CanvasValidatorDeps {
  const agents = new AgentCapabilityRegistry({ baseDir });
  const agentIds = new Set<string>(agents.ids());
  const skillIds = new Set<string>(loadSkillNames(baseDir));
  const router = new ModelRouter(ModelRouter.loadProjectProviders(baseDir));
  return { agents: agentIds, skills: skillIds, router };
}

function loadSkillNames(baseDir: string): string[] {
  const names: string[] = [];
  for (const dir of [path.join(baseDir, 'skills'), path.join(baseDir, '.skills')]) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(dir, entry.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;
      const raw = readFileSync(skillFile, 'utf-8');
      const m = /^name:\s*(.+?)\s*$/m.exec(raw);
      if (m?.[1]) names.push(m[1].trim());
    }
  }
  return names;
}

interface PlanSnapshot {
  plan: CommanderPlan;
  modelByNode: Record<string, { model: string; provider: string; source: 'auto' | 'manual' | 'inherit' }>;
  agentHints: (agentId: string) => string | undefined;
  router: ModelRouter;
}

function buildPlanSnapshot(ir: WorkflowIR, baseDir: string, opts: ExecuteWorkflowOptions, task: string): PlanSnapshot {
  const registry = new AgentCapabilityRegistry({ baseDir });
  const agentHints = (agentId: string): string | undefined => registry.get(agentId)?.modelHint;
  const loaded = ModelRouter.loadProjectProviders(baseDir);
  const providers = opts.availableProviders && opts.availableProviders.length > 0
    ? loaded.filter((p) => opts.availableProviders!.includes(p.id))
    : loaded;
  const router = new ModelRouter(providers.length > 0 ? providers : loaded);
  const built = buildCanvasPlan({
    ir,
    router,
    agentHints,
    availableProviders: opts.availableProviders,
    task,
    tokenBudget: opts.budget,
  });
  return { plan: built.plan, modelByNode: built.modelByNode, agentHints, router };
}

/** Recorta o IR para execução parcial (fromNode/untilNode). */
export function pruneIR(ir: WorkflowIR, fromNode?: string, untilNode?: string): WorkflowIR {
  if (!fromNode && !untilNode) return ir;
  const all = new Set(ir.nodes.map((n) => n.id));
  const missing = [fromNode, untilNode].filter((id): id is string => typeof id === 'string' && id !== '' && !all.has(id));
  if (missing.length > 0) {
    throw new CanvasExecutionError(`nós ausentes para poda de execução: ${missing.join(', ')}`);
  }
  let keep = all;
  if (fromNode) {
    const reachable = downstream(ir, fromNode);
    keep = intersect(keep, reachable);
  }
  if (untilNode) {
    const upstream = upstreamClosure(ir, untilNode);
    keep = intersect(keep, upstream);
  }
  if (keep.size === 0) {
    throw new CanvasExecutionError('poda from/until resultou em workflow vazio');
  }
return {
    ...ir,
    nodes: ir.nodes.filter((n) => keep.has(n.id)),
    edges: ir.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
    entryNodes: ir.entryNodes.filter((n) => keep.has(n)),
    exitNodes: ir.exitNodes.filter((n) => keep.has(n)),
  };
}

function downstream(ir: WorkflowIR, start: string): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of ir.edges) {
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

function upstreamClosure(ir: WorkflowIR, end: string): Set<string> {
  const rev = new Map<string, string[]>();
  for (const e of ir.edges) {
    const list = rev.get(e.to) ?? [];
    list.push(e.from);
    rev.set(e.to, list);
  }
  const seen = new Set<string>([end]);
  const queue = [end];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const prev of rev.get(cur) ?? []) {
      if (!seen.has(prev)) {
        seen.add(prev);
        queue.push(prev);
      }
    }
  }
  return seen;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter((x) => b.has(x)));
}