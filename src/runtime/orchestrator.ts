/**
 * Orchestrator — runtime de execução adaptativa.
 *
 * Fluxo:
 *   Task → Classify → Plan (graph) → Route (score agents/skills/model)
 *   → Execute nodes (serial/paralelo por batches) → Validate artifacts
 *   → Evaluate → Heal (se falhar) → Reflect/Learn → Trace persistido.
 *
 * Este módulo é headless: a CLI (`izanagi run`) fornece o producer real
 * (prompt compilado) e o consumer dos artefatos; o runtime cuida do estado.
 */

import path from 'path';
import type {
  EvaluationReport,
  ExecutionGraph,
  GraphNode,
  HealingAction,
  RoutingHints,
  RunTrace,
} from './types.js';
import { TraceStore, Tracer } from './observability/tracer.js';
import type { IzanagiEvent } from './observability/events.js';
import { MemoryStore } from './memory/store.js';
import { EvaluationEngine } from './evaluation/engine.js';
import { Planner } from './orchestration/planner.js';
import { SkillResolver } from './routing/resolver.js';
import { Healer } from './recovery/healing.js';
import { LearningEngine } from './evolution/learning.js';
import { AgentCapabilityRegistry } from './registry/capabilities.js';
import { AgentFactory } from './factories/agent-factory.js';
import { SkillFactory } from './factories/skill-factory.js';
import { describeTrajectory, skillNameFor, type TrajectoryStep } from './evolution/trajectories.js';
import { ModelRouter } from './model/router.js';
import { validateArtifact, hashContent } from './contracts/artifacts.js';
import { PhaseTokenBudget, defaultWeights, type PhaseId } from './token/budget.js';
import { CheckpointStore, checkpointProgress, type CheckpointData } from './recovery/checkpoint.js';
import { ArtifactRegistry } from './artifacts/registry.js';
import { DecisionJournal } from './memory/decisions.js';
import { ApprovalStore } from './recovery/approvals.js';
import type { CommanderPlan, ReplanFailure, ReplanResult } from './orchestration/commander.js';
import { contractOf, type AgentRole, type ExecutionMode, type TaskContract } from './contracts/task-contract.js';
import { ContextResolver, type AvailableArtifact, type ResolvedContext } from './orchestration/context-resolver.js';
import { ExecutionBudget, type ExecutionBudgetLimits } from './token/execution-budget.js';
import { VerificationEngine, type SemanticJudge, type VerificationResult } from './verification/engine.js';
import { runWithConcurrency, DEFAULT_MAX_CONCURRENCY } from './orchestration/concurrency.js';
import { resolveDeadlineMs, withDeadline } from './orchestration/deadline.js';
import type { DegradationStep } from './token/execution-budget.js';
import { ConversationLog, type ConversationEntry } from './protocol/conversation.js';
import { ToolRegistry, type ToolContext } from './tools/registry.js';
import { resolveToolInput } from './tools/input-refs.js';
import { buildDeliverable } from './orchestration/delivery.js';
import {
  aggregateSubgraph,
  buildSubgraph,
  parseDecomposition,
  DEFAULT_MAX_ORCHESTRATION_DEPTH,
} from './orchestration/subgraph.js';
import type { PolicyEnvironment, TrustTier } from './security/policy.js';
import { formatCorrection, isBlocking, parseCritique, worstSeverity, type Critique } from './protocol/messages.js';

export interface OrchestratorOptions {
  baseDir: string;
  /**
   * Raiz do PROJETO do usuário. Default: o próprio `baseDir`, para que quem
   * já construía um `Orchestrator` continue com o comportamento exato de
   * antes — a CLI e o SDK declaram o valor certo, e nenhum caller existente
   * muda de comportamento sem pedir.
   *
   * Não é a mesma coisa que `baseDir`, e a diferença importa: `baseDir` é a
   * raiz do FRAMEWORK — `<projeto>/.agents` num projeto inicializado, ou a
   * própria instalação do pacote quando não há uma — e é onde vive
   * `.izanagi/state`. Rodando de dentro do checkout do framework as duas
   * coincidem, que é exatamente por que a confusão passava despercebida: um nó
   * `fs.read` lia dentro de `.agents/` em vez do projeto, e um check
   * `file-exists` procurava o arquivo no lugar errado.
   *
   * Tudo que é do PROJETO (sandbox de tool, entrega, existência de arquivo)
   * resolve contra este diretório. Tudo que é do RUNTIME (trace, artefatos,
   * checkpoints, memória) continua em `baseDir`.
   */
  workspaceDir?: string;
  /**
   * Onde vive o estado do run (`.izanagi/state`: trace, artefatos, memória,
   * checkpoints, aprovações, decisões). Default: `baseDir`, para que nenhum
   * caller existente mude de comportamento.
   *
   * Separado de `baseDir` porque as duas perguntas são diferentes: `baseDir`
   * responde "de onde leio agentes e skills?" e cai na instalação do pacote
   * quando o projeto não foi inicializado — o que está certo para assets e
   * errado para estado, que assim vazava entre projetos.
   */
  stateDir?: string;
  command: string;
  task: string;
  category: string;
  primaryAgent: string;
  skillChain: string[];
  /** Producer de artefato de um nó: recebe o nó e devolve conteúdo/resultado. */
  produce: (node: GraphNode, ctx: ExecuteCtx) => Promise<{ content: unknown; kind: string; tokens?: number; model?: string }> | { content: unknown; kind: string; tokens?: number; model?: string };
  /** Consumer de artefato validado (ex.: salvar em disco). */
  consume?: (node: GraphNode, artifact: { kind: string; content: unknown; valid: boolean }) => void;
  /**
   * Providers de LLM realmente utilizáveis no ambiente atual (ex.: com API key
   * configurada). Quando informado, restringe o catálogo do ModelRouter a
   * esses providers, então `ctx.provider`/`ctx.model` já saem prontos para uso
   * real — o caller não precisa rotear de novo nem aplicar fallback manual.
   */
  availableProviders?: string[];
  /** Retoma um run interrompido a partir do checkpoint salvo com este runId, em vez de planejar do zero. */
  resumeRunId?: string;
  verbose?: boolean;
  /** Observador em tempo real do Event System (run.started, healing.*, quality_gate.*, ...) — ver observability/events.ts. */
  onEvent?: (event: IzanagiEvent) => void;
  /**
   * Plano do Commander (modo + grafo + contratos + estimativa). Quando
   * presente, o Orchestrator executa ESTE grafo: nada de classificar e
   * planejar de novo. Ausente = caminho legado (Planner por categoria),
   * preservado byte-a-byte para quem já usa o Orchestrator direto.
   */
  plan?: CommanderPlan;
  /** Tetos de execução (custo, tempo, tool calls, agentes, retries). */
  budgetLimits?: Partial<ExecutionBudgetLimits>;
  /**
   * Allowlist de ids de tool para o run inteiro. Ausente (o default) significa
   * "sem allowlist": vale o que o contrato de cada tarefa autoriza, e nada
   * muda para quem já usa o Orchestrator. Presente, uma tool fora da lista
   * falha o nó ANTES de qualquer permissão ou política ser consultada.
   *
   * Lista VAZIA é uma allowlist vazia, não ausência: proíbe toda tool. A
   * diferença importa porque é a forma de declarar "este run não usa tool".
   */
  allowedTools?: string[];
  /**
   * Cancelamento cooperativo do run. Conferido no topo de cada batch e
   * repassado ao `produce()` por `ExecuteCtx.signal`, que o cliente de modelo
   * combina com o timeout HTTP: a requisicao em voo aborta de verdade em vez
   * de continuar consumindo cota de um run que ninguem mais espera.
   *
   * Cancelar NAO e' falhar por bug: o checkpoint do ultimo batch concluido
   * segue em disco, e `izanagi resume <run-id>` retoma dali.
   */
  signal?: AbortSignal;
  /** Juiz semântico opcional da Verification Engine. Sem juiz, critério semântico fica UNKNOWN. */
  judge?: SemanticJudge;
  /**
   * Replanejamento pelo Commander: recebe o grafo atual e o DELTA da falha, e
   * devolve um Plano B (agente trocado, papel acima, tarefa quebrada). Ausente
   * = `Planner.replan` legado, que reabre o nó sem mudar nada da estratégia.
   */
  replan?: (input: { graph: ExecutionGraph; failure: ReplanFailure }) => ReplanResult | null;
  /**
   * Ambiente para a Policy Engine avaliar nós `kind: 'tool'`. Default
   * `development`: o mais permissivo, porque é onde o framework roda por
   * padrão. Quem executa em CI ou produção precisa declarar.
   */
  environment?: PolicyEnvironment;
  /**
   * Trust tier de um agente, pela ORIGEM do arquivo dele (o
   * `AgentCapabilityRegistry` deriva do diretório). Sem esta função, um nó de
   * tool com agente declarado é tratado como `community` — o tier mais
   * restritivo —, porque presumir confiança não verificada é o erro caro aqui.
   */
  trustTierOf?: (agentId: string) => TrustTier | undefined;
  /**
   * Profundidade máxima de sub-orquestração (default 2). Uma tarefa que
   * descobre, executando, ser maior do que o plano previu pode abrir um
   * subgrafo próprio — mas o teto é do runtime, não do agente: recursão
   * decidida por quem está dentro dela não tem fim.
   */
  maxOrchestrationDepth?: number;
  /**
   * Onde gravar skill sintetizada de trajetória recorrente. Default:
   * `<cwd>/skills/generated` — o projeto do usuário, que é onde a skill
   * precisa viver para ser encontrada depois. Explícito porque um run de teste
   * não pode escrever no repositório de quem roda o teste.
   */
  generatedSkillsDir?: string;
  /**
   * Roteador por papel: devolve modelo/provider do papel de cada nó. Quando
   * ausente, todos os nós usam o modelo roteado uma vez para o run inteiro
   * (comportamento anterior).
   */
  routeRole?: (role: AgentRole, node?: GraphNode, hints?: RoutingHints) => { model: string; provider: string } | undefined;
  /**
   * Custo em USD de uma chamada. Sem esta função o runtime continua contando
   * tokens, mas o custo fica em 0 (não inventa preço de modelo desconhecido).
   */
  costOf?: (modelId: string, inputTokens: number, outputTokens: number) => number;
}

export interface ExecuteCtx {
  runId: string;
  task: string;
  category: string;
  primaryAgent: string;
  skillChain: string[];
  model: string;
  /** Provider do modelo roteado (ex.: 'anthropic') — mesma fonte de verdade do routing. */
  provider: string;
  trace: Tracer;
  memory: MemoryStore;
  artifacts: Map<string, { kind: string; content: unknown; valid: boolean; score: number }>;
  /** Token Budget 2.0 — orçamento por fase (planning/execution/evaluation/recovery). */
  budget: PhaseTokenBudget;
  /** Índice rastreável de artefatos (quem criou, hash, dependências, versão). */
  artifactRegistry: ArtifactRegistry;
  /** Human-in-the-loop: nós `kind: 'approval'` consultam este store. */
  approvals: ApprovalStore;
  /**
   * Contrato do nó em execução (Commander). Ausente no caminho legado.
   * O producer usa para saber objetivo, restrições e critérios de aceite.
   */
  contract?: TaskContract;
  /** Contexto mínimo já resolvido para o nó: objetivo + insumos resumidos. */
  nodeContext?: ResolvedContext;
  /** Papel do nó em execução (commander/specialist/worker). */
  nodeRole?: AgentRole;
  /** Budget Controller com custo, cache e escada de degradação. */
  execBudget?: ExecutionBudget;
  /**
   * Cancelamento cooperativo do run. O producer deve repassá-lo ao cliente de
   * modelo (`CompletionOptions.signal`); ignorá-lo não quebra nada, mas deixa a
   * requisição em voo depois do cancelamento.
   */
  signal?: AbortSignal;
  /**
   * Canal agente-a-agente do run. Toda mensagem carrega REFERÊNCIA de artefato,
   * nunca cópia de conteúdo: é o que separa uma equipe coordenada por contratos
   * de uma sala de reunião trocando textos longos.
   */
  conversation: ConversationLog;
  /** Críticas já interpretadas, por nó crítico (saída de `parseCritique`). */
  critiques: Map<string, Critique>;
  /**
   * Profundidade de sub-orquestração da tarefa em execução. 0 é o grafo do run;
   * uma sub-tarefa aberta por decomposição roda em 1.
   */
  depth: number;
}

export interface OrchestrationResult {
  trace: RunTrace;
  traceFile: string;
  graph: ExecutionGraph;
  evaluation?: EvaluationReport;
  healing: HealingAction[];
  /**
   * `HUMAN_REQUIRED` não é um veredito de qualidade: é o run que esgotou um
   * teto DECLARADO (tentativas, tempo, tokens ou custo) e parou por isso. O
   * `evaluation.verdict` do mesmo run continua `FAIL`, porque a entrega não
   * fechou; o que muda é o que fazer a seguir. Diferente de `BLOCKED`, não é
   * retomável por `izanagi approve`: exige uma decisão sobre o teto.
   */
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' | 'BLOCKED' | 'HUMAN_REQUIRED' | 'UNKNOWN';
  score: number;
  /**
   * Execução pausada aguardando decisão humana (`izanagi approve`/`reject`) —
   * quando presente, `status` é 'BLOCKED' mas não é um veredito final: o run
   * continua de onde parou assim que aprovado/rejeitado (via resumeRunId).
   */
  pendingApproval?: { nodeId: string; context?: string };
  /** Modo executado (presente quando veio de um plano do Commander). */
  mode?: ExecutionMode;
  /** Telemetria do Token Economy Engine. */
  telemetry?: ReturnType<ExecutionBudget['telemetry']>;
  /** Verificação por nó (Verification Engine 2.0). */
  verification?: Array<{ nodeId: string; result: VerificationResult }>;
  /** Log do protocolo agente-a-agente (task/result/critique/correction). */
  conversation?: ConversationEntry[];
}

