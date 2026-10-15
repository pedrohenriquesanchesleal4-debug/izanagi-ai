import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ToolRegistry } from '../tools/registry.js';
import { runBrowserPlaywright } from '../tools/playwright-cli.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-pw-test-'));
}

test('browser.playwright: validação de inputs no ToolRegistry', async () => {
  const dir = tmpDir();
  try {
    const registry = new ToolRegistry();

    // 1. Falha sem permissão net:http
    const noPermRes = await registry.execute(
      'browser.playwright',
      { url: 'https://example.com' },
      { permissions: ['fs:read'], baseDir: dir },
    );
    assert.equal(noPermRes.ok, false);
    assert.match(noPermRes.error!, /permissão negada/);

    // 2. Falha com URL inválida (sem prefixo http)
    const badUrlRes = await registry.execute(
      'browser.playwright',
      { url: 'ftp://bad-url.com' },
      { permissions: ['net:http'], baseDir: dir },
    );
    assert.equal(badUrlRes.ok, false);
    assert.match(badUrlRes.error!, /iniciando com http:\/\/ ou https:\/\//);

    // 3. Falha com action inválida
    const badActionRes = await registry.execute(
      'browser.playwright',
      { url: 'https://example.com', action: 'invalid-action' },
      { permissions: ['net:http'], baseDir: dir },
    );
    assert.equal(badActionRes.ok, false);
    assert.match(badActionRes.error!, /campo "action" deve ser/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runBrowserPlaywright: lida com ausência do Playwright com diagnóstico claro', async () => {
  const dir = tmpDir();
  try {
    // Executa em um diretório temporário vazio onde playwright não está instalado
    const res = await runBrowserPlaywright({
      action: 'navigate',
      url: 'https://example.com',
      dir,
      timeoutMs: 5000,
    });

    assert.equal(res.ok, false);
    assert.ok(res.error, 'devolve mensagem de erro');
    assert.match(res.error!, /Playwright/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
