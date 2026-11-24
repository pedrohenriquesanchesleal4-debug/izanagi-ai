import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  DEFAULT_ORCHESTRATOR_MODE,
  flattenReferences,
  exportToAntigravity,
  exportToClaude,
  exportToCodex,
  exportToOpencode,
} from './exporters.js';
import { detectInstalledClis, getPackageDir } from './installer.js';

/**
 * Instalação de escopo do USUÁRIO: instalou o pacote (`npm i -g izanagi-ai`) ou rodou
 * `izanagi setup` uma vez, e toda CLI de agente instalada abre qualquer projeto já com
 * o orquestrador, os especialistas e as skills. Sem `izanagi init` por projeto.
 *
 * Regras de convivência com o que já existe na máquina:
 * - Documento de memória/instrução global do usuário (CLAUDE.md, AGENTS.md) recebe um
 *   BLOCO marcado; o resto do arquivo é preservado e o bloco é trocado a cada setup.
 * - JSON de configuração é mesclado; agente padrão escolhido pelo usuário é respeitado.
 * - Arquivos gerados só substituem arquivos gerados (marcador), nunca autorais.
 */

export interface GlobalSetupOptions {
  home?: string;
  packageDir?: string;
  /** CLIs a configurar; default = instaladas no PATH + as que já têm pasta de config. */
  clis?: string[];
  /** Instala o plugin do Antigravity via `agy plugin install` quando o binário existe. */
  useAgyBinary?: boolean;
  log?: (line: string) => void;
}

export interface GlobalSetupResult {
  configured: Record<string, string[]>;
  skipped: Record<string, string>;
  version: string;
}

const BLOCK_BEGIN = '<!-- izanagi:begin (gerado por `izanagi setup`; edite fora deste bloco) -->';
const BLOCK_END = '<!-- izanagi:end -->';

export function upsertMarkedBlock(file: string, content: string): boolean {
  const block = `${BLOCK_BEGIN}\n${content.trim()}\n${BLOCK_END}`;
  let current = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  const start = current.indexOf(BLOCK_BEGIN);
  const end = current.indexOf(BLOCK_END);
  let next: string;
  if (start >= 0 && end > start) {
    next = current.slice(0, start) + block + current.slice(end + BLOCK_END.length);
  } else {
    current = current.trimEnd();
    next = current ? `${current}\n\n${block}\n` : `${block}\n`;
  }
  if (next === (fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, 'utf-8');
  return true;
}

function globalModeText(home: string): string {
  const skills = path.join(home, '.izanagi', 'skills').split(path.sep).join('/');
  return `${DEFAULT_ORCHESTRATOR_MODE}

**Instalação global do Izanagi:** vale em qualquer projeto desta máquina, mesmo sem \`izanagi init\`. Catálogo de skills: \`${skills}/<nome>/SKILL.md\` (com \`references.md\` ao lado quando houver). Se o projeto tiver a própria pasta \`.agents/\` do Izanagi, ela tem precedência.`;
}

function readVersion(packageDir: string): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function copyDir(src: string, dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

/** Copia só os .md gerados de `src` para `dest`, sem apagar arquivos autorais de `dest`. */
function copyGeneratedFiles(src: string, dest: string, marker = 'Gerado pelo Izanagi AI'): string[] {
  if (!fs.existsSync(src)) return [];
  fs.mkdirSync(dest, { recursive: true });
  const written: string[] = [];
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.md')) continue;
    const target = path.join(dest, f);
    if (fs.existsSync(target) && !fs.readFileSync(target, 'utf-8').includes(marker)) continue;
    fs.copyFileSync(path.join(src, f), target);
    written.push(target);
  }
  return written;
}

/** Diretório temporário com a forma da fonte do framework (agents/, skills/, .skills/). */
function stageFramework(packageDir: string): string {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-setup-'));
  for (const d of ['agents', 'skills', '.skills', 'core']) {
    const src = path.join(packageDir, d);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(stage, d), { recursive: true });
  }
  return stage;
}