export class Orchestrator {
  /**
   * Raiz do projeto do usuário, resolvida uma vez no construtor: o cwd do
   * processo pode mudar durante o run (um consumer que faz `chdir`), e a
   * sandbox de uma tool não pode depender de quando ela foi chamada.
   */
  private readonly workspaceDir: string;

  /** Raiz do estado do run. Ver `OrchestratorOptions.stateDir`. */
  private readonly stateDir: string;

  constructor(private readonly opts: OrchestratorOptions) {
    this.workspaceDir = path.resolve(opts.workspaceDir ?? opts.baseDir);
    this.stateDir = path.resolve(opts.stateDir ?? opts.baseDir);
  }

  /** Pontos de extensão (compatibilidade: permite injetar implementações). */
  private store?: TraceStore;
  private memory?: MemoryStore;
  private checkpointStore?: CheckpointStore;
  private artifactRegistry?: ArtifactRegistry;
  private decisionJournal?: DecisionJournal;
  private approvalStore?: ApprovalStore;
  private tokensUsed = 0;
  private verifier?: VerificationEngine;
  private contextResolver?: ContextResolver;
  private toolRegistry?: ToolRegistry;
  /** Verificação por nó (Verification Engine 2.0), preenchida durante a execução. */
  private readonly verifications = new Map<string, VerificationResult>();
  /**
   * Juiz semântico desligado no meio do run por orçamento de avaliação
   * esgotado. A partir daí, critério semântico fica UNVERIFIED — o mesmo que
   * acontece quando não há juiz configurado, e pelo mesmo motivo: ausência de
   * julgamento não é aprovação.
   */
  private judgeDisabled = false;

  /** Nós pulados por early stopping (objetivo já comprovado). */
  private readonly earlyStopped: string[] = [];
  /** Nós pulados por pressão de orçamento (degradação drop-optional-tasks). */
  private readonly budgetDropped: string[] = [];
  /**
   * Nós já reprovados UMA vez por crítica bloqueante. O crítico pode reprovar
   * um artefato e exigir correção, mas não pode reabrir o mesmo nó
   * indefinidamente: sem este teto, crítico e executor entram em ping-pong e o
   * orçamento vira o único freio.
   */
  private readonly critiqueRounds = new Set<string>();
  /**
   * Efeito ACUMULADO da escada de degradação. Cada passo aplicado muda um
   * destes campos, e o resto do executor consulta este estado. Sem isto, a
   * escada apenas registraria o passo sem mudar nada de fato na execução.
   */
  private readonly degradation = {
    /** Multiplicador do orçamento de contexto do Context Resolver. */
    contextScale: 1,
    /** Multiplicador do teto de saída (`node.tokenBudget`) dos nós pendentes. */
    outputScale: 1,
    /** Rebaixa o papel de cada nó um degrau ao rotear. */
    demoteModel: false,
    /** Teto de concorrência efetivo (undefined = o limite configurado). */
    concurrency: undefined as number | undefined,
    /** Corta tarefas opcionais ainda não executadas. */
    dropOptional: false,
    /** Exige aprovação humana antes do próximo batch. */
    requireApproval: false,
  };

  setStore(store: TraceStore): void {
    this.store = store;
  }

  setMemory(memory: MemoryStore): void {
    this.memory = memory;
  }

  setCheckpointStore(store: CheckpointStore): void {
    this.checkpointStore = store;
  }

  setArtifactRegistry(registry: ArtifactRegistry): void {
    this.artifactRegistry = registry;
  }

  setDecisionJournal(journal: DecisionJournal): void {
    this.decisionJournal = journal;
  }

  setApprovalStore(store: ApprovalStore): void {
    this.approvalStore = store;
  }

  /** Injeta uma ToolRegistry (com PolicyEngine próprio, se for o caso). */
  setToolRegistry(registry: ToolRegistry): void {
    this.toolRegistry = registry;
  }

