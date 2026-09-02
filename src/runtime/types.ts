/**
 * Izanagi AI Runtime — Tipos compartilhados
 *
 * Núcleo tipado do Adaptive Agent & Skill Runtime: evaluation, execution graph,
 * routing, memória de falhas, self-healing, tracing e contratos.
 *
 * Nenhuma dependência externa. Todos os módulos do runtime consomem estes tipos.
 */

/* ============================ VERDICTS ============================ */

export type Verdict = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN';

export type MetricName =
  | 'correctness'
  | 'requirementCoverage'
  | 'testResults'
  | 'architecture'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'confidence'
  | 'cost'
  | 'latency'
  | 'artifactValidity';

export type Metrics = Partial<Record<MetricName, number>>;

export interface TestSummary {
  passed: number;
  failed: number;
  skipped?: number;
  total?: number;
  durationMs?: number;
  failures?: Array<{ name: string; message: string; file?: string }>;
}

export interface EvaluationResult {
  /** Verdict computado pelos thresholds. */
  verdict: Verdict;
  /** Score global ponderado em [0,1]. */
  score: number;
  /** Confiança da avaliação em [0,1]. */
  confidence: number;
  metrics: Metrics;
  tests?: TestSummary;
  regressions: string[];
  recommendations: string[];
  /** Thresholds usados para derivar o verdict. */
  thresholds?: EvaluationThresholds;
}

export interface EvaluationThresholds {
  pass: number;
  passWithWarnings: number;
}

export interface EvaluationReport extends EvaluationResult {
  taskId: string;
  task: string;
  agentId?: string;
  createdAt: string;
  durationMs?: number;
  artifacts?: ArtifactRef[];
  weightings?: MetricWeightings;
}

export interface MetricWeightings {
  correctness: number;
  requirementCoverage: number;
  testResults: number;
  architecture: number;
  security: number;
  performance: number;
  maintainability: number;
  artifactValidity: number;
}

/* ============================ ARTIFACTS & CONTRACTS ============================ */

export type ArtifactKind =
  | 'requirements'
  | 'architecture'
  | 'database-schema'
  | 'api-contract'
  | 'security-report'
  | 'test-plan'
  | 'implementation-plan'
  | 'evaluation'
  | 'benchmark-report'
  | 'research'
  | 'trace'
  | 'critique'
  | 'raw';

export interface ArtifactRef {
  kind: ArtifactKind;
  path?: string;
  name: string;
  /** Tamanho em bytes (0 quando não materializado). */
  size?: number;
  /** Hash simples do conteúdo para detecção de duplicação. */
  hash?: string;
  valid?: boolean;
  issues?: string[];
  /**
   * Proveniência — preenchida quando o artefato passou pelo `ArtifactRegistry`
   * (`runtime/artifacts/registry.ts`); ausente para artefatos construídos
   * soltos via `makeArtifact()` antes de qualquer registro (ex.: benchmarks).
   */
  id?: string;
  /** Quem produziu — agente e/ou skill responsável (formato livre, ex. "senior-engineer/tdd"). */
  producer?: string;
  createdAt?: string;
  status?: 'valid' | 'invalid';
}

/** Schema mínimo de um artefato — usado pelo validators.ts. */
export interface ArtifactSchema {
  kind: ArtifactKind;
  /** Campos obrigatórios do artefato. */
  required: string[];
  /** Validações por campo: [campo, regex, mensagem]. */
  patterns?: Array<[string, RegExp, string]>;
  /** Tamanho mínimo de conteúdo (bytes). */
  minSize?: number;
  /** Proibido: strings que indicam stub/lazy code. */
  forbidden?: string[];
  /** Validação custom (assinatura simples de função). */
  validate?: (content: unknown) => string[];
  /**
   * Trecho que a SIMULAÇÃO headless precisa conter para satisfazer `validate`.
   * Só existe em schema com validação custom: os campos de `required` já são
   * derivados automaticamente. Mora aqui, junto do schema, porque schema e
   * simulação divergirem em silêncio é exatamente o bug que isto evita.
   */
  simulationHint?: string;
}

