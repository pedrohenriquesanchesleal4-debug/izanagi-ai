/**
 * Execution Controller — Mecanismo central de controle de execução,
 * prevenção de loops, detecção de estagnação, deduplicação de ferramentas
 * e recuperação localizada.
 *
 * Integra-se diretamente ao `Commander` e ao `Orchestrator` sem criar um
 * segundo orquestrador paralelo: governa o estado explícito da execução,
 * separa as fases (Planning → Execution → Validation → Recovery → Finalization),
 * impõe limites proporcionais (Fast / Standard / Deep), classifica erros em
 * 14 categorias com políticas próprias e aciona o circuit breaker progressivo
 * quando detecta repetição sem progresso observável.
 */

import crypto from 'crypto';
import path from 'path';
import type { ExecutionMode } from '../contracts/task-contract.js';

/* ============================ ESTRATÉGIAS & LIMITES ============================ */

/** Estratégia proporcional à dificuldade da tarefa (Fase 2.3). */
export type ExecutionStrategy = 'fast' | 'standard' | 'deep';

/** Fases explícitas do ciclo de vida da execução (Fase 2.2). */
export type ExecutionLifecyclePhase =
  | 'planning'
  | 'execution'
  | 'validation'
  | 'recovery'
  | 'finalization';

/** Limites rígidos e configuráveis por execução (Fase 3.1). */
export interface StrategyLimits {
  maxIterations: number;
  maxLlmTurns: number;
  maxToolCalls: number;
  maxDelegations: number;
  maxRetriesPerStage: number;
  maxTimeMs: number;
  maxTokens: number;
  maxCostUsd?: number;
  maxConcurrency: number;
}

/**
 * Valores padrão conservadores calibrados por estratégia (Fase 3.1).
 * Uma correção simples (`fast`) tem limites menores que uma tarefa de
 * arquitetura complexa (`deep`).
 */
export const DEFAULT_STRATEGY_LIMITS: Record<ExecutionStrategy, StrategyLimits> = {
  fast: {
    maxIterations: 2,
    maxLlmTurns: 2,
    maxToolCalls: 4,
    maxDelegations: 0,
    maxRetriesPerStage: 1,
    maxTimeMs: 120_000,
    maxTokens: 4_000,
    maxConcurrency: 1,
  },
  standard: {
    maxIterations: 6,
    maxLlmTurns: 8,
    maxToolCalls: 12,
    maxDelegations: 3,
    maxRetriesPerStage: 2,
    maxTimeMs: 300_000,
    maxTokens: 24_000,
    maxConcurrency: 3,
  },
  deep: {
    maxIterations: 15,
    maxLlmTurns: 20,
    maxToolCalls: 30,
    maxDelegations: 8,
    maxRetriesPerStage: 3,
    maxTimeMs: 900_000,
    maxTokens: 64_000,
    maxConcurrency: 4,
  },
};

/** Mapeia `ExecutionMode` do Commander para a estratégia proporcional (`fast | standard | deep`). */
export function strategyForMode(mode: ExecutionMode, complexity = 1): ExecutionStrategy {
  switch (mode) {
    case 'direct':
      return 'fast';
    case 'assisted':
      return complexity <= 2 ? 'fast' : 'standard';
    case 'orchestrated':
      return 'standard';
    case 'autonomous':
      return 'deep';
  }
}

/**
 * Aceita tanto os modos canônicos (`direct | assisted | orchestrated | autonomous`)
 * quanto os nomes de estratégia proporcional (`fast | standard | deep`).
 */
export function resolveModeAlias(value: string): ExecutionMode | undefined {
  const clean = value.trim().toLowerCase();
  if (clean === 'fast') return 'direct';
  if (clean === 'standard') return 'orchestrated';
  if (clean === 'deep') return 'autonomous';
  if (clean === 'direct' || clean === 'assisted' || clean === 'orchestrated' || clean === 'autonomous') {
    return clean;
  }
  return undefined;
}

/* ============================ CLASSIFICAÇÃO DE ERROS (FASE 4.1) ============================ */

export type DetailedErrorCategory =
  | 'transient_network'
  | 'rate_limit'
  | 'timeout'
  | 'auth_failure'
  | 'invalid_arguments'
  | 'tool_unavailable'
  | 'code_error'
  | 'test_failure'
  | 'missing_dependency'
  | 'missing_information'
  | 'permission_denied'
  | 'configuration_error'
  | 'incorrect_model_output'
  | 'unclassified';

export interface ClassifiedError {
  category: DetailedErrorCategory;
  message: string;
  retryable: boolean;
  maxCategoryRetries: number;
  requiresStrategyChange: boolean;
  /**
   * Quando true, a falha veio de infraestrutura/autenticação/ambiente externo
   * e NUNCA deve ser registrada como falha de capacidade do agente ou bug da
   * implementação na memória.
   */
  isInfrastructureOrAuth: boolean;
  /** Tempo sugerido de espera antes de tentar novamente (respeita Retry-After). */
  retryAfterMs?: number;
  recommendedAction:
    | 'abort_immediately'
    | 'retry_with_backoff'
    | 'fix_arguments'
    | 'use_alternative_tool'
    | 'targeted_code_repair'
    | 'targeted_validation_repair'
    | 'resolve_dependency'
    | 'replan_stage';
}

