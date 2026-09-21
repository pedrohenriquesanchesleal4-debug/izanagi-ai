/**
 * Canvas Orchestration — capacidades de modelo + sanitização de parâmetros
 * por provider.
 *
 * O que esta camada responde:
 *   - `capabilitiesFor(providerId, modelId, catalogItem?)`: quais limites um
 *     provider/modelo impõe (janela de contexto, teto de saída, suporte a
 *     reasoning effort, suporte a temperature/topP, custo, localidade);
 *   - `sanitizeModelParams(params, caps)`: normaliza uma chamada contra esses
 *     limites. NUNCA estoura teto: warning + clamp, nunca erro. O retorno é
 *     determinístico e o provider nunca recebe parâmetro fora do que aceita;
 *   - `resolveCapabilities(node, res, catalogItem?)`: junta o nó do canvas com
 *     o resultado da resolução (`resolveNodeModel`) e deriva as capacidades do
 *     modelo efetivo.
 *
 * Fonte da verdade de capacidade: a TABELA ESTÁTICA abaixo por provider/modelo,
 * vencida por `ModelCatalogItem` quando presente (`contextWindow`,
 * `costPer1kTokens`/`costPer1kInput`+`costPer1kOutput` e `reasoning` do
 * catálogo do ModelRouter são mais específicos que a tabela). Nada aqui
 * conversa HTTP: é camada determinística de planejamento, igual ao roteador.
 *
 * Nota de contrato: a spec original citava um `IzanagiNodeModel` inexistente
 * no disco — o tipo real do canvas é `NodeModelConfig` (types.ts). A
 * sanitização por NÓ (preenche/rebaixa/remove `reasoning`/`limits`) vive em
 * `model-config.ts` (`sanitizeForNode`); esta camada é a base reutilizável.
 */

import type { NodeModelConfig, ReasoningEffort, ResolvedNodeModel } from './types.js';
import type { NodeModelResolution } from './model-config.js';
import type { ModelTier } from '../types.js';

/* ============================ TIPOS ============================ */

/**
 * Item do catálogo de modelos aceito como override de capacidade.
 *
 * Os campos extras (`reasoning`, `costPer1kInput`, `costPer1kOutput`,
 * `avgLatencyMs`) existem por compatibilidade ESTRUTURAL com o `ModelSpec` do
 * ModelRouter: quem tem um `ModelSpec` (ex.: `router.catalog().find(...)`)
 * passa direto, sem cast. `provider`/`costPer1kTokens`/`attributes` cobrem o
 * formato declarativo do canvas.
 */
export interface ModelCatalogItem {
  id: string;
  provider?: string;
  tier?: ModelTier;
  /** Custo por 1k tokens (entrada+saída típico). Alternativa a costPer1kInput/Output. */
  costPer1kTokens?: number;
  contextWindow?: number;
  attributes?: Record<string, unknown>;
  /** Capacidade de raciocínio declarada (catálogo do ModelRouter). Vence a tabela estática. */
  reasoning?: 'low' | 'medium' | 'high';
  /** Campos do ModelSpec do ModelRouter — aceitos por compatibilidade. */
  costPer1kInput?: number;
  costPer1kOutput?: number;
  avgLatencyMs?: number;
}

/** Capacidade efetiva de um provider/modelo. Tamanhos em tokens. */
export interface ModelCapabilities {
  providerId: string;
  modelId?: string;
  /** Janela total de contexto aceita (entrada + saída). */
  contextWindow: number;
  /**
   * Teto de tokens de SAÍDA. `0` significa "sem teto conhecido/delegado"
   * (ex.: claude-cli gerencia a saída internamente) — a sanitização não clampa
   * contra 0.
   */
  maxOutputTokens: number;
  /** `true` quando o provider/modelo aceita controle de reasoning effort. */
  supportsReasoning: boolean;
  /** Nível MÁXIMO de esforço de raciocínio que o modelo aguenta. */
  reasoningEffortCap: ReasoningEffort;
  /** Custo por 1k tokens (entrada+saída típicos), quando conhecido. */
  costPer1kTokens?: number;
  /** `true` para modelo self-hosted/local (Ollama, LM Studio). */
  isLocal: boolean;
  /** Provider aceita `temperature`? Ausente: default `true`. */
  supportsTemperature?: boolean;
  /** Provider aceita `topP`? Ausente: default `true`. */
  supportsTopP?: boolean;
  notes?: string;
}

