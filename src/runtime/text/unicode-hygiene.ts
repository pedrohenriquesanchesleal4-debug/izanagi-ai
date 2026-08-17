/**
 * Unicode Hygiene — remove caracteres invisíveis/homóglifos que modelos de
 * linguagem às vezes inserem no meio de código gerado (zero-width space no
 * meio de um identificador, non-breaking space no lugar de espaço normal
 * quebrando indentação sensível). Determinístico, sem chamada de rede/LLM —
 * uma passada de regex sobre a string, custo desprezível mesmo em arquivos
 * grandes.
 *
 * Escopo deliberadamente limitado: isto NÃO tenta reverter watermarking
 * estatístico (padrões de amostragem de token tipo SynthID/Kirchenbauer).
 * Fazer isso de verdade exigiria ou modelos de ML pesados (dependência
 * gigante, contra a filosofia zero-dep do framework) ou reescrever o texto
 * via outra chamada de LLM (custo de token real, e efeito colateral de
 * remover um sinal de proveniência que existe por razão legítima de
 * confiança/segurança — não é o mesmo problema que "esse espaço invisível
 * quebrou meu código"). Ver CHANGELOG para a decisão completa.
 */

/**
 * Codepoints de controle/formatação invisíveis comuns em saída de LLM ou
 * paste quebrado. Listados como números hex (nunca como caractere literal
 * no fonte — seria irônico um arquivo sobre "detectar invisíveis" escondê-los
 * na própria regex) e compilados numa regex: uma versão anterior iterava
 * `for...of` (grapheme-aware, lento — ~260ms num arquivo de 1.5MB a cada
 * `fs.write`); regex nativa do V8 faz o mesmo em <10ms, que é o que "não pode
 * impactar em nada" exige de verdade.
 */
const INVISIBLE_CODEPOINTS = [
  0x00ad, 0x034f, 0x061c,
  0x180b, 0x180c, 0x180d, 0x180e,
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f,
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064,
  0x2066, 0x2067, 0x2068, 0x2069,
  0xfeff, 0xfff9, 0xfffa, 0xfffb,
];

/** Espaços "exóticos" que se parecem com U+0020 mas não são — normalizados para espaço comum. */
const SPACE_HOMOGLYPH_CODEPOINTS = [
  0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x202f, 0x205f, 0x3000,
];

function codepointsToClassRegex(codepoints: number[]): RegExp {
  const chars = codepoints.map((c) => String.fromCodePoint(c)).join('');
  return new RegExp(`[${chars}]`, 'gu');
}

const INVISIBLE_RE = codepointsToClassRegex(INVISIBLE_CODEPOINTS);
const SPACE_HOMOGLYPH_RE = codepointsToClassRegex(SPACE_HOMOGLYPH_CODEPOINTS);

export interface SanitizeResult {
  text: string;
  /** Quantos caracteres invisíveis foram removidos. */
  removed: number;
  /** Quantos espaços homóglifos foram normalizados para espaço comum. */
  normalizedSpaces: number;
  /** Verdadeiro se algo mudou (útil pra log/telemetria sem comparar strings de novo). */
  changed: boolean;
}

/**
 * Remove caracteres de controle invisíveis e normaliza espaços homóglifos.
 * Sempre determinístico e local — nenhuma chamada de rede/LLM.
 */
export function sanitizeText(input: string): SanitizeResult {
  let removed = 0;
  let normalizedSpaces = 0;

  const text = input
    .replace(INVISIBLE_RE, () => {
      removed++;
      return '';
    })
    .replace(SPACE_HOMOGLYPH_RE, () => {
      normalizedSpaces++;
      return ' ';
    });

  return { text, removed, normalizedSpaces, changed: removed > 0 || normalizedSpaces > 0 };
}
