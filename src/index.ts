export * from './cli/index.js';
export * from './installer.js';

/**
 * SDK programático: `izanagi.run({ objective })` e `izanagi.plan({ objective })`.
 * Mesma engine da CLI, sem saída no terminal.
 */
export { izanagi, run, plan } from './sdk.js';
export type {
  IzanagiRunOptions,
  IzanagiRunResult,
  IzanagiRunHandle,
  IzanagiEventSelector,
} from './sdk.js';

/**
 * Canvas Orchestration: o mesmo motor `executeWorkflow` usado pela CLI
 * (`izanagi canvas run`) e pelo editor visual (`izanagi canvas ui`). O SDK
 * expõe `orchestrate`, que carrega um workflow (objeto ou arquivo) e executa
 * contra o runtime real, com o mesmo roteamento de modelo do `run`.
 */
export {
  CanvasWorkflow,
  CanvasExecutionError,
  executeWorkflow,
  orchestrate,
} from './runtime/canvas/api.js';
export { orchestrate as orchestrateCanvas } from './sdk.js';
export type {
  ExecuteWorkflowOptions,
  WorkflowRunResult,
  CanvasInspection,
} from './runtime/canvas/api.js';
export type {
  WorkflowEventType,
  WorkflowEvent,
  NodeStartedEvent,
  NodeCompletedEvent,
  NodeFailedEvent,
  MessageSentEvent,
  ModelResolvedEvent,
  WorkflowLifecycleEvent,
} from './runtime/canvas/workflow-events.js';

/** Primitivas do runtime expostas para integração e extensão. */
export { Commander, classify, decideMode } from './runtime/orchestration/commander.js';
export type { CommanderPlan, Classification } from './runtime/orchestration/commander.js';
export { VerificationEngine } from './runtime/verification/engine.js';
export type { VerificationResult, VerificationStatus } from './runtime/verification/engine.js';
export { ExecutionBudget } from './runtime/token/execution-budget.js';
export type { TokenTelemetry, ExecutionBudgetLimits } from './runtime/token/execution-budget.js';
export { ModelRouter } from './runtime/model/router.js';
export { AgentCapabilityRegistry } from './runtime/registry/capabilities.js';
export { ContextResolver } from './runtime/orchestration/context-resolver.js';
export { ResponseCache } from './runtime/cache/response-cache.js';
export { parseCritique, formatCorrection, createMessage } from './runtime/protocol/messages.js';
export type { AgentMessage, Critique, CritiqueIssue } from './runtime/protocol/messages.js';
export type {
  TaskContract,
  ExecutionMode,
  AgentRole,
  AcceptanceCriterion,
} from './runtime/contracts/task-contract.js';
