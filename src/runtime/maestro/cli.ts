/**
 * Wrapper fino do `maestro-cli`: resolução do binário, spawn com captura de
 * stdout/stderr, timeout e mapeamento dos exit codes para mensagens PT-BR.
 *
 * Exit codes do maestro-cli (CLI 0.17.4): 0 ok, 1 generic, 2 usage, 3 app
 * desktop não rodando, 4 app desatualizado, 5 timeout. O wrapper mapeia e
 * traduz; nunca esconde o stderr original.
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseMaestroEvent } from './events.js';
import type { MaestroEvent, MaestroExitStatus, MaestroCli, MaestroResult } from './types.js';

/**
 * Fallback Windows: o maestro-cli é bundled com o desktop app e nem sempre
 * está no PATH. O `.js` é executável via `node`.
 */
export const MAESTRO_FALLBACK_JS = path.join(
  process.env.ProgramFiles ?? 'C:\\Program Files',
  'Maestro',
  'resources',
  'maestro-cli.js',
);

export const INSTALL_HINT = 'Instale o Maestro (runmaestro.ai) e garanta `maestro-cli` no PATH.';

/** Procura um executável no PATH (com extensões do Windows). */
export function findInPath(executable: string): string | undefined {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter((d) => d.length > 0);
  const names =
    process.platform === 'win32'
      ? [executable, `${executable}.exe`, `${executable}.cmd`, `${executable}.bat`]
      : [executable];
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
      } catch {
        // Diretório ilegível no PATH não derruba a busca.
      }
    }
  }
  return undefined;
}

/** Resolve o binário do maestro-cli: PATH primeiro, fallback do desktop app. */
export function resolveMaestroCli(): MaestroCli | null {
  const direct = findInPath('maestro-cli');
  if (direct) return { bin: direct, prefixArgs: [], display: direct };
  if (process.platform === 'win32' && fs.existsSync(MAESTRO_FALLBACK_JS)) {
    return { bin: process.execPath, prefixArgs: [MAESTRO_FALLBACK_JS], display: MAESTRO_FALLBACK_JS };
  }
  return null;
}

/** Classifica o exit code do maestro-cli em um status conhecido. */
export function exitStatus(code: number): MaestroExitStatus {
  switch (code) {
    case 0:
      return 'ok';
    case 1:
      return 'generic';
    case 2:
      return 'usage';
    case 3:
      return 'app-down';
    case 4:
      return 'app-old';
    case 5:
      return 'timeout';
    default:
      return 'generic';
  }
}

/** Mensagem PT-BR para o exit code do maestro-cli. */
export function exitMessage(code: number): string {
  switch (code) {
    case 0:
      return 'ok';
    case 1:
      return 'falha genérica do maestro-cli';
    case 2:
      return 'uso inválido do maestro-cli (confira os argumentos)';
    case 3:
      return 'app desktop Maestro não está rodando: abra o Maestro (runmaestro.ai) e tente de novo';
    case 4:
      return 'versão do app desktop Maestro desatualizada: atualize o Maestro e tente de novo';
    case 5:
      return 'tempo limite excedido na execução do maestro-cli';
    default:
      return `código de saída não mapeado: ${code}`;
  }
}

/** Assinatura do spawn, injetável nos testes (nunca spawnar maestro-cli real). */
export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface RunMaestroOptions {
  /** Binário/prefixo resolvidos; sem isso, `resolveMaestroCli()` roda. */
  cli?: MaestroCli;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** 0 (default) = sem teto. */
  timeoutMs?: number;
  /** Injectável para testes. */
  spawnImpl?: SpawnFn;
}

/** spawn de `.cmd`/`.bat` no Windows exige shell. */
function spawnOptions(cli: MaestroCli, opts: RunMaestroOptions): SpawnOptions {
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cli.bin);
  return {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(needsShell ? { shell: true } : {}),
  };
}

/**
 * Executa o maestro-cli e captura stdout/stderr. `runMaestro` NÃO parseia
 * eventos: é o caminho de chamadas pontuais (create-agent, list, show...).
 */
export async function runMaestro(args: string[], opts: RunMaestroOptions = {}): Promise<MaestroResult> {
  const cli = opts.cli ?? resolveMaestroCli();
  if (!cli) throw new Error(INSTALL_HINT);
  const spawnFn = opts.spawnImpl ?? spawn;

  return new Promise<MaestroResult>((resolve, reject) => {
    const child = spawnFn(cli.bin, [...cli.prefixArgs, ...args], spawnOptions(cli, opts));
    let stdout = '';
    let stderr = '';
    let settled = false;

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        resolve({ code: 5, status: 'timeout', message: exitMessage(5), stdout, stderr });
      }, opts.timeoutMs);
    }

    const finish = (code: number): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ code, status: exitStatus(code), message: exitMessage(code), stdout, stderr });
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (d: string) => {
      stdout += d;
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (d: string) => {
      stderr += d;
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

/**
 * Executa o maestro-cli com `--json` e entrega cada evento parseado via
 * callback. Resolve no evento `complete`/`goal_complete` OU no fechamento do
 * processo, o que vier primeiro: stream longo não fica preso esperando o
 * processo fechar quando o próprio Maestro já declarou o fim.
 */
export async function streamMaestro(
  args: string[],
  onEvent: (event: MaestroEvent) => void,
  opts: RunMaestroOptions = {},
): Promise<MaestroResult> {
  const cli = opts.cli ?? resolveMaestroCli();
  if (!cli) throw new Error(INSTALL_HINT);
  const spawnFn = opts.spawnImpl ?? spawn;

  return new Promise<MaestroResult>((resolve, reject) => {
    const child = spawnFn(cli.bin, [...cli.prefixArgs, ...args], spawnOptions(cli, opts));
    let stdout = '';
    let stderr = '';
    let remainder = '';
    let settled = false;

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        resolve({ code: 5, status: 'timeout', message: exitMessage(5), stdout, stderr });
      }, opts.timeoutMs);
    }

    const finish = (code: number): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ code, status: exitStatus(code), message: exitMessage(code), stdout, stderr });
    };

    const flush = (chunk: string): void => {
      if (settled) return;
      stdout += chunk;
      const lines = (remainder + chunk).split('\n');
      remainder = lines.pop() ?? '';
      for (const line of lines) {
        const event = parseMaestroEvent(line);
        if (!event) continue;
        onEvent(event);
        if ((event.type === 'complete' || event.type === 'goal_complete') && !settled) {
          finish(event.success === false ? 1 : 0);
          return;
        }
      }
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', flush);
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (d: string) => {
      stderr += d;
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}