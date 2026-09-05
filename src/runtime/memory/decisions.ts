/**
 * Decision Journal — registro estruturado das decisões do runtime, para
 * responder "por que o Izanagi escolheu isso?" sem depender de reconstruir
 * chain-of-thought. Cada decisão guarda a opção escolhida, as alternativas
 * REALMENTE consideradas (com score), a razão e a confiança — não apenas
 * o resultado final.
 *
 * Complementa memory/store.ts (que guarda `learnings` textuais livres) e
 * observability/tracer.ts (que guarda spans do tipo 'decision' como log de
 * execução) com um índice pesquisável e estruturado, específico para
 * decisões de roteamento/seleção.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DecisionAlternative {
  option: string;
  score?: number;
  reason?: string;
}

/**
 * O que aconteceu com o run que esta decisão ajudou a produzir.
 *
 * Carimbado no FIM do run, sobre as decisões já gravadas. Sem isto o journal
 * registra escolhas e nunca as consequências delas, e uma escolha sem
 * consequência conhecida não ensina nada: é log, não memória.
 */
export interface DecisionOutcome {
  /** Veredito do run (`PASS`, `FAIL`, `HUMAN_REQUIRED`...). */
  status: string;
  score: number;
  /** Tarefas com verificação `VERIFIED` sobre o total verificado, quando houve. */
  verified?: { passed: number; total: number };
  recordedAt: string;
}

export interface Decision {
  id: string;
  /** Tipo da decisão — ex.: 'model-routing', 'agent-routing', 'skill-routing'. */
  kind: string;
  chosen: string;
  alternatives: DecisionAlternative[];
  reason: string;
  /** Confiança na decisão [0,1] — quanto a escolhida se destacou das alternativas. */
  confidence: number;
  runId?: string;
  agent?: string;
  relatedArtifacts?: string[];
  createdAt: string;
  /**
   * Objetivo do run, para recuperação SELETIVA por semelhança.
   *
   * Sem ele o journal só é pesquisável por tipo, escolha e razão — nenhum dos
   * três diz para QUE problema a escolha foi feita, que é a única pergunta que
   * torna uma decisão passada relevante para uma decisão presente.
   */
  objective?: string;
  /** Resultado do run. Ausente enquanto o run não terminou. */
  outcome?: DecisionOutcome;
}

const DECISIONS_FILE_REL = path.join('.izanagi', 'state', 'decisions.json');
const MAX_ENTRIES = 500;

export class DecisionJournal {
  private readonly file: string;
  private decisions: Decision[];

  constructor(opts: { baseDir: string }) {
    this.file = path.join(opts.baseDir, DECISIONS_FILE_REL);
    this.decisions = this.load();
  }