  /** Executa o ciclo completo e retorna trace + avaliação. */
  async run(): Promise<OrchestrationResult> {
    const stateDir = this.stateDir;
    const store = this.store ?? new TraceStore({ baseDir: stateDir });
    const memory = this.memory ?? new MemoryStore({ baseDir: stateDir });
    const checkpoints = this.checkpointStore ?? new CheckpointStore({ baseDir: stateDir });
    const artifactRegistry = this.artifactRegistry ?? new ArtifactRegistry({ baseDir: stateDir });
    const decisions = this.decisionJournal ?? new DecisionJournal({ baseDir: stateDir });
    const approvals = this.approvalStore ?? new ApprovalStore({ baseDir: stateDir });
    const healing: HealingAction[] = [];
    const startedAt = Date.now();
    // Canal A2A do run. A primeira mensagem é o próprio pedido do usuário: o
    // log tem que começar onde o trabalho começa, não no primeiro nó.
    const conversation = new ConversationLog();
    conversation.record({ from: 'user', to: 'commander', type: 'task', taskId: 'run', summary: this.opts.task });

    // Resume: carrega o checkpoint salvo e pula planning/routing — reusa exatamente
    // o grafo, artefatos e modelo/provider da execução original interrompida.
    let resumed: CheckpointData | null = null;
    if (this.opts.resumeRunId) {
      resumed = checkpoints.load(this.opts.resumeRunId);
      if (!resumed) {
        throw new Error(`Orchestrator: nenhum checkpoint encontrado para o run "${this.opts.resumeRunId}" — não há o que retomar.`);
      }
    }

    const trace = new Tracer(store, { runId: resumed?.runId, task: this.opts.task, command: this.opts.command, onEvent: this.opts.onEvent });
    this.tokensUsed = resumed?.tokensUsed ?? 0;
    const tokensUsed = () => this.tokensUsed;

    // Model Routing — restringe ao que é realmente utilizável no ambiente, se informado.
    // Em resume, reusa o modelo/provider originais (sem round-trip de roteamento de novo).
    const complexity = ModelRouter.estimateComplexity(this.opts.task);
    let modelId: string;
    let providerId: string;
    if (resumed) {
      modelId = resumed.model;
      providerId = resumed.provider;
      trace.markTool(`model:${providerId}`);
      trace.span(`model-router:${modelId}`, 'decision', { reasons: ['retomado de checkpoint'] })();
    } else {
      const loadedProviders = ModelRouter.loadProjectProviders(this.opts.baseDir);
      const usableProviders = this.opts.availableProviders && this.opts.availableProviders.length > 0
        ? loadedProviders.filter((p) => this.opts.availableProviders!.includes(p.id))
        : loadedProviders;
      const router = new ModelRouter(usableProviders.length > 0 ? usableProviders : loadedProviders);
      const routed = router.route({
        task: this.opts.task,
        taskComplexity: complexity,
        reasoningRequirement: complexity >= 4 ? 'high' : complexity >= 3 ? 'medium' : 'low',
        risk: this.opts.category === 'security_audit' ? 0.8 : 0.2,
        tokenBudget: 16000,
        requiresTools: false,
        historicalPerformance: memory.historicalPerformance(),
      });
      modelId = routed.model.id;
      providerId = routed.provider;
      trace.markTool(`model:${providerId}`);
      trace.span(`model-router:${modelId}`, 'decision', { reasons: routed.reasons })();
      decisions.record({
        kind: 'model-routing',
        chosen: modelId,
        alternatives: routed.candidates,
        reason: routed.reasons.join('; '),
        runId: trace.runId,
        objective: this.opts.task,
      });
    }

    // Failure Memory check — padrões conhecidos antes de executar
    const closeMem = trace.span('memory:pattern-search', 'memory', { task: this.opts.task });
    const relevant = memory.findRelevantFailures(this.opts.task);
    closeMem(true);
    if (relevant.length > 0 && this.opts.verbose) {
      console.log(`  \x1b[33m⚠\x1b[0m ${relevant.length} padrão(ões) de falha conhecido(s) na memória (${relevant.map((p) => p.pattern).join(', ')})`);
    }

    // Planning — em resume, reusa o grafo já em progresso (não replaneja do zero).
    const planner = new Planner();
    let graph: ExecutionGraph;
    if (resumed) {
      graph = resumed.graph;
      const progress = checkpointProgress(resumed);
      trace.span('checkpoint:resume', 'decision', { done: progress.done, total: progress.total, pending: progress.pendingNodeIds })();
      if (this.opts.verbose) {
        console.log(`  \x1b[36m↻\x1b[0m Retomando run ${resumed.runId}: ${progress.done}/${progress.total} nós concluídos, pendentes: ${progress.pendingNodeIds.join(', ') || 'nenhum'}`);
      }
    } else if (this.opts.plan) {
      // Commander já decidiu modo, grafo e contratos. Replanejar aqui seria
      // desfazer a decisão e pagar de novo pelo planejamento.
      graph = this.opts.plan.graph;
      trace.span(`commander:${this.opts.plan.mode}`, 'decision', {
        mode: this.opts.plan.mode,
        reason: this.opts.plan.modeReason,
        nodes: graph.nodes.length,
        estimate: this.opts.plan.estimate,
      })();
      for (const decision of this.opts.plan.decisions) {
        decisions.record({
          kind: 'planning',
          chosen: this.opts.plan.mode,
          alternatives: [],
          reason: decision,
          runId: trace.runId,
          objective: this.opts.task,
        });
      }
      conversation.record({
        from: 'commander',
        to: 'scheduler',
        type: 'task',
        taskId: 'run',
        summary: `plano em modo ${this.opts.plan.mode} (${this.opts.plan.modeReason}): ${graph.nodes.length} tarefa(s) em ${graph.parallelBatches.length} etapa(s)`,
      });
      if (this.opts.verbose) {
        console.log(`  \x1b[35m▸\x1b[0m Commander: modo ${this.opts.plan.mode} (${this.opts.plan.modeReason}) — ${graph.nodes.length} tarefa(s)`);
      }
    } else {
      const closePlan = trace.span('planner', 'decision', { category: this.opts.category, complexity });
      try {
        graph = planner.plan({
          task: this.opts.task,
          category: this.opts.category,
          primaryAgent: this.opts.primaryAgent,
          skillChain: this.opts.skillChain,
        });
        closePlan();
      } catch (err) {
        closePlan(false, err instanceof Error ? err.message : String(err));
        throw err;
      }
    }

    // Adaptive routing: score agentes e skills
    const resolver = new SkillResolver({ baseDir: this.opts.baseDir, memory });
    const agentFactory = new AgentFactory(resolver);
    const agentScore = resolver.rankAgents(this.opts.task, agentIds(this.opts.baseDir), 3);
    if (agentScore.length === 0 || agentScore[0].finalScore < 0.25) {
      try {
        const drafted = agentFactory.generate({ requirement: this.opts.task });
        if (drafted.validation.valid && this.opts.verbose) {
          console.log(`  \x1b[35m⚡\x1b[0m Agent Factory gerou e validou agente especializado: ${drafted.genome.name}`);
        }
      } catch {
        // Ignora se não for possível gerar automaticamente
      }
    }
    if (agentScore.length > 0) {
      const best = agentScore[0];
      trace.markAgent(best.candidate);
      if (!resumed) {
        decisions.record({
          kind: 'agent-routing',
          chosen: best.candidate,
          alternatives: agentScore.map((c) => ({ option: c.candidate, score: c.finalScore, reason: c.reasons.join('; ') })),
          reason: best.reasons.join('; '),
          runId: trace.runId,
          // O objetivo é o que torna esta decisão recuperável depois: sem ele o
          // journal sabe O QUE foi escolhido e nunca PARA QUE.
          objective: this.opts.task,
        });
      }
      if (this.opts.verbose) {
        console.log(`  \x1b[32m✔\x1b[0m Adaptive routing: melhor agente ${best.candidate} (score ${best.finalScore}) — ${best.reasons.join(', ')}`);
      }
    }

    // Execution com self-healing
    const phaseBudget = new PhaseTokenBudget(graph.budget.maxTokens, defaultWeights(complexity));
    if (resumed) phaseBudget.restore(resumed.budgetSpent);
    // Budget Controller: custo/tempo/chamadas por cima do orçamento por fase,
    // compartilhando a MESMA instância de PhaseTokenBudget (uma conta só).
    const execBudget = new ExecutionBudget(
      {
        // O MENOR dos dois tetos, e não o do grafo sozinho: `budgetLimits`
        // vinha sendo honrado em custo, tempo, agentes, retries e tool calls,
        // mas `maxTokens` era descartado em silêncio. Quem passava um teto de
        // tokens pelo `Orchestrator` não recebia erro nem aviso — recebia o
        // teto do plano. Mínimo porque nenhum dos dois pode AFROUXAR o outro:
        // o teto de quem chama não é ampliado pelo plano, e o do plano não é
        // ampliado por um número maior de quem chama.
        maxTokens: Math.min(graph.budget.maxTokens, this.opts.budgetLimits?.maxTokens ?? Number.POSITIVE_INFINITY),
        maxTimeMs: this.opts.budgetLimits?.maxTimeMs ?? graph.budget.maxTimeMs,
        ...(this.opts.budgetLimits?.maxCostUsd !== undefined ? { maxCostUsd: this.opts.budgetLimits.maxCostUsd } : {}),
        ...(this.opts.budgetLimits?.maxAgents !== undefined ? { maxAgents: this.opts.budgetLimits.maxAgents } : {}),
        ...(this.opts.budgetLimits?.maxRetries !== undefined ? { maxRetries: this.opts.budgetLimits.maxRetries } : {}),
        ...(this.opts.budgetLimits?.maxToolCalls !== undefined ? { maxToolCalls: this.opts.budgetLimits.maxToolCalls } : {}),
      },
      complexity,
      startedAt,
      // MESMA instância de PhaseTokenBudget que `ctx.budget`: uma conta só de
      // token por run, senão o resumo por fase do trace divergiria da
      // telemetria de economia.
      phaseBudget,
    );
    if (resumed) {
      execBudget.restore({
        // `phaseBudget.restore` já foi aplicado acima na MESMA instância:
        // repetir aqui contaria o gasto retomado duas vezes.
        inputTokens: Math.round((resumed.tokensUsed ?? 0) * 0.7),
        outputTokens: (resumed.tokensUsed ?? 0) - Math.round((resumed.tokensUsed ?? 0) * 0.7),
      });
    }
    this.verifier = new VerificationEngine();
    this.contextResolver = new ContextResolver();
    const ctx: ExecuteCtx = {
      runId: trace.runId,
      task: this.opts.task,
      category: this.opts.category,
      primaryAgent: this.opts.primaryAgent,
      skillChain: this.opts.skillChain,
      model: modelId,
      provider: providerId,
      trace,
      memory,
      artifacts: new Map(
        resumed ? resumed.artifacts.map((a) => [a.nodeId, { kind: a.kind, content: a.content, valid: a.valid, score: a.score }]) : [],
      ),
      budget: phaseBudget,
      artifactRegistry,
      approvals,
      execBudget,
      conversation,
      critiques: new Map(),
      depth: 0,
      ...(this.opts.signal ? { signal: this.opts.signal } : {}),
    };

    let finalEvaluation: EvaluationReport | undefined;
    const healer = new Healer();
    let attempts = resumed?.attempts ?? 0;
    const maxAttempts = graph.budget.maxAttempts;
    let workingGraph = graph;

    while (attempts < maxAttempts) {
      attempts++;
      const currentAttempt = attempts;
      const failure = await this.executeBatches(workingGraph, ctx, (batchGraph) => {
        checkpoints.save(this.captureCheckpoint(trace.runId, batchGraph, ctx, currentAttempt));
      });
      checkpoints.save(this.captureCheckpoint(trace.runId, workingGraph, ctx, attempts));
      if (!failure) break;

      if (failure.blockedApproval) {
        // Não é falha: pausa aguardando decisão humana. Checkpoint já salvo acima;
        // persiste um trace parcial (sem evaluation — o run não terminou de verdade)
        // para que `izanagi trace`/`explain` consigam mostrar o estado atual.
        if (this.opts.verbose) {
          console.log(`  \x1b[33m⏸\x1b[0m Pausado aguardando aprovação humana no nó "${failure.nodeId}" — use "izanagi approve ${trace.runId}" ou "izanagi reject ${trace.runId}".`);
        }
        const partialTelemetry = execBudget.telemetry();
        const { trace: partialTrace, file } = trace.finishAndSave({
          graph: workingGraph,
          healing,
          artifacts: Array.from(ctx.artifacts.entries()).map(([id, a]) => ({ name: id, kind: a.kind as never, valid: a.valid })),
          model: modelId,
          budget: phaseBudget.summary(),
          ...(this.opts.plan ? { mode: this.opts.plan.mode } : {}),
          telemetry: partialTelemetry as unknown as Record<string, unknown>,
          ...(conversation.size > 0 ? { conversation: conversation.all() } : {}),
        });
        return {
          trace: partialTrace,
          traceFile: file,
          graph: workingGraph,
          healing,
          status: 'BLOCKED',
          score: 0,
          pendingApproval: { nodeId: failure.nodeId, context: failure.context },
          ...(this.opts.plan ? { mode: this.opts.plan.mode } : {}),
          // Um run pausado é o momento em que saber quanto já foi gasto mais
          // importa: sem isso, quem aprova decide no escuro.
          telemetry: partialTelemetry,
          ...(this.verifications.size > 0
            ? { verification: Array.from(this.verifications.entries()).map(([nodeId, result]) => ({ nodeId, result })) }
            : {}),
          ...(conversation.size > 0 ? { conversation: conversation.all() } : {}),
        };
      }

      // Token Budget 2.0: fase de recovery esgotada → aborta (impede loop)
      if (phaseBudget.exhausted('recovery')) {
        const node = workingGraph.nodes.find((n) => n.id === failure.nodeId);
        if (node) {
          node.status = 'failed';
          node.error = 'orçamento de tokens da fase recovery esgotado';
        }
        const abortHeal: HealingAction = {
          id: `heal-${Date.now().toString(36)}-${failure.nodeId}`,
          kind: 'abort',
          failureKind: 'non-recoverable',
          category: 'CONFIGURATION_FAILURE',
          message: 'orçamento de tokens da fase recovery esgotado — abortando',
          nodeId: failure.nodeId,
          createdAt: new Date().toISOString(),
          // Teto declarado, como os do `Healer`: o run parou onde foi
          // autorizado a parar, e o veredito precisa dizer isso.
          exhausted: 'tokens',
        };
        healing.push(abortHeal);
        trace.span(`healing:${abortHeal.kind}`, 'healing', { failureKind: abortHeal.failureKind, message: abortHeal.message })(false, abortHeal.message);
        break;
      }

      // Self-healing. O `Healer` é do RUN, não da rodada: ele guarda quais
      // padrões de falha já contou, e uma instância nova por rodada faria cada
      // retentativa recontar o mesmo incidente na memória.
      const elapsed = Date.now() - startedAt;
      trace.events.emit('diagnosis.started', { nodeId: failure.nodeId, error: failure.error });
      trace.events.emit('healing.started', { nodeId: failure.nodeId, attempt: attempts });
      const decision = healer.heal({
        nodeId: failure.nodeId,
        agent: failure.agent,
        skill: failure.skill,
        error: failure.error,
        attempt: attempts,
        maxAttempts,
        elapsedMs: elapsed,
        maxTimeMs: workingGraph.budget.maxTimeMs,
        tokensUsed: tokensUsed(),
        maxTokens: workingGraph.budget.maxTokens,
        // Custo já gasto e teto declarado: curar é decidir gastar mais uma
        // chamada, e essa decisão passa a consultar o dinheiro ANTES. O
        // `ExecutionBudget.spend` age depois da chamada, que é tarde demais
        // para não fazê-la.
        costUsd: execBudget.telemetry().estimatedCostUsd,
        ...(execBudget.limits.maxCostUsd !== undefined ? { maxCostUsd: execBudget.limits.maxCostUsd } : {}),
        memory,
      });
      healing.push(decision.action);
      trace.events.emit('diagnosis.completed', { nodeId: failure.nodeId, kind: decision.action.failureKind, category: decision.action.category });
      trace.events.emit('healing.completed', { nodeId: failure.nodeId, kind: decision.action.kind, category: decision.action.category });
      const closeHeal = trace.span(`healing:${decision.action.kind}`, 'healing', {
        failureKind: decision.action.failureKind,
        message: decision.action.message,
      });

      if (decision.action.kind === 'abort' || !decision.retryNow && !decision.replacement && decision.action.kind !== 'replan') {
        closeHeal(false, decision.abortReason ?? 'abort');
        // marca nó como falho e segue para avaliação
        const node = workingGraph.nodes.find((n) => n.id === failure.nodeId);
        if (node) node.status = 'failed';
        break;
      }

      // skill_replacement / handoff: aplica a substituição ao nó antes de reprocessar
      if ((decision.action.kind === 'skill_replacement' || decision.action.kind === 'handoff') && decision.replacement) {
        const node = workingGraph.nodes.find((n) => n.id === failure.nodeId);
        if (node) {
          if (decision.replacement.agent) node.agent = decision.replacement.agent;
          if (decision.replacement.skill) node.skills = [decision.replacement.skill];
          node.error = undefined;
        }
      }

      // replan: reconstrói o grafo. Com o Commander no circuito, o que volta é
      // um Plano B (agente trocado / papel acima / tarefa quebrada) e não o
      // Plano A com um nó reaberto.
      if (decision.action.kind === 'replan') {
        const failedNode = workingGraph.nodes.find((n) => n.id === failure.nodeId);
        const verification = this.verifications.get(failure.nodeId);
        const replanned = this.opts.replan
          ? this.opts.replan({
              graph: workingGraph,
              failure: {
                nodeId: failure.nodeId,
                error: failure.error,
                attempt: failedNode?.attempts ?? attempts,
                ...(verification && verification.unmet.length > 0 ? { unmet: verification.unmet } : {}),
                ...(ctx.artifacts.has(failure.nodeId) ? { artifactRef: `${ctx.runId}:${failure.nodeId}` } : {}),
                ...(failure.agent ? { agent: failure.agent } : {}),
              },
            })
          : null;
        if (replanned) {
          workingGraph = replanned.graph;
          for (const note of replanned.decisions) {
            decisions.record({ kind: 'planning', chosen: `replan:${failure.nodeId}`, alternatives: [], reason: note, runId: trace.runId });
          }
          conversation.record({
            from: 'commander',
            to: 'scheduler',
            type: 'task',
            taskId: failure.nodeId,
            summary: replanned.changes.length > 0
              ? `Plano B: ${replanned.changes.join(' | ')}`
              : 'replanejamento sem alternativa estrutural: nó reaberto como estava',
          });
          trace.span(`replan:${failure.nodeId}`, 'decision', {
            changes: replanned.changes,
            nodes: workingGraph.nodes.length,
          })(replanned.changes.length > 0, replanned.changes.length === 0 ? 'nenhuma alternativa estrutural disponível' : undefined);
          if (this.opts.verbose) {
            console.log(`  Replanejamento (${failure.nodeId}): ${replanned.changes.join(' | ') || 'sem alternativa estrutural'}`);
          }
        } else {
          workingGraph = planner.replan(workingGraph, failure.nodeId);
        }
        closeHeal();
        continue;
      }
      closeHeal();
    }

    // Evaluation final (também serve como Verification Loop: nenhum healing é dado como
    // bem-sucedido sem essa reavaliação — ver seção 5.7 do roadmap).
    const closeEval = trace.span('evaluation', 'evaluation');
    trace.events.emit('evaluation.started', {});
    trace.events.emit('verification.started', { healingRounds: healing.length });
    const evaluator = new EvaluationEngine();
    const artifacts = Array.from(ctx.artifacts.entries()).map(([id, a]) => {
      const record = ctx.artifactRegistry.get(`${ctx.runId}:${id}`);
      return {
        name: id,
        kind: a.kind as never,
        valid: a.valid,
        ...(record
          ? {
              id: record.id,
              producer: [record.producer.agent, record.producer.skill].filter(Boolean).join('/') || record.producer.nodeId,
              createdAt: record.createdAt,
              status: record.valid ? ('valid' as const) : ('invalid' as const),
            }
          : {}),
      };
    });
    // Testes: o EXIT CODE de `project.test` vence o artefato que um agente
    // escreveu. Enquanto `test-run` não existia, "os testes passaram" era o que
    // um `test-results` produzido pelo mesmo processo sob teste afirmava, e
    // nada no runtime executava teste nenhum. Com o nó ligado
    // (`--verify-tests`), a métrica vem do sistema operacional; sem ele, o
    // caminho antigo continua, agora declarado como derivado de artefato.
    const testRun = Array.from(ctx.artifacts.values()).find((a) => a.kind === 'test-run');
    const testRunContent = testRun?.content as { passed?: boolean; exitCode?: number | null; command?: string } | undefined;
    const executedTests = testRunContent?.passed;
    const testResults = Array.from(ctx.artifacts.values()).find((a) => a.kind === 'test-results');
    const testsFailed = executedTests !== undefined
      ? (executedTests ? 0 : 1)
      : testResults
        ? (testResults.content as { failed?: number }).failed ?? 0
        : 0;
    const scoredArtifacts = Array.from(ctx.artifacts.values()).filter((a) => a.valid);

    // Quando há Verification Engine em jogo, a correctness deixa de ser um
    // proxy do validador de schema e passa a refletir a fração de critérios de
    // aceite realmente comprovados.
    const verifiedScores = Array.from(this.verifications.values());
    const verifiedCorrectness = verifiedScores.length > 0
      ? verifiedScores.reduce((acc, v) => acc + v.score, 0) / verifiedScores.length
      : undefined;
    const unverified = verifiedScores.filter((v) => v.status !== 'VERIFIED');

    finalEvaluation = evaluator.buildReport({
      taskId: trace.runId,
      task: this.opts.task,
      agentId: this.opts.primaryAgent,
      metrics: {
        // correctness derivada do melhor artefato validado (score do validador),
        // não de métrica inventada
        correctness: verifiedCorrectness ?? (scoredArtifacts.length > 0
          ? Math.max(...scoredArtifacts.map((a) => a.score))
          : ctx.artifacts.has('implementation') ? 0.5 : 0.3),
        artifactValidity: artifacts.length > 0 ? artifacts.filter((a) => a.valid).length / artifacts.length : 0.3,
        security: this.opts.category === 'security_audit' ? 0.9 : undefined,
      },
      tests: { passed: testsFailed > 0 ? 0 : 1, failed: testsFailed },
      regressions: [
        ...(testsFailed > 0
          ? [
              executedTests !== undefined
                ? `suíte do projeto reprovada: "${testRunContent?.command ?? 'comando desconhecido'}" terminou com exit ${String(testRunContent?.exitCode)}`
                : `${testsFailed} teste(s) falhando (derivado do artefato test-results, NÃO de execução)`,
            ]
          : []),
        ...unverified.map((v) => `verificação não conclusiva: ${v.reason}`),
        // Nó que terminou em falha SEM produzir artefato era invisível para a
        // avaliação: `correctness` é a média das verificações registradas e
        // `artifactValidity` a razão dos artefatos existentes — as duas
        // ignoram quem não chegou a produzir nada. Na prática, um nó abortado
        // por permissão negada ou por tool recusada deixava o run terminar
        // PASS. Ausência de artefato num nó falho não é ausência de sinal: é o
        // sinal. `skipped` fica de fora de propósito (early stopping e corte
        // por orçamento são decisões do runtime, não falhas).
        // Nó opcional fica de fora: crítica adversarial e revisão extra são
        // reforço, e reforço que falha não invalida evidência que passou — é a
        // mesma regra do critério de aceite `optional`.
        ...workingGraph.nodes
          .filter((n) => n.status === 'failed' && contractOf(n)?.optional !== true)
          .map((n) => `nó "${n.id}" terminou em falha: ${n.error ?? 'motivo não registrado'}`),
      ],
      recommendations: this.critiqueRecommendations(ctx),
    });
    closeEval();
    trace.events.emit('evaluation.completed', { verdict: finalEvaluation.verdict, score: finalEvaluation.score });
    trace.events.emit('verification.completed', { verdict: finalEvaluation.verdict, score: finalEvaluation.score });
    trace.events.emit(
      finalEvaluation.verdict === 'PASS' || finalEvaluation.verdict === 'PASS_WITH_WARNINGS' ? 'quality_gate.passed' : 'quality_gate.failed',
      { verdict: finalEvaluation.verdict, score: finalEvaluation.score },
    );

    // Histórico de performance do modelo roteado (alimenta futuras decisões do router)
    memory.recordModelRun(modelId, {
      success: finalEvaluation.verdict === 'PASS' || finalEvaluation.verdict === 'PASS_WITH_WARNINGS',
      score: finalEvaluation.score,
      tokens: tokensUsed(),
    });

    // Learning
    const closeLearn = trace.span('learning', 'memory');
    const learning = new LearningEngine(memory);
    learning.process(finalEvaluation, {
      agentId: this.opts.primaryAgent,
      skillIds: this.opts.skillChain,
      tokens: tokensUsed(),
      // Domínios classificados pelo Commander: sem eles a estatística do agente
      // fica só global, e o planejamento não consegue distinguir "vai mal
      // nisto" de "vai mal em tudo".
      ...(this.opts.plan ? { domains: this.opts.plan.classification.domains } : {}),
    });
    closeLearn();

    // Trajetória: o caminho que ESTE run percorreu. O simétrico de converter
    // falha em padrão — sucesso também é conhecimento, e até aqui se perdia.
    this.recordTrajectory(memory, workingGraph, finalEvaluation, resolver);

    memory.save();

    // Run chegou a um veredito terminal (PASS/FAIL/...): não há mais o que
    // retomar, e o checkpoint sai do disco.
    //
    // A EXCEÇÃO é o run cancelado. Ele também termina num veredito terminal,
    // mas a premissa "não há mais o que retomar" é falsa justamente aí: quem
    // cancelou parou trabalho que ainda fazia sentido, o progresso do último
    // batch está gravado, e apagar o checkpoint tornaria `izanagi resume`
    // impossível no único caso em que ele é claramente o que se quer.
    if (this.opts.signal?.aborted) {
      if (this.opts.verbose) {
        console.log(`  Checkpoint preservado para retomar: izanagi resume ${trace.runId}`);
      }
    } else {
      checkpoints.delete(trace.runId);
    }

    // Trace persistido (com telemetria de economia e verificação por nó)
    const telemetry = execBudget.telemetry();
    const verificationSummary = Array.from(this.verifications.entries()).map(([nodeId, r]) => ({
      nodeId,
      status: r.status,
      score: r.score,
      reason: r.reason,
      unmet: r.unmet,
    }));
    const { trace: finalTrace, file } = trace.finishAndSave({
      graph: workingGraph,
      evaluation: finalEvaluation,
      healing,
      artifacts: artifacts.map((a) => ({ ...a, name: a.name })),
      model: modelId,
      budget: phaseBudget.summary(),
      ...(this.opts.plan ? { mode: this.opts.plan.mode } : {}),
      telemetry: telemetry as unknown as Record<string, unknown>,
      ...(verificationSummary.length > 0 ? { verification: verificationSummary } : {}),
      ...(conversation.size > 0 ? { conversation: conversation.all() } : {}),
    });

    if (this.opts.verbose) {
      console.log(`\n  \x1b[90mTrace salvo:\x1b[0m ${path.relative(this.opts.baseDir, file)}`);
      const usage = phaseBudget.usage();
      console.log(`  \x1b[90mToken budget por fase:\x1b[0m ${usage.map((u: { phase: string; spent: number; allocated: number; exhausted: boolean }) => `${u.phase}=${u.spent}/${u.allocated}${u.exhausted ? ' (max)' : ''}`).join('  ')}`);
      console.log(`  \x1b[90mToken economy:\x1b[0m ${ExecutionBudget.formatTelemetry(telemetry)}`);
      if (this.earlyStopped.length > 0) {
        console.log(`  \x1b[90mEarly stopping:\x1b[0m ${this.earlyStopped.length} tarefa(s) opcional(is) dispensada(s): ${this.earlyStopped.join(', ')}`);
      }
      if (this.budgetDropped.length > 0) {
        console.log(`  \x1b[90mCortadas por orçamento:\x1b[0m ${this.budgetDropped.join(', ')}`);
      }
      if (conversation.size > 0) {
        const byType = conversation.countByType();
        console.log(`  Protocolo A2A: ${conversation.size} mensagem(ns) (${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')})`);
      }
      if (finalEvaluation) {
        console.log(`  \x1b[90mAvaliação:\x1b[0m ${finalEvaluation.verdict} (score ${finalEvaluation.score.toFixed(2)})`);
      }
    }

    // Teto esgotado vira `HUMAN_REQUIRED`, não `FAIL`.
    //
    // Os dois terminavam idênticos, e são decisões diferentes de quem lê: um
    // run que estourou o orçamento chegou exatamente onde foi autorizado a
    // chegar, e o passo seguinte é subir o teto ou desistir; um run que falhou
    // por bug pede investigação. O veredito da AVALIAÇÃO continua `FAIL`,
    // porque ela mede a qualidade da entrega e a entrega não fechou: o que o
    // status carrega é o fato do processo, e os dois campos convivem no mesmo
    // resultado justamente por medirem coisas diferentes.
    const exhaustedLimit = healing.find((h) => h.exhausted);
    const status = exhaustedLimit && finalEvaluation.verdict === 'FAIL'
      ? ('HUMAN_REQUIRED' as const)
      : finalEvaluation.verdict;

    // Resultado carimbado nas decisões DESTE run. Sem isto o journal registra
    // escolhas e nunca as consequências delas, e uma escolha sem consequência
    // conhecida é log, não memória: não há como um planejamento futuro
    // aprender que aquela escolha, para aquele objetivo, não deu certo.
    const verifiedResults = Array.from(this.verifications.values());
    decisions.recordOutcome(trace.runId, {
      status,
      score: finalEvaluation.score,
      ...(verifiedResults.length > 0
        ? {
            verified: {
              passed: verifiedResults.filter((v) => v.status === 'VERIFIED').length,
              total: verifiedResults.length,
            },
          }
        : {}),
    });

    return {
      trace: finalTrace,
      traceFile: file,
      graph: workingGraph,
      evaluation: finalEvaluation,
      healing,
      status,
      score: finalEvaluation.score,
      ...(this.opts.plan ? { mode: this.opts.plan.mode } : {}),
      telemetry,
      ...(this.verifications.size > 0
        ? { verification: Array.from(this.verifications.entries()).map(([nodeId, result]) => ({ nodeId, result })) }
        : {}),
      ...(conversation.size > 0 ? { conversation: conversation.all() } : {}),
    };
  }

