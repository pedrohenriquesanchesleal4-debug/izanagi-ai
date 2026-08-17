/**
 * Health Checks — lógica compartilhada entre `izanagi doctor --deep` e
 * `izanagi diagnose`, para eliminar a duplicação de instanciar os mesmos
 * stores (Memory/Trace/Benchmark/Scanner/Resolver) e computar os mesmos
 * números duas vezes com apresentação levemente diferente.
 *
 * `doctor` = saúde ESTRUTURAL do framework (arquivos, manifests, aliases).
 * `diagnose` = investigação do estado de EXECUÇÃO (runtime state, genome,
 * contratos). Cada comando decide o que exibir e o que conta como erro —
 * este módulo só calcula os fatos, uma vez só.
 */

import fs from 'fs';
import path from 'path';
import { MemoryStore } from '../runtime/memory/store.js';
import { TraceStore } from '../runtime/observability/tracer.js';
import { BenchmarkRegistry } from '../runtime/benchmarks/registry.js';
import { SkillScanner } from '../runtime/security/skill-scanner.js';
import { SkillResolver } from '../runtime/routing/resolver.js';
import type { SkillManifest, SkillScanResult } from '../runtime/types.js';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export function checkMemory(baseDir: string): CheckResult {
  const memory = new MemoryStore({ baseDir });
  const state = memory.raw;
  const categorias = memory.listEntries().length;
  return {
    name: 'Memory',
    ok: true,
    detail: `${categorias} categorias markdown, ${Object.keys(state.failures).length} padrões de falha, ${state.learnings.length} learnings, ${Object.keys(state.agents).length} agentes com histórico`,
  };
}

export function checkTraces(baseDir: string, limit = 50): CheckResult & { count: number } {
  const store = new TraceStore({ baseDir });
  const traces = store.list(limit);
  return {
    name: 'Traces',
    ok: true,
    detail: `${traces.length} execução(ões) registrada(s) em ${store.directory}`,
    count: traces.length,
  };
}

export function checkBenchmarkSuite(baseDir: string): CheckResult & { count: number } {
  const registry = new BenchmarkRegistry();
  const cases = registry.load(baseDir);
  const domains = new Set(cases.map((c) => c.domain)).size;
  return { name: 'Benchmarks', ok: true, detail: `${cases.length} casos (${domains} domínios)`, count: cases.length };
}

export function checkBenchmarkReports(baseDir: string): CheckResult & { count: number } {
  const dir = path.join(baseDir, '.izanagi', 'state', 'benchmarks');
  const count = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0;
  return { name: 'Benchmark reports', ok: true, detail: `${count} relatório(s) persistido(s)`, count };
}

export function checkSkillSecurityScan(baseDir: string, allowlist?: string[]): CheckResult & { results: SkillScanResult[] } {
  const scanner = new SkillScanner();
  const results = scanner.scanDirectory(baseDir, allowlist);
  const critical = results.filter((s) => s.level === 'CRITICAL');
  const high = results.filter((s) => s.level === 'HIGH');
  const ok = critical.length === 0;
  const detail = ok
    ? `${results.length} skills varridas, nenhuma CRITICAL/HIGH`
    : `${critical.length} CRITICAL, ${high.length} HIGH (${results.length} varridas)`;
  return { name: 'Skill security scan', ok, detail, results };
}

export function checkSkillManifest(baseDir: string): CheckResult & { skills: SkillManifest[] } {
  const resolver = new SkillResolver({ baseDir });
  const skills = resolver.list();
  const noMeta = skills.filter((s) => !s.description && s.version === '1.0.0').length;
  const ok = noMeta === 0;
  const detail = ok
    ? `${skills.length} skills com metadados completos`
    : `${skills.length} skills resolvíveis, ${noMeta} sem frontmatter de manifesto completo`;
  return { name: 'Skill manifest', ok, detail, skills };
}

export function checkArtifactContracts(skills: SkillManifest[]): CheckResult {
  const withContracts = skills.filter((s) => s.outputs.length > 0 || s.inputs.length > 0);
  return { name: 'Artifact contracts', ok: true, detail: `${withContracts.length}/${skills.length} skills declaram inputs/outputs` };
}

/**
 * Detecta a pasta duplicada `<nome>/<nome>` — ex.: `izanagi-ai/izanagi-ai/` — criada quando
 * `git clone <repo>` roda dentro de um diretório já nomeado como o repo, ou quando `izanagi init`
 * é apontado para uma subpasta em vez do diretório atual. Sintoma reportado: agents/commands/skills
 * nativos do Claude Code (ou de qualquer outro CLI adapter) não aparecem "de cara" porque o CLI é
 * aberto na pasta de fora (vazia) enquanto `.claude/`, `.git/`, etc. vivem um nível abaixo.
 */
export function checkNestedDuplicate(cwd: string): CheckResult | null {
  const baseName = path.basename(cwd);
  const nestedDir = path.join(cwd, baseName);

  if (!fs.existsSync(nestedDir) || !fs.statSync(nestedDir).isDirectory()) return null;

  const nestedLooksLikeProjectRoot =
    fs.existsSync(path.join(nestedDir, '.git')) || fs.existsSync(path.join(nestedDir, 'package.json'));
  const cwdAlreadyHasOwnRoot =
    fs.existsSync(path.join(cwd, '.git')) || fs.existsSync(path.join(cwd, 'package.json'));

  if (!nestedLooksLikeProjectRoot || cwdAlreadyHasOwnRoot) return null;

  return {
    name: 'Nested duplicate folder',
    ok: false,
    detail:
      `"${nestedDir}" parece ser a raiz real do projeto (tem .git/package.json), mas o CLI foi aberto em ` +
      `"${cwd}" — um nível acima, sem nada dentro. Isso costuma vir de um "git clone" rodado dentro de uma ` +
      `pasta já nomeada "${baseName}", ou de "izanagi init ${baseName}" chamado de dentro dela. Efeito prático: ` +
      `.claude/agents, .claude/commands e .claude/skills nunca aparecem "de cara" no Claude Code, porque ele ` +
      `descobre esses arquivos a partir de onde foi aberto, não de onde eles realmente estão. Corrija movendo ` +
      `o conteúdo de "${nestedDir}" para "${cwd}" (achatando a duplicação) e reabra o CLI a partir de "${cwd}".`,
  };
}

/** Distribuição de lifecycle das skills — sinaliza draft/deprecated (nunca é erro, só visibilidade). */
export function checkSkillLifecycle(skills: SkillManifest[]): CheckResult {
  const counts: Record<string, number> = {};
  for (const s of skills) {
    const key = s.lifecycle ?? 'active';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const draft = counts.draft ?? 0;
  const deprecated = counts.deprecated ?? 0;
  const parts = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k}=${v}`);
  const detail = parts.join(', ') + (draft > 0 ? ` — ${draft} draft ainda sem promoção` : '') + (deprecated > 0 ? ` — ${deprecated} deprecated` : '');
  return { name: 'Skill lifecycle', ok: true, detail };
}
