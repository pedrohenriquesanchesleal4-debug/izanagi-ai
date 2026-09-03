/**
 * Sub-orquestração: a tarefa que descobre, executando, ser maior do que o
 * planejamento previu.
 *
 * O risco desta feature não é ela não funcionar — é ela funcionar demais.
 * Agente decompondo à vontade é a colmeia que a arquitetura proíbe, com custo
 * exponencial. Metade destes testes existe para provar os LIMITES: orçamento
 * dividido e não multiplicado, profundidade com teto do runtime, pedido
 * malformado recusado, e decomposição só onde o contrato permite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator, type ExecuteCtx } from '../orchestrator.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { ContextResolver } from '../orchestration/context-resolver.js';
import { buildSubgraph, parseDecomposition, aggregateSubgraph, MAX_SUBTASKS } from '../orchestration/subgraph.js';
import { attachContract, contractOf, type TaskContract } from '../contracts/task-contract.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import type { CommanderPlan } from '../orchestration/commander.js';
import type { GraphNode } from '../types.js';

const OBJECTIVE = 'auditar a seguranca do sistema inteiro';
const LONGO = 'Conteudo real e completo produzido pela sub-tarefa, com detalhe suficiente. '.repeat(4);

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-sub-'));
}

function pedido(tasks: Array<{ id: string; objective: string; dependencies?: string[] }>, reason = 'tres frentes independentes'): string {
  return JSON.stringify({ reason, decompose: tasks });
}

function contractFor(id: string, decomposable: boolean): TaskContract {
  return {
    id,
    objective: `${id}: ${OBJECTIVE}`,
    role: 'commander',
    agent: 'security',
    inputs: [],
    constraints: ['zero stubs'],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 3000 },
    verification: { deterministic: [{ kind: 'artifact-valid' }] },
    acceptance: [{ id: `${id}:valid`, description: 'artefato valido', kind: 'deterministic', check: { kind: 'artifact-valid' } }],
    ...(decomposable ? { decomposable: true } : {}),
  };
}

function planWith(decomposable: boolean): CommanderPlan {
  const node: GraphNode = {
    id: 'auditoria',
    kind: 'agent',
    agent: 'security',
    outputs: ['raw'],
    dependencies: [],
    status: 'pending',
    tokenBudget: 3000,
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 2, backoffMs: 0 },
  };
  const contract = contractFor('auditoria', decomposable);
  const graph = new ExecutionGraphBuilder().build({
    task: OBJECTIVE,
    nodes: [attachContract(node, contract)],
    budget: { maxAttempts: 2, maxTokens: 40_000, maxTimeMs: 300_000 },
  });
  return {
    runObjective: OBJECTIVE,
    mode: 'autonomous',
    modeReason: 'teste',
    classification: { complexity: 4, domains: ['security'], category: 'security_audit', reasoning: 'high', risk: 0.8, reasons: [] },
    graph,
    contracts: [contract],
    estimate: {
      nodes: 1,
      parallelStages: 1,
      maxTokens: 3000,
      byRole: { commander: { tasks: 1, tokens: 3000 }, specialist: { tasks: 0, tokens: 0 }, worker: { tasks: 0, tokens: 0 } },
    },
    decisions: [],
    issues: [],
  };
}

interface Visto {
  node: string;
  budget?: number;
  decomposable?: boolean;
  objective?: string;
}

async function rodar(opts: { decomposable: boolean; respostas: (node: GraphNode, n: number) => string; maxDepth?: number }) {
  const baseDir = tmpDir();
  const vistos: Visto[] = [];
  const contagem = new Map<string, number>();
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: OBJECTIVE,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan: planWith(opts.decomposable),
    ...(opts.maxDepth !== undefined ? { maxOrchestrationDepth: opts.maxDepth } : {}),
    produce: (node: GraphNode, ctx: ExecuteCtx) => {
      const n = (contagem.get(node.id) ?? 0) + 1;
      contagem.set(node.id, n);
      vistos.push({
        node: node.id,
        ...(node.tokenBudget !== undefined ? { budget: node.tokenBudget } : {}),
        ...(ctx.nodeContext?.decomposable !== undefined ? { decomposable: ctx.nodeContext.decomposable } : {}),
        ...(ctx.nodeContext?.objective ? { objective: ctx.nodeContext.objective } : {}),
      });
      return { content: opts.respostas(node, n), kind: node.outputs?.[0] ?? 'raw', tokens: 100 };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));
  const result = await orchestrator.run();
  fs.rmSync(baseDir, { recursive: true, force: true });
  return { result, vistos };
}

const TRES_FRENTES = [
  { id: 'deps', objective: 'auditar dependencias' },
  { id: 'authz', objective: 'auditar autorizacao' },
  { id: 'relatorio', objective: 'consolidar achados', dependencies: ['deps', 'authz'] },
];

/* ============================ parsing ============================ */

