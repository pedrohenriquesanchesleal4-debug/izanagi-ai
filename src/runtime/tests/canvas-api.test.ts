/**
 * Canvas Orchestration — testes da API programática.
 *
 * Contrato sob teste (src/runtime/canvas/api.ts):
 *   - `CanvasWorkflow` carrega/valida/inspeciona/salva e devolve CÓPIA da
 *     definição (mutação externa não vaza para o estado interno);
 *   - `executeWorkflow` valida ANTES de executar: canvas inválido não roda;
 *   - `dryRun` planeja sem executar nó nenhum (e emite a timeline do plano);
 *   - execução headless roda o runtime real, sem producer LLM.
 *
 * Todos os testes escrevem estado em diretório temporário — nunca no
 * `.izanagi/state` do repositório.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { CanvasExecutionError, CanvasWorkflow, executeWorkflow, orchestrate, pruneIR } from '../canvas/api.js';
import type { CanvasDefinition } from '../canvas/types.js';

const repoRoot = path.resolve(process.cwd());
const temporarios: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), `izanagi-canvas-${prefix}-`));
  temporarios.push(dir);
  return dir;
}

process.on('exit', () => {
  for (const dir of temporarios) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* limpeza best-effort: diretório temporário do SO */
    }
  }
});

/** Canvas válido mínimo: input → agente → output. */
function canvasSimples(): CanvasDefinition {
  return {
    nodes: [
      { id: 'in', type: 'text', x: 0, y: 0, text: 'Entrada', izanagi: { kind: 'input' } },
      { id: 'dev', type: 'text', x: 320, y: 0, text: 'Desenvolvimento', izanagi: { kind: 'agent', agent: 'senior-engineer' } },
      { id: 'out', type: 'text', x: 640, y: 0, text: 'Saída', izanagi: { kind: 'output' } },
    ],
    edges: [
      { id: 'e1', fromNode: 'in', toNode: 'dev', izanagi: { messageType: 'task' } },
      { id: 'e2', fromNode: 'dev', toNode: 'out', izanagi: { messageType: 'result' } },
    ],
    id: 'izanagi:teste-simples',
    name: 'teste-simples',
  } as CanvasDefinition;
}

test('api: fromJson aceita string e objeto e normaliza o canvas', () => {
  const porObjeto = CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples');
  assert.equal(porObjeto.name, 'teste-simples');
  assert.equal(porObjeto.compile().nodes.length, 3);

  const porString = CanvasWorkflow.fromJson(JSON.stringify(canvasSimples()), 'teste-simples');
  assert.deepEqual(porString.compile().nodes.map((n) => n.id), ['in', 'dev', 'out']);
});

test('api: definition devolve cópia defensiva (mutação externa não vaza)', () => {
  const wf = CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples');
  const copia = wf.definition as CanvasDefinition;
  copia.nodes.length = 0;
  assert.equal(wf.compile().nodes.length, 3, 'o estado interno não foi afetado');
  assert.notEqual(wf.definition, wf.definition, 'cada acesso devolve um clone');
});

test('api: createTemplate gera input → dev → output com arestas tipadas', () => {
  const wf = CanvasWorkflow.createTemplate('meu-wf');
  const ir = wf.compile();
  assert.deepEqual(ir.nodes.map((n) => n.kind), ['input', 'agent', 'output']);
  assert.equal(wf.definition.id, 'izanagi:meu-wf');
  assert.deepEqual(ir.edges.map((e) => e.messageType), ['task', 'result']);
  assert.deepEqual(ir.entryNodes, ['in']);
  assert.deepEqual(ir.exitNodes, ['out']);

  const custom = CanvasWorkflow.createTemplate('outro', { agent: 'qa', label: 'Revisão' });
  assert.equal(custom.compile().nodes[1]!.agent, 'qa');
  assert.equal(custom.compile().nodes[1]!.label, 'Revisão');
});

test('api: save grava o canvas e list o encontra no diretório', async () => {
  const dir = tempDir('save');
  const wf = CanvasWorkflow.createTemplate('persistido');
  const destino = path.join(dir, 'persistido.canvas');
  const gravado = await wf.save(destino);
  assert.equal(gravado, destino);
  assert.ok(existsSync(destino));

  assert.deepEqual(await CanvasWorkflow.list(dir), ['persistido.canvas']);
  const recarregado = await CanvasWorkflow.load('persistido.canvas', dir);
  assert.equal(path.basename(recarregado.name), 'persistido');
  assert.equal(recarregado.compile().nodes.length, 3);
});

test('api: list devolve vazio quando o diretório não existe', async () => {
  assert.deepEqual(await CanvasWorkflow.list(path.join(tempDir('vazio'), 'nao-existe')), []);
});

