import fs from 'fs';
import path from 'path';
import { checkMemory, checkTraces, checkBenchmarkSuite, checkSkillSecurityScan, checkSkillManifest, checkSkillLifecycle, checkNestedDuplicate } from '../checks.js';

/**
 * Decide a raiz do framework para auditoria.
 *
 * Instalação completa = `.agents/agents/` contendo definições de agente em JSON
 * (formato distribuído). A presença isolada de `.agents/memoria/` não conta — é
 * memória local gitignored e um repo raiz-based cairia por engano no modo
 * "projeto instalado".
 *
 * Topologia v2 (ADR-005): o repo-fonte mantém `.agents/agents/*.yaml` DERIVADOS
 * (nunca .json) apenas como interface de leitura; nesse caso a raiz segue sendo
 * `baseDir` (o pacote instalado), senão o doctor procuraria SYSTEM.md/RULES.md
 * dentro de `.agents/` e falharia.
 */
export function resolveProjectRoot(cwd: string, baseDir: string): string {
  const agentsDotDir = path.join(cwd, '.agents', 'agents');
  if (!fs.existsSync(agentsDotDir)) return baseDir;
  const hasJsonAgents = fs.readdirSync(agentsDotDir).some((f: string) => f.endsWith('.json'));
  return hasJsonAgents ? path.join(cwd, '.agents') : baseDir;
}

/**
 * @param baseDir  Raiz dos ASSETS do framework (agentes, skills, casos de benchmark).
 * @param stateDir Raiz do ESTADO deste projeto (memória, traces, relatórios).
 *                 Default: `baseDir`. Ver `resolveStateRoot` no installer.
 */
export function doctorCommand(baseDir: string, args: string[] = [], stateDir = baseDir): boolean {
  const deep = args.includes('--deep') || args.includes('-d');

  console.log('\n\x1b[36m=== Izanagi AI Doctor & Integrity Check ===\x1b[0m\n');

  const cwd = process.cwd();

  const projectRoot = resolveProjectRoot(cwd, baseDir);

  let errors = 0;
  let warnings = 0;

  // 0. Verify there's no `<nome>/<nome>` nested duplicate (root cause of "agents/skills não aparecem").
  const nestedDuplicate = checkNestedDuplicate(cwd);
  if (nestedDuplicate) {
    console.log(` \x1b[33m⚠\x1b[0m ${nestedDuplicate.name}: ${nestedDuplicate.detail}`);
    warnings++;
  }

  // 1. Verify SYSTEM.md & RULES.md
  const systemPath = path.join(projectRoot, 'SYSTEM.md');
  const rulesPath = path.join(projectRoot, 'RULES.md');

  if (fs.existsSync(systemPath)) {
    console.log(' \x1b[32m✔\x1b[0m SYSTEM.md found');
  } else {
    console.log(' \x1b[31m✖\x1b[0m SYSTEM.md missing!');
    errors++;
  }

  if (fs.existsSync(rulesPath)) {
    console.log(' \x1b[32m✔\x1b[0m RULES.md found');
  } else {
    console.log(' \x1b[31m✖\x1b[0m RULES.md missing!');
    errors++;
  }

  // 2. Verify Agents
  const agentsDirs = [
    path.join(cwd, '.agents', 'agents'),
    path.join(cwd, 'agents'),
    path.join(baseDir, 'agents')
  ];

  const seen = new Set<string>();
  let agentCount = 0;

  for (const agentsDir of agentsDirs) {
    if (!fs.existsSync(agentsDir)) continue;
    const agentFiles = fs.readdirSync(agentsDir).filter((f: string) => f.endsWith('.json'));
    for (const f of agentFiles) {
      if (seen.has(f)) continue;
      seen.add(f);
      agentCount++;
      try {
        const content = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
        if (!content.name || !content.skills) {
          console.log(`   \x1b[33m⚠\x1b[0m Agent ${f} missing required fields (name, skills)`);
          warnings++;
        }
      } catch {
        console.log(`   \x1b[31m✖\x1b[0m Invalid JSON in agent file ${f}`);
        errors++;
      }
    }
  }

  if (agentCount > 0) {
    console.log(` \x1b[32m✔\x1b[0m Found ${agentCount} agent JSON definitions`);
  } else {
    console.log(' \x1b[31m✖\x1b[0m agents directory missing!');
    errors++;
  }

  // 3. Verify Skill Resolver
  const resolverPath = path.join(projectRoot, 'core', 'skill-resolver.json');
  if (!fs.existsSync(resolverPath)) {
    console.log(' \x1b[31m✖\x1b[0m skill-resolver.json missing!');
    errors++;
  } else {
    try {
      const resolverData = JSON.parse(fs.readFileSync(resolverPath, 'utf-8'));
      const aliases = resolverData.aliases || {};
      let resolvedCount = 0;
      let unresolvedCount = 0;

      for (const [alias, relPath] of Object.entries(aliases)) {
        const roots = [projectRoot, baseDir];
        let found = false;

        for (const root of roots) {
          const fullPath = path.join(root, relPath as string);
          if (
            fs.existsSync(fullPath) ||
            fs.existsSync(fullPath + '.md') ||
            fs.existsSync(path.join(fullPath, 'SKILL.md'))
          ) {
            found = true;
            break;
          }
        }

        if (found) {
          resolvedCount++;
        } else {
          console.log(`   \x1b[33m⚠\x1b[0m Alias "${alias}" points to non-existent target: ${relPath}`);
          unresolvedCount++;
          warnings++;
        }
      }

      console.log(` \x1b[32m✔\x1b[0m Skill Resolver: ${resolvedCount} aliases valid, ${unresolvedCount} unmapped.`);
    } catch (err: any) {
      console.log(` \x1b[31m✖\x1b[0m Invalid JSON in skill-resolver.json: ${err.message}`);
      errors++;
    }
  }

  if (deep) {
    const deepErrors = runDeepChecks(baseDir, stateDir);
    errors += deepErrors;
  }

  console.log(`\n\x1b[1mSummary:\x1b[0m ${errors === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'} (${errors} errors, ${warnings} warnings)\n`);
  return errors === 0;
}