/** Parâmetros de chamada passíveis de sanitização por provider. */
export interface ModelParams {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  reasoningEffort?: ReasoningEffort;
}

export interface SanitizedModelParams {
  /** Mesma shape de `ModelParams`; campos removidos por regra ficam ausentes. */
  params: ModelParams;
  /** Motivos das remoções/clamps (mensagens em PT-BR, prontas para aviso). */
  warnings: string[];
}

/* ============================ TABELA ESTÁTICA ============================ */

export interface ProviderStaticCapabilities {
  contextWindow: number;
  maxOutputTokens: number;
  supportsReasoning: boolean;
  reasoningEffortCap: ReasoningEffort;
  isLocal: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  notes?: string;
  /** Overrides por model id (mais específicos que o default do provider). */
  models?: Record<string, Partial<Omit<ProviderStaticCapabilities, 'models'>>>;
}

const NO_REASONING_CONTROL: Pick<
  ProviderStaticCapabilities,
  'supportsReasoning' | 'supportsTemperature' | 'supportsTopP'
> = {
  supportsReasoning: false,
  supportsTemperature: true,
  supportsTopP: true,
};

/**
 * Defaults de capacidade por provider/modelo.
 *
 * Valores conservadores quando a doc oficial não foi verificada num ponto
 * (marcados em `notes`). O catálogo do ModelRouter (via `catalogItem`) é a
 * fonte preferida quando diverge: `contextWindow`, custo e `reasoning` do item
 * vencem a tabela. `maxOutputTokens` não existe no ModelSpec, então vive aqui.
 */
export const PROVIDER_CAPABILITY_DEFAULTS: Readonly<Record<string, ProviderStaticCapabilities>> = {
  openai: {
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsReasoning: true,
    reasoningEffortCap: 'medium',
    isLocal: false,
    supportsTemperature: true,
    supportsTopP: true,
    notes: 'família gpt-4o; modelos reasoning (gpt-5.x) têm teto de saída maior via override por modelo',
    models: {
      'gpt-4o-mini': { reasoningEffortCap: 'low' },
      'gpt-4o': { reasoningEffortCap: 'medium' },
      'gpt-5.6-sol': { contextWindow: 272000, maxOutputTokens: 64000, reasoningEffortCap: 'high', notes: 'janela 272k é o teto sem opt-in experimental (1M paga 2x entrada)' },
    },
  },
  anthropic: {
    contextWindow: 200000,
    maxOutputTokens: 64000,
    supportsReasoning: true,
    reasoningEffortCap: 'medium',
    isLocal: false,
    supportsTemperature: true,
    supportsTopP: true,
    models: {
      'claude-haiku-4-5': { maxOutputTokens: 8192, reasoningEffortCap: 'low' },
      'claude-sonnet-5': { contextWindow: 1000000, reasoningEffortCap: 'medium' },
      'claude-opus-5': { contextWindow: 1000000, reasoningEffortCap: 'high' },
    },
  },
  google: {
    contextWindow: 128000,
    maxOutputTokens: 65536,
    supportsReasoning: true,
    reasoningEffortCap: 'medium',
    isLocal: false,
    supportsTemperature: true,
    supportsTopP: true,
    models: {
      'gemini-3.8-flash': { contextWindow: 1000000, reasoningEffortCap: 'low' },
      'gemini-3.1-pro-preview': { contextWindow: 1000000, reasoningEffortCap: 'high' },
    },
  },
  /**
   * OpenRouter agrega modelos de vários donos: sem entrada no catálogo do
   * projeto não há janela/custo verificável. Default conservador e explícito
   * nos notes; com `catalogItem` (modelo real declarado) os overrides vencem.
   */
  openrouter: {
    contextWindow: 8192,
    maxOutputTokens: 8192,
    supportsReasoning: true,
    reasoningEffortCap: 'medium',
    isLocal: false,
    supportsTemperature: true,
    supportsTopP: true,
    notes: 'capacidade real depende do modelo roteado: declare o modelo no catálogo do projeto (.izanagi config → models) para sobrescrever',
  },
  /** Endpoint próprio OpenAI-compatible: idem OpenRouter, desconhecido até declarar. */
  custom: {
    contextWindow: 8192,
    maxOutputTokens: 8192,
    supportsReasoning: true,
    reasoningEffortCap: 'medium',
    isLocal: false,
    supportsTemperature: true,
    supportsTopP: true,
    notes: 'provider custom: declare modelos reais no catálogo do projeto para sobrescrever os defaults',
  },
  ollama: {
    contextWindow: 8192,
    maxOutputTokens: 4096,
    ...NO_REASONING_CONTROL,
    reasoningEffortCap: 'medium',
    isLocal: true,
    notes: 'contexto real depende do modelo carregado (num_ctx): o catálogo do projeto vence a tabela',
  },
  lmstudio: {
    contextWindow: 8192,
    maxOutputTokens: 4096,
    ...NO_REASONING_CONTROL,
    reasoningEffortCap: 'medium',
    isLocal: true,
    notes: 'contexto real depende do modelo carregado: o catálogo do projeto vence a tabela',
  },
  /** Delega ao Claude Code CLI: sem temperature/topP/reasoning controláveis. */
  'claude-cli': {
    contextWindow: 200000,
    maxOutputTokens: 0,
    supportsReasoning: false,
    reasoningEffortCap: 'medium',
    isLocal: false,
    supportsTemperature: false,
    supportsTopP: false,
    notes: 'delega ao Claude Code CLI: teto de saída gerido pelo CLI; sem temperature/topP (buildArgs do agent-cli não os aceita)',
  },
  default: {
    contextWindow: 8192,
    maxOutputTokens: 8192,
    supportsReasoning: false,
    reasoningEffortCap: 'medium',
    isLocal: false,
    supportsTemperature: true,
    supportsTopP: true,
    notes: 'provider desconhecido: defaults conservadores; declare o provider/modelo no catálogo para capacidades reais',
  },
};

