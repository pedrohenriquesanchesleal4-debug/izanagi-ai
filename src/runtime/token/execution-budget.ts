/**
 * Budget Controller: orçamento de execução com custo, chamadas e degradação.
 *
 * O `PhaseTokenBudget` já existente controla tokens por fase e continua sendo
 * a fonte de verdade disso. Este módulo compõe em cima dele o que faltava para
 * um runtime comercializável: custo em USD, teto de chamadas de tool, teto de
 * agentes, teto de retries, tempo de parede, e a ESCADA DE DEGRADAÇÃO.
 *
 * Regra dura: nunca ultrapassar o orçamento em silêncio. Quando a pressão
 * sobe, o controlador devolve o próximo passo de degradação para quem executa
 * aplicar (reduzir contexto, reduzir saída, trocar modelo, reduzir paralelismo,
 * cortar tarefa opcional, pedir aprovação humana), nessa ordem.
 */

import { PhaseTokenBudget, defaultWeights, type PhaseId } from './budget.js';

export interface ExecutionBudgetLimits {
  maxTokens: number;
  maxCostUsd?: number;
  maxTimeMs?: number;
  maxAgents?: number;
  maxRetries?: number;
  maxToolCalls?: number;
  /**
   * Tarefas em voo simultâneas. Sem teto, um batch grande dispara todas as
   * chamadas de uma vez e um provider com rate limit apertado transforma
   * paralelismo em 429: o healing gasta mais do que a execução serial teria
   * gasto.
   */
  maxConcurrency?: number;
}

/** Passos da escada, do mais barato de aplicar ao mais invasivo. */
export type DegradationStep =
  | 'reduce-context'
  | 'reduce-output'
  | 'downgrade-model'
  | 'reduce-parallelism'
  | 'drop-optional-tasks'
  | 'require-human-approval';

export const DEGRADATION_LADDER: DegradationStep[] = [
  'reduce-context',
  'reduce-output',
  'downgrade-model',
  'reduce-parallelism',
  'drop-optional-tasks',
  'require-human-approval',
];

/** Pressão a partir da qual a escada começa. */
export const DEGRADATION_FLOOR = 0.6;

/**
 * Cada degrau tem o SEU limiar, distribuído entre `DEGRADATION_FLOOR` e 1.
 * Sem isso, um único limiar faria a escada inteira ser consumida em sequência
 * assim que a pressão passasse dele: um run com 6 tarefas chegaria a "pedir
 * aprovação humana" só por ter 6 chamadas, não por estar realmente no limite.
 * Pedir intervenção humana é o último recurso e exige 93% de consumo.
 */
export const DEGRADATION_THRESHOLDS: Record<DegradationStep, number> = DEGRADATION_LADDER.reduce(
  (acc, step, i) => {
    acc[step] = DEGRADATION_FLOOR + ((1 - DEGRADATION_FLOOR) * i) / DEGRADATION_LADDER.length;
    return acc;
  },
  {} as Record<DegradationStep, number>,
);

export interface SpendRecord {
  phase: PhaseId;
  tokens: number;
  costUsd?: number;
  /** Tokens servidos do cache do provider (não contam como economia local). */
  cachedTokens?: number;
  model?: string;
}

export interface SpendResult {
  ok: boolean;
  /** Motivo da recusa quando `ok` é false. */
  reason?: string;
  /** Limite estourado, quando houve. */
  limit?: 'phase-tokens' | 'total-tokens' | 'cost' | 'time';
}

export interface TokenTelemetry {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  budgetTokens: number;
  savedTokens: number;
  estimatedCostUsd: number;
  maxCostUsd?: number;
  cacheHits: number;
  cacheMisses: number;
  /** Tokens de prompt servidos do cache do provider. */
  providerCachedTokens: number;
  /** Chars de contexto economizados pelo Context Resolver. */
  contextCharsSaved: number;
  parallelTasks: number;
  modelEscalations: number;
  retries: number;
  toolCalls: number;
  agentsUsed: number;
  degradationsApplied: DegradationStep[];
}

export class ExecutionBudget {
  readonly limits: ExecutionBudgetLimits;
  readonly phases: PhaseTokenBudget;
  private readonly startedAt: number;

  private inputTokens = 0;
  private outputTokens = 0;
  private costUsd = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private providerCached = 0;
  private contextCharsSaved = 0;
  private parallelTasks = 0;
  private escalations = 0;
  private retries = 0;
  private toolCalls = 0;
  private readonly agents = new Set<string>();
  private readonly applied: DegradationStep[] = [];