const ERROR_CLASSIFICATION_RULES: Array<{
  category: DetailedErrorCategory;
  regex: RegExp;
  retryable: boolean;
  maxCategoryRetries: number;
  requiresStrategyChange: boolean;
  isInfrastructureOrAuth: boolean;
  recommendedAction: ClassifiedError['recommendedAction'];
}> = [
  {
    category: 'auth_failure',
    regex: /failed to authenticate|oauth session expired|unauthorized|invalid[_ -]?api[_ -]?key|authentication failed|401\b|403\b|credencial|unauthenticated|executor indispon[íi]vel.*autentica/i,
    retryable: false,
    maxCategoryRetries: 0,
    requiresStrategyChange: false,
    isInfrastructureOrAuth: true,
    recommendedAction: 'abort_immediately',
  },
  {
    category: 'permission_denied',
    regex: /permiss[ãa]o negada|policy negou|permission denied|eacces|eperm|fora da zona permitida|fora da allowlist/i,
    retryable: false,
    maxCategoryRetries: 0,
    requiresStrategyChange: false,
    isInfrastructureOrAuth: true,
    recommendedAction: 'abort_immediately',
  },
  {
    category: 'configuration_error',
    regex: /configura[çc][ãa]o inv[áa]lida|invalid config|missing env|environment variable|teto d[eo] [^.]*excedido|budget ceiling exceeded|or[çc]amento.*esgotado|run cancelado|run aborted/i,
    retryable: false,
    maxCategoryRetries: 0,
    requiresStrategyChange: false,
    isInfrastructureOrAuth: true,
    recommendedAction: 'abort_immediately',
  },
  {
    category: 'rate_limit',
    regex: /\b429\b|rate[_ -]?limit|too many requests|quota exceeded|retry-after/i,
    retryable: true,
    maxCategoryRetries: 2,
    requiresStrategyChange: false,
    isInfrastructureOrAuth: true,
    recommendedAction: 'retry_with_backoff',
  },
  {
    category: 'timeout',
    regex: /timeout|timed out|etimedout|prazo excedido|deadline exceeded/i,
    retryable: true,
    maxCategoryRetries: 1,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: true,
    recommendedAction: 'retry_with_backoff',
  },
  {
    category: 'transient_network',
    regex: /econnreset|econnrefused|eai_again|enotfound|socket hang up|fetch failed|network error|\b502\b|\b503\b|\b504\b|bad gateway|service unavailable|gateway timeout|internal server error|\b500\b/i,
    retryable: true,
    maxCategoryRetries: 2,
    requiresStrategyChange: false,
    isInfrastructureOrAuth: true,
    recommendedAction: 'retry_with_backoff',
  },
  {
    category: 'tool_unavailable',
    regex: /sandbox indispon[íi]vel|tool desconhecida|bin[áa]rio.*n[ãa]o encontrado|executor indispon[íi]vel|not installed|command not found/i,
    retryable: false,
    maxCategoryRetries: 0,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: true,
    recommendedAction: 'use_alternative_tool',
  },
  {
    category: 'invalid_arguments',
    regex: /campo ["'].*["'].*obrigat[óo]rio|input inv[áa]lido|invalid argument|invalid input|malformed json|manifesto recusado|deve ser um n[úu]mero|deve ser string/i,
    retryable: true,
    maxCategoryRetries: 1,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: false,
    recommendedAction: 'fix_arguments',
  },
  {
    category: 'missing_dependency',
    regex: /cannot find module|module_not_found|missing module|missing dependency|pacote ausente|import.*not found/i,
    retryable: true,
    maxCategoryRetries: 1,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: false,
    recommendedAction: 'resolve_dependency',
  },
  {
    category: 'missing_information',
    regex: /arquivo n[ãa]o existe|enoent|no such file or directory|referencia o artefato.*que n[ãa]o existe|falta de informa[çc][ãa]o/i,
    retryable: true,
    maxCategoryRetries: 1,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: false,
    recommendedAction: 'replan_stage',
  },
  {
    category: 'test_failure',
    regex: /test(e|s)? falhou|test failed|assertionerror|expect\(.*\)\.to|su[íi]te.*reprovad|\bfail\b.*test/i,
    retryable: true,
    maxCategoryRetries: 2,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: false,
    recommendedAction: 'targeted_code_repair',
  },
  {
    category: 'code_error',
    regex: /syntaxerror|typeerror|referenceerror|compilation error|erro de compila[çc][ãa]o|tsc.*error|ts\d{4}:/i,
    retryable: true,
    maxCategoryRetries: 2,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: false,
    recommendedAction: 'targeted_code_repair',
  },
  {
    category: 'incorrect_model_output',
    regex: /valida[çc][ãa]o falhou|verifica[çc][ãa]o falhou|validation|verification|schema|contract|invalid artifact|not valid|regress[ãa]o detectada|cr[íi]tica adversarial|revis[ãa]o do orquestrador/i,
    retryable: true,
    maxCategoryRetries: 2,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: false,
    recommendedAction: 'targeted_validation_repair',
  },
];

/** Extrai `Retry-After` (em ms) de uma mensagem de erro quando presente. */
export function parseRetryAfterMs(errorText: string): number | undefined {
  const match = errorText.match(/retry-after[:\s=]+(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds)?/i);
  if (!match) return undefined;
  const val = Number(match[1]);
  if (!Number.isFinite(val) || val < 0) return undefined;
  const unit = (match[2] ?? 's').toLowerCase();
  return unit === 'ms' ? Math.round(val) : Math.round(val * 1000);
}

/**
 * Calcula backoff exponencial com jitter determinístico/limitado,
 * respeitando `Retry-After` quando fornecido pelo provedor.
 */
export function computeBackoffWithJitter(
  baseMs: number,
  attempt: number,
  opts?: { factor?: number; maxMs?: number; retryAfterMs?: number; jitterRatio?: number },
): number {
  if (opts?.retryAfterMs !== undefined && opts.retryAfterMs > 0) {
    return Math.min(opts?.maxMs ?? 60_000, opts.retryAfterMs);
  }
  const factor = opts?.factor ?? 1.6;
  const maxMs = opts?.maxMs ?? 60_000;
  const raw = Math.min(maxMs, baseMs * Math.pow(factor, Math.max(0, attempt - 1)));
  const ratio = opts?.jitterRatio ?? 0.2;
  // Jitter simétrico determinístico por tentativa para evitar thundering herd sem perder reprodutibilidade
  const pseudoRandom = ((attempt * 2654435761) % 1000) / 1000;
  const jitter = raw * ratio * (pseudoRandom - 0.5) * 2;
  return Math.max(50, Math.min(maxMs, Math.round(raw + jitter)));
}

/** Classifica um erro nas 14 categorias detalhadas com política de recuperação específica. */
export function classifyDetailedError(error: string): ClassifiedError {
  const text = String(error ?? '').trim();
  const retryAfterMs = parseRetryAfterMs(text);

  for (const rule of ERROR_CLASSIFICATION_RULES) {
    if (rule.regex.test(text)) {
      return {
        category: rule.category,
        message: text,
        retryable: rule.retryable,
        maxCategoryRetries: rule.maxCategoryRetries,
        requiresStrategyChange: rule.requiresStrategyChange,
        isInfrastructureOrAuth: rule.isInfrastructureOrAuth,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        recommendedAction: rule.recommendedAction,
      };
    }
  }

  return {
    category: 'unclassified',
    message: text,
    retryable: true,
    maxCategoryRetries: 1,
    requiresStrategyChange: true,
    isInfrastructureOrAuth: false,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    recommendedAction: 'replan_stage',
  };
}

/* ============================ DEDUPLICAÇÃO DE FERRAMENTAS (FASE 3.3) ============================ */

/** Ferramentas puramente de leitura e idempotentes cujo resultado pode ser reutilizado enquanto o workspace não mudar. */
const IDEMPOTENT_READ_TOOLS = new Set(['fs.read', 'project.survey']);

/** Ferramentas que mutam o sistema de arquivos e invalidam caches de leitura. */
const MUTATING_WRITE_TOOLS = new Set(['fs.write', 'project.materialize']);

/** Ferramentas de teste/execução que só produzem resultado diferente se o código/ambiente mudou. */
const STATE_DEPENDENT_EXEC_TOOLS = new Set(['project.test', 'code.execute']);

export interface ToolCallRecord {
  toolId: string;
  normalizedArgs: string;
  argsHash: string;
  nodeId: string;
  status: 'ok' | 'error';
  result?: unknown;
  error?: string;
  executedAt: string;
  durationMs: number;
  workspaceRevision: number;
  observableEffect: 'read' | 'write' | 'exec' | 'external';
}

export interface ToolDeduplicationDecision {
  duplicate: boolean;
  reusable: boolean;
  stagnantRepeat: boolean;
  argsHash: string;
  normalizedArgs: string;
  cachedResult?: unknown;
  previousRecord?: ToolCallRecord;
  reason?: string;
}

/** Normaliza recursivamente os argumentos de uma tool para comparação e hashing confiáveis. */
export function normalizeToolArgs(toolId: string, input: unknown): string {
  const normalizeValue = (val: unknown, keyName?: string): unknown => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      if (keyName === 'file' || keyName === 'dir' || keyName === 'path') {
        const clean = val.trim().replace(/\\/g, '/');
        return path.posix.normalize(clean);
      }
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => normalizeValue(item));
    }
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const sortedKeys = Object.keys(obj).sort();
      const out: Record<string, unknown> = {};
      for (const k of sortedKeys) {
        if (obj[k] !== undefined) {
          out[k] = normalizeValue(obj[k], k);
        }
      }
      return out;
    }
    return val;
  };

  return JSON.stringify({ tool: toolId, input: normalizeValue(input) });
}

