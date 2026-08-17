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

import http from 'http';
import { TraceStore } from '../observability/tracer.js';
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

/** Cria (sem iniciar) o servidor do dashboard — devolve o http.Server para o caller decidir quando `.listen()`. */
export function createDashboardServer(opts: DashboardServerOptions): http.Server {
  const { baseDir } = opts;

  return http.createServer((req, res) => {
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
          failures: memory.listFailures(50),
          learnings: memory.listLearnings(20),
        });
        return;
      }

      json(res, 404, { error: `rota não encontrada: ${url.pathname}` });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}