test('api: load lê o canvas real do repositório', async () => {
  const wf = await CanvasWorkflow.load('example-architecture.canvas', path.join(repoRoot, 'canvases'));
  // `name` do parser é o caminho com as extensões removidas (ver harness do
  // parser): o invariante estável é o basename, que é o nome lógico do arquivo.
  assert.equal(path.basename(wf.name), 'example-architecture');
  const inspecao = wf.inspect(repoRoot);
  assert.equal(inspecao.hasErrors, false);
  assert.ok(inspecao.nodeCount > 0);
  assert.deepEqual(inspecao.entryNodes, ['input']);
});

test('api: validate usa o registry real de agentes e skills', () => {
  const wf = CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples');
  const resultado = wf.validate(repoRoot);
  assert.equal(resultado.valid, true, JSON.stringify(resultado.errors));
  assert.deepEqual(resultado.errors, []);
});

test('api: validate reprova agente inexistente', () => {
  const ruim = canvasSimples();
  ruim.nodes[1]!.izanagi = { kind: 'agent', agent: 'agente-inexistente' };
  const resultado = CanvasWorkflow.fromJson(ruim, 'ruim').validate(repoRoot);
  assert.equal(resultado.valid, false);
  assert.ok(resultado.errors.some((e) => e.code === 'CAN-104'));
});

test('api: inspect agrega contagem, entradas/saídas e capacidades', () => {
  const inspecao = CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples').inspect(repoRoot);
  assert.equal(inspecao.name, 'teste-simples');
  assert.equal(inspecao.nodeCount, 3);
  assert.equal(inspecao.edgeCount, 2);
  assert.deepEqual(inspecao.entryNodes, ['in']);
  assert.deepEqual(inspecao.exitNodes, ['out']);
  assert.deepEqual(inspecao.capabilities, { hasLoops: false, hasParallelBranches: false, hasExternalEndpoints: false });
  assert.equal(inspecao.hasErrors, false);
});

test('api: executeWorkflow recusa canvas inválido antes de qualquer execução', async () => {
  const ruim = canvasSimples();
  ruim.nodes[1]!.izanagi = { kind: 'agent', agent: 'agente-inexistente' };
  await assert.rejects(
    () => executeWorkflow(CanvasWorkflow.fromJson(ruim, 'ruim'), { baseDir: repoRoot, stateDir: tempDir('state') }),
    (err: unknown) => {
      assert.ok(err instanceof CanvasExecutionError);
      assert.equal(err.name, 'CanvasExecutionError');
      assert.match(err.message, /inválido \(1 erro\(s\)\)/);
      assert.match(err.message, /CAN-104/);
      assert.ok(err.diagnostics?.errors.some((d) => d.code === 'CAN-104'));
      return true;
    },
  );
});

test('api: dryRun planeja cada nó e resolve modelo, sem executar', async () => {
  const wf = CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples');
  const eventos: string[] = [];
  const res = await executeWorkflow(wf, {
    baseDir: repoRoot,
    dryRun: true,
    onWorkflowEvent: (e) => eventos.push(e.type),
  });

  assert.equal(res.status, 'DRY_RUN');
  assert.equal(res.dryRun, true);
  assert.equal(res.headless, true);
  assert.equal(res.workflowStatus, 'pending');
  assert.equal(res.score, 0);
  assert.equal(res.traceFile, '');
  assert.deepEqual(res.nodes, [
    { id: 'in', status: 'pending' },
    { id: 'dev', status: 'pending' },
    { id: 'out', status: 'pending' },
  ]);
  assert.deepEqual(res.messages, []);
  assert.match(res.runId, /^dry-\d+$/);
  assert.deepEqual(Object.keys(res.modelByNode), ['dev'], 'só nó de agente resolve modelo');
  assert.equal(res.modelByNode.dev!.source, 'auto');
  assert.equal(res.plan?.mode, 'orchestrated');
  assert.deepEqual(eventos, ['workflow.started', 'model.resolved', 'workflow.completed']);
});