/* ============================ EXECUTION GRAPH ============================ */

export type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'retrying' | 'blocked';

export type RetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
  /** Multiplicador de backoff a cada tentativa. */
  backoffFactor?: number;
  /** Se true, falha de validação de artefato conta como retryable. */
  retryOnValidation?: boolean;
};

export interface GraphNode {
  id: string;
  kind: 'agent' | 'skill' | 'tool' | 'validator' | 'evaluator' | 'aggregator' | 'parallel' | 'gate' | 'approval';
  agent?: string;
  skills?: string[];
  inputs?: string[];
  outputs?: string[];
  /** Ids de nós que devem concluir antes deste. */
  dependencies?: string[];
  /** Condição de execução (expressão JS simples sobre o estado). */
  condition?: string;
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
  tokenBudget?: number;
  validator?: string;
  status?: NodeStatus;
  attempts?: number;
  artifacts?: ArtifactRef[];
  error?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionGraph {
  id: string;
  task: string;
  createdAt: string;
  nodes: GraphNode[];
  /** Topological order computada pelo planner. */
  order: string[];
  /** Etapas paralelas detectadas: grupos de ids executáveis juntos. */
  parallelBatches: string[][];
  /** Orçamento global. */
  budget: {
    maxAttempts: number;
    maxTokens: number;
    maxTimeMs: number;
  };
}

/* ============================ ROUTING / SCORING ============================ */

export interface CandidateScore {
  candidate: string;
  relevance: number;
  historicalSuccess: number;
  compatibility: number;
  risk: number;
  cost: number;
  latency: number;
  finalScore: number;
  reasons: string[];
}

export interface AgentGenome {
  name: string;
  version: string;
  purpose: string;
  capabilities: string[];
  requiredSkills: string[];
  optionalSkills: string[];
  inputs: string[];
  outputs: string[];
  constraints: string[];
  permissions: string[];
  handoffs: Array<{ to: string; reason: string }>;
  memory: string[];
  evaluation: { metrics: MetricName[]; minScore: number };
  tokenBudget: number;
  compatibility: string;
  model?: string;
  /** Campos legacy preservados (compatibilidade). */
  role?: string;
  identity?: string;
  skills?: string[];
  chains?: Record<string, string[]>;
  always?: string[];
  never?: string[];
}

/**
 * Ciclo de vida de uma skill. Skills curadas do framework nascem `active`;
 * skills geradas pela Skill Factory nascem `draft` (passaram no security
 * scan mas ainda não têm histórico de uso real) — nunca "Generate →
 * Automatically trust".
 */
export type SkillLifecycle = 'discovered' | 'draft' | 'validated' | 'active' | 'deprecated' | 'archived';

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  /** Default 'active' (skills curadas pré-existentes) quando não declarado no frontmatter. */
  lifecycle?: SkillLifecycle;
  capabilities: string[];
  triggers: string[];
  dependencies: string[];
  inputs: string[];
  outputs: string[];
  permissions: string[];
  compatibility: string;
  risk: 'low' | 'medium' | 'high';
  tokenBudget: number;
  evaluation?: { metrics: MetricName[]; minScore?: number };
  examples?: string[];
  changelog?: Array<{ version: string; date?: string; change: string }>;
  /** Conteúdo cru do SKILL.md (sem frontmatter). */
  body?: string;
  path?: string;
}

/* ============================ FAILURE MEMORY ============================ */

export type MemoryCategory = 'episodic' | 'semantic' | 'procedural' | 'decision' | 'failure' | 'skill' | 'project';

export type FailureKind =
  | 'recoverable'
  | 'non-recoverable'
  | 'planning'
  | 'tool'
  | 'agent'
  | 'validation'
  | 'dependency'
  | 'unknown';

/**
 * Taxonomia de ORIGEM da falha (independente de `FailureKind`, que classifica a
 * ESTRATÉGIA de recuperação). Existe para relatório/observabilidade — nunca
 * substitui `FailureKind`, que continua governando a lógica de cura em
 * `recovery/healing.ts`.
 */
