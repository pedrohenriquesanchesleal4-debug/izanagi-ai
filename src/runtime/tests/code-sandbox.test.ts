/**
 * Sandbox de execução de código.
 *
 * Estes testes não provam que a feature funciona — provam que ela é CONTIDA.
 * Cada um deles corresponde a uma forma de escapar, e o que é verificado é o
 * bloqueio imposto pelo runtime do Node, não uma checagem de string sobre o
 * código (que seria evasível).
 *
 * O limite conhecido — rede não isolada — também está aqui, medido. Um limite
 * documentado e testado é um limite; um limite só documentado é uma esperança.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runInSandbox, sandboxAvailability } from '../tools/code-sandbox.js';
import { ToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/registry.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-sbx-'));
}

const disponivel = sandboxAvailability().available;

test('sandbox: código simples roda e devolve a saída', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const r = await runInSandbox({ code: 'console.log("resultado:", 2 + 3);', baseDir });
  assert.equal(r.ok, true, r.error ?? r.stderr);
  assert.match(r.stdout, /resultado: 5/);
  assert.equal(r.exitCode, 0);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: escrever fora do diretório de trabalho é negado pelo runtime', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const alvo = path.join(baseDir, 'invadido.txt').replace(/\\/g, '\\\\');
  const r = await runInSandbox({
    code: `import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(alvo)}, 'x');\nconsole.log('ESCREVEU');`,
    baseDir,
  });
  assert.equal(r.ok, false);
  assert.ok(!fs.existsSync(path.join(baseDir, 'invadido.txt')), 'o script escreveu na raiz do projeto');
  assert.match(r.stderr, /ERR_ACCESS_DENIED|Access to this API has been restricted/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: ler fora do diretório de trabalho é negado', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  fs.writeFileSync(path.join(baseDir, 'segredo.txt'), 'conteudo secreto', 'utf-8');
  const alvo = path.join(baseDir, 'segredo.txt').replace(/\\/g, '\\\\');
  const r = await runInSandbox({
    code: `import fs from 'node:fs';\nconsole.log(fs.readFileSync(${JSON.stringify(alvo)}, 'utf-8'));`,
    baseDir,
  });
  assert.equal(r.ok, false);
  assert.ok(!r.stdout.includes('conteudo secreto'), 'o script leu um arquivo do projeto');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: leitura do projeto é opt-in, e nunca vem com escrita junto', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  fs.writeFileSync(path.join(baseDir, 'leitura.txt'), 'pode ler isto', 'utf-8');
  const arquivo = path.join(baseDir, 'leitura.txt').replace(/\\/g, '\\\\');

  const permitido = await runInSandbox({
    code: `import fs from 'node:fs';\nconsole.log(fs.readFileSync(${JSON.stringify(arquivo)}, 'utf-8'));`,
    baseDir,
    allowProjectRead: true,
  });
  assert.equal(permitido.ok, true, permitido.stderr);
  assert.match(permitido.stdout, /pode ler isto/);

  const escrita = await runInSandbox({
    code: `import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(arquivo)}, 'sobrescrito');`,
    baseDir,
    allowProjectRead: true,
  });
  assert.equal(escrita.ok, false, 'ler o projeto não pode implicar escrever nele');
  assert.equal(fs.readFileSync(path.join(baseDir, 'leitura.txt'), 'utf-8'), 'pode ler isto');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: abrir subprocesso é negado', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const r = await runInSandbox({
    code: `import cp from 'node:child_process';\ncp.execSync('echo escapou');\nconsole.log('RODOU');`,
    baseDir,
  });
  assert.equal(r.ok, false);
  assert.ok(!r.stdout.includes('RODOU'));
  assert.match(r.stderr, /ERR_ACCESS_DENIED|restricted/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: nenhuma variável de ambiente do processo pai atravessa', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  process.env.IZANAGI_TESTE_SEGREDO = 'chave-que-nao-pode-vazar';
  try {
    const r = await runInSandbox({
      code: 'console.log(JSON.stringify({ segredo: process.env.IZANAGI_TESTE_SEGREDO ?? null }));',
      baseDir,
    });
    assert.equal(r.ok, true, r.stderr);
    assert.match(r.stdout, /"segredo":null/);
  } finally {
    delete process.env.IZANAGI_TESTE_SEGREDO;
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('sandbox: laço infinito é morto pelo timeout', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const r = await runInSandbox({ code: 'while (true) {}', baseDir, timeoutMs: 1200 });
  assert.equal(r.ok, false);
  assert.equal(r.timedOut, true);
  assert.match(r.error ?? '', /excedeu 1200ms/);
  assert.ok(r.durationMs < 8000, `o kill demorou ${r.durationMs}ms`);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: saída gigante é cortada com marca, não engolida', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const r = await runInSandbox({
    code: 'for (let i = 0; i < 5000; i++) console.log("linha".repeat(50));',
    baseDir,
    maxOutputBytes: 2000,
  });
  assert.equal(r.truncated, true);
  assert.match(r.stdout, /saída truncada em 2000 bytes/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: o diretório de trabalho é removido depois da execução', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const r = await runInSandbox({ code: 'import fs from "node:fs"; fs.writeFileSync("saida.json", "{}"); console.log("ok");', baseDir });
  assert.equal(r.ok, true, r.stderr);
  assert.equal(fs.existsSync(r.workDir), false, 'sandbox não pode deixar resíduo entre execuções');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: código vazio é recusado antes de gastar um processo', async () => {
  const baseDir = tmpDir();
  const r = await runInSandbox({ code: '   ', baseDir });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'código vazio');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('sandbox: LIMITE CONHECIDO — rede não é isolada pelo Permission Model', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  // Este teste não valida um comportamento desejado: ele registra um limite
  // real. O Permission Model do Node não cobre rede, então um script pode
  // fazer requisição de saída. A mitigação é a permissão `shell` no contrato,
  // que a PolicyEngine nega para trust tier generated/community.
  // Sem rede na máquina de CI o fetch falha por DNS, e isso também é aceito:
  // o que o teste prova é que NÃO existe ERR_ACCESS_DENIED nesse caminho.
  const r = await runInSandbox({
    code: `try { await fetch('http://127.0.0.1:1/'); console.log('SEM-BLOQUEIO'); }
           catch (e) { console.log(e && e.code === 'ERR_ACCESS_DENIED' ? 'BLOQUEADO' : 'SEM-BLOQUEIO'); }`,
    baseDir,
    timeoutMs: 8000,
  });
  assert.match(r.stdout, /SEM-BLOQUEIO/, 'se isto virar BLOQUEADO, o limite documentado deixou de existir e a doc precisa mudar');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ pela ToolRegistry ============================ */