  private load(): Decision[] {
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        if (Array.isArray(raw)) return raw as Decision[];
      }
    } catch {
      // arquivo corrompido — recomeça o journal, não derruba o runtime
    }
    return [];
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // Mantém só as últimas MAX_ENTRIES — journal não deve crescer sem limite.
    const toPersist = this.decisions.slice(-MAX_ENTRIES);
    fs.writeFileSync(this.file, JSON.stringify(toPersist, null, 2), 'utf-8');
  }

  /**
   * Registra uma decisão. `confidence`, quando omitida, é derivada da
   * distância entre a opção escolhida e a melhor alternativa concorrente
   * (decisão "óbvia" → confiança alta; decisão apertada → confiança baixa).
   */
  record(input: Omit<Decision, 'id' | 'createdAt' | 'confidence'> & { confidence?: number }): Decision {
    const confidence = input.confidence ?? inferConfidence(input.chosen, input.alternatives);
    const decision: Decision = {
      id: `dec-${crypto.randomBytes(4).toString('hex')}`,
      createdAt: new Date().toISOString(),
      confidence,
      ...input,
    };
    this.decisions.push(decision);
    if (this.decisions.length > MAX_ENTRIES) this.decisions = this.decisions.slice(-MAX_ENTRIES);
    this.save();
    return decision;
  }

  list(limit = 50): Decision[] {
    return this.decisions.slice(-limit).reverse();
  }

  forRun(runId: string): Decision[] {
    return this.decisions.filter((d) => d.runId === runId);
  }

  /** Busca textual simples por tipo, escolhida ou razão. */
  search(query: string): Decision[] {
    const q = query.toLowerCase();
    return this.decisions.filter(
      (d) => d.kind.toLowerCase().includes(q) || d.chosen.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q),
    );
  }

  /**
   * Carimba o resultado do run nas decisões que ele produziu.
   *
   * Chamado uma vez, no fim. Decisão gravada em run anterior não é tocada, e
   * decisão que já tem resultado não é reescrita: o journal registra o que
   * aconteceu, não o que se pensa agora sobre o que aconteceu.
   */
  recordOutcome(runId: string, outcome: Omit<DecisionOutcome, 'recordedAt'>): number {
    let stamped = 0;
    for (const d of this.decisions) {
      if (d.runId !== runId || d.outcome) continue;
      d.outcome = { ...outcome, recordedAt: new Date().toISOString() };
      stamped++;
    }
    if (stamped > 0) this.save();
    return stamped;
  }

  /**
   * Decisões de runs ANTERIORES sobre objetivos semelhantes, e só as que já
   * têm resultado conhecido.
   *
   * Recuperação seletiva, no mesmo espírito de `findRelevantFailures`: nunca o
   * journal inteiro, nunca injetado no contexto de um modelo. O que volta daqui
   * alimenta uma decisão DETERMINÍSTICA do Commander, e é por isso que a
   * relevância pode ser léxica: o consumidor não é um modelo interpretando
   * texto, é um filtro comparando nomes de agente.
   *
   * Decisão sem resultado fica de fora porque não ensina nada: saber que uma
   * escolha foi feita, sem saber no que deu, é o log que o journal já era.
   */
  findRelevant(
    objective: string,
    opts: { kind?: string; limit?: number; excludeRunId?: string } = {},
  ): Array<Decision & { relevance: number }> {
    const wanted = terms(objective);
    if (wanted.size === 0) return [];
    const out: Array<Decision & { relevance: number }> = [];
    for (const d of this.decisions) {
      if (!d.outcome || !d.objective) continue;
      if (opts.kind && d.kind !== opts.kind) continue;
      if (opts.excludeRunId && d.runId === opts.excludeRunId) continue;
      const relevance = overlap(wanted, terms(d.objective));
      if (relevance >= MIN_RELEVANCE) out.push({ ...d, relevance });
    }
    return out.sort((a, b) => b.relevance - a.relevance).slice(0, opts.limit ?? 10);
  }
}

/**
 * Fração mínima de termos em comum para dois objetivos serem "semelhantes".
 *
 * Um terço, e não mais: objetivos são escritos por pessoas diferentes em
 * sessões diferentes, e exigir muita coincidência literal faria o journal nunca
 * casar nada — o que é indistinguível, na prática, de não ter retrieval.
 */
const MIN_RELEVANCE = 0.34;

/** Palavras significativas de um objetivo, sem as vazias. */
function terms(text: string): Set<string> {
  const stop = new Set(['de', 'da', 'do', 'para', 'com', 'em', 'no', 'na', 'um', 'uma', 'o', 'a', 'e', 'the', 'of', 'to', 'in', 'for']);
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-záàâãéêíóôõúüç0-9]+/i)
      .filter((w) => w.length > 2 && !stop.has(w)),
  );
}

/** Razão de Jaccard entre dois conjuntos de termos. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : Math.round((shared / union) * 100) / 100;
}

/** Distância entre a opção escolhida e a melhor concorrente → confiança [0,1]. */
function inferConfidence(chosen: string, alternatives: DecisionAlternative[]): number {
  const chosenScore = alternatives.find((a) => a.option === chosen)?.score;
  const others = alternatives.filter((a) => a.option !== chosen && typeof a.score === 'number');
  if (typeof chosenScore !== 'number' || others.length === 0) return 0.6;
  const bestOther = Math.max(...others.map((a) => a.score as number));
  const gap = chosenScore - bestOther;
  return Math.max(0.1, Math.min(0.99, 0.5 + gap));
}
