/**
 * `izanagi canvas ...` — Canvas Orchestration (CLI do subsistema de workflows
 * visuais declarativos JSON Canvas 1.0).
 *
 * Subcomandos:
 *   create <nome>              scaffold mínimo (input → agente → output) salvo em canvases/<nome>.canvas
 *   list [dir]                 lista workflows .canvas/.json de um diretório (default: canvases)
 *   validate <arquivo>         schema + semântica com diagnósticos legíveis (exit 1 se inválido)
 *   inspect <arquivo>          compila e lista o DAG, entry/exit, capacidades e modelo por nó
 *   run <arquivo>              executa contra o runtime real (mesma estratégia de producer do `run`)
 *   export <arquivo>           imprime o JSON (com --layout, re-posicionado via autoLayout)
 *   trace [run-id]             observabilidade dos runs de canvas (reusa printTrace)
 *   ui [--port N]              editor visual (servidor em src/runtime/canvas/server.ts)
 *
 * O CLI não executa nada por conta própria: a fonte da verdade é
 * `executeWorkflow`, a mesma API que o SDK (`izanagi.orchestrate`) e o editor
 * visual consomem.
 */

import fs from 'fs';
import path from 'path';
import {
  CanvasWorkflow,
  CanvasExecutionError,
  executeWorkflow,
  type ExecuteWorkflowOptions,
  type WorkflowRunResult,
} from '../../runtime/canvas/api.js';
import { autoLayout, type LayoutDirection } from '../../runtime/canvas/layout.js';
import { formatDiagnostic } from '../../runtime/canvas/diagnostics.js';
import { TraceStore } from '../../runtime/observability/tracer.js';
import type { RunTrace } from '../../runtime/types.js';
import { printTrace } from './trace.js';
import { LLMClient } from '../../runtime/llm/client.js';
import { ResponseCache } from '../../runtime/cache/response-cache.js';
import { ContextResolver } from '../../runtime/orchestration/context-resolver.js';
import { MemoryStore } from '../../runtime/memory/store.js';
import { createHeadlessProducer, createLLMProducer } from '../../runtime/execute.js';
import { validateOutputDir } from '../../runtime/orchestration/delivery.js';
import { buildNodePrompt, findAgentJson } from './run.js';
import type { ExecuteCtx } from '../../runtime/orchestrator.js';
import type { CanvasProduceContext } from '../../runtime/canvas/executor.js';
import type { GraphNode } from '../../runtime/types.js';

const LAYOUT_DIRECTIONS: LayoutDirection[] = ['horizontal', 'vertical', 'tree', 'dag'];

/** Dispatcher de subcomandos — mesmo estilo dos outros comandos da CLI. */
export async function canvasCommand(baseDir: string, args: string[], stateDir = baseDir): Promise<void> {
  const sub = (args[0] ?? 'help').toLowerCase();
  const rest = args.slice(1);

  switch (sub) {
    case 'create':
      await canvasCreate(baseDir, rest);
      break;
    case 'list':
      await canvasList(baseDir, rest);
      break;
    case 'validate':
      await canvasValidate(baseDir, rest);
      break;
    case 'inspect':
      await canvasInspect(baseDir, rest);
      break;
    case 'run':
      await canvasRun(baseDir, rest, stateDir);
      break;
    case 'export':
      await canvasExport(baseDir, rest);
      break;
    case 'trace':
      canvasTrace(stateDir, rest);
      break;
    case 'ui':
      await canvasUI(baseDir, rest, stateDir);
      break;
    case 'help':
    case '--help':
    case '-h':
    case '':
      canvasHelp();
      break;
    default:
      console.error(`\x1b[31mSubcomando desconhecido:\x1b[0m ${sub}\n`);
      canvasHelp();
      process.exit(1);
  }
}

/* ============================ CREATE ============================ */

