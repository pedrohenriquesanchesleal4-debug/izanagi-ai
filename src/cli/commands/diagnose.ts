/**
 * `izanagi diagnose` — diagnóstico profundo do runtime.
 *
 * Verifica: runtime state, traces, memória, avaliações, benchmarks,
 * contrato de skills (frontmatter), security scan das skills e
 * genome dos agentes.
 */

import fs from 'fs';
import path from 'path';
import { SkillResolver } from '../../runtime/routing/resolver.js';
import { validateGenome } from '../../runtime/factories/agent-factory.js';
import {
  checkMemory,
  checkTraces,
  checkBenchmarkSuite,
  checkBenchmarkReports,
  checkSkillSecurityScan,
  checkSkillManifest,
  checkArtifactContracts,
  checkSkillLifecycle,
  type CheckResult,
} from '../checks.js';

/**
 * @param baseDir  Raiz dos ASSETS do framework (agentes, skills, casos de benchmark).
 * @param stateDir Raiz do ESTADO deste projeto (memória, traces, relatórios).
 *                 Default: `baseDir`. Ver `resolveStateRoot` no installer.
 */
export function diagnoseCommand(baseDir: string, stateDir = baseDir): void {
  console.log('\n\x1b[36m=== Izanagi AI Runtime Diagnosis ===\x1b[0m\n');

  const checks: CheckResult[] = [];
  let errors = 0;
  let warnings = 0;

  // 1. Runtime state
  const stateFile = path.join(baseDir, '.izanagi', 'state', 'runtime-state.json');
  checks.push({
    name: 'Runtime state',
    ok: true,
    detail: fs.existsSync(stateFile) ? 'presente' : 'ainda não criado (cria no primeiro run)',
  });

  // 2. Traces
  checks.push(checkTraces(stateDir, 50));

  // 3. Memória
  checks.push(checkMemory(stateDir));

  // 4. Relatórios de benchmark persistidos (execuções passadas)
  checks.push(checkBenchmarkReports(stateDir));

  // 5. Skill frontmatter (contrato)
  const manifest = checkSkillManifest(baseDir);
  checks.push(manifest);
  const skills = manifest.skills;

  // 6. Security scan das skills (aliases de prompt-injection são esperados em
  // exemplos de skills de segurança — mesma allowlist que o diagnose já usava)
  checks.push(checkSkillSecurityScan(baseDir, ['INJ-001', 'INJ-002', 'INJ-003']));

  // 7. Agent genome
  const resolver = new SkillResolver({ baseDir });
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

  // 8. Benchmarks disponíveis (suíte embutida + custom do projeto)
  checks.push(checkBenchmarkSuite(baseDir));

  // 9. Contracts
  checks.push(checkArtifactContracts(skills));

  // 10. Skill lifecycle
  checks.push(checkSkillLifecycle(skills));

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
