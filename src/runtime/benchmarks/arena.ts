/**
 * Izanagi Arena: as métricas que só uma execução REAL produz.
 *
 * A suíte de benchmark responde "o artefato esperado apareceu?". Isso é uma
 * medida de output. A Arena descrita na arquitetura pede mais: quanto do que
 * foi entregue está **comprovado**, quantas falhas o runtime **curou sozinho**,
 * quantas retentativas custou, e quanto se pagou por isso.
 *
 * Nada aqui é estimado. Toda métrica sai de um `OrchestrationResult` de um run
 * que aconteceu — se o run não aconteceu, o campo simplesmente não existe, e o
 * relatório diz que não existe. O Token Benchmark (`token-benchmark.ts`) mede
 * PLANO, e continua sendo outra coisa; misturar os dois números seria vender
 * teto de orçamento como consumo real.
 */

import { checkGroundedness } from '../verification/groundedness.js';

/**
 * Fundamentação dos artefatos de um run: dos caminhos que eles citaram, quantos
 * existem no projeto.
 *
 * É a única métrica da Arena que fala sobre o CONTEÚDO, e não sobre a mecânica
 * do runtime. Verificação alta com fundamentação baixa é um run que cumpriu
 * todos os critérios de schema descrevendo um projeto que não existe — e essa
 * combinação é invisível em qualquer das outras métricas.
 *
 * `rate` é `null` quando nenhum artefato citou caminho nenhum. Ausência de
 * referência não é fundamentação zero: é ausência de medida, e a Arena não
 * imprime `0%` para dizer "não sei".
 */
export interface GroundednessEvidence {
  /** Caminhos citados e conferidos. */
  references: number;
  /** Caminhos cujo lugar existe no projeto. */
  grounded: number;
  rate: number | null;
  /** Artefatos que citaram pelo menos um caminho. */
  artifactsWithReferences: number;
}

/** Evidência de UMA execução real, extraída do resultado do Orchestrator. */
export interface ExecutionEvidence {
  /** Veredito final do run. */
  status: string;
  /** Modo escolhido pelo Commander (ausente no caminho legado). */
  mode?: string;
  /** Tarefas com veredito de verificação. */
  verifiedTasks: number;
  totalVerifiedTasks: number;
  /** Fração de tarefas `VERIFIED` em [0,1]. `null` quando não houve verificação. */
  verificationRate: number | null;
  /** Falhas que o healing conseguiu curar / falhas totais. `null` sem falha. */
  recoveryRate: number | null;
  failures: number;
  recovered: number;
  /** Retentativas somadas sobre todos os nós (attempts além da primeira). */
  retries: number;
  healingActions: number;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  /** Fundamentação dos artefatos. Ausente quando não havia projeto para conferir. */
  groundedness?: GroundednessEvidence;
}

/** Superfície mínima do resultado do Orchestrator consumida aqui. */
export interface RunLikeResult {
  status: string;
  mode?: string;
  healing: Array<{ kind: string; nodeId?: string }>;
  graph?: { nodes: Array<{ id: string; status?: string; attempts?: number }> };
  verification?: Array<{ nodeId: string; result: { status: string } }>;
  telemetry?: { estimatedCostUsd?: number };
  trace: { durationMs: number; tokens?: { total: number } };
  /** Artefatos produzidos, por id de tarefa. Necessário para medir fundamentação. */
  artifacts?: Record<string, { kind: string; content: unknown }>;
}

/**
 * Converte o resultado de um run em evidência comparável.
 *
 * `recovered` conta o nó que FALHOU em algum momento e terminou `succeeded`:
 * é a definição operacional de "o runtime se curou". Contar ações de healing
 * como sucesso seria contar a tentativa, não o conserto.
 */
export function evidenceFromRun(result: RunLikeResult, workspaceDir?: string): ExecutionEvidence {
  const verification = result.verification ?? [];
  const verified = verification.filter((v) => v.result.status === 'VERIFIED').length;

  // Um nó que precisou de mais de uma tentativa falhou pelo menos uma vez.
  const nodes = result.graph?.nodes ?? [];
  const attempted = nodes.filter((n) => (n.attempts ?? 0) > 1 || n.status === 'failed');
  const failures = attempted.length;
  const recovered = attempted.filter((n) => n.status === 'succeeded').length;
  const retries = nodes.reduce((acc, n) => acc + Math.max(0, (n.attempts ?? 0) - 1), 0);

  return {
    status: result.status,
    ...(result.mode ? { mode: result.mode } : {}),
    verifiedTasks: verified,
    totalVerifiedTasks: verification.length,
    verificationRate: verification.length > 0 ? round(verified / verification.length) : null,
    recoveryRate: failures > 0 ? round(recovered / failures) : null,
    failures,
    recovered,
    retries,
    healingActions: result.healing.length,
    tokensUsed: result.trace.tokens?.total ?? 0,
    costUsd: result.telemetry?.estimatedCostUsd ?? 0,
    durationMs: result.trace.durationMs,
    ...(workspaceDir ? { groundedness: measureGroundedness(result.artifacts ?? {}, workspaceDir) } : {}),
  };
}

