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
 */

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
}

export interface CompletionResult {
  text: string;
  tokens: number;
  latencyMs: number;
  model: string;
  provider: string;
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
 */
async function completeOpenAICompatible(provider: string, baseUrl: string, apiKey: string, opts: CompletionOptions): Promise<CompletionResult> {
  const started = Date.now();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.4,
      messages: opts.system
        ? [{ role: 'system', content: opts.system }, ...opts.messages]
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
    usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.total_tokens ?? estimateTokens(text, opts.system ?? '');
  return { text, tokens, latencyMs: Date.now() - started, model: opts.model, provider };
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

/** Provider Anthropic (Messages API). */
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
        system: system || undefined,
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
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) || estimateTokens(text, system);
    return {
      text,
      tokens,
      latencyMs: Date.now() - started,
      model: opts.model,
      provider: this.provider,
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
      body: JSON.stringify({
        system_instruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
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
      usageMetadata?: { totalTokenCount?: number };
    };
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    const tokens = data.usageMetadata?.totalTokenCount ?? estimateTokens(text, opts.system ?? '');
    return {
      text,
      tokens,
      latencyMs: Date.now() - started,
      model: opts.model,
      provider: this.provider,
    };
  }
}

/** Cliente único: resolve o adapter do provider e executa. */
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
    return adapter.complete(opts);
  }
}

/** Estimativa grosseira de tokens (chars/4) para quando a API não reporta. */
function estimateTokens(...texts: string[]): number {
  const chars = texts.reduce((acc, t) => acc + t.length, 0);
  return Math.max(1, Math.round(chars / 4));
}
