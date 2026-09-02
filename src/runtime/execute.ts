/**
 * Wiring compartilhado entre a CLI (`izanagi run`) e o SDK (`izanagi.run()`).
 *
 * Existe para que as duas superfícies executem EXATAMENTE o mesmo runtime:
 * mesmo Commander, mesmo roteamento por papel, mesmo cache, mesmo estimador de
 * custo. Antes de existir, a única forma de rodar o runtime era pela CLI, e
 * qualquer integração programática teria que reimplementar essa cola (e sair
 * do ar em silêncio a cada mudança do runtime).
 *
 * Nenhuma dependência da camada CLI: quem constrói o prompt de sistema passa
 * uma função. Assim este módulo continua sendo runtime puro.
 */

import { Commander, type CommanderPlan } from './orchestration/commander.js';
import { AgentCapabilityRegistry } from './registry/capabilities.js';
import { ModelRouter } from './model/router.js';
import { ContextResolver } from './orchestration/context-resolver.js';
import { ResponseCache } from './cache/response-cache.js';
import type { AgentRole, ExecutionMode } from './contracts/task-contract.js';
import type { ExecuteCtx } from './orchestrator.js';
import type { GraphNode, ModelSpec, RoutingContext } from './types.js';

/** Providers que rodam na própria máquina (usados por `--local`). */
export const LOCAL_PROVIDERS = ['ollama', 'lmstudio', 'custom'];

export interface PlanningInput {
  objective: string;
  mode?: ExecutionMode;
  agent?: string;
  explicitAgent?: boolean;
  skillChain?: string[];
  maxTokens?: number;
  maxCostUsd?: number;
  /** Fixa o mesmo modelo em todos os papéis. */
  model?: string;
  /** Providers realmente utilizáveis (com chave/opt-in). */
  availableProviders: string[];
  /** Pula o Commander e devolve `plan: undefined` (caminho legado por categoria). */
  noCommander?: boolean;
}

export interface PlanningOutput {
  plan?: CommanderPlan;
  router: ModelRouter;
  routingContext: RoutingContext;
  /** Modelos do catálogo por id, para converter tokens em custo real. */
  specById: Map<string, ModelSpec>;
  capabilities: AgentCapabilityRegistry;
  routeRole: (role: AgentRole, node: GraphNode) => { model: string; provider: string } | undefined;
  costOf: (modelId: string, inputTokens: number, outputTokens: number) => number;
}

/**
 * Monta o plano do Commander e o roteamento por papel a partir do catálogo
 * realmente disponível no ambiente.
 */
export function buildExecutionPlan(baseDir: string, input: PlanningInput): PlanningOutput {
  const catalog = ModelRouter.loadProjectProviders(baseDir);
  const usable = input.availableProviders.length > 0
    ? catalog.filter((p) => input.availableProviders.includes(p.id))
    : catalog;
  const configuredPolicy = ModelRouter.loadRolePolicy(baseDir);
  // `--model` é ordem explícita do usuário: vence a política do projeto.
  const policy = input.model
    ? { commander: { model: input.model }, specialist: { model: input.model }, worker: { model: input.model } }
    : configuredPolicy;
  const router = new ModelRouter(usable.length > 0 ? usable : catalog).withRolePolicy(policy);

  const routingContext: RoutingContext = {
    task: input.objective,
    taskComplexity: ModelRouter.estimateComplexity(input.objective),
    reasoningRequirement: 'medium',
    risk: 0.2,
    tokenBudget: input.maxTokens ?? 16000,
    requiresTools: false,
  };

  const specById = new Map(catalog.flatMap((p) => p.models).map((m) => [m.id, m]));
  const capabilities = new AgentCapabilityRegistry({ baseDir });

  const plan = input.noCommander
    ? undefined
    : new Commander().plan({
        objective: input.objective,
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.explicitAgent && input.agent ? { agent: input.agent } : {}),
        ...(input.skillChain ? { skillChain: input.skillChain } : {}),
        ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
        ...(input.maxCostUsd !== undefined ? { maxCostUsd: input.maxCostUsd } : {}),
        capabilities,
        estimateCostUsd: (role, tokens) => router.estimateCostForRole(role, tokens),
      });

  return {
    ...(plan ? { plan } : {}),
    router,
    routingContext,
    specById,
    capabilities,
    routeRole: (role: AgentRole) => {
      try {
        const routed = router.routeForRole(role, routingContext);
        return { model: routed.model.id, provider: routed.provider };
      } catch {
        return undefined;
      }
    },
    costOf: (modelId, inputTokens, outputTokens) => {
      const spec = specById.get(modelId);
      return spec ? ModelRouter.costUsd(spec, inputTokens, outputTokens) : 0;
    },
  };
}

