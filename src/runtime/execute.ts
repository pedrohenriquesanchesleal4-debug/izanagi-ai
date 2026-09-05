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

import { Commander, type CommanderPlan, type ReplanFailure, type ReplanResult } from './orchestration/commander.js';
import { AgentCapabilityRegistry } from './registry/capabilities.js';
import { MemoryStore } from './memory/store.js';
import { SkillResolver } from './routing/resolver.js';
import { ModelRouter } from './model/router.js';
import { ContextResolver } from './orchestration/context-resolver.js';
import { ResponseCache } from './cache/response-cache.js';
import { simulatedArtifact, validateArtifact } from './contracts/artifacts.js';
import { createModelJudge } from './verification/judge.js';
import type { SemanticJudge } from './verification/engine.js';
import type { TrustTier } from './security/policy.js';
import { contractOf } from './contracts/task-contract.js';
import { parseAcceptance } from './contracts/acceptance.js';
import type { AgentRole, ExecutionMode, TaskPriority } from './contracts/task-contract.js';
import type { ExecuteCtx } from './orchestrator.js';
import type { ExecutionGraph, GraphNode, ModelSpec, RoutingContext, RoutingHints } from './types.js';

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
  /**
   * Desliga a consulta à memória e o ranking de skills por tarefa no
   * planejamento (volta ao Commander puramente léxico). Serve para depurar uma
   * decisão de plano sem o histórico interferindo.
   */
  noMemory?: boolean;
  /**
   * Diretório de entrega relativo à raiz do projeto (`--output`). Presente,
   * acrescenta ao plano o nó de tool que grava o resultado do run e verifica o
   * arquivo escrito. Ausente, nenhum nó recebe permissão de escrita.
   */
  output?: string;
  /** Levanta a forma do projeto num nó de tool na cabeça do grafo (`--survey`). */
  survey?: boolean;
  /**
   * Critérios de aceite do usuário, em texto (`--acceptance`, ou
   * `IzanagiRunOptions.acceptance`). Parseados por `parseAcceptance`: prefixo
   * conhecido vira check determinístico, prosa vira critério semântico.
   *
   * Entrada recusada não é descartada em silêncio: sai em
   * `PlanningOutput.acceptanceIssues`, para quem chamou poder dizer ao usuário
   * que o critério que ele escreveu não está sendo cobrado.
   */
  acceptance?: string[];
  /**
   * Roda o comando de teste do projeto no fim do grafo (`--verify-tests`).
   * Opt-in: executa um processo do projeto com o ambiente herdado.
   */
  verifyTests?: boolean;
  /**
   * Raiz do estado (`.izanagi/state`) consultado no planejamento. Default:
   * `baseDir`. Ver `OrchestratorOptions.stateDir` para o porquê da separação.
   */
  stateDir?: string;
}

/** Risco por prioridade do contrato. Prioridade alta é onde errar custa mais. */
const RISK_BY_PRIORITY: Record<TaskPriority, number> = {
  low: 0.1,
  normal: 0.2,
  high: 0.5,
  critical: 0.8,
};

/**
 * Deriva o `RoutingContext` DESTA tarefa a partir do contexto do run.
 *
 * O contexto do run era montado uma vez em `buildExecutionPlan` e usado em
 * todos os nós: `reasoningRequirement: 'medium'`, `risk: 0.2`, `tokenBudget` do
 * run inteiro e nenhum `historicalPerformance`. O `scoreModel` do router lê
 * todos esses campos — então metade dos critérios do roteamento estava
 * implementada e nunca era alimentada, e dentro de um run o modelo escolhido
 * era função só do papel.
 *
 * O que muda por nó, e por quê:
 * - `tokenBudget`: o teto de SAÍDA da tarefa (o que o nó realmente pede de
 *   janela), limitado pelo saldo do run. Com o teto do run inteiro, todo modelo
 *   de janela menor perdia 0.15 de score em toda tarefa, inclusive nas curtas.
 * - `risk`: da prioridade do contrato. Risco alto reduz o peso do custo no
 *   score, que é a decisão certa onde errar sai mais caro que a chamada.
 * - `reasoningRequirement`: do papel. `worker` é a tarefa barata por definição
 *   e não deve exigir raciocínio alto; `commander` deve.
 * - `requiresTools`: nó de tool declara isso no contrato.
 * - `historicalPerformance`: o que a memória mediu, já pronto no store.
 */
