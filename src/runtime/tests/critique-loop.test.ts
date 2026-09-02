/**
 * Critique Loop + protocolo agente-a-agente.
 *
 * O que estes testes provam: a crítica de um agente sobre o trabalho de outro
 * vira DECISÃO de runtime (reprovação + correção mínima), e a conversa entre
 * eles trafega por referência de artefato, nunca por cópia de conteúdo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator, type ExecuteCtx } from '../orchestrator.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { ContextResolver, type AvailableArtifact } from '../orchestration/context-resolver.js';
import { attachContract, type TaskContract } from '../contracts/task-contract.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import type { CommanderPlan } from '../orchestration/commander.js';
import type { GraphNode } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-critique-'));
}

/** Conteúdo longo o bastante para passar no schema e distinguível no log. */
const ARCH = 'context decision layers: o servico expoe a API de login com camada de dominio isolada. '.repeat(6);
const IMPL = 'CONTEUDO-DA-IMPLEMENTACAO: funcao de login completa com validacao de credenciais. '.repeat(8);

function contractFor(id: string, kind: string, deps: string[]): TaskContract {
  return {
    id,
    objective: `produzir "${kind}" no no "${id}"`,
    role: 'specialist',
    inputs: deps,
    constraints: ['zero stubs'],
    expectedOutput: { kind },
    dependencies: deps,
    priority: 'normal',
    budget: { maxTokens: 2000 },
    verification: { deterministic: [{ kind: 'artifact-valid' }], requireAllCriteria: false },
    acceptance: [
      { id: `${id}:valid`, description: `artefato "${kind}" valido`, kind: 'deterministic', check: { kind: 'artifact-valid' } },
    ],
  };
}

function node(id: string, agent: string, kind: string, deps: string[]): GraphNode {
  return {
    id,
    kind: 'agent',
    agent,
    outputs: [kind],
    dependencies: deps,
    status: 'pending',
    tokenBudget: 2000,
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 3, backoffMs: 0, retryOnValidation: true },
  };
}

/**
 * Grafo mínimo com crítico: architecture -> implementation -> critic.
 * O nó `architecture` existe para provar que a rodada de correção NÃO reenvia
 * os insumos do grafo, só a entrega anterior do próprio nó.
 */
function planWithCritic(): CommanderPlan {
  const nodes = [
    attachContract(node('architecture', 'architect', 'raw', []), contractFor('architecture', 'raw', [])),
    attachContract(node('implementation', 'senior-engineer', 'raw', ['architecture']), contractFor('implementation', 'raw', ['architecture'])),
    attachContract(node('critic', 'adversarial-critic', 'critique', ['implementation']), contractFor('critic', 'critique', ['implementation'])),
  ];
  const graph = new ExecutionGraphBuilder().build({
    task: 'implementar login',
    nodes,
    budget: { maxAttempts: 4, maxTokens: 60_000, maxTimeMs: 600_000 },
  });
  return {
    runObjective: 'implementar login',
    mode: 'autonomous',
    modeReason: 'teste',
    classification: { complexity: 3, domains: ['backend'], category: 'implementation', reasoning: 'medium', risk: 0.2, reasons: [] },
    graph,
    contracts: nodes.map((n) => n.metadata!.contract as TaskContract),
    estimate: {
      nodes: 3,
      parallelStages: 3,
      maxTokens: 6000,
      byRole: { commander: { tasks: 0, tokens: 0 }, specialist: { tasks: 3, tokens: 6000 }, worker: { tasks: 0, tokens: 0 } },
    },
    decisions: [],
    issues: [],
  };
}

interface Call {
  node: string;
  upstream: string[];
  correction?: string;
  contextText: string;
}

