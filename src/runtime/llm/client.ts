/**
 * LLM Client — execução real de modelos via HTTP (fetch nativo, zero deps).
 *
 * Abstrai providers em ModelAdapter (OpenAI-compatible + Anthropic) e expõe
 * um cliente único que o runtime usa para produzir artefatos de verdade.
 *
 * Configuração via env:
 *   IZANAGI_OPENAI_API_KEY  (ou OPENAI_API_KEY)   — provider "openai"
 *   IZANAGI_OPENAI_BASE_URL                        — override (ex.: proxy/offline)
 *   IZANAGI_ANTHROPIC_API_KEY (ou ANTHROPIC_API_KEY) — provider "anthropic"
 *   IZANAGI_OPENROUTER_API_KEY (ou OPENROUTER_API_KEY) — provider "openrouter"
 *   IZANAGI_OLLAMA_ENABLED=1 (ou IZANAGI_OLLAMA_BASE_URL)     — provider "ollama" (default http://localhost:11434/v1)
 *   IZANAGI_LMSTUDIO_ENABLED=1 (ou IZANAGI_LMSTUDIO_BASE_URL) — provider "lmstudio" (default http://localhost:1234/v1)
 *   IZANAGI_CUSTOM_BASE_URL / IZANAGI_CUSTOM_API_KEY — provider "custom" (qualquer endpoint OpenAI-compatible)
 *   IZANAGI_LLM_TIMEOUT_MS                          — timeout por chamada (default 120s)
 *
 * Ollama e LM Studio expõem endpoint OpenAI-compatible nativamente
 * (`/v1/chat/completions`) — por isso reaproveitam o mesmo wire format do
 * OpenAI em vez de um protocolo próprio. Não exigem API key (rodam
 * localmente), mas por isso mesmo exigem opt-in explícito via *_ENABLED ou
 * *_BASE_URL — sem isso, "configured" ficaria sempre true e quebraria o modo
 * headless de quem nunca configurou nada. Uma eventual falha de conexão
 * (servidor local não está de pé) aparece como erro de rede real na primeira
 * chamada — não é um provider fake.
 *
 * Sem chave/servidor configurado, o framework continua 100% funcional em modo
 * headless (gera prompt) — o executor apenas informa que não está configurado.
 *
 * Cache-Aware Prompt Compression (CAPC): o system prompt pode carregar o
 * delimitador `<!-- IZANAGI:DYNAMIC -->` (ver runtime/llm/prompt-cache.ts).
 * A detecção é AUTOMÁTICA dentro de cada adapter — nenhum chamador precisa
 * mudar: Anthropic ganha blocos com cache_control no prefixo estático quando
 * ele atinge o piso de 1024 tokens; providers OpenAI-compatible recebem o
 * conteúdo estável primeiro (prefix caching automático, wire format inalterado).
 */

import { splitStaticDynamic, joinWithoutMarker, estimateTokens, estimateStaticTokens, MIN_CACHEABLE_TOKENS } from './prompt-cache.js';
import { dietHistory } from './session-diet.js';

/** Reexports públicos das utilidades de cache (mesma heurística, fonte única). */
export { DYNAMIC_MARKER, MIN_CACHEABLE_TOKENS, splitStaticDynamic, joinWithoutMarker, estimateStaticTokens, isPromptCacheEligible } from './prompt-cache.js';

/** Reexports públicos do AgentDiet (observation masking determinístico). */
export { dietHistory, summarizeObservation, MIN_TURNS, RECENT_WINDOW, MAX_OBS_CHARS } from './session-diet.js';

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model: string;
  system?: string;
  messages: CompletionMessage[];
  maxTokens?: number;
  temperature?: number;
  /**
   * AgentDiet (observation masking): quando true, aplica `dietHistory()` ao
   * histórico ANTES de despachar ao adapter — observações antigas e longas
   * (fora da janela recente) viram resumos sintéticos de 1 linha; mensagens
   * 'system' e a janela recente ficam byte-a-byte. Default (ausente/false):
   * histórico segue intacto, comportamento idêntico ao pré-AgentDiet.
   */
  diet?: boolean;
}

export interface CompletionResult {
  text: string;
  tokens: number;
  latencyMs: number;
  model: string;
  provider: string;
  /**
   * Tokens servidos do cache de prompt pelo provider (quando reportado):
   * Anthropic `cache_read_input_tokens`, OpenAI `prompt_tokens_details.cached_tokens`,
   * Google `usageMetadata.cachedContentTokenCount`. Ausente = provider não reportou.
   */
  cachedTokens?: number;
}

export interface ModelAdapter {
  readonly provider: string;
  readonly configured: boolean;
  complete(opts: CompletionOptions): Promise<CompletionResult>;
}

