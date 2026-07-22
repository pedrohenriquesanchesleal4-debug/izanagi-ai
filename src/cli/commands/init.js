import fs from 'fs';
import path from 'path';

export function initCommand(baseDir, targetDir = process.cwd()) {
  console.log(`\n\x1b[36m=== Initializing NexusAI in: ${targetDir} ===\x1b[0m\n`);

  const nexusFolder = path.join(targetDir, '.nexus');
  if (!fs.existsSync(nexusFolder)) {
    fs.mkdirSync(nexusFolder, { recursive: true });
  }

  // Copy SYSTEM.md and RULES.md
  const systemSrc = path.join(baseDir, 'SYSTEM.md');
  const rulesSrc = path.join(baseDir, 'RULES.md');

  if (fs.existsSync(systemSrc)) {
    fs.copyFileSync(systemSrc, path.join(nexusFolder, 'SYSTEM.md'));
    console.log(' \x1b[32m✔\x1b[0m Copied SYSTEM.md -> .nexus/SYSTEM.md');
  }

  if (fs.existsSync(rulesSrc)) {
    fs.copyFileSync(rulesSrc, path.join(nexusFolder, 'RULES.md'));
    console.log(' \x1b[32m✔\x1b[0m Copied RULES.md  -> .nexus/RULES.md');
  }

  // Write nexus.config.json
  const config = {
    framework: "NexusAI",
    version: "1.0.0",
    defaultAgent: "senior-engineer",
    skillsDir: ".nexus/skills",
    autoCompression: true,
    qualityGates: true
  };

  fs.writeFileSync(path.join(nexusFolder, 'nexus.config.json'), JSON.stringify(config, null, 2));
  console.log(' \x1b[32m✔\x1b[0m Created .nexus/nexus.config.json');

  console.log('\n\x1b[32mNexusAI successfully initialized in this project!\x1b[0m');
  console.log('You can now run \x1b[1mnexus run "your task"\x1b[0m or \x1b[1mnexus compile <agent>\x1b[0m.\n');
}
