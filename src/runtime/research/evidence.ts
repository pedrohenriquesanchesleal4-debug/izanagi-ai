/**
 * Research / Evidence System — pesquisa como artefato estruturado.
 *
 * Cada claim importante carrega: claim, source, confidence, sourceType,
 * verifiedAt. Diferencia FACT | ASSUMPTION | INFERENCE | UNKNOWN e prioriza
 * fontes por hierarquia (official docs > source code > tests > package metadata
 * > reliable tech > community).
 *
 * O registry permite à pipeline (ex.: composição research_evidence) coletar
 * evidências, classificar, verificar e gerar relatório com claims críticas.
 */

import type { ArtifactKind } from '../types.js';

export type EvidenceType = 'FACT' | 'ASSUMPTION' | 'INFERENCE' | 'UNKNOWN';

export type EvidenceSourceType =
  | 'official-docs'
  | 'source-code'
  | 'tests'
  | 'package-metadata'
  | 'reliable-tech'
  | 'community';

/** Peso de confiabilidade por tipo de fonte — prioridade de verificação. */
export const SOURCE_TRUST: Record<EvidenceSourceType, number> = {
  'official-docs': 1,
  'source-code': 0.95,
  tests: 0.9,
  'package-metadata': 0.85,
  'reliable-tech': 0.7,
  community: 0.5,
};

export const SOURCE_RANK: EvidenceSourceType[] = [
  'official-docs',
  'source-code',
  'tests',
  'package-metadata',
  'reliable-tech',
  'community',
];

export interface EvidenceClaim {
  id: string;
  claim: string;
  type: EvidenceType;
  source?: string;
  sourceType: EvidenceSourceType;
  /** Confiança do próprio LLM/agente que emitiu a claim em [0,1]. */
  confidence: number;
  verifiedAt: string;
  /** Quando verificado contra fonte primária (FACT com source oficial). */
  verified?: boolean;
  tags?: string[];
}

export interface EvidenceReport {
  total: number;
  byType: Record<EvidenceType, number>;
  bySourceType: Record<EvidenceSourceType, number>;
  avgConfidence: number;
  /** Claims com confiança baixa ou tipo UNKNOWN — exigem verificação. */
  critical: EvidenceClaim[];
  /** Fonte de maior confiança encontrada por claim relevante. */
  bestSources: Array<{ claim: string; sourceType: EvidenceSourceType }>;
}

let seq = 0;

function newId(): string {
  seq += 1;
  return `ev-${Date.now().toString(36)}-${seq.toString(36)}`;
}

/** Infere o tipo inicial de uma claim a partir do texto e da confiança. */
export function inferEvidenceType(text: string, confidence: number): EvidenceType {
  if (confidence < 0.6) return 'UNKNOWN';
  if (/^(eu )?(acho|acredito|presumo|suponho|provavelmente|talvez|assumo)/i.test(text.trim())) return 'ASSUMPTION';
  if (/(portanto|logo|conclui-?se|inferi|deriva(do)? de|implica)/i.test(text.trim())) return 'INFERENCE';
  if (/^(per spec|oficial|segundo docs|documentação oficial|a documentação diz|a documentação oficial diz)/i.test(text.trim())) return 'FACT';
  return confidence >= 0.85 ? 'INFERENCE' : 'UNKNOWN';
}

export class EvidenceRegistry {
  private claims: EvidenceClaim[] = [];

  /** Adiciona uma claim (com tipo inferido quando não informado). */
  add(input: Omit<EvidenceClaim, 'id' | 'verifiedAt' | 'type' | 'verified'> & { type?: EvidenceType; verified?: boolean }): EvidenceClaim {
    const type = input.type ?? inferEvidenceType(input.claim, input.confidence);
    const claim: EvidenceClaim = {
      id: newId(),
      claim: input.claim,
      type,
      source: input.source,
      sourceType: input.sourceType,
      confidence: Math.max(0, Math.min(1, input.confidence)),
      verifiedAt: new Date().toISOString(),
      verified: input.verified ?? false,
      tags: input.tags,
    };
    this.claims.push(claim);
    return claim;
  }