export function contextForNode(
  runContext: RoutingContext,
  node?: GraphNode,
  hints?: RoutingHints,
): RoutingContext {
  const contract = node ? contractOf(node) : undefined;
  const role = contract?.role;
  const nodeTokens = contract?.budget?.maxTokens ?? node?.tokenBudget;
  const ceiling = hints?.remainingTokens !== undefined && hints.remainingTokens > 0
    ? Math.min(nodeTokens ?? runContext.tokenBudget, hints.remainingTokens)
    : nodeTokens ?? runContext.tokenBudget;

  return {
    ...runContext,
    ...(contract?.objective ? { task: contract.objective } : {}),
    tokenBudget: Math.max(256, ceiling),
    ...(role
      ? {
          reasoningRequirement: role === 'commander' ? 'high' : role === 'worker' ? 'low' : 'medium',
          taskComplexity: runContext.taskComplexity,
        }
      : {}),
    ...(contract?.priority ? { risk: RISK_BY_PRIORITY[contract.priority] } : {}),
    ...(contract?.tool ? { requiresTools: true } : {}),
    ...(hints?.historicalPerformance && Object.keys(hints.historicalPerformance).length > 0
      ? { historicalPerformance: hints.historicalPerformance }
      : {}),
  };
}

export interface PlanningOutput {
  plan?: CommanderPlan;
  router: ModelRouter;
  routingContext: RoutingContext;
  /** Modelos do catálogo por id, para converter tokens em custo real. */
  specById: Map<string, ModelSpec>;
  capabilities: AgentCapabilityRegistry;
  routeRole: (role: AgentRole, node?: GraphNode, hints?: RoutingHints) => { model: string; provider: string } | undefined;
  costOf: (modelId: string, inputTokens: number, outputTokens: number) => number;
  /**
   * Replanejamento pelo Commander, pronto para o Orchestrator. Fecha sobre o
   * mesmo registro de capacidades usado no planejamento, então o Plano B
   * escolhe agente pelo mesmo critério do Plano A.
   */
  replan: (input: { graph: ExecutionGraph; failure: ReplanFailure }) => ReplanResult | null;
  /** Trust tier por agente, derivado da origem do arquivo no disco. */
  trustTierOf: (agentId: string) => TrustTier | undefined;
  /**
   * Critérios de aceite do usuário que NÃO entraram no plano, com o motivo.
   * Ausente quando todos entraram.
   */
  acceptanceIssues?: string[];
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

  // Memória e skills entram no PLANEJAMENTO, não só na execução: o Commander
  // passa a saber que padrão de falha existe para este objetivo e que skills
  // cada tarefa realmente pede. Leitura apenas — quem escreve é o Orchestrator.
  const memory = input.noCommander || input.noMemory ? undefined : new MemoryStore({ baseDir: input.stateDir ?? baseDir });
  const skillResolver = memory ? new SkillResolver({ baseDir, memory }) : undefined;

  const commander = new Commander();
  const commanderInput = {
    objective: input.objective,
    ...(input.explicitAgent && input.agent ? { agent: input.agent } : {}),
    ...(input.skillChain ? { skillChain: input.skillChain } : {}),
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
    ...(input.maxCostUsd !== undefined ? { maxCostUsd: input.maxCostUsd } : {}),
    capabilities,
    ...(memory ? { memory } : {}),
  };

  // Parseado antes do plano: um critério malformado precisa chegar a quem
  // chamou mesmo quando o Commander está desligado (`--no-commander`), senão a
  // recusa depende de um caminho que o usuário pode não estar usando.
  const parsedAcceptance = parseAcceptance(input.acceptance ?? []);

