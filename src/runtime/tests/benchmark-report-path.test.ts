/**
 * O caminho que o comando IMPRIME tem que ser o caminho onde o arquivo ESTÁ.
 *
 * `benchmark run` grava o relatório sob a raiz de ESTADO (`stateDir`), que num
 * projeto inicializado é `<projeto>/.agents` e não o `cwd`. A mensagem, porém,
 * era um literal sem raiz: `.izanagi/state/benchmarks/<id>.json`. Quem seguia o
 * caminho impresso caía num diretório relativo ao `cwd` que, neste repositório,
 * existe e guarda relatórios ANTIGOS: caminho errado que parece certo é pior
 * que caminho ausente, porque o número velho é lido como se fosse o novo.
 *
 * A regra que estes testes fixam: a mensagem sai do mesmo cálculo da escrita,
 * nunca de um literal paralelo.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { benchmarkCommand } from '../../cli/commands/benchmark.js';
import { benchmarkReportsDir } from '../benchmarks/runner.js';
import { memoryCommand } from '../../cli/commands/memory.js';
import { MemoryStore } from '../memory/store.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function capture(fn: () => Promise<void>): Promise<{ logs: string[]; errors: string[]; exitCode: number | null }> {
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
    if (!(err instanceof Error && err.message.startsWith('PROCESS_EXIT'))) throw err;
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }
  return { logs, errors, exitCode };
}

/** `capture` para comando sincrono: mesma troca de console, sem await. */
function captureSync(fn: () => void): { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (m?: unknown) => { logs.push(String(m)); };
  console.error = (m?: unknown) => { errors.push(String(m)); };
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origError;
  }
  return { logs, errors };
}

/** Remove códigos ANSI: a asserção é sobre o caminho, não sobre a cor. */
function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

test('benchmark: o diretório de relatórios sai de UM cálculo, e é o da raiz de estado', () => {
  const projeto = tmpDir('izanagi-bench-dir-');
  assert.equal(benchmarkReportsDir(projeto), path.join(projeto, '.izanagi', 'state', 'benchmarks'));
  fs.rmSync(projeto, { recursive: true, force: true });
});

test('benchmark run: o caminho impresso é o caminho onde o relatório existe', async () => {
  const assets = tmpDir('izanagi-bench-assets-');
  const projeto = tmpDir('izanagi-bench-state-');

  const out = await capture(() => benchmarkCommand(assets, ['run', 'architecture'], projeto));
  const texto = out.logs.map(plain).join('\n');

  const linha = texto.split('\n').find((l) => l.includes('Relatório salvo em'));
  assert.ok(linha, `esperava a linha de confirmação de escrita. Saída:\n${texto}`);

  const impresso = linha!.replace(/^.*Relatório salvo em\s*/, '').trim();
  assert.ok(
    fs.existsSync(impresso),
    `o caminho impresso não existe no disco: "${impresso}" (raiz de estado: ${projeto})`,
  );
  assert.ok(
    impresso.startsWith(projeto),
    `o caminho impresso tem que estar sob a raiz de estado, não sob o cwd: "${impresso}"`,
  );

  fs.rmSync(assets, { recursive: true, force: true });
  fs.rmSync(projeto, { recursive: true, force: true });
});

test('benchmark report: relatório inexistente aponta a raiz REAL onde procurou', async () => {
  const projeto = tmpDir('izanagi-bench-404-');

  const out = await capture(() => benchmarkCommand(projeto, ['report', 'bench-nao-existe'], projeto));
  const texto = out.errors.map(plain).join('\n');

  assert.equal(out.exitCode, 1, 'relatório ausente é erro de uso');
  assert.ok(
    texto.includes(benchmarkReportsDir(projeto)),
    `a mensagem tem que citar o diretório onde de fato procurou. Saída:\n${texto}`,
  );

  fs.rmSync(projeto, { recursive: true, force: true });
});

test('benchmark compare: sem relatórios, a mensagem cita a raiz REAL', async () => {
  const projeto = tmpDir('izanagi-bench-cmp-');

  const out = await capture(() => benchmarkCommand(projeto, ['compare', 'a', 'b'], projeto));
  const texto = out.errors.map(plain).join('\n');

  assert.equal(out.exitCode, 1);
  assert.ok(
    texto.includes(benchmarkReportsDir(projeto)),
    `a mensagem tem que citar o diretório onde de fato procurou. Saída:\n${texto}`,
  );

  fs.rmSync(projeto, { recursive: true, force: true });
});

test('memory inspect: os caminhos impressos são os que o store de fato usa', () => {
  const projeto = tmpDir('izanagi-mem-path-');
  const store = new MemoryStore({ baseDir: projeto });

  const out = captureSync(() => memoryCommand(projeto, ['inspect']));
  const texto = out.logs.map(plain).join('\n');

  const linha = texto.split('\n').find((l) => l.includes('Estado do runtime:'));
  assert.ok(linha, `esperava a linha do estado do runtime. Saída:\n${texto}`);

  const impresso = linha!.replace(/^.*Estado do runtime:\s*/, '').trim();
  assert.equal(
    impresso,
    store.stateFilePath,
    'o caminho impresso tem que ser o mesmo que o store lê e grava',
  );
  assert.ok(impresso.startsWith(projeto), `tem que estar sob a raiz de estado: "${impresso}"`);

  fs.rmSync(projeto, { recursive: true, force: true });
});
