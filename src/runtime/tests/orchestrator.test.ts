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
import { ArtifactRegistry } from '../artifacts/registry.js';
import { DecisionJournal } from '../memory/decisions.js';

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
    // `critique` entrou quando a avaliação passou a contar nó falho como
    // regressão: sem estes campos o nó `critic` produzia artefato inválido,
    // terminava `failed`, e o run seguia PASS como se nada tivesse falhado.
    critique: 'status issues',
    delivery: 'written',
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

  // Foundation: artifacts carregam proveniência do ArtifactRegistry (id/producer/createdAt/status)
  assert.ok(result.trace.artifacts.length > 0, 'trace tem artifacts');
  for (const artifact of result.trace.artifacts) {
    assert.ok(artifact.id?.startsWith(`${result.trace.runId}:`), 'artifact.id vem do registry');
    assert.ok(artifact.createdAt, 'artifact.createdAt preenchido');
    assert.ok(artifact.status === 'valid' || artifact.status === 'invalid', 'artifact.status derivado da validação');
  }
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

test('orchestrator: run real popula Artifact Registry e Decision Journal (rastreabilidade)', async () => {
  const baseDir = tmpDir();
  // Fixture isolada de agente — necessária para que rankAgents() encontre um
  // candidato real e a decisão de agent-routing tenha o que comparar.
  fs.mkdirSync(path.join(baseDir, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, 'agents', 'senior-engineer-agent.json'),
    JSON.stringify({ name: 'Senior Engineer', role: 'Full-stack development, login features, frontend e backend', skills: ['frontend', 'backend'] }),
  );
  const memory = new MemoryStore({ baseDir });
  const registry = new ArtifactRegistry({ baseDir });
  const journal = new DecisionJournal({ baseDir });
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
  orchestrator.setArtifactRegistry(registry);
  orchestrator.setDecisionJournal(journal);

  const result = await orchestrator.run();
  assert.equal(result.status, 'PASS');

  // Artifact Registry: todo nó com produce bem-sucedido vira um artefato rastreável
  const produced = registry.forRun(result.trace.runId);
  assert.ok(produced.length >= 3, 'artefatos de execute/verify/evaluation registrados');
  const execute = produced.find((a) => a.name === 'execute');
  assert.ok(execute?.hash);
  assert.equal(execute?.producer.agent, 'senior-engineer');
  const verify = produced.find((a) => a.name === 'verify');
  assert.ok(verify?.dependencies.includes(`${result.trace.runId}:execute`), 'dependência rastreada entre nós');
  assert.deepEqual(registry.consumers(execute!.id).map((c) => c.name), [verify!.name]);

  // Decision Journal: roteamento de modelo e de agente ficam registrados com alternativas
  const runDecisions = journal.forRun(result.trace.runId);
  const modelDecision = runDecisions.find((d) => d.kind === 'model-routing');
  const agentDecision = runDecisions.find((d) => d.kind === 'agent-routing');
  assert.ok(modelDecision, 'decisão de model-routing registrada');
  assert.ok(modelDecision!.alternatives.length > 1, 'guarda alternativas realmente consideradas');
  assert.ok(agentDecision, 'decisão de agent-routing registrada');
  assert.equal(agentDecision!.chosen, 'senior-engineer');
});

test('orchestrator: Event System emite o ciclo de vida do run em tempo real (não só pós-fato)', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  const seen: string[] = [];

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Criar uma feature simples',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: ['frontend'],
    produce: (node: GraphNode) => validArtifact(node.outputs?.[0] ?? 'raw', validContentFor(node.outputs?.[0])),
    onEvent: (event) => seen.push(event.name),
  });
  orchestrator.setMemory(memory);

  const result = await orchestrator.run();

  assert.equal(result.status, 'PASS');
  assert.equal(seen[0], 'run.started', 'run.started é sempre o primeiro evento');
  assert.equal(seen[seen.length - 1], 'run.completed', 'run.completed é sempre o último');
  assert.ok(seen.includes('node.started') && seen.includes('node.completed'), 'nós emitem started/completed');
  assert.ok(seen.includes('evaluation.started') && seen.includes('evaluation.completed'), 'evaluation emite started/completed');
  assert.ok(seen.includes('quality_gate.passed'), 'PASS emite quality_gate.passed');
  assert.ok(!seen.includes('quality_gate.failed'), 'run com sucesso não emite quality_gate.failed');
});
