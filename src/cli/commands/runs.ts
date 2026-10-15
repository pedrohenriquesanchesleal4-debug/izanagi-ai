/**
 * `izanagi runs <list|inspect|cancel|resume>` — gerenciamento e ciclo de vida de execuções.
 */

import fs from 'fs';
import path from 'path';
import { TraceStore } from '../../runtime/observability/tracer.js';
import { CheckpointStore, checkpointProgress } from '../../runtime/recovery/checkpoint.js';
import { printTrace } from './trace.js';
import { resumeCommand } from './resume.js';
import type { RunTrace } from '../../runtime/types.js';

export async function runsCommand(baseDir: string, args: string[], stateDir = baseDir): Promise<void> {
  const sub = (args[0] || 'list').toLowerCase();
  const rest = args.slice(1);

  switch (sub) {
    case 'list':
    case 'ls':
      listRuns(stateDir);
      break;

    case 'inspect':
    case 'show': {
      const runId = rest[0];
      if (!runId) {
        console.error('\x1b[31mError:\x1b[0m informe o run-id.');
        console.error('Usage: \x1b[1mizanagi runs inspect <run-id>\x1b[0m');
        process.exit(1);
      }
      inspectRun(stateDir, runId);
      break;
    }

    case 'cancel':
    case 'abort': {
      const runId = rest[0];
      if (!runId) {
        console.error('\x1b[31mError:\x1b[0m informe o run-id.');
        console.error('Usage: \x1b[1mizanagi runs cancel <run-id>\x1b[0m');
        process.exit(1);
      }
      cancelRun(stateDir, runId);
      break;
    }

    case 'resume': {
      const runId = rest[0];
      if (!runId) {
        console.error('\x1b[31mError:\x1b[0m informe o run-id.');
        console.error('Usage: \x1b[1mizanagi runs resume <run-id>\x1b[0m');
        process.exit(1);
      }
      await resumeCommand(baseDir, rest, stateDir);
      break;
    }

    default:
      // Se o primeiro argumento parece um runId (ex: izanagi runs izanagi-2026...), inspeciona
      if (sub.startsWith('izanagi-')) {
        inspectRun(stateDir, sub);
        break;
      }
      console.error(`\x1b[31mSubcomando desconhecido:\x1b[0m ${sub}`);
      console.log('Uso: \x1b[1mizanagi runs [list | inspect <id> | cancel <id> | resume <id>]\x1b[0m');
      process.exit(1);
  }
}

function listRuns(stateDir: string): void {
  const checkpointStore = new CheckpointStore({ baseDir: stateDir });
  const traceStore = new TraceStore({ baseDir: stateDir });

  const activeCheckpoints = checkpointStore.list();
  const traces = traceStore.list(25);

  console.log(`\n\x1b[35m=== Izanagi AI — Execuções & Ciclo de Vida ===\x1b[0m\n`);

  if (activeCheckpoints.length > 0) {
    console.log(`\x1b[1m\x1b[33m● Execuções Ativas / Pausadas (${activeCheckpoints.length}):\x1b[0m`);
    for (const cp of activeCheckpoints) {
      const prog = checkpointProgress(cp);
      console.log(`  \x1b[36m${cp.runId}\x1b[0m \x1b[33m[RESUMABLE]\x1b[0m`);
      console.log(`    \x1b[90mTask:\x1b[0m ${cp.task.slice(0, 80)}`);
      console.log(`    \x1b[90mProgresso:\x1b[0m ${prog.done}/${prog.total} nós concluídos | Pendentes: ${prog.pendingNodeIds.join(', ') || 'nenhum'}`);
      console.log(`    \x1b[90mSalvo em:\x1b[0m ${cp.savedAt}\n`);
    }
  }

  console.log(`\x1b[1mHistórico de Execuções (${traces.length}):\x1b[0m`);
  if (traces.length === 0) {
    console.log('  Nenhuma execução registrada ainda.');
  } else {
    for (const t of traces) {
      const verdict: string = t.evaluation?.verdict ?? '—';
      const color =
        verdict === 'PASS'
          ? '\x1b[32m'
          : verdict === 'FAIL' || verdict === 'BLOCKED' || verdict === 'CANCELLED'
          ? '\x1b[31m'
          : verdict === 'PASS_WITH_WARNINGS' || verdict === 'HUMAN_REQUIRED'
          ? '\x1b[33m'
          : '\x1b[90m';
      console.log(`  \x1b[36m${t.runId}\x1b[0m  ${color}[${verdict}]\x1b[0m  ${t.task.slice(0, 70)}`);
      console.log(`    \x1b[90mAgentes:\x1b[0m ${t.agents.join(', ') || '—'} | \x1b[90mDuração:\x1b[0m ${t.durationMs}ms | \x1b[90mTokens:\x1b[0m ${t.tokens?.total ?? 0} | \x1b[90mIniciado:\x1b[0m ${t.startedAt}`);
    }
  }

  console.log('\nComandos úteis:');
  console.log('  \x1b[33mizanagi runs inspect <run-id>\x1b[0m  — Detalhes completos');
  console.log('  \x1b[33mizanagi runs resume <run-id>\x1b[0m   — Retoma execução pausada');
  console.log('  \x1b[33mizanagi runs cancel <run-id>\x1b[0m   — Cancela execução pendente\n');
}