async function canvasCreate(baseDir: string, args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('\x1b[31mError:\x1b[0m falta o nome do canvas.');
    console.error('Uso: \x1b[1mizanagi canvas create <nome>\x1b[0m\n');
    process.exit(1);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    console.error(`\x1b[31mError:\x1b[0m nome "${name}" inválido (use letras, dígitos, ponto, hífen ou sublinhado).\n`);
    process.exit(1);
  }

  const wf = CanvasWorkflow.createTemplate(name);
  const file = await wf.save(path.join('canvases', `${name}.canvas`));
  const v = wf.validate(baseDir);

  console.log('\n\x1b[36m=== Canvas criado ===\x1b[0m');
  console.log(`  \x1b[1m${name}\x1b[0m · ${wf.definition.nodes.length} nós, ${wf.definition.edges.length} arestas · validação ${v.valid ? '\x1b[32mok\x1b[0m' : `\x1b[31m${v.errors.length} erro(s)\x1b[0m`}`);
  console.log(`  Salvo em: \x1b[36m${file}\x1b[0m`);
  console.log(`  Experimente: \x1b[33mizanagi canvas inspect canvases/${name}.canvas\x1b[0m`);
  console.log(`               \x1b[33mizanagi canvas run canvases/${name}.canvas\x1b[0m\n`);
  if (!v.valid) process.exitCode = 1;
}

/* ============================ LIST ============================ */

async function canvasList(baseDir: string, args: string[]): Promise<void> {
  const dir = args[0] ?? 'canvases';
  const entries = await CanvasWorkflow.list(dir);
  console.log(`\n\x1b[36m=== Canvases (${dir}) ===\x1b[0m\n`);
  if (entries.length === 0) {
    console.log(`  Nenhum canvas em \x1b[33m${dir}/\x1b[0m. Crie um com \x1b[33mizanagi canvas create <nome>\x1b[0m.\n`);
    return;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry);
    try {
      const wf = await CanvasWorkflow.load(file, baseDir);
      const v = wf.validate(baseDir);
      const badge = v.valid ? '\x1b[32mok\x1b[0m' : `\x1b[31m${v.errors.length} erro(s)\x1b[0m`;
      console.log(`  \x1b[1m\x1b[36m${entry}\x1b[0m  ${badge} · ${wf.name}`);
    } catch {
      console.log(`  \x1b[1m\x1b[36m${entry}\x1b[0m  \x1b[31mparse falhou\x1b[0m (arquivo inválido ou caminho relativo errado)`);
    }
  }
  console.log('');
}

/* ============================ VALIDATE ============================ */

async function canvasValidate(baseDir: string, args: string[]): Promise<void> {
  const file = args[0];
  if (!file) {
    console.error('\x1b[31mError:\x1b[0m falta o arquivo de canvas.');
    console.error('Uso: \x1b[1mizanagi canvas validate <arquivo>\x1b[0m\n');
    process.exit(1);
  }

  let wf: CanvasWorkflow;
  try {
    wf = await CanvasWorkflow.load(file, baseDir);
  } catch (err) {
    fail(err);
    return;
  }
  const v = wf.validate(baseDir);

  console.log(`\n\x1b[36m=== Canvas: ${wf.name} ===\x1b[0m\n`);
  if (!v.valid) {
    console.error(`\x1b[31mInválido:\x1b[0m ${v.errors.length} erro(s) bloqueante(s).\x1b[0m`);
    for (const d of v.errors) console.error(`  ${formatDiagnostic(d)}`);
  } else {
    console.log(`  \x1b[32mVálido.\x1b[0m ${v.warnings.length} aviso(s) · ${v.infos.length} info(s)`);
  }
  for (const d of [...v.warnings, ...v.infos]) console.log(`  ${formatDiagnostic(d)}`);
  console.log('');
  if (!v.valid) process.exitCode = 1;
}

/* ============================ INSPECT ============================ */