  /** Registra claims em lote (ex.: saída de deep-research) — texto cru ou objetos. */
  ingest(raw: unknown): number {
    let added = 0;
    const items = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      if (typeof item === 'string') {
        this.add({ claim: item, confidence: 0.5, sourceType: 'community' });
        added++;
      } else if (item && typeof item === 'object') {
        const c = item as Partial<EvidenceClaim>;
        if (c.claim) {
          this.add({
            claim: String(c.claim),
            confidence: typeof c.confidence === 'number' ? c.confidence : 0.7,
            sourceType: (c.sourceType as EvidenceSourceType) ?? 'reliable-tech',
            source: c.source,
            type: c.type,
            tags: c.tags,
          });
          added++;
        }
      }
    }
    return added;
  }

  /**
   * Verifica uma claim: marca como verified e sobe o tipo quando a fonte é
   * primária (official-docs / source-code / tests / package-metadata).
   */
  verify(id: string, sourceType: EvidenceSourceType): EvidenceClaim | undefined {
    const claim = this.claims.find((c) => c.id === id);
    if (!claim) return undefined;
    claim.verified = true;
    claim.sourceType = sourceType;
    claim.confidence = Math.max(claim.confidence, SOURCE_TRUST[sourceType]);
    if (SOURCE_TRUST[sourceType] >= 0.9) claim.type = 'FACT';
    claim.verifiedAt = new Date().toISOString();
    return claim;
  }

  all(): EvidenceClaim[] {
    return [...this.claims];
  }

  /** Score de veracidade de uma claim: confiança × confiabilidade da fonte. */
  score(claim: EvidenceClaim): number {
    return claim.confidence * SOURCE_TRUST[claim.sourceType] * (claim.verified ? 1 : 0.9);
  }

  /** Busca claims por termo (claim, source ou tag). */
  search(query: string): EvidenceClaim[] {
    const q = query.toLowerCase();
    return this.claims.filter(
      (c) =>
        c.claim.toLowerCase().includes(q) ||
        (c.source ?? '').toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }

  /** Claims com score abaixo do limiar ou tipo UNKNOWN — precisam verificação. */
  critical(minScore = 0.6): EvidenceClaim[] {
    return this.claims.filter((c) => c.type === 'UNKNOWN' || this.score(c) < minScore);
  }

  /** Relatório estruturado (artefato kind: research). */
  report(): EvidenceReport {
    const byType = { FACT: 0, ASSUMPTION: 0, INFERENCE: 0, UNKNOWN: 0 };
    const bySourceType: Record<EvidenceSourceType, number> = {
      'official-docs': 0,
      'source-code': 0,
      tests: 0,
      'package-metadata': 0,
      'reliable-tech': 0,
      community: 0,
    };
    let confidenceSum = 0;
    for (const c of this.claims) {
      byType[c.type]++;
      bySourceType[c.sourceType]++;
      confidenceSum += c.confidence;
    }
    const bestSources = this.claims
      .filter((c) => c.type !== 'UNKNOWN')
      .sort((a, b) => SOURCE_RANK.indexOf(a.sourceType) - SOURCE_RANK.indexOf(b.sourceType))
      .slice(0, 5)
      .map((c) => ({ claim: c.claim, sourceType: c.sourceType }));

    return {
      total: this.claims.length,
      byType,
      bySourceType,
      avgConfidence: this.claims.length > 0 ? confidenceSum / this.claims.length : 0,
      critical: this.critical(),
      bestSources,
    };
  }

  /** Fábrica de relatório no formato de artefato 'research' (contrato). */
  toArtifact(): { kind: ArtifactKind; content: EvidenceReport } {
    return { kind: 'research', content: this.report() };
  }
}