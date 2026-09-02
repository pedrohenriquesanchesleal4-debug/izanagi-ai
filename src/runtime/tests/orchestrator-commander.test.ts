import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator, type ExecuteCtx } from '../orchestrator.js';
import { Commander } from '../orchestration/commander.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import type { GraphNode } from '../types.js';
import type { AgentRole } from '../contracts/task-contract.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-cmd-'));
}

const LONG = 'Conteúdo real, completo e pronto para produção deste artefato. '.repeat(20);

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
  };
  return LONG + ((kind && req[kind]) || '');
}

test('runtime: modo direct executa UMA tarefa (sem grafo de 9 nós para tarefa trivial)', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({ objective: 'Converta 10 dólares para reais' });
  assert.equal(plan.mode, 'direct');

  const executed: string[] = [];
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: (node: GraphNode) => {
      executed.push(node.id);
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.deepEqual(executed, ['answer']);
  assert.equal(result.mode, 'direct');
  assert.equal(result.status, 'PASS');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: contrato, contexto mínimo e papel chegam ao producer', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Auditar a segurança OWASP da API de login e propor remediação',
    mode: 'orchestrated',
  });

  const seen: Array<{ node: string; role?: AgentRole; objective?: string; upstream: string[] }> = [];
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode, ctx: ExecuteCtx) => {
      seen.push({
        node: node.id,
        role: ctx.nodeRole,
        objective: ctx.contract?.objective,
        upstream: (ctx.nodeContext?.upstream ?? []).map((u) => u.nodeId),
      });
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  await orchestrator.run();
  assert.ok(seen.length >= 2);
  assert.ok(seen.every((s) => typeof s.objective === 'string' && s.objective.length > 0), 'todo nó recebe objetivo do contrato');
  assert.ok(seen.every((s) => s.role !== undefined), 'todo nó recebe papel');
  const dependent = seen.find((s) => s.upstream.length > 0);
  assert.ok(dependent, 'nós dependentes precisam receber as saídas dos predecessores');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: verificação reprova artefato que viola critério de aceite', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({ objective: 'Converta 10 dólares para reais' });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    // Conteúdo grande o bastante para o schema `raw`, mas com stub proibido.
    produce: () => ({ content: `${LONG}\nTODO: implementar depois`, kind: 'raw' }),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();
  const verification = result.verification?.find((v) => v.nodeId === 'answer');
  assert.ok(verification, 'verificação do nó deveria existir');
  assert.equal(verification!.result.status, 'FAILED');
  assert.notEqual(result.status, 'PASS');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: roteamento por papel usa modelo diferente por tarefa', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Auditar a segurança OWASP da API de login e propor remediação',
    mode: 'orchestrated',
  });
  const routed: Array<{ node: string; model: string }> = [];
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    routeRole: (role) => ({ model: `modelo-${role}`, provider: 'fake' }),
    produce: (node: GraphNode, ctx: ExecuteCtx) => {
      routed.push({ node: node.id, model: ctx.model });
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  await orchestrator.run();
  assert.ok(routed.every((r) => r.model.startsWith('modelo-')), 'todo nó deve ser roteado pelo papel');
  const distinct = new Set(routed.map((r) => r.model));
  assert.ok(distinct.size >= 2, `esperava modelos distintos por papel, veio ${[...distinct].join(', ')}`);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: retentativa ESCALA o papel em vez de repetir o mesmo modelo', async () => {
  const baseDir = tmpDir();
  // Modo com mais de uma tentativa: `direct` é single-shot de propósito.
  const plan = new Commander().plan({ objective: 'Implementar o endpoint de login', mode: 'orchestrated' });
  const models: string[] = [];
  let firstCall = true;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    routeRole: (role) => ({ model: `modelo-${role}`, provider: 'fake' }),
    produce: (node: GraphNode, ctx: ExecuteCtx) => {
      models.push(ctx.model);
      if (firstCall) {
        firstCall = false;
        throw new Error('request timed out');
      }
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();
  assert.ok(models.length >= 2, `esperava retentativa, veio ${models.length} chamada(s)`);
  assert.notEqual(models[0], models[1], 'a retentativa deve escalar de papel, não repetir o modelo que falhou');
  assert.ok((result.telemetry?.modelEscalations ?? 0) >= 1, 'escalada deve aparecer na telemetria');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: telemetria de economia é preenchida e persistida no trace', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Auditar a segurança OWASP da API de login e propor remediação',
    mode: 'orchestrated',
  });
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode) => ({
      content: validContentFor(node.outputs?.[0]),
      kind: node.outputs?.[0] ?? 'raw',
      tokens: 400,
    }),
    costOf: (_model, input, output) => input * 1e-6 + output * 3e-6,
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();
  assert.ok(result.telemetry, 'telemetria presente no resultado');
  assert.ok(result.telemetry!.totalTokens > 0);
  assert.equal(result.telemetry!.budgetTokens, plan.graph.budget.maxTokens);

  const persisted = JSON.parse(fs.readFileSync(result.traceFile, 'utf-8'));
  assert.equal(persisted.mode, 'orchestrated');
  assert.ok(persisted.telemetry, 'telemetria persistida no trace');
  assert.ok(Array.isArray(persisted.verification) && persisted.verification.length > 0, 'verificação persistida no trace');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: early stopping pula a crítica opcional quando tudo já está verificado', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Auditar a segurança OWASP da API de login e propor remediação com testes e deploy',
    mode: 'autonomous',
  });
  assert.ok(plan.graph.nodes.some((n) => n.id === 'critic'), 'o template autonomous deve trazer o crítico');

  const executed: string[] = [];
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode) => {
      executed.push(node.id);
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  await orchestrator.run();
  assert.ok(!executed.includes('critic'), `crítica opcional não deveria rodar com tudo verificado: ${executed.join(', ')}`);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: sem plano do Commander o caminho legado continua idêntico', async () => {
  const baseDir = tmpDir();
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'Debug de erro 500',
    category: 'debugging',
    primaryAgent: 'bug-hunter',
    skillChain: [],
    produce: (node: GraphNode) => ({ content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' }),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();
  assert.equal(result.mode, undefined, 'run legado não declara modo');
  assert.equal(result.verification, undefined, 'run legado não produz verificação por contrato');
  assert.ok(result.graph.nodes.some((n) => n.id === 'reproduce'), 'template legado de debugging preservado');
  fs.rmSync(baseDir, { recursive: true, force: true });
});
