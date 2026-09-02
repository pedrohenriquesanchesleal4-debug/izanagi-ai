import { TraceStore } from '../../runtime/observability/tracer.js';
import { ExecutionBudget, type TokenTelemetry } from '../../runtime/token/execution-budget.js';

/**
 * `izanagi budget <run-id>`: para onde foi o orçamento daquele run.
 *
 * Lê a telemetria persistida no trace (Token Economy Engine): tokens por fase,
 * custo estimado, cache, paralelismo, escaladas de modelo, retries e passos de
 * degradação aplicados. Sem run-id, mostra o run mais recente.
 */
export function budgetCommand(baseDir: string, args: string[]): void {
  const asJson = args.includes('--json');
  const runId = args.find((a) => !a.startsWith('-'));
  const store = new TraceStore({ baseDir });

  const trace = runId ? store.load(runId) : store.list(1)[0];
  if (!trace) {
    console.error(`\x1b[31mErro:\x1b[0m ${runId ? `run "${runId}" não encontrado` : 'nenhum run registrado ainda'}.`);
    console.error('Rode \x1b[36mizanagi trace\x1b[0m para ver as execuções disponíveis.');
    process.exitCode = 1;
    return;
  }

  const telemetry = trace.telemetry as unknown as TokenTelemetry | undefined;

  if (asJson) {
    console.log(JSON.stringify({
      runId: trace.runId,
      mode: trace.mode ?? null,
      task: trace.task,
      durationMs: trace.durationMs,
      phases: trace.budget ?? null,
      telemetry: telemetry ?? null,
      verification: trace.verification ?? null,
    }, null, 2));
    return;
  }

  console.log(`\n\x1b[36m=== Orçamento do run ${trace.runId} ===\x1b[0m`);
  console.log(`\x1b[1mTarefa:\x1b[0m ${trace.task}`);
  console.log(`\x1b[1mModo:\x1b[0m ${trace.mode ?? '\x1b[90mlegado (sem Commander)\x1b[0m'}   \x1b[1mDuração:\x1b[0m ${trace.durationMs}ms\n`);

  if (trace.budget) {
    console.log('\x1b[1mTokens por fase:\x1b[0m');
    for (const [phase, usage] of Object.entries(trace.budget)) {
      const total = usage.spent + usage.remaining;
      const pct = total > 0 ? Math.round((usage.spent / total) * 100) : 0;
      const bar = '█'.repeat(Math.round(pct / 5)).padEnd(20, '░');
      console.log(`  ${phase.padEnd(11)} ${bar} ${usage.spent}/${total} (${pct}%)`);
    }
    console.log('');
  }

  if (!telemetry) {
    console.log('\x1b[90mSem telemetria de economia: este run foi executado antes do Token Economy Engine ou pelo caminho legado.\x1b[0m\n');
    return;
  }

  console.log('\x1b[1mToken Economy:\x1b[0m');
  console.log(`  entrada          ${telemetry.inputTokens}`);
  console.log(`  saída            ${telemetry.outputTokens}`);
  console.log(`  total            ${telemetry.totalTokens} / ${telemetry.budgetTokens} (teto)`);
  console.log(`  economizado      ${telemetry.savedTokens} \x1b[90m(respostas servidas do cache local)\x1b[0m`);
  console.log(`  custo estimado   $${telemetry.estimatedCostUsd.toFixed(6)}${telemetry.maxCostUsd !== undefined ? ` / $${telemetry.maxCostUsd.toFixed(4)} (teto)` : ''}`);
  const cacheTotal = telemetry.cacheHits + telemetry.cacheMisses;
  console.log(`  cache local      ${telemetry.cacheHits}/${cacheTotal}${cacheTotal > 0 ? ` (${Math.round((telemetry.cacheHits / cacheTotal) * 100)}%)` : ' \x1b[90m(desligado)\x1b[0m'}`);
  console.log(`  cache do provider ${telemetry.providerCachedTokens} tokens de prompt`);
  console.log(`  contexto poupado ${telemetry.contextCharsSaved} chars \x1b[90m(Context Resolver)\x1b[0m`);
  console.log(`  tarefas paralelas ${telemetry.parallelTasks}`);
  console.log(`  escaladas        ${telemetry.modelEscalations}   retries ${telemetry.retries}   tools ${telemetry.toolCalls}   agentes ${telemetry.agentsUsed}`);
  if (telemetry.degradationsApplied.length > 0) {
    console.log(`  \x1b[33mdegradação\x1b[0m       ${telemetry.degradationsApplied.join(' > ')}`);
  }
  console.log(`\n\x1b[90m${ExecutionBudget.formatTelemetry(telemetry)}\x1b[0m`);

  if (trace.verification && trace.verification.length > 0) {
    console.log('\n\x1b[1mVerificação por tarefa:\x1b[0m');
    for (const v of trace.verification) {
      const color = v.status === 'VERIFIED' ? '\x1b[32m' : v.status === 'FAILED' ? '\x1b[31m' : '\x1b[33m';
      console.log(`  ${color}${v.status.padEnd(10)}\x1b[0m ${v.nodeId.padEnd(18)} score ${v.score.toFixed(2)}  \x1b[90m${v.reason}\x1b[0m`);
    }
  }
  console.log('');
}
