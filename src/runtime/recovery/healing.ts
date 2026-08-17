/**
 * Self-Healing — classificação de falhas e pipeline de recuperação.
 *
 * Failure → Classification → Local Repair | Replan | Handoff | Skill
 * Replacement | Abort. Com limites rígidos (maxAttempts, maxTokens, maxTime)
 * para impedir loops infinitos.
 *
 * Consome a Failure Memory: antes de classificar, busca padrões conhecidos
 * (symptoms) para guiar a solução e registrar aprendizado.
 */

import type { FailureCategory, FailureKind, HealingAction, HealingActionKind } from '../types.js';
import type { MemoryStore } from '../memory/store.js';

export interface HealingInput {
  nodeId: string;
  agent?: string;
  skill?: string;
  error: string;
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
  maxTimeMs: number;
  tokensUsed: number;
  maxTokens: number;
  graphFailed?: boolean;
  memory: MemoryStore;
}

export interface HealingDecision {
  action: HealingAction;
  retryNow?: boolean;
  replacement?: { agent?: string; skill?: string };
  /** Se abort: motivo estruturado. */
  abortReason?: string;
}

const KIND_RULES: Array<{ regex: RegExp; kind: FailureKind }> = [
  { regex: /timeout|timed out|etimedout|timeout/i, kind: 'recoverable' },
  { regex: /429|rate.?limit|too many requests/i, kind: 'recoverable' },
  { regex: /5\d\d|internal server|unavailable/i, kind: 'recoverable' },
  { regex: /validation|validação|schema|contract|invalid artifact|not valid/i, kind: 'validation' },
  { regex: /dependency|not found|missing module|cannot find|import/i, kind: 'dependency' },
  { regex: /plan|graph|cycle|topological/i, kind: 'planning' },
  { regex: /tool|mcp|exec|command failed|exit code/i, kind: 'tool' },
  { regex: /agent|skill.*fail/i, kind: 'agent' },
];

/** Classifica o tipo de falha a partir da mensagem de erro. */
export function classifyFailure(error: string): FailureKind {
  for (const rule of KIND_RULES) {
    if (rule.regex.test(error)) return rule.kind;
  }
  return 'unknown';
}

/** Checa se a falha é recuperável por retry (idempotência/transitório). */
export function isRecoverable(kind: FailureKind): boolean {
  return kind === 'recoverable' || kind === 'tool' || kind === 'validation';
}

const CATEGORY_RULES: Array<{ regex: RegExp; category: FailureCategory }> = [
  { regex: /security|secret|vulnerab|owasp|injection|cve-/i, category: 'SECURITY_FAILURE' },
  { regex: /timeout|timed out|etimedout/i, category: 'TIMEOUT' },
  { regex: /config|env var|environment variable|\.env/i, category: 'CONFIGURATION_FAILURE' },
  { regex: /enoent|permission denied|eacces|disk|filesystem/i, category: 'ENVIRONMENT_FAILURE' },
  { regex: /artifact|contract/i, category: 'ARTIFACT_FAILURE' },
  { regex: /\btest(s)?\b|assert/i, category: 'TEST_FAILURE' },
];

/**
 * Categoriza a ORIGEM da falha para fins de observabilidade/relatório.
 * Complementa `classifyFailure()` (que decide a estratégia de cura) sem
 * substituí-la — um `FailureKind` pode mapear para categorias diferentes
 * dependendo do conteúdo real da mensagem de erro.
 */
export function categorizeFailure(kind: FailureKind, error: string): FailureCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.regex.test(error)) return rule.category;
  }
  switch (kind) {
    case 'dependency':
      return 'DEPENDENCY_FAILURE';
    case 'tool':
      return 'TOOL_FAILURE';
    case 'agent':
      return 'AGENT_FAILURE';
    case 'validation':
      return 'VALIDATION_FAILURE';
    case 'planning':
      return 'MODEL_FAILURE';
    case 'recoverable':
      return 'MODEL_FAILURE';
    default:
      return 'UNKNOWN_FAILURE';
  }
}

export class Healer {
  /** Backoff exponencial simples. */
  static backoff(baseMs: number, attempt: number, factor = 1.6): number {
    return Math.min(60_000, baseMs * Math.pow(factor, attempt));
  }