  /** Monta o snapshot persistível do progresso atual — chamado a cada rodada de batches. */
  private captureCheckpoint(runId: string, graph: ExecutionGraph, ctx: ExecuteCtx, attempts: number): CheckpointData {
    const budgetSpent = Object.fromEntries(
      ctx.budget.usage().map((u) => [u.phase, u.spent]),
    ) as Partial<Record<PhaseId, number>>;
    return {
      runId,
      task: this.opts.task,
      category: this.opts.category,
      primaryAgent: this.opts.primaryAgent,
      skillChain: this.opts.skillChain,
      model: ctx.model,
      provider: ctx.provider,
      graph,
      artifacts: Array.from(ctx.artifacts.entries()).map(([nodeId, a]) => ({ nodeId, ...a })),
      budgetSpent,
      attempts,
      tokensUsed: this.tokensUsed,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Executa os batches em ordem, respeitando paralelismo e retries.
   * Retorna a primeira falha não resolvida (ou null).
   *
   * `onBatchDone` persiste o progresso ao fim de CADA batch. O checkpoint era
   * salvo só depois de todos os batches terminarem, então um run interrompido
   * no meio do grafo (Ctrl-C, crash, queda de rede) descartava todos os nós já
   * concluídos daquela tentativa e o `izanagi resume` recomeçava a tentativa
   * inteira — pagando de novo chamadas de modelo que já tinham sido pagas. O
   * docstring de `captureCheckpoint` já dizia "chamado a cada rodada de
   * batches"; agora é verdade.
   */
  private async executeBatches(
    graph: ExecutionGraph,
    ctx: ExecuteCtx,
    onBatchDone?: (graph: ExecutionGraph) => void,
  ): Promise<{ nodeId: string; agent?: string; skill?: string; error: string; blockedApproval?: boolean; context?: string } | null> {
    for (const batch of graph.parallelBatches) {
      // Cancelamento cooperativo: conferido ANTES de despachar o batch, que é o
      // único ponto do laço onde parar não deixa trabalho pela metade. O
      // checkpoint do batch anterior já está em disco (`onBatchDone`), então
      // `izanagi resume` retoma daqui em vez de recomeçar a tentativa.
      if (this.opts.signal?.aborted) {
        const reason = abortReasonText(this.opts.signal);
        return {
          nodeId: batch[0] ?? 'run',
          error: `run cancelado${reason ? `: ${reason}` : ''} antes do batch [${batch.join(', ')}]`,
        };
      }

      // Early stopping: um nó opcional (crítica extra, revisão redundante) não
      // roda quando tudo que era obrigatório até aqui já está VERIFIED. Rodar
      // "porque o agente está disponível" é exatamente o desperdício que a
      // arquitetura proíbe.
      const runnable = batch.filter((nodeId) => {
        if (!this.shouldSkipOptional(graph, nodeId)) return true;
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.status = 'skipped';
          node.endedAt = new Date().toISOString();
          node.metadata = { ...node.metadata, skippedReason: 'early-stopping: objetivo já verificado' };
        }
        this.earlyStopped.push(nodeId);
        ctx.trace.span(`early-stop:${nodeId}`, 'decision', { reason: 'objetivo já verificado, tarefa opcional dispensada' })();
        return false;
      });
      // Degradação `drop-optional-tasks`: corta o que é reforço quando o
      // orçamento aperta, ANTES de gastar a chamada.
      const batchNodes = this.degradation.dropOptional
        ? runnable.filter((nodeId) => {
            const node = graph.nodes.find((n) => n.id === nodeId);
            if (!contractOf(node ?? ({} as GraphNode))?.optional) return true;
            if (node) {
              node.status = 'skipped';
              node.endedAt = new Date().toISOString();
              node.metadata = { ...node.metadata, skippedReason: 'degradação: tarefa opcional cortada por orçamento' };
            }
            this.budgetDropped.push(nodeId);
            ctx.trace.span(`budget:drop:${nodeId}`, 'decision', { reason: 'tarefa opcional cortada por pressão de orçamento' })();
            return false;
          })
        : runnable;
      if (batchNodes.length === 0) continue;

      // Degradação `require-human-approval`: pausa antes de continuar gastando.
      if (this.degradation.requireApproval) {
        this.degradation.requireApproval = false;
        const gateId = `budget-approval:${batchNodes[0]}`;
        const record = ctx.approvals.get(ctx.runId, gateId) ?? ctx.approvals.request(ctx.runId, gateId, 'orçamento próximo do teto: confirme para continuar gastando');
        if (record.decision === 'pending') {
          return { nodeId: gateId, error: 'orçamento próximo do teto: aguardando aprovação humana', blockedApproval: true, context: 'orçamento próximo do teto: confirme para continuar gastando' };
        }
        if (record.decision === 'rejected') {
          return { nodeId: gateId, error: `execução interrompida por decisão humana sob pressão de orçamento: ${record.reason ?? 'sem motivo informado'}` };
        }
      }

      batchNodes.forEach((nodeId) => ctx.trace.events.emit('node.started', { nodeId }));
      const limit = this.degradation.concurrency
        ?? this.opts.budgetLimits?.maxConcurrency
        ?? DEFAULT_MAX_CONCURRENCY;
      // Paralelismo EFETIVO, não o tamanho do batch. A contagem era feita antes
      // de o teto de concorrência entrar, então um batch de 5 com pool de 1
      // aparecia como "paralelo 5" — e isso acontecia justamente no caso da
      // degradação `reduce-parallelism`, ou seja, a telemetria afirmava o
      // paralelismo no exato momento em que o runtime tinha acabado de cortá-lo.
      ctx.execBudget?.recordParallelBatch(Math.min(batchNodes.length, limit));
      const settled = await runWithConcurrency(
        batchNodes.map((nodeId) => () => this.executeNode(graph, nodeId, ctx)),
        limit,
      );
      // O pool nunca rejeita: uma tarefa que lançou vira `{ ok: false }` e é
      // convertida aqui no mesmo formato de erro que `executeNode` produz, para
      // que o caminho de healing a jusante não mude.
      const results = settled.map((r, i) => {
        if (r.ok) return r.value;
        const nodeId = batchNodes[i];
        const node = graph.nodes.find((n) => n.id === nodeId);
        const message = r.error instanceof Error ? r.error.message : String(r.error);
        if (node) {
          node.status = 'failed';
          node.error = message;
        }
        return { status: 'error' as const, nodeId, ...(node?.agent ? { agent: node.agent } : {}), error: message };
      });
      results.forEach((r, i) => ctx.trace.events.emit('node.completed', { nodeId: batchNodes[i], status: r?.status ?? 'ok' }));
      const blocked = results.find((r) => r && r.status === 'blocked_approval') as
        | { nodeId: string; error?: string; status: string; context?: string }
        | undefined;
      if (blocked) {
        return { nodeId: blocked.nodeId, error: blocked.error ?? 'aguardando aprovação humana', blockedApproval: true, context: blocked.context };
      }
      // Progresso persistido ANTES de decidir sobre a falha: o que já terminou
      // neste batch não deve ser perdido porque um irmão falhou.
      onBatchDone?.(graph);
      const firstFailure = results.find((r) => r && r.status === 'error') as
        | { nodeId: string; agent?: string; skill?: string; error: string; status: string }
        | undefined;
      if (firstFailure) {
        return { nodeId: firstFailure.nodeId, agent: firstFailure.agent, skill: firstFailure.skill, error: firstFailure.error };
      }
    }
    return null;
  }

  private async executeNode(
    graph: ExecutionGraph,
    nodeId: string,
    ctx: ExecuteCtx,
  ): Promise<
    | { status: 'ok' | 'error' | 'blocked_approval'; nodeId: string; agent?: string; skill?: string; error?: string; context?: string }
    | undefined
  > {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return undefined;
    if (node.status === 'succeeded' || node.status === 'skipped') return undefined;

    node.status = 'running';
    node.startedAt = new Date().toISOString();
    node.attempts = (node.attempts ?? 0) + 1;

    // Retentativa: reexecução de um nó que já rodou e falhou. Contada ANTES de
    // gastar a chamada, pelo mesmo motivo do teto de tool calls: recusar por
    // teto depois de pagar o modelo é contabilizar um gasto que não deveria ter
    // acontecido. `recordRetry()` existia desde a v3.14.0 sem nenhum caller de
    // produção, e por isso `telemetry.retries`, `RunTrace.retries` e o teto
    // `budgetLimits.maxRetries` (plumbado do SDK até aqui) eram estruturalmente
    // mortos: o número saía 0 em `izanagi budget` e em `izanagi trace` mesmo
    // num run que tinha retentado. Mesma família de "número que se reporta é
    // número que aconteceu".
    //
    // Aprovação pendente não conta: o ramo `pending` devolve a tentativa
    // (`node.attempts - 1`), então esperar decisão humana nunca chega aqui com
    // `attempts > 1`.
    const isRetry = (node.attempts ?? 0) > 1;
    const retryWithinBudget = isRetry ? ctx.execBudget?.recordRetry() ?? true : true;

    const label = node.agent ?? node.skills?.join('+') ?? node.kind;
    if (node.agent) ctx.trace.markAgent(node.agent);
    if (node.skills) node.skills.forEach((s) => ctx.trace.markSkill(s));
    const closeSpan = ctx.trace.span(`node:${node.id}`, node.kind === 'evaluator' ? 'evaluation' : node.kind === 'agent' ? 'agent' : 'tool', {
      label,
      attempt: node.attempts,
      ...(isRetry ? { retry: true } : {}),
    });

    if (!retryWithinBudget) {
      node.status = 'failed';
      node.error = `teto de retentativas do run excedido (maxRetries) antes de reexecutar "${node.id}"`;
      closeSpan(false, node.error);
      return { status: 'error', nodeId: node.id, error: node.error };
    }

    try {
      if (node.kind === 'approval') {
        // Human-in-the-loop: só passa com decisão explícita via izanagi approve/reject.
        const depId = (node.dependencies ?? [])[0];
        const artifact = depId ? ctx.artifacts.get(depId) : undefined;
        if (depId && !(artifact?.valid ?? false)) {
          node.status = 'failed';
          node.error = `approval "${node.id}" falhou: artefato de "${depId}" inválido`;
          closeSpan(false, node.error);
          return { status: 'error', nodeId: node.id, error: node.error };
        }
        const context = typeof node.metadata?.context === 'string' ? node.metadata.context : node.validator;
        const record = ctx.approvals.get(ctx.runId, node.id) ?? ctx.approvals.request(ctx.runId, node.id, context);
        if (record.decision === 'approved') {
          node.status = 'succeeded';
          closeSpan(true, `aprovado por ${record.decidedBy ?? 'humano'}`);
          return { status: 'ok', nodeId: node.id };
        }
        if (record.decision === 'rejected') {
          node.status = 'failed';
          node.error = `approval "${node.id}" rejeitada: ${record.reason ?? 'sem motivo informado'}`;
          closeSpan(false, node.error);
          return { status: 'error', nodeId: node.id, error: node.error };
        }
        // pending: não é falha nem sucesso — pausa a execução sem consumir tentativa.
        node.status = 'pending';
        node.attempts = Math.max(0, (node.attempts ?? 1) - 1);
        closeSpan(false, 'aguardando aprovação humana');
        return { status: 'blocked_approval', nodeId: node.id, context };
      }

      if (node.kind === 'gate') {
        // Gate: valida artefato de dependências
        const depId = (node.dependencies ?? [])[0];
        const artifact = depId ? ctx.artifacts.get(depId) : undefined;
        const valid = artifact?.valid ?? false;
        if (valid) {
          node.status = 'succeeded';
          closeSpan(true);
          return { status: 'ok', nodeId: node.id };
        }
        node.status = 'failed';
        node.error = `gate "${node.id}" falhou: artefato de "${depId}" inválido`;
        closeSpan(false, node.error);
        return { status: 'error', nodeId: node.id, error: node.error, skill: node.validator };
      }

      // Contrato + contexto mínimo + papel: tudo que o producer precisa saber
      // sobre ESTA tarefa, sem receber o run inteiro.
      const contract = contractOf(node);
      const role: AgentRole = contract?.role ?? 'specialist';
      ctx.contract = contract;
      ctx.nodeRole = role;
      // Correção pendente de uma crítica bloqueante: quando existe, o contexto
      // desta rodada é dirigido (entrega anterior + lista de correções), não os
      // insumos do grafo de novo.
      const correction = typeof node.metadata?.correction === 'string' ? node.metadata.correction : undefined;
      // Decomposição em execução só é oferecida quando o contrato permite E
      // ainda há profundidade: prometer no prompt o que o runtime vai recusar
      // gasta a chamada para nada.
      const maxDepth = this.opts.maxOrchestrationDepth ?? DEFAULT_MAX_ORCHESTRATION_DEPTH;
      const canDecompose = contract?.decomposable === true && ctx.depth < maxDepth;
      ctx.nodeContext = contract && this.contextResolver
        ? this.contextResolver.resolve(contract, this.availableArtifacts(ctx), {
            ...(correction ? { correction } : {}),
            ...(canDecompose ? { decomposable: true } : {}),
          })
        : undefined;
      // Degradação `reduce-output`: aperta o teto de saída dos nós que ainda
      // vão rodar. É o efeito real do degrau, não só o registro dele.
      if (this.degradation.outputScale < 1 && node.tokenBudget) {
        node.tokenBudget = Math.max(256, Math.floor(node.tokenBudget * this.degradation.outputScale));
      }
      if (ctx.nodeContext) {
        ctx.execBudget?.recordContextSaving(Math.max(0, ctx.nodeContext.upstreamCharsFull - ctx.nodeContext.upstreamChars));
      }

      // Roteamento por papel: worker não paga preço de commander. Numa
      // retentativa, o papel ESCALA (worker vira specialist, specialist vira
      // commander) em vez de repetir o mesmo modelo que já falhou.
      if (this.opts.routeRole) {
        let effectiveRole = role;
        const attempts = node.attempts ?? 1;
        for (let i = 1; i < attempts; i++) {
          const next = ModelRouter.escalateRole(effectiveRole);
          if (!next) break;
          effectiveRole = next;
        }
        if (effectiveRole !== role) {
          ctx.execBudget?.recordEscalation();
          ctx.trace.span(`escalation:${node.id}`, 'decision', { from: role, to: effectiveRole, attempt: node.attempts })();
        }
        // Degradação `downgrade-model`: rebaixa um degrau. Aplicada DEPOIS da
        // escalada de propósito: sob pressão de orçamento, uma retentativa que
        // escalaria volta ao papel original em vez de subir.
        if (this.degradation.demoteModel) {
          const demoted = ModelRouter.demoteRole(effectiveRole);
          if (demoted) {
            ctx.trace.span(`degradation:demote:${node.id}`, 'decision', { from: effectiveRole, to: demoted })();
            effectiveRole = demoted;
          }
        }
        // Hints que só existem DURANTE a execução: saldo do orçamento e
        // histórico medido por modelo. O `scoreModel` do router lê os dois e
        // nunca os recebia — o contexto de roteamento era montado uma vez no
        // início do run e reusado em todo nó.
        const routed = this.opts.routeRole(effectiveRole, node, {
          ...(ctx.execBudget ? { remainingTokens: ctx.execBudget.remainingTokens } : {}),
          ...(this.memory ? { historicalPerformance: this.memory.historicalPerformance() } : {}),
        });
        if (routed) {
          ctx.model = routed.model;
          ctx.provider = routed.provider;
          ctx.nodeRole = effectiveRole;
          node.model = routed.model;
        }
      }
      // Teto de agentes do Budget Controller, ANTES de gastar a chamada. O
      // retorno de `recordAgent` era descartado, então `maxAgents` contava
      // agentes distintos e não barrava nenhum: teto que conta e não limita é
      // a mesma classe de teto morto que `maxRetries` era.
      if (node.agent && ctx.execBudget && !ctx.execBudget.recordAgent(node.agent)) {
        node.status = 'failed';
        node.error = `teto de agentes distintos do run excedido (maxAgents) antes de acionar "${node.agent}"`;
        closeSpan(false, node.error);
        return { status: 'error', nodeId: node.id, agent: node.agent, error: node.error };
      }

      // A2A: a tarefa é despachada como MENSAGEM tipada, com referência aos
      // artefatos de entrada. O conteúdo dos insumos não entra aqui — já está
      // no contexto mínimo, e duplicá-lo no log seria uma segunda cópia do run.
      ctx.conversation.record({
        from: 'commander',
        to: node.agent ?? node.id,
        type: 'task',
        taskId: node.id,
        summary: correction
          ? `retentativa dirigida de "${node.id}" com correções da crítica`
          : contract?.objective ?? `executar "${node.id}" (${node.kind})`,
        artifactRefs: (ctx.nodeContext?.upstream ?? []).map((u) => u.ref).filter((r): r is string => Boolean(r)),
      });

      // Nó de tool NÃO chama modelo: roteia por `ToolRegistry`, que aplica
      // permissão declarada no contrato, política e sandbox antes de executar.
      // Tudo a jusante (validação, registro, verificação, A2A) é o mesmo
      // caminho de um nó de agente — o que muda é quem produziu.
      // Prazo do nó: o plano declara `node.timeoutMs` e o contrato
      // `budget.maxTimeMs` em todo caminho de planejamento, e nada os aplicava.
      // O menor dos dois vale. Interrompe a ESPERA, não o trabalho em voo — o
      // limite está declarado em `orchestration/deadline.ts`.
      const deadlineMs = resolveDeadlineMs([contract?.budget?.maxTimeMs, node.timeoutMs]);
      let result = await withDeadline(
        // `produce` pode ser síncrono (producer headless, teste): `resolve`
        // normaliza sem mudar o contrato de quem implementa.
        async () => (isToolNode(node, contract)
          ? this.executeTool(node, contract, ctx, graph)
          : this.opts.produce(node, ctx)),
        deadlineMs,
        node.id,
        this.opts.signal,
      );
      if (result.tokens) {
        this.tokensUsed += result.tokens;
        // Retry consome a fase recovery, não execution
        const phase = node.attempts && node.attempts > 1 ? 'recovery' : 'execution';
        // Budget Controller é a fonte única: ele gasta no MESMO PhaseTokenBudget
        // e ainda aplica os tetos de custo e tempo.
        const modelId = result.model ?? ctx.model;
        const inputTokens = Math.round(result.tokens * 0.7);
        // O trace recebe o MESMO total que o orçamento cobra, dividido pela
        // mesma razão. Antes recebia `(total, total * 0.6)`, e `addTokens` soma
        // os dois: o trace do run inteiro saía 60% acima do que a telemetria do
        // mesmo run registrava, porque `result.tokens` é o total do provider
        // (`usage.total_tokens`, `input+output`, `totalTokenCount`) e a linha
        // tratava esse total como se fosse só a entrada. É o número que a CLI
        // imprime no fim do run, que `izanagi trace` mostra, que o dashboard
        // exibe, que o webhook envia e que a Arena soma. Duas linhas abaixo, o
        // custo já usava o valor como total; o juiz semântico, no mesmo
        // arquivo, sempre passou um split que fecha com o total.
        ctx.trace.addTokens(inputTokens, result.tokens - inputTokens);
        const costUsd = this.opts.costOf ? this.opts.costOf(modelId, inputTokens, result.tokens - inputTokens) : 0;
        const spend = ctx.execBudget
          ? ctx.execBudget.spend({ phase, tokens: result.tokens, costUsd, model: modelId })
          : { ok: ctx.budget.spend(phase, result.tokens), reason: `orçamento de tokens da fase ${phase} excedido` };
        if (!spend.ok) {
          node.status = 'failed';
          node.error = spend.reason ?? `orçamento de tokens da fase ${phase} excedido`;
          closeSpan(false, node.error);
          return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
        }
        // Aplica TODOS os degraus que a pressão atual justifica, de uma vez.
        for (const step of ctx.execBudget?.pendingDegradations() ?? []) {
          this.applyDegradation(step, graph, ctx);
        }
      }
      if (result.model) ctx.trace.markTool(`model:${result.model}`);

      // Sub-orquestração: o nó devolveu um PEDIDO de decomposição em vez de um
      // artefato. O subgrafo roda aqui, com o orçamento dividido do próprio nó,
      // e o artefato do pai passa a ser a agregação do que os filhos
      // entregaram. Só é considerado quando o contrato permite: fora disso, um
      // JSON com "decompose" é conteúdo comum e segue para validação.
      if (canDecompose) {
        const request = parseDecomposition(result.content);
        if (request) {
          const sub = await this.runSubgraph(node, request, ctx, maxDepth);
          if (sub) {
            result = { ...result, content: sub.content, kind: node.outputs?.[0] ?? 'raw' };
          }
        }
      }

      // Validação de artefato
      const validation = validateArtifact(result.kind as never, result.content);
      ctx.artifacts.set(node.id, { kind: result.kind, content: result.content, valid: validation.valid, score: validation.score });
      this.opts.consume?.(node, { kind: result.kind, content: result.content, valid: validation.valid });

      // Artifact Registry: rastreabilidade (produtor, hash, dependências, versão em replan/retry)
      const artifactText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content ?? {});
      ctx.artifactRegistry.register({
        kind: result.kind,
        name: node.id,
        producer: { runId: ctx.runId, nodeId: node.id, agent: node.agent, skill: node.skills?.[0] },
        hash: hashContent(artifactText),
        size: artifactText.length,
        valid: validation.valid,
        score: validation.score,
        dependencies: (node.dependencies ?? []).map((depId) => `${ctx.runId}:${depId}`),
        // Conteúdo vai para o content store: sem isso o artefato morre com o
        // processo e `izanagi explain` só consegue mostrar metadado.
        content: result.content,
      });

      // Sem contrato (caminho legado), a validação de schema é o portão. Com
      // contrato, quem decide é a Verification Engine logo abaixo, que já
      // executa `artifact-valid` como um dos critérios: manter os dois portões
      // faria a mesma reprovação acontecer duas vezes e esconderia o relatório
      // de verificação justamente no caso em que ele é mais útil.
      if (!validation.valid && !contract) {
        node.status = 'failed';
        node.error = `validação falhou: ${validation.issues.slice(0, 3).join('; ')}`;
        closeSpan(false, node.error);
        return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
      }

      // Verification Engine 2.0: "o agente entregou" não basta. Só existe
      // conclusão quando os critérios de aceite do contrato são comprovados.
      let verification: VerificationResult | undefined;
      if (contract && this.verifier) {
        verification = await this.verifier.verify({
          contract,
          content: result.content,
          artifacts: new Map(Array.from(ctx.artifacts.entries()).map(([id, a]) => [id, { kind: a.kind, content: a.content, valid: a.valid }])),
          baseDir: this.workspaceDir,
          ...(this.opts.judge && !this.judgeDisabled ? { judge: this.opts.judge } : {}),
        });
        this.verifications.set(node.id, verification);
        // Julgar custa token. A conta entra na fase `evaluation`, não na
        // `execution`: verificar não é produzir, e misturar as duas esconderia
        // o preço real da verificação semântica na telemetria.
        if (verification.judgeTokens > 0) {
          const judgeModel = verification.judgeModel ?? ctx.model;
          const judgeInput = Math.round(verification.judgeTokens * 0.85);
          const judgeSpend = ctx.execBudget?.spend({
            phase: 'evaluation',
            tokens: verification.judgeTokens,
            costUsd: this.opts.costOf ? this.opts.costOf(judgeModel, judgeInput, verification.judgeTokens - judgeInput) : 0,
            model: judgeModel,
          });
          ctx.trace.addTokens(judgeInput, verification.judgeTokens - judgeInput);
          this.tokensUsed += verification.judgeTokens;
          // O resultado do gasto do juiz era IGNORADO: com a fase `evaluation`
          // esgotada, cada nó seguinte continuava chamando o juiz, e o
          // orçamento de avaliação virava um teto sem efeito. Desligar o juiz
          // aqui é o certo: critério semântico volta a ficar UNVERIFIED, que é
          // o conservador correto — nunca aprovação por omissão. Reprovar o nó
          // seria pior: o trabalho dele não tem culpa do orçamento de
          // verificação ter acabado.
          if (judgeSpend && !judgeSpend.ok && !this.judgeDisabled) {
            this.judgeDisabled = true;
            ctx.trace.span('budget:judge-off', 'decision', {
              reason: judgeSpend.reason ?? 'orçamento de avaliação esgotado',
            })(false, judgeSpend.reason);
            if (this.opts.verbose) {
              console.log(`  \x1b[33m⚠\x1b[0m Juiz semântico desligado: ${judgeSpend.reason}`);
            }
          }
        }
        ctx.trace.span(`verification:${node.id}`, 'evaluation', {
          status: verification.status,
          score: verification.score,
          reason: verification.reason,
        })(verification.status !== 'FAILED', verification.status === 'FAILED' ? verification.reason : undefined);
        // Evento POR TAREFA: quem observa o run em tempo real não tinha como
        // saber que um nó reprovou — `quality_gate.*` é do veredito final, e
        // `result.verification` só existe depois do await.
        ctx.trace.events.emit(
          verification.status === 'FAILED' ? 'task.verification.failed' : 'task.verification.passed',
          {
            nodeId: node.id,
            status: verification.status,
            score: verification.score,
            ...(node.agent ? { agent: node.agent } : {}),
            ...(verification.unmet.length > 0 ? { unmet: verification.unmet } : {}),
          },
        );
        if (verification.status === 'FAILED') {
          node.status = 'failed';
          node.error = `verificação falhou: ${verification.unmet.slice(0, 3).join('; ')}`;
          closeSpan(false, node.error);
          return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
        }
        // `UNVERIFIED` não é reprovação (nada falhou) e não é aprovação (nem
        // tudo foi comprovado). O nó segue como `succeeded` de propósito: sem
        // juiz semântico — o caso default sem provider, e o de `--no-judge` —
        // todo critério semântico fica sem evidência conclusiva, e derrubar o
        // nó transformaria "não medi" em "está errado".
        //
        // O que faltava era o nó CARREGAR esse fato. Sem isto, um nó aprovado
        // sem prova era indistinguível de um comprovado para quem lê o grafo, e
        // `VerificationEngine.isDone` — a função que existe justamente para
        // dizer o que conta como concluído — não tinha nenhum caller.
        if (!VerificationEngine.isDone(verification)) {
          node.metadata = {
            ...node.metadata,
            unverified: {
              status: verification.status,
              reason: verification.reason,
              unmet: verification.unmet.slice(0, 5),
            },
          };
          ctx.conversation.record({
            from: node.agent ?? node.id,
            to: 'commander',
            type: 'evidence',
            taskId: node.id,
            summary: `concluído SEM prova (${verification.status}): ${verification.reason}`,
            confidence: verification.score,
          });
          if (this.opts.verbose) {
            console.log(`  ~ ${node.id}: concluído sem evidência conclusiva: ${verification.reason}`);
          }
        }
      }

      // Regression Protection: uma correção de healing não pode piorar o artifact
      // em relação à versão anterior (score menor ou virar inválido).
      const regression = ctx.artifactRegistry.detectRegression(`${ctx.runId}:${node.id}`);
      if (regression.regressed) {
        node.status = 'failed';
        node.error = `regressão detectada (invalid artifact regression): score ${regression.currentScore} < ${regression.previousScore} na versão anterior`;
        closeSpan(false, node.error);
        return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
      }

      node.status = 'succeeded';
      node.endedAt = new Date().toISOString();
      node.durationMs = Date.now() - Date.parse(node.startedAt!);
      // A correção já foi aplicada nesta rodada: mantê-la faria a próxima
      // execução do nó pedir de novo um conserto que já aconteceu.
      if (correction && node.metadata) delete node.metadata.correction;
      closeSpan(true);

      ctx.conversation.record({
        from: node.agent ?? node.id,
        to: 'commander',
        type: 'result',
        taskId: node.id,
        summary: `${result.kind} produzido (${artifactText.length} chars, ${validation.valid ? 'válido' : 'inválido'}${verification ? `, ${verification.status}` : ''})`,
        artifactRefs: [`${ctx.runId}:${node.id}`],
        ...(verification ? { confidence: verification.score } : {}),
      });

      // Crítica estruturada: a saída do crítico não é um texto para arquivar,
      // é a entrada de uma decisão de runtime. Interpretada aqui, ela reprova o
      // nó criticado e devolve a correção mínima — em vez de virar um artefato
      // que ninguém lê (que era o comportamento até aqui).
      if (result.kind === 'critique') {
        const redirected = this.interpretCritique(graph, node, result.content, ctx);
        if (redirected) return redirected;
      }
      return { status: 'ok', nodeId: node.id };
    } catch (err) {
      // Tool que a política manda submeter a uma pessoa: pausa por aprovação,
      // não falha. É o mesmo caminho de um nó `kind: 'approval'` — pendente
      // não consome tentativa, e `izanagi approve` retoma. Tratar isso como
      // falha faria o healing retentar uma porta que continuará fechada até
      // alguém decidir.
      if (err instanceof ToolApprovalRequired) {
        const record = ctx.approvals.get(ctx.runId, node.id) ?? ctx.approvals.request(ctx.runId, node.id, err.message);
        if (record.decision === 'approved') {
          // Aprovado: a política continua negando, e é essa a diferença entre
          // aprovar a AÇÃO e afrouxar a regra. Quem aprovou precisa conceder o
          // acesso onde ele mora (trust tier do agente, permissão do
          // contrato), e o nó falha dizendo isso em vez de executar por cima
          // de uma decisão de política que ninguém mudou.
          node.status = 'failed';
          node.error = `aprovação registrada, mas a política continua negando "${node.id}": ${err.message}`;
          closeSpan(false, node.error);
          return { status: 'error', nodeId: node.id, agent: node.agent, error: node.error };
        }
        if (record.decision === 'rejected') {
          node.status = 'failed';
          node.error = `tool de "${node.id}" rejeitada: ${record.reason ?? 'sem motivo informado'}`;
          closeSpan(false, node.error);
          return { status: 'error', nodeId: node.id, agent: node.agent, error: node.error };
        }
        node.status = 'pending';
        node.attempts = Math.max(0, (node.attempts ?? 1) - 1);
        closeSpan(false, 'aguardando aprovação humana para executar a tool');
        return { status: 'blocked_approval', nodeId: node.id, context: err.message };
      }
      node.status = 'failed';
      node.error = err instanceof Error ? err.message : String(err);
      closeSpan(false, node.error);
      return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
    }
  }

