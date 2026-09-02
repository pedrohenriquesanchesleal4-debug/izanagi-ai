/**
 * Juiz semântico default: o modelo que decide o que um check determinístico
 * não consegue decidir.
 *
 * A Verification Engine sempre soube usar um juiz; ninguém injetava um. O
 * resultado era conservador e correto (critério semântico ficava UNKNOWN, e o
 * nó nunca fechava VERIFIED), mas era uma capacidade que existia no papel.
 *
 * Três regras que este módulo respeita à risca:
 *
 * 1. Julgar é tarefa de WORKER. Avaliar "isto atende ao critério?" não paga o
 *    preço de um modelo de raciocínio: quem chama roteia pelo papel barato.
 * 2. O juiz recebe o critério e o artefato RESUMIDO, nunca o run inteiro.
 * 3. Saída ilegível é `inconclusive`, não reprovação. Um juiz que não respondeu
 *    não reprova ninguém — e continua não aprovando.
 */

import { extractJsonObject } from '../protocol/messages.js';
import { summarizeArtifact } from '../orchestration/context-resolver.js';
import type { JudgeVerdict, SemanticJudge } from './engine.js';

/** Teto de conteúdo enviado ao juiz. Julgar não precisa do artefato inteiro. */
const DEFAULT_MAX_CONTENT_CHARS = 4000;
/** Teto de saída do juiz: o veredito são duas chaves. */
const DEFAULT_MAX_TOKENS = 200;

const SYSTEM_PROMPT = `Você é um verificador. Recebe UM critério de aceite e o artefato produzido, e decide se o artefato atende ao critério.

Regras:
- Julgue APENAS o critério apresentado, não a qualidade geral do artefato.
- Na dúvida entre "atende parcialmente" e "não atende", responda false: um critério de aceite é binário.
- Não sugira melhorias, não reescreva o artefato.

Responda APENAS com este objeto JSON, sem texto antes ou depois:
{"pass": true|false, "reason": "uma frase curta com a evidência que sustenta o veredito"}`;

export interface ModelJudgeOptions {
  /** Chamada ao modelo já roteado para o papel barato. */
  complete: (input: { system: string; user: string; maxTokens: number }) => Promise<{ text: string; tokens: number; model: string }>;
  maxContentChars?: number;
  maxTokens?: number;
}

/**
 * Cria um juiz semântico apoiado em modelo. Nunca lança: falha de rede,
 * timeout ou saída ilegível viram `inconclusive`, que a engine trata como
 * "sem evidência conclusiva" — exatamente como a ausência de juiz.
 */
export function createModelJudge(opts: ModelJudgeOptions): SemanticJudge {
  const maxContentChars = opts.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

  return async ({ criterion, content, objective }): Promise<JudgeVerdict> => {
    const { summary, truncated } = summarizeArtifact(content, maxContentChars);
    const user = [
      `OBJETIVO DA TAREFA: ${objective}`,
      `CRITÉRIO A VERIFICAR: ${criterion.description}`,
      `ARTEFATO PRODUZIDO${truncated ? ' (resumido: começo e fim preservados)' : ''}:`,
      summary,
    ].join('\n\n');

    let raw: { text: string; tokens: number; model: string };
    try {
      raw = await opts.complete({ system: SYSTEM_PROMPT, user, maxTokens });
    } catch (err) {
      return {
        pass: false,
        inconclusive: true,
        message: `juiz semântico indisponível: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const verdict = parseVerdict(raw.text);
    return { ...verdict, tokens: raw.tokens, model: raw.model };
  };
}

/**
 * Converte a saída do juiz em veredito. Exportada porque o parsing é a parte
 * que erra: vale testar sozinha, sem modelo nenhum.
 */
export function parseVerdict(text: string): JudgeVerdict {
  const json = extractJsonObject(text ?? '');
  if (!json) {
    return { pass: false, inconclusive: true, message: 'juiz não devolveu objeto JSON: veredito não utilizável' };
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { pass: false, inconclusive: true, message: 'juiz devolveu JSON inválido' };
  }
  const value = raw.pass ?? raw.passed ?? raw.approved;
  // Só um booleano de verdade decide. "true"/"false" em string também contam
  // (modelo pequeno erra o tipo com frequência), qualquer outra coisa não.
  const pass = typeof value === 'boolean'
    ? value
    : typeof value === 'string' && /^(true|false)$/i.test(value.trim())
      ? value.trim().toLowerCase() === 'true'
      : null;
  if (pass === null) {
    return { pass: false, inconclusive: true, message: 'juiz não declarou "pass" como booleano' };
  }
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : typeof raw.message === 'string' ? raw.message.trim() : '';
  return { pass, ...(reason ? { message: reason } : {}) };
}
