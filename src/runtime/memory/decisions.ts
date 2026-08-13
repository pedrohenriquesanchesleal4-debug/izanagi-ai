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
