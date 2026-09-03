/**
 * `izanagi reject <run-id> [node-id] [--reason="..."]` — rejeita uma ação
 * de alto risco pausada e retoma a execução via checkpoint/resume (o nó
 * rejeitado falha com o motivo informado; self-healing/abort seguem o
 * fluxo normal a partir daí — rejeição é um resultado definitivo, não uma
 * espera).
 */

import os from 'os';
import { CheckpointStore } from '../../runtime/recovery/checkpoint.js';
import { ApprovalStore, findPendingApprovalNodeId } from '../../runtime/recovery/approvals.js';
import { runRuntime, findAgentJson } from './run.js';

function parseRejectArgs(args: string[]): { positionals: string[]; reason?: string; verbose: boolean } {
  const positionals: string[] = [];
  let reason: string | undefined;
  let verbose = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--reason') {
      reason = args[i + 1];
      i++;
    } else if (a.startsWith('--reason=')) {
      reason = a.slice('--reason='.length);
    } else if (a === '--verbose' || a === '-v') {
      verbose = true;
    } else if (!a.startsWith('-')) {
      positionals.push(a);
    }
  }
  return { positionals, reason, verbose };
}

/**
 * @param baseDir  Raiz dos ASSETS do framework (agentes, skills).
 * @param stateDir Raiz do ESTADO deste projeto (`.izanagi/state`). Default:
 *                 `baseDir`. Ver `resolveStateRoot` no installer.
 */
export async function rejectCommand(baseDir: string, args: string[], stateDir = baseDir): Promise<void> {
  const { positionals, reason, verbose } = parseRejectArgs(args);
  const runId = positionals[0];
  const nodeIdArg = positionals[1];
  if (!runId) {
    console.error('\x1b[31mError:\x1b[0m informe o run-id.');
    console.error('Usage: \x1b[1mizanagi reject <run-id> [node-id] [--reason="..."]\x1b[0m');
    process.exit(1);
  }

  const checkpoints = new CheckpointStore({ baseDir: stateDir });
  const data = checkpoints.load(runId);
  if (!data) {
    console.error(`\x1b[31mError:\x1b[0m nenhum checkpoint encontrado para "${runId}" — nada pendente de aprovação.`);
    process.exit(1);
  }

  const approvals = new ApprovalStore({ baseDir: stateDir });
  const nodeId = nodeIdArg ?? findPendingApprovalNodeId(approvals, runId, data.graph);
  if (!nodeId) {
    console.error(`\x1b[31mError:\x1b[0m nenhuma aprovação pendente encontrada para o run "${runId}".`);
    process.exit(1);
  }

  const record = approvals.decide(runId, nodeId, 'rejected', { reason, decidedBy: os.userInfo().username });
  console.log(`\n\x1b[31m✖ Rejeitado:\x1b[0m nó "${nodeId}" do run ${runId} (por ${record.decidedBy})${reason ? ` — ${reason}` : ''}.\n`);

  const agent = findAgentJson(data.primaryAgent, baseDir) ?? { name: data.primaryAgent };
  await runRuntime(baseDir, {
    stateDir,
    task: data.task,
    category: data.category,
    agentId: data.primaryAgent,
    skillChain: data.skillChain,
    agent,
    verbose,
    resumeRunId: runId,
  });
}