async function canvasInspect(baseDir: string, args: string[]): Promise<void> {
  const file = args[0];
  if (!file) {
    console.error('\x1b[31mError:\x1b[0m falta o arquivo de canvas.');
    console.error('Uso: \x1b[1mizanagi canvas inspect <arquivo>\x1b[0m\n');
    process.exit(1);
  }

  let wf: CanvasWorkflow;
  try {
    wf = await CanvasWorkflow.load(file, baseDir);
  } catch (err) {
    fail(err);
    return;
  }
  const ir = wf.compile();
  const v = wf.validate(baseDir);

  console.log(`\n\x1b[36m=== Canvas: ${wf.name} ===\x1b[0m\n`);
  console.log(`  \x1b[90mNós:\x1b[0m ${ir.nodes.length} · \x1b[90mArestas:\x1b[0m ${ir.edges.length} · validação ${v.valid ? '\x1b[32mok\x1b[0m' : `\x1b[31m${v.errors.length} erro(s)\x1b[0m`}`);
  console.log(`  \x1b[90mEntry:\x1b[0m ${ir.entryNodes.length > 0 ? ir.entryNodes.join(', ') : 'nenhum'}`);
  console.log(`  \x1b[90mExit:\x1b[0m  ${ir.exitNodes.length > 0 ? ir.exitNodes.join(', ') : 'nenhum'}`);
  const caps = ir.capabilities;
  console.log(`  \x1b[90mCapacidades:\x1b[0m loops ${caps.hasLoops ? 'sim' : 'não'} · branches paralelas ${caps.hasParallelBranches ? 'sim' : 'não'} · endpoints externos ${caps.hasExternalEndpoints ? 'sim' : 'não'}`);

  if (ir.nodes.length > 0) {
    console.log('\n\x1b[1mDAG (nós):\x1b[0m');
    for (const n of ir.nodes) {
      const model = n.model
        ? n.model.mode === 'manual'
          ? `${n.model.provider}/${n.model.model}`
          : n.model.mode
        : 'auto';
      const parts = [`\x1b[36m${n.id}\x1b[0m`, `kind=\x1b[90m${n.kind}\x1b[0m`];
      if (n.agent) parts.push(`agent=\x1b[90m${n.agent}\x1b[0m`);
      if (n.skills && n.skills.length > 0) parts.push(`skills=[\x1b[90m${n.skills.join(', ')}\x1b[0m]`);
      parts.push(`model=\x1b[90m${model}\x1b[0m`);
      console.log(`  ${parts.join(' · ')}`);
    }
  }
  if (ir.edges.length > 0) {
    console.log('\n\x1b[1mArestas:\x1b[0m');
    for (const e of ir.edges) {
      const cond = e.condition ? ` [${e.condition.type}${e.condition.expression ? `: ${e.condition.expression}` : ''}]` : '';
      console.log(`  \x1b[90m${e.from}\x1b[0m -> \x1b[90m${e.to}\x1b[0m${cond}`);
    }
  }
  console.log('');
  if (!v.valid) process.exitCode = 1;
}

/* ============================ RUN ============================ */

interface CanvasRunArgs {
  file: string;
  task?: string;
  input: Record<string, unknown>;
  budget?: number;
  provider?: string;
  dryRun: boolean;
  verbose: boolean;
  fromNode?: string;
  untilNode?: string;
  output?: string;
}

/** Coage o valor de `--input K=V` para o tipo mais útil (número, bool, JSON ou string). */
function coerceInput(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function parseCanvasRunArgs(args: string[]): CanvasRunArgs {
  const input: Record<string, unknown> = {};
  const positionals: string[] = [];
  let task: string | undefined;
  let budget: number | undefined;
  let provider: string | undefined;
  let dryRun = false;
  let verbose = false;
  let fromNode: string | undefined;
  let untilNode: string | undefined;
  let output: string | undefined;

  /** Aceita tanto `--flag valor` quanto `--flag=valor`. */
  const readValue = (arg: string, prefix: string, next: string | undefined): { value?: string; consumed: boolean } => {
    if (arg === prefix) return { value: next, consumed: true };
    if (arg.startsWith(`${prefix}=`)) return { value: arg.slice(prefix.length + 1), consumed: false };
    return { consumed: false };
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === '--task' || arg.startsWith('--task=')) {
      const read = readValue(arg, '--task', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) task = read.value;
    } else if (arg === '--input' || arg.startsWith('--input=')) {
      const read = readValue(arg, '--input', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) {
        const eq = read.value.indexOf('=');
        if (eq > 0) {
          const key = read.value.slice(0, eq).trim();
          const raw = read.value.slice(eq + 1);
          input[key] = coerceInput(raw);
        } else {
          console.error(`\x1b[33mAviso:\x1b[0m --input "${read.value}" sem "=" (esperado K=V): ignorado.`);
        }
      }
    } else if (arg === '--budget' || arg.startsWith('--budget=')) {
      const read = readValue(arg, '--budget', args[i + 1]);
      if (read.consumed) i++;
      const n = Number(read.value);
      if (Number.isFinite(n) && n > 0) budget = Math.floor(n);
    } else if (arg === '--provider' || arg.startsWith('--provider=')) {
      const read = readValue(arg, '--provider', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) provider = read.value.trim().toLowerCase();
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--from-node' || arg.startsWith('--from-node=')) {
      const read = readValue(arg, '--from-node', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) fromNode = read.value;
    } else if (arg === '--until-node' || arg.startsWith('--until-node=')) {
      const read = readValue(arg, '--until-node', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) untilNode = read.value;
    } else if (arg === '--output' || arg.startsWith('--output=')) {
      const read = readValue(arg, '--output', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) output = read.value;
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  if (positionals.length === 0) {
    console.error('\x1b[31mError:\x1b[0m falta o arquivo de canvas.');
    console.error('Uso: \x1b[1mizanagi canvas run <arquivo> [--task T] [--input K=V ...] [--budget N] [--provider P] [--dry-run] [--from-node X] [--until-node Y] [--output DIR]\x1b[0m\n');
    process.exit(1);
  }
  if (positionals.length > 1) {
    console.error(`\x1b[33mAviso:\x1b[0m argumentos extras ignorados: ${positionals.slice(1).join(' ')}`);
  }

  return {
    file: positionals[0] as string,
    ...(task ? { task } : {}),
    input,
    ...(budget !== undefined ? { budget } : {}),
    ...(provider ? { provider } : {}),
    dryRun,
    verbose,
    ...(fromNode ? { fromNode } : {}),
    ...(untilNode ? { untilNode } : {}),
    ...(output ? { output } : {}),
  };
}

/**
 * Constrói o executor do run com a MESMA estratégia da CLI `izanagi run`:
 * providers por chave de ambiente (IZANAGI_*_API_KEY) via LLMClient, producer
 * real quando há provider, headless (simulação) quando não há. O canvas é a
 * INTERFACE; quem produz artefato é o runtime.
 */
interface CanvasExecutorBuild {
  produce?: ExecuteWorkflowOptions['produce'];
  providers: string[];
  headless: boolean;
}

function buildCanvasExecutor(baseDir: string, stateDir: string, opts: { task: string; provider?: string; dryRun: boolean; verbose: boolean }): CanvasExecutorBuild {
  const client = new LLMClient();
  const all = client.configuredProviders();

  if (opts.provider && !all.includes(opts.provider)) {
    console.error(`\x1b[31mError:\x1b[0m provider "${opts.provider}" não está configurado (IZANAGI_*_API_KEY).`);
    console.error(`  Configurados: ${all.length > 0 ? all.join(', ') : 'nenhum'}\n`);
    process.exit(1);
  }
  const providers = opts.provider ? all.filter((p) => p === opts.provider) : all;

  // Sem provider, ou dry-run (nada executa): não há producer a construir.
  if (providers.length === 0 || opts.dryRun) {
    return { providers, headless: true };
  }

  const objective = opts.task;
  const cache = new ResponseCache({ baseDir: stateDir, enabled: ResponseCache.enabledFromEnv() });
  const knowledgeStore = new MemoryStore({ baseDir: stateDir });
  const contextResolver = new ContextResolver({
    knowledge: (query, limit) => knowledgeStore.search(query, limit).map((e) => ({ title: e.title, content: e.content })),
  });
  const llmProducer = createLLMProducer({
    objective,
    client: client as unknown as Parameters<typeof createLLMProducer>[0]['client'],
    cache,
    contextResolver,
    buildSystemPrompt: (node, _ctx: ExecuteCtx, minimalContext?: string) =>
      buildNodePrompt(node, { task: objective, agent: findAgentJson(node.agent ?? '', baseDir) ?? { name: node.agent }, skillChain: node.skills ?? [] }, baseDir, {
        ...(minimalContext ? { context: minimalContext } : {}),
      }),
    onNode: (info) => {
      if (opts.verbose) {
        console.log(`  \x1b[90m[tokens]\x1b[0m nó "${info.nodeId}" (${info.role ?? 'specialist'}/${info.model}): entrada ${info.tokens} · cache-hit ${info.cachedTokens}`);
      }
    },
  });
  const produce: ExecuteWorkflowOptions['produce'] = (node: GraphNode, ctx: CanvasProduceContext) =>
    // ctx do canvas carrega a ponte do ExecuteCtx real; llmProducer lê dela
    llmProducer(node, ctx as unknown as ExecuteCtx);
  return { produce, providers, headless: false };
}

async function canvasRun(baseDir: string, args: string[], stateDir: string): Promise<void> {
  const parsed = parseCanvasRunArgs(args);

  let wf: CanvasWorkflow;
  try {
    wf = await CanvasWorkflow.load(parsed.file, baseDir);
  } catch (err) {
    fail(err);
    return;
  }
  const task = parsed.task ?? wf.name ?? 'workflow canvas';

  // `--output` é validado ANTES de executar, como no `izanagi run`: destino
  // fora da raiz seria descoberto só depois de um grafo inteiro rodado.
  let outputDir: string | undefined;
  if (parsed.output) {
    const check = validateOutputDir(process.cwd(), parsed.output);
    if (!check.ok) {
      console.error(`\x1b[31mError:\x1b[0m --output: ${check.error}\n`);
      process.exit(1);
    }
    outputDir = check.rel;
  }

  console.log('\n\x1b[36m=== Canvas Orchestration ===\x1b[0m');
  console.log(`\x1b[1mWorkflow:\x1b[0m ${wf.name} · tarefa "${task}"\n`);

  const exec = buildCanvasExecutor(baseDir, stateDir, {
    task,
    ...(parsed.provider ? { provider: parsed.provider } : {}),
    dryRun: parsed.dryRun,
    verbose: parsed.verbose,
  });
  if (exec.headless && !parsed.dryRun) {
    console.log('  \x1b[33m⚠ Modo headless:\x1b[0m nenhum provider configurado (IZANAGI_ANTHROPIC_API_KEY / IZANAGI_OPENAI_API_KEY / IZANAGI_GOOGLE_API_KEY / IZANAGI_OPENROUTER_API_KEY).');
    console.log('    Os nós serão SIMULADOS (mesma convenção da CLI \x1b[33mizanagi run\x1b[0m).\n');
  } else if (!exec.headless) {
    console.log(`  \x1b[32m✔ Execução real:\x1b[0m ${exec.providers.join(', ')}\n`);
  }

  const started = Date.now();
  let result: WorkflowRunResult;
  try {
    result = await executeWorkflow(wf, {
      task,
      ...(Object.keys(parsed.input).length > 0 ? { input: parsed.input } : {}),
      ...(parsed.budget !== undefined ? { budget: parsed.budget } : {}),
      baseDir,
      workspaceDir: process.cwd(),
      stateDir,
      dryRun: parsed.dryRun,
      verbose: parsed.verbose,
      ...(parsed.fromNode ? { fromNode: parsed.fromNode } : {}),
      ...(parsed.untilNode ? { untilNode: parsed.untilNode } : {}),
      availableProviders: exec.providers,
      ...(exec.produce ? { produce: exec.produce } : {}),
      onWorkflowEvent: parsed.verbose
        ? (e) => {
            const node = 'nodeId' in e ? ` · nó ${(e as { nodeId?: string }).nodeId ?? ''}` : '';
            console.log(`  \x1b[90m[event]\x1b[0m ${e.type}${node}`);
          }
        : undefined,
    });
  } catch (err) {
    fail(err);
    return;
  }

  const wallMs = Date.now() - started;
  printRunResult(result, wallMs);

  if (outputDir) {
    await dumpRunOutputs(result, outputDir, wf.name);
  }

  if (result.status === 'FAIL' || result.status === 'BLOCKED' || result.status === 'CANCELLED') {
    process.exitCode = 1;
  }
}

function printRunResult(result: WorkflowRunResult, wallMs: number): void {
  const color = statusColor(result.status);
  console.log(`\n\x1b[1mResultado:\x1b[0m ${color}${result.status}\x1b[0m (score ${result.score})`);
  console.log(`  \x1b[90mWorkflow:\x1b[0m ${result.workflowStatus} · headless ${result.headless ? '\x1b[33msim\x1b[0m' : '\x1b[32mnão\x1b[0m'}${result.dryRun ? ' · \x1b[33mdry-run\x1b[0m' : ''}`);

  if (result.dryRun) {
    printDryPlan(result);
  }

  console.log('  \x1b[90mNós:\x1b[0m');
  for (const n of result.nodes) {
    const c = n.status === 'succeeded' ? '\x1b[32m' : n.status === 'failed' ? '\x1b[31m' : n.status === 'skipped' ? '\x1b[90m' : '\x1b[33m';
    const latency = n.latencyMs !== undefined ? ` · ${n.latencyMs}ms` : '';
    const tokens = n.tokensUse ? ` · ${n.tokensUse.total} tokens` : '';
    const err = n.error ? ` · \x1b[31m${n.error.slice(0, 120)}\x1b[0m` : '';
    console.log(`    ${c}${n.status.padEnd(10)}\x1b[0m ${n.id}${latency}${tokens}${err}`);
  }

  const cost = result.metrics.estimatedCost !== undefined ? ` · $${result.metrics.estimatedCost.toFixed(4)}` : '';
  console.log(`  \x1b[90mMétricas:\x1b[0m ${result.metrics.totalLatencyMs}ms de runtime · ${result.metrics.totalTokens} tokens${cost} · parede ${wallMs}ms`);

  if (result.traceFile) {
    const traceRunId = traceIdFromFile(result.traceFile);
    console.log(`  \x1b[90mTrace:\x1b[0m ${result.traceFile}`);
    if (traceRunId) {
      console.log(`  \x1b[90mVer trace:\x1b[0m \x1b[36mizanagi canvas trace ${traceRunId}\x1b[0m`);
    }
  }
  console.log('');
}

/** Extrai o runId interno de um arquivo de trace (o id real do Orchestrator). */
function traceIdFromFile(file: string): string | null {
  try {
    const t = JSON.parse(fs.readFileSync(file, 'utf-8')) as RunTrace;
    return t.runId ?? null;
  } catch {
    return null;
  }
}

function printDryPlan(result: WorkflowRunResult): void {
  const plan = result.plan;
  if (!plan) return;
  console.log(`  \x1b[90mPlano (dry-run):\x1b[0m modo ${plan.mode} · ${plan.estimate.nodes} tarefa(s) em ${plan.estimate.parallelStages} etapa(s)`);
  plan.graph.parallelBatches.forEach((batch, i) => {
    console.log(`    \x1b[90mBatch ${i + 1}:\x1b[0m [${batch.join(', ')}]`);
  });
  const entries = Object.entries(result.modelByNode);
  if (entries.length > 0) {
    console.log('  \x1b[90mModelos por nó:\x1b[0m');
    for (const [nodeId, info] of entries) {
      console.log(`    \x1b[90m${nodeId}:\x1b[0m ${info.model} \x1b[90m(${info.provider}, ${info.source})\x1b[0m`);
    }
  }
}

/**
 * Grava o relatório do run + o conteúdo produzido por nó em `--output`.
 *
 * A API de canvas não materializa entrega por si (não há nó `deliver` no
 * executor): a gravação é responsabilidade desta camada CLI, para quem quer a
 * saída em disco. `run.json` guarda o relatório; cada nó com saída vira
 * `<nodeId>.md` (string) ou `<nodeId>.json` (estruturado), sob
 * `<output>/<slug-do-workflow>/`. Nomes sanitizados contra path traversal.
 */
async function dumpRunOutputs(result: WorkflowRunResult, outputDir: string, wfName: string): Promise<void> {
  const slug = slugify(wfName);
  const dir = path.resolve(process.cwd(), outputDir, slug);
  await fs.promises.mkdir(dir, { recursive: true });

  const written: string[] = [];
  const manifest = {
    runId: result.runId,
    status: result.status,
    score: result.score,
    workflowStatus: result.workflowStatus,
    headless: result.headless,
    dryRun: result.dryRun,
    nodes: result.nodes.map((n) => ({
      id: n.id,
      status: n.status,
      latencyMs: n.latencyMs,
      tokensUse: n.tokensUse,
      error: n.error,
    })),
    traceFile: result.traceFile,
  };
  const manifestFile = path.join(dir, 'run.json');
  await fs.promises.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8');
  written.push(path.relative(process.cwd(), manifestFile));

  for (const [index, n] of result.nodes.entries()) {
    if (n.status !== 'succeeded' || n.output === undefined) continue;
    const content = serializeOutput(n.output);
    if (content === null) continue;
    const safeId = sanitizeNodeId(n.id, index);
    const ext = typeof n.output === 'string' ? 'md' : 'json';
    const file = path.join(dir, `${safeId}.${ext}`);
    await fs.promises.writeFile(file, content, 'utf-8');
    written.push(path.relative(process.cwd(), file));
  }

  console.log(`  \x1b[90mSaída:\x1b[0m ${written.length} arquivo(s) gravados em \x1b[36m${path.relative(process.cwd(), dir) || dir}\x1b[0m`);
  for (const w of written) console.log(`    \x1b[90m•\x1b[0m ${w}`);
}

function serializeOutput(output: unknown): string | null {
  if (typeof output === 'string') return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

function sanitizeNodeId(id: string, index: number): string {
  const clean = id.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^-+|-+$/g, '');
  return clean.length > 0 ? clean : `node-${index}`;
}

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'canvas';
}

function statusColor(status: string): string {
  if (status === 'PASS') return '\x1b[32m';
  if (status === 'PASS_WITH_WARNINGS' || status === 'HUMAN_REQUIRED') return '\x1b[33m';
  if (status === 'FAIL' || status === 'BLOCKED' || status === 'CANCELLED') return '\x1b[31m';
  return '\x1b[90m';
}

/* ============================ EXPORT ============================ */

async function canvasExport(baseDir: string, args: string[]): Promise<void> {
  let file: string | undefined;
  let direction: LayoutDirection | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === '--layout' || arg.startsWith('--layout=')) {
      let raw: string | undefined;
      if (arg === '--layout') {
        raw = args[i + 1];
        i++;
      } else {
        raw = arg.slice('--layout='.length);
      }
      const value = (raw ?? '').toLowerCase();
      if (LAYOUT_DIRECTIONS.includes(value as LayoutDirection)) {
        direction = value as LayoutDirection;
      } else {
        console.error(`\x1b[33mAviso:\x1b[0m --layout "${raw}" inválido (use ${LAYOUT_DIRECTIONS.join('|')}): ignorado.`);
      }
    } else if (!arg.startsWith('-') && file === undefined) {
      file = arg;
    }
  }

  if (!file) {
    console.error('\x1b[31mError:\x1b[0m falta o arquivo de canvas.');
    console.error('Uso: \x1b[1mizanagi canvas export <arquivo> [--layout horizontal|vertical|tree|dag]\x1b[0m\n');
    process.exit(1);
  }

  let wf: CanvasWorkflow;
  try {
    wf = await CanvasWorkflow.load(file, baseDir);
  } catch (err) {
    fail(err);
    return;
  }

  const def = wf.definition;
  if (direction) {
    const ir = wf.compile();
    const layout = autoLayout(ir, direction);
    const byId = new Map(layout.positions.map((p) => [p.id, p]));
    const nodes = def.nodes.map((n) => {
      const pos = byId.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    });
    process.stderr.write(`auto-layout "${layout.algorithm}": ${layout.positions.length} nós re-posicionados\n`);
    console.log(JSON.stringify({ ...def, nodes }, null, 2));
    return;
  }
  console.log(JSON.stringify(def, null, 2));
}

/* ============================ TRACE ============================ */

function canvasTrace(stateDir: string, args: string[]): void {
  const store = new TraceStore({ baseDir: stateDir });
  const runId = args[0];

  if (!runId) {
    canvasTraceList(store);
    return;
  }

  let trace = store.load(runId);
  // Aceita também um caminho direto para o arquivo de trace (o run imprime o
  // traceFile no resultado, e o id interno nem sempre é o mesmo do run).
  if (!trace && fs.existsSync(runId)) {
    try {
      trace = JSON.parse(fs.readFileSync(runId, 'utf-8')) as RunTrace;
    } catch {
      trace = null;
    }
  }
  if (!trace) {
    console.error(`\x1b[31mTrace "${runId}" não encontrado.\x1b[0m`);
    console.error('Liste com \x1b[33mizanagi canvas trace\x1b[0m\n');
    process.exit(1);
  }
  printTrace(trace);
}

function canvasTraceList(store: TraceStore): void {
  const traces = store.list(20);
  console.log(`\n\x1b[35m=== Canvas Traces (${traces.length}) ===\x1b[0m\n`);
  if (traces.length === 0) {
    console.log('  Nenhum trace ainda. Rode \x1b[33mizanagi canvas run <arquivo>\x1b[0m para gerar o primeiro.\n');
    return;
  }
  for (const t of traces) {
    const verdict = t.evaluation?.verdict ?? '?';
    const color = verdict === 'PASS' ? '\x1b[32m' : verdict === 'FAIL' || verdict === 'BLOCKED' ? '\x1b[31m' : verdict === 'PASS_WITH_WARNINGS' ? '\x1b[33m' : '\x1b[90m';
    console.log(`\x1b[1m\x1b[36m${t.runId}\x1b[0m`);
    console.log(`  \x1b[90mTask:\x1b[0m ${t.task.slice(0, 90)}`);
    console.log(`  \x1b[90mStatus:\x1b[0m ${color}${verdict}\x1b[0m score ${t.evaluation?.score ?? '?'} | ${t.durationMs}ms | tokens ${t.tokens?.total ?? 0}\n`);
  }
  console.log('Detalhes: \x1b[33mizanagi canvas trace <run-id>\x1b[0m\n');
}

/* ============================ UI ============================ */

/**
 * Superfície mínima do módulo do editor visual. O arquivo
 * `src/runtime/canvas/server.ts` é escrito em paralelo por outro agente do
 * swarm: o import é dinâmico e tolerante a ausência (o TS2307 de módulo não
 * encontrado durante esta janela de integração é esperado).
 */
interface CanvasServerModule {
  createCanvasServer?: (opts: { port: number; baseDir: string; stateDir?: string; workspaceDir?: string }) => unknown | Promise<unknown>;
}

async function canvasUI(baseDir: string, args: string[], stateDir: string): Promise<void> {
  let port = 4322;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === '--port' || arg.startsWith('--port=')) {
      const raw = arg === '--port' ? args[i + 1] : arg.slice('--port='.length);
      if (arg === '--port') i++;
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0 || n >= 65536) {
        console.error(`\x1b[31mError:\x1b[0m --port "${raw}" inválido (1..65535).\n`);
        process.exit(1);
      }
      port = Math.floor(n);
    }
  }

  let mod: CanvasServerModule;
  try {
    mod = (await import('../../runtime/canvas/server.js')) as CanvasServerModule;
  } catch {
    console.error('\x1b[31mEditor visual não compilado ainda:\x1b[0m src/runtime/canvas/server.ts está em construção (integração paralela do swarm).');
    console.error('  Rode \x1b[33mnpm run build\x1b[0m após a integração completa para habilitar \x1b[33mizanagi canvas ui\x1b[0m.\n');
    process.exitCode = 1;
    return;
  }
  if (typeof mod.createCanvasServer !== 'function') {
    console.error('\x1b[31mEditor visual indisponível:\x1b[0m createCanvasServer não exportado por src/runtime/canvas/server.ts.\n');
    process.exitCode = 1;
    return;
  }

  const handle = mod.createCanvasServer({ port, baseDir, stateDir, workspaceDir: process.cwd() });
  const server = await handle;
  // Tolerante às duas formas comuns de servidor: expor .start() ou .listen().
  const start = (server as { start?: () => unknown }).start ?? (server as { listen?: () => unknown }).listen;
  if (typeof start !== 'function') {
    console.error('\x1b[31mEditor visual indisponível:\x1b[0m createCanvasServer não devolveu um servidor iniciável.\n');
    process.exitCode = 1;
    return;
  }
  await start();

  console.log('\n\x1b[36m=== Canvas Editor ===\x1b[0m');
  console.log(`  \x1b[1mhttp://localhost:${port}\x1b[0m  (Ctrl-C para encerrar)\n`);

  // Mantém o processo vivo até Ctrl-C (intervalo de relógio longo; o SIGINT
  // resolve e o CLI encerra normal).
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {}, 1 << 30);
    process.once('SIGINT', () => {
      clearInterval(iv);
      resolve();
    });
  });
}

