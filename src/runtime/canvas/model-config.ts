/**
 * Canvas Orchestration — configuração de modelo por nó.
 *
 * Resolução em tempo de construção do plano:
 *   - `mode: 'auto'`  → `router.routeForRole(role)` com tier derivado das
 *     capacidades do agente (modelHint no genome dele), respeitando pino de
 *     ambiente/config (IZANAGI_MODEL_*);
 *   - `mode: 'manual'` → `provider/model`/reasoning explícitos do canvas;
 *   - `mode: 'inherit'` → usa o modelo do run (nó anterior/global).
 *
 * A resolução ressalta se o manual é inválido (validador também cobre).
 * O resultado é pinado POR NÓ no TaskContract daquele nó.
 */

import type { ResolvedNodeModel } from './types.js';
import type { ModelRouter } from '../model/router.js';
import type { ModelTier, RoutingContext } from '../types.js';
import type { AgentRole } from '../contracts/task-contract.js';

export interface ResolveNodeModelOptions {
  manual?: { provider: string; model: string; reasoning?: { effort: 'low' | 'medium' | 'high' } };
  mode: 'auto' | 'manual' | 'inherit';
  role: AgentRole;
  /** modelHint do genome do agente (traduzido para tier); vazio → tier do papel. */
  hintedTier?: string;
  router: ModelRouter;
  ctx: RoutingContext;
  /** Modelo do run (herança). */
  inheritedId?: string;
}

export interface NodeModelResolution {
  node: string;
  model: string;
  provider: string;
  tier: ModelTier;
  source: 'auto' | 'manual' | 'inherit';
  reasons: string[];
}

export function resolveNodeModel(nodeId: string, opts: ResolveNodeModelOptions): NodeModelResolution {
  const { router, ctx } = opts;

  if (opts.mode === 'manual') {
    const m = opts.manual;
    if (!m?.model || !m?.provider) {
      throw new Error(`nó "${nodeId}": modelo manual exige provider e model`);
    }
    const spec = router.catalog().find((s) => s.id === m.model);
    if (!spec) throw new Error(`nó "${nodeId}": modelo "${m.model}" não está no catálogo do ModelRouter`);
    if (router.providerOf(m.model) !== m.provider) {
      throw new Error(`nó "${nodeId}": "${m.model}" é do provider "${router.providerOf(m.model)}", não "${m.provider}"`);
    }
    return {
      node: nodeId,
      model: m.model,
      provider: m.provider,
      tier: spec.reasoning,
      source: 'manual',
      reasons: [`manual: ${m.provider}/${m.model}`],
    };
  }

  if (opts.mode === 'inherit') {
    if (!opts.inheritedId) {
      throw new Error(`nó "${nodeId}": mode=inherit sem modelo herdado (use no nó inicial ou pin manual/auto)`);
    }
    const spec = router.catalog().find((s) => s.id === opts.inheritedId);
    return {
      node: nodeId,
      model: opts.inheritedId,
      provider: spec ? router.providerOf(opts.inheritedId) : 'unknown',
      tier: spec?.reasoning ?? 'auto',
      source: 'inherit',
      reasons: [`herdado do run: ${opts.inheritedId}`],
    };
  }

  // auto
  const routed = router.routeForRole(opts.role, ctx, opts.hintedTier ? tierForHint(opts.hintedTier) : undefined);
  return {
    node: nodeId,
    model: routed.model.id,
    provider: routed.provider,
    tier: routed.tier,
    source: 'auto',
    reasons: routed.reasons ?? [],
  };
}

const HINT_TIERS: Record<string, ModelTier> = {
  opus: 'premium',
  sonnet: 'balanced',
  haiku: 'fast',
  'claude-opus': 'premium',
  'claude-sonnet': 'balanced',
  'claude-haiku': 'fast',
  gpt5: 'premium',
  'gpt-5': 'premium',
  gpt4: 'premium',
  'gpt-4o': 'balanced',
  'gpt-4o-mini': 'fast',
  o3: 'premium',
  'o4-mini': 'fast',
  'gemini-3-pro': 'premium',
  'gemini-2.5-pro': 'premium',
  'gemini-2.5-flash': 'balanced',
  'gemini-flash': 'fast',
  default: 'balanced',
};

function hintTierOf(hint: string): ModelTier | undefined {
  const key = hint.toLowerCase();
  return HINT_TIERS[key] ?? HINT_TIERS.default;
}

/** Traduz modelHint do genome para tier reconhecido pelo ModelRouter. */
export function tierForHint(hint: string): ModelTier {
  return hintTierOf(hint) ?? 'balanced';
}

/** Traduz modelHint do genome para tier reconhecido pelo ModelRouter. */
export function tierForHint(hint: string): string {
  return hintTierOf(hint) ?? 'balanced';
}