  const plan = input.noCommander
    ? undefined
    : commander.plan({
        objective: input.objective,
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.explicitAgent && input.agent ? { agent: input.agent } : {}),
        ...(input.skillChain ? { skillChain: input.skillChain } : {}),
        ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
        ...(input.maxCostUsd !== undefined ? { maxCostUsd: input.maxCostUsd } : {}),
        capabilities,
        ...(memory ? { memory } : {}),
        ...(skillResolver
          ? { resolveSkills: (objective: string, limit: number) => skillResolver.rankSkills(objective, limit).map((s) => s.alias) }
          : {}),
        ...(input.output ? { output: input.output } : {}),
        ...(input.survey ? { survey: true } : {}),
        ...(parsedAcceptance.criteria.length > 0 ? { acceptance: parsedAcceptance.criteria } : {}),
        ...(input.verifyTests ? { verifyTests: true } : {}),
        estimateCostUsd: (role, tokens) => router.estimateCostForRole(role, tokens),
      });

  return {
    ...(plan ? { plan } : {}),
    ...(parsedAcceptance.issues.length > 0 ? { acceptanceIssues: parsedAcceptance.issues } : {}),
    replan: ({ graph, failure }) => commander.replan({ graph }, failure, commanderInput),
    trustTierOf: (agentId: string) => capabilities.get(agentId)?.trustTier,
    router,
    routingContext,
    specById,
    capabilities,
    routeRole: (role: AgentRole, node?: GraphNode, hints?: RoutingHints) => {
      try {
        const routed = router.routeForRole(role, contextForNode(routingContext, node, hints));
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
    /** Cancelamento do run: o cliente combina com o próprio timeout HTTP. */
    signal?: AbortSignal;
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

    // O sinal do run desce até a requisição: sem ele, cancelar deixava a
    // chamada em voo consumindo cota de um run que ninguém mais espera.
    const result = await opts.client.complete(ctx.provider, {
      model: ctx.model,
      system,
      messages,
      maxTokens,
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    });

    // Só entra no cache a resposta que produz artefato VÁLIDO.
    //
    // Sem isto, uma resposta reprovada pela validação era gravada do mesmo
    // jeito. Na própria retentativa ela não voltava (a correção muda o system
    // prompt, e portanto a chave), mas o run SEGUINTE com o mesmo objetivo
    // recomeçava a partir da resposta que já se sabia ruim — e recomeçava
    // deterministicamente, sempre. Um cache que serve para economizar não pode
    // guardar o que já foi reprovado: o barato ali é repetir o erro.
    //
    // A validação é a mesma do Orchestrator e é memoizada por `(kind, hash)`,
    // então conferir aqui não paga uma segunda conta.
    const kind = node.outputs?.[0] ?? 'raw';
    if (validateArtifact(kind as never, result.text).valid) {
      opts.cache.set(key, result);
    }
    opts.onNode?.({
      nodeId: node.id,
      ...(ctx.nodeRole ? { role: ctx.nodeRole } : {}),
      model: result.model,
      tokens: result.tokens,
      cachedTokens: result.cachedTokens ?? 0,
      fromCache: false,
    });
    return { content: result.text, kind, tokens: result.tokens, model: result.model };
  };
}

/**
 * Producer headless: sem provider configurado, simula o artefato do nó.
 *
 * A simulação sai do schema real do kind (`simulatedArtifact`), e não de uma
 * forma genérica: antes, todo artefato tipado reprovava por campo obrigatório
 * ausente e o run terminava FAIL por um motivo que não era do runtime.
 */
export function createHeadlessProducer(objective: string): NodeProducer {
  return async (node: GraphNode) => {
    const label = node.agent ?? node.skills?.join('+') ?? node.id;
    const kind = node.outputs?.[0] ?? 'raw';
    return {
      content: simulatedArtifact(kind, { nodeId: node.id, label, objective }),
      kind,
      tokens: 300,
      model: 'cli-headless',
    };
  };
}

/* ============================ JUIZ SEMÂNTICO ============================ */

export interface SemanticJudgeWiring {
  client: ProducerLLMClient;
  /** Roteamento do papel `worker`: julgar é a tarefa barata por definição. */
  routeRole: (role: AgentRole, node?: GraphNode, hints?: RoutingHints) => { model: string; provider: string } | undefined;
  /** Teto de saída do juiz (default do `createModelJudge`). */
  maxTokens?: number;
}

/**
 * Juiz semântico default, compartilhado pela CLI e pelo SDK.
 *
 * Devolve `undefined` quando não há modelo utilizável — e isso é a resposta
 * honesta, não um erro: sem juiz, o critério semântico fica UNVERIFIED, que já
 * é o comportamento conservador correto da Verification Engine. O que não pode
 * acontecer é o critério passar a valer como aprovado.
 */
export function createSemanticJudge(wiring: SemanticJudgeWiring): SemanticJudge | undefined {
  // Nó sintético: `routeRole` recebe o nó só para políticas por nó; o juiz não
  // pertence a nenhum nó do grafo, e o papel é o que decide o modelo.
  const judgeNode = { id: 'semantic-judge', kind: 'validator', status: 'pending' } as GraphNode;
  const routed = wiring.routeRole('worker', judgeNode);
  if (!routed) return undefined;
  return createModelJudge({
    complete: async ({ system, user, maxTokens }) => {
      const result = await wiring.client.complete(routed.provider, {
        model: routed.model,
        system,
        messages: [{ role: 'user', content: user }],
        maxTokens,
      });
      return { text: result.text, tokens: result.tokens, model: result.model };
    },
    ...(wiring.maxTokens !== undefined ? { maxTokens: wiring.maxTokens } : {}),
  });
}