/** Mapeia id de provider do ModelRouter → chaves de ambiente aceitas. */
const ENV_KEYS: Record<string, { apiKey: string[]; baseUrl?: string; baseUrlDefault?: string }> = {
  openai: {
    apiKey: ['IZANAGI_OPENAI_API_KEY', 'OPENAI_API_KEY'],
    baseUrl: 'IZANAGI_OPENAI_BASE_URL',
    baseUrlDefault: 'https://api.openai.com/v1',
  },
  anthropic: {
    apiKey: ['IZANAGI_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'],
    baseUrlDefault: 'https://api.anthropic.com/v1',
  },
  google: {
    apiKey: ['IZANAGI_GOOGLE_API_KEY', 'GOOGLE_API_KEY'],
    baseUrl: 'IZANAGI_GOOGLE_BASE_URL',
    baseUrlDefault: 'https://generativelanguage.googleapis.com/v1beta',
  },
  openrouter: {
    apiKey: ['IZANAGI_OPENROUTER_API_KEY', 'OPENROUTER_API_KEY'],
    baseUrl: 'IZANAGI_OPENROUTER_BASE_URL',
    baseUrlDefault: 'https://openrouter.ai/api/v1',
  },
  ollama: {
    apiKey: [],
    baseUrl: 'IZANAGI_OLLAMA_BASE_URL',
    baseUrlDefault: 'http://localhost:11434/v1',
  },
  lmstudio: {
    apiKey: [],
    baseUrl: 'IZANAGI_LMSTUDIO_BASE_URL',
    baseUrlDefault: 'http://localhost:1234/v1',
  },
  custom: {
    apiKey: ['IZANAGI_CUSTOM_API_KEY'],
    baseUrl: 'IZANAGI_CUSTOM_BASE_URL',
    // sem baseUrlDefault de propósito — "custom" não tem endpoint sensato sem configuração explícita.
  },
};

function resolveApiKey(provider: string): string {
  const cfg = ENV_KEYS[provider];
  if (!cfg) return '';
  for (const key of cfg.apiKey) {
    const v = process.env[key];
    if (v) return v;
  }
  return '';
}

function resolveBaseUrl(provider: string): string {
  const cfg = ENV_KEYS[provider];
  if (!cfg) return '';
  const override = cfg.baseUrl ? process.env[cfg.baseUrl] : undefined;
  return (override || (cfg.baseUrlDefault ?? '')).replace(/\/+$/, '');
}

function timeoutMs(): number {
  const v = Number(process.env.IZANAGI_LLM_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 120_000;
}

/**
 * Chamada de chat completions no formato OpenAI — compartilhada por todo
 * provider que fala esse wire format (OpenAI de verdade, LM Studio, Ollama,
 * OpenRouter, e qualquer endpoint "custom" compatível). `apiKey` vazio
 * simplesmente omite o header Authorization (servidores locais não exigem).
 *
 * Prefix caching: esses providers cacheiam automaticamente o INÍCIO idêntico
 * do payload — por isso a ordem é ESTÁVEL (system primeiro, messages na ordem
 * recebida) e o delimitador CAPC é removido do content antes do envio, de modo
 * que o prefixo estático fique byte-idêntico entre chamadas. Wire format
 * inalterado: nenhuma chave nova é adicionada ao body.
 */
async function completeOpenAICompatible(provider: string, baseUrl: string, apiKey: string, opts: CompletionOptions): Promise<CompletionResult> {
  const started = Date.now();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Estático→dinâmico concatenado SEM o delimitador (prefixo estável no topo).
  const systemContent = opts.system ? joinWithoutMarker(opts.system) : '';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.4,
      messages: systemContent
        ? [{ role: 'system', content: systemContent }, ...opts.messages]
        : opts.messages,
    }),
    signal: AbortSignal.timeout(timeoutMs()),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM ${provider} ${res.status}: ${body.slice(0, 300) || res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      total_tokens?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.total_tokens ?? estimateTokens(text, opts.system ?? '');
  const cached = data.usage?.prompt_tokens_details?.cached_tokens;
  return {
    text,
    tokens,
    latencyMs: Date.now() - started,
    model: opts.model,
    provider,
    ...(typeof cached === 'number' ? { cachedTokens: cached } : {}),
  };
}

/** Provider OpenAI (e qualquer API compatível via base URL). */
export class OpenAIAdapter implements ModelAdapter {
  readonly provider = 'openai';
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey = resolveApiKey('openai'),
    baseUrl = resolveBaseUrl('openai') || 'https://api.openai.com/v1',
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  complete(opts: CompletionOptions): Promise<CompletionResult> {
    return completeOpenAICompatible(this.provider, this.baseUrl, this.apiKey, opts);
  }
}

