/**
 * Contracts & Artifacts — schemas de artefatos + validação programática.
 *
 * Artefato inválido → INVALID → REPAIR → RE-EVALUATE.
 * O validators.ts aplica os schemas sobre artefatos (string | objeto) e
 * devolve issues estruturadas.
 */

import crypto from 'crypto';
import type { ArtifactKind, ArtifactRef, ArtifactSchema } from '../types.js';

const STUB_PATTERNS = [
  /TODO/i,
  /FIXME/i,
  /XXX/i,
  /implement later/i,
  /placeholder/i,
  /not implemented/i,
  /lorem ipsum/i,
];

/**
 * Schemas padrão dos artefatos importantes do framework.
 * `kind` → schema. Compatível com a classe ArtifactRef.
 */
export const ARTIFACT_SCHEMAS: Record<ArtifactKind, ArtifactSchema> = {
  requirements: {
    kind: 'requirements',
    required: ['title', 'functional', 'acceptance'],
    minSize: 200,
    forbidden: ['[ ] checklist', '[x] 1.', 'TODO'],
  },
  architecture: {
    kind: 'architecture',
    required: ['context', 'decision', 'layers'],
    minSize: 300,
    forbidden: ['TODO', '// implement later'],
  },
  'database-schema': {
    kind: 'database-schema',
    required: ['model', 'relations'],
    minSize: 200,
    forbidden: ['TODO'],
    validate: (c) => {
      if (typeof c !== 'string') return ['conteúdo não textual'];
      const issues: string[] = [];
      if (!/index|unique|@id|primary key|primary_key/i.test(c)) issues.push('schema sem chave primária detectada');
      if (!/relation|references|foreign|\.prisma|create table/i.test(c)) issues.push('schema sem relacionamentos detectados');
      return issues;
    },
  },
  'api-contract': {
    kind: 'api-contract',
    required: ['method', 'path', 'request', 'response'],
    minSize: 200,
    forbidden: ['TODO'],
  },
  'security-report': {
    kind: 'security-report',
    required: ['severity', 'vulnerabilities', 'remediation'],
    minSize: 300,
    forbidden: ['TODO'],
  },
  'test-plan': {
    kind: 'test-plan',
    required: ['unit', 'integration', 'scenarios'],
    minSize: 200,
    forbidden: ['TODO'],
  },
  'implementation-plan': {
    kind: 'implementation-plan',
    required: ['steps', 'files'],
    minSize: 200,
    forbidden: ['TODO', '// implement later'],
  },
  evaluation: {
    kind: 'evaluation',
    required: ['verdict', 'score', 'metrics'],
    minSize: 100,
  },
  'benchmark-report': {
    kind: 'benchmark-report',
    required: ['summary', 'results'],
    minSize: 100,
  },
  research: {
    kind: 'research',
    required: ['findings', 'sources'],
    minSize: 200,
  },
  trace: {
    kind: 'trace',
    required: ['runId', 'spans'],
    minSize: 50,
  },
  raw: {
    kind: 'raw',
    required: [],
    minSize: 0,
  },
};

/** Normaliza conteúdo em string para validação. */
function toText(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

export function hashContent(content: string): string {
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 12);
}

export interface ValidationReport {
  kind: ArtifactKind;
  valid: boolean;
  issues: string[];
  /** Score de conformidade [0,1]. */
  score: number;
}

/**
 * Valida um artefato contra o schema do seu kind.
 */
export function validateArtifact(kind: ArtifactKind, content: unknown): ValidationReport {
  const schema = ARTIFACT_SCHEMAS[kind] ?? ARTIFACT_SCHEMAS.raw;
  const issues: string[] = [];
  const text = toText(content);

  if (text.trim().length < (schema.minSize ?? 0)) {
    issues.push(`conteúdo muito pequeno (${text.length} bytes, mínimo ${schema.minSize})`);
  }

  // Objeto estruturado: verifica campos obrigatórios
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;
    for (const field of schema.required) {
      if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
        issues.push(`campo obrigatório ausente: "${field}"`);
      }
    }
  } else if (schema.required.length > 0) {
    // Texto puro: verifica se contém os termos de estrutura
    for (const field of schema.required) {
      if (!text.toLowerCase().includes(field.toLowerCase())) {
        issues.push(`estrutura ausente no texto: menção a "${field}" não encontrada`);
      }
    }
  }

  for (const f of schema.forbidden ?? []) {
    if (text.includes(f)) issues.push(`conteúdo proibido detectado: "${f}"`);
  }
  if ((schema.forbidden?.length ?? 0) === 0) {
    for (const p of STUB_PATTERNS) {
      if (p.test(text)) {
        issues.push(`stub/lazy-code detectado: padrão "${p.source}"`);
        break;
      }
    }
  }

  if (schema.validate) {
    issues.push(...schema.validate(content));
  }

  const valid = issues.length === 0;
  const score = Math.max(0, 1 - issues.length * 0.15);
  return { kind, valid, issues: Array.from(new Set(issues)).slice(0, 12), score };
}

/**
 * Cria um ArtifactRef validado a partir de conteúdo.
 */
export function makeArtifact(kind: ArtifactKind, name: string, content: unknown, path?: string): ArtifactRef {
  const text = toText(content);
  const report = validateArtifact(kind, text);
  return {
    kind,
    name,
    path,
    size: text.length,
    hash: hashContent(text),
    valid: report.valid,
    issues: report.issues,
  };
}

/**
 * Valida um handoff entre agentes — só passa contexto relevante.
 */
export function validateHandoffShape(input: { from: string; to: string; reason: string; artifacts?: unknown[] }): string[] {
  const issues: string[] = [];
  if (!input.from) issues.push('handoff sem remetente (from)');
  if (!input.to) issues.push('handoff sem destinatário (to)');
  if (!input.reason || input.reason.length < 4) issues.push('handoff sem motivo claro (reason)');
  if (!input.artifacts || input.artifacts.length === 0) issues.push('handoff sem artefatos: contexto livre não deve ser passado');
  return issues;
}
