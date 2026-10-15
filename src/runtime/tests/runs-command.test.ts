import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runsCommand } from '../../cli/commands/runs.js';
import { securityCommand } from '../../cli/commands/security.js';
import { CheckpointStore, type CheckpointData } from '../recovery/checkpoint.js';
import { TraceStore } from '../observability/tracer.js';
import type { RunTrace } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-runs-test-'));
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
      // esperado
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

test('runsCommand: lista execuções ativas e histórico, inspeciona e cancela', async () => {
  const dir = tmpDir();
  try {
    const cpStore = new CheckpointStore({ baseDir: dir });
    const traceStore = new TraceStore({ baseDir: dir });

    const runId = 'izanagi-test-run-1';

    // Salva um checkpoint simulando um run pausado / ativo
    const mockCheckpoint: CheckpointData = {
      runId,
      task: 'Criar componente de checkout com Playwright tests',
      category: 'coding',
      primaryAgent: 'senior-engineer',
      skillChain: ['tdd', 'browser-playwright'],
      model: 'test-model',
      provider: 'test-provider',
      graph: {
        id: 'graph-1',
        task: 'Criar componente de checkout com Playwright tests',
        createdAt: new Date().toISOString(),
        nodes: [
          { id: 'node-1', kind: 'tool', status: 'succeeded' },
          { id: 'node-2', kind: 'validator', status: 'pending' },
        ],
        order: ['node-1', 'node-2'],
        parallelBatches: [['node-1'], ['node-2']],
        budget: {
          maxAttempts: 2,
          maxTokens: 5000,
          maxTimeMs: 10000,
        },
      },
      artifacts: [],
      budgetSpent: {},
      attempts: 1,
      tokensUsed: 120,
      savedAt: new Date().toISOString(),
    };
    cpStore.save(mockCheckpoint);

    // Salva um trace inicial
    const mockTrace: RunTrace = {
      runId,
      task: mockCheckpoint.task,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: 1200,
      command: 'run',
      retries: 0,
      failures: 0,
      agents: ['senior-engineer'],
      skills: ['tdd'],
      tools: ['fs.write'],
      artifacts: [],
      spans: [],
    };
    traceStore.save(mockTrace);

    // 1. Listagem
    const listRes = await capture(() => runsCommand(dir, ['list'], dir));
    const listOut = listRes.logs.join('\n');
    assert.match(listOut, /Execuções Ativas \/ Pausadas/);
    assert.match(listOut, /izanagi-test-run-1/);
    assert.match(listOut, /1\/2 nós concluídos/);

    // 2. Inspeção
    const inspectRes = await capture(() => runsCommand(dir, ['inspect', runId], dir));
    const inspectOut = inspectRes.logs.join('\n');
    assert.match(inspectOut, /Checkpoint Ativo: izanagi-test-run-1/);
    assert.match(inspectOut, /node-2/);

    // 3. Cancelamento
    const cancelRes = await capture(() => runsCommand(dir, ['cancel', runId], dir));
    const cancelOut = cancelRes.logs.join('\n');
    assert.match(cancelOut, /Checkpoint da execução .* removido/);
    assert.match(cancelOut, /cancelada com sucesso/);

    // Verifica que checkpoint foi deletado
    assert.equal(cpStore.load(runId), null);

    // Verifica que trace foi marcado como BLOCKED
    const updatedTrace = traceStore.load(runId);
    assert.ok(updatedTrace);
    assert.equal(updatedTrace.evaluation?.verdict, 'BLOCKED');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('securityCommand: executa scan estático de segurança e formata resultados', async () => {
  const dir = tmpDir();
  try {
    const res = await capture(() => securityCommand(dir, ['scan']));
    const out = res.logs.join('\n');
    assert.match(out, /Security Scan/);
    assert.match(out, /Resultado:/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
