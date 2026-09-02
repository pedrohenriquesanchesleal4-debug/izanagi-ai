import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runWithConcurrency, runWithConcurrencyTracked, DEFAULT_MAX_CONCURRENCY } from '../orchestration/concurrency.js';
import { Orchestrator, type ExecuteCtx } from '../orchestrator.js';
import { Commander } from '../orchestration/commander.js';
import { MemoryStore } from '../memory/store.js';
import { ModelRouter } from '../model/router.js';
import type { GraphNode } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-conc-'));
}

const LONG = 'Conteúdo real, completo e pronto para produção deste artefato do runtime. '.repeat(12);

function validContentFor(kind: string | undefined): string {
  const req: Record<string, string> = {
    requirements: 'title functional acceptance',
    architecture: 'context decision layers',
    'database-schema': 'model relations @id primary key references',
    'security-report': 'severity vulnerabilities remediation',
    'test-plan': 'unit integration scenarios',
    'implementation-plan': 'steps files',
    research: 'findings sources',
    evaluation: 'verdict score metrics',
  };
  return LONG + ((kind && req[kind]) || '');
}

const defer = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ==================== POOL ==================== */

test('pool: respeita o teto de tarefas em voo', async () => {
  const tasks = Array.from({ length: 12 }, () => async () => {
    await defer(15);
    return 1;
  });
  const { results, peakInFlight } = await runWithConcurrencyTracked(tasks, 3);
  assert.equal(results.length, 12);
  assert.ok(peakInFlight <= 3, `pico de ${peakInFlight} viola o teto de 3`);
  assert.ok(peakInFlight >= 2, 'com 12 tarefas lentas o pool deveria de fato paralelizar');
});

test('pool: preserva a ordem dos resultados', async () => {
  const tasks = [40, 5, 20, 1].map((ms, i) => async () => {
    await defer(ms);
    return i;
  });
  const results = await runWithConcurrency(tasks, 2);
  assert.deepEqual(results.map((r) => (r.ok ? r.value : null)), [0, 1, 2, 3]);
});

test('pool: uma tarefa que rejeita não derruba as outras', async () => {
  const tasks = [
    async () => 'a',
    async () => {
      throw new Error('falhou');
    },
    async () => 'c',
  ];
  const results = await runWithConcurrency(tasks, 3);
  assert.deepEqual(results.map((r) => r.ok), [true, false, true]);
  assert.equal((results[1] as { ok: false; error: unknown }).error instanceof Error, true);
  assert.equal(results[2].ok && results[2].value, 'c');
});

test('pool: limite maior que o número de tarefas roda tudo junto', async () => {
  const tasks = Array.from({ length: 3 }, () => async () => {
    await defer(20);
    return 1;
  });
  const { peakInFlight } = await runWithConcurrencyTracked(tasks, 99);
  assert.equal(peakInFlight, 3);
});

test('pool: limite 1 serializa de verdade', async () => {
  const tasks = Array.from({ length: 4 }, () => async () => {
    await defer(5);
    return 1;
  });
  const { peakInFlight } = await runWithConcurrencyTracked(tasks, 1);
  assert.equal(peakInFlight, 1);
});

test('pool: lista vazia não trava', async () => {
  assert.deepEqual(await runWithConcurrency([], 3), []);
});

/* ==================== ORCHESTRATOR ==================== */

