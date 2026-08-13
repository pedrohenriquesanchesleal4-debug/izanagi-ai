import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resumeCommand } from '../../cli/commands/resume.js';
import { approveCommand } from '../../cli/commands/approve.js';
import { rejectCommand } from '../../cli/commands/reject.js';
import { explainCommand } from '../../cli/commands/explain.js';
import { CheckpointStore, type CheckpointData } from '../recovery/checkpoint.js';
import { DecisionJournal } from '../memory/decisions.js';
import type { ExecutionGraph } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-cli-hitl-'));
}

async function capture(fn: () => void | Promise<void>): Promise<{ logs: string[]; errors: string[]; exitCode: number | null }> {
  const logs: string[] = [];
  const errors: string[] = [];
  let exitCode: number | null = null;
  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;
  console.log = (m?: unknown) => { logs.push(String(m)); };
  console.error = (m?: unknown) => { errors.push(String(m)); };
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`PROCESS_EXIT:${exitCode}`);
  }) as never;
  try {
    await fn();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('PROCESS_EXIT')) {
      // esperado em erros de uso
    } else {
      throw err;
    }
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }
  return { logs, errors, exitCode };
}

function simpleGraph(): ExecutionGraph {
  return {
    id: 'graph-1',
    task: 'Rodar avaliação simples',
    createdAt: new Date().toISOString(),
    nodes: [{ id: 'evaluation', kind: 'evaluator', status: 'pending', dependencies: [], outputs: ['evaluation'] }],
    order: ['evaluation'],
    parallelBatches: [['evaluation']],
    budget: { maxAttempts: 3, maxTokens: 16000, maxTimeMs: 600_000 },
  };
}

function approvalGraph(): ExecutionGraph {
  return {
    id: 'graph-2',
    task: 'Deploy em produção',
    createdAt: new Date().toISOString(),
    nodes: [
      { id: 'deploy-approval', kind: 'approval', status: 'pending', dependencies: [] },
      { id: 'evaluation', kind: 'evaluator', status: 'pending', dependencies: ['deploy-approval'], outputs: ['evaluation'] },
    ],
    order: ['deploy-approval', 'evaluation'],
    parallelBatches: [['deploy-approval'], ['evaluation']],
    budget: { maxAttempts: 3, maxTokens: 16000, maxTimeMs: 600_000 },
  };
}

function seed(baseDir: string, runId: string, graph: ExecutionGraph): void {
  const checkpoints = new CheckpointStore({ baseDir });
  const data: CheckpointData = {
    runId,
    task: graph.task,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    model: 'claude-sonnet-4-5',
    provider: 'anthropic',
    graph,
    artifacts: [],
    budgetSpent: {},
    attempts: 0,
    tokensUsed: 0,
    savedAt: new Date().toISOString(),
  };
  checkpoints.save(data);
}

test('cli resume: sem checkpoint reporta erro de uso (exit 1)', async () => {
  const baseDir = tmpDir();
  const out = await capture(() => resumeCommand(baseDir, ['nao-existe']));
  assert.equal(out.exitCode, 1);
  assert.ok(out.errors.some((e) => /nenhum checkpoint/i.test(e)));
});

test('cli resume: com checkpoint válido retoma e conclui (modo headless)', async () => {
  const baseDir = tmpDir();
  const runId = 'izanagi-cli-resume-0001';
  seed(baseDir, runId, simpleGraph());

  const out = await capture(() => resumeCommand(baseDir, [runId]));
  assert.equal(out.exitCode, null);
  const text = out.logs.join('\n');
  assert.match(text, /Resume/);
  assert.match(text, /Modo headless|Runtime result/);
});

test('cli approve: sem checkpoint reporta erro de uso (exit 1)', async () => {
  const baseDir = tmpDir();
  const out = await capture(() => approveCommand(baseDir, ['nao-existe']));
  assert.equal(out.exitCode, 1);
});

test('cli approve: aprova e retoma até concluir', async () => {
  const baseDir = tmpDir();
  const runId = 'izanagi-cli-approve-0002';
  seed(baseDir, runId, approvalGraph());

  // Primeiro pass real: o Orchestrator alcança o nó approval, cria a solicitação
  // pendente (ApprovalStore) e pausa — só depois disso "izanagi approve" tem o
  // que aprovar (mesma sequência da vida real: run pausa → depois se aprova).
  await capture(() => resumeCommand(baseDir, [runId]));

  const out = await capture(() => approveCommand(baseDir, [runId]));
  assert.equal(out.exitCode, null, out.errors.join('\n'));
  const text = out.logs.join('\n');
  assert.match(text, /Aprovado/);
  assert.match(text, /Runtime result/);
});

test('cli reject: rejeita com motivo e retoma (nó falha, run não fica travado)', async () => {
  const baseDir = tmpDir();
  const runId = 'izanagi-cli-reject-0001';
  seed(baseDir, runId, approvalGraph());
  await capture(() => resumeCommand(baseDir, [runId]));

  const out = await capture(() => rejectCommand(baseDir, [runId, '--reason', 'janela de manutenção fechada']));
  assert.equal(out.exitCode, null, out.errors.join('\n'));
  const text = out.logs.join('\n');
  assert.match(text, /Rejeitado/);
  assert.match(text, /janela de manutenção fechada/);
  assert.match(text, /Runtime result/);
});

test('cli explain: sem dados reporta erro de uso (exit 1)', async () => {
  const baseDir = tmpDir();
  const out = await capture(() => explainCommand(baseDir, ['nao-existe']));
  assert.equal(out.exitCode, 1);
});

test('cli explain: com decisões registradas mostra alternativas e razão', async () => {
  const baseDir = tmpDir();
  const runId = 'izanagi-cli-explain-0001';
  const journal = new DecisionJournal({ baseDir });
  journal.record({
    kind: 'model-routing',
    chosen: 'claude-sonnet-4-5',
    alternatives: [{ option: 'claude-sonnet-4-5', score: 0.7 }, { option: 'gpt-4o', score: 0.5 }],
    reason: 'complexidade 3/5, raciocínio medium',
    runId,
  });

  const out = await capture(() => explainCommand(baseDir, [runId]));
  assert.equal(out.exitCode, null);
  const text = out.logs.join('\n');
  assert.match(text, /model-routing/);
  assert.match(text, /claude-sonnet-4-5/);
  assert.match(text, /alternativas consideradas/);
});
