/**
 * Canvas Orchestration — parser do JSON Canvas 1.0.
 *
 * Compatibilidade: seguir jsoncanvas.org/spec/1.0 e PRESERVAR campos
 * desconhecidos (de apps compatíveis) intactos: azulejo de qualquer editor
 * canvas não pode ser destruído por nós. O parse é estrito em estrutura
 * (objeto com `nodes`/`edges`), tolerante em campos extras.
 */

import type { CanvasDefinition } from './types.js';
import { CAN_CODES, makeDiagnostic, validateResult, type ValidationResult } from './diagnostics.js';

export class CanvasParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanvasParseError';
  }
}

export interface ParsedCanvas extends CanvasDefinition {
  /** Diagnósticos de estrutura (apenas ERROR bloqueia). */
  diagnostics: ValidationResult;
}

export function parseCanvas(json: string): ParsedCanvas {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    throw new CanvasParseError(`JSON inválido: ${(err as Error).message}`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new CanvasParseError('canvas deve ser um objeto JSON com `nodes` e `edges`');
  }
  const diags = [];
  const { nodes, edges, ...rest } = data as Record<string, unknown>;

  if (!Array.isArray(nodes)) diags.push(makeDiagnostic('ERROR', CAN_CODES.PARSE_JSON, 'campo "nodes" ausente ou não é array'));
  if (!Array.isArray(edges)) diags.push(makeDiagnostic('ERROR', CAN_CODES.PARSE_JSON, 'campo "edges" ausente ou não é array'));

  const parsed: ParsedCanvas = {
    nodes: Array.isArray(nodes) ? (nodes as CanvasDefinition['nodes']) : [],
    edges: Array.isArray(edges) ? (edges as CanvasDefinition['edges']) : [],
    ...rest,
  };
  parsed.diagnostics = validateResult(diags);
  return parsed;
}

export function parseCanvasFromFile(source: string, json: string): { name: string; canvas: ParsedCanvas } {
  const canvas = parseCanvas(json);
  return { name: source.replace(/\.json$/i, '').replace(/\.canvas$/i, ''), canvas };
}