/**
 * Adaptive Routing — scoring de candidatos (agentes, skills, modelos).
 *
 * FinalScore = weighted sum de:
 *   relevance (semântica da task vs capabilities/triggers)
 *   historicalSuccess (estatística da memória de execuções)
 *   compatibility (resolver OK / versão compatível)
 *   risk (inverso — skills/agentes de alto risco pontuam menos)
 *   cost (inverso — barato pontua mais)
 *   latency (inverso)
 */

import type { CandidateScore } from '../types.js';

export interface ScoreInput {
  candidate: string;
  relevance: number;
  historicalSuccess?: number;
  compatibility?: number;
  risk?: number;
  cost?: number;
  latency?: number;
  weights?: Partial<Record<'relevance' | 'historicalSuccess' | 'compatibility' | 'risk' | 'cost' | 'latency', number>>;
  reasons?: string[];
}

export const DEFAULT_SCORE_WEIGHTS = {
  relevance: 0.4,
  historicalSuccess: 0.2,
  compatibility: 0.15,
  risk: 0.1,
  cost: 0.1,
  latency: 0.05,
};

export class CandidateScorer {
  score(input: ScoreInput): CandidateScore {
    const w = { ...DEFAULT_SCORE_WEIGHTS, ...input.weights };
    const relevance = clamp(input.relevance);
    const historicalSuccess = clamp(input.historicalSuccess ?? 0.5);
    const compatibility = clamp(input.compatibility ?? 1);
    const risk = clamp(input.risk ?? 0.1);
    const cost = clamp(input.cost ?? 0.5);
    const latency = clamp(input.latency ?? 0.5);

    const finalScore =
      relevance * w.relevance +
      historicalSuccess * w.historicalSuccess +
      compatibility * w.compatibility +
      (1 - risk) * w.risk +
      (1 - cost) * w.cost +
      (1 - latency) * w.latency;

    const reasons = [...(input.reasons ?? [])];
    if (relevance > 0.85) reasons.push('alta relevância semântica');
    if (historicalSuccess > 0.8) reasons.push('histórico de sucesso elevado');
    if (risk > 0.6) reasons.push('risco elevado — exige revisão');
    if (cost < 0.3) reasons.push('custo baixo');

    return {
      candidate: input.candidate,
      relevance,
      historicalSuccess,
      compatibility,
      risk,
      cost,
      latency,
      finalScore: round(finalScore),
      reasons,
    };
  }
}

/**
 * Relevância semântica simples (sem dependências): tokenização + overlap
 * de termos entre query e alvo (capabilities/triggers/description).
 * Suficiente para ranqueamento determinístico em CLI.
 */
export function semanticRelevance(query: string, target: string): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const t = new Set(tokenize(target));
  const hits = q.filter((w) => t.has(w));
  if (hits.length === 0) return 0;
  // pondera por comprimento do termo (termos longos são mais específicos)
  const weight = hits.reduce((acc, w) => acc + Math.min(1, w.length / 6), 0);
  const coverage = Math.min(1, hits.length / Math.max(1, q.length) * 1.5);
  return Math.min(1, weight / hits.length * 0.7 + coverage * 0.3);
}

/**
 * Cobertura de termos, para CAPABILITY MATCHING de agentes.
 *
 * Existe separada de `semanticRelevance` porque as duas perguntas são
 * diferentes, e responder as duas com a mesma função escolhia o agente errado
 * em metade dos objetivos medidos:
 *
 * - `semanticRelevance` pontua pela ESPECIFICIDADE média do termo casado, e por
 *   isso satura: um único termo longo em comum já devolve ~0.8. "Escreva a
 *   função validarCPF em TypeScript" dava exatamente 0.81 para
 *   `automation-engineer` e para `senior-engineer`, e o empate caía no
 *   desempate por ordem alfabética. Todo despacho errado observado terminou num
 *   agente alfabeticamente inicial, que é a assinatura desse empate.
 * - Aqui a pergunta é QUANTO do objetivo o agente cobre. A nota é cobertura:
 *   fração dos termos significativos do objetivo que o alvo casa. Casar 1 de 5
 *   termos vale 0.2, não 0.8.
 *
 * Duas normalizações que a outra não faz, e sem as quais justamente os termos
 * que decidem o roteamento não casavam:
 *
 * - **Verbo genérico de pedido sai do cálculo.** "criar", "escreva", "fazer"
 *   aparecem em quase todo objetivo e não distinguem agente nenhum, mas casavam
 *   com o texto de qualquer agente e produziam relevância do nada (era o que
 *   dava 0.67 ao `skill-architect` num objetivo sobre migration Postgres).
 *   Quando o objetivo é SÓ verbo genérico eles voltam a valer, porque aí são o
 *   único sinal que existe. Verbo que ROTEIA (auditar, explicar, revisar,
 *   corrigir, projetar) não entra nesta lista de propósito.
 * - **Casamento por prefixo a partir de 5 caracteres:** "postgres" casa
 *   "postgresql", "migration" casa "migrations". Sem isso o agente `database`
 *   tirava zero de relevância léxica num objetivo sobre migration Postgres,
 *   enquanto um agente que casou o verbo "criar" tirava 0.67.
 */