const EFFORT_RANK: Record<ReasoningEffort, number> = { low: 0, medium: 1, high: 2 };

/* ============================ CAPACIDADES ============================ */

/**
 * Deriva as capacidades de um provider/modelo.
 *
 * Precedência dos campos: `catalogItem` (catálogo do projeto/ModelRouter)
 * vence a override por modelo da tabela estática, que vence o default do
 * provider. `contextWindow`, custo e `reasoning` são os campos que o catálogo
 * declara de fato; `maxOutputTokens`, suportes e localidade vêm da tabela.
 */
export function capabilitiesFor(
  providerId: string,
  modelId?: string,
  catalogItem?: ModelCatalogItem,
): ModelCapabilities {
  const base = PROVIDER_CAPABILITY_DEFAULTS[providerId] ?? PROVIDER_CAPABILITY_DEFAULTS.default;
  const modelOver = (modelId && base.models?.[modelId]) || undefined;

  const contextWindow = catalogItem?.contextWindow ?? modelOver?.contextWindow ?? base.contextWindow;

  const maxOutputTokens = modelOver?.maxOutputTokens ?? base.maxOutputTokens;

  const costPer1kTokens =
    catalogItem?.costPer1kTokens ??
    (catalogItem?.costPer1kInput !== undefined && catalogItem.costPer1kOutput !== undefined
      ? catalogItem.costPer1kInput + catalogItem.costPer1kOutput
      : undefined);

  const reasoningEffortCap = catalogItem?.reasoning ?? modelOver?.reasoningEffortCap ?? base.reasoningEffortCap;

  const supportsReasoning = modelOver?.supportsReasoning ?? base.supportsReasoning;
  const supportsTemperature = modelOver?.supportsTemperature ?? base.supportsTemperature;
  const supportsTopP = modelOver?.supportsTopP ?? base.supportsTopP;

  return {
    providerId,
    ...(modelId ? { modelId } : {}),
    contextWindow,
    maxOutputTokens,
    supportsReasoning,
    reasoningEffortCap,
    ...(costPer1kTokens !== undefined ? { costPer1kTokens } : {}),
    isLocal: modelOver?.isLocal ?? base.isLocal,
    supportsTemperature,
    supportsTopP,
    ...(base.notes || modelOver?.notes ? { notes: modelOver?.notes ?? base.notes } : {}),
  };
}

/* ============================ SANITIZAÇÃO DE PARÂMETROS ============================ */

function clampFinite(value: number, min: number, max: number, label: string, warnings: string[]): number | undefined {
  if (!Number.isFinite(value)) {
    warnings.push(`${label} não é um número finito: parâmetro removido`);
    return undefined;
  }
  if (value < min) {
    warnings.push(`${label} ${value} abaixo do mínimo ${min}: clampado`);
    return min;
  }
  if (value > max) {
    warnings.push(`${label} ${value} acima do máximo ${max}: clampado`);
    return max;
  }
  return value;
}