test('runtime: teto de concorrência é respeitado num batch paralelo real', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Construa um SaaS completo com frontend Next.js, API backend, banco Postgres com migrations, auditoria OWASP e pipeline de deploy',
    mode: 'autonomous',
  });
  const parallelBatch = plan.graph.parallelBatches.find((b) => b.length >= 3);
  assert.ok(parallelBatch, 'o plano precisa ter um batch com 3+ nós para este teste valer');

  let inFlight = 0;
  let peak = 0;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    budgetLimits: { maxConcurrency: 2 },
    produce: async (node: GraphNode) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await defer(10);
      inFlight--;
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  await orchestrator.run();
  assert.ok(peak <= 2, `pico de ${peak} produces simultâneos viola maxConcurrency: 2`);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: degradação reduz o teto de saída dos nós pendentes de fato', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Construa um SaaS completo com frontend Next.js, API backend, banco Postgres com migrations, auditoria OWASP e pipeline de deploy',
    mode: 'autonomous',
  });
  const maxOriginalBudget = Math.max(...plan.graph.nodes.map((n) => n.tokenBudget ?? 0));
  const seen: Array<{ node: string; budget: number | undefined }> = [];

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: async (node: GraphNode) => {
      seen.push({ node: node.id, budget: node.tokenBudget });
      // Gasto constante e alto o bastante para a fase `execution` encher ao
      // longo do grafo, sem estourá-la logo no primeiro nó.
      return {
        content: validContentFor(node.outputs?.[0]),
        kind: node.outputs?.[0] ?? 'raw',
        tokens: Math.floor(plan.graph.budget.maxTokens * 0.08),
      };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();
  const applied = result.telemetry?.degradationsApplied ?? [];
  assert.ok(applied.length >= 2, `esperava pelo menos 2 degraus aplicados, veio [${applied.join(', ')}]`);
  assert.equal(applied[0], 'reduce-context');
  assert.equal(applied[1], 'reduce-output');

  const afterReduce = seen.slice(2).map((s) => s.budget ?? 0);
  assert.ok(
    afterReduce.some((b) => b > 0 && b < maxOriginalBudget),
    `nenhum nó posterior teve o teto reduzido: [${afterReduce.join(', ')}] contra o original ${maxOriginalBudget}`,
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: pressão considera a fase esgotada, não só o total', async () => {
  const baseDir = tmpDir();
  // Complexidade alta reparte 60% para `execution` e 30% para `recovery`:
  // esgotar a execução deixa o TOTAL em ~54%, abaixo do limiar de 0.6. Se a
  // pressão olhasse só o total, a escada nunca começaria.
  const plan = new Commander().plan({
    objective: 'Construa um SaaS completo com frontend Next.js, API backend, banco Postgres com migrations, auditoria OWASP e pipeline de deploy',
    mode: 'autonomous',
  });
  let first = true;
  let observedTotalRatio = 1;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: async (node: GraphNode, ctx: ExecuteCtx) => {
      let tokens = 1;
      if (first) {
        first = false;
        tokens = Math.floor(ctx.budget.allocation.execution * 0.9);
        observedTotalRatio = tokens / plan.graph.budget.maxTokens;
      }
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw', tokens };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  const result = await orchestrator.run();
  assert.ok(observedTotalRatio < 0.6, `o teste só vale com o total abaixo do limiar: ${observedTotalRatio.toFixed(2)}`);
  assert.ok(
    (result.telemetry?.degradationsApplied ?? []).length >= 1,
    `fase quase esgotada precisa acionar a escada mesmo com o total em ${(observedTotalRatio * 100).toFixed(0)}%`,
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('runtime: degradação downgrade-model rebaixa o papel de fato', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Auditar a segurança OWASP da API de pagamentos e propor remediação com testes',
    mode: 'orchestrated',
  });
  const roles: string[] = [];
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    routeRole: (role) => ({ model: `modelo-${role}`, provider: 'fake' }),
    produce: async (node: GraphNode, ctx: ExecuteCtx) => {
      roles.push(ctx.nodeRole ?? 'desconhecido');
      return {
        content: validContentFor(node.outputs?.[0]),
        kind: node.outputs?.[0] ?? 'raw',
        // Gasto que passa do limiar de pressão logo na primeira tarefa.
        tokens: Math.floor(plan.graph.budget.maxTokens * 0.34),
      };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));

  const result = await orchestrator.run();
  const applied = result.telemetry?.degradationsApplied ?? [];
  assert.ok(applied.length >= 1, 'a escada deveria ter começado sob esse gasto');
  if (applied.includes('downgrade-model')) {
    assert.ok(roles.includes('worker'), `com downgrade aplicado, algum nó deveria virar worker: ${roles.join(', ')}`);
  }
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('router: demoteRole é o inverso de escalateRole e para no piso', () => {
  assert.equal(ModelRouter.demoteRole('commander'), 'specialist');
  assert.equal(ModelRouter.demoteRole('specialist'), 'worker');
  assert.equal(ModelRouter.demoteRole('worker'), null);
  assert.equal(ModelRouter.escalateRole(ModelRouter.demoteRole('commander')!), 'commander');
});

test('runtime: concorrência default é aplicada quando nada é configurado', async () => {
  const baseDir = tmpDir();
  const plan = new Commander().plan({
    objective: 'Construa um SaaS completo com frontend Next.js, API backend, banco Postgres com migrations, auditoria OWASP e pipeline de deploy',
    mode: 'autonomous',
  });
  let inFlight = 0;
  let peak = 0;
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: async (node: GraphNode) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await defer(8);
      inFlight--;
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  await orchestrator.run();
  assert.ok(peak <= DEFAULT_MAX_CONCURRENCY, `pico ${peak} acima do default ${DEFAULT_MAX_CONCURRENCY}`);
  fs.rmSync(baseDir, { recursive: true, force: true });
});