  /**
   * Registra a trajetória do run e, quando ela já se repetiu o bastante,
   * sintetiza a skill procedural correspondente.
   *
   * A barra é RECORRÊNCIA, não sucesso. Sintetizar a cada run bem-sucedido
   * produziria uma biblioteca de skills genéricas que ninguém usa e que
   * competem com as boas no ranking — que é exatamente o motivo de esta ideia
   * ter ficado parada até existir um gatilho defensável.
   *
   * Nunca lança: aprender é efeito colateral do run, e falha aqui não pode
   * derrubar um resultado que já foi produzido e verificado.
   */
  private recordTrajectory(
    memory: MemoryStore,
    graph: ExecutionGraph,
    evaluation: EvaluationReport,
    resolver: SkillResolver,
  ): void {
    try {
      const steps: TrajectoryStep[] = graph.nodes
        .filter((n) => n.status === 'succeeded')
        .map((n) => ({
          nodeId: n.id,
          ...(n.agent ? { agent: n.agent } : {}),
          kind: n.outputs?.[0] ?? 'raw',
          verified: this.verifications.get(n.id)?.status === 'VERIFIED',
        }));

      const success = evaluation.verdict === 'PASS' || evaluation.verdict === 'PASS_WITH_WARNINGS';
      const trajectory = memory.recordTrajectory({
        steps,
        objective: this.opts.task,
        ...(this.opts.plan ? { domains: this.opts.plan.classification.domains } : {}),
        success,
      });
      if (!trajectory) return;

      const recurrent = memory.recurrentTrajectories().find((t) => t.signature === trajectory.signature);
      if (!recurrent) return;

      // A camada SEMÂNTICA passa a receber escrita do runtime, com a mesma
      // barra de recorrência da síntese de skill: três execuções verificadas.
      //
      // Ela era lida (`listEntries`, `search`) e nunca escrita: o arquivo só
      // mudava quando uma pessoa o editava, e o que o runtime gravava
      // (`addLearning`) vive numa lista plana que a busca não alcança. Na
      // prática, a memória semântica do projeto não aprendia nada com a
      // execução. A escrita é idempotente pelo título, então rodar o mesmo
      // objetivo de novo não duplica.
      //
      // O que entra é o CONHECIMENTO (que caminho resolve esta classe de
      // objetivo, com que evidência), não o procedimento passo a passo, que é
      // o que a skill sintetizada logo abaixo carrega.
      memory.appendKnowledge({
        category: 'semantic',
        title: `Caminho verificado para: ${clipTitle(this.opts.task)}`,
        body:
          `Observado em ${recurrent.occurrences} execuções verificadas.\n\n` +
          `Sequência: ${recurrent.steps.join(' -> ')}\n` +
          `Domínios: ${this.opts.plan?.classification.domains.join(', ') || 'não classificado'}\n` +
          `Modo: ${this.opts.plan?.mode ?? 'legado'}`,
        source: `trajectory:${recurrent.signature.slice(0, 12)}`,
      });

      const name = skillNameFor(recurrent);
      const generated = new SkillFactory(resolver).generate({
        gap: `procedimento recorrente: ${recurrent.steps.join(' | ')}`,
        name,
        targetDir: this.opts.generatedSkillsDir ?? path.join(process.cwd(), 'skills', 'generated'),
        body: describeTrajectory(recurrent),
        description: `Procedimento observado em ${recurrent.occurrences} execuções verificadas: ${recurrent.steps.join(' -> ')}`,
        // Sem `force`: se a lacuna já é coberta por skill existente, a
        // trajetória não vira skill nova. Duplicar conhecimento é pior que não
        // registrá-lo.
      });
      if (!generated.registered) return;

      memory.markTrajectorySynthesized(recurrent.signature, name);
      memory.addLearning(
        `trajetória recorrente (${recurrent.occurrences} execuções) sintetizada na skill "${name}": ${recurrent.steps.join(' -> ')}`,
        'trajectory-synthesis',
        0.7,
      );
      this.opts.onEvent?.({
        name: 'skill.synthesized' as never,
        at: new Date().toISOString(),
        data: { skill: name, signature: recurrent.signature, occurrences: recurrent.occurrences },
      } as never);
      if (this.opts.verbose) {
        console.log(`  Skill sintetizada de trajetória recorrente: ${name} (${recurrent.occurrences} execuções)`);
      }
    } catch {
      // Aprender é efeito colateral: o run já entregou e foi verificado.
    }
  }

