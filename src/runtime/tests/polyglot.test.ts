import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCLI } from '../../cli/index.js';
import { polyglotCommand, type PolyglotRow } from '../../cli/commands/polyglot.js';

/**
 * Testes do comando `izanagi polyglot status` — diagnóstico da saúde dos núcleos
 * poliglotas SEM executá-los pesadamente. Fixtures montam sandboxes tmp com os
 * artefatos esperados (bins Rust falsos, socket Go, venv Python fake, dist TS),
 * injetados via opts.root. Nenhuma dependência nova; nenhum stub no código de
 * produção — os fakes vivem apenas aqui, exercendo o contrato real por subprocess.
 */

const EXPECTED_COMPONENTS = [
  'rust:izanagi-core',
  'rust:izanagi-mcp',
  'go:orchestrator',
  'python:venv',
  'python:ast-analyzer',
  'ts:sdk-dist',
  'ts:cli-dist',
] as const;

function tmpRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Executa fn com IZANAGI_ORCHESTRATOR_SOCK controlado, restaurando depois. */
function withSocketEnv<T>(value: string | undefined, fn: () => T): T {
  const saved = process.env.IZANAGI_ORCHESTRATOR_SOCK;
  try {
    if (value === undefined) delete process.env.IZANAGI_ORCHESTRATOR_SOCK;
    else process.env.IZANAGI_ORCHESTRATOR_SOCK = value;
    return fn();
  } finally {
    if (saved === undefined) delete process.env.IZANAGI_ORCHESTRATOR_SOCK;
    else process.env.IZANAGI_ORCHESTRATOR_SOCK = saved;
  }
}

function writeExec(root: string, relPath: string, body: string): string {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
  fs.chmodSync(abs, 0o755);
  return abs;
}

/** Bin Rust fake que responde --version com uma linha fixa. */
function addRustBinWithVersion(root: string, name: string, version: string): void {
  writeExec(root, path.join('target', 'debug', name), [
    '#!/usr/bin/env bash',
    'if [ "$1" = "--version" ]; then',
    `  echo "${name} ${version}"`,
    '  exit 0',
    'fi',
    'exit 0',
  ].join('\n'));
}

/** Bin Rust fake que ignora argumentos e não expõe versão. */
function addMuteRustBin(root: string, name: string, variant: 'debug' | 'release'): void {
  writeExec(root, path.join('target', variant, name), '#!/usr/bin/env bash\nexit 0\n');
}

function addFakeVenv(root: string, behavior: 'ok' | 'import-fail'): void {
  const body = behavior === 'ok'
    ? '#!/usr/bin/env bash\nexit 0\n'
    : '#!/usr/bin/env bash\necho "Traceback (most recent call last):" >&2\necho \'ModuleNotFoundError: No module named \'"\'"\'ast_analyzer\'"\'"\'\' >&2\nexit 1\n';
  writeExec(root, path.join('python-engine', '.venv', 'bin', 'python'), body);
}

function addTsDist(root: string, pkg: 'sdk' | 'cli'): void {
  const dir = path.join(root, 'packages', pkg, 'dist');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.js'), '// build fixture\n', 'utf8');
}

async function runPolyglot(args: string[], root?: string): Promise<{ logs: string[]; errors: string[]; exitCode: number | null }> {
  const logs: string[] = [];
  const errors: string[] = [];
  let exitCode: number | null = null;
  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;
  console.log = (m?: unknown) => { logs.push(String(m)); };
  console.error = (m?: unknown) => { errors.push(String(m)); };
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`PROCESS_EXIT:${exitCode}`);
  }) as never;
  try {
    await polyglotCommand(args, root === undefined ? undefined : { root });
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith('PROCESS_EXIT'))) throw err;
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }
  return { logs, errors, exitCode };
}

