import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ArtifactRegistry, DEFAULT_MAX_CONTENT_BYTES } from '../artifacts/registry.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-content-'));
}

function reg(baseDir: string, opts: { persistContent?: boolean; maxContentBytes?: number } = {}) {
  return new ArtifactRegistry({ baseDir, ...opts });
}

const producer = { runId: 'run-1', nodeId: 'implementation', agent: 'senior-engineer' };

test('content store: conteúdo sobrevive ao processo (nova instância lê do disco)', () => {
  const dir = tmp();
  const first = reg(dir);
  first.register({ kind: 'raw', name: 'implementation', producer, hash: 'h', size: 5, valid: true, score: 1, content: 'artefato real' });

  // Instância NOVA: simula outro processo lendo depois que o run terminou.
  const second = reg(dir);
  assert.equal(second.readContent('run-1:implementation'), 'artefato real');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: registro carrega contentRef e originalSize', () => {
  const dir = tmp();
  const registry = reg(dir);
  const record = registry.register({ kind: 'raw', name: 'n', producer, hash: 'h', size: 4, valid: true, score: 1, content: 'abcd' });
  assert.ok(record.contentRef, 'contentRef deve ser preenchido');
  assert.equal(record.originalSize, 4);
  assert.equal(record.truncated, undefined);
  assert.ok(fs.existsSync(path.join(dir, '.izanagi', 'state', record.contentRef!)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: versões distintas do mesmo nó geram arquivos distintos', () => {
  const dir = tmp();
  const registry = reg(dir);
  registry.register({ kind: 'raw', name: 'n', producer, hash: 'h1', size: 2, valid: false, score: 0.5, content: 'v1' });
  registry.register({ kind: 'raw', name: 'n', producer, hash: 'h2', size: 2, valid: true, score: 1, content: 'v2' });
  assert.equal(registry.readContent('run-1:implementation', 1), 'v1');
  assert.equal(registry.readContent('run-1:implementation', 2), 'v2');
  assert.equal(registry.readContent('run-1:implementation'), 'v2', 'sem versão devolve a atual');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: conteúdo acima do teto é truncado COM marca explícita', () => {
  const dir = tmp();
  const registry = reg(dir, { maxContentBytes: 100 });
  const record = registry.register({
    kind: 'raw', name: 'n', producer, hash: 'h', size: 5000, valid: true, score: 1,
    content: 'x'.repeat(5000),
  });
  assert.equal(record.truncated, true);
  assert.equal(record.originalSize, 5000);
  const read = registry.readContent('run-1:implementation')!;
  assert.ok(read.includes('conteúdo truncado pelo content store'), 'truncamento precisa ser declarado no próprio conteúdo');
  assert.ok(read.includes('5000 bytes originais'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: nodeId malicioso não escapa do diretório de conteúdo', () => {
  const dir = tmp();
  const registry = reg(dir);
  const record = registry.register({
    kind: 'raw', name: 'evil', producer: { runId: '../../../etc', nodeId: '../../passwd' },
    hash: 'h', size: 3, valid: true, score: 1, content: 'pwn',
  });
  assert.ok(record.contentRef, 'ainda deve gravar, mas com nome saneado');
  const written = path.resolve(dir, '.izanagi', 'state', record.contentRef!);
  const store = path.resolve(dir, '.izanagi', 'state', 'artifacts');
  assert.ok(written.startsWith(store + path.sep), `escapou do content store: ${written}`);
  assert.ok(!fs.existsSync('/etc/passwd.v1.txt'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: objeto estruturado é serializado, circular não derruba', () => {
  const dir = tmp();
  const registry = reg(dir);
  registry.register({ kind: 'evaluation', name: 'n', producer, hash: 'h', size: 1, valid: true, score: 1, content: { verdict: 'PASS', score: 1 } });
  assert.match(registry.readContent('run-1:implementation')!, /"verdict": "PASS"/);

  const circular: Record<string, unknown> = { a: 1 };
  circular.self = circular;
  const rec = registry.register({ kind: 'raw', name: 'c', producer: { runId: 'run-2', nodeId: 'x' }, hash: 'h', size: 1, valid: true, score: 1, content: circular });
  assert.ok(rec.contentRef, 'conteúdo circular não pode derrubar o registro');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: desligado grava só metadado (comportamento anterior preservado)', () => {
  const dir = tmp();
  const registry = reg(dir, { persistContent: false });
  const record = registry.register({ kind: 'raw', name: 'n', producer, hash: 'h', size: 4, valid: true, score: 1, content: 'abcd' });
  assert.equal(record.contentRef, undefined);
  assert.equal(registry.readContent('run-1:implementation'), null);
  assert.equal(fs.existsSync(path.join(dir, '.izanagi', 'state', 'artifacts')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: registro antigo sem contentRef devolve null em vez de quebrar', () => {
  const dir = tmp();
  const stateDir = path.join(dir, '.izanagi', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'artifacts.json'),
    JSON.stringify([{ id: 'old:node', kind: 'raw', name: 'n', version: 1, producer: { runId: 'old', nodeId: 'node' }, createdAt: '2026-01-01T00:00:00.000Z', hash: 'h', size: 1, valid: true, score: 1, dependencies: [] }]),
    'utf-8',
  );
  const registry = reg(dir);
  assert.equal(registry.readContent('old:node'), null);
  assert.ok(registry.get('old:node'), 'o metadado antigo continua legível');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: purgeContent apaga o conteúdo mas preserva o metadado', () => {
  const dir = tmp();
  const registry = reg(dir);
  registry.register({ kind: 'raw', name: 'n', producer, hash: 'h', size: 4, valid: true, score: 1, content: 'abcd' });
  assert.equal(registry.purgeContent('run-1'), 1);
  assert.equal(registry.readContent('run-1:implementation'), null);
  assert.ok(registry.get('run-1:implementation'), 'metadado permanece após purge');
  assert.equal(registry.get('run-1:implementation')!.contentRef, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: unicode invisível é higienizado antes de gravar', () => {
  const dir = tmp();
  const registry = reg(dir);
  registry.register({ kind: 'raw', name: 'n', producer, hash: 'h', size: 10, valid: true, score: 1, content: 'te​xto limpo' });
  const read = registry.readContent('run-1:implementation')!;
  assert.equal(read.includes('​'), false, 'zero-width space não pode chegar ao disco');
  assert.equal(read.includes(' '), false, 'non-breaking space deve virar espaço comum');
  assert.equal(read, 'texto limpo');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('content store: teto default é 512KB', () => {
  assert.equal(DEFAULT_MAX_CONTENT_BYTES, 512 * 1024);
});