  /**
   * Decide a ação de cura. Ordem:
   *  1. Limites excedidos (tokens/tempo/attempts) → abort (não-recuperável).
   *  2. Padrão de falha conhecido na memória → local_repair guiado + retry.
   *  3. Falha transitória recuperável → retry com backoff.
   *  4. Falha de validação → skill replacement (skill corretiva) + retry.
   *  5. Falha de planejamento → replan.
   *  6. Demais → handoff para agente especializado ou abort.
   */
  heal(input: HealingInput): HealingDecision {
    const kind = classifyFailure(input.error);
    const category = categorizeFailure(kind, input.error);
    const id = `heal-${Date.now().toString(36)}-${input.nodeId}`;

    // 1. Hard limits — nunca loops infinitos
    if (input.attempt >= input.maxAttempts) {
      return this.abort(id, kind, `máximo de tentativas (${input.maxAttempts}) atingido`, input);
    }
    if (input.elapsedMs > input.maxTimeMs) {
      return this.abort(id, kind, `tempo máximo (${Math.round(input.maxTimeMs / 1000)}s) excedido`, input);
    }
    if (input.tokensUsed > input.maxTokens) {
      return this.abort(id, kind, `orçamento de tokens (${input.maxTokens}) excedido`, input);
    }

    // 2. Padrões de falha conhecidos — local repair guiado
    const patterns = input.memory.findRelevantFailures(input.error);
    if (patterns.length > 0) {
      const best = patterns[0];
      input.memory.recordFailure({
        pattern: best.pattern,
        symptoms: best.symptoms,
        rootCause: best.rootCause,
        solution: best.solution,
        confidence: best.confidence,
        kind,
      });
      return {
        action: {
          id,
          kind: 'local_repair',
          failureKind: kind,
          category,
          message: `padrão conhecido ${best.pattern} (${best.occurrences} ocorrências): ${best.solution}`,
          nodeId: input.nodeId,
          matchedPattern: best.pattern,
          createdAt: new Date().toISOString(),
        },
        retryNow: true,
      };
    }

    // 3. Transitória → retry
    if (kind === 'recoverable') {
      return {
        action: {
          id,
          kind: 'retry',
          failureKind: kind,
          category,
          message: `falha transitória detectada — retry com backoff (tentativa ${input.attempt + 1}/${input.maxAttempts})`,
          nodeId: input.nodeId,
          createdAt: new Date().toISOString(),
        },
        retryNow: true,
      };
    }

    // 4. Validação → skill replacement
    if (kind === 'validation') {
      const replacement = input.skill ? repairSkillFor(input.skill) : undefined;
      return {
        action: {
          id,
          kind: 'skill_replacement',
          failureKind: kind,
          category,
          message: `artefato inválido — substituindo skill por validador corretivo${replacement ? ` (${replacement})` : ''}`,
          nodeId: input.nodeId,
          replacement,
          createdAt: new Date().toISOString(),
        },
        retryNow: true,
        replacement: replacement ? { skill: replacement } : undefined,
      };
    }

    // 5. Planejamento → replan
    if (kind === 'planning') {
      return {
        action: {
          id,
          kind: 'replan',
          failureKind: kind,
          category,
          message: 'falha de planejamento — reconstruindo grafo de execução',
          nodeId: input.nodeId,
          createdAt: new Date().toISOString(),
        },
      };
    }

    // 6. Handoff ou abort
    const target = handoffTargetFor(kind);
    if (target) {
      return {
        action: {
          id,
          kind: 'handoff',
          failureKind: kind,
          category,
          message: `falha de ${kind} — repassando para agente especializado ${target}`,
          nodeId: input.nodeId,
          replacement: target,
          createdAt: new Date().toISOString(),
        },
        replacement: { agent: target },
      };
    }

    return this.abort(id, kind, `falha não-recuperável (${kind}) sem estratégia de cura`, input);
  }

  private abort(id: string, kind: FailureKind, reason: string, input: HealingInput): HealingDecision {
    return {
      action: {
        id,
        kind: 'abort',
        failureKind: kind,
        category: categorizeFailure(kind, input.error),
        message: reason,
        nodeId: input.nodeId,
        createdAt: new Date().toISOString(),
      },
      abortReason: reason,
    };
  }
}

/** Mapeia kind de falha → skill corretiva. */
function repairSkillFor(skill: string): string {
  const map: Record<string, string> = {
    'api-automation': 'data-validation',
    'spreadsheet-automation': 'data-validation',
    'frontend': 'qa',
    'webgl-3d': 'qa',
    'animation-web': 'qa',
    'database-engineer': 'sql-optimizer',
  };
  return map[skill] ?? 'qa';
}

/** Mapeia kind de falha → agente de handoff. */
function handoffTargetFor(kind: FailureKind): string | null {
  switch (kind) {
    case 'dependency':
      return 'bug-hunter';
    case 'agent':
      return 'techlead';
    case 'tool':
      return 'devops';
    default:
      return null;
  }
}