export function hashToolArgs(toolId: string, input: unknown): { normalizedArgs: string; argsHash: string } {
  const normalizedArgs = normalizeToolArgs(toolId, input);
  const argsHash = crypto.createHash('sha256').update(normalizedArgs).digest('hex').slice(0, 16);
  return { normalizedArgs, argsHash };
}

/* ============================ ESTAGNAÇÃO & CIRCUIT BREAKER (FASE 3.2 & 3.4) ============================ */

export type StagnationSignalKind =
  | 'same_error_repeated'
  | 'same_artifact_hash'
  | 'no_criteria_progress'
  | 'same_plan_repeated'
  | 'repeated_tool_no_change'
  | 'handoff_cycle';

export interface StagnationSignal {
  kind: StagnationSignalKind;
  nodeId: string;
  detail: string;
  attempt: number;
  detectedAt: string;
}

/**
 * Níveis progressivos do Circuit Breaker (Fase 3.4):
 *  0 = normal
 *  1 = primeira repetição suspeita (verifica justificativa)
 *  2 = repetição sem progresso (exige mudança concreta de estratégia)
 *  3 = repetição do mesmo erro (interrompe ciclo de retry do erro)
 *  4 = estagnação persistente (pausa/encerra etapa)
 *  5 = limite rígido atingido (parada obrigatória)
 */
export type CircuitBreakerLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface ProgressEvidence {
  nodeId: string;
  attempt: number;
  kind:
    | 'new_valid_artifact'
    | 'artifact_improved'
    | 'criteria_reduced'
    | 'error_resolved'
    | 'files_modified'
    | 'new_tool_information';
  detail: string;
  at: string;
}

export interface InvestigatedHypothesis {
  nodeId: string;
  attempt: number;
  symptom: string;
  probableCause: string;
  evidenceUsed: string;
  plannedChange: string;
  validationCriteria: string[];
  outcome: 'pending' | 'resolved' | 'failed';
  at: string;
}

export interface RecordedError {
  nodeId: string;
  attempt: number;
  category: DetailedErrorCategory;
  message: string;
  errorHash: string;
  at: string;
}

export interface InterruptionInfo {
  reason: string;
  category:
    | 'loop_detected'
    | 'stagnation'
    | 'budget_exhausted'
    | 'cancelled'
    | 'non_recoverable_error'
    | 'handoff_limit';
  atPhase: ExecutionLifecyclePhase;
  circuitBreakerLevel: CircuitBreakerLevel;
  completedStages: string[];
  pendingStages: string[];
}

/* ============================ ESTADO EXPLÍCITO DA EXECUÇÃO (FASE 2.1) ============================ */

export interface ExecutionStateSnapshot {
  runId: string;
  originalObjective: string;
  strategy: ExecutionStrategy;
  lifecyclePhase: ExecutionLifecyclePhase;
  acceptanceCriteria: string[];
  currentPlan: {
    graphId: string;
    mode: ExecutionMode;
    nodes: string[];
    planSignature: string;
  };
  activeStage: string | null;
  completedStages: string[];
  pendingStages: string[];
  modifiedFiles: string[];
  toolsUsed: ToolCallRecord[];
  skillsLoaded: string[];
  relevantResults: Record<
    string,
    { kind: string; hash: string; valid: boolean; score: number; unmetCount: number }
  >;
  knownErrors: RecordedError[];
  investigatedHypotheses: InvestigatedHypothesis[];
  attemptsMade: number;
  llmTurns: number;
  delegationsCount: number;
  handoffChain: Array<{ from: string; to: string; nodeId: string; reason: string; at: string }>;
  remainingBudget: {
    iterations: number;
    llmTurns: number;
    toolCalls: number;
    delegations: number;
    tokens: number;
    timeMs: number;
    costUsd?: number;
  };
  deadlineAt: number;
  lastRetryReason?: string;
  progressEvidence: ProgressEvidence[];
  stagnationSignals: StagnationSignal[];
  circuitBreakerLevel: CircuitBreakerLevel;
  completionCondition: {
    met: boolean;
    reason: string;
    verifiedCount: number;
    totalRequired: number;
  };
  interrupted?: InterruptionInfo;
  toolRepeatsAvoided: number;
  phaseDurationsMs: Record<ExecutionLifecyclePhase, number>;
  phaseHistory: Array<{
    phase: ExecutionLifecyclePhase;
    startedAt: number;
    endedAt?: number;
    durationMs?: number;
    detail?: string;
  }>;
}

/* ============================ EXECUTION CONTROLLER ============================ */

export interface ExecutionControllerOptions {
  runId: string;
  objective: string;
  mode: ExecutionMode;
  complexity?: number;
  graphId?: string;
  nodeIds?: string[];
  acceptanceCriteria?: string[];
  limits?: Partial<StrategyLimits>;
  startedAt?: number;
}

export class ExecutionController {
  readonly runId: string;
  readonly originalObjective: string;
  readonly strategy: ExecutionStrategy;
  readonly limits: StrategyLimits;
  readonly startedAt: number;
  readonly deadlineAt: number;

