/**
 * Model Router — abstraction layer de modelos LLM.
 *
 * ModelProvider (catálogo) → ModelSpec (capacidades/custo) → ModelRouter
 * (seleção por complexidade, raciocínio, risco, custo, latência e histórico).
 *
 * Izanagi não depende conceitualmente de um único provider: o catálogo pode
 * ser estendido via config do projeto (.izanagi/izanagi.config.json → models).
 */

import fs from 'fs';
import path from 'path';
import type { ModelProvider, ModelSpec, RoutingContext } from '../types.js';

export const DEFAULT_PROVIDERS: ModelProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o-mini', tier: 'fast', contextWindow: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, avgLatencyMs: 900, reasoning: 'low' },
      { id: 'gpt-4o', tier: 'balanced', contextWindow: 128000, costPer1kInput: 0.0025, costPer1kOutput: 0.01, avgLatencyMs: 1400, reasoning: 'medium' },
      { id: 'gpt-4.1', tier: 'premium', contextWindow: 1040000, costPer1kInput: 0.002, costPer1kOutput: 0.008, avgLatencyMs: 2200, reasoning: 'high' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-haiku-4-5', tier: 'fast', contextWindow: 200000, costPer1kInput: 0.001, costPer1kOutput: 0.005, avgLatencyMs: 800, reasoning: 'low' },
      { id: 'claude-sonnet-4-5', tier: 'balanced', contextWindow: 200000, costPer1kInput: 0.003, costPer1kOutput: 0.015, avgLatencyMs: 1500, reasoning: 'medium' },
      { id: 'claude-opus-4-1', tier: 'premium', contextWindow: 200000, costPer1kInput: 0.015, costPer1kOutput: 0.075, avgLatencyMs: 2500, reasoning: 'high' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-2.0-flash', tier: 'fast', contextWindow: 1000000, costPer1kInput: 0.0001, costPer1kOutput: 0.0004, avgLatencyMs: 700, reasoning: 'low' },
      { id: 'gemini-2.5-pro', tier: 'premium', contextWindow: 1000000, costPer1kInput: 0.00125, costPer1kOutput: 0.01, avgLatencyMs: 2000, reasoning: 'high' },
    ],
  },
];

export class ModelRouter {
  constructor(private readonly providers: ModelProvider[] = DEFAULT_PROVIDERS) {}

  /**
   * Lê `.izanagi/izanagi.config.json` → `models` (array de ModelProvider) e
   * mescla com o catálogo default (providers do projeto têm prioridade sobre
   * um provider default de mesmo id). Arquivo ausente ou inválido → só o
   * catálogo default.
   */
  static loadProjectProviders(baseDir: string, defaults: ModelProvider[] = DEFAULT_PROVIDERS): ModelProvider[] {
    const configFile = path.join(baseDir, '.izanagi', 'izanagi.config.json');
    if (!fs.existsSync(configFile)) return defaults;
    try {
      const raw = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as { models?: ModelProvider[] };
      const custom = Array.isArray(raw.models) ? raw.models.filter((p) => p && p.id && Array.isArray(p.models)) : [];
      if (custom.length === 0) return defaults;
      const byId = new Map(defaults.map((p) => [p.id, p]));
      for (const p of custom) byId.set(p.id, p);
      return Array.from(byId.values());
    } catch {
      return defaults;
    }
  }

  /** Todos os modelos disponíveis (com score calculado). */
  catalog(): ModelSpec[] {
    return this.providers.flatMap((p) => p.models);
  }

