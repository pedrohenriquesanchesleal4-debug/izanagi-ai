/**
 * Grounding: o run lê o projeto antes de escrever sobre ele.
 *
 * O que estes testes protegem não é "existe um survey". É que o levantamento
 * seja EVIDÊNCIA: derivado do disco, limitado com o corte declarado, e
 * efetivamente entregue ao nó que vai decidir. Um survey que ninguém consome
 * seria só mais um nó no grafo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Commander } from '../orchestration/commander.js';
import { SURVEY_NODE_ID, surveyNode, withSurveyAtHead } from '../orchestration/grounding.js';
import { DELIVER_NODE_ID } from '../orchestration/delivery.js';
import { looksLikeProject, surveyProject, SKIP_DIRS } from '../tools/project-survey.js';
import { ToolRegistry } from '../tools/registry.js';
import { ContextResolver } from '../orchestration/context-resolver.js';
import { validateArtifact } from '../contracts/artifacts.js';
import { Orchestrator } from '../orchestrator.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import { createHeadlessProducer } from '../execute.js';
import { contractOf, type TaskContract } from '../contracts/task-contract.js';
import type { GraphNode } from '../types.js';

/** Projeto de mentira com forma de projeto de verdade. */
function fixtureProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-survey-'));
  fs.mkdirSync(path.join(root, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'lixo'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'loja-api', version: '2.1.0', scripts: { build: 'tsc', test: 'node --test' } }),
  );
  fs.writeFileSync(path.join(root, 'README.md'), '# loja-api\n\nAPI de pedidos.\n');
  fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const x = 1');
  for (const f of ['users', 'orders', 'payments']) {
    fs.writeFileSync(path.join(root, 'src', 'routes', `${f}.ts`), `export function ${f}() {}`);
  }
  fs.writeFileSync(path.join(root, 'node_modules', 'lixo', 'index.js'), 'module.exports = 1');
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'compilado');
  return root;
}

/* ============================ varredura ============================ */

