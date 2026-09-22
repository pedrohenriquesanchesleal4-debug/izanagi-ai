/**
 * Parse da stream JSONL do `maestro-cli --json` e sumarização dos runs.
 *
 * Linha inválida vira `null`, nunca throw: o stream real mistura logs do
 * provider com eventos JSON, e tolerância é comportamento de produção (um
 * evento corrompido não derruba o resumo do run inteiro).
 */

import type {
  GoalEvent,
  GoalEventComplete,
  GoalEventIterationComplete,
  GoalEventIterationStart,
  GoalEventStart,
  GoalSummary,
  GatedEntry,
  MaestroEvent,
  RunEvent,
  RunEventComplete,
  RunEventGated,
  RunEventHalt,
  RunEventLoopComplete,
  RunEventModelResolution,
  RunEventStart,
  RunEventStalled,
  RunEventTaskComplete,
  RunSummary,
  StalledEntry,
} from './types.js';

/** Converte a linha em objeto; qualquer coisa que não seja objeto JSON é null. */
function asRecord(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

const obj = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

/** Linha JSON -> evento de run de documentos. Linha inválida -> null. */
export function parseRunEvent(line: string): RunEvent | null {
  const rec = asRecord(line);
  if (!rec) return null;
  switch (rec.type) {
    case 'start': {
      const e: RunEventStart = { type: 'start' };
      const playbook = str(rec.playbook);
      if (playbook !== undefined) e.playbook = playbook;
      return e;
    }
    case 'document_start': {
      const document = str(rec.document);
      const taskCount = num(rec.taskCount);
      if (!document || taskCount === undefined) return null;
      return { type: 'document_start', document, taskCount };
    }
    case 'task_start': {
      const taskIndex = num(rec.taskIndex);
      if (taskIndex === undefined) return null;
      return { type: 'task_start', taskIndex };
    }
    case 'task_complete': {
      const taskIndex = num(rec.taskIndex);
      const success = bool(rec.success);
      if (taskIndex === undefined || success === undefined) return null;
      const e: RunEventTaskComplete = { type: 'task_complete', taskIndex, success };
      const summary = str(rec.summary);
      if (summary !== undefined) e.summary = summary;
      const elapsedMs = num(rec.elapsedMs);
      if (elapsedMs !== undefined) e.elapsedMs = elapsedMs;
      const usageStats = obj(rec.usageStats);
      if (usageStats !== undefined) e.usageStats = usageStats;
      return e;
    }
    case 'document_complete': {
      const document = str(rec.document);
      const tasksCompleted = num(rec.tasksCompleted);
      if (!document || tasksCompleted === undefined) return null;
      return { type: 'document_complete', document, tasksCompleted };
    }
    case 'loop_complete': {
      const iteration = num(rec.iteration);
      const tasksCompleted = num(rec.tasksCompleted);
      if (iteration === undefined || tasksCompleted === undefined) return null;
      const e: RunEventLoopComplete = { type: 'loop_complete', iteration, tasksCompleted };
      const elapsedMs = num(rec.elapsedMs);
      if (elapsedMs !== undefined) e.elapsedMs = elapsedMs;
      return e;
    }
    case 'complete': {
      const success = bool(rec.success);
      const totalTasksCompleted = num(rec.totalTasksCompleted);
      if (success === undefined || totalTasksCompleted === undefined) return null;
      const e: RunEventComplete = { type: 'complete', success, totalTasksCompleted };
      const totalElapsedMs = num(rec.totalElapsedMs);
      if (totalElapsedMs !== undefined) e.totalElapsedMs = totalElapsedMs;
      const totalCost = num(rec.totalCost);
      if (totalCost !== undefined) e.totalCost = totalCost;
      return e;
    }
    case 'document_gated': {
      const document = str(rec.document);
      if (!document) return null;
      const e: RunEventGated = { type: 'document_gated', document };
      const reason = str(rec.reason);
      if (reason !== undefined) e.reason = reason;
      return e;
    }
    case 'document_stalled': {
      const document = str(rec.document);
      if (!document) return null;
      const e: RunEventStalled = { type: 'document_stalled', document };
      const reason = str(rec.reason);
      if (reason !== undefined) e.reason = reason;
      const remaining = num(rec.remaining);
      if (remaining !== undefined) e.remaining = remaining;
      return e;
    }
    case 'halt': {
      const e: RunEventHalt = { type: 'halt' };
      const reason = str(rec.reason);
      if (reason !== undefined) e.reason = reason;
      return e;
    }
    case 'model_resolution': {
      const e: RunEventModelResolution = { type: 'model_resolution' };
      const tier = str(rec.tier);
      if (tier !== undefined) e.tier = tier;
      const model = str(rec.model);
      if (model !== undefined) e.model = model;
      return e;
    }
    default:
      return null;
  }
}

/** Linha JSON -> evento de goal run. Linha inválida -> null. */
export function parseGoalEvent(line: string): GoalEvent | null {
  const rec = asRecord(line);
  if (!rec) return null;
  switch (rec.type) {
    case 'goal_start': {
      const e: GoalEventStart = { type: 'goal_start' };
      const objective = str(rec.objective);
      if (objective !== undefined) e.objective = objective;
      const maxIterations = num(rec.maxIterations);
      if (maxIterations !== undefined) e.maxIterations = maxIterations;
      return e;
    }
    case 'goal_iteration_start': {
      const iteration = num(rec.iteration);
      if (iteration === undefined) return null;
      return { type: 'goal_iteration_start', iteration };
    }
    case 'goal_iteration_complete': {
      const e: GoalEventIterationComplete = { type: 'goal_iteration_complete' };
      const iteration = num(rec.iteration);
      if (iteration !== undefined) e.iteration = iteration;
      const progress = num(rec.progress);
      if (progress !== undefined) e.progress = progress;
      const rationale = str(rec.rationale);
      if (rationale !== undefined) e.rationale = rationale;
      const complete = bool(rec.complete);
      if (complete !== undefined) e.complete = complete;
      const deadlock = bool(rec.deadlock);
      if (deadlock !== undefined) e.deadlock = deadlock;
      return e;
    }
    case 'goal_complete': {
      const success = bool(rec.success);
      if (success === undefined) return null;
      const e: GoalEventComplete = { type: 'goal_complete', success };
      const exitReason = str(rec.exitReason);
      if (exitReason !== undefined) e.exitReason = exitReason;
      const finalProgress = num(rec.finalProgress);
      if (finalProgress !== undefined) e.finalProgress = finalProgress;
      const iterations = num(rec.iterations);
      if (iterations !== undefined) e.iterations = iterations;
      return e;
    }
    default:
      return null;
  }
}

/** Linha JSON -> evento Maestro (run ou goal). Linha inválida -> null. */
export function parseMaestroEvent(line: string): MaestroEvent | null {
  const run = parseRunEvent(line);
  if (run) return run;
  return parseGoalEvent(line);
}

/** Agrega uma stream de run de documentos num resumo acionável. */
export function summarizeRun(events: RunEvent[]): RunSummary {
  let success: boolean | null = null;
  let totalTasksCompleted = 0;
  let totalCost: number | undefined;
  const stalled: StalledEntry[] = [];
  let halted = false;
  let haltedReason: string | undefined;
  const gated: GatedEntry[] = [];
  let iterationCount = 0;
  const documents: string[] = [];

  for (const e of events) {
    switch (e.type) {
      case 'document_start':
        if (!documents.includes(e.document)) documents.push(e.document);
        break;
      case 'document_complete':
        if (!documents.includes(e.document)) documents.push(e.document);
        totalTasksCompleted = Math.max(totalTasksCompleted, e.tasksCompleted);
        break;
      case 'loop_complete':
        iterationCount = Math.max(iterationCount, e.iteration);
        break;
      case 'document_stalled': {
        if (!documents.includes(e.document)) documents.push(e.document);
        const entry: StalledEntry = { document: e.document };
        if (e.reason !== undefined) entry.reason = e.reason;
        if (e.remaining !== undefined) entry.remaining = e.remaining;
        stalled.push(entry);
        break;
      }
      case 'document_gated': {
        if (!documents.includes(e.document)) documents.push(e.document);
        const entry: GatedEntry = { document: e.document };
        if (e.reason !== undefined) entry.reason = e.reason;
        gated.push(entry);
        break;
      }
      case 'halt':
        halted = true;
        if (e.reason !== undefined) haltedReason = e.reason;
        break;
      case 'complete':
        success = e.success;
        totalTasksCompleted = Math.max(totalTasksCompleted, e.totalTasksCompleted);
        if (e.totalCost !== undefined) totalCost = e.totalCost;
        break;
      default:
        break;
    }
  }

  const summary: RunSummary = {
    success,
    totalTasksCompleted,
    stalled,
    halted,
    gated,
    iterationCount,
    documents,
  };
  if (totalCost !== undefined) summary.totalCost = totalCost;
  if (haltedReason !== undefined) summary.haltedReason = haltedReason;
  return summary;
}

/** Agrega uma stream de goal run num resumo acionável. */
export function summarizeGoal(events: GoalEvent[]): GoalSummary {
  let success: boolean | null = null;
  let exitReason: string | undefined;
  let finalProgress: number | undefined;
  let iterations = 0;
  let deadlocks = 0;
  let lastRationale: string | undefined;

  for (const e of events) {
    switch (e.type) {
      case 'goal_iteration_complete':
        if (e.iteration !== undefined) iterations = Math.max(iterations, e.iteration);
        if (e.deadlock === true) deadlocks += 1;
        if (e.rationale !== undefined) lastRationale = e.rationale;
        break;
      case 'goal_complete':
        success = e.success;
        if (e.exitReason !== undefined) exitReason = e.exitReason;
        if (e.finalProgress !== undefined) finalProgress = e.finalProgress;
        if (e.iterations !== undefined) iterations = Math.max(iterations, e.iterations);
        break;
      default:
        break;
    }
  }

  const summary: GoalSummary = { success, iterations, deadlocks };
  if (exitReason !== undefined) summary.exitReason = exitReason;
  if (finalProgress !== undefined) summary.finalProgress = finalProgress;
  if (lastRationale !== undefined) summary.lastRationale = lastRationale;
  return summary;
}