function parseJsonRows(logs: string[]): PolyglotRow[] {
  const parsed: unknown = JSON.parse(logs.join('\n'));
  assert.ok(Array.isArray(parsed), 'saída --json deve ser um array de linhas');
  return parsed as PolyglotRow[];
}

function statusOf(rows: PolyglotRow[], component: string): PolyglotRow {
  const row = rows.find((r) => r.component === component);
  assert.ok(row, `linha ausente para ${component}`);
  return row;
}

/**
 * Fixtures que precisam EXECUTAR um script com shebang (bin Rust que responde
 * `--version`, interpretador de venv, e o caminho `--strict` que depende dos
 * dois) só funcionam em POSIX: Windows não executa shebang, `spawnSync` sobre
 * o arquivo falha e a sonda cai para o ramo de erro.
 *
 * Antes deste skip, três desses testes falhavam no Windows de forma INVISÍVEL:
 * a asserção estourava depois do fim do teste e chegava como
 * `unhandledRejection`, então o relatório mostrava "1 fail" no arquivo e
 * nomeava só o quarto. Skip declarado com motivo é honesto; vermelho que
 * esconde outros três não é.
 *
 * A fixture de bin com `--version` é um script com shebang, e Windows não
 * executa shebang: `spawnSync` sobre ele falha e a sonda cai para "presente
 * sem --version", que é o comportamento CORRETO do produto diante de um
 * arquivo que não é executável. Testar o caminho de versão ali exigiria um
 * `.exe` de verdade (um hard link para o `node.exe` falha com EPERM, e copiar
 * 85MB por teste não é um teste barato) ou um `.cmd` via `shell: true`, que
 * é justamente a superfície que a sonda não deve ter.
 *
 * Então o caminho de versão é verificado onde a fixture funciona, e o caminho
 * que importa no Windows (achar o `.exe` que o cargo emite) ganhou teste
 * próprio abaixo. Skip declarado com motivo, não vermelho tolerado.
 */
const POSIX_ONLY_FIXTURE = process.platform === 'win32'
  ? 'fixture com shebang não é executável no Windows (a descoberta está coberta pelos testes de .exe e de .venv/Scripts)'
  : false;

