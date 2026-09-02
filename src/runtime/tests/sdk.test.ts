import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { run, plan } from '../../sdk.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-sdk-'));
}

const ARTIFACT = 'Conteúdo real, completo e pronto para produção deste artefato do runtime. '.repeat(12);

function fakeClient(providers: string[], text = ARTIFACT) {
  let calls = 0;
  return {
    configuredProviders: () => providers,
    complete: async () => {
      calls++;
      return { text, tokens: 500, model: 'mock-model', provider: providers[0] ?? 'openai', cachedTokens: 100 };
    },
    get calls() {
      return calls;
    },
  };
}

test('sdk: plan() estima sem executar nada nem gastar token', () => {
  const client = fakeClient(['openai']);
  const p = plan({ objective: 'Converta 10 dólares para reais', baseDir: process.cwd(), client });
  assert.ok(p);
  assert.equal(p!.mode, 'direct');
  assert.equal(p!.contracts.length, 1);
  assert.ok((p!.estimate.maxCostUsd ?? 0) > 0, 'estimativa de custo deve existir com provider configurado');
  assert.equal(client.calls, 0, 'planejar não pode chamar o modelo');
});

test('sdk: run() executa e devolve artefatos, telemetria e verificação', async () => {
  const baseDir = tmpDir();
  const client = fakeClient(['openai']);
  const result = await run({ objective: 'Converta 10 dólares para reais', baseDir, client });

  assert.equal(result.headless, false);
  assert.equal(result.mode, 'direct');
  assert.ok(result.runId.startsWith('izanagi-'));
  assert.ok(client.calls >= 1, 'o SDK deve chamar o modelo configurado');
  assert.ok(result.artifacts.answer, 'artefato da tarefa devolvido por id');
  assert.ok(result.telemetry, 'telemetria presente');
  assert.ok(result.verification && result.verification.length > 0, 'verificação por contrato presente');
  assert.ok(fs.existsSync(result.traceFile));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sdk: eventos do run chegam pelos aliases amigáveis', async () => {
  const baseDir = tmpDir();
  const seen: string[] = [];
  const handle = run({ objective: 'Converta 10 dólares para reais', baseDir, client: fakeClient(['openai']) });
  handle.on('task:start', (e) => seen.push(e.name));
  handle.on('run:complete', (e) => seen.push(e.name));
  await handle;
  assert.ok(seen.includes('node.started'), `esperava node.started em ${seen.join(', ')}`);
  assert.ok(seen.includes('run.completed'), `esperava run.completed em ${seen.join(', ')}`);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sdk: unsubscribe para de receber eventos (com prova de que eventos fluíram)', async () => {
  const baseDir = tmpDir();
  let removed = 0;
  let kept = 0;
  const handle = run({ objective: 'Converta 10 dólares para reais', baseDir, client: fakeClient(['openai']) });
  const off = handle.on('*', () => { removed++; });
  handle.on('*', () => { kept++; });
  off();
  await handle;
  assert.ok(kept > 0, 'o handler mantido precisa ter recebido eventos (senão o teste não prova nada)');
  assert.equal(removed, 0, 'handler removido não pode continuar recebendo eventos');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sdk: sem provider configurado o run é headless e não chama modelo', async () => {
  const baseDir = tmpDir();
  const client = fakeClient([]);
  const result = await run({ objective: 'Converta 10 dólares para reais', baseDir, client });
  assert.equal(result.headless, true);
  assert.equal(client.calls, 0, 'headless nunca chama o LLM');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sdk: --local sem provider local cai para headless em vez de usar provider remoto', async () => {
  const baseDir = tmpDir();
  const client = fakeClient(['openai']);
  const result = await run({ objective: 'Converta 10 dólares para reais', baseDir, client, local: true });
  assert.equal(result.headless, true, 'provider remoto não pode ser usado sob --local');
  assert.equal(client.calls, 0);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sdk: teto de custo degrada o modo antes de executar', async () => {
  const baseDir = tmpDir();
  const objective = 'Construa um SaaS completo com frontend Next.js, API backend, banco Postgres com migrations, auditoria de segurança OWASP e pipeline de deploy';
  const client = fakeClient(['openai']);
  const full = plan({ objective, baseDir: process.cwd(), client });
  const capped = plan({ objective, baseDir: process.cwd(), client, budget: { maxCost: 0.001 } });
  assert.equal(full!.mode, 'autonomous');
  assert.notEqual(capped!.mode, 'autonomous');
  assert.ok(capped!.decisions.some((d) => d.includes('degradando')));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sdk: cache local zera o custo da segunda execução idêntica', async () => {
  const baseDir = tmpDir();
  const client = fakeClient(['openai']);
  const first = await run({ objective: 'Converta 10 dólares para reais', baseDir, client, cache: true });
  const callsAfterFirst = client.calls;
  const second = await run({ objective: 'Converta 10 dólares para reais', baseDir, client, cache: true });
  assert.ok(callsAfterFirst >= 1);
  assert.equal(client.calls, callsAfterFirst, 'segunda execução idêntica não deve chamar o modelo de novo');
  assert.ok((second.telemetry?.cacheHits ?? 0) >= 1, 'hit de cache deve aparecer na telemetria');
  assert.ok((second.telemetry?.savedTokens ?? 0) > 0, 'tokens economizados devem ser contabilizados');
  assert.equal(first.status, second.status, 'mesma entrada, mesmo veredito');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sdk: noCommander volta ao planejamento legado por categoria', async () => {
  const baseDir = tmpDir();
  const result = await run({
    objective: 'Depurar erro 500 intermitente no endpoint de login',
    baseDir,
    client: fakeClient(['openai']),
    noCommander: true,
  });
  assert.equal(result.mode, undefined, 'sem Commander não há modo declarado');
  assert.equal(result.plan, undefined);
  fs.rmSync(baseDir, { recursive: true, force: true });
});
