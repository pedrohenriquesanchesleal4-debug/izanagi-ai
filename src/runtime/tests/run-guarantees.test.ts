import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator } from '../orchestrator.js';
import type { GraphNode } from '../types.js';
import { MemoryStore } from '../memory/store.js';
import { CheckpointStore } from '../recovery/checkpoint.js';
import { Commander } from '../orchestration/commander.js';
import { VerificationEngine } from '../verification/engine.js';
import type { IzanagiEvent } from '../observability/events.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-guard-'));
}

const LONG_TEXT = 'Artefato completo e extenso, com corpo suficiente para a validação de tamanho. '.repeat(12);

function validContentFor(kind: string | undefined): string {
  const req: Record<string, string> = {
    requirements: 'title functional acceptance',
    architecture: 'context decision layers',
    'database-schema': 'model relations @id primary key references',
    'api-contract': 'method path request response',
    'security-report': 'severity vulnerabilities remediation',
    'test-plan': 'unit integration scenarios',
    'implementation-plan': 'steps files',
    research: 'findings sources',
    evaluation: 'verdict score metrics',
    critique: 'status issues',
    delivery: 'written',
    'qa-report': 'summary results',
  };
  return LONG_TEXT + ((kind && req[kind]) || '');
}

/* ==================== ALLOWLIST DE TOOLS ==================== */