test('polyglot: bin Rust presente com --version barato reporta a versão', { skip: POSIX_ONLY_FIXTURE }, async () => {
  const root = tmpRoot('izanagi-polyglot-ver-');
  try {
    addRustBinWithVersion(root, 'izanagi-core', '0.4.2');
    const out = await runPolyglot(['status'], root);
    assert.equal(out.exitCode, null);
    const text = out.logs.join('\n');
    assert.match(text, /rust:izanagi-core/);
    assert.match(text, /0\.4\.2/);
    assert.match(text, /ok/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: no Windows o binário .exe do cargo é encontrado (antes era reportado ausente)', {
  skip: process.platform === 'win32' ? false : 'sufixo .exe só é procurado no Windows',
}, async () => {
  const root = tmpRoot('izanagi-polyglot-exe-');
  try {
    // Stub com o nome que o `cargo build` emite no Windows. Não precisa ser um
    // PE válido: o que este teste cobra é a DESCOBERTA, e um arquivo que não
    // executa tem que virar "presente, sem --version", nunca "ausente".
    const dir = path.join(root, 'target', 'debug');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'izanagi-core.exe'), 'nao e um PE valido', 'utf8');

    const out = await runPolyglot(['status', '--json'], root);
    const row = statusOf(parseJsonRows(out.logs), 'rust:izanagi-core');
    assert.equal(row.status, 'ok', `esperado ok, veio ${row.status}: ${row.detail}`);
    assert.match(row.detail, /presente/);
    assert.match(String(row.path), /izanagi-core\.exe$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: no Windows a venv em .venv/Scripts/python.exe é encontrada (antes: "venv ausente")', {
  skip: process.platform === 'win32' ? false : 'layout Scripts/ só existe no Windows',
}, async () => {
  const root = tmpRoot('izanagi-polyglot-venvwin-');
  try {
    // `python -m venv` no Windows põe o interpretador aqui, não em bin/.
    const dir = path.join(root, 'python-engine', '.venv', 'Scripts');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'python.exe'), 'stub', 'utf8');

    const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
    const venv = statusOf(rows, 'python:venv');
    assert.equal(venv.status, 'ok', `esperado ok, veio ${venv.status}: ${venv.detail}`);
    assert.match(String(venv.path), /Scripts/);

    // O ast-analyzer deixa de ser "impossível verificar": a venv foi achada, e
    // o stub não importa nada, então o resultado honesto é ausente COM motivo
    // de import, não ausência de venv.
    const analyzer = statusOf(rows, 'python:ast-analyzer');
    assert.equal(analyzer.status, 'ausente');
    assert.equal(/venv ausente/.test(analyzer.detail), false, `detail ainda culpa a venv: ${analyzer.detail}`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: bin Rust sem --version cai para presença (release tem prioridade sobre debug)', async () => {
  const root = tmpRoot('izanagi-polyglot-mute-');
  try {
    addMuteRustBin(root, 'izanagi-mcp', 'release');
    const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
    const row = statusOf(rows, 'rust:izanagi-mcp');
    assert.equal(row.status, 'ok');
    assert.match(row.detail, /presen/i);
    assert.match(row.path ?? '', /target[/\\]release[/\\]izanagi-mcp$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: bins Rust ausentes em raiz vazia', async () => {
  const root = tmpRoot('izanagi-polyglot-empty-');
  try {
    const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
    assert.equal(statusOf(rows, 'rust:izanagi-core').status, 'ausente');
    assert.equal(statusOf(rows, 'rust:izanagi-mcp').status, 'ausente');
    assert.equal(statusOf(rows, 'rust:izanagi-core').path, null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: socket do orquestrador Go via env IZANAGI_ORCHESTRATOR_SOCK', () => {
  const root = tmpRoot('izanagi-polyglot-go-');
  try {
    const sock = path.join(root, 'swarm.sock');
    fs.writeFileSync(sock, '', 'utf8');
    withSocketEnv(sock, async () => {
      const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
      const row = statusOf(rows, 'go:orchestrator');
      assert.equal(row.status, 'ok');
      assert.equal(row.path, sock);
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: env apontando para socket inexistente → ausente (sem crash)', () => {
  const root = tmpRoot('izanagi-polyglot-go2-');
  try {
    withSocketEnv(path.join(root, 'nao-existe.sock'), async () => {
      const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
      assert.equal(statusOf(rows, 'go:orchestrator').status, 'ausente');
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: venv Python saudável → venv ok e ast_analyzer importável', { skip: POSIX_ONLY_FIXTURE }, () => {
  const root = tmpRoot('izanagi-polyglot-py-');
  try {
    addFakeVenv(root, 'ok');
    withSocketEnv(undefined, async () => {
      const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
      assert.equal(statusOf(rows, 'python:venv').status, 'ok');
      const ast = statusOf(rows, 'python:ast-analyzer');
      assert.equal(ast.status, 'ok');
      assert.match(ast.detail, /import/i);
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: venv presente mas import falha → ast-analyzer ausente com stderr resumido', { skip: POSIX_ONLY_FIXTURE }, () => {
  const root = tmpRoot('izanagi-polyglot-py2-');
  try {
    addFakeVenv(root, 'import-fail');
    withSocketEnv(undefined, async () => {
      const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
      assert.equal(statusOf(rows, 'python:venv').status, 'ok');
      const ast = statusOf(rows, 'python:ast-analyzer');
      assert.equal(ast.status, 'ausente');
      assert.match(ast.detail, /ModuleNotFoundError/);
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: venv ausente → ast-analyzer ausente explicando o motivo', () => {
  const root = tmpRoot('izanagi-polyglot-py3-');
  try {
    withSocketEnv(undefined, async () => {
      const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
      assert.equal(statusOf(rows, 'python:venv').status, 'ausente');
      const ast = statusOf(rows, 'python:ast-analyzer');
      assert.equal(ast.status, 'ausente');
      assert.match(ast.detail, /venv ausente/);
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: dist TS de sdk/cli — presente e ausente no mesmo cenário', () => {
  const root = tmpRoot('izanagi-polyglot-ts-');
  try {
    addTsDist(root, 'sdk');
    withSocketEnv(undefined, async () => {
      const rows = parseJsonRows((await runPolyglot(['status', '--json'], root)).logs);
      assert.equal(statusOf(rows, 'ts:sdk-dist').status, 'ok');
      assert.equal(statusOf(rows, 'ts:cli-dist').status, 'ausente');
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: modo --json cobre exatamente os 7 componentes com schema estável', () => {
  const root = tmpRoot('izanagi-polyglot-json-');
  try {
    addRustBinWithVersion(root, 'izanagi-core', '1.0.0');
    addRustBinWithVersion(root, 'izanagi-mcp', '1.0.0');
    addFakeVenv(root, 'ok');
    addTsDist(root, 'sdk');
    addTsDist(root, 'cli');
    withSocketEnv(undefined, async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (m?: unknown) => { logs.push(String(m)); };
      try {
        await polyglotCommand(['status', '--json'], { root });
      } finally { console.log = origLog; }
      const rows = parseJsonRows(logs);
      assert.deepEqual(rows.map((r) => r.component), [...EXPECTED_COMPONENTS]);
      for (const r of rows) {
        assert.ok(r.status === 'ok' || r.status === 'ausente', `status inválido: ${r.status}`);
        assert.equal(typeof r.detail, 'string');
        assert.ok(r.path === null || typeof r.path === 'string');
      }
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('polyglot: --strict sai 1 quando algo ausente e 0 quando tudo ok', { skip: POSIX_ONLY_FIXTURE }, () => {
  const empty = tmpRoot('izanagi-polyglot-s1-');
  const full = tmpRoot('izanagi-polyglot-s2-');
  try {
    // cenário vazio: algo ausente → exit 1
    withSocketEnv(undefined, async () => {
      const outEmpty = await runPolyglot(['status', '--strict'], empty);
      assert.equal(outEmpty.exitCode, 1);
      // cenário completo → exit 0
      addRustBinWithVersion(full, 'izanagi-core', '1.0.0');
      addRustBinWithVersion(full, 'izanagi-mcp', '1.0.0');
      const sock = path.join(full, 'orch.sock');
      fs.writeFileSync(sock, '', 'utf8');
      addFakeVenv(full, 'ok');
      addTsDist(full, 'sdk');
      addTsDist(full, 'cli');
      withSocketEnv(sock, async () => {
        const outFull = await runPolyglot(['status', '--strict'], full);
        assert.equal(outFull.exitCode, null, 'tudo ok nem entra no ramo de exit');
      });
    });
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
    fs.rmSync(full, { recursive: true, force: true });
  }
});

test('polyglot: subcomando inválido → erro de uso com exit 1', async () => {
  const out = await runPolyglot(['deploy'], undefined);
  assert.equal(out.exitCode, 1);
  assert.match(out.errors.join('\n'), /uso/i);
});

test('polyglot: registrado no router — tabela renderiza e help lista o comando', async () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (m?: unknown) => { logs.push(String(m)); };
  try {
    await runCLI(['polyglot']);
  } finally { console.log = origLog; }
  const text = logs.join('\n');
  assert.match(text, /rust:izanagi-core/);
  assert.match(text, /ts:sdk-dist/);

  const helpLogs: string[] = [];
  console.log = (m?: unknown) => { helpLogs.push(String(m)); };
  try {
    await runCLI(['help']);
  } finally { console.log = origLog; }
  assert.match(helpLogs.join('\n'), /polyglot/);
});
