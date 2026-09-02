/**
 * Nó `kind: 'tool'`: a execução real passando por ToolRegistry + PolicyEngine.
 *
 * Até aqui `Orchestrator.executeNode` sempre chamava `opts.produce()` — LLM ou
 * simulação — e NUNCA a `ToolRegistry`. As garantias de menor privilégio,
 * trust tier e sandbox existiam, eram testadas, e não se aplicavam a nada que o
 * `izanagi run` executasse de fato. Estes testes protegem o caminho fechado.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator } from '../orchestrator.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { attachContract, type TaskContract } from '../contracts/task-contract.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import { classifyFailure } from '../recovery/healing.js';
import type { CommanderPlan } from '../orchestration/commander.js';
import type { GraphNode } from '../types.js';
import type { ToolPermission } from '../tools/registry.js';
import type { PolicyEnvironment, TrustTier } from '../security/policy.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-tool-'));
}

function toolContract(opts: {
  id: string;
  tool: { id: string; input: unknown };
  permissions?: ToolPermission[];
}): TaskContract {
  return {
    id: opts.id,
    objective: `executar a tool ${opts.tool.id}`,
    role: 'worker',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 0 },
    verification: { deterministic: [{ kind: 'artifact-valid' }] },
    acceptance: [{ id: `${opts.id}:valid`, description: 'resultado válido', kind: 'deterministic', check: { kind: 'artifact-valid' } }],
    ...(opts.permissions ? { permissions: opts.permissions } : {}),
    tool: opts.tool,
  };
}

function toolPlan(contract: TaskContract, agent?: string): CommanderPlan {
  const node: GraphNode = {
    id: contract.id,
    kind: 'tool',
    ...(agent ? { agent } : {}),
    outputs: ['raw'],
    dependencies: [],
    status: 'pending',
    tokenBudget: 0,
    timeoutMs: 30_000,
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
  };
  const graph = new ExecutionGraphBuilder().build({
    task: 'executar tool',
    nodes: [attachContract(node, contract)],
    budget: { maxAttempts: 1, maxTokens: 1000, maxTimeMs: 60_000 },
  });
  return {
    runObjective: 'executar tool',
    mode: 'assisted',
    modeReason: 'teste',
    classification: { complexity: 2, domains: [], category: 'implementation', reasoning: 'low', risk: 0.2, reasons: [] },
    graph,
    contracts: [contract],
    estimate: {
      nodes: 1,
      parallelStages: 1,
      maxTokens: 0,
      byRole: { commander: { tasks: 0, tokens: 0 }, specialist: { tasks: 0, tokens: 0 }, worker: { tasks: 1, tokens: 0 } },
    },
    decisions: [],
    issues: [],
  };
}

async function runTool(opts: {
  baseDir: string;
  contract: TaskContract;
  agent?: string;
  environment?: PolicyEnvironment;
  trustTier?: TrustTier;
}) {
  let produceCalls = 0;
  const orchestrator = new Orchestrator({
    baseDir: opts.baseDir,
    command: 'test',
    task: 'executar tool',
    category: 'implementation',
    primaryAgent: opts.agent ?? 'senior-engineer',
    skillChain: [],
    plan: toolPlan(opts.contract, opts.agent),
    ...(opts.environment ? { environment: opts.environment } : {}),
    ...(opts.trustTier ? { trustTierOf: () => opts.trustTier } : {}),
    produce: () => {
      produceCalls++;
      return { content: 'nao deveria ser chamado', kind: 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: opts.baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir: opts.baseDir }));
  const result = await orchestrator.run();
  return { result, produceCalls };
}

test('tool: nó de tool executa pela ToolRegistry e não chama modelo nenhum', async () => {
  const baseDir = tmpDir();
  fs.writeFileSync(path.join(baseDir, 'alvo.txt'), 'conteudo real do arquivo', 'utf-8');

  const { result, produceCalls } = await runTool({
    baseDir,
    contract: toolContract({ id: 'ler', tool: { id: 'fs.read', input: { file: 'alvo.txt' } }, permissions: ['fs:read'] }),
  });

  assert.equal(produceCalls, 0, 'nó de tool não pode cair no producer de LLM');
  assert.equal(result.status, 'PASS');
  assert.equal(result.trace.tokens?.total ?? 0, 0, 'tool não consome token de modelo');
  assert.ok(result.trace.spans.some((s) => s.name === 'tool:fs.read'));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('tool: permissão não declarada no contrato é negada antes de executar', async () => {
  const baseDir = tmpDir();
  const alvo = path.join(baseDir, 'nao-deve-existir.txt');

  const { result } = await runTool({
    baseDir,
    // Contrato SEM `permissions`: menor privilégio por construção.
    contract: toolContract({ id: 'escrever', tool: { id: 'fs.write', input: { file: 'nao-deve-existir.txt', content: 'x' } } }),
  });

  assert.notEqual(result.status, 'PASS');
  assert.equal(fs.existsSync(alvo), false, 'a tool não podia ter escrito nada');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('tool: policy nega escrita de agente community mesmo com a permissão concedida', async () => {
  const baseDir = tmpDir();
  const alvo = path.join(baseDir, 'saida.txt');

  const { result } = await runTool({
    baseDir,
    agent: 'agente-de-terceiro',
    trustTier: 'community',
    contract: toolContract({
      id: 'escrever',
      tool: { id: 'fs.write', input: { file: 'saida.txt', content: 'conteudo' } },
      permissions: ['fs:write'],
    }),
  });

  assert.notEqual(result.status, 'PASS', 'permissão concedida não anula a política de trust tier');
  assert.equal(fs.existsSync(alvo), false);
  const negado = result.trace.spans.find((s) => s.name === 'tool:fs.write');
  assert.ok(negado && negado.status === 'error');
  assert.match(String(negado.error ?? ''), /COMMUNITY-DESTRUCTIVE-001|policy negou/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('tool: o mesmo pedido passa quando quem pede é builtin', async () => {
  const baseDir = tmpDir();
  const { result } = await runTool({
    baseDir,
    agent: 'senior-engineer',
    trustTier: 'builtin',
    contract: toolContract({
      id: 'escrever',
      tool: { id: 'fs.write', input: { file: 'saida.txt', content: 'conteudo real gravado pela tool' } },
      permissions: ['fs:write'],
    }),
  });
  assert.equal(result.status, 'PASS');
  assert.equal(fs.readFileSync(path.join(baseDir, 'saida.txt'), 'utf-8'), 'conteudo real gravado pela tool');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('tool: sandbox continua valendo — caminho fora da raiz é recusado', async () => {
  const baseDir = tmpDir();
  const { result } = await runTool({
    baseDir,
    trustTier: 'builtin',
    contract: toolContract({
      id: 'escapar',
      tool: { id: 'fs.read', input: { file: '../../../../etc/passwd' } },
      permissions: ['fs:read'],
    }),
  });
  assert.notEqual(result.status, 'PASS');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('tool: agente desconhecido é tratado como community, não como confiável', async () => {
  const baseDir = tmpDir();
  const { result } = await runTool({
    baseDir,
    agent: 'agente-que-nao-existe',
    // Sem `trustTierOf`: o runtime não sabe a origem deste agente.
    contract: toolContract({
      id: 'escrever',
      tool: { id: 'fs.write', input: { file: 'saida.txt', content: 'x' } },
      permissions: ['fs:write'],
    }),
  });
  assert.notEqual(result.status, 'PASS', 'presumir confiança não verificada é o erro caro aqui');
  assert.equal(fs.existsSync(path.join(baseDir, 'saida.txt')), false);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('tool: a conversa registra o pedido à ToolRegistry com permissões e tier', async () => {
  const baseDir = tmpDir();
  fs.writeFileSync(path.join(baseDir, 'alvo.txt'), 'conteudo', 'utf-8');
  const { result } = await runTool({
    baseDir,
    agent: 'senior-engineer',
    trustTier: 'builtin',
    contract: toolContract({ id: 'ler', tool: { id: 'fs.read', input: { file: 'alvo.txt' } }, permissions: ['fs:read'] }),
  });
  const pedido = (result.conversation ?? []).find((m) => m.type === 'request');
  assert.ok(pedido, 'a chamada de tool precisa aparecer no log A2A');
  assert.equal(pedido!.to, 'tool-registry');
  assert.match(pedido!.summary, /fs\.read/);
  assert.match(pedido!.summary, /builtin/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('tool: negativa de permissão não é falha recuperável (retry não abre porta fechada)', () => {
  assert.equal(classifyFailure('tool "fs.write" recusada ou falhou: permissão negada: fs:write não concedida'), 'non-recoverable');
  assert.equal(classifyFailure('tool "fs.write" recusada ou falhou: policy negou "fs.write" (COMMUNITY-DESTRUCTIVE-001)'), 'non-recoverable');
});

test('capabilities: o trust tier vem da origem do arquivo, não do JSON do agente', () => {
  const baseDir = tmpDir();
  fs.mkdirSync(path.join(baseDir, 'agents', 'generated'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, '.agents', 'agents'), { recursive: true });
  const genome = (name: string) => JSON.stringify({ name, role: 'faz coisas', capabilities: ['x'], skills: [], chains: {}, trustTier: 'builtin' });

  fs.writeFileSync(path.join(baseDir, 'agents', 'proprio-agent.json'), genome('proprio'), 'utf-8');
  fs.writeFileSync(path.join(baseDir, 'agents', 'generated', 'gerado-agent.json'), genome('gerado'), 'utf-8');
  fs.writeFileSync(path.join(baseDir, '.agents', 'agents', 'terceiro-agent.json'), genome('terceiro'), 'utf-8');

  const registry = new AgentCapabilityRegistry({ baseDir });
  assert.equal(registry.get('proprio')?.trustTier, 'builtin');
  assert.equal(registry.get('gerado')?.trustTier, 'generated');
  // O JSON declarava "builtin"; a origem diz outra coisa, e a origem vence.
  assert.equal(registry.get('terceiro')?.trustTier, 'community');
  fs.rmSync(baseDir, { recursive: true, force: true });
});
