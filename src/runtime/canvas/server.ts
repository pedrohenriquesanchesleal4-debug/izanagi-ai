/**
 * Canvas Orchestration — servidor HTTP + SSE do editor visual.
 *
 * Superfície consumida pela CLI (`izanagi canvas ui`): `createCanvasServer`
 * devolve um handle com `.start()` que liga o listener na porta pedida.
 *
 * O servidor NÃO executa nada por conta própria: um run é um `executeWorkflow`
 * em background (a mesma API do CLI/SDK). As responsabilidades desta camada são:
 *
 *   1. Expor os canvaos do diretório `canvases/` (listar, carregar, criar,
 *      salvar com re-validação e auto-layout).
 *   2. Disparar runs em background com o mesmo executor do `izanagi canvas run`
 *      (producer real via LLMClient quando há provider; headless sem provider).
 *   3. Transmitir a timeline de eventos do run ao navegador via SSE, com replay
 *      dos eventos já emitidos para conexões atrasadas.
 *   4. Controles de ciclo de vida (pause/resume como marca de estado do editor;
 *      stop como aborto real do run via AbortController e evento
 *      `workflow.cancelled`).
 *
 * Segurança: nomes de canvas validados por regex (sem path traversal), corpo
 * JSON limitado a 10MB, CORS `*` (ferramenta local de desenvolvimento).
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { URL } from 'url';

import {
  CanvasExecutionError,
  CanvasWorkflow,
  executeWorkflow,
  loadValidatorDeps,
  type ExecuteWorkflowOptions,
  type WorkflowRunResult,
} from './api.js';
import { validateCanvas } from './validate.js';
import { autoLayout, type LayoutDirection } from './layout.js';
import type { CanvasDefinition, WorkflowStatus } from './types.js';
import type { WorkflowEvent } from './workflow-events.js';
import { makeWorkflowLifecycle } from './workflow-events.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import { ModelRouter } from '../model/router.js';
import { LLMClient } from '../llm/client.js';
import { createLLMProducer } from '../execute.js';
import { ResponseCache } from '../cache/response-cache.js';
import { ContextResolver } from '../orchestration/context-resolver.js';
import { MemoryStore } from '../memory/store.js';
import type { ExecuteCtx } from '../orchestrator.js';
import type { GraphNode } from '../types.js';
import type { CanvasProduceContext } from './executor.js';
import { CANVAS_EDITOR_HTML } from './editor-page.js';

export interface CanvasServerOptions {
  /** Porta do editor visual (default 4322, mesmo default da CLI `canvas ui`). */
  port?: number;
  /** Raiz do projeto (onde vivem agents/skills e o diretório canvases/). */
  baseDir: string;
  /** Diretório de estado do projeto (cache e contexto do executor). Default: baseDir. */
  stateDir?: string;
  /** Diretório de trabalho do run (delivery/workspace). Default: baseDir. */
  workspaceDir?: string;
}

export interface CanvasServerHandle {
  /** Exposto .start()/.listen() como a CLI espera: uma função que liga o listener. */
  start: () => Promise<void>;
  /** Encerra o servidor (para testes). */
  close: () => Promise<void>;
  server: http.Server;
  port: number;
}

type RunStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'dry-run';

/** Registro vivo de um run em background (memória do servidor, sem persistência). */
interface RunRecord {
  runId: string;
  name: string;
  status: RunStatus;
  workflowStatus: WorkflowStatus | 'pending' | undefined;
  score: number | undefined;
  dryRun: boolean;
  headless: boolean;
  modelByNode: Record<string, { model: string; provider: string; source: 'auto' | 'manual' | 'inherit' }>;
  startedAt: string;
  endedAt: string | undefined;
  error: string | undefined;
  result: WorkflowRunResult | undefined;
  events: WorkflowEvent[];
  controller: AbortController | undefined;
}

interface ServerState {
  baseDir: string;
  stateDir: string;
  workspaceDir: string;
  canvasesDir: string;
  runs: Map<string, RunRecord>;
  sseClients: Map<string, Set<http.ServerResponse>>;
}

