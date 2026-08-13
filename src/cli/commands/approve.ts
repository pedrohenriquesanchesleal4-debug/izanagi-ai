/**
 * `izanagi approve <run-id> [node-id]` — aprova uma ação de alto risco
 * pausada (nó `kind: 'approval'`) e retoma a execução via checkpoint/resume.
 * Sem node-id explícito, aprova a primeira aprovação pendente do run.
 */

import os from 'os';
import { CheckpointStore } from '../../runtime/recovery/checkpoint.js';
import { ApprovalStore, findPendingApprovalNodeId } from '../../runtime/recovery/approvals.js';
import { runRuntime, findAgentJson } from './run.js';

export async function approveCommand(baseDir: string, args: string[]): Promise<void> {
  const positionals = args.filter((a) => !a.startsWith('-'));
  const runId = positionals[0];
  const nodeIdArg = positionals[1];
  if (!runId) {
    console.error('\x1b[31mError:\x1b[0m informe o run-id.');
    console.error('Usage: \x1b[1mizanagi approve <run-id> [node-id]\x1b[0m');
    process.exit(1);
  }

  const checkpoints = new CheckpointStore({ baseDir });
  const data = checkpoints.load(runId);
  if (!data) {
    console.error(`\x1b[31mError:\x1b[0m nenhum checkpoint encontrado para "${runId}" — nada pendente de aprovação.`);
    process.exit(1);
  }

  const approvals = new ApprovalStore({ baseDir });
  const nodeId = nodeIdArg ?? findPendingApprovalNodeId(approvals, runId, data.graph);
  if (!nodeId) {
    console.error(`\x1b[31mError:\x1b[0m nenhuma aprovação pendente encontrada para o run "${runId}".`);
    process.exit(1);
  }

  const record = approvals.decide(runId, nodeId, 'approved', { decidedBy: os.userInfo().username });
  console.log(`\n\x1b[32m✔ Aprovado:\x1b[0m nó "${nodeId}" do run ${runId} (por ${record.decidedBy}).\n`);

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
