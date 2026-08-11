/**
 * `izanagi diagnose` — diagnóstico profundo do runtime.
 *
 * Verifica: runtime state, traces, memória, avaliações, benchmarks,
 * contrato de skills (frontmatter), security scan das skills e
 * genome dos agentes.
 */

import fs from 'fs';
import path from 'path';
import { TraceStore } from '../../runtime/observability/tracer.js';
import { MemoryStore } from '../../runtime/memory/store.js';
import { SkillScanner } from '../../runtime/security/skill-scanner.js';
import { SkillResolver, parseFrontmatter } from '../../runtime/routing/resolver.js';
import { BenchmarkRegistry } from '../../runtime/benchmarks/registry.js';
import { validateGenome } from '../../runtime/factories/agent-factory.js';

export function diagnoseCommand(baseDir: string): void {
  console.log('\n\x1b[36m=== Izanagi AI Runtime Diagnosis ===\x1b[0m\n');

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  let errors = 0;
  let warnings = 0;

  // 1. Runtime state
  const stateFile = path.join(baseDir, '.izanagi', 'state', 'runtime-state.json');
  if (fs.existsSync(stateFile)) {
    checks.push({ name: 'Runtime state', ok: true, detail: 'presente' });
  } else {
    checks.push({ name: 'Runtime state', ok: true, detail: 'ainda não criado (cria no primeiro run)' });
  }

  // 2. Traces
  const store = new TraceStore({ baseDir });
  const traces = store.list(50);
  checks.push({ name: 'Traces', ok: true, detail: `${traces.length} no diretório ${store.directory}` });

  // 3. Memória
  const memory = new MemoryStore({ baseDir });
  const state = memory.raw;
  const entries = memory.listEntries();
  checks.push({
    name: 'Memory',
    ok: true,
    detail: `${entries.length} categorias markdown, ${Object.keys(state.failures).length} padrões de falha, ${state.learnings.length} learnings, ${Object.keys(state.agents).length} agentes com histórico`,
  });

  // 4. Evaluation
  const benchDir = path.join(baseDir, '.izanagi', 'state', 'benchmarks');
  const benchReports = fs.existsSync(benchDir) ? fs.readdirSync(benchDir).filter((f) => f.endsWith('.json')) : [];
  checks.push({ name: 'Benchmark reports', ok: true, detail: `${benchReports.length} relatório(s)` });

  // 5. Skill frontmatter (contrato)
  const resolver = new SkillResolver({ baseDir });
  const skills = resolver.list();
  let fmMissing = 0;
  for (const s of skills) {
    if (s.version === '1.0.0' && !s.description) fmMissing++;
  }
  checks.push({
    name: 'Skill manifest',
    ok: fmMissing === 0,
    detail: `${skills.length} skills resolvíveis, ${fmMissing} sem frontmatter completo`,
  });

  // 6. Security scan das skills
  const scanner = new SkillScanner();
  const scanResults = scanner.scanDirectory(baseDir, ['INJ-001', 'INJ-002', 'INJ-003']);
  const critical = scanResults.filter((r) => r.level === 'CRITICAL');
  const high = scanResults.filter((r) => r.level === 'HIGH');
  checks.push({
    name: 'Skill security scan',
    ok: critical.length === 0,
    detail: `${scanResults.length} skills varridas, ${critical.length} CRITICAL, ${high.length} HIGH, ${scanResults.length - critical.length - high.length} limpas/baixo`,
  });

  // 7. Agent genome
  const agentDirs = [path.join(baseDir, 'agents'), path.join(baseDir, '.agents', 'agents')];
  let agentCount = 0;
  let genomeIssues = 0;
  const seen = new Set<string>();
  for (const dir of agentDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      if (seen.has(f)) continue;
      seen.add(f);
      agentCount++;
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
        const genome = resolver.loadAgent(raw.name?.toLowerCase().replace(/\s+/g, '-') ?? f)?.genome;
        if (genome) {
          const v = validateGenome(genome);
          if (!v.valid) genomeIssues++;
        }
      } catch {
        genomeIssues++;
      }
    }
  }
  checks.push({ name: 'Agent genome', ok: genomeIssues === 0, detail: `${agentCount} agentes, ${genomeIssues} com problemas de genome` });

  // 8. Benchmarks disponíveis
  const registry = new BenchmarkRegistry();
  const benchCases = registry.load(baseDir);
  checks.push({ name: 'Benchmark suite', ok: true, detail: `${benchCases.length} casos embutidos (10 domínios)` });

  // 9. Contracts
  const contractSkills = skills.filter((s) => s.outputs.length > 0 || s.inputs.length > 0);
  checks.push({ name: 'Artifact contracts', ok: true, detail: `${contractSkills.length} skills declaram inputs/outputs` });

  // Output
  for (const c of checks) {
    if (!c.ok) errors++;
    console.log(`  ${c.ok ? '\x1b[32m✔' : '\x1b[31m✖'} \x1b[1m${c.name}\x1b[0m${c.ok ? '\x1b[0m' : ' — ' + c.detail + '\x1b[0m'}`);
    if (c.ok) console.log(`    \x1b[90m${c.detail}\x1b[0m`);
    if (c.detail.includes('CRITICAL') && c.ok === false) warnings++;
  }

  console.log(`\n\x1b[1mSummary:\x1b[0m ${errors === 0 ? '\x1b[32mHEALTHY\x1b[0m' : '\x1b[31mISSUES FOUND\x1b[0m'} (${errors} errors, ${warnings} warnings)\n`);
  if (errors > 0) process.exitCode = 1;
}
