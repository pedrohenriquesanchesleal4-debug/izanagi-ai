import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CheckpointStore, checkpointProgress, type CheckpointData } from '../recovery/checkpoint.js';
import { Orchestrator } from '../orchestrator.js';
import type { ExecuteCtx } from '../orchestrator.js';
import type { ExecutionGraph, GraphNode } from '../types.js';
import { MemoryStore } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-checkpoint-'));
}

const LONG_TEXT = 'Aqui temos um artefato completo e extenso para validação. '.repeat(20);

function validContentFor(kind: string | undefined): string {
  const req: Record<string, string> = {
    implementation: '',
    'qa-report': 'summary results',
    evaluation: 'verdict score metrics',
  };
  return LONG_TEXT + ((kind && req[kind]) ?? '');
}

function baseCheckpoint(overrides: Partial<CheckpointData> = {}): CheckpointData {
  const graph: ExecutionGraph = {
    id: 'graph-1',
    task: 't',
    createdAt: new Date().toISOString(),
    nodes: [
      { id: 'execute', kind: 'agent', status: 'pending', dependencies: [] },
      { id: 'verify', kind: 'agent', status: 'pending', dependencies: ['execute'] },
    ],
    order: ['execute', 'verify'],
    parallelBatches: [['execute'], ['verify']],
    budget: { maxAttempts: 3, maxTokens: 16000, maxTimeMs: 600_000 },
  };
  return {
    runId: 'izanagi-test-0001',
    task: 'tarefa de teste',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    model: 'claude-sonnet-4-5',
    provider: 'anthropic',
    graph,
    artifacts: [],
    budgetSpent: {},
    attempts: 1,
    tokensUsed: 500,
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('checkpoint: save/load/delete roundtrip', () => {
  const store = new CheckpointStore({ baseDir: tmpDir() });
  const data = baseCheckpoint();
  store.save(data);

  const loaded = store.load(data.runId);
  assert.ok(loaded);
  assert.equal(loaded?.runId, data.runId);
  assert.equal(loaded?.attempts, 1);

  store.delete(data.runId);
  assert.equal(store.load(data.runId), null);
});

test('checkpoint: load de runId inexistente retorna null', () => {
  const store = new CheckpointStore({ baseDir: tmpDir() });
  assert.equal(store.load('nao-existe'), null);
});

test('checkpoint: list ordena por savedAt desc e ignora arquivo corrompido', () => {
  const dir = tmpDir();
  const store = new CheckpointStore({ baseDir: dir });
  store.save(baseCheckpoint({ runId: 'a', savedAt: '2026-01-01T00:00:00.000Z' }));
  store.save(baseCheckpoint({ runId: 'b', savedAt: '2026-01-02T00:00:00.000Z' }));
  fs.writeFileSync(path.join(store.directory, 'corrompido.json'), '{ not json');

  const list = store.list();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((c) => c.runId), ['b', 'a']);
});

test('checkpoint: checkpointProgress conta nós concluídos vs pendentes', () => {
  const data = baseCheckpoint();
  data.graph.nodes[0].status = 'succeeded';
  const progress = checkpointProgress(data);
  assert.equal(progress.done, 1);
  assert.equal(progress.total, 2);
  assert.deepEqual(progress.pendingNodeIds, ['verify']);
});

test('orchestrator: run completo (PASS) não deixa checkpoint pendente', async () => {
  const baseDir = tmpDir();
  const checkpoints = new CheckpointStore({ baseDir });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Criar uma feature de login',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setCheckpointStore(checkpoints);

  const result = await orchestrator.run();
  assert.equal(result.status, 'PASS');
  assert.equal(checkpoints.load(result.trace.runId), null, 'checkpoint deve ser limpo ao completar');
});

test('orchestrator: run que aborta (FAIL) também limpa o checkpoint — não é "interrompido", é terminal', async () => {
  const baseDir = tmpDir();
  const checkpoints = new CheckpointStore({ baseDir });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Implementar módulo Y',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    produce: async () => {
      throw new Error('falha fatal irrecuperável');
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setCheckpointStore(checkpoints);

  const result = await orchestrator.run();
  assert.ok(['FAIL', 'BLOCKED'].includes(result.status));
  assert.equal(checkpoints.load(result.trace.runId), null, 'veredito terminal — nada a resumir');
});

test('orchestrator: checkpoint é escrito incrementalmente antes da conclusão (sobrevive a uma interrupção)', async () => {
  const baseDir = tmpDir();
  const checkpoints = new CheckpointStore({ baseDir });
  let runIdSeen: string | undefined;
  let sawCheckpointBeforeSecondAttempt = false;
  let calls = 0;

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Debug de erro 500',
    category: 'debugging',
    primaryAgent: 'bug-hunter',
    skillChain: ['systematic-debugging'],
    produce: async (node: GraphNode, ctx: ExecuteCtx) => {
      runIdSeen = ctx.runId;
      if (node.id === 'reproduce' && calls++ === 0) {
        throw new Error('request timed out');
      }
      // Na 2ª tentativa, o checkpoint da 1ª rodada de batches já deve existir em disco.
      if (runIdSeen && checkpoints.load(runIdSeen)) sawCheckpointBeforeSecondAttempt = true;
      return { content: validContentFor(node.outputs?.[0]) || LONG_TEXT, kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setCheckpointStore(checkpoints);

  const result = await orchestrator.run();
  assert.equal(result.status, 'PASS');
  assert.ok(sawCheckpointBeforeSecondAttempt, 'checkpoint deveria existir em disco antes da 2ª tentativa');
  assert.equal(checkpoints.load(result.trace.runId), null, 'limpo ao final');
});

test('orchestrator: resumeRunId retoma sem reexecutar nós já concluídos', async () => {
  const baseDir = tmpDir();
  const checkpoints = new CheckpointStore({ baseDir });

  // Simula uma execução interrompida: "execute" já concluído com artefato válido,
  // "verify" e "evaluation" ainda pendentes.
  const graph: ExecutionGraph = {
    id: 'graph-resume',
    task: 'Criar uma feature de login',
    createdAt: new Date().toISOString(),
    nodes: [
      { id: 'execute', kind: 'agent', status: 'succeeded', dependencies: [], agent: 'senior-engineer', outputs: ['implementation'] },
      { id: 'verify', kind: 'agent', status: 'pending', dependencies: ['execute'], agent: 'qa', outputs: ['qa-report'] },
      { id: 'evaluation', kind: 'evaluator', status: 'pending', dependencies: ['verify'], outputs: ['evaluation'] },
    ],
    order: ['execute', 'verify', 'evaluation'],
    parallelBatches: [['execute'], ['verify'], ['evaluation']],
    budget: { maxAttempts: 3, maxTokens: 16000, maxTimeMs: 600_000 },
  };
  const runId = 'izanagi-resume-test-0001';
  checkpoints.save({
    runId,
    task: graph.task,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    model: 'claude-sonnet-4-5',
    provider: 'anthropic',
    graph,
    artifacts: [{ nodeId: 'execute', kind: 'implementation', content: validContentFor('implementation'), valid: true, score: 1 }],
    budgetSpent: { execution: 400 },
    attempts: 1,
    tokensUsed: 400,
    savedAt: new Date().toISOString(),
  });

  const calledNodes: string[] = [];
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: graph.task,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    resumeRunId: runId,
    produce: (node: GraphNode, ctx: ExecuteCtx) => {
      calledNodes.push(node.id);
      assert.equal(ctx.model, 'claude-sonnet-4-5', 'reusa o modelo do checkpoint, sem rotear de novo');
      assert.equal(ctx.provider, 'anthropic', 'reusa o provider do checkpoint');
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setCheckpointStore(checkpoints);

  const result = await orchestrator.run();

  assert.ok(!calledNodes.includes('execute'), 'nó já concluído no checkpoint não deve ser reexecutado');
  assert.ok(calledNodes.includes('verify'), 'nó pendente deve ser executado');
  assert.equal(result.trace.runId, runId, 'mantém o mesmo runId do checkpoint');
  assert.equal(result.status, 'PASS');
  assert.equal(checkpoints.load(runId), null, 'checkpoint limpo ao concluir');
});

test('orchestrator: resumeRunId para checkpoint inexistente lança erro claro', async () => {
  const baseDir = tmpDir();
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 't',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    resumeRunId: 'nao-existe-0001',
    produce: () => ({ content: 'x', kind: 'raw' }),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  await assert.rejects(() => orchestrator.run(), /checkpoint/i);
});