/** Erro com status HTTP: capturado no topo do handler e serializado como JSON. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const NAME_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const DEFAULT_PORT = 4322;
const SSE_HEARTBEAT_MS = 15_000;
const MAX_RECORDED_EVENTS = 500;

/** Cria o servidor do editor visual configurado para o projeto informado. */
export async function createCanvasServer(opts: CanvasServerOptions): Promise<CanvasServerHandle> {
  const baseDir = path.resolve(opts.baseDir);
  const stateDir = path.resolve(opts.stateDir ?? baseDir);
  const workspaceDir = path.resolve(opts.workspaceDir ?? baseDir);
  const canvasesDir = path.resolve(baseDir, 'canvases');
  const port = opts.port ?? DEFAULT_PORT;

  const state: ServerState = {
    baseDir,
    stateDir,
    workspaceDir,
    canvasesDir,
    runs: new Map(),
    sseClients: new Map(),
  };

  const server = http.createServer((req, res) => {
    void handleRequest(state, req, res).catch((err: unknown) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof HttpError ? err.message : err instanceof Error ? err.message : String(err);
      writeJson(res, status, { error: message });
    });
  });

  let listening = false;
  const start = (): Promise<void> => {
    if (listening) return Promise.resolve();
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        listening = true;
        server.removeListener('error', reject);
        resolve();
      });
    });
  };

  const close = (): Promise<void> => {
    if (!listening) return Promise.resolve();
    return new Promise((resolve) => {
      for (const clients of state.sseClients.values()) {
        for (const res of clients) res.end();
      }
      state.sseClients.clear();
      server.close(() => resolve());
    });
  };

  return { start, close, server, port };
}

/* ============================ HTTP HELPERS ============================ */

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function parseJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'corpo excede o limite de 10MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch {
        reject(new HttpError(400, 'JSON inválido no corpo da requisição'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

async function bodyAs<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  const parsed = (await parseJsonBody(req)) as T;
  return parsed;
}

/** Envia um evento SSE; na falha de escrita remove o cliente (conexão morta). */
function sseSend(state: ServerState, runId: string, res: http.ServerResponse, event: string, payload: unknown): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  } catch {
    const clients = state.sseClients.get(runId);
    clients?.delete(res);
  }
}

function broadcast(state: ServerState, runId: string, payload: unknown, event = 'workflow-event'): void {
  const clients = state.sseClients.get(runId);
  if (!clients) return;
  for (const res of Array.from(clients)) {
    sseSend(state, runId, res, event, payload);
  }
}

/* ============================ EXECUTOR (mesma estratégia do CLI) ============================ */

interface CanvasExecutorBuild {
  produce?: ExecuteWorkflowOptions['produce'];
  providers: string[];
  headless: boolean;
}

/** Prompt de sistema do nó: identidade do agente + skills + tarefa do run. */
function buildCanvasNodePrompt(node: GraphNode, task: string, registry: AgentCapabilityRegistry): string {
  const lines: string[] = [];
  lines.push('# IZANAGI AI — Canvas Orchestration (editor visual)');
  lines.push('');
  lines.push(`Tarefa do workflow: ${task}`);
  lines.push(`Nó em execução: ${node.id}`);
  lines.push(`Tipo do nó: ${String(node.kind ?? 'agent')}`);
  const agent = node.agent ? registry.get(node.agent) : undefined;
  if (node.agent) {
    if (agent) {
      lines.push(`Papel do agente: ${agent.name} (${agent.role}) — ${agent.purpose}`);
      if (agent.capabilities.length > 0) lines.push(`Capacidades: ${agent.capabilities.join(', ')}`);
    } else {
      lines.push(`Papel do agente: ${node.agent}`);
    }
  }
  const skills = node.skills ?? [];
  if (skills.length > 0) lines.push(`Skills aplicáveis: ${skills.join(', ')}`);
  lines.push('');
  lines.push('Entregue o artefato pedido pelo contrato do nó em markdown ou JSON estruturado. Não invente caminhos de arquivo nem APIs que não existem no repositório.');
  return lines.join('\n');
}

