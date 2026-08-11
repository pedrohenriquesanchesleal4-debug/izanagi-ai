/**
 * `izanagi trace [run-id]` — observabilidade das execuções.
 */

import path from 'path';
import { TraceStore } from '../../runtime/observability/tracer.js';
import type { RunTrace } from '../../runtime/types.js';

export function traceCommand(baseDir: string, args: string[]): void {
  const store = new TraceStore({ baseDir });
  const runId = args[0];

  if (!runId) {
    traceList(baseDir, store);
    return;
  }
  traceShow(baseDir, store, runId);
}

function traceList(baseDir: string, store: TraceStore): void {
  const traces = store.list(20);
  console.log(`\n\x1b[35m=== Izanagi AI Traces (${traces.length}) ===\x1b[0m\n`);
  if (traces.length === 0) {
    console.log('  Nenhum trace ainda. Rode \x1b[33mizanagi run "tarefa"\x1b[0m para gerar o primeiro.\n');
    return;
  }
  for (const t of traces) {
    const verdict = t.evaluation?.verdict ?? '—';
    const color = verdict === 'PASS' ? '\x1b[32m' : verdict === 'FAIL' || verdict === 'BLOCKED' ? '\x1b[31m' : verdict === 'PASS_WITH_WARNINGS' ? '\x1b[33m' : '\x1b[90m';
    console.log(`\x1b[1m\x1b[36m${t.runId}\x1b[0m`);
    console.log(`  \x1b[90mTask:\x1b[0m ${t.task.slice(0, 90)}`);
    console.log(`  \x1b[90mStatus:\x1b[0m ${color}${verdict}\x1b[0m score ${t.evaluation?.score ?? '—'} | agents [${t.agents.join(', ')}] | ${t.durationMs}ms | tokens ${t.tokens?.total ?? 0}`);
    console.log(`  \x1b[90mSpans:\x1b[0m ${t.spans.length} | retries ${t.retries} | falhas ${t.failures} | ${t.startedAt}\n`);
  }
  console.log('Detalhes: \x1b[33mizanagi trace <run-id>\x1b[0m\n');
}

function traceShow(baseDir: string, store: TraceStore, runId: string): void {
  const trace = store.load(runId);
  if (!trace) {
    console.error(`\x1b[31mTrace "${runId}" não encontrado.\x1b[0m`);
    console.error('Liste com \x1b[33mizanagi trace\x1b[0m\n');
    process.exit(1);
  }
  printTrace(trace);
}

export function printTrace(t: RunTrace): void {
  console.log(`\n\x1b[35m=== Trace: ${t.runId} ===\x1b[0m\n`);
  console.log(`  \x1b[1mTask:\x1b[0m ${t.task}`);
  console.log(`  \x1b[90mComando:\x1b[0m ${t.command} | iniciado ${t.startedAt} | ${t.durationMs}ms`);
  console.log(`  \x1b[90mModelo:\x1b[0m ${t.model ?? '—'} | tokens: ${t.tokens?.input ?? 0} in / ${t.tokens?.output ?? 0} out`);
  console.log(`  \x1b[90mAgentes:\x1b[0m ${t.agents.join(', ') || '—'}`);
  console.log(`  \x1b[90mSkills:\x1b[0m ${t.skills.join(', ') || '—'}`);
  console.log(`  \x1b[90mTools:\x1b[0m ${t.tools.join(', ') || '—'}`);

  if (t.evaluation) {
    const e = t.evaluation;
    console.log(`\n  \x1b[1mEvaluation:\x1b[0m ${verdictColor(e.verdict)}${e.verdict}\x1b[0m | score ${e.score} | confiança ${e.confidence}`);
    if (Object.keys(e.metrics).length > 0) {
      console.log(`  \x1b[90mMétricas:\x1b[0m ${Object.entries(e.metrics).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    if (e.regressions.length > 0) console.log(`  \x1b[31mRegressões:\x1b[0m ${e.regressions.join(', ')}`);
  }

  if (t.healing && t.healing.length > 0) {
    console.log(`\n  \x1b[1mSelf-healing (${t.healing.length}):\x1b[0m`);
    for (const h of t.healing) {
      console.log(`    • [${h.kind}] ${h.message}`);
    }
  }

  if (t.spans.length > 0) {
    console.log(`\n  \x1b[1mSpans (${t.spans.length}):\x1b[0m`);
    for (const s of t.spans) {
      const color = s.status === 'ok' ? '\x1b[32m' : '\x1b[31m';
      console.log(`    ${color}${s.status === 'ok' ? '✔' : '✖'}\x1b[0m ${s.type.padEnd(12)} ${s.name.padEnd(42)} ${String(s.durationMs).padStart(6)}ms${s.error ? ` — \x1b[31m${s.error.slice(0, 80)}\x1b[0m` : ''}`);
    }
  }

  if (t.graph) {
    console.log(`\n  \x1b[1mExecution Graph (${t.graph.nodes.length} nós):\x1b[0m`);
    for (const n of t.graph.nodes) {
      const status = n.status === 'succeeded' ? '\x1b[32m✔' : n.status === 'failed' ? '\x1b[31m✖' : n.status === 'skipped' ? '\x1b[90m–' : '\x1b[33m○';
      console.log(`    ${status}\x1b[0m ${n.id} (${n.kind})${n.error ? ` — \x1b[31m${n.error.slice(0, 70)}\x1b[0m` : ''}`);
    }
    console.log(`\n  \x1b[90mParalelismo detectado:\x1b[0m ${t.graph.parallelBatches.map((b) => `[${b.join(', ')}]`).join(' → ')}`);
  }
  console.log('');
}

function verdictColor(v: string): string {
  switch (v) {
    case 'PASS':
      return '\x1b[32m';
    case 'PASS_WITH_WARNINGS':
      return '\x1b[33m';
    case 'FAIL':
    case 'BLOCKED':
      return '\x1b[31m';
    default:
      return '\x1b[90m';
  }
}