/** Executa o grafo com um crítico roteirizado e devolve o que cada nó recebeu. */
async function runWithCritiques(critiques: string[]) {
  const baseDir = tmpDir();
  const calls: Call[] = [];
  const resolverForRender = new ContextResolver();
  let criticCalls = 0;

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'implementar login',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan: planWithCritic(),
    produce: (n: GraphNode, ctx: ExecuteCtx) => {
      calls.push({
        node: n.id,
        upstream: (ctx.nodeContext?.upstream ?? []).map((u) => u.nodeId),
        ...(ctx.nodeContext?.correction ? { correction: ctx.nodeContext.correction } : {}),
        contextText: ctx.nodeContext ? resolverForRender.render(ctx.nodeContext) : '',
      });
      if (n.id === 'critic') {
        const body = critiques[Math.min(criticCalls, critiques.length - 1)];
        criticCalls++;
        return { content: body, kind: 'critique', tokens: 100 };
      }
      return { content: n.id === 'architecture' ? ARCH : IMPL, kind: 'raw', tokens: 100 };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));
  const result = await orchestrator.run();
  fs.rmSync(baseDir, { recursive: true, force: true });
  return { result, calls };
}

const BLOCKING = JSON.stringify({
  status: 'needs_revision',
  issues: [
    { severity: 'critical', description: 'login sem tratamento de erro', artifact: 'implementation', suggestedFix: 'envolver a chamada em try/catch' },
    { severity: 'low', description: 'nome de variavel pouco descritivo', artifact: 'implementation' },
  ],
  confidence: 0.9,
});

const APPROVED = JSON.stringify({ status: 'approved', issues: [], confidence: 0.8 });

const ADVISORY = JSON.stringify({
  status: 'needs_revision',
  issues: [{ severity: 'medium', description: 'poderia extrair uma funcao auxiliar', artifact: 'implementation' }],
  confidence: 0.6,
});

test('critique: crítica bloqueante reprova o nó criticado e dispara retentativa dirigida', async () => {
  const { result, calls } = await runWithCritiques([BLOCKING, APPROVED]);

  const implCalls = calls.filter((c) => c.node === 'implementation');
  assert.equal(implCalls.length, 2, 'a implementação deveria ser refeita após a crítica bloqueante');
  assert.equal(calls.filter((c) => c.node === 'critic').length, 2, 'o crítico deveria reverificar o conserto');

  // A correção chega, e chega MÍNIMA: só o bloqueante, não o issue `low`.
  const retry = implCalls[1];
  assert.ok(retry.correction, 'a retentativa deveria receber a lista de correções');
  assert.match(retry.correction!, /try\/catch/);
  assert.ok(!retry.correction!.includes('pouco descritivo'), 'issue não bloqueante não deveria virar exigência de correção');

  assert.equal(result.status, 'PASS');
});

test('critique: a retentativa recebe a própria entrega, não os insumos do grafo de novo', async () => {
  const { calls } = await runWithCritiques([BLOCKING, APPROVED]);
  const implCalls = calls.filter((c) => c.node === 'implementation');

  assert.deepEqual(implCalls[0].upstream, ['architecture'], 'primeira execução recebe o insumo declarado');
  assert.deepEqual(implCalls[1].upstream, ['implementation'], 'a correção manda a entrega anterior, não o histórico');
  assert.ok(!implCalls[1].contextText.includes('CONTEUDO-DA-ARQUITETURA'));
  assert.ok(implCalls[1].contextText.includes('CORREÇÕES OBRIGATÓRIAS'));
});

test('critique: crítica não bloqueante vira recomendação e não refaz trabalho', async () => {
  const { result, calls } = await runWithCritiques([ADVISORY]);
  assert.equal(calls.filter((c) => c.node === 'implementation').length, 1, 'severidade medium não deveria reabrir o nó');
  assert.equal(calls.filter((c) => c.node === 'critic').length, 1);
  assert.equal(result.status, 'PASS');
  assert.ok(
    (result.evaluation?.recommendations ?? []).some((r) => /não bloqueante/.test(r)),
    'a crítica não bloqueante deveria aparecer como recomendação',
  );
});

