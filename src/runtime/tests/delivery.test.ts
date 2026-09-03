/**
 * Entrega: o run grava o que produziu, e a verificação confere o que gravou.
 *
 * Este é o primeiro nó `kind: 'tool'` que o PLANEJAMENTO gera em produção. O
 * que estes testes protegem não é a conveniência de ter um arquivo no fim: é
 * que o critério `file-exists` do contrato passe a significar "o runtime
 * gravou isto" em vez de "existe um arquivo com esse nome por algum motivo".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Commander } from '../orchestration/commander.js';
import {
  DELIVER_NODE_ID,
  MAX_DOCUMENT_CHARS,
  buildDeliverable,
  deliverNode,
  deliverableRelPath,
  slugify,
  validateOutputDir,
} from '../orchestration/delivery.js';
import { hasRefMarker, resolveToolInput } from '../tools/input-refs.js';
import { Orchestrator } from '../orchestrator.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import { contractOf } from '../contracts/task-contract.js';
import { validateArtifact } from '../contracts/artifacts.js';
import { createHeadlessProducer } from '../execute.js';
import { ApprovalStore } from '../recovery/approvals.js';
import { CheckpointStore } from '../recovery/checkpoint.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { attachContract, type TaskContract } from '../contracts/task-contract.js';
import type { GraphNode } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-deliver-'));
}

/* ============================ marcadores de input ============================ */

const resolution = {
  artifact: (nodeId: string) => {
    if (nodeId !== 'arch') throw new Error(`artefato de "${nodeId}" não existe no run`);
    return 'conteúdo da arquitetura';
  },
  deliverable: () => 'DOCUMENTO COMPLETO',
};

test('input-refs: $artifact vira o conteúdo do nó, preservando a forma do input', () => {
  const out = resolveToolInput('fs.write', { file: 'out/a.md', content: { $artifact: 'arch' } }, resolution);
  assert.deepEqual(out, { file: 'out/a.md', content: 'conteúdo da arquitetura' });
});

test('input-refs: $deliverable vira o documento único do run', () => {
  const out = resolveToolInput('fs.write', { file: 'x.md', content: { $deliverable: true } }, resolution);
  assert.deepEqual(out, { file: 'x.md', content: 'DOCUMENTO COMPLETO' });
});

test('input-refs: referência a nó inexistente é erro, nunca string vazia', () => {
  assert.throws(
    () => resolveToolInput('fs.write', { file: 'x.md', content: { $artifact: 'fantasma' } }, resolution),
    /fantasma/,
    'gravar arquivo vazio e chamar isso de entrega é a falha silenciosa que a verificação existe para impedir',
  );
});

test('input-refs: input sem marcador volta idêntico', () => {
  const input = { file: 'x.md', content: 'texto literal', nested: [1, { a: true }] };
  assert.deepEqual(resolveToolInput('fs.write', input, resolution), input);
});

test('input-refs: objeto com chave extra não é marcador (nada de $artifact disfarçado)', () => {
  const input = { content: { $artifact: 'arch', extra: 1 } };
  const out = resolveToolInput('fs.write', input, resolution) as { content: Record<string, unknown> };
  assert.equal(out.content.$artifact, 'arch', 'não é marcador: passa como dado comum');
});

test('input-refs: code.execute recusa marcador — substituir saída de modelo em código executado é injeção', () => {
  assert.throws(
    () => resolveToolInput('code.execute', { code: { $artifact: 'arch' } }, resolution),
    /injeção/i,
  );
  // E também num campo qualquer, não só em `code`: a regra é por tool.
  assert.throws(() => resolveToolInput('code.execute', { code: 'ok', extra: { $deliverable: true } }, resolution), /injeção/i);
});

test('input-refs: code.execute sem marcador nenhum continua passando intacto', () => {
  const input = { code: 'console.log(1)', timeoutMs: 500 };
  assert.deepEqual(resolveToolInput('code.execute', input, resolution), input);
});

test('input-refs: marcador malformado é recusado em vez de virar dado', () => {
  assert.equal(hasRefMarker({ content: { $deliverable: 'sim' } }), true);
  assert.throws(() => resolveToolInput('fs.write', { content: { $artifact: '   ' } }, resolution), /nomear um nó/);
});

/* ============================ documento entregue ============================ */

