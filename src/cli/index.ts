import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { doctorCommand } from './commands/doctor.js';
import { listCommand } from './commands/list.js';
import { initCommand } from './commands/init.js';
import { compileCommand } from './commands/compile.js';
import { runCommand } from './commands/run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '../../');

export async function runCLI(args: string[]): Promise<void> {
  const command = args[0] || 'help';

  switch (command.toLowerCase()) {
    case 'init':
      initCommand(baseDir, args[1]);
      break;

    case 'list':
    case 'skills':
    case 'agents':
      listCommand(baseDir, args[1] || (command === 'skills' ? 'skills' : command === 'agents' ? 'agents' : 'all'));
      break;

    case 'run':
    case 'resolve':
      runCommand(baseDir, args.slice(1).join(' '));
      break;

    case 'compile':
    case 'build':
      compileCommand(baseDir, args[1], args[2]);
      break;

    case 'doctor':
    case 'check':
    case 'validate':
      doctorCommand(baseDir);
      break;

    case 'version':
    case '-v':
    case '--version':
      const pkg = JSON.parse(fs.readFileSync(path.join(baseDir, 'package.json'), 'utf-8'));
      console.log(`NexusAI CLI v${pkg.version}`);
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      showHelp();
      break;
  }
}

function showHelp(): void {
  console.log(`
\x1b[1m\x1b[36mNexusAI CLI - Modular Skill & Agent Framework for Autonomous AI Coding\x1b[0m

\x1b[1mUsage:\x1b[0m
  nexus <command> [options]

\x1b[1mCommands:\x1b[0m
  \x1b[32mrun "<task>"\x1b[0m           Analyzes task, selects optimal Agent and Skill Chain.
  \x1b[32mcompile <agent> [file]\x1b[0m  Compiles ready-to-use prompt for an Agent (e.g. architect, security).
  \x1b[32minit [dir]\x1b[0m             Initializes NexusAI rules & assets (.agents) in target directory.
  \x1b[32mlist [skills|agents]\x1b[0m    Lists all registered skills and agents.
  \x1b[32mdoctor\x1b[0m                 Validates framework integrity, JSONs, and alias links.
  \x1b[32mversion\x1b[0m                Displays NexusAI version.

\x1b[1mExamples:\x1b[0m
  nexus run "Refactor user authentication to JWT"
  nexus compile architect system_prompt.md
  nexus list skills
  nexus doctor
`);
}
