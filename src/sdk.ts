/**
 * SDK programático do Izanagi: `izanagi.run({ objective })`.
 *
 * Mesma engine da CLI (`runtime/execute.ts`), sem nada impresso no terminal.
 * Quem integra o Izanagi num serviço, num job ou noutro agente usa esta
 * superfície; a CLI é apenas a versão interativa dela.
 *
 * Observabilidade: o handle devolvido é uma Promise que também aceita
 * assinatura de eventos do run em tempo real.
 *
 *   const run = izanagi.run({ objective: 'auditar a API de login' });
 *   run.on('task:start', (e) => console.log(e.data));
 *   const result = await run;
 */

import { Orchestrator, type ExecuteCtx } from './runtime/orchestrator.js';
import { LLMClient } from './runtime/llm/client.js';
import { ContextResolver } from './runtime/orchestration/context-resolver.js';
import { ResponseCache } from './runtime/cache/response-cache.js';
import {
  buildExecutionPlan,
  createHeadlessProducer,
  createLLMProducer,
  createSemanticJudge,
  LOCAL_PROVIDERS,
  type ProducerLLMClient,
} from './runtime/execute.js';
import { buildNodePrompt, classifyTask } from './cli/commands/run.js';
import type { ExecutionMode } from './runtime/contracts/task-contract.js';
import type { IzanagiEvent, IzanagiEventName } from './runtime/observability/events.js';
import type { CommanderPlan } from './runtime/orchestration/commander.js';
import type { TokenTelemetry } from './runtime/token/execution-budget.js';
import type { EvaluationReport, GraphNode, HealingAction, RunTrace } from './runtime/types.js';
import type { VerificationResult } from './runtime/verification/engine.js';

export interface IzanagiRunOptions {
  /** O que precisa ser resolvido. */
  objective: string;
  /** Raiz do projeto (default: diretório atual). */
  baseDir?: string;
  mode?: ExecutionMode;
  budget?: { maxTokens?: number; maxCost?: number; maxTimeMs?: number; maxToolCalls?: number; maxAgents?: number; maxRetries?: number };
  /** Fixa o mesmo modelo em todos os papéis. */
  model?: string;
  /** Só providers locais (Ollama / LM Studio / endpoint próprio). */
  local?: boolean;
  /** Cache local de respostas. */
  cache?: boolean;
  /** Agente explícito; sem isso o Capability Registry escolhe. */
  agent?: string;
  skillChain?: string[];
  /** Planejamento legado por categoria, sem Commander. */
  noCommander?: boolean;
  /**
   * Desliga o juiz semântico (default: ligado quando há provider). Sem juiz,
   * critério de aceite semântico fica UNVERIFIED em vez de aprovado.
   */
  noJudge?: boolean;
  /** Client LLM alternativo (testes, proxy, gateway próprio). */
  client?: ProducerLLMClient & { configuredProviders(): string[] };
}

export interface IzanagiRunResult {
  runId: string;
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN';
  score: number;
  mode?: ExecutionMode;
  /** Plano do Commander (ausente com `noCommander`). */
  plan?: CommanderPlan;
  /** Artefatos produzidos, por id de tarefa. */
  artifacts: Record<string, { kind: string; content: unknown; valid: boolean }>;
  telemetry?: TokenTelemetry;
  verification?: Array<{ nodeId: string; result: VerificationResult }>;
  evaluation?: EvaluationReport;
  healing: HealingAction[];
  trace: RunTrace;
  traceFile: string;
  /** Execução pausada aguardando decisão humana. */
  pendingApproval?: { nodeId: string; context?: string };
  /** true quando nenhum provider estava configurado (artefatos simulados). */
  headless: boolean;
}

/** Aliases amigáveis para os eventos internos do runtime. */
const EVENT_ALIASES: Record<string, IzanagiEventName> = {
  'task:start': 'node.started',
  'task:complete': 'node.completed',
  'run:start': 'run.started',
  'run:complete': 'run.completed',
  'verification:failed': 'quality_gate.failed',
  'verification:passed': 'quality_gate.passed',
  'healing:start': 'healing.started',
  'healing:complete': 'healing.completed',
};

export type IzanagiEventSelector = IzanagiEventName | keyof typeof EVENT_ALIASES | '*';

export interface IzanagiRunHandle extends Promise<IzanagiRunResult> {
  /** Assina um evento do run. Devolve a função de cancelamento. */
  on(event: IzanagiEventSelector, handler: (event: IzanagiEvent) => void): () => void;
}

function resolveEventName(selector: IzanagiEventSelector): string {
  return EVENT_ALIASES[selector as keyof typeof EVENT_ALIASES] ?? selector;
}

/**
 * Executa um objetivo de ponta a ponta: Commander decide o modo, o grafo roda
 * com roteamento por papel, os artefatos são verificados contra os critérios
 * de aceite e a telemetria de custo volta junto do resultado.
 */
