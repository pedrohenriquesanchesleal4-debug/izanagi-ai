/**
 * Environment and filesystem resolution shared by every client:
 * repo-root discovery, native-binary lookup and well-known paths.
 */

import { access, constants } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { BinaryNotFoundError } from "./errors.js";

export interface RepoRootOptions {
  /** Explicit root; wins over env and auto-detection. */
  readonly repoRoot?: string;
}

/**
 * Walks up from `from` (default cwd) until a directory containing both
 * `package.json` and `crates/` is found — the polyglot workspace root.
 * Env `IZANAGI_REPO_ROOT` short-circuits the search.
 */
export function resolveRepoRoot(from?: string): string {
  const envRoot = process.env["IZANAGI_REPO_ROOT"];
  if (envRoot !== undefined && envRoot !== "") {
    return path.resolve(envRoot);
  }
  let current = path.resolve(from ?? process.cwd());
  for (;;) {
    if (existsSync(path.join(current, "package.json")) && existsSync(path.join(current, "crates"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(from ?? process.cwd());
    }
    current = parent;
  }
}

async function isExecutable(candidate: string): Promise<boolean> {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export interface BinaryResolution {
  readonly binaryName: string;
  readonly envVar: string;
  /** Candidates probed when no env var is set. */
  readonly searchCandidates: readonly string[];
}

/**
 * Resolves a native binary: explicit option > env var > debug/release build
 * outputs under the repo root. Throws `BinaryNotFoundError` with the full
 * probe list when nothing usable exists.
 */
export async function resolveBinary(
  resolution: BinaryResolution,
  explicitPath?: string,
): Promise<string> {
  if (explicitPath !== undefined && explicitPath !== "") {
    if (await isExecutable(explicitPath)) {
      return explicitPath;
    }
    throw new BinaryNotFoundError(resolution.binaryName, [explicitPath], resolution.envVar);
  }

  const envValue = process.env[resolution.envVar];
  if (envValue !== undefined && envValue !== "") {
    const resolved = path.resolve(envValue);
    if (await isExecutable(resolved)) {
      return resolved;
    }
    throw new BinaryNotFoundError(resolution.binaryName, [resolved], resolution.envVar);
  }

  for (const candidate of resolution.searchCandidates) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  throw new BinaryNotFoundError(resolution.binaryName, resolution.searchCandidates, resolution.envVar);
}

const CORE_BINARY_NAME = process.platform === "win32" ? "izanagi-core.exe" : "izanagi-core";
const MCP_BINARY_NAME = process.platform === "win32" ? "izanagi-mcp.exe" : "izanagi-mcp";

function cargoTargetCandidates(repoRoot: string, binaryName: string): string[] {
  const roots = [path.join(repoRoot, "target"), path.join(repoRoot, "crates", "target")];
  const profiles = ["debug", "release"];
  const candidates: string[] = [];
  for (const root of roots) {
    for (const profile of profiles) {
      candidates.push(path.join(root, profile, binaryName));
    }
  }
  return candidates;
}

/** Resolves the `izanagi-core` quality-gate binary. */
export function resolveCoreBinary(explicitPath?: string, repoRoot?: string): Promise<string> {
  const root = resolveRepoRoot(repoRoot);
  return resolveBinary(
    {
      binaryName: CORE_BINARY_NAME,
      envVar: "IZANAGI_CORE_BIN",
      searchCandidates: cargoTargetCandidates(root, CORE_BINARY_NAME),
    },
    explicitPath,
  );
}

/** Resolves the `izanagi-mcp` harness binary. */
export function resolveMcpBinary(explicitPath?: string, repoRoot?: string): Promise<string> {
  const root = resolveRepoRoot(repoRoot);
  return resolveBinary(
    {
      binaryName: MCP_BINARY_NAME,
      envVar: "IZANAGI_MCP_BIN",
      searchCandidates: cargoTargetCandidates(root, MCP_BINARY_NAME),
    },
    explicitPath,
  );
}

export const DEFAULT_ORCHESTRATOR_SOCKET = "/tmp/izanagi-swarm.sock";

/** Socket path precedence: explicit option > env > well-known default. */
export function resolveOrchestratorSocket(explicitPath?: string): string {
  return explicitPath ?? process.env["IZANAGI_ORCHESTRATOR_SOCKET"] ?? DEFAULT_ORCHESTRATOR_SOCKET;
}