function runDeepChecks(baseDir: string, stateDir: string): number {
  let errors = 0;
  console.log('\n\x1b[1m\x1b[36m-- Deep checks (runtime) --\x1b[0m\n');

  const memory = checkMemory(stateDir);
  console.log(` \x1b[32m✔\x1b[0m Memory: ${memory.detail}`);

  const traces = checkTraces(stateDir, 10);
  console.log(` \x1b[32m✔\x1b[0m Traces: ${traces.detail}`);

  const benchmarks = checkBenchmarkSuite(baseDir);
  console.log(` \x1b[32m✔\x1b[0m Benchmarks: ${benchmarks.detail}`);

  const scan = checkSkillSecurityScan(baseDir);
  if (!scan.ok) {
    console.log(` \x1b[31m✖\x1b[0m Skill scan: ${scan.detail}`);
    const offenders = scan.results.filter((s) => s.level === 'CRITICAL' || s.level === 'HIGH').slice(0, 3);
    for (const s of offenders) {
      console.log(`   \x1b[31m- ${s.skill}: ${s.level}\x1b[0m`);
    }
    errors++;
  } else {
    console.log(` \x1b[32m✔\x1b[0m Skill security scan: ${scan.detail}`);
  }

  const manifest = checkSkillManifest(baseDir);
  if (!manifest.ok) {
    console.log(` \x1b[33m⚠\x1b[0m Skill manifest: ${manifest.detail}`);
  } else {
    console.log(` \x1b[32m✔\x1b[0m Skill manifest: ${manifest.detail}`);
  }

  const lifecycle = checkSkillLifecycle(manifest.skills);
  console.log(` \x1b[32m✔\x1b[0m Skill lifecycle: ${lifecycle.detail}`);

  return errors;
}
