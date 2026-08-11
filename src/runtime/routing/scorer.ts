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
