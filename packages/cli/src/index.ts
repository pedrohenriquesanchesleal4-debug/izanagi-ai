#!/usr/bin/env node
/**
 * izanagi-next: next-generation Izanagi CLI over the polyglot cores.
 *
 * Exit codes:
 *   0 - success
 *   1 - operational failure (quality gate refused, task failed, ...)
 *   2 - usage error (unknown command, missing required flag)
 *   3 - environment error (missing binary, unreachable socket)
 */

import { composePipeline } from "../../sdk/src/index.ts";
import {
  EXIT_ENVIRONMENT,
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
  type CommandContext,
  type GlobalOptions,
  UsageError,
} from "./context.js";
import { runCommand } from "./commands/run.js";
import { agentListCommand } from "./commands/agents.js";
import { skillListCommand } from "./commands/skills.js";
import { gatesCheckCommand } from "./commands/gates.js";

export { UsageError };

const USAGE_TEXT = `izanagi-next - polyglot Izanagi CLI

Usage:
  izanagi-next run --agent=<name> --task="<text>" [options]
      [--skills=a,b] [--files=f1,f2] [--max-heal-attempts=2]
      [--standalone] [--timeout-ms=120000] [--json]
  izanagi-next agent list
  izanagi-next skill list [--category=x] [--search=termo] [--json]
  izanagi-next gates check <file>

Environment:
  IZANAGI_CORE_BIN             quality-gate binary (auto-searched under target/)
  IZANAGI_MCP_BIN              MCP harness binary (auto-searched under target/)
  IZANAGI_ORCHESTRATOR_SOCKET  Unix socket path (default /tmp/izanagi-swarm.sock)
  IZANAGI_PYTHON               interpreter override (default python3 / bundled venv)
  IZANAGI_MCP_SERVER_CMD       space-separated MCP server command for run's MCP path
`;

interface ParsedArgs {
  readonly positionals: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let index = 0;
  while (index < argv.length) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--")) {
      positionals.push(token);
      index += 1;
      continue;
    }
    const body = token.slice(2);
    const equalsIndex = body.indexOf("=");
    if (equalsIndex >= 0) {
      flags[body.slice(0, equalsIndex)] = body.slice(equalsIndex + 1);
      index += 1;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[body] = next;
      index += 2;
    } else {
      flags[body] = true;
      index += 1;
    }
  }
  return { positionals, flags };
}

function flagString(flags: Readonly<Record<string, string | boolean>>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function requireFlag(flags: Readonly<Record<string, string | boolean>>, key: string): string {
  const value = flagString(flags, key);
  if (value === undefined || value === "") {
    throw new UsageError(`missing required flag --${key}=<value>`);
  }
  return value;
}

async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  const [command, subcommand] = parsed.positionals;

  if (command === undefined || command === "help" || parsed.flags["help"] === true) {
    process.stdout.write(USAGE_TEXT);
    return command === undefined ? EXIT_USAGE : EXIT_OK;
  }

  const options: GlobalOptions = { json: parsed.flags["json"] === true };
  const pipeline = composePipeline();
  const context: CommandContext = { pipeline, options };

  try {
    switch (command) {
      case "run": {
        if (subcommand !== undefined) {
          throw new UsageError("usage: izanagi-next run --agent=<name> --task=\"<text>\"");
        }
        return await runCommand(context, {
          agent: requireFlag(parsed.flags, "agent"),
          task: requireFlag(parsed.flags, "task"),
          skills: flagString(parsed.flags, "skills"),
          files:
            flagString(parsed.flags, "files")
              ?.split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0) ?? [],
          maxHealAttempts: Number(flagString(parsed.flags, "max-heal-attempts") ?? "2"),
          standalone: parsed.flags["standalone"] === true,
          timeoutMs: Number(flagString(parsed.flags, "timeout-ms") ?? "120000"),
        });
      }
      case "agent": {
        if (subcommand !== "list") {
          throw new UsageError("usage: izanagi-next agent list");
        }
        return await agentListCommand(context);
      }
      case "skill": {
        if (subcommand !== "list") {
          throw new UsageError("usage: izanagi-next skill list [--category=x] [--search=termo]");
        }
        return await skillListCommand(context, {
          category: flagString(parsed.flags, "category"),
          search: flagString(parsed.flags, "search"),
        });
      }
      case "gates": {
        if (subcommand !== "check") {
          throw new UsageError("usage: izanagi-next gates check <file>");
        }
        const file = parsed.positionals[2];
        if (file === undefined) {
          throw new UsageError("usage: izanagi-next gates check <file>");
        }
        return await gatesCheckCommand(context, { file });
      }
      default:
        throw new UsageError(`unknown command "${command}"`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`usage error: ${error.message}\n`);
      return EXIT_USAGE;
    }
    if (error instanceof Error && error.name === "BinaryNotFoundError") {
      process.stderr.write(`environment error: ${error.message}\n`);
      return EXIT_ENVIRONMENT;
    }
    process.stderr.write(
      `error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return EXIT_FAILURE;
  } finally {
    await pipeline.close();
  }
}

const argv = process.argv.slice(2);
main(argv).then(
  (code) => {
    process.exitCode = code;
  },
  (unhandled) => {
    process.stderr.write(`fatal: ${String(unhandled)}\n`);
    process.exitCode = EXIT_FAILURE;
  },
);
