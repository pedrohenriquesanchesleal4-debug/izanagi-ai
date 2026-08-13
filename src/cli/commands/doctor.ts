import fs from 'fs';
import path from 'path';
import { checkMemory, checkTraces, checkBenchmarkSuite, checkSkillSecurityScan, checkSkillManifest } from '../checks.js';

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
    const deepErrors = runDeepChecks(baseDir);
    errors += deepErrors;
  }

  console.log(`\n\x1b[1mSummary:\x1b[0m ${errors === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'} (${errors} errors, ${warnings} warnings)\n`);
  return errors === 0;
}

function runDeepChecks(baseDir: string): number {
  let errors = 0;
  console.log('\n\x1b[1m\x1b[36m-- Deep checks (runtime) --\x1b[0m\n');

  const memory = checkMemory(baseDir);
  console.log(` \x1b[32m✔\x1b[0m Memory: ${memory.detail}`);

  const traces = checkTraces(baseDir, 10);
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

  return errors;
}
