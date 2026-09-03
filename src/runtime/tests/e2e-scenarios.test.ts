/**
 * Cenários de ponta a ponta: o runtime inteiro, do objetivo ao veredito.
 *
 * Os outros arquivos testam peças. Este testa o comportamento OBSERVÁVEL de um
 * run completo em cada um dos dez cenários que a arquitetura precisa cobrir:
 * trivial, médio, complexo, paralelo, falha, retentativa, escalada, estouro de
 * orçamento, parada antecipada e aprovação humana.
 *
 * Cada teste passa pelo Commander de verdade (classificação, modo, contratos) e
 * pelo Orchestrator de verdade (grafo, verificação, healing, orçamento). O que
 * é injetado é só o producer — o lugar onde estaria o modelo. Substituir
 * qualquer outra peça faria o teste medir a substituição em vez do runtime.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Commander } from '../orchestration/commander.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { Orchestrator } from '../orchestrator.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import { ApprovalStore } from '../recovery/approvals.js';
import { createHeadlessProducer } from '../execute.js';
import { attachContract, contractOf, type AgentRole, type TaskContract } from '../contracts/task-contract.js';
import type { ExecuteCtx, OrchestratorOptions } from '../orchestrator.js';
import type { GraphNode } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-e2e-'));
}

/**
 * Run completo com o producer que o teste escolher. Sem `produce`, usa o mesmo
 * producer headless do `izanagi run` sem API key — que deriva o artefato do
 * schema real de cada kind, então a verificação exercitada é a de verdade.
 */
async function runScenario(opts: {
  objective: string;
  baseDir: string;
  mode?: Parameters<Commander['plan']>[0]['mode'];
  maxTokens?: number;
  produce?: OrchestratorOptions['produce'];
  budgetLimits?: OrchestratorOptions['budgetLimits'];
  routeRole?: OrchestratorOptions['routeRole'];
  mutatePlan?: (nodes: GraphNode[]) => GraphNode[];
  approvals?: ApprovalStore;
}) {
  const plan = new Commander().plan({
    objective: opts.objective,
    ...(opts.mode ? { mode: opts.mode } : {}),
    ...(opts.maxTokens !== undefined ? { maxTokens: opts.maxTokens } : {}),
  });
  if (opts.mutatePlan) {
    // Reconstrói o grafo em vez de trocar `nodes` no lugar: `order` e
    // `parallelBatches` são calculados por `build()`, e mexer só na lista de
    // nós deixa os dois desatualizados — o nó novo simplesmente nunca entra
    // num batch e nunca executa. O primeiro rascunho deste teste passou por
    // isso e ficou verde medindo um grafo que não tinha o nó em questão.
    plan.graph = new ExecutionGraphBuilder().build({
      id: plan.graph.id,
      task: plan.graph.task,
      nodes: opts.mutatePlan(plan.graph.nodes),
      budget: plan.graph.budget,
    });
  }
  const orchestrator = new Orchestrator({
    baseDir: opts.baseDir,
    workspaceDir: opts.baseDir,
    command: 'test',
    task: opts.objective,
    category: plan.classification.category,
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: opts.produce ?? createHeadlessProducer(opts.objective),
    ...(opts.budgetLimits ? { budgetLimits: opts.budgetLimits } : {}),
    ...(opts.routeRole ? { routeRole: opts.routeRole } : {}),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: opts.baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir: opts.baseDir }));
  if (opts.approvals) orchestrator.setApprovalStore(opts.approvals);
  return { plan, result: await orchestrator.run() };
}

/* ============================ 1. trivial ============================ */

