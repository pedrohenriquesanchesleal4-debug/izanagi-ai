/**
 * `izanagi resume <run-id>` — retoma uma execução interrompida (crash) ou
 * pausada (aguardando aprovação humana) a partir do checkpoint salvo,
 * sem replanejar nem reexecutar nós já concluídos.
 */

import { CheckpointStore, checkpointProgress } from '../../runtime/recovery/checkpoint.js';
import { runRuntime, findAgentJson } from './run.js';

export async function resumeCommand(baseDir: string, args: string[]): Promise<void> {
  const runId = args[0];
  if (!runId) {
    console.error('\x1b[31mError:\x1b[0m informe o run-id.');
    console.error('Usage: \x1b[1mizanagi resume <run-id>\x1b[0m');
    process.exit(1);
  }

  const checkpoints = new CheckpointStore({ baseDir });
  const data = checkpoints.load(runId);
  if (!data) {
    console.error(`\x1b[31mError:\x1b[0m nenhum checkpoint encontrado para "${runId}" — nada a retomar (execução já concluída ou run-id inválido).`);
    console.error(`Verifique com \x1b[36mizanagi trace ${runId}\x1b[0m se o run já produziu um veredito final.`);
    process.exit(1);
  }

  const progress = checkpointProgress(data);
  console.log(`\n\x1b[36m=== Izanagi AI — Resume ===\x1b[0m\n`);
  console.log(`  \x1b[90mRun:\x1b[0m ${runId}`);
  console.log(`  \x1b[90mTask:\x1b[0m ${data.task}`);
  console.log(`  \x1b[32m✔\x1b[0m ${progress.done}/${progress.total} nós concluídos — retomando: ${progress.pendingNodeIds.join(', ') || 'nenhum (finalizando)'}\n`);

  const agent = findAgentJson(data.primaryAgent, baseDir) ?? { name: data.primaryAgent };
  await runRuntime(baseDir, {
    task: data.task,
    category: data.category,
    agentId: data.primaryAgent,
    skillChain: data.skillChain,
    agent,
    verbose: args.includes('--verbose') || args.includes('-v'),
    resumeRunId: runId,
  });
}
