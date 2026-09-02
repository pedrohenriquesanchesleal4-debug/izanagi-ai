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
  /**
   * Correções vindas de uma crítica bloqueante. Quando presente, este contexto
   * é uma RETENTATIVA dirigida: o nó recebe o que precisa consertar e a própria
   * entrega anterior, não os insumos do grafo outra vez.
   */
  correction?: string;
  /** A tarefa pode pedir decomposição em vez de entregar (ver `subgraph.ts`). */
  decomposable?: boolean;
}

export interface ResolveContextOptions {
  /** Correção estruturada (saída de `formatCorrection`) a aplicar nesta rodada. */
  correction?: string;
  /** Habilita o protocolo de decomposição no prompt desta tarefa. */
  decomposable?: boolean;
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
  resolve(contract: TaskContract, available: Map<string, AvailableArtifact>, opts: ResolveContextOptions = {}): ResolvedContext {
    const perArtifact = this.opts.maxCharsPerArtifact ?? DEFAULT_PER_ARTIFACT;
    const total = this.opts.maxTotalChars ?? DEFAULT_TOTAL;

    // Rodada de correção: os insumos do grafo JÁ foram enviados na primeira
    // tentativa. Reenviar todos para pedir um ajuste é o oposto do protocolo:
    // o nó precisa da própria entrega anterior e da lista de correções, só.
    const wanted = opts.correction
      ? (available.has(contract.id) ? [contract.id] : [])
      : contract.inputs.length > 0 ? contract.inputs : contract.dependencies;
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
      ...(opts.correction ? { correction: opts.correction } : {}),
      ...(opts.decomposable ? { decomposable: true } : {}),
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
    if (ctx.expectedOutput.kind === 'critique') {
      out += CRITIQUE_OUTPUT_CONTRACT;
    }
    if (ctx.decomposable) {
      out += DECOMPOSITION_PROTOCOL;
    }
    if (ctx.upstream.length > 0) {
      const heading = ctx.correction ? 'SUA ENTREGA ANTERIOR (a corrigir)' : 'INSUMOS (saídas das tarefas anteriores)';
      out += `\n## ${heading}\n`;
      for (const up of ctx.upstream) {
        const flags = [up.valid ? 'válido' : 'INVÁLIDO', up.truncated ? 'resumido' : 'completo'].join(', ');
        out += `\n### ${up.nodeId} — ${up.kind}${up.ref ? ` (ref: ${up.ref})` : ''} [${flags}]\n${up.summary}\n`;
      }
    }
    if (ctx.correction) {
      out += `\n## CORREÇÕES OBRIGATÓRIAS (crítica bloqueante)\n${ctx.correction}\n`;
    }
    return out;
  }
}

/**
 * Contrato de saída do nó crítico. A crítica alimenta uma decisão de runtime
 * (`parseCritique` -> `isBlocking` -> correção do nó criticado), então precisa
 * ser um objeto e não um ensaio. O parser é tolerante (aceita JSON embrulhado
 * em prosa ou em cerca de código), mas pedir o formato é o que faz a
 * tolerância ser exceção em vez de regra.
 */
const CRITIQUE_OUTPUT_CONTRACT = `
## FORMATO DE SAÍDA OBRIGATÓRIO
Responda APENAS com um objeto JSON válido, sem texto antes ou depois:
{
  "status": "approved" | "needs_revision" | "rejected",
  "issues": [
    { "severity": "low" | "medium" | "high" | "critical",
      "description": "o problema concreto e verificável",
      "artifact": "id da tarefa criticada",
      "suggestedFix": "a correção mínima que resolve" }
  ],
  "confidence": 0.0-1.0
}
Regras: marque "high"/"critical" apenas o que de fato bloqueia a entrega (essas
severidades reprovam o artefato e disparam uma retentativa dirigida). Problema
sem "description" acionável é ruído. Nada encontrado: "status": "approved" com
"issues": [].
`;

/**
 * Protocolo de decomposição em execução. Só entra no prompt quando o contrato
 * marca a tarefa como decomponível, e a instrução é deliberadamente contrária
 * ao instinto do modelo: entregar é o caminho normal, decompor é a exceção que
 * precisa de justificativa. Sem isso, todo agente pediria decomposição, que é
 * mais fácil do que fazer o trabalho.
 */
const DECOMPOSITION_PROTOCOL = `
## SE A TAREFA NÃO COUBER NUMA ENTREGA SÓ
Entregue o artefato pedido. Essa é a resposta esperada.

Só quando o objetivo exigir frentes independentes que este contexto não permite
resolver de uma vez, responda APENAS com este objeto JSON, sem texto em volta:
{
  "reason": "por que não cabe numa entrega só",
  "decompose": [
    { "id": "identificador-curto", "objective": "o que esta sub-tarefa entrega",
      "outputKind": "tipo do artefato", "dependencies": ["id-de-outra-subtarefa"] }
  ]
}
Limites: no máximo 5 sub-tarefas, o orçamento de tokens desta tarefa é DIVIDIDO
entre elas (decompor não libera orçamento novo), e sub-tarefa não pode se
decompor de novo. Se a divisão não deixar cada parte viável, entregue.
`;