test('e2e 1 — trivial: uma chamada, sem grafo, sem crítico, sem avaliador', async () => {
  const baseDir = tmpDir();
  let calls = 0;
  const { plan, result } = await runScenario({
    objective: 'converta 10 dolares para reais',
    baseDir,
    produce: (node) => {
      calls++;
      return { content: 'R$ 54,20 na cotacao de hoje.', kind: node.outputs?.[0] ?? 'raw', tokens: 40 };
    },
  });

  assert.equal(plan.mode, 'direct', 'tarefa trivial não pode virar grafo de 3 a 9 nós');
  assert.equal(plan.graph.nodes.length, 1);
  assert.equal(calls, 1, 'uma chamada de modelo, e só');
  assert.equal(result.status, 'PASS');
  assert.equal(plan.contracts[0].role, 'worker', 'resposta curta é trabalho de worker, não de commander');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 2. média ============================ */

test('e2e 2 — média: um especialista executa e a verificação determinística fecha', async () => {
  const baseDir = tmpDir();
  const { plan, result } = await runScenario({ objective: 'criar um endpoint REST de listagem de pedidos', baseDir, mode: 'assisted' });

  assert.equal(plan.mode, 'assisted');
  assert.deepEqual(plan.graph.nodes.map((n) => n.id), ['execute', 'verify']);
  assert.equal(plan.contracts.find((c) => c.id === 'execute')?.role, 'specialist');
  assert.equal(result.status, 'PASS');
  assert.ok((result.verification ?? []).every((v) => v.result.status === 'VERIFIED'));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 3. complexa ============================ */

test('e2e 3 — complexa: grafo completo, cada nó com contrato e veredito próprio', async () => {
  const baseDir = tmpDir();
  const { plan, result } = await runScenario({ objective: 'auditar a seguranca da API de pagamentos', baseDir, mode: 'autonomous' });

  assert.ok(plan.graph.nodes.length >= 4, 'problema composto merece grafo');
  assert.equal(plan.contracts.length, plan.graph.nodes.length, 'todo nó tem contrato');
  assert.deepEqual(plan.issues, [], 'nenhum contrato malformado');
  assert.equal(result.status, 'PASS');
  // Todo nó que EXECUTOU tem veredito próprio. Nó dispensado por early
  // stopping não tem o que verificar, e exigir veredito dele confundiria
  // "não rodou" com "rodou sem ser conferido".
  const executados = result.graph.nodes.filter((n) => n.status === 'succeeded' || n.status === 'failed');
  const comVeredito = new Set((result.verification ?? []).map((v) => v.nodeId));
  assert.ok(executados.length >= 4);
  for (const n of executados) {
    assert.ok(comVeredito.has(n.id), `nó "${n.id}" executou sem veredito de verificação`);
  }
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 4. paralela ============================ */

test('e2e 4 — paralela: nós independentes rodam de fato ao mesmo tempo', async () => {
  const baseDir = tmpDir();
  let running = 0;
  let peak = 0;
  const headless = createHeadlessProducer('projetar a arquitetura de um SaaS de analytics do zero');

  const { plan, result } = await runScenario({
    objective: 'projetar a arquitetura de um SaaS de analytics do zero',
    baseDir,
    mode: 'autonomous',
    produce: async (node, ctx: ExecuteCtx) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 15));
      running--;
      return headless(node, ctx);
    },
  });

  const widest = Math.max(...plan.graph.parallelBatches.map((b) => b.length));
  assert.ok(widest >= 2, `o template precisa ter batch paralelo (maior batch: ${widest})`);
  assert.ok(peak >= 2, `nós independentes precisam rodar juntos (pico observado: ${peak})`);
  assert.equal(result.status, 'PASS');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 5. falha ============================ */

test('e2e 5 — falha: o run reporta FAIL e a causa fica registrada, sem sucesso silencioso', async () => {
  const baseDir = tmpDir();
  const { result } = await runScenario({
    objective: 'auditar a seguranca da API de pagamentos',
    baseDir,
    mode: 'orchestrated',
    produce: () => {
      throw new Error('provider indisponivel: connection refused');
    },
  });

  assert.ok(['FAIL', 'BLOCKED'].includes(result.status), `veredito foi ${result.status}`);
  assert.ok(result.healing.length > 0, 'falha sem healing registrado é falha sem diagnóstico');
  assert.ok(
    (result.evaluation?.regressions ?? []).some((r) => r.includes('terminou em falha')),
    'nó falho precisa aparecer na avaliação: era exatamente o que passava despercebido',
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 6. retentativa ============================ */

test('e2e 6 — retentativa: falha transitória é curada e o run termina PASS', async () => {
  const baseDir = tmpDir();
  const objective = 'auditar a seguranca da API de pagamentos';
  const headless = createHeadlessProducer(objective);
  let failedOnce = false;

  const { result } = await runScenario({
    objective,
    baseDir,
    mode: 'orchestrated',
    produce: (node, ctx: ExecuteCtx) => {
      if (node.id === 'scan' && !failedOnce) {
        failedOnce = true;
        throw new Error('request timed out');
      }
      return headless(node, ctx);
    },
  });

  assert.equal(failedOnce, true, 'a falha precisa ter acontecido para o teste significar algo');
  assert.equal(result.status, 'PASS');
  assert.equal(result.graph.nodes.find((n) => n.id === 'scan')?.status, 'succeeded');
  assert.ok(result.healing.length > 0);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 7. escalada ============================ */

test('e2e 7 — escalada: a retentativa sobe o papel em vez de repetir o modelo que falhou', async () => {
  const baseDir = tmpDir();
  const objective = 'auditar a seguranca da API de pagamentos';
  const headless = createHeadlessProducer(objective);
  const rolesSeen: AgentRole[] = [];
  let failedOnce = false;

  const { result } = await runScenario({
    objective,
    baseDir,
    mode: 'orchestrated',
    routeRole: (role: AgentRole) => {
      rolesSeen.push(role);
      return { model: `modelo-${role}`, provider: 'teste' };
    },
    produce: (node, ctx: ExecuteCtx) => {
      if (node.id === 'scan' && !failedOnce) {
        failedOnce = true;
        throw new Error('request timed out');
      }
      return headless(node, ctx);
    },
  });

  assert.equal(failedOnce, true);
  assert.ok(rolesSeen.includes('commander'), `a escalada precisa alcançar um papel acima (vistos: ${rolesSeen.join(', ')})`);
  assert.ok(
    result.trace.spans.some((s) => s.name.startsWith('escalation:')),
    'escalada sem span é escalada que ninguém consegue auditar',
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 8. estouro de orçamento ============================ */

test('e2e 8 — orçamento: o teto para a execução, e o run diz que parou por isso', async () => {
  const baseDir = tmpDir();
  const { result } = await runScenario({
    objective: 'auditar a seguranca da API de pagamentos',
    baseDir,
    mode: 'orchestrated',
    // Teto ridículo de propósito: o primeiro nó já estoura.
    budgetLimits: { maxTokens: 50 },
    produce: (node) => ({ content: 'x'.repeat(400), kind: node.outputs?.[0] ?? 'raw', tokens: 5000 }),
  });

  assert.notEqual(result.status, 'PASS', 'nunca ultrapassar o orçamento em silêncio');
  const gastos = result.telemetry?.totalTokens ?? 0;
  assert.ok(gastos <= 5000 * 3, `o Budget Controller precisa cortar cedo (gastou ${gastos})`);
  assert.ok(
    result.graph.nodes.some((n) => n.status === 'failed' && /orçamento|budget|teto/i.test(n.error ?? '')),
    'o motivo da parada precisa estar no nó, não só no total',
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 9. parada antecipada ============================ */

test('e2e 9 — early stopping: tarefa opcional é dispensada quando o obrigatório já está VERIFIED', async () => {
  const baseDir = tmpDir();
  const objective = 'auditar a seguranca da API de pagamentos';
  const executed: string[] = [];
  const headless = createHeadlessProducer(objective);

  const { plan, result } = await runScenario({
    objective,
    baseDir,
    mode: 'autonomous',
    produce: (node, ctx: ExecuteCtx) => {
      executed.push(node.id);
      return headless(node, ctx);
    },
  });

  const opcionais = plan.contracts.filter((c) => c.optional).map((c) => c.id);
  assert.ok(opcionais.length > 0, 'o modo autonomous precisa ter tarefa opcional para o cenário existir');
  const dispensados = plan.graph.nodes.filter((n) => n.status === 'skipped').map((n) => n.id);
  const pulados = result.graph.nodes.filter((n) => n.status === 'skipped').map((n) => n.id);
  assert.ok(
    pulados.length > 0 || dispensados.length > 0,
    `nenhuma tarefa opcional foi dispensada (opcionais: ${opcionais.join(', ')}, executados: ${executed.join(', ')})`,
  );
  for (const id of pulados) assert.equal(executed.includes(id), false, `"${id}" foi pulado e mesmo assim executado`);
  assert.equal(result.status, 'PASS');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ 10. aprovação humana ============================ */

test('e2e 10 — aprovação humana: o run PAUSA (BLOCKED), não falha, e diz onde parou', async () => {
  const baseDir = tmpDir();
  const approvals = new ApprovalStore({ baseDir });
  const objective = 'auditar a seguranca da API de pagamentos';
  const headless = createHeadlessProducer(objective);

  const { result } = await runScenario({
    objective,
    baseDir,
    mode: 'orchestrated',
    approvals,
    // Um nó de aprovação no meio do grafo: é assim que o human-in-the-loop
    // entra num plano real (gate de risco, deploy, mudança destrutiva).
    mutatePlan: (nodes) => {
      const gate: GraphNode = {
        id: 'aprovacao-humana',
        kind: 'approval',
        outputs: ['raw'],
        dependencies: [nodes[0].id],
        status: 'pending',
        tokenBudget: 0,
      };
      const contract: TaskContract = {
        ...(contractOf(nodes[0]) as TaskContract),
        id: gate.id,
        objective: 'confirmar antes de seguir com a auditoria',
        inputs: [nodes[0].id],
        dependencies: [nodes[0].id],
        expectedOutput: { kind: 'raw' },
        budget: { maxTokens: 0 },
      };
      const rest = nodes.slice(1).map((n) =>
        (n.dependencies ?? []).includes(nodes[0].id)
          ? { ...n, dependencies: [gate.id, ...(n.dependencies ?? []).filter((d) => d !== nodes[0].id)] }
          : n,
      );
      return [nodes[0], attachContract(gate, contract), ...rest];
    },
    produce: headless,
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.pendingApproval?.nodeId, 'aprovacao-humana');
  assert.ok(approvals.pendingFor(result.trace.runId), 'a pendência precisa sobreviver ao fim do processo');
  assert.ok(result.telemetry, 'quem aprova decide no escuro sem saber quanto já foi gasto');
  fs.rmSync(baseDir, { recursive: true, force: true });
});
