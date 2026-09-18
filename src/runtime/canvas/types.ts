/**
 * Canvas Orchestration — tipos do subsistema de orquestração visual.
 *
 * O canvas (JSON Canvas 1.0) é a CAMADA DE CONTROLE: um workflow declarativo.
 * O runtime Izanagi continua sendo o PLANO DE EXECUÇÃO e fonte da verdade.
 *
 * Arquitetura:
 *   .canvas → Parser → Schema/Semantic Validation → WorkflowIR → Scheduler → Runtime
 *
 * O `WorkflowIR` é a representação interna sobre a qual o runtime opera — nunca
 * o JSON cru do canvas. Nenhuma dependência externa.
 */

import type { ModelSpec, ModelTier, NodeStatus, RetryPolicy, ExecutionGraph, GraphNode } from '../types.js';

/* ============================ CANVAS (JSON Canvas 1.0) ============================ */

/** Tipos de nó do spec JSON Canvas 1.0 (jsoncanvas.org/spec/1.0). */
export type CanvasNodeType = 'text' | 'file' | 'link' | 'group';

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Node 'text'. */
  text?: string;
  /** Node 'file'. */
  file?: string;
  /** Node 'link'. */
  url?: string;
  /** Node 'group' — filhos referenciados por id. */
  children?: string[];
  /** Cor da borda (canvas). */
  color?: string;
  /** Namespace Izanagi: semântica de execução do nó. */
  izanagi?: IzanagiNodeMetadata;
  /** Campos desconhecidos de apps compatíveis — preservados intactos. */
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: string;
  toSide?: string;
  endArrow?: 'none' | 'triangle' | 'arrow';
  color?: string;
  label?: string;
  /** Namespace Izanagi: tipo de mensagem e condição de roteamento. */
  izanagi?: IzanagiEdgeMetadata;
  /** Campos desconhecidos de apps compatíveis — preservados intactos. */
  [key: string]: unknown;
}

export interface CanvasDefinition {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** Campos desconhecidos de apps compatíveis — preservados intactos. */
  [key: string]: unknown;
}

/* ============================ SEMÂNTICA IZANAGI ============================ */

/** Kinds semânticos suportados pelo runtime do canvas (camada sobre os tipos do spec). */
export type IzanagiNodeKind =
  | 'agent'
  | 'orchestrator'
  | 'evaluator'
  | 'skill'
  | 'model'
  | 'router'
  | 'memory'
  | 'tool'
  | 'webhook'
  | 'condition'
  | 'parallel'
  | 'merge'
  | 'input'
  | 'output'
  | 'human-review'
  | 'group';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface NodeModelConfig {
  /** `auto`: o ModelRouter decide pelo papel/tier. `manual`: provider+model fixados. `inherit`: herda do run. */
  mode: 'auto' | 'manual' | 'inherit';
  provider?: string;
  model?: string;
  reasoning?: { effort: ReasoningEffort };
  thinking?: { type: 'adaptive'; effort: ReasoningEffort };
  limits?: {
    maxCompletionTokens?: number;
    temperature?: number;
    topP?: number;
  };
}

export type ContextMode = 'full' | 'selective' | 'summary' | 'artifact' | 'message-only';

export interface NodeContextPolicy {
  mode: ContextMode;
  /** `selective`: caminhos a incluir (ex.: `input`, `architect.result`, `security.critique`). */
  include?: string[];
  /** Caminhos a excluir mesmo quando o modo incluiria. */
  exclude?: string[];
  /** `summary`: resumir entradas acima deste tamanho (chars). */
  summarizeAbove?: number;
}

export type EdgeConditionType = 'success' | 'failure' | 'score' | 'output' | 'message' | 'custom';

export interface EdgeCondition {
  type: EdgeConditionType;
  /** Expressão sandboxed (gramática restrita — NUNCA JS arbitrário). */
  expression?: string;
  /** `score`: limiar de aprovação (ex.: `result.score >= 0.8`). */
  threshold?: number;
  /** `output`: campo do output a inspecionar (ex.: `result.ok`). */
  field?: string;
  /** `message`: tipo de mensagem que satisfaz a aresta. */
  messageType?: string;
}

export interface LoopConfig {
  /** Teto de iterações — previne execução infinita. Obrigatório quando há loop. */
  maxIterations: number;
  /** Condição sandboxed de término (ex.: `result.score >= 0.8`). Ausente: itera até o teto. */
  terminationCondition?: string;
  timeoutMs?: number;
  tokenBudget?: number;
}

