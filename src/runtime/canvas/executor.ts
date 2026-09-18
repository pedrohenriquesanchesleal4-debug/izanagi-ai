/**
 * Canvas Orchestration — executor.
 *
 * Ponte entre o IR do canvas e o Orchestrator existente do runtime:
 *
 *   1. mapeia RuntimeNode → GraphNode (kinds e dependências);
 *   2. calcula parallelBatches com o scheduler;
 *   3. anexa TaskContract por nó (permissões, papel, orçamento) e
 *      resolução de modelo por nó (`model-config`) no metadata;
 *   4. executa via `Orchestrator` com `plan` (caminho Commander) e um
 *      `routeRole` próprio que honra o modelo do CANVAS antes do default;
 *   5. envolve o `produce` do caller: contexto por política,
 *      mensagens do bus, loops com teto de iterações e condição de término.
 *
 * O canvas é a INTERFACE; quem produz artefato é o runtime. Sem producer o
 * executor roda em modo headless (mesma convenção da CLI): planeja, roteia e
 * verifica de verdade, e SIMULA o conteúdo dos nós.
 */

import type { GraphNode, ExecutionGraph, RoutingHints } from '../types.js';
import type { AgentRole } from '../contracts/task-contract.js';
import { Orchestrator, type OrchestratorOptions, type ExecuteCtx } from '../orchestrator.js';
import type { CommanderPlan } from '../orchestration/commander.js';
import { attachContract, type TaskContract } from '../contracts/task-contract.js';
import { ModelRouter } from '../model/router.js';
import type { WorkflowIR, WorkflowState, CanvasNodeResult } from './types.js';
import { schedule } from './scheduler.js';
import { MessageBus, createWorkflowState, recordNodeResult, accrueTokens } from './message-bus.js';
import { buildContext } from './context-policy.js';
import { resolveNodeModel } from './model-config.js';
import { evaluateCondition } from './condition.js';
import type { ToolPermission } from '../tools/registry.js';

export interface CanvasExecutorDeps {
  baseDir: string;
  workspaceDir?: string;
  stateDir?: string;
  task: string;
  /** Registry de capacidades para modelHint por agente. */
  agentHints?: (agentId: string) => string | undefined;
  /** Providers realmente utilizáveis (restrição de catálogo; vazio = todos). */
  availableProviders?: string[];
  budgets?: Partial<OrchestratorOptions['budgetLimits']>;
  command?: string;
  verbose?: boolean;
  onEvent?: OrchestratorOptions['onEvent'];
  signal?: AbortSignal;
  allowedTools?: string[];
}

export interface CanvasPlanInput {
  ir: WorkflowIR;
  router: ModelRouter;
  /** Modelo global herdado (mode=inherit). */
  inheritedModelId?: string;
  agentHints?: (agentId: string) => string | undefined;
  availableProviders?: string[];
  tokenBudget?: number;
  task?: string;
}

export interface CanvasExecutionPlan {
  plan: CommanderPlan;
  modelByNode: Record<string, { model: string; provider: string; source: 'auto' | 'manual' | 'inherit' }>;
  routeRole: (role: AgentRole, node?: GraphNode, hints?: RoutingHints) => { model: string; provider: string } | undefined;
}