  /**
   * Executa o subgrafo pedido por um nó que descobriu, executando, ser maior
   * do que o plano previu.
   *
   * O que faz isto ser sub-orquestração e não uma colmeia:
   *  - o pedido é validado estruturalmente antes de virar grafo;
   *  - o orçamento de tokens é o DO PAI, dividido — decompor não libera gasto;
   *  - a profundidade tem teto do runtime, não do agente;
   *  - sub-tarefa não decompõe de novo (o contrato filho nasce com
   *    `decomposable: false`);
   *  - falha de sub-tarefa é falha do pai, e cai no mesmo healing.
   *
   * Devolve `null` quando o pedido é recusado — e nesse caso o conteúdo
   * original do nó segue para validação, que provavelmente vai reprovar: um
   * agente que respondeu com um plano em vez do artefato não entregou.
   */
  private async runSubgraph(
    parent: GraphNode,
    request: { reason: string; tasks: Array<{ id: string; objective: string }> },
    ctx: ExecuteCtx,
    maxDepth: number,
  ): Promise<{ content: string } | null> {
    const built = buildSubgraph(parent, request as never, { depth: ctx.depth, maxDepth });
    if (built.issues.length > 0 || built.taskIds.length === 0) {
      ctx.trace.span(`subgraph:rejected:${parent.id}`, 'decision', {
        reason: built.issues[0] ?? 'decomposição vazia',
        depth: ctx.depth,
        maxDepth,
      })(false, built.issues[0] ?? 'decomposição vazia');
      return null;
    }

    ctx.trace.span(`subgraph:${parent.id}`, 'decision', {
      reason: request.reason,
      tasks: built.taskIds,
      depth: ctx.depth + 1,
      tokenShare: built.graph.nodes[0]?.tokenBudget,
    })();
    ctx.conversation.record({
      from: parent.agent ?? parent.id,
      to: 'commander',
      type: 'request',
      taskId: parent.id,
      summary: `decomposição em ${built.taskIds.length} sub-tarefa(s): ${request.reason}`,
    });

    // As sub-tarefas rodam com o MESMO executor, um nível abaixo. Contrato,
    // contexto mínimo, verificação e registro de artefato valem igual: uma
    // sub-tarefa não é um caminho paralelo com regras próprias.
    const childCtx: ExecuteCtx = { ...ctx, depth: ctx.depth + 1 };
    const limit = this.degradation.concurrency
      ?? this.opts.budgetLimits?.maxConcurrency
      ?? DEFAULT_MAX_CONCURRENCY;

    for (const batch of built.graph.parallelBatches) {
      const settled = await runWithConcurrency(
        batch.map((id) => () => this.executeNode(built.graph, id, childCtx)),
        limit,
      );
      const failed = settled.find((r) => !r.ok || (r.ok && r.value?.status === 'error'));
      if (failed) {
        const message = failed.ok
          ? (failed.value as { error?: string }).error ?? 'sub-tarefa falhou'
          : failed.error instanceof Error
            ? failed.error.message
            : String(failed.error);
        ctx.trace.span(`subgraph:failed:${parent.id}`, 'decision', { message })(false, message);
        // Falha de filho é falha do pai: quem pediu a decomposição responde
        // pelo resultado dela.
        throw new Error(`sub-tarefa de "${parent.id}" falhou: ${message}`);
      }
    }

    const aggregated = aggregateSubgraph(parent.id, built.taskIds, ctx.artifacts);
    ctx.trace.span(`subgraph:done:${parent.id}`, 'decision', {
      produced: aggregated.produced,
      missing: aggregated.missing,
    })(aggregated.missing.length === 0);
    return { content: aggregated.content };
  }