  private lifecyclePhase: ExecutionLifecyclePhase = 'planning';
  private currentPlan: ExecutionStateSnapshot['currentPlan'];
  private activeStage: string | null = null;
  private readonly completedStages = new Set<string>();
  private readonly pendingStages = new Set<string>();
  private readonly modifiedFiles = new Set<string>();
  private readonly toolsUsed: ToolCallRecord[] = [];
  private readonly skillsLoaded = new Set<string>();
  private readonly relevantResults = new Map<
    string,
    { kind: string; hash: string; valid: boolean; score: number; unmetCount: number }
  >();
  private readonly knownErrors: RecordedError[] = [];
  private readonly investigatedHypotheses: InvestigatedHypothesis[] = [];
  private readonly progressEvidence: ProgressEvidence[] = [];
  private readonly stagnationSignals: StagnationSignal[] = [];
  private readonly handoffChain: Array<{ from: string; to: string; nodeId: string; reason: string; at: string }> = [];
  private readonly phaseHistory: ExecutionStateSnapshot['phaseHistory'] = [];
  private readonly acceptanceCriteria: string[];

  private attemptsMade = 0;
  private llmTurns = 0;
  private delegationsCount = 0;
  private tokensSpent = 0;
  private costSpentUsd = 0;
  private workspaceRevision = 0;
  private toolRepeatsAvoided = 0;
  private consecutiveStagnantSteps = 0;
  private circuitBreakerLevel: CircuitBreakerLevel = 0;
  private lastRetryReason?: string;
  private interrupted?: InterruptionInfo;

  constructor(opts: ExecutionControllerOptions) {
    this.runId = opts.runId;
    this.originalObjective = opts.objective;
    this.strategy = strategyForMode(opts.mode, opts.complexity ?? 1);
    const defaults = DEFAULT_STRATEGY_LIMITS[this.strategy];
    this.limits = {
      maxIterations: opts.limits?.maxIterations ?? defaults.maxIterations,
      maxLlmTurns: opts.limits?.maxLlmTurns ?? defaults.maxLlmTurns,
      maxToolCalls: opts.limits?.maxToolCalls ?? defaults.maxToolCalls,
      maxDelegations: opts.limits?.maxDelegations ?? defaults.maxDelegations,
      maxRetriesPerStage: opts.limits?.maxRetriesPerStage ?? defaults.maxRetriesPerStage,
      maxTimeMs: opts.limits?.maxTimeMs ?? defaults.maxTimeMs,
      maxTokens: opts.limits?.maxTokens ?? defaults.maxTokens,
      ...(opts.limits?.maxCostUsd !== undefined ? { maxCostUsd: opts.limits.maxCostUsd } : {}),
      maxConcurrency: opts.limits?.maxConcurrency ?? defaults.maxConcurrency,
    };
    this.startedAt = opts.startedAt ?? Date.now();
    this.deadlineAt = this.startedAt + this.limits.maxTimeMs;
    this.acceptanceCriteria = [...(opts.acceptanceCriteria ?? [])];
    const nodeIds = opts.nodeIds ?? [];
    this.currentPlan = {
      graphId: opts.graphId ?? 'graph',
      mode: opts.mode,
      nodes: [...nodeIds],
      planSignature: nodeIds.join('->'),
    };
    for (const id of nodeIds) this.pendingStages.add(id);
    this.enterPhase('planning', `modo ${opts.mode} (estratégia ${this.strategy})`);
  }

  /** Transita explicitamente entre Planning, Execution, Validation, Recovery e Finalization. */
  enterPhase(phase: ExecutionLifecyclePhase, detail?: string): void {
    const now = Date.now();
    const last = this.phaseHistory[this.phaseHistory.length - 1];
    if (last && last.endedAt === undefined) {
      last.endedAt = now;
      last.durationMs = Math.max(0, now - last.startedAt);
    }
    this.lifecyclePhase = phase;
    this.phaseHistory.push({
      phase,
      startedAt: now,
      ...(detail ? { detail } : {}),
    });
  }

  /** Fecha a última fase aberta (chamado ao encerrar o run). */
  closeCurrentPhase(): void {
    const now = Date.now();
    const last = this.phaseHistory[this.phaseHistory.length - 1];
    if (last && last.endedAt === undefined) {
      last.endedAt = now;
      last.durationMs = Math.max(0, now - last.startedAt);
    }
  }

  markStageStarted(nodeId: string, skills?: string[]): void {
    this.activeStage = nodeId;
    if (skills) {
      for (const s of skills) this.skillsLoaded.add(s);
    }
  }

  markStageSkipped(nodeId: string): void {
    this.pendingStages.delete(nodeId);
    if (this.activeStage === nodeId) this.activeStage = null;
  }

  /** Registra um turno de chamada a modelo LLM e verifica o limite de turnos. */
  recordLlmTurn(tokens = 0, costUsd = 0): { allowed: boolean; reason?: string } {
    this.llmTurns++;
    this.tokensSpent += tokens;
    this.costSpentUsd += costUsd;
    if (this.llmTurns > this.limits.maxLlmTurns) {
      const reason = `limite de turnos de LLM excedido (${this.llmTurns}/${this.limits.maxLlmTurns})`;
      this.escalateCircuitBreaker(5);
      return { allowed: false, reason };
    }
    return { allowed: true };
  }