/** Constrói o producer do run: real quando há provider configurado, headless senão. */
function buildCanvasExecutor(
  baseDir: string,
  stateDir: string,
  opts: { task: string; provider?: string; dryRun: boolean },
): CanvasExecutorBuild {
  const client = new LLMClient();
  const all = client.configuredProviders();
  const providers = opts.provider ? all.filter((p) => p === opts.provider) : all;

  // Sem provider, ou dry-run (nada executa): nenhum producer a construir.
  if (providers.length === 0 || opts.dryRun) {
    return { providers, headless: true };
  }

  const cache = new ResponseCache({ baseDir: stateDir, enabled: ResponseCache.enabledFromEnv() });
  const knowledgeStore = new MemoryStore({ baseDir: stateDir });
  const contextResolver = new ContextResolver({
    knowledge: (query, limit) =>
      knowledgeStore.search(query, limit).map((e) => ({ title: e.title, content: e.content })),
  });
  const llmProducer = createLLMProducer({
    objective: opts.task,
    client: client as unknown as Parameters<typeof createLLMProducer>[0]['client'],
    cache,
    contextResolver,
    buildSystemPrompt: (node: GraphNode, _ctx: ExecuteCtx, minimalContext?: string) => {
      const registry = new AgentCapabilityRegistry({ baseDir });
      const base = buildCanvasNodePrompt(node, opts.task, registry);
      return minimalContext ? `${base}\n\nContexto mínimo já levantado no projeto (não releia estes arquivos):\n${minimalContext}` : base;
    },
  });
  const produce: ExecuteWorkflowOptions['produce'] = (node: GraphNode, ctx: CanvasProduceContext) =>
    // O ctx do canvas carrega a ponte do ExecuteCtx real (model/provider/
    // contract/execBudget/signal) — o producer LLM lê dela. O cast é só forma:
    // os campos que o llmProducer consome estão no objeto em runtime.
    llmProducer(node, ctx as unknown as ExecuteCtx);
  return { produce, providers, headless: false };
}

/* ============================ ROTAS ============================ */

async function handleRequest(state: ServerState, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // CORS: liberado para ferramenta local de desenvolvimento.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const segments = url.pathname.split('/').filter((s) => s.length > 0);

  if (req.method === 'GET' && segments.length === 0) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(CANVAS_EDITOR_HTML);
    return;
  }

  if (req.method === 'GET' && segments[0] === 'api') {
    await handleGetApi(state, req, res, segments.slice(1));
    return;
  }

  if (req.method === 'POST' && segments[0] === 'api') {
    await handlePostApi(state, req, res, segments.slice(1));
    return;
  }

  throw new HttpError(404, 'rota não encontrada');
}

/* ---------------------------- GET ---------------------------- */

async function handleGetApi(state: ServerState, req: http.IncomingMessage, res: http.ServerResponse, seg: string[]): Promise<void> {
  if (seg.length === 0) {
    throw new HttpError(404, 'rota não encontrada');
  }

  const head = seg[0] as string;

  if (head === 'canvases' && seg.length === 1) {
    const entries = await CanvasWorkflow.list(state.canvasesDir);
    writeJson(res, 200, { canvases: entries });
    return;
  }

  if (head === 'canvases' && seg.length === 2) {
    const name = seg[1] as string;
    assertName(name);
    const file = path.join(state.canvasesDir, `${name}.canvas`);
    if (!fs.existsSync(file)) throw new HttpError(404, `canvas "${name}" não encontrado`);
    const wf = await CanvasWorkflow.load(file, state.baseDir);
    writeJson(res, 200, { name: wf.name, definition: wf.definition });
    return;
  }

  if (head === 'agents') {
    const registry = new AgentCapabilityRegistry({ baseDir: state.baseDir });
    const agents = registry
      .list()
      .map((a) => ({ id: a.id, name: a.name, purpose: a.purpose, role: a.role, costClass: a.costClass, skills: a.skills, chains: Object.keys(a.chains) }));
    writeJson(res, 200, { agents });
    return;
  }

  if (head === 'skills') {
    const deps = await loadValidatorDeps(state.baseDir);
    writeJson(res, 200, { skills: Array.from(deps.skills ?? new Set<string>()).sort() });
    return;
  }

  if (head === 'models') {
    const client = new LLMClient();
    const configured = new Set(client.configuredProviders());
    const catalog = ModelRouter.loadProjectProviders(state.baseDir);
    writeJson(res, 200, {
      providers: catalog.map((p) => ({
        id: p.id,
        name: p.name ?? p.id,
        configured: configured.has(p.id),
        models: p.models.map((m) => ({
          id: m.id,
          tier: m.tier,
          contextWindow: m.contextWindow ?? null,
          costPer1kInput: m.costPer1kInput ?? null,
          costPer1kOutput: m.costPer1kOutput ?? null,
          avgLatencyMs: m.avgLatencyMs ?? null,
        })),
      })),
    });
    return;
  }

  if (head === 'runs' && seg.length === 1) {
    const summary = Array.from(state.runs.values()).map((r) => runSummary(r));
    writeJson(res, 200, { runs: summary });
    return;
  }

  if (head === 'runs' && seg.length === 2) {
    const rec = state.runs.get(seg[1] as string);
    if (!rec) throw new HttpError(404, 'run não encontrado');
    writeJson(res, 200, runDetail(rec));
    return;
  }

  if (head === 'runs' && seg.length === 3 && seg[2] === 'events') {
    const rec = state.runs.get(seg[1] as string);
    if (!rec) throw new HttpError(404, 'run não encontrado');
    attachSse(state, rec, req, res);
    return;
  }

  throw new HttpError(404, 'rota não encontrada');
}