/** Monta o plano Commander com o grafo derivado do IR. */
export function buildCanvasPlan(input: CanvasPlanInput): CanvasExecutionPlan {
  const { ir, router } = input;
  const sch = schedule(ir);
  const modelByNode: CanvasExecutionPlan['modelByNode'] = {};

  const nodes: GraphNode[] = ir.nodes.map((n) => {
    const contract = contractForNode(n, ir, input);
    const graphNode: GraphNode = {
      id: n.id,
      kind: n.graphKind ?? 'agent',
      agent: n.agent,
      skills: n.skills,
      dependencies: ir.edges.filter((e) => e.to === n.id && !isLoopBackEdge(e, ir)).map((e) => e.from),
      ...(n.condition ? { condition: n.condition } : {}),
      ...(n.retry ? { retryPolicy: n.retry } : {}),
      ...(n.timeoutMs !== undefined ? { timeoutMs: n.timeoutMs } : {}),
      ...(n.tokenBudget !== undefined ? { tokenBudget: n.tokenBudget } : {}),
      metadata: {
        canvas: {
          kind: n.kind,
          label: n.label,
          loop: n.loop,
          context: n.context,
          tool: n.tool,
          prompt: n.prompt,
          permissions: n.permissions,
          extra: n.extra,
        },
      },
    };
    // Resolução de modelo por nó: pinada AGORA, no metadata, para o routeRole
    // do executor ler sem re-rotear.
    if (n.graphKind === 'agent' || n.graphKind === 'validator' || n.graphKind === 'evaluator') {
      const mode = n.model?.mode ?? 'auto';
      const effectiveRole: AgentRole = n.retry?.maxAttempts ? 'worker' : 'specialist';
      try {
        const resolved = resolveNodeModel(n.id, {
          mode,
          manual: mode === 'manual' && n.model?.provider && n.model.model
            ? { provider: n.model.provider, model: n.model.model, reasoning: n.model.reasoning }
            : undefined,
          role: effectiveRole,
          hintedTier: input.agentHints?.(n.agent ?? ''), // modelHint do genome ou do canvas
          router,
          ctx: {
            task: input.task ?? ir.name ?? ir.nodes.map((x) => x.label).join(' '),
            taskComplexity: 3,
            reasoningRequirement: 'medium',
            risk: 0.2,
            tokenBudget: input.tokenBudget ?? 16000,
            requiresTools: Boolean(n.tool),
          },
          inheritedId: input.inheritedModelId,
        });
        modelByNode[n.id] = { model: resolved.model, provider: resolved.provider, source: resolved.source };
        graphNode.model = resolved.model;
        // O produtor real lê node.model? Não: o routeRole decide. Guarda no
        // metadata para o routeRole consultar.
        graphNode.metadata!.canvasModel = { model: resolved.model, provider: resolved.provider };
      } catch {
        modelByNode[n.id] = { model: 'inherit', provider: 'inherit', source: 'inherit' };
        graphNode.metadata!.canvasModel = undefined;
      }
    }
    return attachContract(graphNode, contract);
  });

  const batching: string[][] = sch.parallelBatches.map((batch) => batch);

  const graph: ExecutionGraph = {
    id: `canvas-${ir.id}`,
    task: input.task ?? ir.name ?? 'workflow do canvas',
    createdAt: new Date().toISOString(),
    nodes,
    order: sch.order,
    parallelBatches: batching,
    budget: {
      maxAttempts: 3,
      maxTokens: input.tokenBudget ?? 16000,
      maxTimeMs: 30 * 60_000,
    },
  };

  // routeRole do executor: honra o modelo pinado do canvas antes do default.
  const routeRole: CanvasExecutionPlan['routeRole'] = (role, node, hints) => {
    const pinned = node?.metadata?.canvasModel as { model: string; provider: string } | undefined;
    if (pinned?.model && pinned.provider) {
      return { model: pinned.model, provider: pinned.provider };
    }
    if (node?.agent) {
      const hinted = input.agentHints?.(node.agent);
      try {
        const routed = router.routeForRole(
          role,
          {
            task: graph.task,
            taskComplexity: 3,
            reasoningRequirement: 'medium',
            risk: 0.2,
            tokenBudget: input.tokenBudget ?? 16000,
            requiresTools: Boolean(node.skills?.includes('tool')),
            ...(hints ? { historicalPerformance: hints.historicalPerformance } : {}),
          },
          hinted ? (ModelRouter.tierForHint(hinted) as Parameters<typeof router.routeForRole>[2]) : undefined,
        );
        return { model: routed.model.id, provider: routed.provider };
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const plan: CommanderPlan = {
    runObjective: graph.task,
    mode: 'orchestrated',
    modeReason: `canvas declarativo "${ir.name ?? ir.id}" (${nodes.length} nós, ${batching.length} etapas)`,
    classification: {
      complexity: 3,
      domains: [],
      category: 'canvas',
      reasoning: nodes.length > 3 ? 'high' : 'medium',
      risk: 0.2,
      reasons: ['workflow declarativo (canvas): grafo inteiro definido pelo autor, não pelo Commander'],
    },
    graph,
    contracts: nodes.map((n) => contractOfNode(n)),
    estimate: {
      nodes: nodes.length,
      parallelStages: batching.length,
      maxTokens: input.tokenBudget ?? 16000,
      byRole: { commander: { tasks: 0, tokens: 0 }, specialist: { tasks: nodes.filter((n) => n.kind !== 'tool').length, tokens: input.tokenBudget ?? 16000 }, worker: { tasks: 0, tokens: 0 } },
      quality: 0.6,
    },
    decisions: ['canvas declarativo: grafo autorado pelo usuário; Commander apenas valida e roteia'],
    issues: [],
  };

  return { plan, modelByNode, routeRole };
}

/** Verifica se a aresta é aresta de retorno de loop (volta para nó com loop). */
function isLoopBackEdge(e: { from: string; to: string }, ir: WorkflowIR): boolean {
  const loopNodes = new Set(ir.nodes.filter((n) => n.loop).map((n) => n.id));
  return loopNodes.has(e.to);
}

/** Contrato default por nó (papel, orçamento, saída esperada). */
function contractForNode(n: WorkflowIR['nodes'][number], ir: WorkflowIR, input: CanvasPlanInput): TaskContract {
  const role: AgentRole = n.kind === 'orchestrator' ? 'commander' : n.kind === 'evaluator' ? 'worker' : n.kind === 'tool' || n.kind === 'human-review' || n.kind === 'condition' ? 'worker' : 'specialist';
  const permissions: ToolPermission[] = (n.permissions ?? []) as ToolPermission[];
  const tool = n.kind === 'tool' && n.tool
    ? { id: n.tool }
    : undefined;
  return {
    id: n.id,
    objective: `canvas node "${n.id}" (${n.kind}${n.agent ? `: ${n.agent}` : ''})`,
    role,
    agent: n.agent,
    skills: n.skills,
    inputs: ir.edges.filter((e) => e.to === n.id).map((e) => e.from),
    constraints: ['obedeça ao prompt do nó definido no canvas; nada fora do escopo do nó'],
    expectedOutput: { kind: 'artifact', minSize: 10 },
    dependencies: ir.edges.filter((e) => e.to === n.id && !isLoopBackEdge(e, ir)).map((e) => e.from),
    priority: n.kind === 'orchestrator' || n.kind === 'evaluator' ? 'high' : 'normal',
    budget: {
      maxTokens: input.tokenBudget ?? 16000,
      ...(n.timeoutMs !== undefined ? { maxTimeMs: n.timeoutMs } : {}),
    },
    verification: { deterministic: [] },
    acceptance: [],
    optional: n.kind === 'group' || n.graphKind === 'gate',
    permissions: permissions.length > 0 ? permissions : undefined,
    ...(tool ? { tool } : {}),
  };
}

function contractOfNode(node: GraphNode): TaskContract {
  const c = (node.metadata?.contract as TaskContract) ?? ({} as TaskContract);
  return c;
}

/**
 * Executa o workflow do canvas por completo e devolve o resultado do run.
 * O `produce` do caller é envolvido: contexto por política, mensagens do bus
 * e loops com teto de iterações + condição de término.
 */
export async function executeCanvasWorkflow(
  ir: WorkflowIR,
  deps: CanvasExecutorDeps & { produce?: OrchestratorOptions['produce']; consume?: OrchestratorOptions['consume'] },
): Promise<Awaited<ReturnType<Orchestrator['run']>>> {
  // Providers disponíveis: carrega do projeto (config) + catálogo default,
  // filtrado pelos `availableProviders` informados.
  const loaded = ModelRouter.loadProjectProviders(deps.baseDir);
  const providers = deps.availableProviders && deps.availableProviders.length > 0
    ? loaded.filter((p) => deps.availableProviders!.includes(p.id))
    : loaded;
  const router = new ModelRouter(providers.length > 0 ? providers : loaded);
  const execPlan = buildCanvasPlan({
    ir,
    router,
    agentHints: deps.agentHints ?? (() => undefined),
    availableProviders: deps.availableProviders,
    task: deps.task,
  });

  const bus = new MessageBus(`canvas-${Date.now()}`);
  const state = createWorkflowState(bus.runId, { task: deps.task });
  state.messages = [...bus.all()];

  const loopWrapper = (node: GraphNode): OrchestratorOptions['produce'] => async (n, ctx) => {
    const canvasMeta = (n.metadata?.canvas as Record<string, unknown>) ?? {};
    const loop = canvasMeta.loop as { maxIterations?: number; terminationCondition?: string; uploadResults?: boolean } | undefined;
    const policy = canvasMeta.context as Parameters<typeof buildContext>[1] | undefined;
    if (!loop || !loop.maxIterations) {
      return runOnce(ir, state, bus, n, policy, deps.produce);
    }
    const max = Math.min(loop.maxIterations, 50);
    const results: unknown[] = [];
    let lastResult: unknown;
    let terminated = false;
    let reason = `loop concluído após ${max} iterações (teto)`;
    for (let i = 1; i <= max; i++) {
      if (deps.signal?.aborted) break;
      // estado por iteração: scope com variáveis do loop
      const iterCtx = { ...ctx, iteration: i, iterationResults: results };
      const produced = await runOnce(ir, state, bus, n, policy, deps.produce, iterCtx);
      lastResult = produced.content;
      results.push(produced.content);
      // condição de término avaliada contra o estado REAL acumulado
      const scope = { state, iteration: i, result: lastResult, results };
      const term = loop.terminationCondition;
      if (term && evaluateCondition(term, scope)) {
        terminated = true;
        reason = `condição de término "${term}" satisfeita na iteração ${i}`;
        break;
      }
    }
    return {
      content: loop.uploadResults === false ? lastResult : { iterations: results, terminated, reason },
      kind: 'artifact',
      tokens: producedTokens(results),
    };
  };

  const orchestrator = new Orchestrator({
    baseDir: deps.baseDir,
    ...(deps.workspaceDir ? { workspaceDir: deps.workspaceDir } : {}),
    ...(deps.stateDir ? { stateDir: deps.stateDir } : {}),
    command: deps.command ?? 'canvas',
    task: deps.task,
    category: 'canvas',
    primaryAgent: ir.nodes.find((n) => n.kind === 'orchestrator')?.agent ?? 'canvas',
    skillChain: [],
    verbose: deps.verbose,
    availableProviders: deps.availableProviders,
    plan: execPlan.plan,
    routeRole: execPlan.routeRole,
    budgetLimits: deps.budgets,
    ...(deps.allowedTools ? { allowedTools: deps.allowedTools } : {}),
    ...(deps.onEvent ? { onEvent: deps.onEvent } : {}),
    ...(deps.signal ? { signal: deps.signal } : {}),
    produce: deps.produce ? (node, ctx) => loopWrapper(node)(node, ctx) : undefined,
    consume: deps.consume,
  });

  return orchestrator.run();
}

/** Executa UM nó com o producer do caller, registrando no estado e no bus. */
async function runOnce(
  ir: WorkflowIR,
  state: WorkflowState,
  bus: MessageBus,
  node: GraphNode,
  policy: Parameters<typeof buildContext>[1] | undefined,
  produce: OrchestratorOptions['produce'] | undefined,
  extra?: Record<string, unknown>,
): Promise<{ content: unknown; kind: string; tokens: number; model?: string }> {
  const started = Date.now();
  const ctx = buildContext(state, policy, node.id);
  const result: CanvasNodeResult = {
    nodeId: node.id,
    agent: node.agent,
    status: 'completed',
    startedAt: new Date(started).toISOString(),
    latencyMs: 0,
  };
  try {
    // Mensagens que o nó RECEBE (incoming edges) — injetadas no scope de condição
    const incoming = bus.receivedBy(node.id);
    const produced = produce
      ? await produce(node, { ctx: state, state, messages: incoming, ...extra } as unknown as Parameters<NonNullable<OrchestratorOptions['produce']>>[1])
      : { content: headlessContent(node), kind: 'artifact', tokens: 0 };
    recordNodeResult(state, result);
    accrueTokens(state, { input: 0, output: produced.tokens ?? 0 });
    // Mensagens emitidas: arestas com messageType saem do nó
    for (const edge of ir.edges.filter((e) => e.from === node.id && e.messageType)) {
      bus.send(node.id, edge.to, edge.messageType!, { summary: summarize(produced.content), ...(edge.condition ? { condition: edge.condition } : {}) }, { tokenEstimate: produced.tokens ?? 0 });
    }
    return produced;
  } catch (err) {
    result.status = 'failed';
    result.error = err instanceof Error ? err.message : String(err);
    recordNodeResult(state, result);
    throw err;
  } finally {
    result.latencyMs = Date.now() - started;
  }
}

function headlessContent(node: GraphNode): unknown {
  return {
    nodeId: node.id,
    kind: node.kind,
    agent: node.agent,
    output: `[headless] simulação do nó ${node.id}${node.agent ? ` (${node.agent})` : ''} — execute com producer LLM para artefato real`,
  };
}

function producedTokens(results: unknown[]): number {
  return 0;
}

function summarize(content: unknown): unknown {
  if (typeof content === 'string') return content.length > 200 ? `${content.slice(0, 200)}…` : content;
  return content;
}