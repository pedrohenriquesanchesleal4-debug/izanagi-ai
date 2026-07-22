import fs from 'fs';
import path from 'path';

export function doctorCommand(baseDir: string): boolean {
  console.log('\n\x1b[36m=== NexusAI Doctor & Integrity Check ===\x1b[0m\n');

  let errors = 0;
  let warnings = 0;

  // 1. Verify SYSTEM.md & RULES.md
  const systemPath = path.join(baseDir, 'SYSTEM.md');
  const rulesPath = path.join(baseDir, 'RULES.md');

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
  const agentsDir = path.join(baseDir, 'agents');
  if (!fs.existsSync(agentsDir)) {
    console.log(' \x1b[31m✖\x1b[0m agents directory missing!');
    errors++;
  } else {
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
    console.log(` \x1b[32m✔\x1b[0m Found ${agentFiles.length} agent JSON definitions`);
    for (const f of agentFiles) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
        if (!content.name || !content.skills) {
          console.log(`   \x1b[33m⚠\x1b[0m Agent ${f} missing required fields (name, skills)`);
          warnings++;
        }
      } catch (err) {
        console.log(`   \x1b[31m✖\x1b[0m Invalid JSON in agent file ${f}`);
        errors++;
      }
    }
  }

  // 3. Verify Skill Resolver
  const resolverPath = path.join(baseDir, 'core', 'skill-resolver.json');
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
        let fullPath = path.join(baseDir, relPath as string);
        if (!fullPath.endsWith('.md') && !fullPath.endsWith('.json')) {
          if (fs.existsSync(fullPath + '.md')) {
            fullPath += '.md';
          } else if (fs.existsSync(path.join(fullPath, 'SKILL.md'))) {
            fullPath = path.join(fullPath, 'SKILL.md');
          }
        }

        if (fs.existsSync(fullPath)) {
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

  console.log(`\n\x1b[1mSummary:\x1b[0m ${errors === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'} (${errors} errors, ${warnings} warnings)\n`);
  return errors === 0;
}