  /**
   * Avalia o resultado de uma etapa e detecta progresso observável ou estagnação
   * (Fase 3.2).
   */
  recordStageOutcome(input: {
    nodeId: string;
    attempt: number;
    kind: string;
    contentHash: string;
    valid: boolean;
    score: number;
    unmetCriteria: string[];
  }): { progressed: boolean; evidence: ProgressEvidence[]; stagnation?: StagnationSignal } {
    const prev = this.relevantResults.get(input.nodeId);
    const evidence: ProgressEvidence[] = [];
    const now = new Date().toISOString();

    if (!prev) {
      if (input.valid) {
        evidence.push({
          nodeId: input.nodeId,
          attempt: input.attempt,
          kind: 'new_valid_artifact',
          detail: `artefato "${input.kind}" válido produzido (score ${input.score.toFixed(2)})`,
          at: now,
        });
      }
    } else {
      if (prev.hash === input.contentHash) {
        const sig: StagnationSignal = {
          kind: 'same_artifact_hash',
          nodeId: input.nodeId,
          detail: `tentativa ${input.attempt} produziu conteúdo idêntico à tentativa anterior (hash ${input.contentHash})`,
          attempt: input.attempt,
          detectedAt: now,
        };
        this.stagnationSignals.push(sig);
        this.consecutiveStagnantSteps++;
        this.escalateCircuitBreaker(this.consecutiveStagnantSteps >= 2 ? 4 : 2);
        this.relevantResults.set(input.nodeId, {
          kind: input.kind,
          hash: input.contentHash,
          valid: input.valid,
          score: input.score,
          unmetCount: input.unmetCriteria.length,
        });
        return { progressed: false, evidence: [], stagnation: sig };
      }

      if (input.score > prev.score) {
        evidence.push({
          nodeId: input.nodeId,
          attempt: input.attempt,
          kind: 'artifact_improved',
          detail: `score de "${input.nodeId}" subiu de ${prev.score.toFixed(2)} para ${input.score.toFixed(2)}`,
          at: now,
        });
      }
      if (input.unmetCriteria.length < prev.unmetCount) {
        evidence.push({
          nodeId: input.nodeId,
          attempt: input.attempt,
          kind: 'criteria_reduced',
          detail: `critérios pendentes em "${input.nodeId}" caíram de ${prev.unmetCount} para ${input.unmetCriteria.length}`,
          at: now,
        });
      }
      if (!prev.valid && input.valid) {
        evidence.push({
          nodeId: input.nodeId,
          attempt: input.attempt,
          kind: 'error_resolved',
          detail: `artefato de "${input.nodeId}" passou a ser válido na tentativa ${input.attempt}`,
          at: now,
        });
      }
    }

    // Verifica se erro anterior deste nó foi resolvido
    const hadPreviousError = this.knownErrors.some((e) => e.nodeId === input.nodeId);
    if (hadPreviousError && input.valid && input.unmetCriteria.length === 0) {
      evidence.push({
        nodeId: input.nodeId,
        attempt: input.attempt,
        kind: 'error_resolved',
        detail: `erro anterior do nó "${input.nodeId}" resolvido com sucesso`,
        at: now,
      });
      for (const h of this.investigatedHypotheses) {
        if (h.nodeId === input.nodeId && h.outcome === 'pending') {
          h.outcome = 'resolved';
        }
      }
    }

    this.relevantResults.set(input.nodeId, {
      kind: input.kind,
      hash: input.contentHash,
      valid: input.valid,
      score: input.score,
      unmetCount: input.unmetCriteria.length,
    });

    if (input.valid && input.unmetCriteria.length === 0) {
      this.completedStages.add(input.nodeId);
      this.pendingStages.delete(input.nodeId);
      if (this.activeStage === input.nodeId) this.activeStage = null;
    }

    if (evidence.length > 0) {
      this.progressEvidence.push(...evidence);
      this.consecutiveStagnantSteps = 0;
      return { progressed: true, evidence };
    }

    if (prev && input.unmetCriteria.length >= prev.unmetCount && !input.valid) {
      const sig: StagnationSignal = {
        kind: 'no_criteria_progress',
        nodeId: input.nodeId,
        detail: `nenhum avanço nos critérios de aceitação (${input.unmetCriteria.length} pendentes)`,
        attempt: input.attempt,
        detectedAt: now,
      };
      this.stagnationSignals.push(sig);
      this.consecutiveStagnantSteps++;
      this.escalateCircuitBreaker(this.consecutiveStagnantSteps >= 2 ? 4 : 2);
      return { progressed: false, evidence: [], stagnation: sig };
    }

    return { progressed: input.valid, evidence };
  }

  /**
   * Registra um erro em uma etapa, classifica sua natureza e verifica se é
   * uma repetição idêntica sem progresso (Fase 3.2, 3.4 e 4.1).
   */
  recordStageError(nodeId: string, attempt: number, errorText: string): {
    classified: ClassifiedError;
    repeatedCount: number;
    stagnation?: StagnationSignal;
    circuitBreakerLevel: CircuitBreakerLevel;
    shouldAbort: boolean;
    abortReason?: string;
  } {
    this.attemptsMade = Math.max(this.attemptsMade, attempt);
    const classified = classifyDetailedError(errorText);
    const normalizedErr = errorText
      .replace(/\d+ms/g, '<ms>')
      .replace(/tentativa \d+/gi, 'tentativa <n>')
      .trim()
      .toLowerCase();
    const errorHash = crypto.createHash('sha256').update(`${nodeId}:${normalizedErr}`).digest('hex').slice(0, 12);
    const now = new Date().toISOString();

    const sameErrorPrev = this.knownErrors.filter((e) => e.nodeId === nodeId && e.errorHash === errorHash);
    const sameCategoryPrev = this.knownErrors.filter((e) => e.nodeId === nodeId && e.category === classified.category);
    const repeatedCount = sameErrorPrev.length + 1;

    this.knownErrors.push({
      nodeId,
      attempt,
      category: classified.category,
      message: errorText,
      errorHash,
      at: now,
    });

    for (const h of this.investigatedHypotheses) {
      if (h.nodeId === nodeId && h.outcome === 'pending') {
        h.outcome = 'failed';
      }
    }

    // 1. Erros não-recuperáveis (auth, permissão, config) param imediatamente
    if (!classified.retryable || classified.maxCategoryRetries === 0) {
      this.escalateCircuitBreaker(5);
      const abortReason = `falha não-recuperável [${classified.category}] em "${nodeId}": ${errorText.slice(0, 220)}`;
      this.markInterrupted(abortReason, 'non_recoverable_error');
      return {
        classified,
        repeatedCount,
        circuitBreakerLevel: this.circuitBreakerLevel,
        shouldAbort: true,
        abortReason,
      };
    }

    // 2. Limite de retries por etapa ou por categoria
    if (attempt > this.limits.maxRetriesPerStage || sameCategoryPrev.length >= classified.maxCategoryRetries) {
      this.escalateCircuitBreaker(5);
      const abortReason = `limite de retentativas para "${nodeId}" [${classified.category}] atingido (tentativa ${attempt})`;
      this.markInterrupted(abortReason, 'budget_exhausted');
      return {
        classified,
        repeatedCount,
        circuitBreakerLevel: this.circuitBreakerLevel,
        shouldAbort: true,
        abortReason,
      };
    }

    // 3. Mesmo erro exato repetido na mesma etapa -> Circuit Breaker Nível 3
    if (repeatedCount >= 2) {
      const sig: StagnationSignal = {
        kind: 'same_error_repeated',
        nodeId,
        detail: `mesmo erro [${classified.category}] repetido ${repeatedCount}x em "${nodeId}": ${errorText.slice(0, 140)}`,
        attempt,
        detectedAt: now,
      };
      this.stagnationSignals.push(sig);
      this.consecutiveStagnantSteps++;
      this.escalateCircuitBreaker(repeatedCount >= 3 ? 4 : 3);

      // Se não exige/permite mudança estrutural ou já repetiu 3x, interrompe o ciclo
      if (repeatedCount >= 3 || !classified.requiresStrategyChange) {
        const abortReason = `circuit breaker (nível ${this.circuitBreakerLevel}): erro idêntico repetido ${repeatedCount}x sem progresso em "${nodeId}"`;
        this.markInterrupted(abortReason, 'loop_detected');
        return {
          classified,
          repeatedCount,
          stagnation: sig,
          circuitBreakerLevel: this.circuitBreakerLevel,
          shouldAbort: true,
          abortReason,
        };
      }

      return {
        classified,
        repeatedCount,
        stagnation: sig,
        circuitBreakerLevel: this.circuitBreakerLevel,
        shouldAbort: false,
      };
    }

    if (classified.requiresStrategyChange) {
      this.escalateCircuitBreaker(2);
    } else {
      this.escalateCircuitBreaker(1);
    }

    return {
      classified,
      repeatedCount,
      circuitBreakerLevel: this.circuitBreakerLevel,
      shouldAbort: false,
    };
  }

