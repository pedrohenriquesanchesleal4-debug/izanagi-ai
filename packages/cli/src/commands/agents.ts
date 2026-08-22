/**
 * `izanagi-next agent list`: reads the legacy agents/*.json catalog and
 * prints name, role and declared chains per agent.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { isRecord, resolveRepoRoot } from "../../../sdk/src/index.ts";
import { EXIT_OK, type CommandContext } from "../context.js";
import { out, table, truncate } from "../console.js";

interface AgentSummary {
  readonly file: string;
  readonly name: string;
  readonly role: string;
  readonly chains: readonly string[];
}

async function listAgents(repoRoot: string): Promise<AgentSummary[]> {
  const agentsDirectory = path.join(repoRoot, "agents");
  let entries;
  try {
    entries = await readdir(agentsDirectory, { withFileTypes: true });
  } catch (cause) {
    throw new Error(`cannot read agents directory at ${agentsDirectory}: ${String(cause)}`);
  }

  const summaries: AgentSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(agentsDirectory, entry.name);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      process.stderr.write(`warn: skipping malformed agent file ${entry.name}\n`);
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    const chainsRaw = parsed["chains"];
    summaries.push({
      file: entry.name,
      name: typeof parsed["name"] === "string" ? parsed["name"] : entry.name,
      role: typeof parsed["role"] === "string" ? parsed["role"] : "",
      chains:
        typeof chainsRaw === "object" && chainsRaw !== null && !Array.isArray(chainsRaw)
          ? Object.keys(chainsRaw)
          : [],
    });
  }
  return summaries.sort((left, right) => left.name.localeCompare(right.name));
}

export async function agentListCommand(_context: CommandContext): Promise<number> {
  const repoRoot = resolveRepoRoot();
  const agents = await listAgents(repoRoot);
  if (agents.length === 0) {
    process.stderr.write(`no agent definitions found under ${path.join(repoRoot, "agents")}\n`);
    return EXIT_OK;
  }

  out(table(
    ["FILE", "NAME", "ROLE", "CHAINS"],
    agents.map((agent) => [
      agent.file,
      truncate(agent.name, 28),
      truncate(agent.role, 64),
      agent.chains.join(","),
    ]),
  ));
  out("");
  out(`${agents.length} agents`);
  return EXIT_OK;
}