/** Superfície mínima do cliente LLM consumida pelo producer. */
export interface ProducerLLMClient {
  complete(provider: string, opts: {
    model: string;
    system?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
  }): Promise<{ text: string; tokens: number; model: string; provider: string; cachedTokens?: number }>;
}

export interface ProducerOptions {
  objective: string;
  client: ProducerLLMClient;
  cache: ResponseCache;
  contextResolver: ContextResolver;
  /** Compila o system prompt do nó (a CLI usa o compilador de skills/regras). */
  buildSystemPrompt: (node: GraphNode, ctx: ExecuteCtx, minimalContext?: string) => string;
  /** Observador por nó: telemetria, log verboso, progresso. */
  onNode?: (info: { nodeId: string; role?: AgentRole; model: string; tokens: number; cachedTokens: number; fromCache: boolean }) => void;
}

export type NodeProducer = (node: GraphNode, ctx: ExecuteCtx) => Promise<{ content: unknown; kind: string; tokens?: number; model?: string }>;

/**
 * Producer real: contexto mínimo, cache local, chamada ao modelo do papel.
 * Um hit de cache devolve `tokens: 0` de propósito: a chamada não aconteceu,
 * então não existe gasto a contabilizar (a economia entra na telemetria).
 */
export function createLLMProducer(opts: ProducerOptions): NodeProducer {
  return async (node: GraphNode, ctx: ExecuteCtx) => {
    const minimalContext = ctx.nodeContext ? opts.contextResolver.render(ctx.nodeContext) : undefined;
    const system = opts.buildSystemPrompt(node, ctx, minimalContext);
    const messages = [{ role: 'user' as const, content: opts.objective }];
    const maxTokens = node.tokenBudget ?? 4000;
    const key = { provider: ctx.provider, model: ctx.model, system, messages, maxTokens };

    const cached = opts.cache.get(key);
    if (cached) {
      ctx.execBudget?.recordCacheHit(cached.originalTokens);
      opts.onNode?.({ nodeId: node.id, ...(ctx.nodeRole ? { role: ctx.nodeRole } : {}), model: cached.model, tokens: 0, cachedTokens: 0, fromCache: true });
      return { content: cached.text, kind: node.outputs?.[0] ?? 'raw', tokens: 0, model: cached.model };
    }
    opts.cache.recordMissIfEnabled(ctx.execBudget);

    const result = await opts.client.complete(ctx.provider, { model: ctx.model, system, messages, maxTokens });
    opts.cache.set(key, result);
    opts.onNode?.({
      nodeId: node.id,
      ...(ctx.nodeRole ? { role: ctx.nodeRole } : {}),
      model: result.model,
      tokens: result.tokens,
      cachedTokens: result.cachedTokens ?? 0,
      fromCache: false,
    });
    return { content: result.text, kind: node.outputs?.[0] ?? 'raw', tokens: result.tokens, model: result.model };
  };
}

/** Producer headless: sem provider configurado, simula o artefato do nó. */
export function createHeadlessProducer(objective: string): NodeProducer {
  return async (node: GraphNode) => {
    const label = node.agent ?? node.skills?.join('+') ?? node.id;
    return {
      content: {
        node: node.id,
        label,
        task: objective,
        producedAt: new Date().toISOString(),
        summary: `Artefato produzido pelo nó "${node.id}" (${label}).`,
      },
      kind: node.outputs?.[0] ?? 'raw',
      tokens: 300,
      model: 'cli-headless',
    };
  };
}