export interface IzanagiNodeMetadata {
  kind: IzanagiNodeKind;
  /** Node `agent`/`orchestrator`/`evaluator`: id do agente no registry (ex.: `architect`). */
  agent?: string;
  /** Skills atribuídas ao nó. */
  skills?: string[];
  /** Configuração de modelo por nó. Ausente: `auto`. */
  model?: NodeModelConfig;
  /** Política de contexto. Ausente: `full`. */
  context?: NodeContextPolicy;
  /** Política de retry local do nó. */
  retry?: RetryPolicy;
  timeoutMs?: number;
  tokenBudget?: number;
  /** Expressão sandboxed de condição de EXECUÇÃO do próprio nó. */
  condition?: string;
  /** Permissões exigidas do nó (ex.: `fs:read`, `shell`). */
  permissions?: string[];
  /** Semântica de loop controlado. */
  loop?: LoopConfig;
  /** Tool do node `tool` (id registrada no ToolRegistry). */
  tool?: string;
  /** Mensagem humana exigida no node `human-review`. */
  prompt?: string;
  /** Campos desconhecidos de apps compatíveis dentro do namespace — preservados. */
  [key: string]: unknown;
}

export interface IzanagiEdgeMetadata {
  /** Tipo de mensagem trocada entre os nós — canal de comunicação real. */
  messageType?: 'task' | 'result' | 'question' | 'answer' | 'handoff' | 'critique' | 'request-review' | 'approval' | 'rejection' | 'error' | 'escalation';
  /** Condição de roteamento da aresta. Ausente: `success` (default). */
  condition?: EdgeCondition;
  [key: string]: unknown;
}

/* ============================ WORKFLOW IR ============================ */

/** Nó de runtime compilado — o que o scheduler/executor consomem. */
export interface RuntimeNode {
  id: string;
  kind: IzanagiNodeKind;
  label?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Nó `agent`/`orchestrator`/`evaluator`: id do agente (ex.: `architect`). */
  agent?: string;
  skills?: string[];
  model?: NodeModelConfig;
  context?: NodeContextPolicy;
  retry?: RetryPolicy;
  timeoutMs?: number;
  tokenBudget?: number;
  condition?: string;
  permissions?: string[];
  loop?: LoopConfig;
  tool?: string;
  prompt?: string;
  /** Grapo de execução: kind mapeado para o GraphNode do runtime. */
  graphKind?: GraphNode['kind'];
  /** Campos desconhecidos preservados. */
  extra: Record<string, unknown>;
  /** Preenchido em execução. */
  status?: NodeStatus;
  attempts?: number;
  error?: string;
}

export interface RuntimeEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  messageType?: IzanagiEdgeMetadata['messageType'];
  condition?: EdgeCondition;
  extra: Record<string, unknown>;
}

export interface WorkflowIR {
  id: string;
  name?: string;
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
  entryNodes: string[];
  exitNodes: string[];
  capabilities: {
    hasLoops: boolean;
    hasParallelBranches: boolean;
    hasExternalEndpoints: boolean;
  };
}

/* ============================ ESTADO DO WORKFLOW ============================ */

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** Estado compartilhado controlado — agentes recebem só o contexto do seu nó. */
export interface WorkflowState {
  runId: string;
  input: unknown;
  artifacts: Record<string, unknown>;
  messages: AgentMessage[];
  nodeResults: Record<string, CanvasNodeResult>;
  variables: Record<string, unknown>;
  memoryRefs: string[];
  metrics: {
    totalTokens: number;
    totalLatencyMs: number;
    estimatedCost?: number;
  };
  status: WorkflowStatus;
}

export interface CanvasNodeResult {
  nodeId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'skipped';
  output?: unknown;
  score?: number;
  tokensUse?: { input: number; output: number; total: number };
  costUsd?: number;
  latencyMs?: number;
  error?: string;
  attempts?: number;
  startedAt?: string;
  endedAt?: string;
}

/* ============================ PROTOCOLO A2A ============================ */

export type AgentMessageType = 'task' | 'result' | 'question' | 'answer' | 'handoff' | 'critique' | 'request-review' | 'approval' | 'rejection' | 'error' | 'escalation';

export interface AgentMessage {
  id: string;
  runId: string;
  from: string;
  to: string | string[];
  type: AgentMessageType;
  payload: Record<string, unknown>;
  metadata: {
    timestamp: string;
    priority?: 'low' | 'normal' | 'high';
    tokenEstimate?: number;
    correlationId?: string;
  };
}

/** Resolução de modelo por nó (auto via ModelRouter ou manual com sanitização). */
export interface ResolvedNodeModel {
  provider: string;
  model: ModelSpec;
  tier: ModelTier;
  reasons: string[];
  warnings: string[];
  sanitized: NodeModelConfig;
}