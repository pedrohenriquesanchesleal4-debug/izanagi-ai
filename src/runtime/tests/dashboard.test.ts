import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createDashboardServer } from '../dashboard/server.js';
import { TraceStore, Tracer } from '../observability/tracer.js';
import { ArtifactRegistry } from '../artifacts/registry.js';
import { MemoryStore } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-dash-'));
}

async function withServer(baseDir: string, fn: (base: string) => Promise<void>): Promise<void> {
  const server = createDashboardServer({ baseDir });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    await fn(`http://localhost:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function getJson(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function getText(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      })
      .on('error', reject);
  });
}

test('dashboard: serve a página HTML na raiz', async () => {
  await withServer(tmpDir(), async (base) => {
    const res = await getText(base + '/');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('<title>Izanagi Dashboard</title>'));
  });
});

test('dashboard: /api/runs lista traces reais do TraceStore', async () => {
  const baseDir = tmpDir();
  const store = new TraceStore({ baseDir });
  const tracer = new Tracer(store, { task: 'tarefa de teste', command: 'run' });
  tracer.finishAndSave({});

  await withServer(baseDir, async (base) => {
    const res = await getJson(base + '/api/runs');
    assert.equal(res.status, 200);
    const runs = res.body as Array<{ task: string }>;
    assert.equal(runs.length, 1);
    assert.equal(runs[0].task, 'tarefa de teste');
  });
});

test('dashboard: /api/runs/:id devolve trace + artifacts do registry, e 404 para run inexistente', async () => {
  const baseDir = tmpDir();
  const store = new TraceStore({ baseDir });
  const tracer = new Tracer(store, { task: 'x', command: 'run' });
  const { trace } = tracer.finishAndSave({});
  const registry = new ArtifactRegistry({ baseDir });
  registry.register({ kind: 'implementation', name: 'execute', producer: { runId: trace.runId, nodeId: 'execute', agent: 'senior-engineer' }, hash: 'h', size: 10, valid: true, score: 0.9 });

  await withServer(baseDir, async (base) => {
    const res = await getJson(`${base}/api/runs/${trace.runId}`);
    assert.equal(res.status, 200);
    const body = res.body as { trace: { runId: string }; artifacts: Array<{ name: string }> };
    assert.equal(body.trace.runId, trace.runId);
    assert.equal(body.artifacts.length, 1);
    assert.equal(body.artifacts[0].name, 'execute');

    const notFound = await getJson(`${base}/api/runs/nao-existe`);
    assert.equal(notFound.status, 404);
  });
});

test('dashboard: os campos do runtime novo chegam inteiros à página (modo, economia, verificação, conversa)', async () => {
  const baseDir = tmpDir();
  const store = new TraceStore({ baseDir });
  const tracer = new Tracer(store, { task: 'x', command: 'run' });
  const { trace } = tracer.finishAndSave({
    mode: 'orchestrated',
    telemetry: { inputTokens: 1200, outputTokens: 400, costUsd: 0.0031, cacheHits: 2, parallelTasks: 3 },
    verification: [{ nodeId: 'execute', status: 'UNVERIFIED', score: 0.75, reason: 'sem juiz', unmet: ['critério semântico'] }],
    conversation: [
      { id: 'm1', from: 'commander', to: 'senior-engineer', type: 'task', taskId: 'execute', summary: 'produzir', artifactRefs: ['r:architecture'], timestamp: new Date().toISOString() },
    ],
  });

  await withServer(baseDir, async (base) => {
    const res = await getJson(`${base}/api/runs/${trace.runId}`);
    assert.equal(res.status, 200);
    const body = res.body as { trace: Record<string, unknown> };
    // O servidor devolve o trace inteiro; a página renderiza a partir daqui.
    // Se um destes campos sumir do contrato, o Run Explorer volta a esconder
    // exatamente o que a rearquitetura passou a medir.
    assert.equal(body.trace.mode, 'orchestrated');
    assert.equal((body.trace.telemetry as { costUsd: number }).costUsd, 0.0031);
    assert.equal((body.trace.verification as Array<{ status: string }>)[0].status, 'UNVERIFIED');
    assert.equal((body.trace.conversation as Array<{ type: string }>)[0].type, 'task');

    const page = await fetch(`${base}/`);
    const html = await page.text();
    for (const fn of ['renderVerification', 'renderEconomy', 'renderConversation']) {
      assert.ok(html.includes(fn), `a página deveria renderizar ${fn}`);
    }
  });
});

test('dashboard: /api/benchmarks lista relatórios salvos, /api/benchmarks/:id devolve um e 404 se não existir', async () => {
  const baseDir = tmpDir();
  const dir = path.join(baseDir, '.izanagi', 'state', 'benchmarks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'bench-1.json'),
    JSON.stringify({ id: 'bench-1', suite: 'coding', version: '1.0.0', createdAt: new Date().toISOString(), frameworkVersion: '3.2.0', results: [], summary: { total: 0, passed: 0, failed: 0, avgScore: 0, totalDurationMs: 0 }, byDomain: {} }),
  );

  await withServer(baseDir, async (base) => {
    const list = await getJson(base + '/api/benchmarks');
    assert.equal(list.status, 200);
    assert.equal((list.body as Array<unknown>).length, 1);

    const one = await getJson(base + '/api/benchmarks/bench-1');
    assert.equal(one.status, 200);
    assert.equal((one.body as { id: string }).id, 'bench-1');

    const missing = await getJson(base + '/api/benchmarks/nao-existe');
    assert.equal(missing.status, 404);
  });
});

test('dashboard: /api/memory expõe agentes, skills, failures ativos e learnings', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  memory.recordAgentRun('qa', { success: true, score: 0.9, tokens: 100 });
  memory.recordFailure({ pattern: 'X-1', symptoms: ['a'], rootCause: 'b', solution: 'c' });
  memory.invalidateFailure('X-1');
  memory.addLearning('sempre rodar doctor antes de commitar', 'test');
  memory.save();

  await withServer(baseDir, async (base) => {
    const res = await getJson(base + '/api/memory');
    assert.equal(res.status, 200);
    const body = res.body as { agents: Record<string, unknown>; failures: unknown[]; learnings: unknown[] };
    assert.ok(body.agents.qa);
    assert.equal(body.failures.length, 0, 'failure invalidado não aparece no dashboard');
    assert.equal(body.learnings.length, 1);
  });
});

test('dashboard: /api/memory expõe stats de modelo (recordModelRun)', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  memory.recordModelRun('claude-sonnet-4-5', { success: true, score: 0.9, tokens: 500 });

  await withServer(baseDir, async (base) => {
    const res = await getJson(base + '/api/memory');
    const body = res.body as { models: Record<string, { runs: number }> };
    assert.equal(body.models['claude-sonnet-4-5'].runs, 1);
  });
});

test('dashboard: /api/runs/:id de um run ainda sem evaluation (em andamento) não quebra — sem campo evaluation', async () => {
  const baseDir = tmpDir();
  const store = new TraceStore({ baseDir });
  const tracer = new Tracer(store, { task: 'run em andamento', command: 'run' });
  const closeSpan = tracer.span('node:execute', 'agent');
  closeSpan(true);
  // Note: sem finishAndSave() — simula processo interrompido no meio, como o
  // flush() incremental do Tracer já cobre (ver runtime/tests/tracer.test.ts).

  await withServer(baseDir, async (base) => {
    const res = await getJson(`${base}/api/runs/${tracer.runId}`);
    assert.equal(res.status, 200);
    const body = res.body as { trace: { evaluation?: unknown; spans: unknown[] } };
    assert.equal(body.trace.evaluation, undefined);
    assert.equal(body.trace.spans.length, 1);
  });
});

test('dashboard: /api/events entrega SSE quando um novo trace é salvo (live update entre processos)', async () => {
  const baseDir = tmpDir();

  await withServer(baseDir, async (base) => {
    const received = await new Promise<string>((resolve, reject) => {
      const req = http.get(`${base}/api/events`, (res) => {
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          if (buf.includes('data: ')) {
            req.destroy();
            resolve(buf);
          }
        });
        res.on('error', reject);
      });
      req.on('error', (err) => {
        // destroy() após resolve() dispara ECONNRESET — não é falha do teste.
        if (!err.message.includes('ECONNRESET') && !err.message.includes('socket hang up')) reject(err);
      });
      // Só dispara a mudança depois que a conexão SSE já está estabelecida.
      setTimeout(() => {
        const store = new TraceStore({ baseDir });
        new Tracer(store, { task: 'trigger', command: 'run' }).flush();
      }, 50);
      setTimeout(() => reject(new Error('timeout esperando evento SSE')), 2000);
    });
    assert.ok(received.includes('"kind":"runs"'), `esperava evento de runs, recebeu: ${received}`);
  });
});

test('dashboard: rota desconhecida devolve 404 estruturado', async () => {
  await withServer(tmpDir(), async (base) => {
    const res = await getJson(base + '/api/nao-existe');
    assert.equal(res.status, 404);
    assert.ok((res.body as { error: string }).error);
  });
});
