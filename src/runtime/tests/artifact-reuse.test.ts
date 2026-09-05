/**
 * Reuso de artefato entre runs.
 *
 * `readContent` só era chamado por `izanagi explain`: nenhum caminho de
 * execução consultava artefato de run anterior, e um segundo run do mesmo
 * objetivo sobre o mesmo projeto refazia tudo.
 *
 * O que estes testes protegem, mais que o reuso em si, é a INVALIDAÇÃO. Um
 * cache sem invalidação devolve resposta velha com cara de nova, que é pior
 * que não ter cache.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ArtifactRegistry, reuseKey, DEFAULT_REUSE_MAX_AGE_MS } from '../artifacts/registry.js';

const BASE = {
  kind: 'raw',
  objective: 'documentar a API de usuários',
  constraints: ['sem stub'],
  acceptance: ['x:valid'],
  agent: 'docs',
  role: 'specialist',
  upstreamChecksums: ['abc'],
  projectFingerprint: 'fp1',
};

test('reuseKey: muda quando a PERGUNTA muda', () => {
  const base = reuseKey(BASE);
  const variacoes: Array<[string, Parameters<typeof reuseKey>[0]]> = [
    ['tipo de artefato', { ...BASE, kind: 'architecture' }],
    ['objetivo', { ...BASE, objective: 'outro objetivo' }],
    ['restrições', { ...BASE, constraints: ['com stub'] }],
    ['critérios de aceite', { ...BASE, acceptance: ['x:valid', 'user:1'] }],
    ['agente', { ...BASE, agent: 'senior-engineer' }],
    ['papel', { ...BASE, role: 'commander' }],
    ['insumo a montante', { ...BASE, upstreamChecksums: ['def'] }],
    ['estado do projeto', { ...BASE, projectFingerprint: 'fp2' }],
  ];
  for (const [nome, input] of variacoes) {
    assert.notEqual(reuseKey(input), base, `mudar ${nome} precisa invalidar a chave`);
  }
  assert.equal(reuseKey({ ...BASE }), base, 'a mesma pergunta produz a mesma chave');
});

test('reuseKey: run SEM survey é uma chave diferente de run COM survey', () => {
  const semSurvey = reuseKey({ ...BASE, projectFingerprint: undefined });
  assert.notEqual(
    semSurvey,
    reuseKey(BASE),
    'reaproveitar entre um run que leu o projeto e um que não leu seria assumir que o projeto não importava',
  );
});

function registry(): { reg: ArtifactRegistry; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-reuse-'));
  return { reg: new ArtifactRegistry({ baseDir: dir }), dir };
}

function put(reg: ArtifactRegistry, over: Record<string, unknown> = {}) {
  return reg.register({
    kind: 'raw',
    name: 'execute',
    producer: { runId: 'r1', nodeId: 'execute' },
    hash: 'h',
    size: 20,
    valid: true,
    score: 1,
    content: 'conteúdo produzido e validado',
    reuseKey: 'chave-A',
    ...over,
  });
}

test('findReusable: devolve o mais recente que satisfaz as três condições', () => {
  const { reg, dir } = registry();
  put(reg, { producer: { runId: 'r1', nodeId: 'execute' } });
  put(reg, { producer: { runId: 'r2', nodeId: 'execute' }, content: 'versão mais nova' });
  const hit = reg.findReusable('chave-A', { maxAgeMs: DEFAULT_REUSE_MAX_AGE_MS });
  assert.equal(hit?.content, 'versão mais nova');
  assert.equal(hit?.record.producer.runId, 'r2');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('findReusable: artefato INVÁLIDO nunca é reaproveitado', () => {
  const { reg, dir } = registry();
  put(reg, { valid: false });
  assert.equal(
    reg.findReusable('chave-A', { maxAgeMs: DEFAULT_REUSE_MAX_AGE_MS }),
    null,
    'reaproveitar o que não passou na validação economiza a chamada e importa o defeito',
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('findReusable: fora do prazo não é reaproveitado', () => {
  const { reg, dir } = registry();
  put(reg);
  const daquiUmaSemana = Date.now() + DEFAULT_REUSE_MAX_AGE_MS + 1000;
  assert.equal(
    reg.findReusable('chave-A', { maxAgeMs: DEFAULT_REUSE_MAX_AGE_MS, now: daquiUmaSemana }),
    null,
    'o prazo é o único mecanismo que expira o que a chave não consegue ver',
  );
  // Dentro do prazo, o mesmo registro serve.
  assert.ok(reg.findReusable('chave-A', { maxAgeMs: DEFAULT_REUSE_MAX_AGE_MS }));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('findReusable: sem conteúdo em disco não há reuso, só metadado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-reuse-'));
  const reg = new ArtifactRegistry({ baseDir: dir, persistContent: false });
  put(reg);
  assert.equal(reg.findReusable('chave-A', { maxAgeMs: DEFAULT_REUSE_MAX_AGE_MS }), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('findReusable: chave diferente não casa', () => {
  const { reg, dir } = registry();
  put(reg);
  assert.equal(reg.findReusable('chave-B', { maxAgeMs: DEFAULT_REUSE_MAX_AGE_MS }), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('orchestrator: o segundo run reaproveita, gasta zero token e AINDA verifica', async () => {
  const { Orchestrator } = await import('../orchestrator.js');
  const { TraceStore } = await import('../observability/tracer.js');
  const { MemoryStore } = await import('../memory/store.js');
  const { createHeadlessProducer } = await import('../execute.js');
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-reuse-run-'));
  const headless = createHeadlessProducer('documentar a API de usuários');

  const { Commander } = await import('../orchestration/commander.js');
  // Com plano do Commander: o reuso depende do CONTRATO da tarefa (objetivo,
  // restrições, critérios), e o caminho legado por categoria não tem contrato
  // nenhum — não há do que derivar a chave, e por isso lá o reuso não acontece.
  const plano = () => new Commander().plan({ objective: 'documentar a API de usuários', mode: 'orchestrated' });

  let chamadas = 0;
  const rodar = async (reuse: boolean) => {
    const o = new Orchestrator({
      baseDir,
      command: 'test',
      task: 'documentar a API de usuários',
      category: 'implementation',
      primaryAgent: 'docs',
      skillChain: [],
      plan: plano(),
      ...(reuse ? { reuseArtifacts: true } : {}),
      // Produtor headless REAL: deriva o conteúdo do schema do tipo que o nó
      // declara. Um produtor de teste que devolvesse sempre o mesmo texto
      // gravaria artefato inválido para os tipos com schema, e o reuso recusa
      // artefato inválido de propósito — o teste mediria a recusa, não o reuso.
      produce: (node, ctx) => {
        chamadas++;
        return headless(node, ctx);
      },
    });
    o.setMemory(new MemoryStore({ baseDir }));
    o.setStore(new TraceStore({ baseDir }));
    return await o.run();
  };

  const primeiro = await rodar(true);
  const chamadasPrimeiro = chamadas;
  assert.ok(chamadasPrimeiro > 0, 'o primeiro run produz de verdade');
  assert.equal(primeiro.telemetry?.cacheHits, 0, 'não há o que reaproveitar no primeiro');

  const segundo = await rodar(true);
  assert.equal(chamadas, chamadasPrimeiro, 'o segundo run não pode chamar o produtor de novo');
  assert.ok((segundo.telemetry?.cacheHits ?? 0) > 0, 'o reuso precisa aparecer na telemetria');
  assert.equal(segundo.telemetry?.totalTokens, 0, 'reuso custa zero token');

  // O ponto que separa reuso de atalho: a verificação roda sobre o artefato
  // reaproveitado. Um nó que termina sem veredito é o que este runtime recusa.
  assert.ok(segundo.verification && segundo.verification.length > 0, 'o run reaproveitado precisa ter verificação');
  assert.ok(
    segundo.verification!.every((v) => v.result.status !== 'FAILED'),
    'o artefato reaproveitado passou pela mesma verificação',
  );
  assert.ok(
    segundo.graph.nodes.some((n) => n.metadata?.reusedFrom),
    'o nó precisa declarar de onde veio: reaproveitado que se apresenta como novo torna o trace ficção',
  );

  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('orchestrator: sem a flag, nada é reaproveitado', async () => {
  const { Orchestrator } = await import('../orchestrator.js');
  const { TraceStore } = await import('../observability/tracer.js');
  const { MemoryStore } = await import('../memory/store.js');
  const { createHeadlessProducer } = await import('../execute.js');
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-noreuse-'));
  const headless = createHeadlessProducer('documentar a API de usuários');
  let chamadas = 0;
  const { Commander } = await import('../orchestration/commander.js');
  const rodar = async () => {
    const o = new Orchestrator({
      baseDir,
      command: 'test',
      task: 'documentar a API de usuários',
      category: 'implementation',
      primaryAgent: 'docs',
      skillChain: [],
      plan: new Commander().plan({ objective: 'documentar a API de usuários', mode: 'orchestrated' }),
      // Produtor headless REAL: deriva o conteúdo do schema do tipo que o nó
      // declara. Um produtor de teste que devolvesse sempre o mesmo texto
      // gravaria artefato inválido para os tipos com schema, e o reuso recusa
      // artefato inválido de propósito — o teste mediria a recusa, não o reuso.
      produce: (node, ctx) => {
        chamadas++;
        return headless(node, ctx);
      },
    });
    o.setMemory(new MemoryStore({ baseDir }));
    o.setStore(new TraceStore({ baseDir }));
    return await o.run();
  };
  await rodar();
  const depoisDoPrimeiro = chamadas;
  await rodar();
  assert.ok(chamadas > depoisDoPrimeiro, 'reuso é opt-in: desligado, o run produz do zero');
  fs.rmSync(baseDir, { recursive: true, force: true });
});
