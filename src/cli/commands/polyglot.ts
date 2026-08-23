import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getPackageDir } from '../../installer.js';

/**
 * `izanagi polyglot status` — ponte de diagnóstico entre a CLI legado (TypeScript)
 * e os núcleos poliglotas do monorepo (Rust, Go, Python, packages TS), SEM executá-los
 * pesadamente: no máximo probes baratos (`--version` dos bins com timeout curto e
 * `import ast_analyzer` no venv) + checagens de existência.
 *
 * Contrato:
 * - Exit code 0 SEMPRE em modo normal (status é diagnóstico, não gate).
 * - `--strict` sai 1 se qualquer componente estiver ausente (útil em CI opcional).
 * - `--json` emite array puro de linhas máquina-legíveis (sem ANSI).
 * - Zero dependências novas: apenas node:fs/path/child_process.
 *
 * Ancoragem: os artefatos poliglotas vivem na raiz do MONOREPO (target/, packages/,
 * python-engine/) — que coincide com getPackageDir() no checkout dev. Num consumo via
 * npm (node_modules/izanagi-ai) nada disso existe → tudo "ausente", que é o diagnóstico
 * correto para quem não é desenvolvedor do framework. Testes injetam outra raiz via opts.root.
 */

export type PolyglotStatus = 'ok' | 'ausente';

export interface PolyglotRow {
  /** Identificador estável do componente (ex.: 'rust:izanagi-core'). */
  component: string;
  status: PolyglotStatus;
  /** Detalhe curto legível (versão, caminho efetivo ou motivo da ausência). */
  detail: string;
  /** Caminho verificado quando aplicável; null quando nada foi encontrado. */
  path: string | null;
}

export interface PolyglotOptions {
  /** Raiz do monorepo onde procurar artefatos poliglotas (default: instalação do pacote). */
  root?: string;
}

const VERSION_PROBE_TIMEOUT_MS = 1500;
const PYTHON_IMPORT_TIMEOUT_MS = 5000;
const MAX_DETAIL_LEN = 120;

/**
 * Defaults do socket do orquestrador Go. `/tmp/izanagi-swarm.sock` é o default do
 * task-spec; `/tmp/izanagi-orch.sock` é o default real do servidor go-services/
 * swarm_orchestrator (rpc.go). A env IZANAGI_ORCHESTRATOR_SOCK, quando setada,
 * substitui TODOS os defaults (comportamento do SDK/packages).
 */
const DEFAULT_SOCKET_CANDIDATES = ['/tmp/izanagi-swarm.sock', '/tmp/izanagi-orch.sock'] as const;