export type FailureCategory =
  | 'MODEL_FAILURE'
  | 'TOOL_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'ARTIFACT_FAILURE'
  | 'TEST_FAILURE'
  | 'SECURITY_FAILURE'
  | 'TIMEOUT'
  | 'DEPENDENCY_FAILURE'
  | 'CONFIGURATION_FAILURE'
  | 'ENVIRONMENT_FAILURE'
  | 'AGENT_FAILURE'
  | 'UNKNOWN_FAILURE';

export interface FailurePattern {
  pattern: string;
  symptoms: string[];
  rootCause: string;
  solution: string;
  confidence: number;
  occurrences: number;
  kind?: FailureKind;
  firstSeen?: string;
  lastSeen?: string;
  tags?: string[];
  /**
   * Memory Lifecycle (create/retrieve/update/promote/invalidate/archive).
   * Ausente = 'active' (compatibilidade com padrões gravados antes deste campo existir).
   * 'invalidated' = a solução registrada não se aplica mais (codebase mudou, causa raiz
   * era outra) — para de ser sugerida por `findRelevantFailures`, mas fica no histórico.
   * 'archived' = decisão manual e final de não usar mais este padrão (não é reativado
   * automaticamente por uma nova ocorrência, ao contrário de 'invalidated').
   */
  status?: 'active' | 'invalidated' | 'archived';
  invalidatedReason?: string;
}

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source?: string;
  confidence?: number;
}

/* ============================ TRACING ============================ */

export interface TraceSpan {
  id: string;
  name: string;
  type: 'task' | 'decision' | 'agent' | 'skill' | 'tool' | 'model' | 'evaluation' | 'retry' | 'healing' | 'artifact' | 'memory';
  status: 'ok' | 'error' | 'skipped' | 'blocked';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface RunTrace {
  runId: string;
  task: string;
  /** Desempate monotônico dentro do processo para runs com o mesmo startedAt (ms). */
  seq?: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  command: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  retries: number;
  failures: number;
  agents: string[];
  skills: string[];
  tools: string[];
  artifacts: ArtifactRef[];
  evaluation?: EvaluationReport;
  healing?: HealingAction[];
  spans: TraceSpan[];
  graph?: ExecutionGraph;
  /** Token Budget 2.0 — gasto por fase (planning/execution/evaluation/recovery). */
  budget?: Record<string, { spent: number; remaining: number }>;
  /**
   * Modo de execução escolhido pelo Commander (direct/assisted/orchestrated/
   * autonomous). Ausente em runs planejados pelo caminho legado.
   */
  mode?: string;
  /** Token Economy Engine: tokens, custo, cache, paralelismo, escaladas, degradação. */
  telemetry?: Record<string, unknown>;
  /** Verificação por nó (Verification Engine 2.0): VERIFIED / UNVERIFIED / FAILED. */
  verification?: Array<{ nodeId: string; status: string; score: number; reason: string; unmet: string[] }>;
  /**
   * Protocolo agente-a-agente: quem falou com quem durante o run. Carrega
   * referência de artefato e resumo de uma linha, nunca o conteúdo produzido
   * (senão o trace viraria uma segunda cópia do run inteiro).
   */
  conversation?: Array<{
    id: string;
    from: string;
    to: string;
    type: string;
    taskId: string;
    artifactRefs?: string[];
    summary: string;
    confidence?: number;
    timestamp: string;
  }>;
}

/* ============================ SELF-HEALING ============================ */

export type HealingActionKind = 'local_repair' | 'replan' | 'handoff' | 'skill_replacement' | 'retry' | 'abort';

export interface HealingAction {
  id: string;
  kind: HealingActionKind;
  failureKind: FailureKind;
  /** Taxonomia de origem (MODEL_FAILURE, TOOL_FAILURE, ...) — ver `FailureCategory`. */
  category: FailureCategory;
  message: string;
  nodeId?: string;
  /** Skill/agente substituto (skill_replacement / handoff). */
  replacement?: string;
  /** Novo grafo gerado no replan. */
  newGraphId?: string;
  matchedPattern?: string;
  createdAt: string;
}

/* ============================ MODEL ROUTING ============================ */

export type ModelTier = 'fast' | 'balanced' | 'premium';

export interface ModelProvider {
  id: string;
  name: string;
  models: ModelSpec[];
}

export interface ModelSpec {
  id: string;
  tier: ModelTier;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  avgLatencyMs: number;
  reasoning: 'low' | 'medium' | 'high';
  score?: number;
}

export interface RoutingContext {
  task: string;
  taskComplexity: 1 | 2 | 3 | 4 | 5;
  reasoningRequirement: 'low' | 'medium' | 'high';
  risk: number;
  tokenBudget: number;
  requiresTools: boolean;
  historicalPerformance?: Record<string, number>;
}

/* ============================ BENCHMARKS ============================ */

export type BenchmarkDomain =
  | 'coding'
  | 'debugging'
  | 'architecture'
  | 'security'
  | 'database'
  | 'frontend'
  | 'backend'
  | 'automation'
  | 'research'
  | 'refactoring';

export interface BenchmarkCase {
  id: string;
  domain: BenchmarkDomain;
  task: string;
  requirements: string[];
  expectedArtifacts: string[];
  /** Funções de validação simples: [nome, mensagem] sobre o output. */
  validators?: Array<{ name: string; message: string; check: string }>;
  metrics: MetricName[];
  tags: string[];
}

export interface BenchmarkResult {
  caseId: string;
  domain: BenchmarkDomain;
  passed: boolean;
  score: number;
  artifactsFound: string[];
  artifactsMissing: string[];
  validatorFailures: string[];
  metrics: Metrics;
  durationMs: number;
  tokensUsed?: number;
}

export interface BenchmarkReport {
  id: string;
  suite: string;
  version: string;
  createdAt: string;
  frameworkVersion: string;
  results: BenchmarkResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgScore: number;
    totalDurationMs: number;
  };
  /** Pontuação média por domínio. */
  byDomain: Record<string, number>;
}

