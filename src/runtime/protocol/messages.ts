/**
 * Agent-to-Agent Protocol: comunicação estruturada entre tarefas.
 *
 * A arquitetura proíbe explicitamente a "colmeia de agentes" (A manda texto
 * longo para B, B manda texto longo para C). Quando uma tarefa precisa falar
 * com outra, ela emite um objeto tipado com referência a artefato, e não uma
 * cópia do conteúdo.
 *
 * Este módulo define esses objetos e o parsing tolerante da crítica: o crítico
 * é um modelo, então a saída dele chega como texto e precisa ser normalizada
 * de forma determinística antes de virar decisão de runtime.
 */

export type AgentMessageType = 'task' | 'result' | 'critique' | 'correction' | 'request' | 'evidence';

export interface AgentMessage<T = unknown> {
  id: string;
  from: string;
  to: string;
  type: AgentMessageType;
  taskId: string;
  /** Ids de artefatos (`runId:nodeId`). Preferir referência a copiar conteúdo. */
  artifactRefs?: string[];
  payload?: T;
  /** Confiança declarada pelo emissor em [0,1]. */
  confidence?: number;
  timestamp: string;
}

let messageSeq = 0;

export function createMessage<T>(input: Omit<AgentMessage<T>, 'id' | 'timestamp'>): AgentMessage<T> {
  messageSeq += 1;
  return { ...input, id: `msg-${Date.now().toString(36)}-${messageSeq.toString(36)}`, timestamp: new Date().toISOString() };
}

/* ============================ CRÍTICA ESTRUTURADA ============================ */

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CritiqueIssue {
  severity: IssueSeverity;
  description: string;
  /** Nó/artefato ao qual o problema se refere. */
  artifact?: string;
  suggestedFix?: string;
}

export interface Critique {
  status: 'approved' | 'needs_revision' | 'rejected';
  issues: CritiqueIssue[];
  /** Confiança do crítico na própria avaliação. */
  confidence?: number;
}

const SEVERITIES: IssueSeverity[] = ['low', 'medium', 'high', 'critical'];
const SEVERITY_RANK: Record<IssueSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function normalizeSeverity(value: unknown): IssueSeverity {
  const v = String(value ?? '').toLowerCase();
  if ((SEVERITIES as string[]).includes(v)) return v as IssueSeverity;
  if (/crit|blocker|bloque/.test(v)) return 'critical';
  if (/high|alta|alto|major/.test(v)) return 'high';
  if (/low|baixa|baixo|minor|nit/.test(v)) return 'low';
  return 'medium';
}

/**
 * Extrai o primeiro objeto JSON balanceado do texto. Modelos costumam
 * embrulhar JSON em cerca de código ou prosa; sem isso, `JSON.parse` direto
 * falharia em saídas perfeitamente utilizáveis.
 */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Converte a saída de um crítico em `Critique`. Nunca lança: saída não
 * parseável vira `needs_revision` com um issue explicando que a crítica não
 * chegou em formato utilizável (o que É um problema real, não um sucesso).
 */
export function parseCritique(text: string): Critique {
  const json = extractJsonObject(text ?? '');
  if (!json) {
    return {
      status: 'needs_revision',
      issues: [{ severity: 'medium', description: 'crítica não retornou objeto estruturado: não foi possível derivar ações de correção' }],
    };
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {
      status: 'needs_revision',
      issues: [{ severity: 'medium', description: 'crítica retornou JSON inválido' }],
    };
  }

  const rawIssues = Array.isArray(raw.issues) ? raw.issues : [];
  const issues: CritiqueIssue[] = rawIssues
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map((i) => ({
      severity: normalizeSeverity(i.severity),
      description: String(i.description ?? i.message ?? '').trim() || 'problema sem descrição',
      ...(typeof i.artifact === 'string' ? { artifact: i.artifact } : {}),
      ...(typeof i.suggestedFix === 'string' ? { suggestedFix: i.suggestedFix } : {}),
    }));

  const declared = String(raw.status ?? '').toLowerCase();
  const status: Critique['status'] = declared === 'approved' || declared === 'rejected' || declared === 'needs_revision'
    ? (declared as Critique['status'])
    : issues.length === 0
      ? 'approved'
      : 'needs_revision';

  return {
    status,
    issues,
    ...(typeof raw.confidence === 'number' ? { confidence: Math.max(0, Math.min(1, raw.confidence)) } : {}),
  };
}

/** Maior severidade presente na crítica (null quando não há issue). */
export function worstSeverity(critique: Critique): IssueSeverity | null {
  if (critique.issues.length === 0) return null;
  return critique.issues.reduce<IssueSeverity>((worst, issue) =>
    SEVERITY_RANK[issue.severity] > SEVERITY_RANK[worst] ? issue.severity : worst, 'low');
}

/** Crítica bloqueia a entrega? Só high/critical bloqueiam; low/medium viram recomendação. */
export function isBlocking(critique: Critique): boolean {
  if (critique.status === 'rejected') return true;
  const worst = worstSeverity(critique);
  return worst === 'high' || worst === 'critical';
}

/**
 * Instrução de correção MÍNIMA para o agente original: só os problemas
 * bloqueantes, sem reenviar histórico nenhum. É o oposto de "mandar tudo de
 * novo e pedir para melhorar".
 */
export function formatCorrection(critique: Critique, maxIssues = 5): string {
  const blocking = critique.issues
    .filter((i) => i.severity === 'high' || i.severity === 'critical')
    .slice(0, maxIssues);
  const chosen = blocking.length > 0 ? blocking : critique.issues.slice(0, maxIssues);
  if (chosen.length === 0) return 'Nenhum problema bloqueante relatado.';
  const lines = chosen.map((i, idx) => {
    const fix = i.suggestedFix ? ` Correção sugerida: ${i.suggestedFix}` : '';
    const where = i.artifact ? ` [${i.artifact}]` : '';
    return `${idx + 1}. (${i.severity})${where} ${i.description}${fix}`;
  });
  return `Corrija APENAS os problemas abaixo e devolva o artefato completo corrigido:\n${lines.join('\n')}`;
}
