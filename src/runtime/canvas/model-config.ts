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
 *
 * Antes de resolver o caminho manual, o nó passa por sanitização
 * (`sanitizeForNode`): reasoning ausente é preenchido com o cap do provider,
 * reasoning acima do cap é rebaixado, e parâmetros que o provider não aceita
 * são removidos — sempre com aviso. Os avisos (`warnings`) e o esforço efetivo
 * (`reasoning`) são expostos como campos OPCIONAIS no resultado; callers
 * existentes (executor.ts/api.ts) leem só model/provider/source e não são
 * afetados.
 *
 * Nota de contrato: a espec original citava `resolveTier`/`resolveProvider`/
 * `resolveModelId` e um tipo `IzanagiNodeModel` inexistentes no disco — o
 * contrato real preservado aqui é `resolveNodeModel(nodeId, opts)` (usado por
 * executor.ts) e o tipo real do nó é `NodeModelConfig` (types.ts).
 */

import type { NodeModelConfig, ReasoningEffort } from './types.js';
import type { ModelRouter } from '../model/router.js';
import type { ModelTier, RoutingContext } from '../types.js';
import type { AgentRole } from '../contracts/task-contract.js';
import { capabilitiesFor, sanitizeModelParams, type ModelCapabilities } from './model-capabilities.js';

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
  /** Esforço de raciocínio EFETIVO após sanitização (caminho manual). Opcional — aditivo, não quebra callers. */
  reasoning?: ReasoningEffort;
  /** Avisos da sanitização (ex.: reasoning rebaixado, param removido). Opcional — aditivo. */
  warnings?: string[];
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
    // Sanitização ANTES da resolução: reasoning ausente é preenchido com o cap
    // do provider, acima do cap é rebaixado, e params não suportados são
    // removidos. A resolução usa o nó sanitizado; avisos vão para o resultado.
    const caps = capabilitiesFor(m.provider, m.model, spec);
    const sanitized = sanitizeForNode(
      { mode: 'manual', provider: m.provider, model: m.model, reasoning: m.reasoning },
      caps,
    );
    const manual = sanitized.node;
    const reasoning = manual.reasoning?.effort ?? spec.reasoning ?? 'medium';
    return {
      node: nodeId,
      model: manual.model ?? m.model,
      provider: manual.provider ?? m.provider,
      tier: REASONING_TO_TIER[reasoning] ?? 'balanced',
      source: 'manual',
      reasons: [`manual: ${m.provider}/${m.model}`],
      reasoning,
      ...(sanitized.warnings.length > 0 ? { warnings: sanitized.warnings } : {}),
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
      tier: spec ? (REASONING_TO_TIER[spec.reasoning ?? 'medium'] ?? 'balanced') : 'balanced',
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

/** Traduz o qualificador `reasoning` da entrada do catálogo para tier do roteador. */
const REASONING_TO_TIER: Record<string, ModelTier> = {
  low: 'fast',
  medium: 'balanced',
  high: 'premium',
};

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

/**
 * Normaliza a configuração de modelo de um nó ANTES da resolução.
 *
 * Regras (warning + clamp/remoção, NUNCA erro; delega o clamp de parâmetros de
 * chamada a `sanitizeModelParams`):
 *   - `reasoning.effort`/`thinking.effort` ausentes em modo `manual`: preenche
 *     com o cap do provider (`caps.reasoningEffortCap`);
 *   - `reasoning`/`thinking` acima do cap: rebaixado para o cap com warning;
 *   - provider sem suporte a reasoning effort (ex.: ollama, claude-cli):
 *     campos `reasoning`/`thinking` removidos com warning;
 *   - `limits.temperature`/`topP` em provider que não os aceita (claude-cli):
 *     removidos com warning; fora de faixa, clampados;
 *   - `limits.maxCompletionTokens` clampado ao teto de saída quando conhecido.
 *
 * Não altera campos fora do escopo de modelo e devolve o nó SEMPRE (cópia);
 * nunca erro.
 */
export function sanitizeForNode(
  node: NodeModelConfig,
  caps: ModelCapabilities,
): { node: NodeModelConfig; warnings: string[] } {
  const warnings: string[] = [];
  const out: NodeModelConfig = { ...node };

  const declaredEffort = node.reasoning?.effort ?? node.thinking?.effort;

  // 1. Parâmetros de chamada (limits) + effort: clamp/remoção delegados.
  const sanitizedParams = sanitizeModelParams(
    {
      ...(node.limits?.temperature !== undefined ? { temperature: node.limits.temperature } : {}),
      ...(node.limits?.topP !== undefined ? { topP: node.limits.topP } : {}),
      ...(node.limits?.maxCompletionTokens !== undefined ? { maxOutputTokens: node.limits.maxCompletionTokens } : {}),
      ...(declaredEffort !== undefined ? { reasoningEffort: declaredEffort } : {}),
    },
    caps,
  );
  warnings.push(...sanitizedParams.warnings);

  // 2. Reaplica os limits sanitizados (ou remove campos que o provider recusa).
  if (node.limits) {
    const limits = { ...node.limits };
    const p = sanitizedParams.params;
    if (p.temperature !== undefined) limits.temperature = p.temperature;
    else if (node.limits.temperature !== undefined) delete limits.temperature;
    if (p.topP !== undefined) limits.topP = p.topP;
    else if (node.limits.topP !== undefined) delete limits.topP;
    if (p.maxOutputTokens !== undefined) limits.maxCompletionTokens = p.maxOutputTokens;
    else if (node.limits.maxCompletionTokens !== undefined) delete limits.maxCompletionTokens;
    out.limits = limits;
  }

  // 3. reasoning/thinking: aplica o esforço sanitizado; remove campos quando o
  //    provider não suporta; preenche ausente com o cap no modo manual.
  if (node.reasoning || node.thinking) {
    if (sanitizedParams.params.reasoningEffort !== undefined) {
      if (node.reasoning) out.reasoning = { ...node.reasoning, effort: sanitizedParams.params.reasoningEffort };
      if (node.thinking) out.thinking = { ...node.thinking, effort: sanitizedParams.params.reasoningEffort };
    } else {
      // provider não suporta effort: removidos (warning já emitido acima).
      if (node.reasoning) delete out.reasoning;
      if (node.thinking) delete out.thinking;
    }
  } else if (out.mode === 'manual' && caps.supportsReasoning) {
    out.reasoning = { effort: caps.reasoningEffortCap };
  }

  return { node: out, warnings };
}