test('entrega: separa produto de processo e mantém o inválido visível', () => {
  const doc = buildDeliverable({
    objective: 'auditar a API',
    runId: 'run-1',
    mode: 'orchestrated',
    order: ['scan', 'critic', 'evaluation'],
    artifacts: [
      { nodeId: 'evaluation', kind: 'evaluation', content: { score: 1 }, valid: true },
      { nodeId: 'scan', kind: 'security-report', content: 'achados reais', valid: true },
      { nodeId: 'critic', kind: 'critique', content: '{"status":"approved"}', valid: false },
    ],
  });
  assert.match(doc, /^# auditar a API/);
  assert.match(doc, /run `run-1`/);
  assert.match(doc, /1 artefato\(s\) de produto, 2 de processo/);
  assert.ok(doc.indexOf('## scan') < doc.indexOf('## Processo'), 'produto vem antes de processo');
  assert.match(doc, /artefato inválido contra o schema|\*\*inválido\*\*/, 'artefato reprovado não some do documento');
});

test('entrega: mesma entrada produz exatamente o mesmo documento (sem timestamp)', () => {
  const input = {
    objective: 'x',
    runId: 'r',
    mode: 'assisted',
    order: ['a'],
    artifacts: [{ nodeId: 'a', kind: 'raw', content: 'y', valid: true }],
  };
  assert.equal(buildDeliverable(input), buildDeliverable(input));
});

test('entrega: o documento tem teto total, e o que não coube vira referência', () => {
  const enorme = 'x'.repeat(200 * 1024);
  const doc = buildDeliverable({
    objective: 'run grande',
    runId: 'r',
    mode: 'autonomous',
    order: ['a', 'b', 'c', 'd', 'e', 'f'],
    artifacts: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ nodeId: id, kind: 'raw', content: enorme, valid: true })),
  });
  assert.ok(doc.length < MAX_DOCUMENT_CHARS * 1.2, `documento com ${doc.length} chars: o teto por seção sozinho não limita nada`);
  assert.match(doc, /Conteúdo omitido: o documento atingiu o teto/);
  // Toda seção continua listada: o leitor sabe que o artefato existe.
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) assert.match(doc, new RegExp(`## ${id} `));
});

test('entrega: run sem artefato de produto diz isso, em vez de entregar um documento vazio', () => {
  const doc = buildDeliverable({ objective: 'x', runId: 'r', mode: 'direct', artifacts: [] });
  assert.match(doc, /não produziu artefato de produto/);
});

/* ============================ destino ============================ */

test('destino: caminho fora da raiz do projeto é recusado ANTES de planejar', () => {
  const base = tmpDir();
  const check = validateOutputDir(base, path.join(base, '..', 'fora'));
  assert.equal(check.ok, false);
  assert.match((check as { error: string }).error, /fora do projeto/);
  fs.rmSync(base, { recursive: true, force: true });
});

test('destino: caminho relativo dentro do projeto é aceito e normalizado', () => {
  const base = tmpDir();
  assert.deepEqual(validateOutputDir(base, './docs/entregas/'), { ok: true, rel: 'docs/entregas' });
  fs.rmSync(base, { recursive: true, force: true });
});

test('destino: o nome do arquivo sai do objetivo e é estável entre execuções', () => {
  const a = deliverableRelPath('out', 'Auditar a Segurança da API');
  assert.equal(a, 'out/auditar-a-seguranca-da-api.md');
  assert.equal(a, deliverableRelPath('out', 'Auditar a Segurança da API'), 'repetir o objetivo reescreve a mesma entrega');
  assert.equal(slugify(''), 'entrega', 'objetivo sem caractere utilizável ainda produz nome de arquivo');
  assert.ok(slugify('a'.repeat(200)).length <= 60);
});

/* ============================ contrato do nó ============================ */

test('contrato: o nó de entrega concede fs:write e nada mais', () => {
  const { node, contract } = deliverNode({ outputDir: 'out', objective: 'x', dependencies: ['a', 'b'] });
  assert.equal(node.kind, 'tool');
  assert.equal(node.agent, undefined, 'sem agente: quem declarou a tool foi o framework, então o tier é builtin');
  assert.deepEqual(contract.permissions, ['fs:write']);
  assert.equal(contract.budget.maxTokens, 0, 'nó de tool não chama modelo');
  assert.equal(contract.optional, undefined, 'entrega não é opcional: early stopping não pode dispensá-la');
  assert.deepEqual(node.dependencies, ['a', 'b']);
  const checks = contract.acceptance.map((c) => c.check?.kind);
  assert.ok(checks.includes('file-exists'), 'a verificação confere o arquivo escrito');
  assert.ok(checks.includes('json-field'), 'e o comprovante devolvido pela tool');
});

test('contrato: o comprovante de escrita satisfaz o schema do kind "delivery"', () => {
  const report = validateArtifact('delivery', { written: '/projeto/out/x.md' });
  assert.equal(report.valid, true);
  assert.equal(validateArtifact('delivery', {}).valid, false, 'sem "written" não há comprovante');
});

/* ============================ plano ============================ */