  /**
   * Registra uma hipótese de correção estruturada antes de reexecutar uma etapa
   * (Fase 4.3 — evita correções em cascata e repetições cegas).
   */
  recordRecoveryHypothesis(input: {
    nodeId: string;
    attempt: number;
    symptom: string;
    probableCause: string;
    evidenceUsed: string;
    plannedChange: string;
    validationCriteria: string[];
  }): InvestigatedHypothesis {
    this.lastRetryReason = `${input.probableCause} -> ${input.plannedChange}`;
    const hypothesis: InvestigatedHypothesis = {
      ...input,
      outcome: 'pending',
      at: new Date().toISOString(),
    };
    this.investigatedHypotheses.push(hypothesis);
    return hypothesis;
  }

  /**
   * Verifica antes da execução de uma ferramenta se a chamada é uma repetição
   * de uma operação recente com argumentos equivalentes (Fase 3.3).
   */
  checkToolCall(toolId: string, input: unknown, nodeId: string): ToolDeduplicationDecision {
    const { normalizedArgs, argsHash } = hashToolArgs(toolId, input);

    // Procura a chamada anterior mais recente com o mesmo hash de argumentos
    for (let i = this.toolsUsed.length - 1; i >= 0; i--) {
      const prev = this.toolsUsed[i];
      if (prev.toolId !== toolId || prev.argsHash !== argsHash) continue;

      // Se a anterior deu erro e o workspace não mudou, repetir com os mesmos argumentos é loop!
      if (prev.status === 'error' && prev.workspaceRevision === this.workspaceRevision) {
        const reason = `tool "${toolId}" já falhou com os mesmos argumentos e nenhuma alteração ocorreu no projeto: ${prev.error ?? 'erro anterior'}`;
        this.stagnationSignals.push({
          kind: 'repeated_tool_no_change',
          nodeId,
          detail: reason,
          attempt: Math.max(1, this.attemptsMade),
          detectedAt: new Date().toISOString(),
        });
        this.consecutiveStagnantSteps++;
        this.escalateCircuitBreaker(3);
        return {
          duplicate: true,
          reusable: false,
          stagnantRepeat: true,
          argsHash,
          normalizedArgs,
          previousRecord: prev,
          reason,
        };
      }

      // Para ferramentas de leitura idempotentes (`fs.read`, `project.survey`):
      // se o resultado anterior foi 'ok' e o arquivo/workspace não mudou, reutiliza com segurança!
      if (prev.status === 'ok' && IDEMPOTENT_READ_TOOLS.has(toolId)) {
        if (toolId === 'fs.read') {
          const rawInput = input as { file?: string; path?: string } | undefined;
          const targetFile = rawInput?.file ?? rawInput?.path;
          const normFile = targetFile ? path.posix.normalize(targetFile.replace(/\\/g, '/')) : '';
          const wasModifiedAfter = this.modifiedFiles.has(normFile) && prev.workspaceRevision < this.workspaceRevision;
          if (!wasModifiedAfter && prev.result !== undefined) {
            this.toolRepeatsAvoided++;
            return {
              duplicate: true,
              reusable: true,
              stagnantRepeat: false,
              argsHash,
              normalizedArgs,
              cachedResult: prev.result,
              previousRecord: prev,
              reason: `leitura idempotente de "${normFile}" reutilizada do estado da execução`,
            };
          }
        } else if (toolId === 'project.survey' && prev.workspaceRevision === this.workspaceRevision && prev.result !== undefined) {
          this.toolRepeatsAvoided++;
          return {
            duplicate: true,
            reusable: true,
            stagnantRepeat: false,
            argsHash,
            normalizedArgs,
            cachedResult: prev.result,
            previousRecord: prev,
            reason: 'survey do projeto reutilizado (nenhum arquivo modificado desde o levantamento anterior)',
          };
        }
      }

      // Para comandos de execução dependentes de estado (`code.execute`) com mesmos args e mesma revisão
      if (prev.status === 'ok' && toolId === 'code.execute' && prev.workspaceRevision === this.workspaceRevision && prev.result !== undefined) {
        this.toolRepeatsAvoided++;
        return {
          duplicate: true,
          reusable: true,
          stagnantRepeat: false,
          argsHash,
          normalizedArgs,
          cachedResult: prev.result,
          previousRecord: prev,
          reason: 'execução determinística reutilizada (mesmo código e mesma revisão do workspace)',
        };
      }

      break;
    }

    return {
      duplicate: false,
      reusable: false,
      stagnantRepeat: false,
      argsHash,
      normalizedArgs,
    };
  }

  /** Registra a conclusão de uma chamada de ferramenta e atualiza revisões de arquivos quando mutável. */
  recordToolExecution(input: {
    toolId: string;
    rawArgs: unknown;
    nodeId: string;
    ok: boolean;
    result?: unknown;
    error?: string;
    durationMs: number;
  }): ToolCallRecord {
    const { normalizedArgs, argsHash } = hashToolArgs(input.toolId, input.rawArgs);
    const now = new Date().toISOString();

    let observableEffect: ToolCallRecord['observableEffect'] = 'external';
    if (IDEMPOTENT_READ_TOOLS.has(input.toolId)) {
      observableEffect = 'read';
    } else if (MUTATING_WRITE_TOOLS.has(input.toolId)) {
      observableEffect = 'write';
      if (input.ok) {
        this.workspaceRevision++;
        const raw = input.rawArgs as { file?: string; path?: string; dir?: string } | undefined;
        const targetPath = raw?.file ?? raw?.path;
        if (targetPath) {
          const norm = path.posix.normalize(targetPath.replace(/\\/g, '/'));
          this.modifiedFiles.add(norm);
        }
        const res = input.result as { written?: string | string[] } | undefined;
        if (typeof res?.written === 'string') {
          this.modifiedFiles.add(path.posix.normalize(res.written.replace(/\\/g, '/')));
        } else if (Array.isArray(res?.written)) {
          for (const w of res.written) {
            this.modifiedFiles.add(path.posix.normalize(String(w).replace(/\\/g, '/')));
          }
        }
        this.progressEvidence.push({
          nodeId: input.nodeId,
          attempt: Math.max(1, this.attemptsMade),
          kind: 'files_modified',
          detail: `tool "${input.toolId}" atualizou arquivos no workspace (rev ${this.workspaceRevision})`,
          at: now,
        });
      }
    } else if (STATE_DEPENDENT_EXEC_TOOLS.has(input.toolId)) {
      observableEffect = 'exec';
    }

    const record: ToolCallRecord = {
      toolId: input.toolId,
      normalizedArgs,
      argsHash,
      nodeId: input.nodeId,
      status: input.ok ? 'ok' : 'error',
      ...(input.result !== undefined ? { result: input.result } : {}),
      ...(input.error !== undefined ? { error: input.error } : {}),
      executedAt: now,
      durationMs: input.durationMs,
      workspaceRevision: this.workspaceRevision,
      observableEffect,
    };
    this.toolsUsed.push(record);
    return record;
  }

