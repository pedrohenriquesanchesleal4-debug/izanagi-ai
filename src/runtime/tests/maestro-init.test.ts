/**
 * Detecção de providers (mock PATH) e wrapper da CLI maestro (mock spawn).
 *
 * NENHUM teste aqui spawna o maestro-cli real: CI não tem o desktop app. O
 * spawn é injetado via `spawnImpl`, e o PATH é mockado via env.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import {
  detectProviders,
  PROVIDER_DEFS,
} from '../maestro/init.js';
import {
  findInPath,
  resolveMaestroCli,
  runMaestro,
  streamMaestro,
  exitStatus,
  exitMessage,
  type SpawnFn,
} from '../maestro/cli.js';
import type { MaestroCli, MaestroResult } from '../maestro/types.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const FAKE_CLI: MaestroCli = { bin: 'maestro-cli', prefixArgs: [], display: 'maestro-cli' };

interface FakeChildOptions {
  code: number;
  stdout?: string;
  stderr?: string;
}

/**
 * Cria um fake de `spawn` que emite stdout/stderr e fecha com o code dado.
 * Compatível com a interface que o wrapper consome (EventEmitter + on/close).
 */
function makeFakeSpawn(opts: FakeChildOptions): SpawnFn {
  return (() => {
    const child = {
      stdout: new EventEmitter() as EventEmitter & { setEncoding: () => void },
      stderr: new EventEmitter() as EventEmitter & { setEncoding: () => void },
      _error: undefined as ((err: Error) => void) | undefined,
      _close: undefined as ((code: number | null) => void) | undefined,
      killed: false,
      on(event: string, cb: unknown): unknown {
        if (event === 'error') this._error = cb as (err: Error) => void;
        if (event === 'close') this._close = cb as (code: number | null) => void;
        return this;
      },
      kill(): void {
        this.killed = true;
      },
    };
    child.stdout.setEncoding = (): void => undefined;
    child.stderr.setEncoding = (): void => undefined;

    setImmediate(() => {
      if (opts.stdout) child.stdout.emit('data', opts.stdout);
      if (opts.stderr) child.stderr.emit('data', opts.stderr);
      if (child._close) child._close(opts.code);
    });

    return child as unknown as ReturnType<SpawnFn>;
  }) as SpawnFn;
}