function inspectRun(stateDir: string, runId: string): void {
  const checkpointStore = new CheckpointStore({ baseDir: stateDir });
  const traceStore = new TraceStore({ baseDir: stateDir });

  const cp = checkpointStore.load(runId);
  const trace = traceStore.load(runId);

  if (!cp && !trace) {
    console.error(`\x1b[31mError:\x1b[0m Execução "${runId}" não encontrada.`);
    process.exit(1);
  }

  if (cp) {
    const prog = checkpointProgress(cp);
    console.log(`\n\x1b[35m=== Checkpoint Ativo: ${runId} ===\x1b[0m\n`);
    console.log(`  \x1b[1mTask:\x1b[0m ${cp.task}`);
    console.log(`  \x1b[90mAgente Primário:\x1b[0m ${cp.primaryAgent}`);
    console.log(`  \x1b[90mCategoria:\x1b[0m ${cp.category}`);
    console.log(`  \x1b[90mProgresso:\x1b[0m ${prog.done}/${prog.total} nós`);
    console.log(`  \x1b[90mNós pendentes:\x1b[0m ${prog.pendingNodeIds.join(', ') || 'nenhum'}`);
    console.log(`  \x1b[90mSalvo em:\x1b[0m ${cp.savedAt}`);
    console.log(`\n  \x1b[33mDica:\x1b[0m Retome com \x1b[1mizanagi runs resume ${runId}\x1b[0m ou cancele com \x1b[1mizanagi runs cancel ${runId}\x1b[0m`);
  }

  if (trace) {
    printTrace(trace);
  }
}

function cancelRun(stateDir: string, runId: string): void {
  const checkpointStore = new CheckpointStore({ baseDir: stateDir });
  const traceStore = new TraceStore({ baseDir: stateDir });

  const cp = checkpointStore.load(runId);
  const trace = traceStore.load(runId);

  if (!cp && !trace) {
    console.error(`\x1b[31mError:\x1b[0m Nenhuma execução encontrada para "${runId}".`);
    process.exit(1);
  }

  let cancelledAny = false;

  if (cp) {
    checkpointStore.delete(runId);
    console.log(`\x1b[32m✔\x1b[0m Checkpoint da execução \x1b[36m${runId}\x1b[0m removido.`);
    cancelledAny = true;
  }

  if (trace) {
    if (trace.evaluation?.verdict !== 'PASS' && trace.evaluation?.verdict !== 'FAIL') {
      trace.evaluation = {
        taskId: trace.runId,
        task: trace.task,
        createdAt: new Date().toISOString(),
        verdict: 'BLOCKED',
        score: 0,
        confidence: 1,
        metrics: trace.evaluation?.metrics ?? {},
        regressions: ['Cancelado explicitamente pelo usuário via CLI (runs cancel)'],
        recommendations: ['Execução abortada pelo usuário'],
      };
      traceStore.save(trace);
      console.log(`\x1b[32m✔\x1b[0m Trace da execução \x1b[36m${runId}\x1b[0m atualizado para status BLOCKED.`);
      cancelledAny = true;
    } else {
      console.log(`\x1b[90mℹ\x1b[0m Trace \x1b[36m${runId}\x1b[0m já possui veredito final (${trace.evaluation.verdict}).`);
    }
  }

  if (cancelledAny) {
    console.log(`\x1b[32m✔\x1b[0m Execução \x1b[36m${runId}\x1b[0m cancelada com sucesso.\n`);
  }
}