  /**
   * Executa um nó de tool com a política aplicada ANTES da execução.
   *
   * Este é o caminho que faltava: até aqui `Orchestrator.executeNode` sempre
   * chamava `opts.produce()` — uma chamada de LLM ou a simulação headless — e
   * NUNCA a `ToolRegistry`. As garantias de menor privilégio, trust tier e
   * sandbox existiam, eram testadas, e não se aplicavam a nada que o
   * `izanagi run` realmente executasse.
   *
   * Menor privilégio por construção: o `ToolContext` sai do CONTRATO da tarefa.
   * Contrato sem `permissions` executa tool nenhuma, e a `ToolRegistry` recusa
   * antes de a `PolicyEngine` opinar. O trust tier vem da origem do agente, não
   * do que ele declara sobre si.
   */
  private async executeTool(
    node: GraphNode,
    contract: TaskContract | undefined,
    ctx: ExecuteCtx,
    graph: ExecutionGraph,
  ): Promise<{ content: unknown; kind: string; tokens?: number; model?: string }> {
    const spec = contract?.tool ?? (node.metadata?.tool as { id: string; input: unknown } | undefined);
    if (!spec?.id) {
      throw new Error(`nó "${node.id}" é de tool mas não declara qual tool executar (contract.tool.id)`);
    }
    // Allowlist de tools do run, quando quem chamou declarou uma. Vem ANTES da
    // permissão do contrato e da política, e é outra camada: a permissão diz o
    // que a tarefa PODE fazer, a allowlist diz o que ESTE RUN pode usar, sem
    // depender de nenhum contrato estar correto. É o que dá sentido a "allowed
    // tools" num caso de benchmark: sem ela, o caso observa o custo mas não
    // impõe limite nenhum.
    if (this.opts.allowedTools && !this.opts.allowedTools.includes(spec.id)) {
      throw new Error(
        `tool "${spec.id}" fora da allowlist do run (permitidas: ${this.opts.allowedTools.join(', ') || 'nenhuma'})`,
      );
    }

    const registry = (this.toolRegistry ??= new ToolRegistry());

    // Teto de tool calls do Budget Controller, ANTES de executar: estourar o
    // teto e só descobrir depois seria contabilizar um efeito colateral já
    // aplicado no disco.
    if (ctx.execBudget && !ctx.execBudget.recordToolCall()) {
      throw new Error(`teto de tool calls do run excedido antes de executar "${spec.id}"`);
    }

    const trustTier: TrustTier = node.agent
      ? this.opts.trustTierOf?.(node.agent) ?? 'community'
      : // Nó de tool sem agente foi declarado no plano por quem chamou o
        // runtime (SDK/decomposição), que já é o dono do processo.
        'builtin';

    const toolCtx: ToolContext = {
      permissions: contract?.permissions ?? [],
      baseDir: this.workspaceDir,
      environment: this.opts.environment ?? 'development',
      trustTier,
    };

    // Marcadores do input resolvidos AGORA: o plano declarou "grave o que o run
    // produziu", e só neste ponto existe o que o run produziu. Substituição
    // determinística, sem modelo — e recusada em `code.execute`, onde levar
    // saída de agente para dentro de código executado seria injeção.
    let input: unknown;
    try {
      input = resolveToolInput(spec.id, spec.input, {
        artifact: (nodeId) => {
          const produced = ctx.artifacts.get(nodeId);
          if (!produced) {
            throw new Error(
              `nó "${node.id}" referencia o artefato de "${nodeId}", que não existe no run (nó não executado, pulado ou falho)`,
            );
          }
          return typeof produced.content === 'string' ? produced.content : JSON.stringify(produced.content, null, 2);
        },
        deliverable: () =>
          buildDeliverable({
            objective: this.opts.task,
            runId: ctx.runId,
            mode: this.opts.plan?.mode ?? 'orchestrated',
            order: graph.order,
            artifacts: [...ctx.artifacts.entries()].map(([nodeId, a]) => ({
              nodeId,
              kind: a.kind,
              content: a.content,
              valid: a.valid,
            })),
          }),
      });
    } catch (e) {
      // Referência quebrada é falha do NÓ, não exceção do runtime: entra na
      // verificação e no healing como qualquer outra, com a causa dita.
      throw new Error(`nó "${node.id}": ${e instanceof Error ? e.message : String(e)}`);
    }

    const outcome = await registry.execute(spec.id, input, toolCtx);
    ctx.trace.markTool(`tool:${spec.id}`);
    ctx.trace.span(`tool:${spec.id}`, 'tool', {
      node: node.id,
      permissions: toolCtx.permissions,
      trustTier,
      environment: toolCtx.environment,
      ok: outcome.ok,
    })(outcome.ok, outcome.ok ? undefined : outcome.error);

    ctx.conversation.record({
      from: node.agent ?? node.id,
      to: 'tool-registry',
      type: 'request',
      taskId: node.id,
      summary: `${spec.id} (${trustTier}, permissões: ${toolCtx.permissions.join(', ') || 'nenhuma'}): ${outcome.ok ? 'executada' : outcome.error ?? 'falhou'}`,
    });

    if (!outcome.ok) {
      // Bloqueio destravável por pessoa não é o mesmo que "não": vira uma
      // pausa por aprovação, pelo MESMO caminho que um nó `kind: 'approval'`
      // usa (`izanagi approve` / `izanagi reject`), em vez de uma falha que o
      // healing tentaria curar retentando uma porta que continuará fechada.
      if (outcome.requiresApproval) {
        throw new ToolApprovalRequired(spec.id, outcome.error ?? 'política exige aprovação humana');
      }
      throw new Error(`tool "${spec.id}" recusada ou falhou: ${outcome.error ?? 'motivo não informado'}`);
    }
    return {
      content: outcome.result,
      kind: node.outputs?.[0] ?? 'raw',
      tokens: 0,
      model: `tool:${spec.id}`,
    };
  }