  /** Estima complexidade da tarefa 1-5 por heurística textual. */
  static estimateComplexity(task: string): 1 | 2 | 3 | 4 | 5 {
    const t = task.toLowerCase();
    let score = 1;
    const signals: Array<[RegExp, number]> = [
      [/saas|fullstack|sistema completo|monorepo/i, 1],
      [/microservi|arquitetura|distribuído|distribuido|escalab/i, 1],
      [/segurança|seguranca|owasp|cripto|auth|lgpd/i, 1],
      [/refactor|refatora|migraç|migracao|legado/i, 1],
      [/concorrência|concorrencia|async|paralel|fila|queue/i, 1],
      [/otimiz|perfomance|benchmark|latência|latencia/i, 0.5],
      [/3d|webgl|shader|animation|scrollytell/i, 1],
      [/regex|parsing|validaç|validacao/i, 0.5],
      [/debug|bug|crash|stack.?trace|exception/i, 0.5],
    ];
    for (const [re, v] of signals) {
      if (re.test(t)) score += v;
    }
    if (t.split(/\s+/).length > 40) score += 1;
    return Math.min(5, Math.max(1, Math.round(score))) as 1 | 2 | 3 | 4 | 5;
  }

  /** Roteia o modelo mais adequado para o contexto. */
  route(ctx: RoutingContext): { model: ModelSpec; provider: string; reasons: string[]; candidates: Array<{ option: string; score: number }> } {
    const complexity = ctx.taskComplexity;
    const reasoning = ctx.reasoningRequirement;
    const reasons: string[] = [];

    // Override manual: IZANAGI_MODEL força um model id do catálogo (se existir).
    const override = process.env.IZANAGI_MODEL;
    if (override) {
      const forced = this.catalog().find((m) => m.id === override);
      if (forced) {
        return {
          model: forced,
          provider: this.providerOf(forced.id),
          reasons: [`override manual via IZANAGI_MODEL=${override}`],
          candidates: [{ option: forced.id, score: 1 }],
        };
      }
      reasons.push(`IZANAGI_MODEL=${override} não encontrado no catálogo — ignorando override`);
    }

    const candidates = this.catalog().map((m) => {
      const perf = this.scoreModel(m, ctx);
      return { model: m, perf, provider: this.providerOf(m.id) };
    });

    candidates.sort((a, b) => b.perf - a.perf);

    const best = candidates[0];
    if (!best) {
      throw new Error('ModelRouter: nenhum modelo disponível no catálogo');
    }

    reasons.push(`complexidade ${complexity}/5, raciocínio ${reasoning}`);
    if (ctx.risk > 0.6) reasons.push('risco alto — modelo premium justificado');
    if (complexity <= 2) reasons.push('tarefa simples — modelo fast para economizar custo');

    return {
      model: best.model,
      provider: best.provider,
      reasons,
      candidates: candidates.slice(0, 5).map((c) => ({ option: c.model.id, score: Math.round(c.perf * 1000) / 1000 })),
    };
  }

  private scoreModel(model: ModelSpec, ctx: RoutingContext): number {
    const complexityScore = ctx.taskComplexity / 5;
    let score = 0;

    // Adequação ao nível de raciocínio
    const reasoningRank = { low: 0, medium: 1, high: 2 } as const;
    const targetRank = reasoningRank[ctx.reasoningRequirement];
    const modelRank = reasoningRank[model.reasoning];
    if (modelRank >= targetRank) score += 0.35;
    else score += 0.1;

    // Capacidade de contexto
    if (model.contextWindow >= ctx.tokenBudget) score += 0.2;
    else score += 0.05;

    // Custo: barato pontua mais (economia por default)
    const costScore = 1 - (model.costPer1kInput + model.costPer1kOutput) / 0.02;
    score += Math.max(0, Math.min(0.2, costScore)) * (ctx.risk > 0.6 ? 0.4 : 1);

    // Latência
    score += Math.max(0, 1 - model.avgLatencyMs / 3000) * 0.1;

    // Histórico de performance (se houver)
    if (ctx.historicalPerformance?.[model.id]) {
      score += ctx.historicalPerformance[model.id] * 0.15;
    }

    // Tarefas simples: penaliza premium (não usar modelo caro à toa)
    if (complexityScore <= 0.4 && model.tier === 'premium') score -= 0.25;
    if (complexityScore >= 0.8 && model.tier === 'fast') score -= 0.1;

    return Math.max(0, score);
  }

  private providerOf(modelId: string): string {
    for (const p of this.providers) {
      if (p.models.some((m) => m.id === modelId)) return p.id;
    }
    return 'unknown';
  }
}
