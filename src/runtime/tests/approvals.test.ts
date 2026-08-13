import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ApprovalStore, findPendingApprovalNodeId } from '../recovery/approvals.js';
import { CheckpointStore, type CheckpointData } from '../recovery/checkpoint.js';
import { Orchestrator } from '../orchestrator.js';
import type { ExecutionGraph, GraphNode } from '../types.js';
import { MemoryStore } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-approvals-'));
}

test('approval store: request cria pendente e é idempotente', () => {
  const store = new ApprovalStore({ baseDir: tmpDir() });
  const first = store.request('run-1', 'deploy', 'deploy de produção');
  const second = store.request('run-1', 'deploy', 'contexto diferente ignorado');
  assert.equal(first.decision, 'pending');
  assert.equal(second.requestedAt, first.requestedAt, 'não recria se já existe pendente');
});

test('approval store: decide approved/rejected e pendingFor reflete o estado', () => {
  const store = new ApprovalStore({ baseDir: tmpDir() });
  store.request('run-1', 'a');
  store.request('run-1', 'b');
  assert.equal(store.pendingFor('run-1').length, 2);

  store.decide('run-1', 'a', 'approved', { decidedBy: 'pedro' });
  assert.equal(store.get('run-1', 'a')?.decision, 'approved');
  assert.equal(store.pendingFor('run-1').length, 1);

  store.decide('run-1', 'b', 'rejected', { reason: 'risco alto demais' });
  assert.equal(store.get('run-1', 'b')?.reason, 'risco alto demais');
  assert.equal(store.pendingFor('run-1').length, 0);
});

test('findPendingApprovalNodeId: usa o ApprovalStore quando há pendente registrado', () => {
  const store = new ApprovalStore({ baseDir: tmpDir() });
  store.request('run-1', 'deploy-approval');
  const found = findPendingApprovalNodeId(store, 'run-1', { nodes: [{ id: 'deploy-approval', kind: 'approval', status: 'pending' }] });
  assert.equal(found, 'deploy-approval');
});

test('findPendingApprovalNodeId: sem registro no store, cai para varredura do grafo (defensivo)', () => {
  const store = new ApprovalStore({ baseDir: tmpDir() });
  const graph = {
    nodes: [
      { id: 'execute', kind: 'agent', status: 'succeeded' },
      { id: 'deploy-approval', kind: 'approval', status: 'pending' },
    ],
  };
  assert.equal(findPendingApprovalNodeId(store, 'run-sem-registro', graph), 'deploy-approval');
});

test('findPendingApprovalNodeId: sem nada pendente (nem store, nem grafo) retorna undefined', () => {
  const store = new ApprovalStore({ baseDir: tmpDir() });
  const graph = { nodes: [{ id: 'execute', kind: 'agent', status: 'succeeded' }] };
  assert.equal(findPendingApprovalNodeId(store, 'run-x', graph), undefined);
  assert.equal(findPendingApprovalNodeId(store, 'run-x'), undefined, 'sem grafo também não deve quebrar');
});

test('approval store: persiste em disco por run e recarrega em nova instância', () => {
  const baseDir = tmpDir();
  const s1 = new ApprovalStore({ baseDir });
  s1.request('run-1', 'deploy');
  const s2 = new ApprovalStore({ baseDir });
  assert.ok(s2.get('run-1', 'deploy'));
});

