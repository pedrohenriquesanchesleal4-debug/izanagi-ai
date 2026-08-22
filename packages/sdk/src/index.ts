/**
 * Public surface of @izanagi/sdk plus the `composePipeline` factory that
 * wires the four polyglot clients into one handle.
 */

export * from "./contracts.js";
export * from "./errors.js";
export {
  DEFAULT_ORCHESTRATOR_SOCKET,
  resolveCoreBinary,
  resolveMcpBinary,
  resolveOrchestratorSocket,
  resolveRepoRoot,
} from "./environment.js";
export { McpClient, type McpClientOptions } from "./mcp-client.js";
export {
  OrchestratorClient,
  type EventListener,
  type OrchestratorClientOptions,
  type TerminalWaitResult,
} from "./orchestrator.js";
export {
  SemanticAnalyzer,
  AnalyzerFailedError,
  AnalyzerProcessError,
  type AnalyzeRequest,
  type SemanticOptions,
} from "./semantic.js";
export {
  loadSkillCatalog,
  splitFrontMatter,
  parseSkillDocument,
  type SkillCatalog,
  type SkillCatalogOptions,
} from "./skills.js";
export { RustCoreClient, type RustCoreOptions, type ValidateInput } from "./rust-core.js";

import { McpClient } from "./mcp-client.js";
import { OrchestratorClient } from "./orchestrator.js";
import { RustCoreClient } from "./rust-core.js";
import { SemanticAnalyzer } from "./semantic.js";
import { loadSkillCatalog, type SkillCatalog, type SkillCatalogOptions } from "./skills.js";

/** Full configuration accepted by `composePipeline`; every field optional. */
export interface PipelineConfig {
  /** Workspace root for every auto-discovery probe. */
  readonly repoRoot?: string;
  /** Shared default deadline applied to clients without an explicit one. */
  readonly requestTimeoutMs?: number;
  /** Quality-gate client overrides (binary path, timeout). */
  readonly gate?: {
    readonly binaryPath?: string;
    readonly requestTimeoutMs?: number;
  };
  /** MCP overrides; requires a server command to become non-null. */
  readonly mcp?: {
    readonly serverCommand?: readonly string[];
    readonly binaryPath?: string;
    readonly requestTimeoutMs?: number;
    /** Set to false to skip MCP wiring entirely. */
    readonly enabled?: boolean;
  };
  /** Orchestrator overrides (socket path, reconnect budget). */
  readonly orchestrator?: {
    readonly socketPath?: string;
    readonly requestTimeoutMs?: number;
    readonly reconnectAttempts?: number;
    readonly reconnectDelayMs?: number;
  };
  /** Analyzer overrides (interpreter, engine directory). */
  readonly semantic?: {
    readonly pythonBin?: string;
    readonly engineRoot?: string;
    readonly requestTimeoutMs?: number;
  };
  /** Catalog options forwarded to `loadSkillCatalog`. */
  readonly skillCatalog?: SkillCatalogOptions;
}

/** One composed handle over every polyglot core. */
export interface IzanagiPipeline {
  /** Rust quality-gate client (validate / rules / version). */
  readonly gate: RustCoreClient;
  /** Native + harness MCP client; null when unconfigured. */
  readonly mcp: McpClient | null;
  /** Go swarm-orchestrator client over its Unix socket. */
  readonly orchestrator: OrchestratorClient;
  /** Python AST analyzer client. */
  readonly semantic: SemanticAnalyzer;
  /** Loads the skill catalog (v2 directory with legacy fallback). */
  skills(): Promise<SkillCatalog>;
  /** Terminates long-lived sessions (MCP child, orchestrator socket). */
  close(): Promise<void>;
}

/**
 * Builds a pipeline bound to explicit paths or environment defaults:
 * IZANAGI_CORE_BIN / IZANAGI_MCP_BIN / IZANAGI_ORCHESTRATOR_SOCKET /
 * IZANAGI_PYTHON. Clients are lazy — binaries are resolved at first use.
 */
export function composePipeline(config: PipelineConfig = {}): IzanagiPipeline {
  const sharedTimeout = config.requestTimeoutMs;

  const mcpServerCommand =
    config.mcp?.serverCommand ?? process.env["IZANAGI_MCP_SERVER_CMD"]?.split(" ");
  const mcpDisabled = config.mcp?.enabled === false;

  const mcp =
    mcpDisabled || mcpServerCommand === undefined
      ? null
      : new McpClient({
          serverCommand: mcpServerCommand,
          ...(config.mcp?.binaryPath !== undefined ? { binaryPath: config.mcp.binaryPath } : {}),
          ...(config.repoRoot !== undefined ? { repoRoot: config.repoRoot } : {}),
          ...(config.mcp?.requestTimeoutMs !== undefined || sharedTimeout !== undefined
            ? { requestTimeoutMs: config.mcp?.requestTimeoutMs ?? sharedTimeout }
            : {}),
        });

  const gate = new RustCoreClient({
    ...(config.gate?.binaryPath !== undefined ? { binaryPath: config.gate.binaryPath } : {}),
    ...(config.repoRoot !== undefined ? { repoRoot: config.repoRoot } : {}),
    ...(config.gate?.requestTimeoutMs !== undefined || sharedTimeout !== undefined
      ? { requestTimeoutMs: config.gate?.requestTimeoutMs ?? sharedTimeout }
      : {}),
  });

  const orchestrator = new OrchestratorClient({
    ...(config.orchestrator?.socketPath !== undefined
      ? { socketPath: config.orchestrator.socketPath }
      : {}),
    ...(config.orchestrator?.requestTimeoutMs !== undefined || sharedTimeout !== undefined
      ? { requestTimeoutMs: config.orchestrator?.requestTimeoutMs ?? sharedTimeout }
      : {}),
    ...(config.orchestrator?.reconnectAttempts !== undefined
      ? { reconnectAttempts: config.orchestrator.reconnectAttempts }
      : {}),
    ...(config.orchestrator?.reconnectDelayMs !== undefined
      ? { reconnectDelayMs: config.orchestrator.reconnectDelayMs }
      : {}),
  });

  const semantic = new SemanticAnalyzer({
    ...(config.semantic?.pythonBin !== undefined ? { pythonBin: config.semantic.pythonBin } : {}),
    ...(config.semantic?.engineRoot !== undefined ? { engineRoot: config.semantic.engineRoot } : {}),
    ...(config.repoRoot !== undefined ? { repoRoot: config.repoRoot } : {}),
    ...(config.semantic?.requestTimeoutMs !== undefined || sharedTimeout !== undefined
      ? { requestTimeoutMs: config.semantic?.requestTimeoutMs ?? sharedTimeout }
      : {}),
  });

  return {
    gate,
    mcp,
    orchestrator,
    semantic,
    skills: () => loadSkillCatalog(config.skillCatalog),
    close: async () => {
      if (mcp !== null) {
        await mcp.close();
      }
      orchestrator.close();
    },
  };
}
