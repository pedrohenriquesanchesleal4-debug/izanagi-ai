/**
 * Canvas Orchestration — diagnostics estruturados.
 *
 * Três níveis (ERROR/WARNING/INFO), cada um com código estável e mensagem
 * acionável. ERROR bloqueia execução; WARNING sinaliza risco; INFO informa
 * oportunidade (ex.: nós paralelizáveis).
 */

export type DiagnosticLevel = 'ERROR' | 'WARNING' | 'INFO';

export interface Diagnostic {
  level: DiagnosticLevel;
  /** Código estável (ex.: CAN-102). */
  code: string;
  message: string;
  /** Id do nó/aresta envolvido, quando aplicável. */
  refId?: string;
}

/** Validação semântica/schema: lista completa de diagnósticos. */
export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
  /** Conveniência: só os ERROR. */
  errors: Diagnostic[];
  warnings: Diagnostic[];
  infos: Diagnostic[];
}

export function makeDiagnostic(level: DiagnosticLevel, code: string, message: string, refId?: string): Diagnostic {
  return { level, code, message, refId };
}

export function validateResult(diagnostics: Diagnostic[]): ValidationResult {
  const errors = diagnostics.filter((d) => d.level === 'ERROR');
  return {
    valid: errors.length === 0,
    diagnostics,
    errors,
    warnings: diagnostics.filter((d) => d.level === 'WARNING'),
    infos: diagnostics.filter((d) => d.level === 'INFO'),
  };
}

/** Formata para linha de terminal/console. */
export function formatDiagnostic(d: Diagnostic): string {
  const tag = d.level === 'ERROR' ? '\x1b[31mERROR\x1b[0m' : d.level === 'WARNING' ? '\x1b[33mWARNING\x1b[0m' : '\x1b[90mINFO\x1b[0m';
  const ref = d.refId ? ` [${d.refId}]` : '';
  return `${tag} ${d.code}${ref}: ${d.message}`;
}

/**
 * Códigos estáveis do subsistema canvas.
 * CAN-1xx = schema/estrutura · CAN-2xx = semântica · CAN-3xx = execução.
 */
export const CAN_CODES = {
  PARSE_JSON: 'CAN-101',
  INVALID_NODE_TYPE: 'CAN-102',
  INVALID_KIND: 'CAN-103',
  UNKNOWN_AGENT: 'CAN-104',
  MISSING_SKILL: 'CAN-105',
  EDGE_UNKNOWN_NODE: 'CAN-106',
  ORPHAN_NODE: 'CAN-107',
  UNREACHABLE_NODE: 'CAN-108',
  CYCLE_NO_LOOP: 'CAN-109',
  INVALID_MODEL: 'CAN-110',
  UNSUPPORTED_REASONING: 'CAN-111',
  DUPLICATE_ID: 'CAN-201',
  INVALID_CONDITION: 'CAN-202',
  LOOP_NO_TERMINATION: 'CAN-203',
  LOOP_TOO_MANY: 'CAN-204',
  WEBHOOK_UNSAFE: 'CAN-205',
  PARALLEL_OPPORTUNITY: 'CAN-301',
  NO_ENTRY: 'CAN-302',
  NO_EXIT: 'CAN-303',
  EXECUTION_FAILED: 'CAN-401',
} as const;

export interface LoopValidationError {
  nodeId: string;
  maxIterations: number;
}