interface CheckContext {
  root: string;
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * Sonda barata de versão: roda `<bin> --version` com timeout curto. Só aceita resposta
 * quando exit 0 e primeira linha de stdout curta e não-vazia; caso contrário (binário
 * mudo, flag não suportada, hang, crash) devolve null → caller reporta só presença.
 */
function probeBinaryVersion(binPath: string): string | null {
  let firstLine = '';
  try {
    const res = spawnSync(binPath, ['--version'], { timeout: VERSION_PROBE_TIMEOUT_MS, encoding: 'utf8' });
    if (res.status !== 0 || res.error !== undefined) return null;
    firstLine = (res.stdout ?? '').split('\n')[0]?.trim() ?? '';
  } catch {
    return null;
  }
  if (firstLine.length === 0 || firstLine.length > MAX_DETAIL_LEN) return null;
  return firstLine;
}

function checkRustBin(ctx: CheckContext, binName: string): PolyglotRow {
  const component = `rust:${binName}`;
  // Prefere release (artefato de grau produção); cai para debug (build dev corrente).
  for (const variant of ['release', 'debug'] as const) {
    const binPath = path.join(ctx.root, 'target', variant, binName);
    if (!isFile(binPath)) continue;
    const version = probeBinaryVersion(binPath);
    const detail = version !== null
      ? `binário ${variant}; versão: ${version}`
      : `binário ${variant} presente (sem --version utilizável)`;
    return { component, status: 'ok', detail, path: binPath };
  }
  return { component, status: 'ausente', detail: 'não encontrado em target/{release,debug}', path: null };
}

function socketCandidates(): string[] {
  const fromEnv = process.env.IZANAGI_ORCHESTRATOR_SOCK?.trim();
  return fromEnv ? [fromEnv] : [...DEFAULT_SOCKET_CANDIDATES];
}

function checkGoOrchestrator(): PolyglotRow {
  const candidates = socketCandidates();
  for (const sock of candidates) {
    if (fs.existsSync(sock)) {
      return { component: 'go:orchestrator', status: 'ok', detail: `socket em ${sock}`, path: sock };
    }
  }
  const viaEnv = Boolean(process.env.IZANAGI_ORCHESTRATOR_SOCK?.trim());
  const detail = viaEnv
    ? `socket da env IZANAGI_ORCHESTRATOR_SOCK ausente (${candidates.join(', ')})`
    : `nenhum socket (${candidates.join(' ou ')})`;
  return { component: 'go:orchestrator', status: 'ausente', detail, path: null };
}

function venvPythonPath(root: string): string {
  return path.join(root, 'python-engine', '.venv', 'bin', 'python');
}

function checkPythonVenv(ctx: CheckContext): PolyglotRow {
  const pyPath = venvPythonPath(ctx.root);
  if (isFile(pyPath)) {
    return { component: 'python:venv', status: 'ok', detail: 'venv Python presente', path: pyPath };
  }
  return { component: 'python:venv', status: 'ausente', detail: 'venv ausente (python-engine/.venv/bin/python)', path: null };
}

function checkAstAnalyzer(ctx: CheckContext): PolyglotRow {
  const pyPath = venvPythonPath(ctx.root);
  if (!isFile(pyPath)) {
    return {
      component: 'python:ast-analyzer',
      status: 'ausente',
      detail: 'venv ausente — impossível verificar import',
      path: null,
    };
  }
  let exitStatus: number | null = null;
  let lastStderrLine = '';
  try {
    const res = spawnSync(pyPath, ['-c', 'import ast_analyzer'], {
      cwd: path.join(ctx.root, 'python-engine'),
      timeout: PYTHON_IMPORT_TIMEOUT_MS,
      encoding: 'utf8',
    });
    exitStatus = res.status;
    const stderrLines = (res.stderr ?? '').trim().split('\n').filter((line: string) => line.length > 0);
    lastStderrLine = stderrLines[stderrLines.length - 1] ?? '';
  } catch (err) {
    const reason = err instanceof Error ? truncate(err.message, 80) : 'falha desconhecida ao spawnar venv';
    return { component: 'python:ast-analyzer', status: 'ausente', detail: `import falhou: ${reason}`, path: pyPath };
  }
  if (exitStatus === 0) {
    return { component: 'python:ast-analyzer', status: 'ok', detail: 'ast_analyzer importável', path: pyPath };
  }
  const reason = lastStderrLine.length > 0 ? truncate(lastStderrLine, 80) : `exit ${String(exitStatus)}`;
  return { component: 'python:ast-analyzer', status: 'ausente', detail: `import falhou: ${reason}`, path: pyPath };
}

function checkTsDist(ctx: CheckContext, pkg: 'sdk' | 'cli'): PolyglotRow {
  const component = `ts:${pkg}-dist`;
  const distDir = path.join(ctx.root, 'packages', pkg, 'dist');
  let entryCount = 0;
  try {
    if (fs.statSync(distDir).isDirectory()) entryCount = fs.readdirSync(distDir).length;
  } catch {
    entryCount = 0;
  }
  if (entryCount > 0) {
    return { component, status: 'ok', detail: `packages/${pkg}/dist presente`, path: distDir };
  }
  return { component, status: 'ausente', detail: `packages/${pkg}/dist ausente (rode o build do package)`, path: null };
}

/** Ordem fixa e estável — contrato também consumido pelo modo --json. */
export function collectPolyglotRows(ctx: CheckContext): PolyglotRow[] {
  return [
    checkRustBin(ctx, 'izanagi-core'),
    checkRustBin(ctx, 'izanagi-mcp'),
    checkGoOrchestrator(),
    checkPythonVenv(ctx),
    checkAstAnalyzer(ctx),
    checkTsDist(ctx, 'sdk'),
    checkTsDist(ctx, 'cli'),
  ];
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function renderTextTable(rows: PolyglotRow[], root: string): string {
  const componentWidth = Math.max(...rows.map((r) => r.component.length), 'component'.length);
  const statusWidth = Math.max(...rows.map((r) => r.status.length), 'status'.length);
  const lines: string[] = [];
  lines.push(`${BOLD}Izanagi Polyglot Status${RESET} — raiz: ${root}`);
  lines.push('');
  lines.push(
    `${'component'.padEnd(componentWidth)}  ${'status'.padEnd(statusWidth)}  detail`,
  );
  for (const row of rows) {
    const color = row.status === 'ok' ? GREEN : RED;
    lines.push(
      `${row.component.padEnd(componentWidth)}  ${color}${row.status.padEnd(statusWidth)}${RESET}  ${row.detail}`,
    );
  }
  return lines.join('\n');
}

function usageError(): never {
  console.error('[polyglot] Uso: izanagi polyglot status [--json] [--strict]');
  process.exit(1);
}

interface ParsedFlags {
  json: boolean;
  strict: boolean;
}

function parseArgs(rest: string[]): ParsedFlags {
  const flags: ParsedFlags = { json: false, strict: false };
  let sawSubcommand = false;
  for (const arg of rest) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === 'status') {
      if (sawSubcommand) usageError();
      sawSubcommand = true;
    } else {
      usageError();
    }
  }
  return flags;
}

/**
 * Handler do comando. Sempre imprime o relatório; exit code só muda com --strict.
 * Síncrono na essência (spawnSync nos probes), assinatura async por uniformidade
 * com o router (todos os comandos são awaited).
 */
export async function polyglotCommand(rest: string[], opts?: PolyglotOptions): Promise<void> {
  const { json, strict } = parseArgs(rest);
  const root = path.resolve(opts?.root ?? getPackageDir());
  const rows = collectPolyglotRows({ root });

  if (json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(renderTextTable(rows, root));
  }

  if (strict && rows.some((r) => r.status === 'ausente')) {
    process.exit(1);
  }
}
