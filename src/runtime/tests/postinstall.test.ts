import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/**
 * Contrato do hook postinstall (bug real de CI, corrigido em 2026-08-23):
 *
 * O hook era `node dist/scripts/postinstall.js` direto. Em checkout fresco do
 * repo-fonte, `dist/` é gitignored — o `npm ci`/`npm install` executa o hook
 * ANTES de qualquer build e o Node morre com MODULE_NOT_FOUND (o arquivo nem
 * carrega, então nenhum try/catch interno pode salvar).
 *
 * Solução: bootstrap COMMITADO em `bin/postinstall.js` referenciado pelo hook.
 * Ele delega para `dist/scripts/postinstall.js` quando o build existe (comportamento
 * integral preservado, inclusive propagação de falhas reais) e, quando `dist/`
 * está ausente, termina exit 0 com orientação clara ("rode npm run build").
 *
 * Estratégia dos testes: o postinstall roda sobre o próprio arquivo (import.meta.url),
 * então cada caso monta um sandbox tmp com `bin/postinstall.js` copiado do repo e uma
 * árvore `dist/` real ou sintética, executando o bootstrap como subprocess.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const realBootstrap = path.join(repoRoot, 'bin', 'postinstall.js');

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runBootstrap(sandbox: string, env?: Record<string, string>): SpawnResult {
  const res = spawnSync(process.execPath, [path.join(sandbox, 'bin', 'postinstall.js')], {
    cwd: sandbox,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : undefined,
  });
  return {
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

/** Copia o bootstrap real do repo para <sandbox>/bin/ (unit under test). */
function prepareSandbox(): string {
  const sandbox = tmpDir('izanagi-postinstall-');
  fs.mkdirSync(path.join(sandbox, 'bin'), { recursive: true });
  fs.copyFileSync(realBootstrap, path.join(sandbox, 'bin', 'postinstall.js'));
  return sandbox;
}

function writeFakeDistPostinstall(sandbox: string, body: string): void {
  fs.mkdirSync(path.join(sandbox, 'dist', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(sandbox, 'dist', 'scripts', 'postinstall.js'), body, 'utf8');
}

test('postinstall: sem dist/ termina exit 0 com mensagem orientadora (bug de CI em checkout fresco)', () => {
  const sandbox = prepareSandbox();
  try {
    const res = runBootstrap(sandbox);
    assert.equal(res.status, 0, `esperado exit 0 sem dist/, veio ${res.status}; stderr: ${res.stderr}`);
    const output = `${res.stdout}\n${res.stderr}`;
    assert.match(output, /dist ausente/i);
    assert.match(output, /npm run build/i);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('postinstall: COM dist/ delega integralmente (stdout repassado, exit 0)', () => {
  const sandbox = prepareSandbox();
  try {
    writeFakeDistPostinstall(
      sandbox,
      [
        `console.log('\\x1b[36m[Izanagi AI]\\x1b[0m Framework ativado automaticamente neste projeto (todas as CLIs). Rode \`izanagi doctor\` para validar.');`,
        `process.exit(0);`,
      ].join('\n'),
    );
    const res = runBootstrap(sandbox);
    assert.equal(res.status, 0, `esperado exit 0 com dist/, veio ${res.status}; stderr: ${res.stderr}`);
    assert.match(res.stdout, /Framework ativado automaticamente/);
    assert.doesNotMatch(res.stdout, /dist ausente/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('postinstall: falha real do script delegado NÃO é engolida (exit code propagado)', () => {
  const sandbox = prepareSandbox();
  try {
    writeFakeDistPostinstall(
      sandbox,
      [`console.log('trabalho parcial feito');`, `process.exit(3);`].join('\n'),
    );
    const res = runBootstrap(sandbox);
    assert.equal(res.status, 3, `exit 3 do script real deve propagar; veio ${res.status}`);
    assert.match(res.stdout, /trabalho parcial feito/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('postinstall: exceção de CARGA no dist/ existente propaga como falha (MODULE_NOT_FOUND real)', () => {
  const sandbox = prepareSandbox();
  try {
    // dist/ existe mas está corrompido: importa módulo que não existe —
    // deve FALHAR (não pode ser confundido com "dist ausente").
    writeFakeDistPostinstall(sandbox, `import './modulo-inexistente.js';`);
    const res = runBootstrap(sandbox);
    assert.notEqual(res.status, 0, 'erro de carga com dist/ presente NÃO pode virar exit 0');
    assert.doesNotMatch(res.stdout, /dist ausente/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('postinstall: integração no repo real (com dist/) mantém caminho feliz silencioso do checkout', () => {
  // Dentro do próprio checkout do framework, o postinstall real faz early-return
  // (getPackageDir() não está sob node_modules) — comportamento atual integral:
  // exit 0, sem tentar instalar nada, sem mensagem de ativação.
  const res = spawnSync(process.execPath, [realBootstrap], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(res.status, 0, `bootstrap no repo deve terminar 0; stderr: ${res.stderr ?? ''}`);
  assert.doesNotMatch(String(res.stdout ?? ''), /dist ausente/);
});
