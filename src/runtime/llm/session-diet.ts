/**
 * Session Diet — Observation Masking determinístico (AgentDiet, Wave 7 Frente B).
 *
 * Módulo PURO (zero I/O, zero deps): reduz o custo de token de histórios
 * multi-turno longos substituindo observações antigas e longas por resumos
 * sintéticos de UMA linha — sem LLM auxiliar, sem heurística fuzzy, sem
 * remover mensagens. Tudo que o modelo precisa para continuar respondendo
 * (estrutura do diálogo, papéis, tópicos) permanece; só o VERBOSE oculto
 * vira métrica.
 *
 * Garantias contratuais:
 *   - Função PURA e DETERMINÍSTICA: mesma entrada → mesma saída (JSON.stringify
 *     idêntico entre execuções); re-aplicar sobre a saída é estável.
 *   - JANELA RECENTE intocada byte-a-byte (mesma referência de objeto).
 *   - role 'system' NUNCA é mascarado: é o prefixo cacheável do CAPC
 *     (runtime/llm/prompt-cache.ts) — mascarar system invalidaria o cache de
 *     prompt do Anthropic/OpenAI e degradaria custo/latência.
 *   - Mensagens curtas (≤ MAX_OBS_CHARS) ficam intocadas.
 *   - Abaixo de MIN_TURNS turnos, a ENTRADA é retornada intacta (no-op,
 *     mesma instância) — dietas em históricos curtos só adicionariam risco.
 *
 * DEFINIÇÃO DE TURNO adotada: um turno = UMA mensagem unitária do array
 * (cada elemento de CompletionMessage[] conta como 1 turno). A alternativa
 * "par user+assistant" foi descartada porque históricos reais contêm órfãos
 * (abertura por assistant, user final sem resposta), o que tornaria a
 * segmentação ambígua; mensagem unitária é 100% determinística. Com
 * RECENT_WINDOW=4, as últimas 4 MENSAGENS (não pares) ficam preservadas.
 *
 * Formato do resumo sintético (1 linha):
 *   `<primeira linha não-vazia truncada a 120> … [+N linhas / ~M chars ocultados]`
 * Onde N = total de linhas − 1 (todas menos a usada como head) e
 * M = content.length − comprimento visível do head (cobre tanto as linhas
 * seguintes quanto o truncamento da própria primeira linha). Sem linha
 * não-vazia (só whitespace), o head é vazio e o formato colapsa para
 * `… [+N linhas / ~M chars ocultados]`.
 */

/** Piso mínimo de turnos para a dieta valer a pena; abaixo disso, no-op. */
export const MIN_TURNS = 10;

/** Quantidade de mensagens MAIS RECENTES preservadas byte-a-byte. */
export const RECENT_WINDOW = 4;

/**
 * Observações com mais chars que isso (fora da janela recente) são candidatas
 * a máscara; iguais ou abaixo ficam intocadas.
 */
export const MAX_OBS_CHARS = 400;

/** Limite duro do head do resumo: primeira linha não-vazia truncada a este tamanho. */
export const SUMMARY_HEAD_CHARS = 120;

/** Forma estrutural mínima consumida pela dieta — compatível (structural typing)
 *  com `CompletionMessage` do client.ts SEM importá-lo (evita ciclo de imports:
 *  client.ts importa este módulo). */
export interface DietTurnMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Knobs opcionais da dieta; ausente = defaults contratuais. */
export interface DietOptions {
  /** Piso de turnos para ativar a dieta (default MIN_TURNS). */
  minTurns?: number;
  /** Mensagens recentes preservadas (default RECENT_WINDOW). */
  recentWindow?: number;
  /** Piso de chars para mascarar uma observação (default MAX_OBS_CHARS). */
  maxObsChars?: number;
}

function sanitizeInt(value: number | undefined, fallback: number, floor: number): number {
  const n = Math.floor(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  return Math.max(floor, n);
}

/**
 * Resumo sintético determinístico de UMA linha para uma observação longa.
 * Função total: conteúdo no piso ou abaixo retorna intacto; acima, produz
 * `<head truncado> … [+N linhas / ~M chars ocultados]` (ver doc do módulo).
 */
export function summarizeObservation(content: string, maxObsChars: number = MAX_OBS_CHARS): string {
  const floor = sanitizeInt(maxObsChars, MAX_OBS_CHARS, 1);
  if (content.length <= floor) return content;

  const lines = content.split('\n');
  let rawFirstLine = '';
  let foundNonEmpty = false;
  for (const line of lines) {
    if (line.trim().length > 0) {
      rawFirstLine = line;
      foundNonEmpty = true;
      break;
    }
  }

  const head = rawFirstLine.slice(0, SUMMARY_HEAD_CHARS);
  // Oculto = tudo que NÃO está visível no resumo: linhas seguintes + newlines +
  // eventual excesso truncado da própria primeira linha.
  const hiddenChars = content.length - head.length;
  const hiddenLines = lines.length - 1;
  const metrics = `[+${hiddenLines} linhas / ~${hiddenChars} chars ocultados]`;
  return foundNonEmpty ? `${head} … ${metrics}` : `… ${metrics}`;
}

/**
 * Aplica a dieta ao histórico completo (função pura — nunca muta a entrada).
 *
 * Regras, na ordem:
 *   1. messages.length < minTurns → retorna a MESMA instância (no-op).
 *   2. Últimas recentWindow mensagens → intocadas (mesma referência).
 *   3. role 'system' → intocado em qualquer posição (prefixo CAPC).
 *   4. content.length ≤ maxObsChars → intocada (mesma referência).
 *   5. Restante → novo objeto com content substituído pelo resumo de 1 linha.
 *
 * A saída tem SEMPRE o mesmo length da entrada (dieta mascara, jamais remove).
 */
export function dietHistory<T extends DietTurnMessage>(messages: readonly T[], opts?: DietOptions): T[] {
  const minTurns = sanitizeInt(opts?.minTurns, MIN_TURNS, 0);
  const recentWindow = sanitizeInt(opts?.recentWindow, RECENT_WINDOW, 0);
  const maxObsChars = sanitizeInt(opts?.maxObsChars, MAX_OBS_CHARS, 1);

  if (messages.length < minTurns) return messages as unknown as T[];

  const windowStart = Math.max(0, messages.length - recentWindow);

  return messages.map((message, index): T => {
    if (index >= windowStart) return message; // janela recente: byte-a-byte
    if (message.role === 'system') return message; // CAPC: prefixo cacheável sagrado
    if (message.content.length <= maxObsChars) return message; // curta: intocada
    return { ...message, content: summarizeObservation(message.content, maxObsChars) };
  });
}