  /**
   * Interpreta a saída de um nó crítico e transforma crítica em AÇÃO.
   *
   * Sem isto, o crítico produzia texto, o texto virava um artefato `critique`, e
   * ninguém o lia: a crítica adversarial custava uma chamada de modelo e não
   * mudava nada na execução. Aqui a crítica vira uma decisão determinística:
   * bloqueante reprova o artefato criticado e devolve a correção MÍNIMA (só os
   * problemas high/critical), sem reenviar histórico nenhum.
   *
   * Devolve a falha a propagar (do nó CRITICADO, não do crítico) ou null quando
   * a crítica não bloqueia.
   */
  private interpretCritique(
    graph: ExecutionGraph,
    criticNode: GraphNode,
    content: unknown,
    ctx: ExecuteCtx,
  ): { status: 'error'; nodeId: string; agent?: string; skill?: string; error: string } | null {
    const text = typeof content === 'string' ? content : JSON.stringify(content ?? {});
    const critique = parseCritique(text);
    ctx.critiques.set(criticNode.id, critique);

    const blocking = isBlocking(critique);
    const worst = worstSeverity(critique);
    const targetId = this.critiqueTarget(graph, criticNode, critique);

    ctx.trace.span(`critique:${criticNode.id}`, 'evaluation', {
      status: critique.status,
      issues: critique.issues.length,
      worstSeverity: worst ?? 'nenhuma',
      blocking,
      target: targetId ?? 'nenhum',
    })(!blocking, blocking ? `${critique.issues.length} problema(s), pior severidade ${worst}` : undefined);

    ctx.conversation.record({
      from: criticNode.agent ?? criticNode.id,
      to: targetId ?? 'commander',
      type: 'critique',
      taskId: targetId ?? criticNode.id,
      summary: `${critique.status}: ${critique.issues.length} problema(s), pior severidade ${worst ?? 'nenhuma'}`,
      artifactRefs: [`${ctx.runId}:${criticNode.id}`, ...(targetId ? [`${ctx.runId}:${targetId}`] : [])],
      // Payload é a estrutura decisória (severidade + descrição), não o texto
      // inteiro da crítica: o texto já está no artefato, referenciado acima.
      payload: {
        status: critique.status,
        issues: critique.issues.map((i) => ({ severity: i.severity, description: i.description })),
      },
      ...(critique.confidence !== undefined ? { confidence: critique.confidence } : {}),
    });

    if (!blocking || !targetId) return null;

    const target = graph.nodes.find((n) => n.id === targetId);
    // Só faz sentido reabrir o que de fato foi entregue nesta execução.
    if (!target || target.status !== 'succeeded') return null;

    if (this.critiqueRounds.has(targetId)) {
      // Segunda crítica bloqueante no mesmo nó: registra como evidência (entra
      // nas recomendações da avaliação) e não reabre. Ping-pong entre crítico e
      // executor gasta orçamento sem convergir.
      ctx.trace.span(`critique:exhausted:${targetId}`, 'decision', {
        reason: 'nó já reaberto uma vez por crítica bloqueante nesta execução',
        issues: critique.issues.length,
      })();
      return null;
    }

    this.critiqueRounds.add(targetId);
    const correction = formatCorrection(critique);
    const blockingCount = critique.issues.filter((i) => i.severity === 'high' || i.severity === 'critical').length;
    target.status = 'failed';
    // A mensagem entra na taxonomia de falha como `validation` de propósito: uma
    // crítica bloqueante É a reprovação de um artefato, e o caminho de cura para
    // isso (skill corretiva + retry) já existe e é testado.
    target.error = `validação por crítica adversarial (${criticNode.id}) reprovou o artefato: ${blockingCount || critique.issues.length} problema(s) bloqueante(s)`;
    target.metadata = { ...target.metadata, correction, criticizedBy: criticNode.id };

    // O crítico volta para a fila: quem apontou o problema é quem verifica o
    // conserto. Sem isto, o run "corrige" e nunca reverifica. `attempts` volta a
    // zero porque re-criticar não é uma retentativa de algo que falhou — o
    // crítico entregou; escalar o modelo dele aqui seria pagar caro por nada.
    criticNode.status = 'pending';
    criticNode.attempts = 0;
    criticNode.error = undefined;
    ctx.artifacts.delete(criticNode.id);

    ctx.conversation.record({
      from: criticNode.agent ?? criticNode.id,
      to: target.agent ?? targetId,
      type: 'correction',
      taskId: targetId,
      summary: correction,
      artifactRefs: [`${ctx.runId}:${targetId}`],
    });

    return {
      status: 'error',
      nodeId: targetId,
      ...(target.agent ? { agent: target.agent } : {}),
      ...(target.skills?.[0] ? { skill: target.skills[0] } : {}),
      error: target.error,
    };
  }

  /**
   * Qual nó a crítica reprova. O crítico costuma nomear o artefato em
   * `issue.artifact`; quando esse nome bate com um nó do grafo ele é mais
   * preciso que a topologia. Sem nome utilizável, cai na dependência do
   * crítico — que é exatamente o que ele foi posto no grafo para revisar.
   */
  private critiqueTarget(graph: ExecutionGraph, criticNode: GraphNode, critique: Critique): string | null {
    const exists = (id: string | undefined): id is string =>
      Boolean(id) && id !== criticNode.id && graph.nodes.some((n) => n.id === id);
    const named = critique.issues.map((i) => i.artifact).find(exists);
    if (named) return named;
    const dep = (criticNode.dependencies ?? []).find(exists);
    return dep ?? null;
  }

  /**
   * Recomendações da avaliação final derivadas das críticas REALMENTE
   * interpretadas. Antes disto a checagem era `ctx.artifacts.has('critique')`,
   * que nunca era verdadeira: `critique` é o KIND do artefato, e a chave do mapa
   * é o id do nó (`critic`). A recomendação simplesmente nunca aparecia.
   */
  private critiqueRecommendations(ctx: ExecuteCtx): string[] {
    const out: string[] = [];
    for (const [nodeId, critique] of ctx.critiques.entries()) {
      if (critique.issues.length === 0) continue;
      const worst = worstSeverity(critique);
      const corrected = Array.from(this.critiqueRounds).length > 0;
      out.push(
        `crítica de "${nodeId}": ${critique.issues.length} problema(s), pior severidade ${worst}` +
          (isBlocking(critique)
            ? corrected
              ? ' — bloqueante, correção dirigida aplicada'
              : ' — bloqueante, sem alvo corrigível no grafo'
            : ' — não bloqueante, tratado como recomendação'),
      );
    }
    return out;
  }

  /**
   * Aplica UM degrau da escada de degradação. Cada passo muda o estado que o
   * executor consulta daqui para frente: contexto menor, saída menor, modelo
   * mais barato, menos paralelismo, tarefas opcionais cortadas, ou pausa para
   * decisão humana. O passo já veio marcado como consumido pelo Budget
   * Controller, então a escada nunca repete um degrau.
   */
  private applyDegradation(step: DegradationStep, graph: ExecutionGraph, ctx: ExecuteCtx): void {
    const pressure = ctx.execBudget?.pressure() ?? 0;
    let effect = '';

    switch (step) {
      case 'reduce-context': {
        this.degradation.contextScale = 0.5;
        // Recria o resolver com metade do orçamento de contexto: os próximos
        // nós recebem insumos mais curtos, não os mesmos insumos.
        this.contextResolver = new ContextResolver({
          maxCharsPerArtifact: Math.max(200, Math.floor(1200 * this.degradation.contextScale)),
          maxTotalChars: Math.max(400, Math.floor(4000 * this.degradation.contextScale)),
        });
        effect = 'contexto por tarefa reduzido à metade';
        break;
      }
      case 'reduce-output': {
        this.degradation.outputScale = 0.6;
        // Aplica já nos nós pendentes; `executeNode` reaplica nos que vierem.
        for (const node of graph.nodes) {
          if (node.status === 'pending' && node.tokenBudget) {
            node.tokenBudget = Math.max(256, Math.floor(node.tokenBudget * this.degradation.outputScale));
          }
        }
        effect = 'teto de saída dos nós pendentes reduzido a 60%';
        break;
      }
      case 'downgrade-model': {
        this.degradation.demoteModel = true;
        effect = 'papel rebaixado um degrau no roteamento (modelo mais barato)';
        break;
      }
      case 'reduce-parallelism': {
        const current = this.degradation.concurrency ?? this.opts.budgetLimits?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
        this.degradation.concurrency = Math.max(1, Math.floor(current / 2));
        effect = `concorrência reduzida para ${this.degradation.concurrency}`;
        break;
      }
      case 'drop-optional-tasks': {
        this.degradation.dropOptional = true;
        effect = 'tarefas opcionais cortadas do restante do grafo';
        break;
      }
      case 'require-human-approval': {
        this.degradation.requireApproval = true;
        effect = 'próximo batch exige aprovação humana';
        break;
      }
    }

    ctx.trace.span(`budget:degradation:${step}`, 'decision', { pressure, effect })();
    if (this.opts.verbose) {
      console.log(`  \x1b[33m▼\x1b[0m Degradação de orçamento (pressão ${(pressure * 100).toFixed(0)}%): ${step} — ${effect}`);
    }
  }

  /** Artefatos disponíveis para o Context Resolver, já com a referência do registry. */
  private availableArtifacts(ctx: ExecuteCtx): Map<string, AvailableArtifact> {
    const out = new Map<string, AvailableArtifact>();
    for (const [nodeId, a] of ctx.artifacts.entries()) {
      out.set(nodeId, { nodeId, kind: a.kind, content: a.content, valid: a.valid, ref: `${ctx.runId}:${nodeId}` });
    }
    return out;
  }

  /**
   * Early stopping: pula um nó OPCIONAL quando aquilo que ele revisaria já
   * está comprovado. A decisão é LOCAL (olha as dependências do próprio nó),
   * não global: um nó obrigatório mais adiante no grafo, ainda pendente, não
   * é motivo para rodar uma crítica sobre algo que já passou na verificação.
   *
   * Nó sem contrato nunca é opcional, então o caminho legado executa tudo.
   */
  private shouldSkipOptional(graph: ExecutionGraph, nodeId: string): boolean {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return false;
    const contract = contractOf(node);
    if (!contract?.optional) return false;

    const deps = (node.dependencies ?? [])
      .map((id) => graph.nodes.find((n) => n.id === id))
      .filter((n): n is GraphNode => Boolean(n));
    if (deps.length === 0) return false;
    // Alguma dependência falhou ou não rodou: a revisão ainda pode ser útil.
    if (!deps.every((d) => d.status === 'succeeded' || d.status === 'skipped')) return false;
    const succeeded = deps.filter((d) => d.status === 'succeeded');
    if (succeeded.length === 0) return false;
    return succeeded.every((d) => this.verifications.get(d.id)?.status === 'VERIFIED');
  }
}

/**
 * Agentes disponíveis, lidos do disco pelo `AgentCapabilityRegistry`.
 *
 * Era uma lista literal de 19 ids, e o efeito não era cosmético: ela decidia
 * se a Agent Factory deveria gerar um agente novo. Um projeto com agentes
 * próprios (ou os 3 core que a lista esquecia: `ai-engineer`, `evaluator`,
 * `form-engineer`) tinha esses agentes ignorados nessa decisão, e o runtime
 * podia sintetizar um agente para uma lacuna que já estava coberta em disco.
 *
 * O fallback para a lista antiga existe porque este caminho é o LEGADO (sem
 * Commander): projeto sem `agents/` legível não deve deixar de rodar por isso.
 */
function agentIds(baseDir: string): string[] {
  const discovered = new AgentCapabilityRegistry({ baseDir }).ids();
  if (discovered.length > 0) return discovered;
  return [
    'discovery', 'product-reasoner', 'architect', 'security', 'database', 'pm', 'senior-engineer',
    'qa', 'adversarial-critic', 'bug-hunter', 'automation-engineer', 'animation',
    'researcher', 'devops', 'techlead', 'docs', 'professor', 'agent-architect', 'skill-architect',
  ];
}

/**
 * Um nó é de tool quando o kind diz isso E existe tool declarada. Kind sozinho
 * não basta: grafos antigos usavam `kind: 'tool'` como rótulo descritivo e
 * seguiam pelo producer normal — quebrar isso seria mudar o comportamento de
 * plano que já roda.
 */
/**
 * A política bloqueou a tool E disse que uma pessoa pode destravar.
 *
 * Classe própria porque o caminho de erro do nó precisa distinguir isto de uma
 * falha comum sem casar mensagem por regex: um "não" definitivo vai para o
 * healing, um bloqueio destravável vai para `izanagi approve`.
 */
export class ToolApprovalRequired extends Error {
  constructor(readonly toolId: string, message: string) {
    super(message);
    this.name = 'ToolApprovalRequired';
  }
}

/** Título de entrada de memória: uma linha, sem quebra, com teto. */
function clipTitle(text: string, max = 80): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function isToolNode(node: GraphNode, contract?: TaskContract): boolean {
  const spec = contract?.tool ?? (node.metadata?.tool as { id?: string } | undefined);
  return Boolean(spec?.id);
}

/**
 * Motivo do cancelamento em texto, quando quem cancelou informou um.
 *
 * Duplica deliberadamente o helper de `orchestration/deadline.ts` em vez de
 * exportá-lo: são três linhas, e um export a mais na fronteira do módulo de
 * prazo sugeriria que ler `signal.reason` é responsabilidade dele.
 */
function abortReasonText(signal: AbortSignal): string | undefined {
  const reason = signal.reason;
  if (reason === undefined || reason === null) return undefined;
  if (reason instanceof Error) return reason.message;
  return typeof reason === 'string' ? reason : undefined;
}