test('api: execução headless roda o runtime e devolve estado e eventos', async () => {
  const wf = CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples');
  const estado = tempDir('state');
  const res = await executeWorkflow(wf, { baseDir: repoRoot, stateDir: estado, task: 'refatorar paginação' });

  assert.equal(res.dryRun, false);
  assert.equal(res.headless, true, 'sem produce o run é headless');
  assert.equal(res.status, 'PASS');
  assert.equal(res.workflowStatus, 'completed');
  assert.ok(res.score > 0);
  assert.match(res.runId, /^canvas-\d+$/);
  assert.deepEqual(res.state.input, { task: 'refatorar paginação' }, 'a task vira a entrada do estado');
  assert.deepEqual(res.nodes.map((n) => [n.id, n.status]), [
    ['in', 'succeeded'],
    ['dev', 'succeeded'],
    ['out', 'succeeded'],
  ]);
  assert.ok(res.state.nodeResults.dev, 'resultado do nó fica no estado compartilhado');
  assert.equal(res.metrics.totalTokens, 0, 'headless não inventa consumo de token');
  const tipos = res.events.map((e) => e.type);
  assert.equal(tipos[0], 'workflow.started', 'a timeline abre com o início do workflow');
  assert.equal(tipos[tipos.length - 1], 'workflow.completed', 'e fecha com o fim');
  assert.ok(tipos.includes('node.started'));
  assert.ok(tipos.includes('node.completed'));
  assert.ok(tipos.includes('message.sent'), 'aresta com messageType publica no bus');
  assert.ok(res.messages.length >= 2, 'mensagens do bus são anexadas ao resultado');
  assert.deepEqual(Object.keys(res.state).sort(), ['artifacts', 'input', 'memoryRefs', 'nodeResults', 'variables'], 'o estado agregado não carrega o bus');
  assert.ok(res.traceFile.length > 0, 'o run grava trace em disco');
});

test('api: aceita caminho de arquivo e resolve relativo ao baseDir', async () => {
  const dir = tempDir('arquivo');
  writeFileSync(path.join(dir, 'quebrado.canvas'), '{ nao-e-json', 'utf-8');

  // Caminho absoluto: independe do baseDir (que aqui é a raiz do repositório,
  // onde vive o registry de agentes/skills usado na validação).
  const absoluto = await executeWorkflow(path.join(dir, 'quebrado.canvas'), { baseDir: repoRoot, dryRun: true }).catch((e: unknown) => e);
  assert.ok(absoluto instanceof Error, 'arquivo inválido nem chega a planejar');
  assert.match(absoluto.message, /JSON/i);

  // Caminho relativo é resolvido contra `baseDir` — o arquivo quebrado está lá.
  await assert.rejects(
    () => executeWorkflow('quebrado.canvas', { baseDir: dir, dryRun: true }),
    /JSON/i,
    'o arquivo foi lido de baseDir, não do cwd do processo',
  );

  await assert.rejects(
    () => executeWorkflow('nao-existe.canvas', { baseDir: repoRoot, dryRun: true }),
    /ENOENT/,
    'arquivo ausente falha antes de qualquer planejamento',
  );
});

test('api: modo manual do canvas é pinado por nó no resultado', async () => {
  const def = canvasSimples();
  def.nodes[1]!.izanagi = { kind: 'agent', agent: 'senior-engineer', model: { mode: 'manual', provider: 'anthropic', model: 'claude-opus-5' } };
  const res = await executeWorkflow(CanvasWorkflow.fromJson(def, 'manual'), { baseDir: repoRoot, dryRun: true });
  assert.deepEqual(res.modelByNode.dev, { model: 'claude-opus-5', provider: 'anthropic', source: 'manual' });
});

test('api: pruneIR recorta a montante, a jusante e recusa nó ausente', () => {
  const ir = CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples').compile();

  const aJusante = pruneIR(ir, 'dev');
  assert.deepEqual(aJusante.nodes.map((n) => n.id), ['dev', 'out']);
  assert.deepEqual(aJusante.edges.map((e) => e.id), ['e2']);

  const aMontante = pruneIR(ir, undefined, 'dev');
  assert.deepEqual(aMontante.nodes.map((n) => n.id), ['in', 'dev']);
  assert.deepEqual(aMontante.edges.map((e) => e.id), ['e1']);

  const intacto = pruneIR(ir);
  assert.equal(intacto, ir, 'sem from/until nada é copiado');

  assert.throws(() => pruneIR(ir, 'fantasma'), /nós ausentes para poda de execução: fantasma/);
});

test('api: orchestrate é o alias que injeta a entrada do workflow', async () => {
  const res = await orchestrate(CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples'), { dado: 42 }, {
    baseDir: repoRoot,
    dryRun: true,
  });
  assert.equal(res.status, 'DRY_RUN');
  assert.deepEqual(res.state.input, { dado: 42 });
});

test('api: execução parcial via fromNode exclui os nós anteriores', async () => {
  const res = await executeWorkflow(CanvasWorkflow.fromJson(canvasSimples(), 'teste-simples'), {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    fromNode: 'dev',
  });
  assert.deepEqual(res.nodes.map((n) => n.id), ['dev', 'out']);
  assert.equal(res.nodes[0]!.status, 'succeeded');
});
