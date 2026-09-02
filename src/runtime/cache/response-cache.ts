/**
 * Response Cache: cache local determinístico de respostas de modelo.
 *
 * Distinto do prompt caching do provider (`llm/prompt-cache.ts`), que barateia
 * o PREFIXO de uma chamada que ainda acontece. Aqui a chamada não acontece: a
 * mesma (provider, modelo, system, mensagens, teto de saída, temperatura)
 * devolve a resposta gravada, custo zero e latência de disco.
 *
 * Por que é seguro: a chave inclui TODAS as entradas que alteram a saída.
 * Temperatura acima de 0 continua sendo cacheada de propósito (o objetivo é
 * reexecutar um run idêntico sem repagar), mas o cache é OPT-IN justamente
 * porque essa é uma escolha do usuário, não um default silencioso.
 *
 * Invalidação: TTL por entrada e versão de esquema na chave. Um artefato
 * gravado por uma versão anterior do formato nunca é lido pela nova.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/** Muda quando o formato da entrada muda: invalida tudo que é antigo. */
const CACHE_SCHEMA = 'v1';
const CACHE_DIR_REL = path.join('.izanagi', 'state', 'cache', 'responses');
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

export interface CacheKeyInput {
  provider: string;
  model: string;
  system?: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface CachedResponse {
  text: string;
  tokens: number;
  model: string;
  provider: string;
  /** Momento em que a resposta original foi gravada. */
  storedAt: string;
  /** Tokens que a chamada original consumiu: é o que se economiza no hit. */
  originalTokens: number;
}

export interface ResponseCacheOptions {
  baseDir: string;
  enabled?: boolean;
  ttlMs?: number;
  maxEntries?: number;
}

export function cacheKey(input: CacheKeyInput): string {
  const canonical = JSON.stringify({
    schema: CACHE_SCHEMA,
    provider: input.provider,
    model: input.model,
    system: input.system ?? '',
    messages: input.messages.map((m) => [m.role, m.content]),
    maxTokens: input.maxTokens ?? null,
    temperature: input.temperature ?? null,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export class ResponseCache {
  private readonly dir: string;
  readonly enabled: boolean;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(opts: ResponseCacheOptions) {
    this.dir = path.join(opts.baseDir, CACHE_DIR_REL);
    this.enabled = opts.enabled ?? false;
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get stats(): { hits: number; misses: number } {
    return { hits: this.hits, misses: this.misses };
  }

  private fileFor(key: string): string {
    return path.join(this.dir, `${key}.json`);
  }

  /** Resposta gravada e ainda válida, ou null. Cache desligado sempre devolve null. */
  get(input: CacheKeyInput): CachedResponse | null {
    if (!this.enabled) return null;
    const file = this.fileFor(cacheKey(input));
    if (!fs.existsSync(file)) {
      this.misses++;
      return null;
    }
    try {
      const entry = JSON.parse(fs.readFileSync(file, 'utf-8')) as CachedResponse;
      const age = Date.now() - Date.parse(entry.storedAt);
      if (!Number.isFinite(age) || age > this.ttlMs) {
        fs.rmSync(file, { force: true });
        this.misses++;
        return null;
      }
      this.hits++;
      return entry;
    } catch {
      fs.rmSync(file, { force: true });
      this.misses++;
      return null;
    }
  }

  /** Grava a resposta. No-op com cache desligado ou resposta vazia. */
  set(input: CacheKeyInput, response: { text: string; tokens: number; model: string; provider: string }): void {
    if (!this.enabled) return;
    if (!response.text) return;
    fs.mkdirSync(this.dir, { recursive: true });
    const entry: CachedResponse = {
      text: response.text,
      tokens: response.tokens,
      model: response.model,
      provider: response.provider,
      storedAt: new Date().toISOString(),
      originalTokens: response.tokens,
    };
    fs.writeFileSync(this.fileFor(cacheKey(input)), JSON.stringify(entry), 'utf-8');
    this.evict();
  }

  /** Mantém o cache dentro do teto removendo as entradas mais antigas. */
  private evict(): void {
    let files: string[];
    try {
      files = fs.readdirSync(this.dir).filter((f) => f.endsWith('.json'));
    } catch {
      return;
    }
    if (files.length <= this.maxEntries) return;
    const byAge = files
      .map((f) => {
        const full = path.join(this.dir, f);
        try {
          return { full, mtime: fs.statSync(full).mtimeMs };
        } catch {
          return { full, mtime: 0 };
        }
      })
      .sort((a, b) => a.mtime - b.mtime);
    for (const entry of byAge.slice(0, files.length - this.maxEntries)) {
      fs.rmSync(entry.full, { force: true });
    }
  }

  /**
   * Registra o miss no Budget Controller quando o cache está ligado. Com cache
   * desligado não existe "miss": a chamada sempre aconteceria, então contar
   * inflaria artificialmente a taxa de erro do cache.
   */
  recordMissIfEnabled(budget?: { recordCacheMiss(): void }): void {
    if (this.enabled) budget?.recordCacheMiss();
  }

  /** Apaga o cache inteiro. Devolve quantas entradas foram removidas. */
  clear(): number {
    if (!fs.existsSync(this.dir)) return 0;
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith('.json'));
    for (const f of files) fs.rmSync(path.join(this.dir, f), { force: true });
    return files.length;
  }

  /**
   * Ligado por `IZANAGI_CACHE=1` (ou `--cache` na CLI, que seta a env).
   * Default desligado: cachear resposta de modelo é uma decisão do usuário.
   */
  static enabledFromEnv(): boolean {
    const v = process.env.IZANAGI_CACHE;
    return v === '1' || v === 'true' || v === 'on';
  }
}