/* ============================ HELP / ERROS ============================ */

function fail(err: unknown): void {
  if (err instanceof CanvasExecutionError) {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
    for (const d of err.diagnostics?.errors ?? []) {
      console.error(`  ${formatDiagnostic(d)}`);
    }
  } else {
    console.error(`\x1b[31mError:\x1b[0m ${err instanceof Error ? err.message : String(err)}`);
  }
  console.error('');
  process.exitCode = 1;
}

function canvasHelp(): void {
  console.log(`
\x1b[1m\x1b[36mizanagi canvas - Canvas Orchestration (workflows visuais JSON Canvas 1.0)\x1b[0m

\x1b[1mUsage:\x1b[0m
  izanagi canvas <subcomando> [opções]

  \x1b[32mcreate <nome>\x1b[0m                    Cria um scaffold mínimo (input -> agente -> output) em canvases/<nome>.canvas.
  \x1b[32mlist [dir]\x1b[0m                       Lista workflows .canvas/.json (default: canvases/).
  \x1b[32mvalidate <arquivo>\x1b[0m               Valida schema + semântica. Exit 1 se inválido.
  \x1b[32minspect <arquivo>\x1b[0m               Compila e mostra o DAG (nós, entry/exit, capacidades, modelo por nó).
  \x1b[32mrun <arquivo>\x1b[0m                   Executa contra o runtime real (headless sem provider configurado).
                          (--task T · --input K=V (repetível) · --budget N · --provider P · --dry-run)
                          (--from-node X · --until-node Y · --output DIR · --verbose)
  \x1b[32mexport <arquivo>\x1b[0m                Imprime o JSON do canvas.
                          (--layout horizontal|vertical|tree|dag re-posiciona via autoLayout)
  \x1b[32mtrace [run-id]\x1b[0m                  Observabilidade: lista/mostra traces de canvas.
  \x1b[32mui [--port N]\x1b[0m                  Sobe o editor visual (default: porta 4322).
  \x1b[32mhelp\x1b[0m                            Mostra esta ajuda.

\x1b[1mExamples:\x1b[0m
  izanagi canvas create minha-feature
  izanagi canvas inspect canvases/minha-feature.canvas
  izanagi canvas run canvases/minha-feature.canvas --task "Implementar a feature" --budget 30000
  izanagi canvas run canvases/minha-feature.canvas --dry-run
  izanagi canvas export canvases/minha-feature.canvas --layout horizontal
  izanagi canvas trace
\x1b[0m
`);
}