test('allowlist: tool fora da lista falha o nó antes de qualquer política', async () => {
  const baseDir = tmpDir();
  try {
    // Plano com `output`: o Commander gera os nós de tool `deliver`
    // (e `materialize` quando o artefato carrega código).
    const plan = new Commander().plan({
      objective: 'Documentar a arquitetura do serviço de cobrança',
      mode: 'orchestrated',
      output: 'docs',
    });
    const toolNodes = plan.graph.nodes.filter((n) => n.kind === 'tool');
    assert.ok(toolNodes.length > 0, 'o plano precisa ter nó de tool');

    const orchestrator = new Orchestrator({
      baseDir,
      workspaceDir: baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'docs',
      primaryAgent: 'docs',
      skillChain: [],
      plan,
      // Allowlist que não contém nenhuma das tools do plano.
      allowedTools: ['project.survey'],
      produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));

    const result = await orchestrator.run();
    const blocked = result.graph.nodes.filter((n) => /fora da allowlist/i.test(n.error ?? ''));
    assert.ok(blocked.length > 0, `algum nó de tool recusado: ${result.graph.nodes.map((n) => `${n.id}=${n.error ?? n.status}`).join(' | ')}`);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('allowlist: lista vazia proíbe toda tool, e isso é declaração e não ausência', async () => {
  const baseDir = tmpDir();
  try {
    const plan = new Commander().plan({
      objective: 'Documentar a arquitetura do serviço de cobrança',
      mode: 'orchestrated',
      output: 'docs',
    });
    const orchestrator = new Orchestrator({
      baseDir,
      workspaceDir: baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'docs',
      primaryAgent: 'docs',
      skillChain: [],
      plan,
      allowedTools: [],
      produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));

    const result = await orchestrator.run();
    assert.ok(
      result.graph.nodes.some((n) => /fora da allowlist do run \(permitidas: nenhuma\)/i.test(n.error ?? '')),
      'a mensagem precisa dizer que nenhuma tool é permitida',
    );
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('allowlist: ausente não muda comportamento nenhum (nó de tool executa)', async () => {
  const baseDir = tmpDir();
  try {
    const plan = new Commander().plan({
      objective: 'Documentar a arquitetura do serviço de cobrança',
      mode: 'orchestrated',
      output: 'docs',
    });
    const orchestrator = new Orchestrator({
      baseDir,
      workspaceDir: baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'docs',
      primaryAgent: 'docs',
      skillChain: [],
      plan,
      produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));

    const result = await orchestrator.run();
    assert.ok(
      result.graph.nodes.every((n) => !/fora da allowlist/i.test(n.error ?? '')),
      'sem allowlist, nenhuma tool é recusada por ela',
    );
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

/* ==================== CHECKPOINT POR BATCH ==================== */

test('checkpoint: progresso é persistido ao fim de cada batch, não só no fim da tentativa', async () => {
  const baseDir = tmpDir();
  try {
    const plan = new Commander().plan({ objective: 'Auditar a segurança da API de pagamentos', mode: 'orchestrated' });
    assert.ok(plan.graph.parallelBatches.length >= 2, 'o teste precisa de 2+ batches');

    const checkpoints = new CheckpointStore({ baseDir });
    const saves: number[] = [];
    const origSave = checkpoints.save.bind(checkpoints);
    checkpoints.save = (data) => {
      // Quantos nós já estavam concluídos no momento de cada gravação.
      saves.push(data.graph.nodes.filter((n) => n.status === 'succeeded').length);
      return origSave(data);
    };

    const orchestrator = new Orchestrator({
      baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: [],
      plan,
      produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));
    orchestrator.setCheckpointStore(checkpoints);

    await orchestrator.run();

    assert.ok(saves.length > plan.graph.parallelBatches.length - 1, `gravações (${saves.length}) precisam acompanhar os batches (${plan.graph.parallelBatches.length})`);
    // A prova de que é POR batch: existe gravação com progresso parcial, e não
    // só a final com tudo pronto.
    const total = plan.graph.nodes.length;
    assert.ok(saves.some((done) => done > 0 && done < total), `alguma gravação com progresso parcial: ${saves.join(',')} de ${total}`);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

/* ==================== NÓ SEM PROVA ==================== */

test('unverified: isDone só aprova VERIFIED', () => {
  const base = { score: 1, checks: [], evidence: [], unmet: [], reason: 'x', judgeTokens: 0 };
  assert.equal(VerificationEngine.isDone({ ...base, status: 'VERIFIED' } as never), true);
  assert.equal(VerificationEngine.isDone({ ...base, status: 'UNVERIFIED' } as never), false);
  assert.equal(VerificationEngine.isDone({ ...base, status: 'FAILED' } as never), false);
});

test('unverified: nó concluído sem prova carrega a marca, e o comprovado não', async () => {
  const baseDir = tmpDir();
  try {
    // Sem juiz semântico (nenhum provider), todo critério semântico fica sem
    // evidência conclusiva: é o caminho onde `UNVERIFIED` realmente aparece.
    const plan = new Commander().plan({ objective: 'Auditar a segurança da API de pagamentos', mode: 'orchestrated' });
    const orchestrator = new Orchestrator({
      baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: [],
      plan,
      produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));

    const result = await orchestrator.run();
    const verifications = new Map((result.verification ?? []).map((v) => [v.nodeId, v.result.status]));

    for (const node of result.graph.nodes) {
      const status = verifications.get(node.id);
      if (status === undefined) continue;
      const marked = node.metadata?.unverified !== undefined;
      assert.equal(
        marked,
        status !== 'VERIFIED',
        `${node.id}: verificação ${status}, marca=${marked}`,
      );
    }
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

/* ==================== EVENTO POR TAREFA ==================== */

test('eventos: cada nó verificado emite task.verification.* com nodeId', async () => {
  const baseDir = tmpDir();
  try {
    const plan = new Commander().plan({ objective: 'Auditar a segurança da API de pagamentos', mode: 'orchestrated' });
    const seen: IzanagiEvent[] = [];
    const orchestrator = new Orchestrator({
      baseDir,
      command: 'test',
      task: plan.runObjective,
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: [],
      plan,
      onEvent: (event) => {
        if (event.name === 'task.verification.passed' || event.name === 'task.verification.failed') seen.push(event);
      },
      produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
    });
    orchestrator.setMemory(new MemoryStore({ baseDir }));

    const result = await orchestrator.run();

    assert.ok(seen.length > 0, 'algum evento de verificação por tarefa foi emitido');
    assert.equal(seen.length, (result.verification ?? []).length, 'um evento por nó verificado');
    for (const event of seen) {
      assert.ok(typeof event.data?.nodeId === 'string', 'o evento carrega o nodeId');
      assert.ok(typeof event.data?.status === 'string', 'o evento carrega o status da verificação');
    }
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
