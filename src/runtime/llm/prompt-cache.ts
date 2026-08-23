/**
 * Prompt Cache — Cache-Aware Prompt Compression (CAPC).
 *
 * Módulo PURO (zero I/O, zero deps): decide como um system prompt se divide
 * entre prefixo ESTÁTICO (idêntico entre chamadas → cacheável pelo provider)
 * e sufixo DINÂMICO (volátil por sessão/run).
 *
 * Convenção do framework: o delimitador explícito `<!-- IZANAGI:DYNAMIC -->`
 * marca a fronteira — tudo ABAIXO do primeiro marcador é volátil. Autores de
 * prompts grandes (skills, agentes) colocam regras/identidade/persona acima do
 * marcador e contexto de sessão abaixo. Sem marcador, tudo é estático.
 *
 * Por que isso importa:
 *   - Anthropic cobra ~10x menos por token lido do cache, mas só cacheia
 *     blocos marcados com cache_control E com no mínimo MIN_CACHEABLE_TOKENS
 *     (1024 tokens hoje). Abaixo disso o header seria ignorado — por isso
 *     enviamos string simples (wire idêntico ao anterior) quando não vale.
 *   - OpenAI/OpenRouter/Ollama/LM Studio fazem prefix caching automático:
 *     basta o INÍCIO do payload ser byte-idêntico entre chamadas — por isso a
 *     ordem system→messages é estável e o delimitador nunca vai pro fio.
 */

/** Delimitador canônico: tudo abaixo da primeira ocorrência é dinâmico/volátil. */
export const DYNAMIC_MARKER = '<!-- IZANAGI:DYNAMIC -->';

/**
 * Piso real do Anthropic prompt caching: blocos com menos tokens que isso não
 * são elegíveis a cache (o provider ignora cache_control abaixo de 1024).
 * https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */
export const MIN_CACHEABLE_TOKENS = 1024;

/** Resultado da separação estático × dinâmico de um system prompt. */
export interface StaticDynamicSplit {
  /** Prefixo estável — idêntico entre chamadas (candidato a cache). */
  staticText: string;
  /** Sufixo volátil — muda por sessão/run (fica FORA do bloco cacheado). */
  dynamicText: string;
  /** true se o delimitador estava presente no texto de entrada. */
  hasMarker: boolean;
}

/**
 * Separa o system prompt no primeiro delimitador `<!-- IZANAGI:DYNAMIC -->`.
 * Fidelidade preservada: os slices NÃO fazem trim — concatenar staticText +
 * dynamicText reproduz a entrada original exatamente sem o marcador.
 * Sem marcador (ou entrada vazia/undefined), tudo é estático.
 * Múltiplos marcadores: apenas o primeiro corta (o restante já é dinâmico).
 */
export function splitStaticDynamic(system?: string): StaticDynamicSplit {
  if (!system) return { staticText: '', dynamicText: '', hasMarker: false };
  const idx = system.indexOf(DYNAMIC_MARKER);
  if (idx === -1) return { staticText: system, dynamicText: '', hasMarker: false };
  return {
    staticText: system.slice(0, idx),
    dynamicText: system.slice(idx + DYNAMIC_MARKER.length),
    hasMarker: true,
  };
}

/**
 * Reconstrói o system prompt para wire formats SEM suporte a blocos
 * (OpenAI-compatible): conteúdo original com o delimitador removido. O prefixo
 * continua byte-estável entre chamadas — condição para o prefix caching
 * automático desses providers.
 */
export function joinWithoutMarker(system?: string): string {
  const split = splitStaticDynamic(system);
  return split.staticText + split.dynamicText;
}

/**
 * Estimativa grosseira de tokens (~4 chars/token) — mesma heurística usada
 * pelo LLMClient quando o provider não reporta usage. Movida pra cá para ser
 * a única fonte da verdade compartilhada entre client e decisões de cache.
 */
export function estimateTokens(...texts: string[]): number {
  const chars = texts.reduce((acc, t) => acc + t.length, 0);
  return Math.max(1, Math.round(chars / 4));
}

/** Estimativa de tokens do PREFIXO ESTÁTICO — insumo da decisão de cache. */
export function estimateStaticTokens(text: string): number {
  return estimateTokens(text);
}

/**
 * O prefixo estático deste system prompt atinge o piso de cacheabilidade?
 * Encapsula split + estimativa + threshold numa decisão só (usada pelos
 * adapters antes de aplicar cache_control no fio).
 */
export function isPromptCacheEligible(system?: string): boolean {
  return estimateStaticTokens(splitStaticDynamic(system).staticText) >= MIN_CACHEABLE_TOKENS;
}
