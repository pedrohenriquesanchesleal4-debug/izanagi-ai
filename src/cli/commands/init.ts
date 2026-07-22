import fs from 'fs';
import path from 'path';
import { installToProject } from '../../installer.js';

export function initCommand(baseDir: string, targetDir: string = process.cwd()): void {
  console.log(`\n\x1b[36m=== Initializing NexusAI (.agents) in: ${targetDir} ===\x1b[0m\n`);

  // Sincronizar/Copiar arquivos para .agents
  installToProject(targetDir);

  const nexusFolder = path.join(targetDir, '.nexus');
  if (!fs.existsSync(nexusFolder)) {
    fs.mkdirSync(nexusFolder, { recursive: true });
  }

  // Write nexus.config.json
  const config = {
    framework: "NexusAI",
    version: "1.0.0",
    defaultAgent: "senior-engineer",
    skillsDir: ".agents/skills",
    autoCompression: true,
    qualityGates: true
  };

  fs.writeFileSync(path.join(nexusFolder, 'nexus.config.json'), JSON.stringify(config, null, 2));
  console.log(' \x1b[32m✔\x1b[0m Created .nexus/nexus.config.json');

  console.log('\n\x1b[32mNexusAI successfully initialized in this project!\x1b[0m');
  console.log('You can now run \x1b[1mnexus run "your task"\x1b[0m or \x1b[1mnexus compile <agent>\x1b[0m.\n');
}
