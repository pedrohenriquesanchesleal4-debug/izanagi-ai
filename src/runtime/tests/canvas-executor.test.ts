/**
 * Canvas Orchestration — testes do EXECUTOR (IR do canvas → Orchestrator).
 *
 * Contrato sob teste (src/runtime/canvas/executor.ts):
 *   - o plano Commander deriva do IR: nós, dependências, batches, contratos;
 *   - o modelo do CANVAS vence o default do papel no `routeRole`;
 *   - `executeCanvasWorkflow` executa o grafo real com o `produce` do caller,
 *     alimentando o estado compartilhado, o message bus e a timeline;
 *   - loop tem TETO de iterações e condição de término; nunca é laço infinito.
 *
 * Nenhum modelo é chamado: o `produce` é injetado e devolve fixtures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { compileCanvas } from '../canvas/compiler.js';
import { buildCanvasPlan, executeCanvasWorkflow, type CanvasProduce } from '../canvas/executor.js';
import { ModelRouter } from '../model/router.js';
import type { CanvasDefinition, CanvasEdge, CanvasNode, WorkflowIR } from '../canvas/types.js';

const repoRoot = path.resolve(process.cwd());
const temporarios: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), `izanagi-canvas-exec-${prefix}-`));
  temporarios.push(dir);
  return dir;
}

process.on('exit', () => {
  for (const dir of temporarios) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* limpeza best-effort */
    }
  }
});

type Producer = CanvasProduce;

function node(id: string, izanagi: Record<string, unknown>, text = id): CanvasNode {
  return { id, type: 'text', x: 0, y: 0, text, izanagi: izanagi as CanvasNode['izanagi'] };
}

function edge(id: string, fromNode: string, toNode: string, izanagi?: Record<string, unknown>): CanvasEdge {
  return { id, fromNode, toNode, ...(izanagi ? { izanagi: izanagi as CanvasEdge['izanagi'] } : {}) };
}

function ir(nodes: CanvasNode[], edges: CanvasEdge[], meta: Record<string, unknown> = {}): WorkflowIR {
  return compileCanvas({ nodes, edges, ...meta } as CanvasDefinition);
}

const router = (): ModelRouter => new ModelRouter(ModelRouter.loadProjectProviders(repoRoot));

/** Fixture: input → dev → out (sem loop). */
function fluxoSimples(): WorkflowIR {
  return ir(
    [node('in', { kind: 'input' }), node('dev', { kind: 'agent', agent: 'senior-engineer' }), node('out', { kind: 'output' })],
    [edge('e1', 'in', 'dev', { messageType: 'task' }), edge('e2', 'dev', 'out', { messageType: 'result' })],
    { id: 'izanagi:exec-simples', name: 'exec-simples' },
  );
}

test('executor: plano derivado do IR preserva ordem, batches e contratos', () => {
  const built = buildCanvasPlan({ ir: fluxoSimples(), router: router(), task: 'executar fluxo' });
  assert.equal(built.plan.mode, 'orchestrated');
  assert.match(built.plan.modeReason, /canvas declarativo/);
  assert.equal(built.plan.graph.id, 'canvas-izanagi:exec-simples');
  assert.deepEqual(built.plan.graph.order, ['in', 'dev', 'out']);
  assert.deepEqual(built.plan.graph.parallelBatches, [['in'], ['dev'], ['out']]);
  assert.equal(built.plan.contracts.length, 3);
  assert.deepEqual(built.plan.graph.nodes.map((n) => n.kind), ['agent', 'agent', 'agent']);
  assert.equal(built.plan.estimate.parallelStages, 3);
});