/**
 * Soma a fundamentação de todos os artefatos do run.
 *
 * Conta REFERÊNCIAS, não artefatos: um plano que cita vinte caminhos e uma ADR
 * que cita um não podem pesar igual. Artefato que não cita caminho nenhum
 * simplesmente não entra na conta — não é fundamentação zero, é ausência de
 * medida.
 */
export function measureGroundedness(
  artifacts: Record<string, { kind: string; content: unknown }>,
  workspaceDir: string,
): GroundednessEvidence {
  let references = 0;
  let grounded = 0;
  let artifactsWithReferences = 0;
  for (const artifact of Object.values(artifacts)) {
    const text = typeof artifact.content === 'string' ? artifact.content : safeJson(artifact.content);
    const report = checkGroundedness(text, workspaceDir);
    if (report.total === 0) continue;
    artifactsWithReferences++;
    references += report.total;
    grounded += report.grounded;
  }
  return {
    references,
    grounded,
    rate: references > 0 ? round(grounded / references) : null,
    artifactsWithReferences,
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return String(value);
  }
}

export interface ExecutionSummary {
  /** Casos que trouxeram evidência de execução (os demais só têm output). */
  cases: number;
  verificationRate: number | null;
  recoveryRate: number | null;
  retries: number;
  healingActions: number;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  /** Fundamentação somada. `null` quando nenhum artefato citou caminho. */
  groundedness: GroundednessEvidence | null;
}

/**
 * Agrega evidência de vários casos. Taxas são calculadas sobre os TOTAIS, não
 * como média de médias: um caso com 9 tarefas e um com 1 não podem pesar igual
 * numa taxa de verificação.
 */
export function aggregateExecution(evidence: ExecutionEvidence[]): ExecutionSummary | null {
  if (evidence.length === 0) return null;
  const totalVerified = evidence.reduce((a, e) => a + e.verifiedTasks, 0);
  const totalTasks = evidence.reduce((a, e) => a + e.totalVerifiedTasks, 0);
  const totalFailures = evidence.reduce((a, e) => a + e.failures, 0);
  const totalRecovered = evidence.reduce((a, e) => a + e.recovered, 0);
  const references = evidence.reduce((a, e) => a + (e.groundedness?.references ?? 0), 0);
  const grounded = evidence.reduce((a, e) => a + (e.groundedness?.grounded ?? 0), 0);
  return {
    cases: evidence.length,
    verificationRate: totalTasks > 0 ? round(totalVerified / totalTasks) : null,
    groundedness:
      references > 0
        ? {
            references,
            grounded,
            rate: round(grounded / references),
            artifactsWithReferences: evidence.reduce((a, e) => a + (e.groundedness?.artifactsWithReferences ?? 0), 0),
          }
        : null,
    recoveryRate: totalFailures > 0 ? round(totalRecovered / totalFailures) : null,
    retries: evidence.reduce((a, e) => a + e.retries, 0),
    healingActions: evidence.reduce((a, e) => a + e.healingActions, 0),
    tokensUsed: evidence.reduce((a, e) => a + e.tokensUsed, 0),
    costUsd: round(evidence.reduce((a, e) => a + e.costUsd, 0), 6),
    durationMs: evidence.reduce((a, e) => a + e.durationMs, 0),
  };
}

/** Linha de terminal com as métricas da Arena, ou a razão de não haver nenhuma. */
export function formatExecutionSummary(summary: ExecutionSummary | null): string {
  if (!summary) return 'sem execução real: relatório mede apenas output esperado, não verificação nem recuperação';
  const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);
  return [
    `verificação ${pct(summary.verificationRate)}`,
    // Fundamentação sem referência nenhuma sai como `n/a`, não como 0%: um run
    // que não citou caminho não errou sobre caminho nenhum.
    `fundamentação ${summary.groundedness ? `${Math.round((summary.groundedness.rate ?? 0) * 100)}% (${summary.groundedness.grounded}/${summary.groundedness.references})` : 'n/a'}`,
    `recuperação ${pct(summary.recoveryRate)}`,
    `retries ${summary.retries}`,
    `healing ${summary.healingActions}`,
    `tokens ${summary.tokensUsed}`,
    `custo $${summary.costUsd.toFixed(4)}`,
    `${summary.durationMs}ms`,
  ].join(' · ');
}

function round(value: number, places = 2): number {
  const f = Math.pow(10, places);
  return Math.round(value * f) / f;
}
