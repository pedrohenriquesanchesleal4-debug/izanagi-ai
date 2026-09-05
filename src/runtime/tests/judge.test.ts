/**
 * Juiz semântico: a camada que decide o que nenhum check determinístico decide.
 *
 * A regra que estes testes protegem: um juiz que não respondeu NÃO reprova e
 * NÃO aprova. Confundir ausência de veredito com reprovação inventa falha; com
 * aprovação, inventa sucesso. As duas são piores que "sem evidência".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { VerificationEngine, type SemanticJudge } from '../verification/engine.js';
import { createModelJudge, parseVerdict } from '../verification/judge.js';
import { Orchestrator, type ExecuteCtx } from '../orchestrator.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { attachContract, type TaskContract } from '../contracts/task-contract.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import type { CommanderPlan } from '../orchestration/commander.js';
import type { GraphNode } from '../types.js';

const engine = new VerificationEngine();
const LONG = 'Conteudo real e completo do artefato produzido pelo agente, com detalhe suficiente. '.repeat(6);

function contractWithSemantic(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'execute',
    objective: 'implementar autenticacao com senha nunca em texto claro',
    role: 'specialist',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 2000 },
    verification: { deterministic: [{ kind: 'artifact-valid' }], requireAllCriteria: false },
    acceptance: [
      { id: 'execute:valid', description: 'artefato valido', kind: 'deterministic', check: { kind: 'artifact-valid' } },
      { id: 'execute:senha', description: 'a senha nunca é armazenada em texto claro', kind: 'semantic' },
    ],
    ...overrides,
  };
}

/* ============================ parseVerdict ============================ */

test('judge: veredito JSON limpo é aceito', () => {
  assert.deepEqual(parseVerdict('{"pass": true, "reason": "usa argon2id"}'), { pass: true, message: 'usa argon2id' });
});

test('judge: veredito embrulhado em prosa e cerca de código ainda é aceito', () => {
  const text = 'Analisei o artefato.\n```json\n{"pass": false, "reason": "grava a senha em texto claro"}\n```\nEspero ter ajudado.';
  const verdict = parseVerdict(text);
  assert.equal(verdict.pass, false);
  assert.equal(verdict.message, 'grava a senha em texto claro');
  assert.ok(!verdict.inconclusive);
});

test('judge: "true" em string conta (modelo pequeno erra o tipo com frequência)', () => {
  assert.equal(parseVerdict('{"pass": "true"}').pass, true);
  assert.equal(parseVerdict('{"pass": "FALSE"}').pass, false);
});

test('judge: saída sem veredito utilizável é inconclusiva, nunca reprovação', () => {
  for (const bad of ['nao consegui avaliar', '{"pass": "talvez"}', '{ isto nao e json }', '']) {
    const verdict = parseVerdict(bad);
    assert.equal(verdict.inconclusive, true, `deveria ser inconclusivo: ${bad}`);
  }
});

/* ============================ engine + juiz ============================ */

test('judge: critério semântico aprovado pelo juiz fecha VERIFIED', async () => {
  const judge: SemanticJudge = () => ({ pass: true, message: 'usa hash', tokens: 42, model: 'worker-model' });
  const result = await engine.verify({ contract: contractWithSemantic(), content: LONG, judge });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.judgeTokens, 42);
  assert.equal(result.judgeModel, 'worker-model');
});

test('judge: sem juiz, o critério semântico continua sem evidência conclusiva', async () => {
  const result = await engine.verify({ contract: contractWithSemantic(), content: LONG });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.judgeTokens, 0);
  assert.ok(result.unmet.some((u) => /senha/.test(u)));
});

test('judge: reprovação do juiz derruba o veredito', async () => {
  const judge: SemanticJudge = () => ({ pass: false, message: 'grava em texto claro' });
  const result = await engine.verify({ contract: contractWithSemantic(), content: LONG, judge });
  assert.equal(result.status, 'FAILED');
});

test('judge: juiz inconclusivo deixa UNVERIFIED, não FAILED', async () => {
  const judge: SemanticJudge = () => ({ pass: false, inconclusive: true, message: 'timeout' });
  const result = await engine.verify({ contract: contractWithSemantic(), content: LONG, judge });
  assert.equal(result.status, 'UNVERIFIED', 'juiz que não respondeu não pode reprovar o artefato');
});

