import path from 'path';
import { exportAll, exportToClaude, exportToCodex, exportToCursor, exportToCopilot, exportToKimi, exportToOpencode } from '../../exporters.js';

const CLI_TARGETS = ['claude', 'codex', 'cursor', 'copilot', 'kimi', 'opencode', 'all'] as const;
type CliTarget = (typeof CLI_TARGETS)[number];

interface ExportArgs {
  target: CliTarget;
  targetDir: string;
}

function parseExportArgs(args: string[]): ExportArgs {
  let target: CliTarget = 'all';
  let targetDir = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--cli' || arg === '-c') {
      const value = args[i + 1];
      if (value) {
        target = value.toLowerCase() as CliTarget;
        i++;
      }
    } else if (arg.startsWith('--cli=')) {
      target = arg.slice(6).toLowerCase() as CliTarget;
    } else if (arg === '--dir' || arg === '-d') {
      const value = args[i + 1];
      if (value) {
        targetDir = value;
        i++;
      }
    } else if (arg.startsWith('--dir=')) {
      targetDir = arg.slice(6);
    } else if (arg === '--help' || arg === '-h') {
      showExportHelp();
      process.exit(0);
    } else {
      console.error(`\x1b[31mUnknown option:\x1b[0m ${arg}`);
      showExportHelp();
      process.exit(1);
    }
  }

  if (!CLI_TARGETS.includes(target)) {
    console.error(`\x1b[31mError:\x1b[0m unknown CLI target "${target}".\nValid targets: ${CLI_TARGETS.join(', ')}\n`);
    showExportHelp();
    process.exit(1);
  }

  return { target, targetDir: path.resolve(targetDir) };
}

function showExportHelp(): void {
  console.log(`
\x1b[1mUsage:\x1b[0m izanagi export [--cli <target>] [--dir <path>]

  \x1b[1mTargets:\x1b[0m
  \x1b[32mclaude\x1b[0m    Generates CLAUDE.md + .claude/agents + .claude/commands (22 agents) + .claude/skills (full 103-skill library, name+description always-loaded, body read on demand).
  \x1b[32mcodex\x1b[0m     Generates .codex/instructions.md + .codex/agents (22 agents).
  \x1b[32mcursor\x1b[0m    Generates .cursor/rules (core, agents, memory) in .mdc format.
  \x1b[32mcopilot\x1b[0m   Generates .github/copilot-instructions.md.
  \x1b[32mkimi\x1b[0m      Generates .kimi/README.md + kimi.md (Kimi CLI lê AGENTS.md/.opencode).
  \x1b[32mopencode\x1b[0m  Generates .opencode/agent/*.md (22 agents + orchestrator) — same convention Kimi CLI reads.
  \x1b[32mall\x1b[0m       Generates every adapter above (default).

  \x1b[1mOptions:\x1b[0m
  \x1b[32m--cli, -c <target>\x1b[0m   Target CLI (default: all).
  \x1b[32m--dir, -d <path>\x1b[0m     Target directory (default: current directory).

  \x1b[1mExamples:\x1b[0m
  izanagi export
  izanagi export --cli claude
  izanagi export --cli cursor --dir ./my-project
`);
}

export function exportCommand(args: string[]): void {
  const { target, targetDir } = parseExportArgs(args);

  const exportFn =
    target === 'all'
      ? exportAll
      : target === 'claude'
        ? exportToClaude
        : target === 'codex'
          ? exportToCodex
          : target === 'cursor'
            ? exportToCursor
            : target === 'copilot'
              ? exportToCopilot
              : target === 'opencode'
                ? exportToOpencode
                : exportToKimi;

  console.log(`\n\x1b[36m=== Exporting Izanagi AI adapters for ${target} ===\x1b[0m`);
  console.log(`  \x1b[90mTarget directory:\x1b[0m ${targetDir}\n`);

  let created: string[];
  try {
    created = exportFn(targetDir);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[31m✖\x1b[0m Export failed: ${message}`);
    process.exit(1);
  }

  if (created.length === 0) {
    console.log('  \x1b[33m•\x1b[0m Nothing to do — all adapter files already exist (files are never overwritten).\n');
    return;
  }

  for (const file of created) {
    console.log(`  \x1b[32m✔\x1b[0m ${file}`);
  }
  console.log(`\n\x1b[32m[Izanagi AI] Export complete: ${created.length} file(s) created in ${targetDir}.\x1b[0m\n`);
}