function ctx(baseDir: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return { permissions: ['shell'], baseDir, environment: 'development', trustTier: 'builtin', ...overrides };
}

test('code.execute: roda pela ToolRegistry com permissão shell', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const out = await new ToolRegistry().execute('code.execute', { code: 'console.log(41 + 1);' }, ctx(baseDir));
  assert.equal(out.ok, true, out.error);
  assert.match((out.result as { stdout: string }).stdout, /42/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('code.execute: sem permissão shell no contrato, nem chega a rodar', async () => {
  const baseDir = tmpDir();
  const out = await new ToolRegistry().execute('code.execute', { code: 'console.log(1);' }, ctx(baseDir, { permissions: ['fs:read'] }));
  assert.equal(out.ok, false);
  assert.match(out.error ?? '', /permissão negada/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('code.execute: a política nega shell a agente gerado e a agente de terceiro', async () => {
  const baseDir = tmpDir();
  const registry = new ToolRegistry();
  for (const tier of ['generated', 'community'] as const) {
    const out = await registry.execute('code.execute', { code: 'console.log(1);' }, ctx(baseDir, { trustTier: tier }));
    assert.equal(out.ok, false, `trust tier "${tier}" não deveria executar código`);
    assert.match(out.error ?? '', /policy negou/);
  }
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('code.execute: input inválido é recusado antes da execução', async () => {
  const baseDir = tmpDir();
  const registry = new ToolRegistry();
  const semCodigo = await registry.execute('code.execute', {}, ctx(baseDir));
  assert.equal(semCodigo.ok, false);
  assert.match(semCodigo.error ?? '', /"code"/);

  const timeoutRuim = await registry.execute('code.execute', { code: 'console.log(1)', timeoutMs: -5 }, ctx(baseDir));
  assert.equal(timeoutRuim.ok, false);
  assert.match(timeoutRuim.error ?? '', /timeoutMs/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('code.execute: script que falha vira erro com a saída de erro do processo', { skip: !disponivel }, async () => {
  const baseDir = tmpDir();
  const out = await new ToolRegistry().execute('code.execute', { code: 'throw new Error("quebrou de proposito");' }, ctx(baseDir));
  assert.equal(out.ok, false);
  assert.match(out.error ?? '', /quebrou de proposito/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});
