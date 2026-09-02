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
import { ArtifactRegistry } from '../../runtime/artifacts/registry.js';

/** Linhas de conteúdo mostradas por artefato com `--artifacts`. */
const ARTIFACT_PREVIEW_LINES = 30;

export function explainCommand(baseDir: string, args: string[]): void {
  const runId = args.find((a) => !a.startsWith('-'));
  const showArtifacts = args.includes('--artifacts') || args.includes('-a');
  const showConversation = args.includes('--conversation') || args.includes('-c');
  if (!runId) {
    console.error('\x1b[31mError:\x1b[0m informe o run-id.');
    console.error('Usage: \x1b[1mizanagi explain <run-id>\x1b[0m');
    process.exit(1);
  }

  const trace = new TraceStore({ baseDir }).load(runId);
  const artifacts = new ArtifactRegistry({ baseDir }).forRun(runId);
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

  // Protocolo agente-a-agente: quem pediu o quê a quem, e sobre qual artefato.
  // Resumido por padrão porque o log completo de um grafo grande é ruído; o
  // detalhe fica atrás de --conversation.
  const conversation = trace?.conversation ?? [];
  if (conversation.length > 0) {
    const byType = conversation.reduce<Record<string, number>>((acc, m) => {
      acc[m.type] = (acc[m.type] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`
  \x1b[1mConversa entre agentes (${conversation.length} mensagens):\x1b[0m \x1b[90m${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}\x1b[0m`);
    const shown = showConversation ? conversation : conversation.filter((m) => m.type === 'critique' || m.type === 'correction');
    for (const m of shown) {
      const refs = (m.artifactRefs ?? []).map((r) => r.split(':')[1] ?? r).join(', ');
      console.log(`    \x1b[36m${m.from}\x1b[0m -> \x1b[36m${m.to}\x1b[0m [\x1b[33m${m.type}\x1b[0m] ${m.summary}`);
      if (refs) console.log(`        \x1b[90martefatos: ${refs}\x1b[0m`);
    }
    if (!showConversation && shown.length < conversation.length) {
      console.log(`    \x1b[90mVer a conversa inteira:\x1b[0m \x1b[36mizanagi explain ${runId} --conversation\x1b[0m`);
    }
  }

  if (artifacts.length > 0) {
    const registry = new ArtifactRegistry({ baseDir });
    console.log(`\n  \x1b[1mArtefatos produzidos (${artifacts.length}):\x1b[0m`);
    for (const a of artifacts) {
      const status = a.valid ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m';
      const who = [a.producer.agent, a.producer.skill].filter(Boolean).join('/') || a.producer.nodeId;
      const version = a.version > 1 ? ` \x1b[90mv${a.version}\x1b[0m` : '';
      const stored = a.contentRef ? '' : ' \x1b[90m(conteúdo não persistido)\x1b[0m';
      console.log(`    ${status} \x1b[1m${a.name}\x1b[0m${version} \x1b[90m${a.kind}, ${a.size} bytes, por ${who}\x1b[0m${stored}`);
      if (a.dependencies.length > 0) {
        console.log(`        \x1b[90mconsumiu:\x1b[0m ${a.dependencies.map((d) => d.split(':')[1] ?? d).join(', ')}`);
      }
      if (showArtifacts) {
        const content = registry.readContent(a.id, a.version);
        if (content === null) {
          console.log(`        \x1b[90m(sem conteúdo em disco para esta versão)\x1b[0m`);
          continue;
        }
        const lines = content.split('\n');
        const preview = lines.slice(0, ARTIFACT_PREVIEW_LINES);
        console.log(preview.map((l) => `        \x1b[90m│\x1b[0m ${l}`).join('\n'));
        if (lines.length > preview.length) {
          console.log(`        \x1b[90m│ ... +${lines.length - preview.length} linha(s)${a.truncated ? ` (artefato truncado no store: ${a.originalSize} bytes originais)` : ''}\x1b[0m`);
        }
      }
    }
    if (!showArtifacts) {
      console.log(`    \x1b[90mVer o conteúdo:\x1b[0m \x1b[36mizanagi explain ${runId} --artifacts\x1b[0m`);
    }
  }

  if (artifacts.length === 0 && decisions.length === 0 && conversation.length === 0 && (!trace?.healing || trace.healing.length === 0) && approvals.length === 0) {
    console.log(`\n  \x1b[90mNenhuma decisão de roteamento, healing ou aprovação registrada para este run — provavelmente uma execução simples e direta.\x1b[0m`);
  }

  console.log('');
}