test('executor: dependências ignoram aresta de retorno para nó com loop', () => {
  const comLoop = ir(
    [
      node('in', { kind: 'input' }),
      node('a', { kind: 'agent', agent: 'qa' }),
      node('b', { kind: 'agent', agent: 'qa', loop: { maxIterations: 2 } }),
    ],
    [edge('e1', 'in', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')],
  );
  const built = buildCanvasPlan({ ir: comLoop, router: router(), task: 'loop' });
  const porId = new Map(built.plan.graph.nodes.map((n) => [n.id, n]));
  assert.deepEqual(porId.get('a')!.dependencies, ['in']);
  assert.deepEqual(porId.get('b')!.dependencies, ['a']);
  assert.deepEqual(built.plan.graph.order.includes('a'), true);
});

test('executor: papel do contrato deriva do kind do nó', () => {
  const misto = ir(
    [
      node('o', { kind: 'orchestrator', agent: 'orchestrator' }),
      node('e', { kind: 'evaluator', agent: 'evaluator' }),
      node('g', { kind: 'condition' }),
      node('a', { kind: 'agent', agent: 'qa' }),
    ],
    [],
  );
  const built = buildCanvasPlan({ ir: misto, router: router(), task: 'papéis' });
  const role = (id: string): string | undefined => built.plan.contracts.find((c) => c.id === id)?.role;
  assert.equal(role('o'), 'commander');
  assert.equal(role('e'), 'worker');
  assert.equal(role('g'), 'worker');
  assert.equal(role('a'), 'specialist');
});

test('executor: contrato carrega permissões declaradas e aresta opcional vira gate', () => {
  const def = ir(
    [
      node('dev', { kind: 'agent', agent: 'qa', permissions: ['fs:read', 'fs:write'], timeoutMs: 9000 }),
      node('gate', { kind: 'condition', condition: 'result.score >= 0.8' }),
    ],
    [],
  );
  const built = buildCanvasPlan({ ir: def, router: router(), task: 'permissões' });
  const dev = built.plan.contracts.find((c) => c.id === 'dev')!;
  assert.deepEqual(dev.permissions, ['fs:read', 'fs:write']);
  assert.equal(dev.budget.maxTimeMs, 9000);
  assert.equal(dev.optional, false);

  const gate = built.plan.contracts.find((c) => c.id === 'gate')!;
  assert.equal(gate.optional, true, 'nó de condição é gate: entra como tarefa opcional');
  const noGrafo = built.plan.graph.nodes.find((n) => n.id === 'gate')!;
  assert.equal(noGrafo.kind, 'gate');
});

test('executor: nó sem permissão declarada não recebe permissão nenhuma', () => {
  const built = buildCanvasPlan({ ir: fluxoSimples(), router: router(), task: 'sem permissão' });
  for (const contrato of built.plan.contracts) {
    assert.equal(contrato.permissions, undefined, `contrato ${contrato.id} ganhou permissão sem declarar`);
  }
});

test('executor: nó de tool declara o id da tool no contrato', () => {
  const comTool = ir([node('reader', { kind: 'tool', tool: 'fs.read' })], []);
  const built = buildCanvasPlan({ ir: comTool, router: router(), task: 'tool' });
  const contrato = built.plan.contracts[0]!;
  assert.equal(contrato.tool?.id, 'fs.read');
  assert.equal(typeof contrato.tool?.input, 'object');
  assert.equal(contrato.role, 'worker');
});

test('executor: modelo manual do canvas é pinado e vence o default do papel', () => {
  const def = ir(
    [node('dev', { kind: 'agent', agent: 'senior-engineer', model: { mode: 'manual', provider: 'anthropic', model: 'claude-opus-5' } })],
    [],
  );
  const built = buildCanvasPlan({ ir: def, router: router(), task: 'manual' });
  assert.deepEqual(built.modelByNode.dev, { model: 'claude-opus-5', provider: 'anthropic', source: 'manual' });
  const noGrafo = built.plan.graph.nodes.find((n) => n.id === 'dev')!;
  assert.deepEqual(built.routeRole('specialist', noGrafo), { model: 'claude-opus-5', provider: 'anthropic' });
});

test('executor: modelo auto resolve por papel com hint do agente quando houver', () => {
  const def = ir([node('dev', { kind: 'agent', agent: 'senior-engineer' })], []);
  const built = buildCanvasPlan({
    ir: def,
    router: router(),
    task: 'auto',
    agentHints: (agentId) => (agentId === 'senior-engineer' ? 'opus' : undefined),
  });
  assert.equal(built.modelByNode.dev!.source, 'auto');
  assert.equal(typeof built.modelByNode.dev!.model, 'string');
  assert.equal(typeof built.modelByNode.dev!.provider, 'string');

  const semHint = buildCanvasPlan({ ir: def, router: router(), task: 'auto sem hint' });
  assert.equal(semHint.modelByNode.dev!.source, 'auto');
});

test('executor: routeRole devolve undefined para nó sem agente pinado', () => {
  const built = buildCanvasPlan({ ir: fluxoSimples(), router: router(), task: 'role' });
  const estrutural = built.plan.graph.nodes.find((n) => n.id === 'in')!;
  assert.equal(built.routeRole('specialist', estrutural), undefined);
  assert.equal(built.routeRole('specialist'), undefined);
});

test('executor: run headless produz conteúdo simulado e marca os nós como succeeded', async () => {
  const resultado = await executeCanvasWorkflow(fluxoSimples(), {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    runId: 'run-headless',
    task: 'executar fluxo',
  });
  assert.equal(resultado.workflowState.runId, 'run-headless');
  assert.equal(resultado.workflowState.status, 'completed');
  assert.equal(resultado.workflowState.metrics.totalTokens, 0);
  assert.deepEqual(Object.keys(resultado.workflowState.nodeResults).sort(), ['dev', 'in', 'out']);
  for (const [id, r] of Object.entries(resultado.workflowState.nodeResults)) {
    assert.equal(r.status, 'succeeded', `nó ${id} não concluiu`);
  }
  assert.equal((resultado.workflowState.input as { task: string }).task, 'executar fluxo');
});

test('executor: produce do caller recebe estado, mensagens e resultado por nó', async () => {
  const chamadas: Array<{ node: string; runId: string; msgs: number }> = [];
  const producer: Producer = (n, ctx) => {
    chamadas.push({ node: n.id, runId: ctx.state.runId, msgs: ctx.messages.length });
    return { content: `saída de ${n.id}`, kind: 'artifact', tokens: 10 };
  };
  const deps = { baseDir: repoRoot, stateDir: tempDir('state'), runId: 'run-produce', task: 'produce real' };
  const resultado = await executeCanvasWorkflow(fluxoSimples(), { ...deps, produce: producer });

  assert.deepEqual(chamadas.map((c) => c.node).sort(), ['dev', 'in', 'out']);
  assert.ok(chamadas.every((c) => c.runId === 'run-produce'));
  assert.equal(chamadas.find((c) => c.node === 'dev')!.msgs, 1, 'dev recebe a mensagem da aresta task');
  assert.equal(resultado.workflowState.metrics.totalTokens, 30);
  assert.equal(resultado.workflowState.nodeResults.dev!.status, 'succeeded');
  assert.equal(resultado.workflowState.messages.length, 2, 'as duas arestas tipadas publicaram no bus');
});

test('executor: aresta sem messageType não publica mensagem', async () => {
  const semTipo = ir(
    [node('in', { kind: 'input' }), node('dev', { kind: 'agent', agent: 'qa' })],
    [edge('e1', 'in', 'dev')],
  );
  const resultado = await executeCanvasWorkflow(semTipo, {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    runId: 'run-sem-msg',
    task: 'sem mensagem',
  });
  assert.deepEqual(resultado.workflowState.messages, []);
});

test('executor: loop respeita o teto de iterações e devolve o resumo das iterações', async () => {
  let chamadas = 0;
  const producer: Producer = () => {
    chamadas += 1;
    return { content: `iteração ${chamadas}`, kind: 'artifact', tokens: 5 };
  };
  const comLoop = ir(
    [
      node('dev', { kind: 'agent', agent: 'qa', loop: { maxIterations: 3 } }),
    ],
    [],
    { id: 'izanagi:loop-teto', name: 'loop-teto' },
  );
  const resultado = await executeCanvasWorkflow(comLoop, {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    runId: 'run-loop',
    task: 'loop com teto',
    produce: producer,
  });
  assert.equal(chamadas, 3, 'maxIterations é um teto real, não uma sugestão');
  const saida = resultado.workflowState.nodeResults.dev!.output as { iterations: string[]; terminated: boolean; reason: string };
  assert.deepEqual(saida.iterations, ['iteração 1', 'iteração 2', 'iteração 3']);
  assert.equal(saida.terminated, false);
  assert.match(saida.reason, /teto/);
});

test('executor: condição de término encerra o loop antes do teto', async () => {
  let chamadas = 0;
  const producer: Producer = (_n, ctx) => {
    chamadas += 1;
    const iteracao = (ctx as unknown as { iteration?: number }).iteration ?? 0;
    void iteracao;
    return { content: chamadas >= 2 ? 'pronto' : 'pendente', kind: 'artifact' };
  };
  const comLoop = ir([node('dev', { kind: 'agent', agent: 'qa', loop: { maxIterations: 5, terminationCondition: "result == 'pronto'" } })], [], {
    id: 'izanagi:loop-cond',
    name: 'loop-cond',
  });
  const resultado = await executeCanvasWorkflow(comLoop, {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    runId: 'run-loop-cond',
    task: 'loop com condição',
    produce: producer,
  });
  assert.equal(chamadas, 2, 'a condição de término para o loop na 2ª iteração');
  const saida = resultado.workflowState.nodeResults.dev!.output as { iterations: string[]; terminated: boolean; reason: string };
  assert.equal(saida.terminated, true);
  assert.deepEqual(saida.iterations, ['pendente', 'pronto']);
  assert.match(saida.reason, /satisfeita na iteração 2/);
});

test('executor: loop com uploadResults=false devolve o último resultado, não a lista', async () => {
  let chamadas = 0;
  const producer: Producer = () => {
    chamadas += 1;
    return { content: `v${chamadas}`, kind: 'artifact' };
  };
  const comLoop = ir([node('dev', { kind: 'agent', agent: 'qa', loop: { maxIterations: 2, uploadResults: false } })], [], {
    id: 'izanagi:loop-upload',
    name: 'loop-upload',
  });
  const resultado = await executeCanvasWorkflow(comLoop, {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    runId: 'run-loop-upload',
    task: 'loop sem upload',
    produce: producer,
  });
  assert.equal(resultado.workflowState.nodeResults.dev!.output, 'v2');
});

test('executor: falha do producer marca o nó como failed no estado', async () => {
  const producer: Producer = (n) => {
    if (n.id === 'dev') throw new Error('producer explodiu');
    return { content: 'ok', kind: 'artifact' };
  };
  const resultado = await executeCanvasWorkflow(fluxoSimples(), {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    runId: 'run-falha',
    task: 'falha de producer',
    produce: producer,
  });
  assert.notEqual(resultado.status, 'PASS', 'run com nó falho não pode ser aprovado');
  const dev = resultado.workflowState.nodeResults.dev;
  assert.equal(dev?.status, 'failed');
  assert.match(dev?.error ?? '', /producer explodiu/);
});

test('executor: orçamento de tokens é imposto ao run', async () => {
  const producer: Producer = () => ({ content: 'x'.repeat(50), kind: 'artifact', tokens: 1000 });
  const resultado = await executeCanvasWorkflow(fluxoSimples(), {
    baseDir: repoRoot,
    stateDir: tempDir('state'),
    runId: 'run-orcamento',
    task: 'orçamento curto',
    budgets: { maxTokens: 5 },
    produce: producer,
  });
  assert.equal(resultado.status, 'FAIL');
  assert.equal(resultado.workflowState.status, 'failed');
  assert.ok(resultado.workflowState.metrics.totalTokens > 5, 'o teto é imposto, não ignorado');
});