/** Provider OpenRouter — roteador multi-modelo OpenAI-compatible, requer API key própria. */
export class OpenRouterAdapter implements ModelAdapter {
  readonly provider = 'openrouter';
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey = resolveApiKey('openrouter'),
    baseUrl = resolveBaseUrl('openrouter') || 'https://openrouter.ai/api/v1',
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  complete(opts: CompletionOptions): Promise<CompletionResult> {
    return completeOpenAICompatible(this.provider, this.baseUrl, this.apiKey, opts);
  }
}

/**
 * Provider Ollama — modelo local, endpoint OpenAI-compatible nativo
 * (`/v1/chat/completions`, disponível desde a v0.1.x do Ollama). Sem API key
 * — mas "configured" NÃO pode ser sempre true por padrão: isso quebraria o
 * modo headless existente (zero env vars → `izanagi run` deveria simular,
 * não tentar bater numa porta local que ninguém pediu para usar). Exige opt-in
 * explícito: IZANAGI_OLLAMA_ENABLED=1 ou IZANAGI_OLLAMA_BASE_URL setado.
 */
export class OllamaAdapter implements ModelAdapter {
  readonly provider = 'ollama';
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(
    baseUrl = resolveBaseUrl('ollama') || 'http://localhost:11434/v1',
    enabled = Boolean(process.env.IZANAGI_OLLAMA_ENABLED) || Boolean(process.env.IZANAGI_OLLAMA_BASE_URL),
  ) {
    this.baseUrl = baseUrl;
    this.enabled = enabled;
  }

  get configured(): boolean {
    return this.enabled;
  }

  complete(opts: CompletionOptions): Promise<CompletionResult> {
    return completeOpenAICompatible(this.provider, this.baseUrl, '', opts);
  }
}

/** Provider LM Studio — modelo local, mesmo raciocínio do Ollama (endpoint OpenAI-compatible, sem key, opt-in explícito). */
export class LMStudioAdapter implements ModelAdapter {
  readonly provider = 'lmstudio';
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(
    baseUrl = resolveBaseUrl('lmstudio') || 'http://localhost:1234/v1',
    enabled = Boolean(process.env.IZANAGI_LMSTUDIO_ENABLED) || Boolean(process.env.IZANAGI_LMSTUDIO_BASE_URL),
  ) {
    this.baseUrl = baseUrl;
    this.enabled = enabled;
  }

  get configured(): boolean {
    return this.enabled;
  }

  complete(opts: CompletionOptions): Promise<CompletionResult> {
    return completeOpenAICompatible(this.provider, this.baseUrl, '', opts);
  }
}

/**
 * Provider "custom" — qualquer endpoint OpenAI-compatible que não seja um dos
 * nomeados acima (proxy interno, gateway próprio, outro runtime local). Ao
 * contrário de Ollama/LM Studio, não tem base URL default: sem
 * IZANAGI_CUSTOM_BASE_URL configurado, fica "not configured" de propósito —
 * não há endpoint sensato a assumir.
 */
export class CustomOpenAICompatibleAdapter implements ModelAdapter {
  readonly provider = 'custom';
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey = resolveApiKey('custom'), baseUrl = resolveBaseUrl('custom')) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get configured(): boolean {
    return this.baseUrl.length > 0;
  }

  complete(opts: CompletionOptions): Promise<CompletionResult> {
    return completeOpenAICompatible(this.provider, this.baseUrl, this.apiKey, opts);
  }
}

/** Bloco de system da Messages API (com cache_control opcional no prefixo estático). */
interface AnthropicSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/** Provider Anthropic (Messages API) com prompt caching no prefixo estático. */
export class AnthropicAdapter implements ModelAdapter {
  readonly provider = 'anthropic';
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey = resolveApiKey('anthropic'),
    baseUrl = resolveBaseUrl('anthropic') || 'https://api.anthropic.com/v1',
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * System → wire format cache-aware:
   *   - estático >= MIN_CACHEABLE_TOKENS (1024): array de blocos, com
   *     cache_control ephemeral APENAS no prefixo estático (o sufixo dinâmico
   *     fica num bloco separado, fora do cache);
   *   - caso contrário: string simples exatamente como antes (retrocompatível —
   *     o provider ignoraria o header abaixo do piso de qualquer forma).
   * Sem system, o campo segue ausente do payload.
   */
  private static systemToWire(system?: string): string | AnthropicSystemBlock[] | undefined {
    if (!system) return undefined;
    const split = splitStaticDynamic(system);
    if (estimateStaticTokens(split.staticText) < MIN_CACHEABLE_TOKENS) return system;
    const blocks: AnthropicSystemBlock[] = [{ type: 'text', text: split.staticText, cache_control: { type: 'ephemeral' } }];
    if (split.dynamicText) blocks.push({ type: 'text', text: split.dynamicText });
    return blocks;
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const started = Date.now();
    const system = opts.system ?? '';
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.4,
        system: AnthropicAdapter.systemToWire(opts.system),
        messages: opts.messages.filter((m) => m.role !== 'system'),
      }),
      signal: AbortSignal.timeout(timeoutMs()),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM anthropic ${res.status}: ${body.slice(0, 300) || res.statusText}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) || estimateTokens(text, system);
    // Tokens servidos do cache: só populamos quando o provider REPORTA a chave.
    const cachedRead = data.usage?.cache_read_input_tokens;
    return {
      text,
      tokens,
      latencyMs: Date.now() - started,
      model: opts.model,
      provider: this.provider,
      ...(typeof cachedRead === 'number' ? { cachedTokens: cachedRead } : {}),
    };
  }
}

