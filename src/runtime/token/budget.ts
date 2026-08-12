/**
 * Token Budget 2.0 — orçamento por fase.
 *
 * planning / execution / evaluation / recovery. Impossibilita que uma tarefa
 * simples consuma recursos excessivos: cada fase tem um teto alocado do total,
 * e estourar uma fase aborta a execução (nunca loops infinitos).
 *
 * Pesos default (clássico 60/20/10/10) reproduzem o comportamento anterior de
 * maxTokens global com a adição de tetos por fase.
 */

import type { ModelTier } from '../types.js';

export type PhaseId = 'planning' | 'execution' | 'evaluation' | 'recovery';

export const PHASES: PhaseId[] = ['planning', 'execution', 'evaluation', 'recovery'];

export type PhaseAllocation = Record<PhaseId, number>;

export interface PhaseUsage {
  phase: PhaseId;
  allocated: number;
  spent: number;
  remaining: number;
  ratio: number;
  exhausted: boolean;
}

/** Pesos default por complexidade da tarefa — tarefa simples prioriza execution enxuta. */
export function defaultWeights(complexity: number): PhaseAllocation {
  const base = {
    planning: 0.1,
    execution: 0.65,
    evaluation: 0.05,
    recovery: 0.2,
  };
  if (complexity >= 4) {
    return { planning: 0.05, execution: 0.6, evaluation: 0.05, recovery: 0.3 };
  }
  if (complexity <= 2) {
    return { planning: 0.15, execution: 0.7, evaluation: 0.05, recovery: 0.1 };
  }
  return base;
}

/** Teto sugerido por tier de modelo (contexto pequeno não deve estourar). */
export function defaultBudgetForTier(tier: ModelTier): number {
  switch (tier) {
    case 'premium':
      return 64_000;
    case 'balanced':
      return 32_000;
    default:
      return 16_000;
  }
}

export class PhaseTokenBudget {
  readonly total: number;
  readonly allocation: PhaseAllocation;
  private readonly spent: Record<PhaseId, number> = { planning: 0, execution: 0, evaluation: 0, recovery: 0 };

  constructor(total: number, allocation?: PhaseAllocation) {
    this.total = Math.max(1, Math.floor(total));
    const weights = allocation ?? defaultWeights(3);
    this.allocation = {
      planning: Math.floor(this.total * weights.planning),
      execution: Math.floor(this.total * weights.execution),
      evaluation: Math.floor(this.total * weights.evaluation),
      recovery: Math.floor(this.total * weights.recovery),
    };
  }

  /** Gasta tokens da fase; false quando excede o teto da fase. */
  spend(phase: PhaseId, tokens: number): boolean {
    if (tokens <= 0) return true;
    const next = this.spent[phase] + Math.floor(tokens);
    if (next > this.allocation[phase]) return false;
    this.spent[phase] = next;
    return true;
  }

  spentIn(phase: PhaseId): number {
    return this.spent[phase];
  }

  remaining(phase: PhaseId): number {
    return Math.max(0, this.allocation[phase] - this.spent[phase]);
  }

  exhausted(phase: PhaseId): boolean {
    return this.spent[phase] >= this.allocation[phase];
  }

  /** Relatório por fase (formatável em trace/verbose). */
  usage(): PhaseUsage[] {
    return PHASES.map((phase) => {
      const allocated = this.allocation[phase];
      const used = this.spent[phase];
      return {
        phase,
        allocated,
        spent: used,
        remaining: this.remaining(phase),
        ratio: allocated > 0 ? used / allocated : 0,
        exhausted: this.exhausted(phase),
      };
    });
  }

  totalSpent(): number {
    return this.spent.planning + this.spent.execution + this.spent.evaluation + this.spent.recovery;
  }

  /** Resumo compacto para logs/trace. */
  summary(): Record<PhaseId, { spent: number; remaining: number }> {
    return {
      planning: { spent: this.spent.planning, remaining: this.remaining('planning') },
      execution: { spent: this.spent.execution, remaining: this.remaining('execution') },
      evaluation: { spent: this.spent.evaluation, remaining: this.remaining('evaluation') },
      recovery: { spent: this.spent.recovery, remaining: this.remaining('recovery') },
    };
  }
}