test('subgraph: pedido de decomposição é extraído mesmo embrulhado em prosa', () => {
  const req = parseDecomposition(`Analisei e concluí o seguinte.\n\`\`\`json\n${pedido(TRES_FRENTES)}\n\`\`\``);
  assert.ok(req);
  assert.equal(req!.tasks.length, 3);
  assert.equal(req!.reason, 'tres frentes independentes');
});

test('subgraph: saída normal não é confundida com pedido de decomposição', () => {
  assert.equal(parseDecomposition('relatório de auditoria com achados e remediação'), null);
  assert.equal(parseDecomposition('{"achados": ["x"], "severidade": "alta"}'), null);
  assert.equal(parseDecomposition('{"decompose": []}'), null);
});

test('subgraph: o teto de largura corta o excesso em vez de aceitar', () => {
  const muitas = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, objective: `tarefa ${i}` }));
  const req = parseDecomposition(pedido(muitas))!;
  assert.equal(req.tasks.length, MAX_SUBTASKS);
});

/* ============================ construção do subgrafo ============================ */

test('subgraph: o orçamento do pai é DIVIDIDO entre os filhos, nunca multiplicado', () => {
  const pai: GraphNode = { id: 'auditoria', kind: 'agent', status: 'pending', tokenBudget: 3000, outputs: ['raw'] };
  const built = buildSubgraph(attachContract(pai, contractFor('auditoria', true)), parseDecomposition(pedido(TRES_FRENTES))!, { depth: 0, maxDepth: 2 });
  assert.deepEqual(built.issues, []);
  const total = built.graph.nodes.reduce((a, n) => a + (n.tokenBudget ?? 0), 0);
  assert.ok(total <= 3000, `filhos somam ${total}, o pai tinha 3000: decompor não pode liberar orçamento`);
  for (const n of built.graph.nodes) assert.equal(n.tokenBudget, 1000);
});

test('subgraph: ids são prefixados pelo pai e as dependências acompanham', () => {
  const pai: GraphNode = { id: 'auditoria', kind: 'agent', status: 'pending', tokenBudget: 3000, outputs: ['raw'] };
  const built = buildSubgraph(attachContract(pai, contractFor('auditoria', true)), parseDecomposition(pedido(TRES_FRENTES))!, { depth: 0, maxDepth: 2 });
  assert.deepEqual(built.taskIds, ['auditoria/deps', 'auditoria/authz', 'auditoria/relatorio']);
  const relatorio = built.graph.nodes.find((n) => n.id === 'auditoria/relatorio')!;
  assert.deepEqual(relatorio.dependencies, ['auditoria/deps', 'auditoria/authz']);
  assert.ok(built.graph.order.indexOf('auditoria/deps') < built.graph.order.indexOf('auditoria/relatorio'));
});

test('subgraph: sub-tarefa nasce sem permissão de se decompor de novo', () => {
  const pai: GraphNode = { id: 'auditoria', kind: 'agent', status: 'pending', tokenBudget: 3000, outputs: ['raw'] };
  const built = buildSubgraph(attachContract(pai, contractFor('auditoria', true)), parseDecomposition(pedido(TRES_FRENTES))!, { depth: 0, maxDepth: 2 });
  for (const n of built.graph.nodes) {
    assert.equal(contractOf(n)?.decomposable, false, `"${n.id}" herdou permissão de decompor`);
  }
});

test('subgraph: profundidade máxima recusa o pedido em vez de aprofundar', () => {
  const pai: GraphNode = { id: 'auditoria', kind: 'agent', status: 'pending', tokenBudget: 3000, outputs: ['raw'] };
  const built = buildSubgraph(pai, parseDecomposition(pedido(TRES_FRENTES))!, { depth: 2, maxDepth: 2 });
  assert.equal(built.taskIds.length, 0);
  assert.match(built.issues[0], /profundidade máxima/);
});