test('survey: stack e manifesto saem do disco, não de palpite', () => {
  const root = fixtureProject();
  const s = surveyProject(root);
  assert.deepEqual(s.stack.slice(0, 2), ['node', 'typescript']);
  assert.equal(s.manifests[0].name, 'loja-api');
  assert.equal(s.manifests[0].version, '2.1.0');
  assert.deepEqual(s.manifests[0].scripts, ['build', 'test']);
  assert.deepEqual(s.entrypoints, ['src/index.ts']);
  assert.match(s.readme ?? '', /API de pedidos/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('survey: node_modules e dist não são o projeto e ficam de fora', () => {
  const root = fixtureProject();
  const s = surveyProject(root);
  const dirs = s.tree.map((t) => t.dir);
  assert.equal(dirs.some((d) => d.includes('node_modules')), false);
  assert.equal(dirs.some((d) => d.includes('dist')), false);
  assert.ok(dirs.includes(path.join('src', 'routes')) || dirs.includes('src/routes'));
  assert.ok(SKIP_DIRS.has('node_modules') && SKIP_DIRS.has('.git'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('survey: o script do package.json entra pelo NOME, nunca pelo comando', () => {
  const root = fixtureProject();
  const text = JSON.stringify(surveyProject(root));
  assert.match(text, /"build"/);
  assert.equal(text.includes('node --test'), false, 'despejar o comando é convite a executá-lo');
  fs.rmSync(root, { recursive: true, force: true });
});

test('survey: corte por número de entradas é DECLARADO, não silencioso', () => {
  const root = fixtureProject();
  const s = surveyProject(root, { maxEntries: 2 });
  assert.equal(s.truncated.entries, true, 'survey que não declara o próprio corte vira conclusão errada');
  fs.rmSync(root, { recursive: true, force: true });
});

test('survey: linguagem solta não vira stack (um .py num projeto Node não é projeto Python)', () => {
  const root = fixtureProject();
  fs.writeFileSync(path.join(root, 'script.py'), 'print(1)');
  assert.equal(surveyProject(root).stack.includes('python'), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('survey: diretório vazio produz levantamento vazio, não exceção', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-empty-'));
  const s = surveyProject(root);
  assert.deepEqual(s.stack, []);
  assert.deepEqual(s.manifests, []);
  assert.equal(s.scanned.files, 0);
  assert.equal(looksLikeProject(root), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('survey: o resultado satisfaz o schema do kind "project-survey"', () => {
  const root = fixtureProject();
  assert.equal(validateArtifact('project-survey', surveyProject(root)).valid, true);
  assert.equal(validateArtifact('project-survey', { root: '.' }).valid, false, 'sem stack/tree/truncated não é evidência');
  fs.rmSync(root, { recursive: true, force: true });
});

/* ============================ tool ============================ */

test('tool: project.survey exige fs:read e é negada sem a permissão', async () => {
  const root = fixtureProject();
  const registry = new ToolRegistry();
  const negada = await registry.execute('project.survey', { dir: '.' }, { permissions: [], baseDir: root });
  assert.equal(negada.ok, false);
  assert.match(negada.error ?? '', /permissão negada/);

  const ok = await registry.execute('project.survey', { dir: '.' }, { permissions: ['fs:read'], baseDir: root });
  assert.equal(ok.ok, true);
  assert.equal((ok.result as { manifests: Array<{ name?: string }> }).manifests[0].name, 'loja-api');
  fs.rmSync(root, { recursive: true, force: true });
});

test('tool: "levantar o projeto" não é porta de leitura de qualquer diretório da máquina', async () => {
  const root = fixtureProject();
  const registry = new ToolRegistry();
  const fuga = await registry.execute('project.survey', { dir: '../..' }, { permissions: ['fs:read'], baseDir: root });
  assert.equal(fuga.ok, false);
  assert.match(fuga.error ?? '', /fora da zona permitida/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('tool: input malformado é recusado antes de varrer', async () => {
  const root = fixtureProject();
  const registry = new ToolRegistry();
  const r = await registry.execute('project.survey', { maxEntries: -1 }, { permissions: ['fs:read'], baseDir: root });
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /maxEntries/);
  fs.rmSync(root, { recursive: true, force: true });
});

/* ============================ plano ============================ */

test('grounding: o survey vai na cabeça e só as RAÍZES dependem dele', () => {
  const nodes: GraphNode[] = [
    { id: 'a', kind: 'agent', dependencies: [], status: 'pending' },
    { id: 'b', kind: 'agent', dependencies: [], status: 'pending' },
    { id: 'c', kind: 'agent', dependencies: ['a', 'b'], status: 'pending' },
  ];
  const out = withSurveyAtHead(nodes);
  assert.deepEqual(out.map((n) => n.dependencies), [[SURVEY_NODE_ID], [SURVEY_NODE_ID], ['a', 'b']]);
});

test('plano: com survey o levantamento chega ao contexto de quem decide', () => {
  const plan = new Commander().plan({
    objective: 'adicionar paginacao ao endpoint GET /users',
    mode: 'orchestrated',
    survey: true,
  });
  const survey = plan.contracts.find((c) => c.id === SURVEY_NODE_ID);
  assert.ok(survey, 'o plano precisa conter o nó de survey');
  assert.deepEqual(survey!.permissions, ['fs:read']);
  assert.equal(survey!.budget.maxTokens, 0, 'levantar o terreno não custa token');
  assert.equal(survey!.optional, true, 'grounding é evidência auxiliar: falhar não derruba o run');

  // A aresta sem a transferência de informação seria um grafo bonito e inútil.
  const roots = plan.contracts.filter((c) => c.id !== SURVEY_NODE_ID && c.dependencies.includes(SURVEY_NODE_ID));
  assert.ok(roots.length > 0);
  for (const root of roots) assert.ok(root.inputs.includes(SURVEY_NODE_ID));
  assert.deepEqual(plan.graph.parallelBatches[0], [SURVEY_NODE_ID]);
  assert.deepEqual(plan.issues, []);
});

test('plano: sem survey nada muda — nenhum nó ganha permissão de leitura', () => {
  const plan = new Commander().plan({ objective: 'adicionar paginacao ao endpoint GET /users', mode: 'orchestrated' });
  assert.equal(plan.graph.nodes.some((n) => n.id === SURVEY_NODE_ID), false);
  assert.equal(plan.contracts.some((c) => (c.permissions ?? []).length > 0), false);
});

test('plano: modo direct não paga survey — uma resposta não justifica dobrar o grafo', () => {
  const plan = new Commander().plan({ objective: 'converta 10 dolares para reais', mode: 'direct', survey: true });
  assert.deepEqual(plan.graph.nodes.map((n) => n.id), ['answer']);
});

test('plano: survey e entrega convivem — leitura na cabeça, escrita no fim', () => {
  const plan = new Commander().plan({
    objective: 'auditar a seguranca da API',
    mode: 'orchestrated',
    survey: true,
    output: 'docs',
  });
  assert.deepEqual(plan.graph.parallelBatches[0], [SURVEY_NODE_ID]);
  assert.deepEqual(plan.graph.parallelBatches[plan.graph.parallelBatches.length - 1], [DELIVER_NODE_ID]);
  const perms = Object.fromEntries(plan.contracts.map((c) => [c.id, c.permissions ?? []]));
  assert.deepEqual(perms[SURVEY_NODE_ID], ['fs:read']);
  assert.deepEqual(perms[DELIVER_NODE_ID], ['fs:write']);
  // Nenhum nó de agente recebe permissão nenhuma.
  for (const c of plan.contracts) {
    if (c.id === SURVEY_NODE_ID || c.id === DELIVER_NODE_ID) continue;
    assert.deepEqual(c.permissions ?? [], [], `nó "${c.id}" não devia ter permissão`);
  }
});

/* ============================ execução ============================ */

test('execução: o survey roda de verdade e o nó seguinte recebe a stack no contexto', async () => {
  const root = fixtureProject();
  const objective = 'adicionar paginacao ao endpoint GET /users';
  const plan = new Commander().plan({ objective, mode: 'orchestrated', survey: true });

  const contexts = new Map<string, string>();
  const orchestrator = new Orchestrator({
    baseDir: root,
    workspaceDir: root,
    command: 'test',
    task: objective,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: (node, ctx) => {
      const upstream = (ctx.nodeContext?.upstream ?? []).map((u) => `${u.nodeId}:${u.summary}`).join('\n');
      contexts.set(node.id, upstream);
      return createHeadlessProducer(objective)(node, ctx);
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: root }));
  orchestrator.setStore(new TraceStore({ baseDir: root }));
  const result = await orchestrator.run();

  const surveyArtifact = result.graph.nodes.find((n) => n.id === SURVEY_NODE_ID);
  assert.equal(surveyArtifact?.status, 'succeeded');
  const rootNode = plan.contracts.find((c) => c.dependencies.includes(SURVEY_NODE_ID))!;
  const seen = contexts.get(rootNode.id) ?? '';
  assert.match(seen, /loja-api/, 'o agente precisa ver o nome real do projeto, não inventar um');
  assert.match(seen, /typescript/);
  assert.equal(result.trace.spans.some((s) => s.name === 'tool:project.survey'), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('execução: survey que falha não derruba o run (é evidência auxiliar, não a entrega)', async () => {
  const root = fixtureProject();
  const objective = 'adicionar paginacao ao endpoint GET /users';
  const plan = new Commander().plan({ objective, mode: 'orchestrated', survey: true });

  // Tira a permissão: a ToolRegistry recusa antes de varrer.
  const node = plan.graph.nodes.find((n) => n.id === SURVEY_NODE_ID)!;
  const contract = contractOf(node)!;
  node.metadata = { ...node.metadata, contract: { ...contract, permissions: [] } satisfies TaskContract };

  const orchestrator = new Orchestrator({
    baseDir: root,
    workspaceDir: root,
    command: 'test',
    task: objective,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: createHeadlessProducer(objective),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: root }));
  orchestrator.setStore(new TraceStore({ baseDir: root }));
  const result = await orchestrator.run();

  assert.equal(result.graph.nodes.find((n) => n.id === SURVEY_NODE_ID)?.status, 'failed');
  assert.equal(
    (result.evaluation?.regressions ?? []).some((r) => r.includes(`"${SURVEY_NODE_ID}"`)),
    false,
    'nó opcional que falha não entra como regressão',
  );
  fs.rmSync(root, { recursive: true, force: true });
});

/* ============================ custo ============================ */

test('custo: o survey no contexto respeita o teto por artefato do Context Resolver', () => {
  const root = fixtureProject();
  const survey = surveyProject(root);
  const contract = surveyNode().contract;
  const resolved = new ContextResolver().resolve(
    { ...contract, id: 'consumidor', inputs: [SURVEY_NODE_ID], dependencies: [SURVEY_NODE_ID] },
    new Map([[SURVEY_NODE_ID, { nodeId: SURVEY_NODE_ID, kind: 'project-survey', content: survey, valid: true }]]),
  );
  assert.equal(resolved.upstream.length, 1);
  assert.ok(resolved.upstreamChars <= 1300, `grounding custou ${resolved.upstreamChars} chars — o teto é do resolver, não do survey`);
  fs.rmSync(root, { recursive: true, force: true });
});