test('critique: um nó só é reaberto UMA vez por crítica (sem ping-pong entre crítico e executor)', async () => {
  const { calls } = await runWithCritiques([BLOCKING, BLOCKING, BLOCKING, BLOCKING]);
  assert.equal(
    calls.filter((c) => c.node === 'implementation').length,
    2,
    'crítica insistente não pode reabrir o mesmo nó indefinidamente',
  );
});

test('critique: crítica em prosa reprova o próprio crítico (formato é contrato, não sugestão)', async () => {
  const prosa = 'Analisei a implementação com cuidado e considero que o tratamento de erro está ausente em vários pontos do fluxo de login, o que compromete a robustez da entrega.';
  const { result, calls } = await runWithCritiques([prosa]);

  const criticVerification = result.verification?.find((v) => v.nodeId === 'critic');
  assert.equal(criticVerification?.result.status, 'FAILED', 'crítica sem estrutura não passa na verificação do artefato');
  assert.ok(calls.filter((c) => c.node === 'critic').length > 1, 'o crítico deveria ser cobrado a devolver o formato');
  assert.ok(!calls.some((c) => c.node === 'implementation' && c.correction), 'crítica ilegível não vira correção de outro nó');
});

test('a2a: a conversa trafega por referência de artefato, nunca por cópia do conteúdo', async () => {
  const { result } = await runWithCritiques([BLOCKING, APPROVED]);
  const log = result.conversation ?? [];
  assert.ok(log.length > 0, 'o run deveria registrar o protocolo agente-a-agente');

  const types = new Set(log.map((m) => m.type));
  for (const expected of ['task', 'result', 'critique', 'correction']) {
    assert.ok(types.has(expected as never), `faltou mensagem do tipo "${expected}" no log`);
  }

  const critique = log.find((m) => m.type === 'critique')!;
  assert.equal(critique.from, 'adversarial-critic');
  assert.equal(critique.to, 'implementation');
  assert.ok((critique.artifactRefs ?? []).some((r) => r.endsWith(':implementation')));

  const correction = log.find((m) => m.type === 'correction')!;
  assert.equal(correction.to, 'senior-engineer');
  assert.match(correction.summary, /try\/catch/);

  // O ponto do protocolo: nenhuma mensagem carrega o artefato inteiro.
  for (const m of log) {
    assert.ok(!m.summary.includes('CONTEUDO-DA-IMPLEMENTACAO'), `mensagem "${m.type}" copiou conteúdo de artefato`);
    assert.ok(m.summary.length <= 240, `mensagem "${m.type}" excedeu o teto de resumo`);
  }

  // E o log persiste no trace, senão `izanagi explain` não teria o que mostrar.
  assert.equal(result.trace.conversation?.length, log.length);
});

test('context: correção sem entrega anterior disponível não inventa insumo', () => {
  const contract = contractFor('implementation', 'raw', ['architecture']);
  const available = new Map<string, AvailableArtifact>([
    ['architecture', { nodeId: 'architecture', kind: 'raw', content: ARCH, valid: true, ref: 'run1:architecture' }],
  ]);
  const resolved = new ContextResolver().resolve(contract, available, { correction: '1. (critical) corrigir X' });
  assert.deepEqual(resolved.upstream, []);
  assert.equal(resolved.correction, '1. (critical) corrigir X');
  const rendered = new ContextResolver().render(resolved);
  assert.ok(rendered.includes('corrigir X'));
  assert.ok(!rendered.includes(ARCH.slice(0, 40)), 'correção não deve reenviar o insumo do grafo');
});

test('context: nó de crítica recebe o contrato de saída JSON no prompt', () => {
  const resolved = new ContextResolver().resolve(contractFor('critic', 'critique', ['implementation']), new Map());
  const rendered = new ContextResolver().render(resolved);
  assert.ok(rendered.includes('FORMATO DE SAÍDA OBRIGATÓRIO'));
  assert.ok(rendered.includes('"needs_revision"'));
  assert.ok(rendered.includes('"severity"'));
});
