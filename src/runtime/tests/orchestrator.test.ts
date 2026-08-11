import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator } from '../orchestrator.js';
import type { ExecuteCtx } from '../orchestrator.js';
import type { GraphNode } from '../types.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-orb-'));
}

function validArtifact(kind: string, content: string): { content: unknown; kind: string } {
  return { content, kind };
}

const LONG_TEXT = 'Aqui temos um artefato completo e extenso para validação. '.repeat(20);

/** Conteúdo textual válido por kind de artefato (campos obrigatórios do schema). */
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
    trace: 'runId spans',
    'qa-report': 'summary results',
  };
  const extra = (kind && req[kind]) || '';
  return LONG_TEXT + extra;
}

test('orchestrator: ciclo completo com artefatos válidos → PASS + trace persistido + learning', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  const store = new TraceStore({ baseDir });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Criar uma feature de login',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: ['frontend'],
    produce: (node: GraphNode) =>
      validArtifact(node.outputs?.[0] ?? 'raw', validContentFor(node.outputs?.[0])),
  });
  orchestrator.setMemory(memory);
  orchestrator.setStore(store);

  const result = await orchestrator.run();

  assert.equal(result.status, 'PASS');
  assert.ok(result.trace.runId.startsWith('izanagi-'));
  assert.ok(fs.existsSync(result.traceFile), 'trace persistido em disco');
  assert.ok(result.graph.nodes.length >= 3, 'grafo com nós');
  // learning: stats do agente registrados
  const stats = memory.agentStats('senior-engineer');
  assert.ok(stats, 'stats do agente registrados');
  assert.ok(stats.runs >= 1);
});

test('orchestrator: falha transitória → retry → sucesso final', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  let calls = 0;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Debug de erro 500',
    category: 'debugging',
    primaryAgent: 'bug-hunter',
    skillChain: ['systematic-debugging'],
    produce: async (node: GraphNode) => {
      if (node.id === 'reproduce' && calls++ === 0) {
        throw new Error('request timed out');
      }
      return validArtifact(node.outputs?.[0] ?? 'raw', validContentFor(node.outputs?.[0]));
    },
  });
  orchestrator.setMemory(memory);

  const result = await orchestrator.run();

  assert.ok(result.healing.length >= 1, 'ação de healing registrada');
  assert.equal(result.healing[0].kind, 'retry');
  assert.equal(result.status, 'PASS');
});

test('orchestrator: falha permanente → abort (limite de tentativas) → FAIL', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Implementar módulo X',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    produce: async () => {
      throw new Error('falha fatal irrecuperável');
    },
  });
  orchestrator.setMemory(memory);

  const result = await orchestrator.run();

  assert.ok(result.healing.some((h) => h.kind === 'abort'), 'abort após tentativas');
  assert.ok(['FAIL', 'BLOCKED'].includes(result.status), `status final ${result.status}`);
});

test('orchestrator: artefato inválido → skill_replacement aplicado ao nó', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  let replacedSkill: string | undefined;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Criar schema de banco',
    category: 'database_design',
    primaryAgent: 'database',
    skillChain: ['sql-optimizer'],
    produce: async (node: GraphNode, ctx: ExecuteCtx) => {
      // falha de validação: conteúdo curto demais apenas no nó de schema
      if (node.id === 'schema') {
        return validArtifact(node.outputs?.[0] ?? 'raw', 'curto');
      }
      return validArtifact(node.outputs?.[0] ?? 'raw', validContentFor(node.outputs?.[0]));
    },
  });
  orchestrator.setMemory(memory);

  const result = await orchestrator.run();

  assert.ok(result.healing.some((h) => h.kind === 'skill_replacement'), 'skill_replacement acionado');
  const executeNode = result.graph.nodes.find((n) => n.id === 'schema');
  assert.ok(executeNode, 'nó schema existe');
  if (executeNode && executeNode.skills) {
    replacedSkill = executeNode.skills[0];
  }
  // após o healing, a skill do nó deve ter sido substituída (qa) ou o nó falhou
  assert.ok(replacedSkill === 'qa' || executeNode?.status === 'failed');
});

test('orchestrator: teste falhando → regressão reportada na avaliação', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Rodar suíte de testes',
    category: 'testing',
    primaryAgent: 'qa',
    skillChain: ['qa'],
    produce: (node: GraphNode) => {
      if (node.outputs?.[0] === 'test-results') {
        return { content: { passed: 1, failed: 2 }, kind: 'test-results' };
      }
      return validArtifact(node.outputs?.[0] ?? 'raw', validContentFor(node.outputs?.[0]));
    },
  });
  orchestrator.setMemory(memory);

  const result = await orchestrator.run();

  assert.equal(result.evaluation?.regressions.length ?? 0, 1, 'regressão reportada');
  assert.equal(result.status, 'BLOCKED');
});