test('plano: sem --output nenhum nó do grafo recebe permissão de escrita', () => {
  const plan = new Commander().plan({ objective: 'auditar a seguranca da API de pagamentos', mode: 'orchestrated' });
  assert.equal(plan.graph.nodes.some((n) => n.id === DELIVER_NODE_ID), false);
  assert.equal(plan.contracts.some((c) => (c.permissions ?? []).length > 0), false);
});

test('plano: com --output a entrega é o último nó e depende de todos os outros', () => {
  const plan = new Commander().plan({
    objective: 'auditar a seguranca da API de pagamentos',
    mode: 'orchestrated',
    output: 'entregas',
  });
  const deliver = plan.graph.nodes.find((n) => n.id === DELIVER_NODE_ID);
  assert.ok(deliver, 'o plano precisa conter o nó de entrega');
  const others = plan.graph.nodes.filter((n) => n.id !== DELIVER_NODE_ID).map((n) => n.id);
  assert.deepEqual([...(deliver!.dependencies ?? [])].sort(), [...others].sort());
  const lastBatch = plan.graph.parallelBatches[plan.graph.parallelBatches.length - 1];
  assert.deepEqual(lastBatch, [DELIVER_NODE_ID]);
  assert.deepEqual(plan.issues, [], 'contrato da entrega precisa ser válido como qualquer outro');

  // Escrita existe SÓ em nó de tool. Este é o invariante que importa: não
  // "um nó escreve", e sim "nenhum agente escreve".
  const withWrite = plan.contracts.filter((c) => (c.permissions ?? []).includes('fs:write'));
  assert.ok(withWrite.length > 0);
  for (const c of withWrite) assert.ok(c.tool, `"${c.id}" tem permissão de escrita sem ser nó de tool`);
  assert.deepEqual(
    plan.contracts.filter((c) => !c.tool && (c.permissions ?? []).length > 0).map((c) => c.id),
    [],
    'nenhum nó de agente pode ter permissão',
  );
});

test('plano: entrega também vale no modo direct — quem pediu --output pediu o arquivo', () => {
  const plan = new Commander().plan({ objective: 'converta 10 dolares para reais', mode: 'direct', output: 'out' });
  assert.ok(plan.graph.nodes.some((n) => n.id === DELIVER_NODE_ID));
});

/* ============================ execução ponta a ponta ============================ */

async function runWithDelivery(opts: { workspace: string; objective: string; output: string }) {
  const plan = new Commander().plan({ objective: opts.objective, mode: 'orchestrated', output: opts.output });
  // Mesmo producer do `izanagi run` sem API key: deriva o artefato do schema
  // real de cada kind. Um producer de teste que devolvesse texto solto
  // reprovaria na validação e o run nem chegaria à entrega — que é justamente
  // o comportamento correto, e não o que estes testes querem exercitar.
  const produce = createHeadlessProducer(opts.objective);
  const orchestrator = new Orchestrator({
    baseDir: opts.workspace,
    workspaceDir: opts.workspace,
    command: 'test',
    task: opts.objective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce,
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: opts.workspace }));
  orchestrator.setStore(new TraceStore({ baseDir: opts.workspace }));
  return { plan, result: await orchestrator.run() };
}

