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
}

/**
 * Converte o resultado de um run em evidência comparável.
 *
 * `recovered` conta o nó que FALHOU em algum momento e terminou `succeeded`:
 * é a definição operacional de "o runtime se curou". Contar ações de healing
 * como sucesso seria contar a tentativa, não o conserto.
 */
export function evidenceFromRun(result: RunLikeResult): ExecutionEvidence {
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
  };
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
  return {
    cases: evidence.length,
    verificationRate: totalTasks > 0 ? round(totalVerified / totalTasks) : null,
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