/**
 * Sanitiza uma chamada contra as capacidades do provider/modelo.
 *
 * Regras (warning + clamp/remoção, NUNCA erro):
 *   - provider sem `supportsTemperature`/`supportsTopP` (ex.: claude-cli):
 *     parâmetro removido com warning;
 *   - `temperature` clampado a [0, 2]; `topP` clampado a [0, 1];
 *   - `maxOutputTokens` clampado a `caps.maxOutputTokens` (quando o teto é
 *     conhecido, > 0), com warning quando clampado;
 *   - `reasoningEffort` 'high' só quando `supportsReasoning` e dentro do cap;
 *     acima do cap é REBAIXADO para o cap (nunca removido); sem suporte,
 *     removido com warning.
 */
export function sanitizeModelParams(params: ModelParams, caps: ModelCapabilities): SanitizedModelParams {
  const warnings: string[] = [];
  const out: ModelParams = {};

  if (params.temperature !== undefined) {
    if (caps.supportsTemperature === false) {
      warnings.push(`provider "${caps.providerId}" não suporta temperature: parâmetro removido`);
    } else {
      const clamped = clampFinite(params.temperature, 0, 2, 'temperature', warnings);
      if (clamped !== undefined) out.temperature = clamped;
    }
  }

  if (params.topP !== undefined) {
    if (caps.supportsTopP === false) {
      warnings.push(`provider "${caps.providerId}" não suporta topP: parâmetro removido`);
    } else {
      const clamped = clampFinite(params.topP, 0, 1, 'topP', warnings);
      if (clamped !== undefined) out.topP = clamped;
    }
  }

  if (params.maxOutputTokens !== undefined) {
    if (!Number.isFinite(params.maxOutputTokens)) {
      warnings.push('maxOutputTokens não é um número finito: parâmetro removido');
    } else if (caps.maxOutputTokens > 0 && params.maxOutputTokens > caps.maxOutputTokens) {
      out.maxOutputTokens = caps.maxOutputTokens;
      warnings.push(
        `maxOutputTokens ${params.maxOutputTokens} excede o teto de ${caps.maxOutputTokens} do provider "${caps.providerId}": clampado`,
      );
    } else {
      out.maxOutputTokens = Math.max(1, Math.floor(params.maxOutputTokens));
    }
  }

  if (params.reasoningEffort !== undefined) {
    if (!caps.supportsReasoning) {
      warnings.push(`provider "${caps.providerId}" não suporta controle de reasoning effort: parâmetro removido`);
    } else if (EFFORT_RANK[params.reasoningEffort] > EFFORT_RANK[caps.reasoningEffortCap]) {
      out.reasoningEffort = caps.reasoningEffortCap;
      warnings.push(
        `reasoningEffort "${params.reasoningEffort}" acima do cap "${caps.reasoningEffortCap}" do provider "${caps.providerId}": rebaixado`,
      );
    } else {
      out.reasoningEffort = params.reasoningEffort;
    }
  }

  return { params: out, warnings };
}

/* ============================ RESOLUÇÃO ============================ */

/**
 * Deriva as capacidades do modelo EFETIVO de um nó, a partir do resultado da
 * resolução (`resolveNodeModel` — `NodeModelResolution` hoje; `ResolvedNodeModel`
 * quando o caminho novo existir) e do nó do canvas.
 *
 * O `node` entra para dar o model id quando a resolução não o carrega e o
 * `catalogItem` opcional vence a tabela estática (mesma regra de
 * `capabilitiesFor`). O provider/modelo finais vêm de `res`: quem chama
 * resolveu primeiro.
 */
export function resolveCapabilities(
  node: NodeModelConfig,
  res: ResolvedNodeModel | NodeModelResolution,
  catalogItem?: ModelCatalogItem,
): ModelCapabilities {
  const providerId = res.provider;
  const resolvedModelId = typeof res.model === 'string' ? res.model : res.model.id;
  const modelId = resolvedModelId || node.model;
  const effectiveItem = catalogItem ?? (typeof res.model !== 'string' ? res.model : undefined);
  return capabilitiesFor(providerId, modelId, effectiveItem);
}