/** Conecta um cliente EventSource ao run: envia estado atual + replay + heartbeat. */
function attachSse(state: ServerState, rec: RunRecord, req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  let clients = state.sseClients.get(rec.runId);
  if (!clients) {
    clients = new Set();
    state.sseClients.set(rec.runId, clients);
  }
  clients.add(res);

  // Estado atual do run (sincroniza reconexões).
  sseSend(state, rec.runId, res, 'run-status', runSummary(rec));

  // Replay da timeline já emitida.
  for (const evt of rec.events) {
    sseSend(state, rec.runId, res, 'workflow-event', evt);
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, SSE_HEARTBEAT_MS);

  res.on('close', () => {
    clearInterval(heartbeat);
    clients?.delete(res);
  });
  req.on('close', () => {
    clearInterval(heartbeat);
    clients?.delete(res);
  });
}

/* ---------------------------- POST ---------------------------- */

async function handlePostApi(state: ServerState, req: http.IncomingMessage, res: http.ServerResponse, seg: string[]): Promise<void> {
  if (seg.length === 0) throw new HttpError(404, 'rota não encontrada');
  const head = seg[0] as string;

  if (head === 'canvases' && seg.length === 1) {
    const body = await bodyAs<{ name?: string; agent?: string; label?: string }>(req);
    const name = (body.name ?? '').trim();
    assertName(name);
    const wf = CanvasWorkflow.createTemplate(name, {
      ...(body.agent ? { agent: body.agent } : {}),
      ...(body.label ? { label: body.label } : {}),
    });
    const file = await wf.save(path.join(state.canvasesDir, `${name}.canvas`));
    const v = wf.validate(state.baseDir);
    writeJson(res, 200, { ok: true, name, definition: wf.definition, path: file, valid: v.valid });
    return;
  }

  if (head === 'canvases' && seg.length === 2 && seg[1] === 'validate') {
    const body = await bodyAs<{ definition?: unknown }>(req);
    const definition = body.definition ?? body;
    const wf = CanvasWorkflow.fromJson(definition as CanvasDefinition, 'validation');
    const v = await validateCanvas(wf.definition, await loadValidatorDeps(state.baseDir));
    writeJson(res, 200, { name: wf.name, ...v });
    return;
  }

  if (head === 'canvases' && seg.length === 2 && seg[1] === 'layout') {
    const body = await bodyAs<{ definition?: unknown; direction?: LayoutDirection }>(req);
    const definition = body.definition ?? body;
    const direction: LayoutDirection = body.direction ?? 'horizontal';
    const wf = CanvasWorkflow.fromJson(definition as CanvasDefinition, 'layout');
    const ir = wf.compile();
    const layout = autoLayout(ir, direction);
    const byId = new Map(layout.positions.map((p) => [p.id, p]));
    const nodes = wf.definition.nodes.map((n) => {
      const pos = byId.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    });
    const relayouted: CanvasDefinition = { ...wf.definition, nodes };
    writeJson(res, 200, { definition: relayouted, positions: layout.positions, direction, algorithm: layout.algorithm });
    return;
  }

  if (head === 'canvases' && seg.length === 3 && seg[2] === 'save') {
    const name = seg[1] as string;
    assertName(name);
    const body = await bodyAs<{ definition?: unknown }>(req);
    const definition = body.definition as CanvasDefinition;
    if (!definition || typeof definition !== 'object' || !Array.isArray((definition as { nodes?: unknown }).nodes)) {
      throw new HttpError(400, 'corpo deve conter { definition: { nodes, edges } }');
    }
    const wf = CanvasWorkflow.fromJson(definition, name);
    const v = wf.validate(state.baseDir);
    if (!v.valid) {
      writeJson(res, 422, {
        error: `canvas "${name}" inválido (${v.errors.length} erro(s) bloqueante(s))`,
        name,
        diagnostics: v.diagnostics,
        errors: v.errors,
        warnings: v.warnings,
        infos: v.infos,
      });
      return;
    }
    const file = path.join(state.canvasesDir, `${name}.canvas`);
    await fs.promises.mkdir(state.canvasesDir, { recursive: true });
    await fs.promises.writeFile(file, `${JSON.stringify(definition, null, 2)}\n`, 'utf-8');
    writeJson(res, 200, { ok: true, name, path: file });
    return;
  }

  if (head === 'run' && seg.length === 1) {
    await handleStartRun(state, req, res);
    return;
  }

  if (head === 'run' && seg.length === 2) {
    const action = seg[1];
    const body = await bodyAs<{ runId?: string }>(req);
    const runId = body.runId ?? '';
    const rec = state.runs.get(runId);
    if (!rec) throw new HttpError(404, 'run não encontrado');
    if (action === 'pause') {
      await pauseRun(state, rec);
      writeJson(res, 200, { ok: true, runId });
      return;
    }
    if (action === 'resume') {
      await resumeRun(state, rec);
      writeJson(res, 200, { ok: true, runId });
      return;
    }
    if (action === 'stop') {
      await stopRun(state, rec);
      writeJson(res, 200, { ok: true, runId });
      return;
    }
    throw new HttpError(404, 'ação de run desconhecida (use pause, resume ou stop)');
  }

  throw new HttpError(404, 'rota não encontrada');
}

