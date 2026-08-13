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
