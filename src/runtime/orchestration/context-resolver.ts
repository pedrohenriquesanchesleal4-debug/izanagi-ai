/**
 * Context Resolver: monta o contexto MÍNIMO de uma tarefa.
 *
 * Regra da arquitetura: nunca enviar todo o histórico para todos os agentes.
 * O nó recebe o objetivo, as restrições, e os artefatos dos quais ele
 * realmente depende, resumidos e referenciados por id, e não o transcript
 * inteiro do run.
 *
 * Isto corrige também uma lacuna real do runtime anterior: os nós NÃO recebiam
 * as saídas dos predecessores. O nó `implementation` do template fullstack
 * dependia de `architecture`, `database-design` e `security-review`, mas o
 * prompt compilado só continha a tarefa original. Resultado: o grafo tinha
 * dependências topológicas sem transferência de informação.
 */

import type { TaskContract } from '../contracts/task-contract.js';

/** Um artefato disponível no run corrente. */
export interface AvailableArtifact {
  nodeId: string;
  kind: string;
  content: unknown;
  valid: boolean;
  /** Id do registro no ArtifactRegistry (`runId:nodeId`), quando registrado. */
  ref?: string;
}

export interface UpstreamContext {
  nodeId: string;
  kind: string;
  ref?: string;
  /** Resumo determinístico do conteúdo, dentro do orçamento de chars. */
  summary: string;
  /** true quando o conteúdo foi cortado (o resto fica acessível pela referência). */
  truncated: boolean;
  valid: boolean;
}

export interface ResolvedContext {
  objective: string;
  constraints: string[];
  expectedOutput: TaskContract['expectedOutput'];
  acceptance: string[];
  upstream: UpstreamContext[];
  /** Chars efetivamente gastos com upstream (telemetria de economia). */
  upstreamChars: number;
  /** Chars que teriam sido gastos enviando os artefatos inteiros. */
  upstreamCharsFull: number;
}

export interface ResolveOptions {
  /** Teto de chars por artefato upstream. */
  maxCharsPerArtifact?: number;
  /** Teto total de chars de upstream no contexto. */
  maxTotalChars?: number;
}

const DEFAULT_PER_ARTIFACT = 1200;
const DEFAULT_TOTAL = 4000;

function toText(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

/**
 * Corta preservando o começo e o fim: o começo carrega a estrutura (títulos,
 * decisões) e o fim costuma carregar a conclusão. Cortar só o começo perderia
 * o veredito; cortar só o fim perderia o enquadramento.
 */
export function summarizeArtifact(content: unknown, maxChars: number): { summary: string; truncated: boolean; fullLength: number } {
  const text = toText(content).trim();
  if (text.length <= maxChars) return { summary: text, truncated: false, fullLength: text.length };
  const head = Math.floor(maxChars * 0.65);
  const tail = Math.max(0, maxChars - head - 40);
  const omitted = text.length - head - tail;
  const summary = `${text.slice(0, head)}\n\n[... ${omitted} chars omitidos ...]\n\n${tail > 0 ? text.slice(-tail) : ''}`;
  return { summary, truncated: true, fullLength: text.length };
}

export class ContextResolver {
  constructor(private readonly opts: ResolveOptions = {}) {}

  /**
   * Contexto de um contrato: só os artefatos declarados em `inputs`
   * (ou `dependencies`), nessa ordem, dentro do orçamento de chars.
   */
  resolve(contract: TaskContract, available: Map<string, AvailableArtifact>): ResolvedContext {
    const perArtifact = this.opts.maxCharsPerArtifact ?? DEFAULT_PER_ARTIFACT;
    const total = this.opts.maxTotalChars ?? DEFAULT_TOTAL;

    const wanted = contract.inputs.length > 0 ? contract.inputs : contract.dependencies;
    const upstream: UpstreamContext[] = [];
    let used = 0;
    let full = 0;

    for (const nodeId of wanted) {
      const artifact = available.get(nodeId);
      if (!artifact) continue;
      const remaining = total - used;
      if (remaining <= 200) {
        // Sem espaço útil: entra só como referência, sem conteúdo. O agente
        // sabe que o artefato existe e pode pedir por id em vez de receber texto.
        const fullText = toText(artifact.content);
        full += fullText.length;
        upstream.push({
          nodeId,
          kind: artifact.kind,
          ...(artifact.ref ? { ref: artifact.ref } : {}),
          summary: `(conteúdo omitido por orçamento de contexto: ${fullText.length} chars)`,
          truncated: true,
          valid: artifact.valid,
        });
        continue;
      }
      const budget = Math.min(perArtifact, remaining);
      const { summary, truncated, fullLength } = summarizeArtifact(artifact.content, budget);
      used += summary.length;
      full += fullLength;
      upstream.push({
        nodeId,
        kind: artifact.kind,
        ...(artifact.ref ? { ref: artifact.ref } : {}),
        summary,
        truncated,
        valid: artifact.valid,
      });
    }

    return {
      objective: contract.objective,
      constraints: contract.constraints,
      expectedOutput: contract.expectedOutput,
      acceptance: contract.acceptance.filter((c) => !c.optional).map((c) => c.description),
      upstream,
      upstreamChars: used,
      upstreamCharsFull: full,
    };
  }

  /** Renderiza o contexto resolvido como bloco de prompt (parte volátil). */
  render(ctx: ResolvedContext): string {
    let out = `## OBJETIVO DESTA TAREFA\n${ctx.objective}\n\n`;
    if (ctx.constraints.length > 0) {
      out += `## RESTRIÇÕES\n- ${ctx.constraints.join('\n- ')}\n\n`;
    }
    out += `## SAÍDA ESPERADA\nArtefato do tipo \`${ctx.expectedOutput.kind}\`.\n`;
    if (ctx.acceptance.length > 0) {
      out += `\n## CRITÉRIOS DE ACEITE (verificados automaticamente)\n- ${ctx.acceptance.join('\n- ')}\n`;
    }
    if (ctx.upstream.length > 0) {
      out += `\n## INSUMOS (saídas das tarefas anteriores)\n`;
      for (const up of ctx.upstream) {
        const flags = [up.valid ? 'válido' : 'INVÁLIDO', up.truncated ? 'resumido' : 'completo'].join(', ');
        out += `\n### ${up.nodeId} — ${up.kind}${up.ref ? ` (ref: ${up.ref})` : ''} [${flags}]\n${up.summary}\n`;
      }
    }
    return out;
  }
}
