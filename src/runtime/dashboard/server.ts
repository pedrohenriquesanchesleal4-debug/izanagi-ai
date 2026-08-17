/**
 * Dashboard — Fase 7 (Platform), fundação.
 *
 * Servidor HTTP local (`node:http` puro, zero dependências novas) que lê os
 * dados JÁ existentes em `.izanagi/state/` (TraceStore, ArtifactRegistry,
 * MemoryStore, benchmark reports) e serve uma página única com Run Explorer,
 * Execution Graph (lista de nós, não SVG), Artifact Explorer, Evaluation e
 * Healing por run, e um painel de Arena.
 *
 * Isto é uma FUNDAÇÃO explícita, não a Fase 7 completa: sem Skill/Agent
 * Registry web, sem extensibilidade de plugins, sem autenticação/hosting —
 * ferramenta local single-user, como o resto do framework hoje. Ver seção
 * 26 do roadmap ("se for só fundação, diga explicitamente que é fundação").
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { TraceStore, TRACE_DIR_REL } from '../observability/tracer.js';
import { ArtifactRegistry } from '../artifacts/registry.js';
import { MemoryStore } from '../memory/store.js';
import { listBenchmarkReports } from '../benchmarks/runner.js';
import { DASHBOARD_HTML } from './page.js';

export interface DashboardServerOptions {
  baseDir: string;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

const BENCHMARKS_DIR_REL = path.join('.izanagi', 'state', 'benchmarks');

/**
 * Live updates — a CLI que roda `izanagi run`/`izanagi arena run` é um
 * PROCESSO SEPARADO do dashboard, então não dá pra assinar o Event System
 * em memória (`Tracer.events`) daqui. `fs.watch` nos diretórios de estado é
 * o canal que funciona entre processos: qualquer escrita (inclusive o
 * `Tracer.flush()` incremental) dispara um evento SSE simples pro browser
 * recarregar a lista — sem servidor de socket próprio, sem dependência nova.
 */
function watchStateDirs(baseDir: string, onChange: (kind: 'runs' | 'benchmarks') => void): () => void {
  const watchers: fs.FSWatcher[] = [];
  const targets: Array<[string, 'runs' | 'benchmarks']> = [
    [path.join(baseDir, TRACE_DIR_REL), 'runs'],
    [path.join(baseDir, BENCHMARKS_DIR_REL), 'benchmarks'],
  ];
  for (const [dir, kind] of targets) {
    fs.mkdirSync(dir, { recursive: true });
    try {
      watchers.push(fs.watch(dir, () => onChange(kind)));
    } catch {
      // fs.watch pode falhar em alguns filesystems (ex.: certos volumes de rede) —
      // degrada para "sem live update" em vez de derrubar o dashboard inteiro.
    }
  }
  return () => watchers.forEach((w) => w.close());
}

/** Cria (sem iniciar) o servidor do dashboard — devolve o http.Server para o caller decidir quando `.listen()`. */
export function createDashboardServer(opts: DashboardServerOptions): http.Server {
  const { baseDir } = opts;
  const sseClients = new Set<http.ServerResponse>();

  const stopWatching = watchStateDirs(baseDir, (kind) => {
    const payload = `data: ${JSON.stringify({ kind })}\n\n`;
    for (const client of sseClients) client.write(payload);
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(DASHBOARD_HTML);
        return;
      }

      if (parts[0] === 'api' && parts[1] === 'runs' && !parts[2]) {
        const store = new TraceStore({ baseDir });
        const limit = Number(url.searchParams.get('limit')) || 50;
        json(res, 200, store.list(limit));
        return;
      }

      if (parts[0] === 'api' && parts[1] === 'runs' && parts[2]) {
        const store = new TraceStore({ baseDir });
        const trace = store.load(parts[2]);
        if (!trace) return json(res, 404, { error: `run "${parts[2]}" não encontrado` });
        const registry = new ArtifactRegistry({ baseDir });
        json(res, 200, { trace, artifacts: registry.forRun(parts[2]) });
        return;
      }

      if (parts[0] === 'api' && parts[1] === 'benchmarks' && !parts[2]) {
        json(res, 200, listBenchmarkReports(baseDir));
        return;
      }

      if (parts[0] === 'api' && parts[1] === 'benchmarks' && parts[2]) {
        const report = listBenchmarkReports(baseDir).find((r) => r.id === parts[2]);
        if (!report) return json(res, 404, { error: `relatório "${parts[2]}" não encontrado` });
        json(res, 200, report);
        return;
      }

      if (parts[0] === 'api' && parts[1] === 'memory') {
        const memory = new MemoryStore({ baseDir });
        const state = memory.raw;
        json(res, 200, {
          agents: state.agents,
          skills: state.skills,
          models: state.models,
          failures: memory.listFailures(50),
          learnings: memory.listLearnings(20),
        });
        return;
      }

      if (parts[0] === 'api' && parts[1] === 'events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(': connected\n\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      json(res, 404, { error: `rota não encontrada: ${url.pathname}` });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.on('close', () => {
    stopWatching();
    for (const client of sseClients) client.end();
    sseClients.clear();
  });

  return server;
}