test('init: detectProviders pega só os instalados no PATH (mock)', () => {
  const dir = tmpDir('izanagi-provider-');
  const suffix = process.platform === 'win32' ? '.cmd' : '';
  // opencode e codex instalados; claude-code ausente de propósito
  fs.writeFileSync(path.join(dir, `opencode${suffix}`), '');
  fs.writeFileSync(path.join(dir, `codex${suffix}`), '');

  const oldPath = process.env.PATH;
  process.env.PATH = dir;
  try {
    const providers = detectProviders();
    const installed = providers.filter((p) => p.installed).map((p) => p.id).sort();
    assert.deepEqual(installed, ['codex', 'opencode']);

    const claude = providers.find((p) => p.id === 'claude-code');
    assert.equal(claude?.installed, false, 'claude-code não instalado não é selecionável');

    const oc = providers.find((p) => p.id === 'opencode');
    assert.equal(oc?.path, path.join(dir, `opencode${suffix}`));
  } finally {
    process.env.PATH = oldPath;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('init: PROVIDER_DEFS cobre o catálogo do spec', () => {
  const ids: string[] = PROVIDER_DEFS.map((p) => p.id);
  for (const expected of ['claude-code', 'codex', 'opencode', 'copilot-cli', 'factory-droid', 'hermes', 'pi', 'qwen3-coder', 'omp']) {
    assert.ok(ids.includes(expected), `faltou ${expected} no catálogo`);
  }
});

test('cli: findInPath acha binário nas extensões do Windows', { skip: process.platform !== 'win32' ? 'extensões .cmd são específicas do Windows' : false }, () => {
  const dir = tmpDir('izanagi-path-');
  fs.writeFileSync(path.join(dir, 'ferramenta.cmd'), '');
  const oldPath = process.env.PATH;
  process.env.PATH = dir;
  try {
    assert.equal(findInPath('ferramenta'), path.join(dir, 'ferramenta.cmd'));
    assert.equal(findInPath('inexistente'), undefined);
  } finally {
    process.env.PATH = oldPath;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('cli: resolveMaestroCli resolve nesta máquina ou cai no fallback sem lançar', () => {
  // Não afirmamos presença/ausência (a máquina pode ter ou não): o contrato é
  // que resolve para algo spawnável ou null, nunca throw.
  const cli = resolveMaestroCli();
  assert.ok(cli === null || typeof cli.bin === 'string');
});

test('cli: exit code 3 vira app-down com mensagem clara', () => {
  assert.equal(exitStatus(0), 'ok');
  assert.equal(exitStatus(1), 'generic');
  assert.equal(exitStatus(2), 'usage');
  assert.equal(exitStatus(3), 'app-down');
  assert.equal(exitStatus(4), 'app-old');
  assert.equal(exitStatus(5), 'timeout');
  assert.ok(exitMessage(3).includes('app desktop Maestro não está rodando'));
  assert.ok(exitMessage(5).includes('tempo limite'));
});

test('cli: runMaestro coleta stdout/stderr e mapeia status', async () => {
  const fake = makeFakeSpawn({ code: 0, stdout: '{"id":"ag-1"}\n', stderr: '' });
  const result: MaestroResult = await runMaestro(['create-agent', 'meu-agente', '-d', '.', '-t', 'opencode', '--json'], {
    cli: FAKE_CLI,
    spawnImpl: fake,
  });
  assert.equal(result.code, 0);
  assert.equal(result.status, 'ok');
  assert.equal(result.stdout, '{"id":"ag-1"}\n');
});

test('cli: runMaestro mapeia exit 3 para mensagem de app desktop', async () => {
  const fake = makeFakeSpawn({ code: 3, stdout: '', stderr: 'desktop app não encontrado' });
  const result: MaestroResult = await runMaestro(['list', 'agents'], { cli: FAKE_CLI, spawnImpl: fake });
  assert.equal(result.status, 'app-down');
  assert.ok(result.message.includes('app desktop Maestro não está rodando'));
  assert.equal(result.stderr, 'desktop app não encontrado');
});

test('cli: runMaestro sem cli e sem maestro no PATH lança erro de instalação', async () => {
  const dir = tmpDir('izanagi-no-maestro-');
  const oldPath = process.env.PATH;
  process.env.PATH = dir;
  try {
    await assert.rejects(
      () => runMaestro(['list'], { cli: undefined, spawnImpl: makeFakeSpawn({ code: 0 }) }),
      /Instale o Maestro/,
    );
  } finally {
    process.env.PATH = oldPath;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('cli: streamMaestro entrega eventos e resolve no complete', async () => {
  const stream =
    '{"type":"document_start","document":"01.md","taskCount":1}\n' +
    '{"type":"task_complete","taskIndex":0,"success":true}\n' +
    '{"type":"complete","success":true,"totalTasksCompleted":1,"totalCost":0.1}\n';
  const fake = makeFakeSpawn({ code: 0, stdout: stream });

  const received: string[] = [];
  const result = await streamMaestro(
    ['run-doc', '01.md', '--agent', 'ag-1', '--json'],
    (event) => {
      received.push(event.type);
    },
    { cli: FAKE_CLI, spawnImpl: fake },
  );

  assert.deepEqual(received, ['document_start', 'task_complete', 'complete']);
  assert.equal(result.code, 0);
  assert.equal(result.status, 'ok');
});

test('cli: streamMaestro resolve no goal_complete com sucesso', async () => {
  const stream =
    '{"type":"goal_start","objective":"refatorar"}\n' +
    '{"type":"goal_complete","success":true,"exitReason":"criteria-met","finalProgress":1,"iterations":2}\n';
  const fake = makeFakeSpawn({ code: 0, stdout: stream });

  const received: string[] = [];
  const result = await streamMaestro(['goal-run', 'ag-1', 'refatorar', '--json'], (event) => {
    received.push(event.type);
  }, { cli: FAKE_CLI, spawnImpl: fake });

  assert.deepEqual(received, ['goal_start', 'goal_complete']);
  assert.equal(result.code, 0);
  assert.equal(result.status, 'ok');
});