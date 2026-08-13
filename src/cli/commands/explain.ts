/**
 * `izanagi explain <run-id>` — por que o Izanagi decidiu o que decidiu.
 *
 * Junta Decision Journal (alternativas consideradas + razão + confiança),
 * Trace (self-healing + avaliação final) e Approval Store (pendências) para
 * responder: por que este agente/skill/modelo foi escolhido, por que houve
 * retry/healing, e por que a avaliação teve tal veredito. Expõe só metadados
 * e razões estruturadas já computadas pelo runtime — nunca chain-of-thought.
 */

import { TraceStore } from '../../runtime/observability/tracer.js';
import { DecisionJournal } from '../../runtime/memory/decisions.js';
import { ApprovalStore } from '../../runtime/recovery/approvals.js';

export function explainCommand(baseDir: string, args: string[]): void {
  const runId = args[0];
  if (!runId) {
    console.error('\x1b[31mError:\x1b[0m informe o run-id.');
    console.error('Usage: \x1b[1mizanagi explain <run-id>\x1b[0m');
    process.exit(1);
  }

  const trace = new TraceStore({ baseDir }).load(runId);
  const decisions = new DecisionJournal({ baseDir }).forRun(runId);
  const approvals = new ApprovalStore({ baseDir }).pendingFor(runId);

  if (!trace && decisions.length === 0) {
    console.error(`\x1b[31mError:\x1b[0m nada encontrado para o run "${runId}" (nem trace, nem decisões).`);
    process.exit(1);
  }

  console.log(`\n\x1b[35m=== Izanagi AI — Explain: ${runId} ===\x1b[0m\n`);

  if (trace) {
    console.log(`  \x1b[1mTask:\x1b[0m ${trace.task}`);
    if (trace.evaluation) {
      const e = trace.evaluation;
      console.log(`  \x1b[1mVeredito final:\x1b[0m ${e.verdict} (score ${e.score.toFixed(2)}, confiança ${e.confidence})`);
      if (Object.keys(e.metrics).length > 0) {
        console.log(`    \x1b[90mmétricas:\x1b[0m ${Object.entries(e.metrics).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
      if (e.regressions.length > 0) console.log(`    \x1b[31mregressões:\x1b[0m ${e.regressions.join('; ')}`);
      if (e.recommendations.length > 0) console.log(`    \x1b[90mrecomendações:\x1b[0m ${e.recommendations.join('; ')}`);
    } else if (!approvals.length) {
      console.log(`  \x1b[90mSem veredito final registrado neste trace (run ainda em progresso ou pausado).\x1b[0m`);
    }
  }

  if (decisions.length > 0) {
    console.log(`\n  \x1b[1mDecisões (${decisions.length}):\x1b[0m`);
    for (const d of decisions) {
      console.log(`  \x1b[36m[${d.kind}]\x1b[0m escolheu "\x1b[1m${d.chosen}\x1b[0m" (confiança ${d.confidence.toFixed(2)})`);
      console.log(`    \x1b[90mrazão:\x1b[0m ${d.reason || '—'}`);
      if (d.alternatives.length > 1) {
        const alts = d.alternatives
          .slice()
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map((a) => `${a.option}${a.score !== undefined ? ` (${a.score})` : ''}`)
          .join(', ');
        console.log(`    \x1b[90malternativas consideradas:\x1b[0m ${alts}`);
      }
    }
  }

  if (trace?.healing && trace.healing.length > 0) {
    console.log(`\n  \x1b[1mSelf-healing (${trace.healing.length}) — por que houve retry/recuperação:\x1b[0m`);
    for (const h of trace.healing) {
      console.log(`    • [\x1b[33m${h.kind}\x1b[0m] nó "${h.nodeId}": ${h.message}`);
    }
  }

  if (approvals.length > 0) {
    console.log(`\n  \x1b[1m\x1b[33m⏸ Aprovação pendente:\x1b[0m`);
    for (const a of approvals) {
      console.log(`    Nó "${a.nodeId}"${a.context ? ` — ${a.context}` : ''} (solicitado em ${a.requestedAt})`);
    }
    console.log(`    \x1b[36mizanagi approve ${runId}\x1b[90m ou \x1b[36mizanagi reject ${runId} --reason="..."\x1b[0m`);
  }

  if (decisions.length === 0 && (!trace?.healing || trace.healing.length === 0) && approvals.length === 0) {
    console.log(`\n  \x1b[90mNenhuma decisão de roteamento, healing ou aprovação registrada para este run — provavelmente uma execução simples e direta.\x1b[0m`);
  }

  console.log('');
}