  /**
   * `phases` permite COMPARTILHAR um `PhaseTokenBudget` já existente em vez de
   * criar outro. Sem isso, o runtime passa a ter duas contas de token para o
   * mesmo run (a do orçamento por fase e a do controlador), e elas divergem em
   * silêncio: exatamente o tipo de número mentiroso que este módulo existe
   * para impedir.
   */
  constructor(limits: ExecutionBudgetLimits, complexity = 3, startedAt = Date.now(), phases?: PhaseTokenBudget) {
    this.limits = limits;
    this.phases = phases ?? new PhaseTokenBudget(limits.maxTokens, defaultWeights(complexity));
    this.startedAt = startedAt;
  }

  /** Restaura gasto persistido (resume de checkpoint). */
  restore(state: { phaseSpent?: Partial<Record<PhaseId, number>>; costUsd?: number; inputTokens?: number; outputTokens?: number; retries?: number }): void {
    if (state.phaseSpent) this.phases.restore(state.phaseSpent);
    if (typeof state.costUsd === 'number') this.costUsd = Math.max(0, state.costUsd);
    if (typeof state.inputTokens === 'number') this.inputTokens = Math.max(0, state.inputTokens);
    if (typeof state.outputTokens === 'number') this.outputTokens = Math.max(0, state.outputTokens);
    if (typeof state.retries === 'number') this.retries = Math.max(0, state.retries);
  }

  /**
   * Registra gasto. Recusa (sem contabilizar) quando o gasto estouraria um
   * teto: a decisão de abortar/degradar fica com quem chama, mas o número
   * nunca passa do limite escondido.
   */
  spend(record: SpendRecord): SpendResult {
    const now = Date.now();
    if (this.limits.maxTimeMs !== undefined && now - this.startedAt > this.limits.maxTimeMs) {
      return { ok: false, reason: `tempo máximo de execução (${Math.round(this.limits.maxTimeMs / 1000)}s) excedido`, limit: 'time' };
    }
    const cost = record.costUsd ?? 0;
    if (this.limits.maxCostUsd !== undefined && this.costUsd + cost > this.limits.maxCostUsd) {
      return {
        ok: false,
        reason: `custo estimado $${(this.costUsd + cost).toFixed(4)} ultrapassaria o teto $${this.limits.maxCostUsd.toFixed(4)}`,
        limit: 'cost',
      };
    }
    if (!this.phases.spend(record.phase, record.tokens)) {
      return { ok: false, reason: `orçamento de tokens da fase ${record.phase} esgotado`, limit: 'phase-tokens' };
    }
    // Divisão entrada/saída: usamos a mesma proporção 70/30 do estimador do
    // router quando o provider não separa os números.
    this.inputTokens += Math.round(record.tokens * 0.7);
    this.outputTokens += record.tokens - Math.round(record.tokens * 0.7);
    this.costUsd += cost;
    this.providerCached += record.cachedTokens ?? 0;
    return { ok: true };
  }

  recordCacheHit(savedTokens = 0): void {
    this.cacheHits++;
    // Tokens que NÃO foram gastos porque a resposta veio do cache local.
    this.inputTokens += 0;
    this.savedByCache += savedTokens;
  }

  private savedByCache = 0;

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  recordContextSaving(chars: number): void {
    this.contextCharsSaved += Math.max(0, chars);
  }

  recordParallelBatch(size: number): void {
    if (size > 1) this.parallelTasks += size;
  }

  recordEscalation(): void {
    this.escalations++;
  }

  recordRetry(): boolean {
    this.retries++;
    return this.limits.maxRetries === undefined || this.retries <= this.limits.maxRetries;
  }

  recordToolCall(): boolean {
    this.toolCalls++;
    return this.limits.maxToolCalls === undefined || this.toolCalls <= this.limits.maxToolCalls;
  }

  recordAgent(agent: string): boolean {
    this.agents.add(agent);
    return this.limits.maxAgents === undefined || this.agents.size <= this.limits.maxAgents;
  }

  get totalTokens(): number {
    return this.inputTokens + this.outputTokens;
  }

  get spentUsd(): number {
    return this.costUsd;
  }

