import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { doctorCommand } from './commands/doctor.js';
import { listCommand } from './commands/list.js';
import { initCommand } from './commands/init.js';
import { compileCommand } from './commands/compile.js';
import { runCommand } from './commands/run.js';
import { createCommand } from './commands/create.js';
import { chatCommand } from './commands/chat.js';
import { exportCommand } from './commands/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '../../');

function showVersion(): void {
  const pkg = JSON.parse(fs.readFileSync(path.join(baseDir, 'package.json'), 'utf-8'));
  console.log(`Izanagi AI CLI v${pkg.version}`);
}

export async function runCLI(args: string[]): Promise<void> {
  const raw = args[0] || 'help';
  const command = raw.toLowerCase();
  const rest = args.slice(1);

  switch (command) {
    case 'init':
      await initCommand(rest);
      break;

    case 'list':
    case 'skills':
    case 'agents': {
      const filter = rest[0] || (command === 'skills' ? 'skills' : command === 'agents' ? 'agents' : 'all');
      listCommand(baseDir, filter);
      break;
    }

    case 'run':
    case 'resolve':
      runCommand(baseDir, rest);
      break;

    case 'chat':
    case 'repl':
    case 'interactive':
      chatCommand(baseDir);
      break;

    case 'create':
      createCommand(baseDir, rest[0], rest[1]);
      break;

    case 'compile':
    case 'build':
      compileCommand(baseDir, rest[0], rest[1]);
      break;

    case 'doctor':
    case 'check':
    case 'validate':
      doctorCommand(baseDir);
      break;

    case 'export':
      exportCommand(rest);
      break;

    case 'version':
    case '-v':
    case '--version':
      showVersion();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.error(`\x1b[31mUnknown option:\x1b[0m ${raw}\n`);
      showHelp();
      break;
  }
}

function showHelp(): void {
  console.log(`
\x1b[1m\x1b[36mIzanagi AI CLI - Modular Skill & Agent Framework for Autonomous AI Coding\x1b[0m

\x1b[1mUsage:\x1b[0m
  izanagi <command> [options]

  \x1b[1mCommands:\x1b[0m
  \x1b[32minit [dir] [--packs a,b,c]\x1b[0m      Creates a project with selectable skill packs (.agents).
  \x1b[32mchat / repl\x1b[0m                   Launches interactive CLI shell (REPL mode).
  \x1b[32mrun [agent] --task "<task>"\x1b[0m     Classifies task, selects Agent and Skill Chain.
  \x1b[32mcreate <agent|skill> <name>\x1b[0m    Creates a new agent or skill scaffold.
  \x1b[32mcompile <agent> [file]\x1b[0m         Compiles ready-to-use prompt for an Agent (e.g. architect, security).
  \x1b[32mlist [skills|agents]\x1b[0m           Lists all registered skills and agents.
  \x1b[32mdoctor\x1b[0m                        Validates framework integrity, JSONs, and alias links.
  \x1b[32mexport --cli <target>\x1b[0m         Exports framework adapters for other AI CLIs
                          (claude, codex, cursor, copilot, kimi, all).
  \x1b[32mversion\x1b[0m                       Displays Izanagi AI version.

\x1b[1mOptions:\x1b[0m
  \x1b[32m--version, -v\x1b[0m                  Displays version.
  \x1b[32m--help, -h\x1b[0m                     Displays help.
  \x1b[32m--packs <ids>\x1b[0m                 Skip interactive selection: comma-separated pack ids
                          (core,agents,skills,architecture,coding,database,devops,security,testing,memory,optimization,teaching).

\x1b[1mExamples:\x1b[0m
  izanagi init my-project
  izanagi init my-project --packs core,agents,coding,database
  izanagi run "Refactor user authentication to JWT"
  izanagi run architect --task "Design a microservices architecture"
  izanagi run my-agent --task "Create a login page"
  izanagi create agent my-agent
  izanagi compile architect system_prompt.md
  izanagi list skills
  izanagi doctor
`);
}