test('subgraph: pedido malformado é recusado inteiro, não parcialmente', () => {
  const pai: GraphNode = { id: 'auditoria', kind: 'agent', status: 'pending', tokenBudget: 3000, outputs: ['raw'] };
  const invalido = parseDecomposition(pedido([
    { id: 'ok', objective: 'auditar dependencias' },
    { id: 'ruim', objective: 'x', dependencies: ['nao-existe'] },
  ]))!;
  const built = buildSubgraph(pai, invalido, { depth: 0, maxDepth: 2 });
  assert.equal(built.taskIds.length, 0);
  assert.ok(built.issues.some((i) => /não existe/.test(i)));
});

test('subgraph: a agregação diz quais sub-tarefas não entregaram', () => {
  const artifacts = new Map([['pai/a', { kind: 'raw', content: 'entrega A', valid: true }]]);
  const agg = aggregateSubgraph('pai', ['pai/a', 'pai/b'], artifacts);
  assert.equal(agg.produced, 1);
  assert.deepEqual(agg.missing, ['pai/b']);
  assert.ok(agg.content.includes('entrega A'));
  assert.ok(agg.content.includes('pai/b'), 'a ausência precisa aparecer, não sumir');
});

/* ============================ execução ============================ */

test('subgraph: nó decomponível abre o subgrafo e entrega a agregação dos filhos', async () => {
  const { result, vistos } = await rodar({
    decomposable: true,
    respostas: (node) => (node.id === 'auditoria' ? pedido(TRES_FRENTES) : `${LONGO} [${node.id}]`),
  });

  const executados = vistos.map((v) => v.node);
  assert.ok(executados.includes('auditoria/deps'));
  assert.ok(executados.includes('auditoria/relatorio'));
  assert.equal(result.status, 'PASS');

  // O artefato do pai é a agregação, não o pedido de decomposição.
  const trace = result.trace;
  assert.ok(trace.spans.some((s) => s.name === 'subgraph:auditoria'));
  assert.ok(trace.spans.some((s) => s.name === 'subgraph:done:auditoria'));
});

test('subgraph: o orçamento chega dividido nos filhos em execução', async () => {
  const { vistos } = await rodar({
    decomposable: true,
    respostas: (node) => (node.id === 'auditoria' ? pedido(TRES_FRENTES) : LONGO),
  });
  const pai = vistos.find((v) => v.node === 'auditoria')!;
  const filhos = vistos.filter((v) => v.node.startsWith('auditoria/'));
  assert.equal(pai.budget, 3000);
  assert.equal(filhos.length, 3);
  for (const f of filhos) assert.equal(f.budget, 1000);
});

test('subgraph: o protocolo de decomposição só é oferecido a quem pode usá-lo', async () => {
  const comPermissao = await rodar({ decomposable: true, respostas: () => LONGO });
  assert.equal(comPermissao.vistos[0].decomposable, true);

  const semPermissao = await rodar({ decomposable: false, respostas: () => LONGO });
  assert.equal(semPermissao.vistos[0].decomposable, undefined);
});

test('subgraph: nó sem permissão que responde com "decompose" entrega isso como conteúdo', async () => {
  const { result, vistos } = await rodar({
    decomposable: false,
    respostas: () => pedido(TRES_FRENTES),
  });
  assert.deepEqual(vistos.map((v) => v.node), ['auditoria'], 'nenhum subgrafo podia ter sido aberto');
  assert.ok(!result.trace.spans.some((s) => s.name.startsWith('subgraph:')));
});

test('subgraph: profundidade esgotada recusa e o nó tem que entregar', async () => {
  const { result, vistos } = await rodar({
    decomposable: true,
    maxDepth: 0,
    respostas: () => pedido(TRES_FRENTES),
  });
  assert.deepEqual(vistos.map((v) => v.node), ['auditoria']);
  assert.equal(vistos[0].decomposable, undefined, 'não se oferece no prompt o que o runtime vai recusar');
  assert.ok(!result.trace.spans.some((s) => s.name === 'subgraph:auditoria'));
});