function approvalGraph(): ExecutionGraph {
  return {
    id: 'graph-approval',
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

function seedCheckpoint(checkpoints: CheckpointStore, runId: string): CheckpointData {
  const data: CheckpointData = {
    runId,
    task: 'Deploy em produção',
    category: 'implementation',
    primaryAgent: 'devops',
    skillChain: [],
    model: 'claude-sonnet-4-5',
    provider: 'anthropic',
    graph: approvalGraph(),
    artifacts: [],
    budgetSpent: {},
    attempts: 0,
    tokensUsed: 0,
    savedAt: new Date().toISOString(),
  };
  checkpoints.save(data);
  return data;
}

const LONG_TEXT = 'Aqui temos um artefato completo e extenso para validação. '.repeat(20);

test('orchestrator: nó approval pendente pausa a execução (BLOCKED + pendingApproval, sem rodar evaluation)', async () => {
  const baseDir = tmpDir();
  const checkpoints = new CheckpointStore({ baseDir });
  const runId = 'izanagi-approval-test-0001';
  seedCheckpoint(checkpoints, runId);

  let produceCalled = false;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Deploy em produção',
    category: 'implementation',
    primaryAgent: 'devops',
    skillChain: [],
    resumeRunId: runId,
    produce: (node: GraphNode) => {
      produceCalled = true;
      return { content: LONG_TEXT + 'verdict score metrics', kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setCheckpointStore(checkpoints);

  const result = await orchestrator.run();

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.pendingApproval?.nodeId, 'deploy-approval');
  assert.equal(result.evaluation, undefined, 'run pausado não deve produzir veredito final');
  assert.ok(!produceCalled, 'produce nunca deve ser chamado para o nó approval em si nem para nós depois dele');

  // checkpoint sobrevive — ainda há o que resumir
  assert.ok(checkpoints.load(runId), 'checkpoint deve sobreviver enquanto aguarda aprovação');
});

test('orchestrator: approve + resume continua a execução e conclui normalmente', async () => {
  const baseDir = tmpDir();
  const checkpoints = new CheckpointStore({ baseDir });
  const approvals = new ApprovalStore({ baseDir });
  const runId = 'izanagi-approval-test-0002';
  seedCheckpoint(checkpoints, runId);

  const firstPass = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Deploy em produção',
    category: 'implementation',
    primaryAgent: 'devops',
    skillChain: [],
    resumeRunId: runId,
    produce: (node: GraphNode) => ({ content: LONG_TEXT + 'verdict score metrics', kind: node.outputs?.[0] ?? 'raw' }),
  });
  firstPass.setMemory(new MemoryStore({ baseDir }));
  firstPass.setCheckpointStore(checkpoints);
  firstPass.setApprovalStore(approvals);
  const paused = await firstPass.run();
  assert.equal(paused.status, 'BLOCKED');

  // Decisão humana: aprova o deploy.
  approvals.decide(runId, 'deploy-approval', 'approved', { decidedBy: 'pedro' });

  const secondPass = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Deploy em produção',
    category: 'implementation',
    primaryAgent: 'devops',
    skillChain: [],
    resumeRunId: runId,
    produce: (node: GraphNode) => ({ content: LONG_TEXT + 'verdict score metrics', kind: node.outputs?.[0] ?? 'raw' }),
  });
  secondPass.setMemory(new MemoryStore({ baseDir }));
  secondPass.setCheckpointStore(checkpoints);
  secondPass.setApprovalStore(approvals);
  const result = await secondPass.run();

  assert.equal(result.status, 'PASS');
  assert.ok(result.evaluation, 'run concluído tem veredito');
  assert.equal(checkpoints.load(runId), null, 'checkpoint limpo ao concluir de verdade');
});

test('orchestrator: reject + resume falha o nó com o motivo da rejeição', async () => {
  const baseDir = tmpDir();
  const checkpoints = new CheckpointStore({ baseDir });
  const approvals = new ApprovalStore({ baseDir });
  const runId = 'izanagi-approval-test-0003';
  seedCheckpoint(checkpoints, runId);

  const firstPass = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Deploy em produção',
    category: 'implementation',
    primaryAgent: 'devops',
    skillChain: [],
    resumeRunId: runId,
    produce: (node: GraphNode) => ({ content: LONG_TEXT + 'verdict score metrics', kind: node.outputs?.[0] ?? 'raw' }),
  });
  firstPass.setMemory(new MemoryStore({ baseDir }));
  firstPass.setCheckpointStore(checkpoints);
  firstPass.setApprovalStore(approvals);
  await firstPass.run();

  approvals.decide(runId, 'deploy-approval', 'rejected', { reason: 'janela de manutenção fechada' });

  const secondPass = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Deploy em produção',
    category: 'implementation',
    primaryAgent: 'devops',
    skillChain: [],
    resumeRunId: runId,
    produce: (node: GraphNode) => ({ content: LONG_TEXT + 'verdict score metrics', kind: node.outputs?.[0] ?? 'raw' }),
  });
  secondPass.setMemory(new MemoryStore({ baseDir }));
  secondPass.setCheckpointStore(checkpoints);
  secondPass.setApprovalStore(approvals);
  const result = await secondPass.run();

  assert.ok(['FAIL', 'BLOCKED'].includes(result.status));
  const node = result.graph.nodes.find((n) => n.id === 'deploy-approval');
  assert.match(node?.error ?? '', /rejeitada.*janela de manutenção fechada/);
});
