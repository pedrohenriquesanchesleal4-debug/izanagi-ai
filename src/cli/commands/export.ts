import os from 'os';
import path from 'path';
import { exportAll, exportToClaude, exportToCodex, exportToCursor, exportToCopilot, exportToKimi, exportToOpencode } from '../../exporters.js';

const CLI_TARGETS = ['claude', 'codex', 'cursor', 'copilot', 'kimi', 'opencode', 'all'] as const;
type CliTarget = (typeof CLI_TARGETS)[number];

interface ExportArgs {
  target: CliTarget;
  targetDir: string;
  /**
   * Instalação de escopo PESSOAL: destino `~/`, de onde o Claude Code lê
   * `~/.claude/agents`, `~/.claude/commands` e `~/.claude/skills` em TODO
   * projeto que o usuário abrir.
   *
   * Existe porque agente e skill são descobertos por PROJETO: abrir a CLI em
   * outro diretório (ou num subdiretório) não encontra os 22 agentes nem a
   * biblioteca de skills, e a conclusão natural de quem vê isso é que o
   * framework não funciona. Com `--global`, funciona em qualquer lugar.
   */
  global: boolean;
}

function parseExportArgs(args: string[]): ExportArgs {
  let target: CliTarget = 'all';
  let targetDir = process.cwd();
  let global = false;
  let dirExplicit = false;

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
        dirExplicit = true;
        i++;
      }
    } else if (arg.startsWith('--dir=')) {
      targetDir = arg.slice(6);
      dirExplicit = true;
    } else if (arg === '--global' || arg === '-g') {
      global = true;
    } else if (arg === '--help' || arg === '-h') {
      showExportHelp();
      process.exit(0);
    } else {
      console.error(`\x1b[31mUnknown option:\x1b[0m ${arg}`);
      showExportHelp();
      process.exit(1);
    }
  }

  if (global && dirExplicit) {
    console.error('\x1b[31mError:\x1b[0m --global e --dir são destinos diferentes: escolha um.');
    process.exit(1);
  }

  // Escopo pessoal só está DEFINIDO para o Claude Code, a única CLI aqui cujo
  // diretório de configuração do usuário é lido em todo projeto. Fingir
  // suporte para as outras criaria arquivos que nada leria.
  if (global && target !== 'claude') {
    console.error('\x1b[31mError:\x1b[0m --global existe só para --cli claude (~/.claude/{agents,commands,skills}).');
    console.error('  As outras CLIs não definem diretório de configuração por usuário que valha em todo projeto.');
    process.exit(1);
  }

  if (global) targetDir = os.homedir();

  if (!CLI_TARGETS.includes(target)) {
    console.error(`\x1b[31mError:\x1b[0m unknown CLI target "${target}".\nValid targets: ${CLI_TARGETS.join(', ')}\n`);
    showExportHelp();
    process.exit(1);
  }

  return { target, targetDir: path.resolve(targetDir), global };
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
  \x1b[32m--global, -g\x1b[0m         Escopo pessoal: instala em ~/.claude/{agents,commands,skills}, e aí os 22
                       agentes e a biblioteca de skills valem em TODO projeto que você abrir.
                       Só para --cli claude, e nunca escreve ~/CLAUDE.md (esse arquivo é seu).

  \x1b[1mExamples:\x1b[0m
  izanagi export
  izanagi export --cli claude
  izanagi export --cli cursor --dir ./my-project
  izanagi export --cli claude --global
`);
}

export function exportCommand(args: string[]): void {
  const { target, targetDir, global: personalScope } = parseExportArgs(args);

  const exportFn =
    target === 'all'
      ? exportAll
      : target === 'claude'
        ? (dir: string) =>
            exportToClaude(dir, {
              rootDoc: !personalScope,
              // Escopo pessoal grava em `~/`, que não contém framework: a fonte
              // continua sendo o projeto/instalação de onde o comando foi chamado.
              ...(personalScope ? { sourceDir: process.cwd() } : {}),
            })
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
  console.log(`  \x1b[90mTarget directory:\x1b[0m ${targetDir}${personalScope ? ' \x1b[90m(escopo pessoal: vale em todo projeto)\x1b[0m' : ''}\n`);

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
