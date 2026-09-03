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
import type { ModelProvider, ModelSpec, ModelTier, RoutingContext } from '../types.js';
import type { AgentRole } from '../contracts/task-contract.js';

export const DEFAULT_PROVIDERS: ModelProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    // Fonte: developers.openai.com/api/docs/pricing (consultado 2026-09-03).
    // `gpt-5.6-sol` declara janela 272000 e NÃO 1050000: 1M é opt-in
    // experimental, e acima de 272K a entrada custa 2x e a saída 1.5x. O
    // roteador precisa planejar contra o que uma chamada recebe sem
    // configuração especial, senão o teto de contexto mente para cima.
    pricingAsOf: '2026-09-03',
    models: [
      { id: 'gpt-4o-mini', tier: 'fast', contextWindow: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, avgLatencyMs: 900, reasoning: 'low' },
      { id: 'gpt-4o', tier: 'balanced', contextWindow: 128000, costPer1kInput: 0.0025, costPer1kOutput: 0.01, avgLatencyMs: 1400, reasoning: 'medium' },
      { id: 'gpt-5.6-sol', tier: 'premium', contextWindow: 272000, costPer1kInput: 0.004, costPer1kOutput: 0.02, avgLatencyMs: 2200, reasoning: 'high' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    // Fonte: tabela de modelos correntes da Anthropic (consultado 2026-09-03).
    pricingAsOf: '2026-09-03',
    models: [
      { id: 'claude-haiku-4-5', tier: 'fast', contextWindow: 200000, costPer1kInput: 0.001, costPer1kOutput: 0.005, avgLatencyMs: 800, reasoning: 'low' },
      { id: 'claude-sonnet-5', tier: 'balanced', contextWindow: 1000000, costPer1kInput: 0.002, costPer1kOutput: 0.01, avgLatencyMs: 1500, reasoning: 'medium' },
      { id: 'claude-opus-5', tier: 'premium', contextWindow: 1000000, costPer1kInput: 0.005, costPer1kOutput: 0.025, avgLatencyMs: 2500, reasoning: 'high' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    // Fonte: ai.google.dev/gemini-api/docs/pricing + páginas de modelo
    // (consultado 2026-09-03). Só entram modelos cujo preço E janela foram
    // confirmados: `gemini-3.5-flash-lite` é mais barato ($0.30/$2.50 por 1M)
    // mas a janela não estava documentada na consulta, e janela chutada num
    // roteador que decide por contexto é pior que um modelo a menos. Quem
    // quiser usá-lo declara em `.izanagi/izanagi.config.json`.
    // `gemini-3.1-pro-preview` tem faixa: acima de 200K vira $4/$18 por 1M.
    // O catálogo registra a faixa base, e por isso o teto é ESTIMATIVA.
    pricingAsOf: '2026-09-03',
    models: [
      { id: 'gemini-3.8-flash', tier: 'fast', contextWindow: 1000000, costPer1kInput: 0.00075, costPer1kOutput: 0.00375, avgLatencyMs: 700, reasoning: 'low' },
      { id: 'gemini-3.1-pro-preview', tier: 'premium', contextWindow: 1000000, costPer1kInput: 0.002, costPer1kOutput: 0.012, avgLatencyMs: 2000, reasoning: 'high' },
    ],
  },
  /**
   * Ollama e LM Studio: sem entrada real de catálogo o roteador nunca teria
   * um modelo pra escolher, mesmo com o adapter habilitado (llm/client.ts) —
   * `usableProviders` filtra pelo id do provider, então "opt-in no adapter"
   * sem "opt-in no catálogo" seria uma cura que nunca cura nada. custo 0 é
   * fato real (self-hosted, sem billing por token), não estimativa; o `id`
   * do modelo é um placeholder — sobrescreva em `.izanagi/izanagi.config.json`
   * com o modelo que você de fato baixou/carregou localmente.
   */
  {
    id: 'ollama',
    name: 'Ollama (local)',
    models: [
      { id: 'llama3.1', tier: 'balanced', contextWindow: 128000, costPer1kInput: 0, costPer1kOutput: 0, avgLatencyMs: 1500, reasoning: 'medium' },
    ],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    models: [
      { id: 'local-model', tier: 'balanced', contextWindow: 32000, costPer1kInput: 0, costPer1kOutput: 0, avgLatencyMs: 1500, reasoning: 'medium' },
    ],
  },
  // "openrouter" e "custom" ficam de fora do catálogo default de propósito: o custo real
  // varia por modelo roteado (OpenRouter) ou é desconhecido (endpoint próprio) — nenhum
  // número aqui seria verificável. Adicione o(s) modelo(s) reais em
  // `.izanagi/izanagi.config.json` (loadProjectProviders mescla com este catálogo).
];

/**
 * A partir de quantos dias a tabela de preços de um provider é tratada como
 * obsoleta e avisada ao usuário.
 *
 * 120 dias é uma escolha, e o motivo é o intervalo observado entre gerações de
 * modelo dos providers grandes: abaixo disso o aviso dispararia em catálogo
 * ainda correto e viraria ruído que se aprende a ignorar; muito acima, ele
 * nunca dispara antes do preço já estar errado. Não é uma medição.
 */
export const STALE_CATALOG_AFTER_DAYS = 120;

/**
 * Idade em dias da tabela de preços de um provider, ou `null` quando ele não
 * declara data. `null` é ausência de informação, e o chamador tem que
 * apresentá-la como ausente: idade 0 diria "o preço é de hoje", que é
 * exatamente a afirmação que não se pode fazer sem a data.
 */
export function catalogAgeDays(provider: ModelProvider, now: Date = new Date()): number | null {
  if (!provider.pricingAsOf) return null;
  const asOf = Date.parse(`${provider.pricingAsOf}T00:00:00Z`);
  if (Number.isNaN(asOf)) return null;
  const dias = Math.floor((now.getTime() - asOf) / 86_400_000);
  return dias < 0 ? 0 : dias;
}

/** `true` quando a tabela passou de `STALE_CATALOG_AFTER_DAYS`. Sem data, nunca. */
export function isCatalogStale(provider: ModelProvider, now: Date = new Date()): boolean {
  const dias = catalogAgeDays(provider, now);
  return dias !== null && dias > STALE_CATALOG_AFTER_DAYS;
}

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

    // Custo: barato pontua mais (economia por default). A contribuição é
    // PROPORCIONAL, não saturada: com o teto antigo (`min(0.2, ...)`), qualquer
    // modelo abaixo de $0.016/1k empatava no máximo e um modelo self-hosted de
    // custo zero perdia para um pago por causa de 100ms de latência.
    const relativeCost = Math.min(1, (model.costPer1kInput + model.costPer1kOutput) / 0.02);
    score += (1 - relativeCost) * 0.2 * (ctx.risk > 0.6 ? 0.4 : 1);

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

  /* ==================== ROTEAMENTO POR PAPEL (inteligência assimétrica) ==================== */

  /**
   * Roteia por PAPEL, não por run. O princípio da arquitetura é "o modelo mais
   * forte pensa e coordena, modelos menores executam": antes desta rota, um
   * único modelo era escolhido no início do run e usado em TODOS os nós,
   * inclusive numa extração trivial. Agora cada tarefa paga o preço do seu
   * papel.
   *
   * Precedência: pin explícito (config `roles` / env) vence; senão escolhe o
   * melhor modelo dentro do tier do papel; tier vazio no catálogo disponível
   * cai para o tier adjacente (nunca falha por catálogo restrito).
   */
  routeForRole(role: AgentRole, ctx: RoutingContext): RoutedModel {
    const pinned = this.pinnedFor(role);
    if (pinned) {
      return {
        model: pinned,
        provider: this.providerOf(pinned.id),
        role,
        tier: pinned.tier,
        reasons: [`modelo fixado para o papel "${role}" (config roles ou IZANAGI_MODEL_${role.toUpperCase()})`],
        candidates: [{ option: pinned.id, score: 1 }],
      };
    }

    const preferred = TIER_FOR_ROLE[role];
    const reasons = [`papel "${role}" prefere tier "${preferred}"`];
    for (const tier of tierFallbackOrder(preferred)) {
      const inTier = this.catalog().filter((m) => m.tier === tier);
      if (inTier.length === 0) continue;
      if (tier !== preferred) reasons.push(`tier "${preferred}" indisponível no catálogo: caindo para "${tier}"`);
      const scored = inTier
        .map((m) => ({ model: m, perf: this.scoreModel(m, { ...ctx, taskComplexity: complexityForRole(role, ctx) }) }))
        .sort((a, b) => b.perf - a.perf || a.model.id.localeCompare(b.model.id));
      const best = scored[0];
      return {
        model: best.model,
        provider: this.providerOf(best.model.id),
        role,
        tier,
        reasons,
        candidates: scored.slice(0, 5).map((c) => ({ option: c.model.id, score: Math.round(c.perf * 1000) / 1000 })),
      };
    }
    throw new Error('ModelRouter: nenhum modelo disponível no catálogo');
  }

  /**
   * Escalada por falha repetida: worker sobe para specialist, specialist para
   * commander. Commander é o topo (não existe escalada acima dele). Devolve
   * null quando não há para onde subir, e quem chama decide abortar.
   */
  static escalateRole(role: AgentRole): AgentRole | null {
    if (role === 'worker') return 'specialist';
    if (role === 'specialist') return 'commander';
    return null;
  }

  /**
   * Rebaixamento por pressão de orçamento: o inverso de `escalateRole`.
   * Commander vira specialist, specialist vira worker. Worker é o piso (não
   * existe nada mais barato para onde descer), e quem chama decide se corta a
   * tarefa ou pede aprovação humana.
   */
  static demoteRole(role: AgentRole): AgentRole | null {
    if (role === 'commander') return 'specialist';
    if (role === 'specialist') return 'worker';
    return null;
  }

  /** Modelo pinado para um papel via env ou `.izanagi/izanagi.config.json` → `roles`. */
  private pinnedFor(role: AgentRole): ModelSpec | undefined {
    const envId = process.env[`IZANAGI_MODEL_${role.toUpperCase()}`];
    const configured = this.rolePolicy?.[role]?.model;
    for (const id of [envId, configured]) {
      if (!id) continue;
      const found = this.catalog().find((m) => m.id === id);
      if (found) return found;
    }
    return undefined;
  }

  /** Política de papéis injetada por `loadRolePolicy` (config do projeto). */
  private rolePolicy?: RolePolicy;

  withRolePolicy(policy: RolePolicy | undefined): this {
    this.rolePolicy = policy;
    return this;
  }

  /**
   * Custo em USD de uma chamada. Modelos locais (Ollama/LM Studio) têm custo 0
   * declarado no catálogo, então self-hosted aparece corretamente como grátis.
   */
  static costUsd(model: ModelSpec, inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1000) * model.costPer1kInput + (outputTokens / 1000) * model.costPer1kOutput;
  }

  /**
   * Custo estimado de gastar `tokens` no papel `role`, assumindo a divisão
   * típica de 70% entrada / 30% saída. Usado pelo Commander no cost-aware
   * planning (estimativa de TETO, não previsão).
   */
  estimateCostForRole(role: AgentRole, tokens: number): number {
    // Usa exatamente o mesmo caminho de decisão da execução (`routeForRole`),
    // não o modelo mais barato do tier: a estimativa tem que corresponder ao
    // modelo que de fato vai rodar, senão o teto de custo mente.
    let model: ModelSpec;
    try {
      model = this.routeForRole(role, {
        task: '',
        taskComplexity: 3,
        reasoningRequirement: role === 'commander' ? 'high' : role === 'worker' ? 'low' : 'medium',
        risk: 0.2,
        tokenBudget: Math.max(1, tokens),
        requiresTools: false,
      }).model;
    } catch {
      return 0;
    }
    return ModelRouter.costUsd(model, tokens * 0.7, tokens * 0.3);
  }

  /** Lê `.izanagi/izanagi.config.json` → `roles`. Ausente/inválido = sem pin. */
  static loadRolePolicy(baseDir: string): RolePolicy | undefined {
    const configFile = path.join(baseDir, '.izanagi', 'izanagi.config.json');
    if (!fs.existsSync(configFile)) return undefined;
    try {
      const raw = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as { roles?: RolePolicy };
      if (!raw.roles || typeof raw.roles !== 'object') return undefined;
      const policy: RolePolicy = {};
      for (const role of ['commander', 'specialist', 'worker'] as AgentRole[]) {
        const entry = raw.roles[role];
        if (entry && typeof entry === 'object' && typeof entry.model === 'string') {
          policy[role] = { model: entry.model, ...(entry.provider ? { provider: entry.provider } : {}) };
        }
      }
      return Object.keys(policy).length > 0 ? policy : undefined;
    } catch {
      return undefined;
    }
  }
}

export interface RoutedModel {
  model: ModelSpec;
  provider: string;
  role: AgentRole;
  tier: ModelTier;
  reasons: string[];
  candidates: Array<{ option: string; score: number }>;
}

export type RolePolicy = Partial<Record<AgentRole, { model: string; provider?: string }>>;

/** Tier preferido por papel: o coração da inteligência assimétrica. */
export const TIER_FOR_ROLE: Record<AgentRole, ModelTier> = {
  commander: 'premium',
  specialist: 'balanced',
  worker: 'fast',
};

/** Ordem de fallback quando o tier preferido não existe no catálogo disponível. */
function tierFallbackOrder(preferred: ModelTier): ModelTier[] {
  switch (preferred) {
    case 'premium': return ['premium', 'balanced', 'fast'];
    case 'balanced': return ['balanced', 'premium', 'fast'];
    default: return ['fast', 'balanced', 'premium'];
  }
}

/** Complexidade efetiva vista pelo scorer: o papel já carrega a exigência. */
function complexityForRole(role: AgentRole, ctx: RoutingContext): RoutingContext['taskComplexity'] {
  if (role === 'commander') return 5;
  if (role === 'worker') return 1;
  return ctx.taskComplexity;
}