  get elapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  /**
   * Pressão orçamentária em [0,1]: o maior consumo relativo entre tokens
   * totais, uso de QUALQUER fase, custo e tempo. 1 = teto atingido em pelo
   * menos uma dimensão.
   *
   * A fase entra na conta porque o gasto real é limitado por fase, não pelo
   * total: `execution` recebe 65% do total, então gastar tudo o que a execução
   * pode gastar deixaria a pressão em 0.65 se olhássemos só o total. A escada
   * de degradação nunca passaria do primeiro degrau, mesmo com a fase que
   * importa esgotada. O sinal correto é "estou perto de ficar sem o orçamento
   * que estou de fato usando".
   */
  pressure(): number {
    const ratios = [this.totalTokens / Math.max(1, this.limits.maxTokens)];
    for (const usage of this.phases.usage()) {
      if (usage.allocated > 0) ratios.push(usage.ratio);
    }
    if (this.limits.maxCostUsd !== undefined && this.limits.maxCostUsd > 0) {
      ratios.push(this.costUsd / this.limits.maxCostUsd);
    }
    if (this.limits.maxTimeMs !== undefined && this.limits.maxTimeMs > 0) {
      ratios.push(this.elapsedMs / this.limits.maxTimeMs);
    }
    return Math.min(1, Math.max(0, ...ratios));
  }

  /**
   * Próximo passo de degradação, ou null quando ainda há folga (pressão
   * abaixo de 0.6) ou a escada já foi toda aplicada. Cada chamada que devolve
   * um passo o marca como aplicado: a escada nunca repete o mesmo degrau.
   */
  nextDegradation(floor = DEGRADATION_FLOOR): DegradationStep | null {
    const pressure = this.pressure();
    if (pressure < floor) return null;
    const next = DEGRADATION_LADDER.find(
      (step) => !this.applied.includes(step) && pressure >= Math.max(floor, DEGRADATION_THRESHOLDS[step]),
    );
    if (!next) return null;
    this.applied.push(next);
    return next;
  }

  /**
   * Todos os degraus que a pressão atual justifica e que ainda não foram
   * aplicados, na ordem da escada. Quem executa aplica todos de uma vez: sob
   * pressão de 90%, não faz sentido aplicar um degrau por chamada e só chegar
   * ao corte de tarefas opcionais cinco chamadas depois.
   */
  pendingDegradations(floor = DEGRADATION_FLOOR): DegradationStep[] {
    const steps: DegradationStep[] = [];
    for (;;) {
      const step = this.nextDegradation(floor);
      if (!step) break;
      steps.push(step);
    }
    return steps;
  }

  /** Passos já aplicados, na ordem. */
  degradations(): DegradationStep[] {
    return [...this.applied];
  }

  telemetry(): TokenTelemetry {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
      budgetTokens: this.limits.maxTokens,
      savedTokens: this.savedByCache,
      estimatedCostUsd: Math.round(this.costUsd * 1e6) / 1e6,
      ...(this.limits.maxCostUsd !== undefined ? { maxCostUsd: this.limits.maxCostUsd } : {}),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providerCachedTokens: this.providerCached,
      contextCharsSaved: this.contextCharsSaved,
      parallelTasks: this.parallelTasks,
      modelEscalations: this.escalations,
      retries: this.retries,
      toolCalls: this.toolCalls,
      agentsUsed: this.agents.size,
      degradationsApplied: this.degradations(),
    };
  }

  /** Linha compacta para CLI/trace. */
  static formatTelemetry(t: TokenTelemetry): string {
    const cacheTotal = t.cacheHits + t.cacheMisses;
    const hitRate = cacheTotal > 0 ? Math.round((t.cacheHits / cacheTotal) * 100) : 0;
    const parts = [
      `tokens ${t.totalTokens}/${t.budgetTokens}`,
      `custo $${t.estimatedCostUsd.toFixed(4)}${t.maxCostUsd !== undefined ? `/$${t.maxCostUsd.toFixed(4)}` : ''}`,
      `cache ${t.cacheHits}/${cacheTotal} (${hitRate}%)`,
      `paralelo ${t.parallelTasks}`,
      `retries ${t.retries}`,
    ];
    if (t.modelEscalations > 0) parts.push(`escaladas ${t.modelEscalations}`);
    if (t.contextCharsSaved > 0) parts.push(`contexto economizado ${t.contextCharsSaved} chars`);
    if (t.degradationsApplied.length > 0) parts.push(`degradação: ${t.degradationsApplied.join(' > ')}`);
    return parts.join(' · ');
  }
}