export function capabilityCoverage(objective: string, target: string): number {
  const all = tokenize(objective).map(canonicalize);
  if (all.length === 0) return 0;
  const significant = all.filter((w) => !GENERIC_REQUEST_TERMS.has(w));
  const terms = significant.length > 0 ? significant : all;
  const targetTokens = tokenize(target).map(canonicalize);
  if (targetTokens.length === 0) return 0;
  const hits = terms.filter((term) => targetTokens.some((t) => termsMatch(term, t))).length;
  return hits / terms.length;
}

/**
 * Reduz português e inglês ao mesmo radical quando os dois nomeiam o mesmo
 * conceito técnico.
 *
 * Não é enfeite: era a causa de dois despachos errados medidos. O objetivo
 * "Definir a arquitetura de um SaaS multi-tenant" não casava termo nenhum com o
 * agente `architect`, cuja descrição está em inglês ("Clean Architecture, DDD,
 * CQRS"), e casava "arquitetura" com o `adversarial-critic`, que menciona
 * "problemas de arquitetura" em português — o crítico ganhava do arquiteto por
 * causa do idioma da descrição. O mesmo com "Revisar este PR" e "Code Review".
 *
 * A lista é curta e só cobre pares onde os dois lados aparecem de fato no
 * catálogo. Casamento por prefixo já resolve o par quando as duas formas
 * compartilham as primeiras letras (`test`/`teste`, `migration`/`migrações`);
 * aqui entram só os pares que divergem cedo demais para o prefixo alcançar.
 */
function canonicalize(token: string): string {
  for (const [prefix, canonical] of CANONICAL_STEMS) {
    if (token.startsWith(prefix)) return canonical;
  }
  return token;
}

/** Prefixo observado no catálogo -> radical comum. Ordem: o mais longo primeiro. */
const CANONICAL_STEMS: Array<[string, string]> = [
  ['arquitet', 'architect'],
  ['architect', 'architect'],
  ['seguranc', 'secur'],
  ['secur', 'secur'],
  ['autentic', 'auth'],
  ['authentic', 'auth'],
  ['desempenh', 'perf'],
  ['performan', 'perf'],
  ['otimiz', 'optim'],
  ['optimi', 'optim'],
  ['pesquis', 'research'],
  ['research', 'research'],
  ['depura', 'debug'],
  ['debug', 'debug'],
  // "migration" e "migrações" divergem na 6ª letra: compartilham só `migra`,
  // que é curto demais para o casamento por prefixo (piso de 5) alcançar em
  // segurança sem canonizar.
  ['migra', 'migra'],
  ['revis', 'review'],
  ['review', 'review'],
  ['ensin', 'teach'],
  ['explica', 'teach'],
  ['explique', 'teach'],
  ['explain', 'teach'],
  ['teach', 'teach'],
];

/** Igualdade, ou prefixo a partir de 5 caracteres (`postgres` ~ `postgresql`). */
function termsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

/**
 * Termos que aparecem no pedido e não dizem nada sobre QUEM deve atender.
 * Só verbo/substantivo de embalagem: nada que implique um domínio ou um papel.
 */
const GENERIC_REQUEST_TERMS = new Set([
  'criar', 'crie', 'cria', 'create', 'fazer', 'faca', 'faz', 'make',
  'escrever', 'escreva', 'escreve', 'write', 'implementar', 'implemente', 'implement',
  'adicionar', 'adicione', 'add', 'montar', 'monte', 'gerar', 'gere', 'generate',
  'construir', 'constroi', 'build', 'preciso', 'quero', 'gostaria', 'favor',
  'usando', 'usar', 'utilizando', 'utilizar', 'novo', 'nova', 'new',
]);

function tokenize(text: string): string[] {
  const accents: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', â: 'a', ê: 'e', ô: 'o', ã: 'a', õ: 'o', ç: 'c' };
  return text
    .toLowerCase()
    .split('')
    .map((c) => accents[c] ?? c)
    .join('')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
    .filter((w) => !STOPWORDS.has(w));
}

const STOPWORDS = new Set([
  'para', 'com', 'uma', 'um', 'que', 'dos', 'das', 'tem', 'ser', 'seu', 'sua', 'the', 'and', 'for', 'with', 'from', 'this', 'that',
]);

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