test('subgraph: falha de sub-tarefa é falha de quem pediu a decomposição', async () => {
  const { result } = await rodar({
    decomposable: true,
    respostas: (node) => {
      if (node.id === 'auditoria') return pedido(TRES_FRENTES);
      // Conteúdo que reprova no validador: stub declarado é exatamente o que
      // o schema proíbe, então a sub-tarefa falha de verdade.
      if (node.id === 'auditoria/authz') return 'TODO: auditar autorizacao depois';
      return LONGO;
    },
  });
  assert.notEqual(result.status, 'PASS');
  assert.ok(result.trace.spans.some((s) => s.name === 'subgraph:failed:auditoria'));
});

test('subgraph: a decomposição aparece na conversa entre agentes', async () => {
  const { result } = await rodar({
    decomposable: true,
    respostas: (node) => (node.id === 'auditoria' ? pedido(TRES_FRENTES) : LONGO),
  });
  const pedidoMsg = (result.conversation ?? []).find((m) => m.type === 'request' && /decomposição/.test(m.summary));
  assert.ok(pedidoMsg, 'pedir decomposição é uma mensagem do agente para o commander');
  assert.match(pedidoMsg!.summary, /3 sub-tarefa/);
});

test('subgraph: o protocolo entra no prompt com os limites explícitos', () => {
  const resolver = new ContextResolver();
  const ctx = resolver.resolve(contractFor('auditoria', true), new Map(), { decomposable: true });
  const rendered = resolver.render(ctx);
  assert.ok(rendered.includes('SE A TAREFA NÃO COUBER'));
  assert.ok(rendered.includes('máximo 5 sub-tarefas'));
  assert.ok(rendered.includes('DIVIDIDO'), 'o agente precisa saber que decompor não libera orçamento');
});

/** Nó pai com contrato, para os testes de orçamento e privilégio. */
function parentNode(opts: { tokenBudget: number; permissions?: TaskContract['permissions'] }): GraphNode {
  const node: GraphNode = { id: 'auditoria', kind: 'agent', status: 'pending', tokenBudget: opts.tokenBudget, outputs: ['raw'] };
  return attachContract(node, {
    ...contractFor('auditoria', true),
    budget: { maxTokens: opts.tokenBudget },
    ...(opts.permissions ? { permissions: opts.permissions } : {}),
  });
}

test('subgrafo: decompor NÃO multiplica o orçamento do pai', () => {
  // Com 2000 tokens e 5 sub-tarefas, o piso de 512 dava 512 a cada uma e o
  // subgrafo saía com 2560 — decompor virava a forma de AUMENTAR o orçamento,
  // o incentivo exato que a regra existe para eliminar.
  const built = buildSubgraph(
    parentNode({ tokenBudget: 2000 }),
    { reason: 'quebrar em partes', tasks: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, objective: `parte ${i}` })) },
    { depth: 0, maxDepth: 2 },
  );

  const somaDosFilhos = built.graph.nodes.reduce((acc, n) => acc + (n.tokenBudget ?? 0), 0);
  assert.ok(
    somaDosFilhos <= 2000,
    `sub-tarefas somam ${somaDosFilhos} tokens de um pai com 2000: decompor não pode liberar orçamento`,
  );
  assert.equal(built.graph.nodes.length, 3, 'a largura é cortada pelo que o pai paga no piso, não pelo que o agente pediu');
  assert.match(built.issues.join(' '), /cortada de 5 para 3/, 'o corte precisa ser dito, não silencioso');
});

test('subgrafo: orçamento que não paga duas sub-tarefas recusa a decomposição inteira', () => {
  const built = buildSubgraph(
    parentNode({ tokenBudget: 600 }),
    { reason: 'quebrar', tasks: [{ id: 'a', objective: 'parte a' }, { id: 'b', objective: 'parte b' }] },
    { depth: 0, maxDepth: 2 },
  );
  assert.deepEqual(built.taskIds, []);
  assert.match(built.issues.join(' '), /não paga duas sub-tarefas/);
});

test('subgrafo: sub-tarefa não herda permissão do pai', () => {
  const parent = parentNode({ tokenBudget: 8000, permissions: ['fs:write'] });
  const built = buildSubgraph(
    parent,
    { reason: 'quebrar', tasks: [{ id: 'a', objective: 'parte a' }, { id: 'b', objective: 'parte b' }] },
    { depth: 0, maxDepth: 2 },
  );
  for (const node of built.graph.nodes) {
    assert.deepEqual(contractOf(node)?.permissions, [], `"${node.id}" herdou privilégio que ninguém concedeu a ele`);
  }
});