function mergeJson(file: string, apply: (cfg: Record<string, unknown>) => boolean): boolean {
  let cfg: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
      cfg = parsed;
    } catch {
      return false; // JSONC com comentário ou inválido: não arrisca reescrever
    }
  }
  if (!apply(cfg)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`, 'utf-8');
  return true;
}

export function setupGlobal(opts: GlobalSetupOptions = {}): GlobalSetupResult {
  const home = opts.home ?? os.homedir();
  const packageDir = opts.packageDir ?? getPackageDir();
  const log = opts.log ?? (() => {});
  const version = readVersion(packageDir);
  const result: GlobalSetupResult = { configured: {}, skipped: {}, version };

  const hasDir = (rel: string) => fs.existsSync(path.join(home, rel));
  const installed = new Set(opts.clis ?? detectInstalledClis());
  if (!opts.clis) {
    if (hasDir('.claude')) installed.add('claude');
    if (hasDir(path.join('.gemini', 'config'))) installed.add('antigravity');
    if (hasDir(path.join('.config', 'opencode'))) installed.add('opencode');
    if (hasDir('.codex')) installed.add('codex');
  }

  const stage = stageFramework(packageDir);
  try {
    // Catálogo único, lido por qualquer CLI pelo caminho.
    const catalog = fs.existsSync(path.join(stage, '.skills')) ? path.join(stage, '.skills') : path.join(stage, 'skills');
    const izanagiHome = path.join(home, '.izanagi');
    copyDir(catalog, path.join(izanagiHome, 'skills'));
    flattenReferences(path.join(izanagiHome, 'skills'));
    fs.writeFileSync(path.join(izanagiHome, 'VERSION'), `${version}\n`, 'utf-8');
    result.configured.catalog = [path.join(izanagiHome, 'skills')];
    const mode = globalModeText(home);

    if (installed.has('claude')) {
      const files = exportToClaude(home, { rootDoc: false, sourceDir: stage });
      if (upsertMarkedBlock(path.join(home, '.claude', 'CLAUDE.md'), mode)) files.push('.claude/CLAUDE.md');
      result.configured.claude = files;
      log(`Claude Code: ${files.length} arquivo(s) em ~/.claude (agente padrão: orchestrator)`);
    }

    if (installed.has('antigravity')) {
      exportToAntigravity(stage);
      const pluginSrc = path.join(stage, '.agents', 'plugins', 'izanagi');
      const pluginDest = path.join(home, '.gemini', 'config', 'plugins', 'izanagi');
      let how = 'cópia';
      const agy = opts.useAgyBinary !== false && detectInstalledClis().includes('antigravity');
      if (agy) {
        spawnSync('agy', ['plugin', 'uninstall', 'izanagi'], { stdio: 'ignore' });
        const r = spawnSync('agy', ['plugin', 'install', pluginSrc], { stdio: 'ignore' });
        if (r.status === 0) how = 'agy plugin install';
      }
      if (how === 'cópia') {
        copyDir(pluginSrc, pluginDest);
        mergeJson(path.join(home, '.gemini', 'config', 'config.json'), (c) => {
          const plugins = (c.plugins ?? {}) as Record<string, { enabled?: boolean }>;
          if (plugins.izanagi?.enabled) return false;
          plugins.izanagi = { ...(plugins.izanagi ?? {}), enabled: true };
          c.plugins = plugins;
          return true;
        });
      }
      upsertMarkedBlock(path.join(home, '.gemini', 'GEMINI.md'), mode);
      result.configured.antigravity = [pluginDest, path.join(home, '.gemini', 'GEMINI.md')];
      log(`Antigravity: plugin izanagi instalado (${how}) + ~/.gemini/GEMINI.md`);
    }

    if (installed.has('opencode')) {
      exportToOpencode(stage);
      const ocHome = path.join(home, '.config', 'opencode');
      const files = copyGeneratedFiles(path.join(stage, '.opencode', 'agent'), path.join(ocHome, 'agent'));
      const cfgFile = fs.existsSync(path.join(ocHome, 'opencode.json')) || !fs.existsSync(path.join(ocHome, 'opencode.jsonc'))
        ? path.join(ocHome, 'opencode.json')
        : path.join(ocHome, 'opencode.jsonc');
      if (mergeJson(cfgFile, (c) => { if (c.default_agent) return false; c.default_agent = 'orchestrator'; return true; })) files.push(cfgFile);
      if (upsertMarkedBlock(path.join(ocHome, 'AGENTS.md'), mode)) files.push(path.join(ocHome, 'AGENTS.md'));
      result.configured.opencode = files;
      log(`OpenCode: ${files.length} arquivo(s) em ~/.config/opencode (default_agent: orchestrator)`);
    }

    if (installed.has('codex')) {
      exportToCodex(stage);
      const cxHome = path.join(home, '.codex');
      const files = copyGeneratedFiles(path.join(stage, '.codex', 'agents'), path.join(cxHome, 'agents'));
      if (upsertMarkedBlock(path.join(cxHome, 'AGENTS.md'), mode)) files.push(path.join(cxHome, 'AGENTS.md'));
      result.configured.codex = files;
      log(`Codex: ${files.length} arquivo(s) em ~/.codex`);
    }

    for (const cli of ['cursor', 'copilot', 'kimi']) {
      if (installed.has(cli)) {
        result.skipped[cli] = 'sem arquivo de configuração global documentado: use `izanagi init` no projeto';
      }
    }
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
  return result;
}
