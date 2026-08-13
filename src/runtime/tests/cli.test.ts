import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCLI } from '../../cli/index.js';

async function capture(fn: () => void | Promise<void>): Promise<{ logs: string[]; errors: string[]; exitCode: number | null }> {
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
    await fn();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('PROCESS_EXIT')) {
      // exit simulado — fluxo esperado em erros de uso
    } else {
      throw err;
    }
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }
  return { logs, errors, exitCode };
}

test('cli: version imprime versão', async () => {
  const out = await capture(() => runCLI(['version']));
  assert.match(out.logs[0] ?? '', /Izanagi AI CLI v\d+\.\d+\.\d+/);
});

test('cli: help lista comandos', async () => {
  const out = await capture(() => runCLI(['help']));
  assert.match(out.logs.join('\n'), /usage/i);
  assert.match(out.logs.join('\n'), /workflow|benchmark|memory|trace|eval/i);
});

test('cli: workflow list mostra templates e composições', async () => {
  const out = await capture(() => runCLI(['workflow', 'list']));
  const text = out.logs.join('\n');
  assert.match(text, /fullstack/);
  assert.match(text, /debugging/);
  assert.match(text, /evaluation/);
  assert.match(text, /compositions/i);
});

test('cli: eval --metrics avalia e imprime verdict', async () => {
  const out = await capture(() => runCLI(['eval', '--metrics', 'correctness=0.95,security=0.9']));
  const text = out.logs.join('\n');
  assert.match(text, /Verdict:/);
  assert.match(text, /PASS|FAIL|WARNINGS|BLOCKED/);
  assert.match(text, /Score:/);
});

test('cli: trace lista execuções sem travar', async () => {
  const out = await capture(() => runCLI(['trace']));
  assert.ok(out.errors.length === 0 || out.errors.some((e) => /nenhum|usage|não/i.test(e)));
});

test('cli: memory inspect responde', async () => {
  const out = await capture(() => runCLI(['memory', 'inspect']));
  assert.ok(out.logs.length > 0 || out.errors.length > 0);
});

test('cli: agente inexistente reporta erro de uso', async () => {
  const out = await capture(() => runCLI(['agent', 'inspect']));
  assert.ok(out.errors.some((e) => /usage/i.test(e)));
  assert.equal(out.exitCode, 1);
});

test('cli: run sem --prompt-only executa via Adaptive Runtime por default (sem caminho paralelo)', async () => {
  const out = await capture(() => runCLI(['run', 'corrigir bug de login']));
  const text = out.logs.join('\n');
  assert.match(text, /Adaptive Runtime/);
  assert.match(text, /Runtime result:/);
  assert.match(text, /PASS|FAIL|WARNINGS|BLOCKED/);
  assert.ok(!fs.existsSync(path.resolve(process.cwd(), 'izanagi-prompt.md')), 'run sem --prompt-only não deve escrever izanagi-prompt.md');
});

test('cli: run --prompt-only só compila o prompt, sem executar runtime', async () => {
  const promptPath = path.resolve(process.cwd(), 'izanagi-prompt.md');
  try {
    const out = await capture(() => runCLI(['run', 'corrigir bug de login', '--prompt-only']));
    const text = out.logs.join('\n');
    assert.match(text, /Ready-to-use AI prompt generated/);
    assert.doesNotMatch(text, /Runtime result:/);
    assert.ok(fs.existsSync(promptPath));
  } finally {
    fs.rmSync(promptPath, { force: true });
  }
});

test('cli: run aceita --runtime como no-op de compatibilidade', async () => {
  const out = await capture(() => runCLI(['run', 'corrigir bug de login', '--runtime']));
  assert.match(out.logs.join('\n'), /Adaptive Runtime/);
});

test('cli: comando desconhecido mostra help', async () => {
  const out = await capture(() => runCLI(['comando-inexistente-xyz']));
  assert.ok(out.errors.some((e) => /unknown/i.test(e)));
  assert.match(out.logs.join('\n'), /usage/i);
});