/* ============================ RUN EM BACKGROUND ============================ */

interface RunRequest {
  name?: string;
  definition?: CanvasDefinition;
  task?: string;
  input?: Record<string, unknown>;
  budget?: number;
  timeoutMs?: number;
  provider?: string;
  dryRun?: boolean;
  fromNode?: string;
  untilNode?: string;
}

async function handleStartRun(state: ServerState, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await bodyAs<RunRequest>(req);

  // Resolve o workflow por nome no disco ou por definição inline (editor).
  let wf: CanvasWorkflow;
  try {
    if (body.definition) {
      const name = body.name ?? 'inline';
      wf = CanvasWorkflow.fromJson(body.definition, name);
    } else if (body.name) {
      assertName(body.name);
      wf = await CanvasWorkflow.load(path.join(state.canvasesDir, `${body.name}.canvas`), state.baseDir);
    } else {
      throw new HttpError(400, 'informe "name" (canvas salvo) ou "definition" (canvas inline)');
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, `não foi possível carregar o canvas: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Validação ANTES de qualquer run: canvas inválido nunca chega ao background.
  const validation = wf.validate(state.baseDir);
  if (!validation.valid) {
    writeJson(res, 422, {
      error: `canvas inválido (${validation.errors.length} erro(s) bloqueante(s))`,
      name: wf.name,
      diagnostics: validation.diagnostics,
      errors: validation.errors,
      warnings: validation.warnings,
      infos: validation.infos,
    });
    return;
  }

  const task = (body.task ?? '').trim() || `workflow ${wf.name}`;
  const dryRun = Boolean(body.dryRun);

  // Events são emitidos sincronamente durante a chamada de executeWorkflow (o
  // primeiro evento, workflow.started, é forward() no corpo da função): o runId
  // interno fica conhecido logo após a chamada retornar, antes de qualquer await.
  let pendingRunId = '';
  const pendingEvents: WorkflowEvent[] = [];
  const exec = buildCanvasExecutor(state.baseDir, state.stateDir, { task, ...(body.provider ? { provider: body.provider } : {}), dryRun });

  const runPromise = executeWorkflow(wf, {
    baseDir: state.baseDir,
    workspaceDir: state.workspaceDir,
    stateDir: state.stateDir,
    task,
    ...(body.input !== undefined && body.input !== null ? { input: body.input } : {}),
    ...(body.budget !== undefined ? { budget: body.budget } : {}),
    ...(body.timeoutMs !== undefined ? { timeoutMs: body.timeoutMs } : {}),
    dryRun,
    ...(body.fromNode ? { fromNode: body.fromNode } : {}),
    ...(body.untilNode ? { untilNode: body.untilNode } : {}),
    availableProviders: exec.providers,
    ...(exec.produce ? { produce: exec.produce } : {}),
    onWorkflowEvent: (evt: WorkflowEvent) => {
      if (!pendingRunId) pendingRunId = evt.runId;
      pendingEvents.push(evt);
      if (state.sseClients.has(pendingRunId)) {
        broadcast(state, pendingRunId, evt, 'workflow-event');
      }
    },
  });

  // Falha antes do primeiro evento (compile/prune/plano): o run nem começou.
  if (!pendingRunId) {
    try {
      await runPromise;
      // Caso teórico: resolveu sem nunca emitir workflow.started (não acontece hoje).
      throw new HttpError(500, 'run terminou sem emitir workflow.started');
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(422, `run não iniciou: ${err instanceof CanvasExecutionError ? err.message : err instanceof Error ? err.message : String(err)}`);
    }
  }

  const runId = pendingRunId;
  const rec: RunRecord = {
    runId,
    name: wf.name,
    status: 'running',
    workflowStatus: undefined,
    score: undefined,
    dryRun,
    headless: exec.headless,
    modelByNode: {},
    startedAt: new Date().toISOString(),
    endedAt: undefined,
    error: undefined,
    result: undefined,
    events: pendingEvents,
    controller: new AbortController(),
  };
  state.runs.set(runId, rec);

  // Eventos emitidos antes do registro (mesmo tick): re-broadcast para quem já
  // assinou (cliente de outro run não poderia assinar ainda; é no-op na prática).
  for (const evt of pendingEvents) {
    if (state.sseClients.has(runId)) broadcast(state, runId, evt, 'workflow-event');
  }

  void runPromise.then(
    (result) => finishRun(state, rec, result),
    (err) => failRun(state, rec, err),
  );

  writeJson(res, 202, {
    runId,
    status: rec.status,
    headless: exec.headless,
    dryRun,
  });
}

function finishRun(state: ServerState, rec: RunRecord, result: WorkflowRunResult): void {
  rec.result = result;
  rec.workflowStatus = result.workflowStatus;
  rec.score = result.score;
  rec.modelByNode = result.modelByNode;
  rec.headless = result.headless;
  rec.status = result.dryRun
    ? 'dry-run'
    : result.workflowStatus === 'completed'
      ? 'completed'
      : result.workflowStatus === 'failed'
        ? 'failed'
        : result.workflowStatus === 'paused'
          ? 'paused'
          : 'cancelled';
  rec.endedAt = new Date().toISOString();
  // O evento de ciclo de vida final já foi emitido pelo executeWorkflow e vai no
  // replay; o SSE `run-finished` é um resumo conveniente para o navegador.
  broadcast(state, rec.runId, { runId: rec.runId, status: rec.status, workflowStatus: result.workflowStatus, score: result.score, dryRun: rec.dryRun }, 'run-finished');
}

function failRun(state: ServerState, rec: RunRecord, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);

  // Se o usuário pediu stop, o evento workflow.cancelled já foi emitido e o
  // aborto do AbortController só aparece aqui como rejeição: não duplicar.
  const cancelled = rec.events.some((e) => e.type === 'workflow.cancelled');
  if (cancelled) {
    rec.status = 'cancelled';
    rec.error = message;
    rec.endedAt = new Date().toISOString();
    broadcast(state, rec.runId, { runId: rec.runId, status: 'cancelled', workflowStatus: 'cancelled', score: rec.score, dryRun: rec.dryRun, error: message }, 'run-finished');
    return;
  }

  // Falha de execução com evento workflow.failed já emitido pelo executeWorkflow.
  const failed = rec.events.some((e) => e.type === 'workflow.failed');
  let workflowStatus: WorkflowStatus | 'pending' = 'failed';
  if (!failed) {
    const evt = makeWorkflowLifecycle(rec.runId, 'workflow.failed', { status: 'FAIL', reason: message });
    rec.events.push(evt);
    broadcast(state, rec.runId, evt, 'workflow-event');
  }

  rec.status = 'failed';
  rec.workflowStatus = workflowStatus;
  rec.error = message;
  rec.endedAt = new Date().toISOString();
  broadcast(state, rec.runId, { runId: rec.runId, status: 'failed', workflowStatus, score: rec.score, dryRun: rec.dryRun, error: message }, 'run-finished');
}

/* ============================ CONTROLE DE CICLO DE VIDA ============================ */

async function pauseRun(state: ServerState, rec: RunRecord): Promise<void> {
  if (rec.status !== 'running') {
    throw new HttpError(409, `run não pode ser pausado no estado "${rec.status}"`);
  }
  rec.status = 'paused';
  const evt = makeWorkflowLifecycle(rec.runId, 'workflow.paused', { status: 'paused', reason: 'pausado pelo editor' });
  rec.events.push(evt);
  broadcast(state, rec.runId, evt, 'workflow-event');
}

async function resumeRun(state: ServerState, rec: RunRecord): Promise<void> {
  if (rec.status !== 'paused') {
    throw new HttpError(409, `run não pode ser retomado no estado "${rec.status}"`);
  }
  // Pause no editor é marca de estado/UX (sem checkpoint no runtime): retomar
  // apenas reflete o status e emite o evento correspondente.
  rec.status = 'running';
  const evt = makeWorkflowLifecycle(rec.runId, 'workflow.resumed', { status: 'running', reason: 'retomado pelo editor' });
  rec.events.push(evt);
  broadcast(state, rec.runId, evt, 'workflow-event');
}

async function stopRun(state: ServerState, rec: RunRecord): Promise<void> {
  if (rec.status !== 'running' && rec.status !== 'paused') {
    throw new HttpError(409, `run não pode ser interrompido no estado "${rec.status}"`);
  }
  const reason = 'interrompido pelo usuário (stop)';
  const evt = makeWorkflowLifecycle(rec.runId, 'workflow.cancelled', { status: 'CANCELLED', reason });
  rec.events.push(evt);
  broadcast(state, rec.runId, evt, 'workflow-event');
  rec.controller?.abort(reason);
}

/* ============================ RESUMOS ============================ */

function runSummary(rec: RunRecord): Record<string, unknown> {
  return {
    runId: rec.runId,
    name: rec.name,
    status: rec.status,
    workflowStatus: rec.workflowStatus ?? null,
    score: rec.score ?? null,
    dryRun: rec.dryRun,
    headless: rec.headless,
    startedAt: rec.startedAt,
    endedAt: rec.endedAt ?? null,
    error: rec.error ?? null,
  };
}

function runDetail(rec: RunRecord): Record<string, unknown> {
  return {
    ...runSummary(rec),
    modelByNode: rec.modelByNode,
    events: rec.events.slice(-MAX_RECORDED_EVENTS),
    ...(rec.result
      ? {
          nodes: rec.result.nodes.map((n) => ({
            id: n.id,
            status: n.status,
            latencyMs: n.latencyMs ?? null,
            tokensUse: n.tokensUse ?? null,
            error: n.error ?? null,
            attempts: n.attempts ?? null,
          })),
          messages: rec.result.messages,
          metrics: rec.result.metrics,
          plan: rec.result.plan ?? null,
          traceFile: rec.result.traceFile ?? '',
          evaluation: rec.result.evaluation ?? null,
        }
      : {}),
  };
}

function assertName(name: string): void {
  if (!name) throw new HttpError(400, 'faltam o nome do canvas');
  if (!NAME_RE.test(name)) {
    throw new HttpError(400, `nome "${name}" inválido (use letras, dígitos, ponto, hífen ou sublinhado)`);
  }
}