/* ============================ SECURITY (SKILL SCAN) ============================ */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ScanFinding {
  severity: RiskLevel;
  rule: string;
  message: string;
  line?: number;
  match?: string;
}

export interface SkillScanResult {
  skill: string;
  path: string;
  score: number;
  level: RiskLevel;
  findings: ScanFinding[];
  scannedAt: string;
  /** Trust tier de origem (builtin/generated/community) — determina o bloqueio escalonado. */
  trustTier?: 'builtin' | 'generated' | 'community';
  /** Decisão final considerando o trust tier: 'allow' | 'warn' | 'block'. */
  verdict?: 'allow' | 'warn' | 'block';
}

/* ============================ HANDOFF ============================ */

export interface Handoff {
  from: string;
  to: string;
  reason: string;
  context: Record<string, unknown>;
  artifacts: string[];
  decisions: string[];
  constraints: string[];
  openQuestions: string[];
}

/* ============================ STATE ============================ */

export interface AgentStats {
  runs: number;
  successes: number;
  failures: number;
  avgScore: number;
  avgTokens: number;
  lastRunAt?: string;
  /**
   * Mesma estatística recortada por domínio técnico do run. Um agente que vai
   * bem em backend e mal em frontend não pode ser julgado por uma média só.
   * Ausente em estado gravado antes desta versão (o global continua valendo).
   */
  byDomain?: Record<string, { runs: number; successes: number; failures: number; avgScore: number }>;
}

export interface SkillStats {
  uses: number;
  successes: number;
  failures: number;
  avgScore: number;
  avgTokens: number;
  lastUsedAt?: string;
}

export interface ModelStats {
  runs: number;
  successes: number;
  failures: number;
  avgScore: number;
  avgTokens: number;
  lastRunAt?: string;
}

export interface RuntimeState {
  schemaVersion: number;
  agents: Record<string, AgentStats>;
  skills: Record<string, SkillStats>;
  /** Histórico de performance por modelo (ex.: "claude-sonnet-4-5") — alimenta RoutingContext.historicalPerformance. */
  models: Record<string, ModelStats>;
  failures: Record<string, FailurePattern>;
  learnings: Array<{ id: string; text: string; source: string; createdAt: string; confidence: number }>;
  updatedAt: string;
}