test('execução: o arquivo aparece no disco e o nó de entrega fica VERIFIED', async () => {
  const workspace = tmpDir();
  const { result } = await runWithDelivery({
    workspace,
    objective: 'auditar a seguranca da API',
    output: 'entregas',
  });

  const file = path.join(workspace, deliverableRelPath('entregas', 'auditar a seguranca da API'));
  assert.equal(fs.existsSync(file), true, 'a entrega precisa existir no disco do projeto');
  const content = fs.readFileSync(file, 'utf-8');
  assert.match(content, /^# auditar a seguranca da API/);
  assert.match(content, /## scan · `security-report`/, 'o documento carrega o que os nós produziram');

  const verdict = result.verification?.find((v) => v.nodeId === DELIVER_NODE_ID);
  assert.equal(verdict?.result.status, 'VERIFIED');
  assert.equal(result.trace.spans.some((s) => s.name === 'tool:fs.write'), true);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('execução: destino inexistente é criado; repetir o run reescreve a mesma entrega', async () => {
  const workspace = tmpDir();
  const objective = 'projetar o schema do banco';
  const rel = deliverableRelPath('a/b/c', objective);

  await runWithDelivery({ workspace, objective, output: 'a/b/c' });
  const first = fs.readFileSync(path.join(workspace, rel), 'utf-8');
  await runWithDelivery({ workspace, objective, output: 'a/b/c' });
  const files = fs.readdirSync(path.join(workspace, 'a', 'b', 'c'));

  assert.deepEqual(files.length, 1, 'entrega é produto, não log: não acumula um arquivo por execução');
  assert.equal(fs.readFileSync(path.join(workspace, rel), 'utf-8').length > 0, true);
  assert.ok(first.length > 0);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('execução: a entrega roda depois de todos, então vê o artefato do último nó', async () => {
  const workspace = tmpDir();
  const objective = 'auditar a seguranca da API';
  const { plan } = await runWithDelivery({ workspace, objective, output: 'out' });

  const content = fs.readFileSync(path.join(workspace, deliverableRelPath('out', objective)), 'utf-8');
  for (const node of plan.graph.nodes) {
    if (node.id === DELIVER_NODE_ID) continue;
    assert.match(content, new RegExp(`## ${node.id} `), `o artefato de "${node.id}" precisa estar na entrega`);
  }
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('execução: escrita recusada reprova o nó — não existe entrega declarada sem arquivo', async () => {
  const workspace = tmpDir();
  const objective = 'auditar a seguranca da API';
  const plan = new Commander().plan({ objective, mode: 'orchestrated', output: 'entregas' });

  // Remove a permissão do contrato: a ToolRegistry recusa antes de escrever.
  const deliver = plan.graph.nodes.find((n) => n.id === DELIVER_NODE_ID)!;
  const contract = contractOf(deliver)!;
  deliver.metadata = { ...deliver.metadata, contract: { ...contract, permissions: [] } };

  const orchestrator = new Orchestrator({
    baseDir: workspace,
    workspaceDir: workspace,
    command: 'test',
    task: objective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: createHeadlessProducer(objective),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: workspace }));
  orchestrator.setStore(new TraceStore({ baseDir: workspace }));
  const result = await orchestrator.run();

  assert.notEqual(result.status, 'PASS');
  assert.equal(fs.existsSync(path.join(workspace, deliverableRelPath('entregas', objective))), false);
  fs.rmSync(workspace, { recursive: true, force: true });
});

/* ============================ pausa e retomada ============================ */

test('retomada: run pausado por aprovação humana ainda entrega depois de aprovado', async () => {
  const workspace = tmpDir();
  const objective = 'auditar a seguranca da API';
  const approvals = new ApprovalStore({ baseDir: workspace });
  const produce = createHeadlessProducer(objective);

  // Plano real + um nó de aprovação antes da entrega. É a forma que o
  // human-in-the-loop tem num plano de verdade: alguém confirma antes de o
  // runtime gravar no projeto.
  const plan = new Commander().plan({ objective, mode: 'orchestrated', output: 'entregas' });
  const gate: GraphNode = {
    id: 'confirma',
    kind: 'approval',
    outputs: ['raw'],
    dependencies: [],
    status: 'pending',
    tokenBudget: 0,
  };
  const gateContract: TaskContract = {
    ...(contractOf(plan.graph.nodes[0]) as TaskContract),
    id: gate.id,
    objective: 'confirmar antes de gravar no projeto',
    inputs: [],
    dependencies: [],
    expectedOutput: { kind: 'raw' },
    budget: { maxTokens: 0 },
  };
  const withGate = [
    attachContract(gate, gateContract),
    ...plan.graph.nodes.map((n) =>
      (n.dependencies ?? []).length === 0 ? { ...n, dependencies: [gate.id] } : n,
    ),
  ];
  plan.graph = new ExecutionGraphBuilder().build({
    id: plan.graph.id,
    task: plan.graph.task,
    nodes: withGate,
    budget: plan.graph.budget,
  });

  const build = (resumeRunId?: string) => {
    const o = new Orchestrator({
      baseDir: workspace,
      workspaceDir: workspace,
      command: 'test',
      task: objective,
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: [],
      plan,
      ...(resumeRunId ? { resumeRunId } : {}),
      produce,
    });
    o.setMemory(new MemoryStore({ baseDir: workspace }));
    o.setStore(new TraceStore({ baseDir: workspace }));
    o.setCheckpointStore(new CheckpointStore({ baseDir: workspace }));
    o.setApprovalStore(approvals);
    return o;
  };

  const pausado = await build().run();
  const file = path.join(workspace, deliverableRelPath('entregas', objective));
  assert.equal(pausado.status, 'BLOCKED');
  assert.equal(pausado.pendingApproval?.nodeId, 'confirma');
  assert.equal(fs.existsSync(file), false, 'nada pode ser gravado antes da decisão humana');

  approvals.decide(pausado.trace.runId, 'confirma', 'approved', { reason: 'revisado e liberado' });
  const retomado = await build(pausado.trace.runId).run();

  assert.equal(retomado.status, 'PASS');
  assert.equal(fs.existsSync(file), true, 'a entrega precisa acontecer DEPOIS da aprovação, não ser perdida por ela');
  assert.equal(
    retomado.verification?.find((v) => v.nodeId === DELIVER_NODE_ID)?.result.status,
    'VERIFIED',
  );
  fs.rmSync(workspace, { recursive: true, force: true });
});