/** Provider Google (Gemini — API OpenAI-compatible via generativelanguage). */
export class GoogleAdapter implements ModelAdapter {
  readonly provider = 'google';
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey = resolveApiKey('google'),
    baseUrl = resolveBaseUrl('google') || 'https://generativelanguage.googleapis.com/v1beta',
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/models/${opts.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      // Prefix caching (context caching do Gemini): system_instruction estável
      // primeiro no body, contents na ordem recebida — o início do payload fica
      // byte-idêntico entre chamadas com o mesmo prefixo estático.
      body: JSON.stringify({
        system_instruction: opts.system ? { parts: [{ text: joinWithoutMarker(opts.system) }] } : undefined,
        contents: opts.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: opts.maxTokens ?? 2048, temperature: opts.temperature ?? 0.4 },
      }),
      signal: AbortSignal.timeout(timeoutMs()),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM google ${res.status}: ${body.slice(0, 300) || res.statusText}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { totalTokenCount?: number; cachedContentTokenCount?: number };
    };
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    const tokens = data.usageMetadata?.totalTokenCount ?? estimateTokens(text, opts.system ?? '');
    const cachedContent = data.usageMetadata?.cachedContentTokenCount;
    return {
      text,
      tokens,
      latencyMs: Date.now() - started,
      model: opts.model,
      provider: this.provider,
      ...(typeof cachedContent === 'number' ? { cachedTokens: cachedContent } : {}),
    };
  }
}

/**
 * Cliente único: resolve o adapter do provider e executa.
 *
 * CAPC é automático: se o `system` contiver `<!-- IZANAGI:DYNAMIC -->`, cada
 * adapter aplica a estratégia de cache do seu provider por conta própria
 * (blocos cache_control no Anthropic, prefixo estável nos OpenAI-compatible,
 * system_instruction estável no Google). Chamadores existentes (run/chat/
 * dashboard/arena) não precisam de NENHUMA mudança — basta incluir o
 * delimitador no system quando houver parte volátil.
 */
export class LLMClient {
  private readonly adapters: Map<string, ModelAdapter>;

  constructor(
    adapters: ModelAdapter[] = [
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new GoogleAdapter(),
      new OpenRouterAdapter(),
      new OllamaAdapter(),
      new LMStudioAdapter(),
      new CustomOpenAICompatibleAdapter(),
    ],
  ) {
    this.adapters = new Map(adapters.map((a) => [a.provider, a]));
  }

  /** Se algum adapter está configurado (tem API key). */
  get configured(): boolean {
    return Array.from(this.adapters.values()).some((a) => a.configured);
  }

  /** Providers configurados (com chave). */
  configuredProviders(): string[] {
    return Array.from(this.adapters.values()).filter((a) => a.configured).map((a) => a.provider);
  }

  isConfigured(provider: string): boolean {
    return this.adapters.get(provider)?.configured ?? false;
  }

  async complete(provider: string, opts: CompletionOptions): Promise<CompletionResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`Provider "${provider}" não suportado (adapters: ${Array.from(this.adapters.keys()).join(', ')})`);
    if (!adapter.configured) {
      throw new Error(`Provider "${provider}" não configurado — defina ${ENV_KEYS[provider]?.apiKey.join(' ou ') ?? 'a chave de API'} no ambiente`);
    }
    // AgentDiet opt-in: sem diet, opts passa INTACTO (mesma referência — wire
    // byte-a-byte idêntico ao pré-AgentDiet); com diet, o histórico é mascarado
    // aqui, ponto único central, e os adapters/chamadores não mudam nada.
    if (!opts.diet) return adapter.complete(opts);
    return adapter.complete({ ...opts, messages: dietHistory(opts.messages) });
  }
}

// estimateTokens vive em ./prompt-cache.js (fonte única compartilhada com a
// decisão de cacheabilidade) e é reexportada acima junto das demais utilidades.