export function run(options: IzanagiRunOptions): IzanagiRunHandle {
  const baseDir = options.baseDir ?? process.cwd();
  const client = options.client ?? new LLMClient();
  const allProviders = client.configuredProviders();
  const providers = options.local ? allProviders.filter((p) => LOCAL_PROVIDERS.includes(p)) : allProviders;

  const classified = classifyTask(options.objective);
  const planning = buildExecutionPlan(baseDir, {
    objective: options.objective,
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.agent ? { agent: options.agent, explicitAgent: true } : {}),
    ...(options.skillChain ? { skillChain: options.skillChain } : {}),
    ...(options.budget?.maxTokens !== undefined ? { maxTokens: options.budget.maxTokens } : {}),
    ...(options.budget?.maxCost !== undefined ? { maxCostUsd: options.budget.maxCost } : {}),
    ...(options.model ? { model: options.model } : {}),
    availableProviders: providers,
    ...(options.noCommander ? { noCommander: true } : {}),
  });

  const cache = new ResponseCache({ baseDir, enabled: Boolean(options.cache) || ResponseCache.enabledFromEnv() });
  const contextResolver = new ContextResolver();
  const agentId = options.agent ?? planning.plan?.contracts[0]?.agent ?? classified.agent;

  const producer = providers.length === 0
    ? createHeadlessProducer(options.objective)
    : createLLMProducer({
        objective: options.objective,
        client,
        cache,
        contextResolver,
        buildSystemPrompt: (node: GraphNode, _ctx: ExecuteCtx, minimalContext?: string) =>
          buildNodePrompt(node, { task: options.objective, agent: { name: agentId }, skillChain: options.skillChain ?? [] }, baseDir, {
            ...(minimalContext ? { context: minimalContext } : {}),
          }),
      });

  // Mesmo juiz semântico da CLI: as duas superfícies verificam igual.
  const judge = options.noJudge || providers.length === 0
    ? undefined
    : createSemanticJudge({ client, routeRole: planning.routeRole });

  const handlers: Array<{ name: string; handler: (event: IzanagiEvent) => void }> = [];
  const artifacts: Record<string, { kind: string; content: unknown; valid: boolean }> = {};

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'sdk',
    task: options.objective,
    category: planning.plan?.classification.category ?? classified.category,
    primaryAgent: agentId,
    skillChain: options.skillChain ?? [],
    availableProviders: providers,
    ...(planning.plan ? { plan: planning.plan } : {}),
    budgetLimits: {
      ...(options.budget?.maxCost !== undefined ? { maxCostUsd: options.budget.maxCost } : {}),
      ...(options.budget?.maxTimeMs !== undefined ? { maxTimeMs: options.budget.maxTimeMs } : {}),
      ...(options.budget?.maxToolCalls !== undefined ? { maxToolCalls: options.budget.maxToolCalls } : {}),
      ...(options.budget?.maxAgents !== undefined ? { maxAgents: options.budget.maxAgents } : {}),
      ...(options.budget?.maxRetries !== undefined ? { maxRetries: options.budget.maxRetries } : {}),
    },
    ...(judge ? { judge } : {}),
    routeRole: planning.routeRole,
    costOf: planning.costOf,
    produce: producer,
    consume: (node, artifact) => {
      artifacts[node.id] = { kind: artifact.kind, content: artifact.content, valid: artifact.valid };
    },
    onEvent: (event) => {
      for (const h of handlers) {
        if (h.name === '*' || h.name === event.name) h.handler(event);
      }
    },
  });

  // Início adiado por uma microtask: `run()` devolve o handle ANTES de o
  // runtime emitir o primeiro evento, senão `handle.on(...)` registrado logo
  // depois perderia `run.started` e o primeiro `node.started`.
  const promise = Promise.resolve()
    .then(() => orchestrator.run())
    .then((result): IzanagiRunResult => ({
      runId: result.trace.runId,
      status: result.status,
      score: result.score,
      ...(result.mode ? { mode: result.mode } : {}),
      ...(planning.plan ? { plan: planning.plan } : {}),
      artifacts,
      ...(result.telemetry ? { telemetry: result.telemetry } : {}),
      ...(result.verification ? { verification: result.verification } : {}),
      ...(result.evaluation ? { evaluation: result.evaluation } : {}),
      healing: result.healing,
      trace: result.trace,
      traceFile: result.traceFile,
      ...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {}),
      headless: providers.length === 0,
    }));

  const handle = promise as IzanagiRunHandle;
  handle.on = (event, handler) => {
    const entry = { name: resolveEventName(event), handler };
    handlers.push(entry);
    return () => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
    };
  };
  return handle;
}

/**
 * Só planeja: devolve modo, contratos e estimativa de custo sem executar nada
 * nem gastar token. Útil para mostrar ao usuário o que vai acontecer (e quanto
 * vai custar) antes de autorizar.
 */
export function plan(options: Pick<IzanagiRunOptions, 'objective' | 'baseDir' | 'mode' | 'model' | 'agent' | 'skillChain' | 'budget' | 'local' | 'client'>): CommanderPlan | undefined {
  const baseDir = options.baseDir ?? process.cwd();
  const client = options.client ?? new LLMClient();
  const all = client.configuredProviders();
  const providers = options.local ? all.filter((p) => LOCAL_PROVIDERS.includes(p)) : all;
  return buildExecutionPlan(baseDir, {
    objective: options.objective,
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.agent ? { agent: options.agent, explicitAgent: true } : {}),
    ...(options.skillChain ? { skillChain: options.skillChain } : {}),
    ...(options.budget?.maxTokens !== undefined ? { maxTokens: options.budget.maxTokens } : {}),
    ...(options.budget?.maxCost !== undefined ? { maxCostUsd: options.budget.maxCost } : {}),
    ...(options.model ? { model: options.model } : {}),
    availableProviders: providers,
  }).plan;
}

export const izanagi = { run, plan };
export default izanagi;
