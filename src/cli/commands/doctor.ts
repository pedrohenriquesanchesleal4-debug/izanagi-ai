import fs from 'fs';
import path from 'path';
import { loadSkillResolver } from '../framework.js';
import { SkillScanner } from '../../runtime/security/skill-scanner.js';
import { MemoryStore } from '../../runtime/memory/store.js';
import { TraceStore } from '../../runtime/observability/tracer.js';
import { BenchmarkRegistry } from '../../runtime/benchmarks/registry.js';
import { SkillResolver } from '../../runtime/routing/resolver.js';

export function doctorCommand(baseDir: string, args: string[] = []): boolean {
  const deep = args.includes('--deep') || args.includes('-d');

  console.log('\n\x1b[36m=== Izanagi AI Doctor & Integrity Check ===\x1b[0m\n');

  const cwd = process.cwd();

  // Raiz do framework: .agents do projeto (se existir) ou pacote instalado
  const projectRoot = fs.existsSync(path.join(cwd, '.agents')) ? path.join(cwd, '.agents') : baseDir;

  let errors = 0;
  let warnings = 0;

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
    const deepErrors = runDeepChecks(baseDir, projectRoot);
    errors += deepErrors;
  }

  console.log(`\n\x1b[1mSummary:\x1b[0m ${errors === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'} (${errors} errors, ${warnings} warnings)\n`);
  return errors === 0;
}

function runDeepChecks(baseDir: string, projectRoot: string): number {
  let errors = 0;
  console.log('\n\x1b[1m\x1b[36m-- Deep checks (runtime) --\x1b[0m\n');

  // 7. Runtime state + memory
  const memory = new MemoryStore({ baseDir });
  const state = memory.raw;
  console.log(` \x1b[32m✔\x1b[0m Memory: ${Object.keys(state.failures).length} failure patterns, ${state.learnings.length} learnings, ${Object.keys(state.agents).length} agent stats`);

  // 8. Traces
  const traceStore = new TraceStore({ baseDir });
  const traces = traceStore.list(10);
  console.log(` \x1b[32m✔\x1b[0m Traces: ${traces.length} execução(ões) registrada(s)`);

  // 9. Benchmarks
  const registry = new BenchmarkRegistry();
  const cases = registry.load(baseDir);
  console.log(` \x1b[32m✔\x1b[0m Benchmarks: ${cases.length} casos (${new Set(cases.map((c) => c.domain)).size} domínios)`);

  // 10. Skill security scan
  const scanner = new SkillScanner();
  const scan = scanner.scanDirectory(baseDir);
  const critical = scan.filter((s) => s.level === 'CRITICAL');
  const high = scan.filter((s) => s.level === 'HIGH');
  if (critical.length > 0 || high.length > 0) {
    console.log(` \x1b[31m✖\x1b[0m Skill scan: ${critical.length} CRITICAL, ${high.length} HIGH (${scan.length} varridas)`);
    for (const s of [...critical, ...high].slice(0, 3)) {
      console.log(`   \x1b[31m- ${s.skill}: ${s.level}\x1b[0m`);
    }
    errors++;
  } else {
    console.log(` \x1b[32m✔\x1b[0m Skill security scan: ${scan.length} skills varridas, nenhuma CRITICAL/HIGH`);
  }

  // 11. Contracts (frontmatter das skills)
  const resolver = new SkillResolver({ baseDir });
  const skills = resolver.list();
  const noMeta = skills.filter((s) => !s.description && s.version === '1.0.0').length;
  if (noMeta > 0) {
    console.log(` \x1b[33m⚠\x1b[0m ${noMeta} skill(s) sem frontmatter de manifesto completo`);
  } else {
    console.log(` \x1b[32m✔\x1b[0m Skill manifests: ${skills.length} skills com metadados`);
  }

  return errors;
}