  /**
   * Controle de delegações e limite de handoffs (Fase 6.1 & 6.2).
   * Impede ciclos A → B → A sem progresso demonstrável e respeita `maxDelegations`.
   */
  recordHandoff(from: string, to: string, nodeId: string, reason: string): {
    allowed: boolean;
    cycleDetected: boolean;
    reason?: string;
  } {
    const now = new Date().toISOString();

    // Detecta ciclo A -> B -> A no mesmo nó sem evidência de progresso intermediário
    const nodeHandoffs = this.handoffChain.filter((h) => h.nodeId === nodeId);
    const visitedAgents = new Set(nodeHandoffs.flatMap((h) => [h.from, h.to]));
    if (visitedAgents.has(to) && from !== to) {
      const sig: StagnationSignal = {
        kind: 'handoff_cycle',
        nodeId,
        detail: `ciclo de delegação detectado em "${nodeId}": ${[...visitedAgents, to].join(' -> ')}`,
        attempt: Math.max(1, this.attemptsMade),
        detectedAt: now,
      };
      this.stagnationSignals.push(sig);
      this.escalateCircuitBreaker(4);
      const blockReason = `ciclo de delegação bloqueado em "${nodeId}" (${from} -> ${to} já visitado sem progresso)`;
      this.markInterrupted(blockReason, 'loop_detected');
      return { allowed: false, cycleDetected: true, reason: blockReason };
    }

    if (this.delegationsCount >= this.limits.maxDelegations) {
      this.escalateCircuitBreaker(5);
      const blockReason = `orçamento de delegações/handoffs esgotado (${this.delegationsCount}/${this.limits.maxDelegations})`;
      this.markInterrupted(blockReason, 'handoff_limit');
      return { allowed: false, cycleDetected: false, reason: blockReason };
    }

    this.delegationsCount++;
    this.handoffChain.push({ from, to, nodeId, reason, at: now });
    return { allowed: true, cycleDetected: false };
  }

  /**
   * Verifica se um replanejamento produziu exatamente o mesmo plano anterior
   * (Fase 3.2 — detector de repetição de plano).
   */
  recordPlanUpdate(graphId: string, mode: ExecutionMode, nodes: Array<{ id: string; agent?: string; status?: string }>): {
    changed: boolean;
    stagnation?: StagnationSignal;
  } {
    const activeSignature = nodes
      .filter((n) => n.status !== 'skipped' && n.status !== 'succeeded')
      .map((n) => `${n.id}:${n.agent ?? 'none'}`)
      .join('->');

    if (activeSignature === this.currentPlan.planSignature) {
      const sig: StagnationSignal = {
        kind: 'same_plan_repeated',
        nodeId: nodes[0]?.id ?? 'graph',
        detail: `replanejamento produziu a mesma topologia ativa (${activeSignature})`,
        attempt: Math.max(1, this.attemptsMade),
        detectedAt: new Date().toISOString(),
      };
      this.stagnationSignals.push(sig);
      this.consecutiveStagnantSteps++;
      this.escalateCircuitBreaker(3);
      return { changed: false, stagnation: sig };
    }

    this.currentPlan = {
      graphId,
      mode,
      nodes: nodes.map((n) => n.id),
      planSignature: activeSignature,
    };
    for (const n of nodes) {
      if (n.status !== 'succeeded' && n.status !== 'skipped') {
        this.pendingStages.add(n.id);
      }
    }
    return { changed: true };
  }

  /** Marca explicitamente a execução como interrompida (Fase 3.5 — nunca confundir interrupção com sucesso). */
  markInterrupted(reason: string, category: InterruptionInfo['category']): void {
    if (this.interrupted) return;
    this.interrupted = {
      reason,
      category,
      atPhase: this.lifecyclePhase,
      circuitBreakerLevel: this.circuitBreakerLevel,
      completedStages: Array.from(this.completedStages),
      pendingStages: Array.from(this.pendingStages),
    };
  }

  get isInterrupted(): boolean {
    return this.interrupted !== undefined;
  }

  get interruption(): InterruptionInfo | undefined {
    return this.interrupted;
  }

  /** Verifica se todos os erros registrados foram de autenticação/infraestrutura externa. */
  get failedOnlyByInfrastructure(): boolean {
    if (this.knownErrors.length === 0) return false;
    return this.knownErrors.every((e) => {
      const c = classifyDetailedError(e.message);
      return c.isInfrastructureOrAuth;
    });
  }

  private escalateCircuitBreaker(level: CircuitBreakerLevel): void {
    if (level > this.circuitBreakerLevel) {
      this.circuitBreakerLevel = level;
    }
  }