test('judge: modelo que falha na chamada não derruba a verificação', async () => {
  const judge = createModelJudge({
    complete: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  const result = await engine.verify({ contract: contractWithSemantic(), content: LONG, judge });
  assert.equal(result.status, 'UNVERIFIED');
  assert.ok(result.checks.some((c) => c.layer === 'semantic' && /ECONNREFUSED/.test(c.message ?? '')));
});

test('judge: o artefato chega ao juiz resumido, não inteiro', async () => {
  const seen: string[] = [];
  const judge = createModelJudge({
    maxContentChars: 300,
    complete: async ({ user }) => {
      seen.push(user);
      return { text: '{"pass": true}', tokens: 30, model: 'm' };
    },
  });
  const huge = 'x'.repeat(50_000);
  await engine.verify({ contract: contractWithSemantic(), content: huge, judge });
  assert.equal(seen.length, 1);
  assert.ok(seen[0].length < 2000, `juiz recebeu ${seen[0].length} chars: deveria receber o artefato resumido`);
  assert.ok(seen[0].includes('CRITÉRIO A VERIFICAR'));
});

/* ============================ integração com o runtime ============================ */

function planWithSemanticCriterion(): CommanderPlan {
  const raw: GraphNode = {
    id: 'execute',
    kind: 'agent',
    agent: 'senior-engineer',
    outputs: ['raw'],
    dependencies: [],
    status: 'pending',
    tokenBudget: 2000,
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 2, backoffMs: 0 },
  };
  const contract = contractWithSemantic();
  const graph = new ExecutionGraphBuilder().build({
    task: 'implementar autenticacao',
    nodes: [attachContract(raw, contract)],
    budget: { maxAttempts: 2, maxTokens: 40_000, maxTimeMs: 300_000 },
  });
  return {
    runObjective: 'implementar autenticacao',
    mode: 'orchestrated',
    modeReason: 'teste',
    classification: { complexity: 3, domains: ['backend'], category: 'implementation', reasoning: 'medium', risk: 0.2, reasons: [] },
    graph,
    contracts: [contract],
    estimate: {
      nodes: 1,
      parallelStages: 1,
      maxTokens: 2000,
      byRole: { commander: { tasks: 0, tokens: 0 }, specialist: { tasks: 1, tokens: 2000 }, worker: { tasks: 0, tokens: 0 } },
    },
    decisions: [],
    issues: [],
  };
}

test('judge: token do julgamento entra na conta do run, na fase de avaliação', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-judge-'));
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'implementar autenticacao',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan: planWithSemanticCriterion(),
    judge: () => ({ pass: true, message: 'ok', tokens: 120, model: 'juiz-barato' }),
    produce: (_n: GraphNode, _ctx: ExecuteCtx) => ({ content: LONG, kind: 'raw', tokens: 400 }),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.equal(result.verification?.[0]?.result.status, 'VERIFIED', 'com juiz, o critério semântico fecha');
  // O trace conta o TOTAL do provider dividido em entrada e saída: 400 de
  // produção continuam 400, e o julgamento acrescenta exatamente os 120 que o
  // juiz declarou. Esta linha dizia 760 (400 tratado como se fosse só entrada,
  // mais 60% de saída inventada em cima) e por isso o trace do run saía 60%
  // acima do que a telemetria do mesmo run cobrava.
  assert.equal(result.trace.tokens?.total, 520, 'os 120 tokens do juiz precisam aparecer na conta do run');
  const evaluationPhase = result.trace.budget?.evaluation;
  assert.ok(evaluationPhase && evaluationPhase.spent >= 120, `julgamento deveria ser cobrado da fase evaluation, veio ${JSON.stringify(evaluationPhase)}`);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('judge: sem juiz, o mesmo run termina sem evidência conclusiva e sem gasto extra', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-nojudge-'));
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'implementar autenticacao',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan: planWithSemanticCriterion(),
    produce: () => ({ content: LONG, kind: 'raw', tokens: 400 }),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.equal(result.verification?.[0]?.result.status, 'UNVERIFIED');
  assert.equal(result.trace.tokens?.total, 400, 'sem juiz, nada além da produção é cobrado');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('telemetria: o total do trace é o mesmo total que o orçamento cobrou', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-tokens-'));
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: 'implementar autenticacao',
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan: planWithSemanticCriterion(),
    judge: () => ({ pass: true, message: 'ok', tokens: 120, model: 'juiz-barato' }),
    produce: () => ({ content: LONG, kind: 'raw', tokens: 400 }),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  // Este é o invariante, e não o número: o trace é o que a CLI imprime, o que
  // `izanagi trace` mostra, o que o webhook envia e o que a Arena soma; a
  // telemetria é o que `izanagi budget` mostra e o que se compara com a fatura.
  // Enquanto o trace tratava o total do provider como se fosse só a entrada e
  // inventava 60% de saída em cima, os dois divergiam em 60% no mesmo run.
  assert.equal(
    result.trace.tokens?.total,
    result.telemetry?.totalTokens,
    `trace ${result.trace.tokens?.total} e telemetria ${result.telemetry?.totalTokens} contam o mesmo run`,
  );
  assert.equal(result.trace.tokens?.total, (result.trace.tokens?.input ?? 0) + (result.trace.tokens?.output ?? 0));
  fs.rmSync(baseDir, { recursive: true, force: true });
});