  /** Devolve o snapshot estruturado completo da execução (Fase 2.1). */
  snapshot(opts?: { verifiedCount?: number; totalRequired?: number }): ExecutionStateSnapshot {
    const elapsed = Math.max(0, Date.now() - this.startedAt);
    const totalReq = opts?.totalRequired ?? Math.max(1, this.completedStages.size + this.pendingStages.size);
    const verified = opts?.verifiedCount ?? this.completedStages.size;
    const met = !this.interrupted && this.pendingStages.size === 0 && verified >= totalReq;

    const resultsObj: ExecutionStateSnapshot['relevantResults'] = {};
    for (const [k, v] of this.relevantResults.entries()) {
      resultsObj[k] = v;
    }

    const phaseDurationsMs: Record<ExecutionLifecyclePhase, number> = {
      planning: 0,
      execution: 0,
      validation: 0,
      recovery: 0,
      finalization: 0,
    };
    const now = Date.now();
    for (const p of this.phaseHistory) {
      const dur = p.durationMs ?? Math.max(0, (p.endedAt ?? now) - p.startedAt);
      phaseDurationsMs[p.phase] = (phaseDurationsMs[p.phase] ?? 0) + dur;
    }

    return {
      runId: this.runId,
      originalObjective: this.originalObjective,
      strategy: this.strategy,
      lifecyclePhase: this.lifecyclePhase,
      acceptanceCriteria: [...this.acceptanceCriteria],
      currentPlan: { ...this.currentPlan, nodes: [...this.currentPlan.nodes] },
      activeStage: this.activeStage,
      completedStages: Array.from(this.completedStages),
      pendingStages: Array.from(this.pendingStages),
      modifiedFiles: Array.from(this.modifiedFiles),
      toolsUsed: [...this.toolsUsed],
      skillsLoaded: Array.from(this.skillsLoaded),
      relevantResults: resultsObj,
      knownErrors: [...this.knownErrors],
      investigatedHypotheses: [...this.investigatedHypotheses],
      attemptsMade: this.attemptsMade,
      llmTurns: this.llmTurns,
      delegationsCount: this.delegationsCount,
      handoffChain: [...this.handoffChain],
      remainingBudget: {
        iterations: Math.max(0, this.limits.maxIterations - this.attemptsMade),
        llmTurns: Math.max(0, this.limits.maxLlmTurns - this.llmTurns),
        toolCalls: Math.max(0, this.limits.maxToolCalls - this.toolsUsed.length),
        delegations: Math.max(0, this.limits.maxDelegations - this.delegationsCount),
        tokens: Math.max(0, this.limits.maxTokens - this.tokensSpent),
        timeMs: Math.max(0, this.limits.maxTimeMs - elapsed),
        ...(this.limits.maxCostUsd !== undefined
          ? { costUsd: Math.max(0, Number((this.limits.maxCostUsd - this.costSpentUsd).toFixed(6))) }
          : {}),
      },
      deadlineAt: this.deadlineAt,
      ...(this.lastRetryReason ? { lastRetryReason: this.lastRetryReason } : {}),
      progressEvidence: [...this.progressEvidence],
      stagnationSignals: [...this.stagnationSignals],
      circuitBreakerLevel: this.circuitBreakerLevel,
      completionCondition: {
        met,
        reason: this.interrupted
          ? `interrompido (${this.interrupted.category}): ${this.interrupted.reason}`
          : met
            ? 'todos os critérios de aceitação obrigatórios foram verificados'
            : `${this.pendingStages.size} etapa(s) pendente(s) de verificação`,
        verifiedCount: verified,
        totalRequired: totalReq,
      },
      ...(this.interrupted ? { interrupted: { ...this.interrupted } } : {}),
      toolRepeatsAvoided: this.toolRepeatsAvoided,
      phaseDurationsMs,
      phaseHistory: this.phaseHistory.map((p) => ({ ...p })),
    };
  }
}

/* ============================ FEEDBACK DIRIGIDO PARA RETENTATIVAS (FASE 4.3) ============================ */

/**
 * Formata instruções concretas de correção para injetar em `node.metadata.correction`
 * quando a validação de schema ou a VerificationEngine reprova um artefato.
 *
 * Corrige o Gargalo 5 da auditoria: antes, apenas `interpretCritique` populava
 * `node.metadata.correction`, então uma retentativa por falha de verificação
 * chamava o modelo com exatamente o mesmo prompt e repetia o mesmo erro.
 */
export function formatValidationCorrection(input: {
  nodeId: string;
  attempt: number;
  errorCategory: DetailedErrorCategory;
  unmetCriteria: string[];
  errorMessage: string;
  plannedChange: string;
}): string {
  const lines: string[] = [
    `Correção localizada obrigatória para "${input.nodeId}" (tentativa ${input.attempt + 1}, falha: ${input.errorCategory}):`,
    `- Sintoma observado: ${input.errorMessage.slice(0, 240)}`,
    `- Mudança exigida nesta tentativa: ${input.plannedChange}`,
  ];
  if (input.unmetCriteria.length > 0) {
    lines.push('- Critérios de aceitação reprovados que DEVEM ser atendidos agora:');
    for (const c of input.unmetCriteria.slice(0, 6)) {
      lines.push(`  • ${c}`);
    }
  }
  lines.push('- Preserve tudo que já estava válido na entrega anterior e corrija especificamente os itens acima.');
  return lines.join('\n');
}

/**
 * Estima se delegar/expandir uma tarefa em múltiplos agentes compensa o custo
 * de inicialização e transferência de contexto (Fase 6.1).
 */
export function evaluateDelegationBenefit(input: {
  complexity: number;
  domainsCount: number;
  wordCount: number;
  isQuestionOrTrivial: boolean;
  explicitMode?: ExecutionMode;
}): { shouldDelegate: boolean; recommendedMode: ExecutionMode; reason: string } {
  if (input.explicitMode) {
    return {
      shouldDelegate: input.explicitMode === 'orchestrated' || input.explicitMode === 'autonomous',
      recommendedMode: input.explicitMode,
      reason: `modo explícito solicitado (${input.explicitMode})`,
    };
  }
  if (input.isQuestionOrTrivial || (input.complexity <= 1 && input.domainsCount <= 1)) {
    return {
      shouldDelegate: false,
      recommendedMode: 'direct',
      reason: 'benefício de delegação inferior ao custo de inicialização: execução direta em 1 etapa',
    };
  }
  // Correções curtas (<= 12 palavras) mesmo tocando 2-3 palavras-chave de domínio
  // (ex.: "corrigir bug na api e testar") não justificam grafo de 7-9 agentes.
  if (input.wordCount <= 12 && input.complexity <= 3 && input.domainsCount <= 3) {
    return {
      shouldDelegate: false,
      recommendedMode: 'assisted',
      reason: `enunciado curto (${input.wordCount} palavras): especialista único + verificação determinística evita overhead de múltiplos handoffs`,
    };
  }
  if (input.complexity === 2) {
    return {
      shouldDelegate: false,
      recommendedMode: 'assisted',
      reason: 'complexidade moderada-baixa: um especialista com verificação determinística supera o custo de um grafo multiagente',
    };
  }
  if (input.complexity >= 5 || (input.domainsCount >= 3 && input.wordCount > 15)) {
    return {
      shouldDelegate: true,
      recommendedMode: 'autonomous',
      reason: `escopo amplo (complexidade ${input.complexity}, ${input.domainsCount} domínios): delegação multiagente justificada`,
    };
  }
  return {
    shouldDelegate: true,
    recommendedMode: 'orchestrated',
    reason: `tarefa composta (complexidade ${input.complexity}): grafo enxuto sem crítica adversarial redundante`,
  };
}
