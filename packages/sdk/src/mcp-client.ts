/**
 * MCP integration bridging two surfaces of `crates/izanagi_mcp`:
 *
 * 1. Tool DISCOVERY runs through the real Rust harness binary
 *    (`izanagi-mcp [--timeout-ms=N] <server-command...>`), which performs the
 *    handshake and prints one NDJSON step per line:
 *        {"step":"initialize","result":{...}}
 *        {"step":"tools/list","tools":[...]}
 *    The binary tears its child down afterwards, so it cannot carry calls.
 *
 * 2. Tool INVOCATION therefore speaks the very same wire contract natively:
 *    JSON-RPC 2.0 over newline-delimited stdio (codec.rs), mirroring
 *    client.rs semantics - `initialize` with protocol version "2025-06-18",
 *    `notifications/initialized`, requests correlated by numeric id,
 *    per-request timeout, and the reserved-code error taxonomy of error.rs.
 */

import {
  spawn,
  type ChildProcessByStdio,
} from "node:child_process";
import type { Readable, Writable } from "node:stream";

import {
  type McpDiscoveryResult,
  type McpServerInfo,
  type McpTool,
  type McpToolCall,
  type McpToolResult,
  ContractViolationError,
  isRecord,
  parseMcpTool,
} from "./contracts.js";
import {
  ConnectionClosedError,
  FrameParseError,
  JsonRpcError,
  OperationTimeoutError,
  ProcessFailedError,
} from "./errors.js";
import { resolveMcpBinary } from "./environment.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const CLIENT_NAME = "izanagi-sdk";
const CLIENT_VERSION = "0.1.0";
const DEFAULT_TIMEOUT_MS = 15_000;
const CLOSE_GRACE_MS = 1_500;
/** JSON-RPC reserved code used when an error frame lacks a numeric code. */
const RPC_INTERNAL = -32603;

export interface McpClientOptions {
  /** Command that launches the MCP server, e.g. ["node","fs-server.mjs"]. */
  readonly serverCommand: readonly string[];
  /** Explicit `izanagi-mcp` binary path; wins over $IZANAGI_MCP_BIN and search. */
  readonly binaryPath?: string;
  /** Workspace root used by the binary auto-search. */
  readonly repoRoot?: string;
  /** Deadline for discovery, handshake and every subsequent request. */
  readonly requestTimeoutMs?: number;
}

/** One NDJSON step frame printed by the `izanagi-mcp` harness. */
type HarnessStep =
  | { readonly step: "initialize"; readonly result: Record<string, unknown> }
  | { readonly step: "tools/list"; readonly tools: readonly unknown[] };

/** Child with all three stdio streams guaranteed non-null. */
type StdioChild = ChildProcessByStdio<Writable, Readable, Readable>;

function parseHarnessStep(line: string): HarnessStep {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch (cause) {
    throw new FrameParseError(line, cause);
  }
  if (!isRecord(parsed)) {
    throw new FrameParseError(line, "frame is not an object");
  }
  if (parsed["step"] === "initialize") {
    const result = parsed["result"];
    if (!isRecord(result)) {
      throw new FrameParseError(line, 'initialize step lacks a "result" object');
    }
    return { step: "initialize", result };
  }
  if (parsed["step"] === "tools/list") {
    const tools = parsed["tools"];
    if (!Array.isArray(tools)) {
      throw new FrameParseError(line, 'tools/list step lacks a "tools" array');
    }
    return { step: "tools/list", tools };
  }
  throw new FrameParseError(line, `unknown step ${String(parsed["step"])}`);
}

function extractServerInfo(raw: unknown): McpServerInfo | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record["name"] !== "string") {
    return undefined;
  }
  if (typeof record["version"] === "string") {
    return { name: record["name"], version: record["version"] };
  }
  return { name: record["name"] };
}

function parseToolResult(raw: Record<string, unknown>): McpToolResult {
  const result: { content?: readonly unknown[]; isError?: boolean; structuredContent?: unknown } = {};
  if (Array.isArray(raw["content"])) {
    result.content = raw["content"];
  }
  if (raw["isError"] === true) {
    result.isError = true;
  }
  if (raw["structuredContent"] !== undefined) {
    result.structuredContent = raw["structuredContent"];
  }
  return result;
}

interface ProcessOutput {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdoutText: string;
  readonly stderrText: string;
}

function collectProcessOutput(
  child: ChildProcessByStdio<null, Readable, Readable>,
  timeoutMs: number,
): Promise<ProcessOutput> {
  return new Promise<ProcessOutput>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const settle = (output: ProcessOutput): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(output);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.once("error", (spawnError) => {
      settled = true;
      clearTimeout(timer);
      reject(spawnError);
    });

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.once("close", (code, signal) => {
      settle({
        code,
        signal,
        stdoutText: Buffer.concat(stdoutChunks).toString("utf8"),
        stderrText: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}

/** Facade combining Rust-harness discovery with a native stdio session. */
export class McpClient {
  private readonly serverCommand: readonly string[];
  private readonly binaryPath: string | undefined;
  private readonly repoRoot: string | undefined;
  private readonly requestTimeoutMs: number;
  private resolvedBinaryPath?: string;
  private session: Session | undefined;

  constructor(options: McpClientOptions) {
    if (options.serverCommand.length === 0) {
      throw new Error("McpClient requires a non-empty serverCommand");
    }
    this.serverCommand = options.serverCommand;
    this.binaryPath = options.binaryPath;
    this.repoRoot = options.repoRoot;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves (and caches) the harness binary used for discovery. */
  async ensureBinaryPath(): Promise<string> {
    this.resolvedBinaryPath ??= await resolveMcpBinary(this.binaryPath, this.repoRoot);
    return this.resolvedBinaryPath;
  }

  /**
   * Discovers the server's tools through the Rust harness binary. Throws
   * `BinaryNotFoundError` when the harness is absent and `ProcessFailedError`
   * when the handshake fails or never reaches tools/list.
   */
  async discoverTools(): Promise<McpDiscoveryResult> {
    const binaryPath = await this.ensureBinaryPath();
    const commandLine = [
      binaryPath,
      `--timeout-ms=${this.requestTimeoutMs}`,
      ...this.serverCommand,
    ];
    const child = spawn(commandLine[0] as string, commandLine.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output: ProcessOutput;
    try {
      output = await collectProcessOutput(child, this.requestTimeoutMs * 2);
    } catch (spawnError) {
      throw spawnError instanceof Error ? spawnError : new Error(String(spawnError));
    }

    if (output.code !== 0 && !output.stdoutText.includes('"tools/list"')) {
      throw new ProcessFailedError(commandLine.join(" "), output.code, output.signal, output.stderrText);
    }

    let protocolVersion: string | undefined;
    let serverInfo: McpServerInfo | undefined;
    let tools: readonly McpTool[] = [];

    for (const line of output.stdoutText.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const step = parseHarnessStep(trimmed);
      if (step.step === "initialize") {
        protocolVersion =
          typeof step.result["protocolVersion"] === "string"
            ? step.result["protocolVersion"]
            : undefined;
        serverInfo = extractServerInfo(step.result["serverInfo"]);
      } else {
        tools = step.tools.map(parseMcpTool);
      }
    }

    if (!output.stdoutText.includes('"tools/list"')) {
      throw new ProcessFailedError(
        commandLine.join(" "),
        output.code,
        output.signal,
        "harness ended before completing tools/list",
      );
    }
    return {
      ...(protocolVersion !== undefined ? { protocolVersion } : {}),
      ...(serverInfo !== undefined ? { serverInfo } : {}),
      tools,
    };
  }

  /**
   * Opens a native stdio session to the configured MCP server, performing the
   * full handshake. Safe to call repeatedly while the session stays alive.
   */
  async connect(): Promise<void> {
    if (this.session !== undefined && this.session.alive) {
      return;
    }
    const session = Session.spawn(this.serverCommand, this.requestTimeoutMs);
    try {
      await session.initialize();
      this.session = session;
    } catch (error) {
      await session.destroy().catch(() => undefined);
      throw error;
    }
  }

  /** Lists tools through the live native session. */
  async listTools(): Promise<readonly McpTool[]> {
    const session = this.requireSession("listTools");
    const raw = await session.request("tools/list", {});
    const tools = raw["tools"];
    if (!Array.isArray(tools)) {
      throw new ContractViolationError('array "tools" in tools/list result', tools);
    }
    return tools.map(parseMcpTool);
  }

  /**
   * Invokes a tool through the live native session. In-band failures come
   * back as `{ isError: true }` instead of throwing; transport/protocol
   * failures still throw typed errors.
   */
  async callTool(call: McpToolCall): Promise<McpToolResult> {
    const session = this.requireSession("callTool");
    const raw = await session.request("tools/call", {
      name: call.name,
      arguments: call.arguments,
    });
    return parseToolResult(raw);
  }

  /** True while the native stdio session is connected. */
  get connected(): boolean {
    return this.session?.alive === true;
  }

  /** Terminates the native session; discovery never holds long-lived state. */
  async close(): Promise<void> {
    if (this.session !== undefined) {
      await this.session.destroy();
      this.session = undefined;
    }
  }

  private requireSession(operation: string): Session {
    if (this.session === undefined || !this.session.alive) {
      throw new ConnectionClosedError(`no live MCP session: call connect() before ${operation}()`);
    }
    return this.session;
  }
}

/* ------------------------------------------------------------------------- */
/* Native JSON-RPC 2.0 stdio session                                         */
/* ------------------------------------------------------------------------- */

interface PendingRequest {
  readonly resolve: (value: Record<string, unknown>) => void;
  readonly reject: (error: unknown) => void;
  readonly timer: NodeJS.Timeout;
}

class Session {
  static spawn(serverCommand: readonly string[], requestTimeoutMs: number): Session {
    const [program, ...args] = serverCommand;
    const child = spawn(program as string, args, { stdio: ["pipe", "pipe", "pipe"] });
    return new Session(child, requestTimeoutMs);
  }

  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<number, PendingRequest>();
  private readonly exitPromise: Promise<void>;
  private destroyed = false;

  constructor(
    private readonly child: StdioChild,
    private readonly requestTimeoutMs: number,
  ) {
    this.exitPromise = new Promise<void>((resolve) => {
      child.once("close", () => resolve());
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      for (;;) {
        const newlineIndex = this.buffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }
        const line = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          this.routeFrame(line);
        }
      }
    });
    child.once("close", () => {
      this.failAllPending(new ConnectionClosedError("MCP server process exited"));
    });
  }

  get alive(): boolean {
    return !this.destroyed && this.child.exitCode === null && !this.child.killed;
  }

  /** Handshake: initialize request followed by notifications/initialized. */
  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
    });
    this.writeFrame({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  request(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const frame: Record<string, unknown> = { jsonrpc: "2.0", id, method, params };

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new OperationTimeoutError(`mcp ${method}`, this.requestTimeoutMs));
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      if (!this.writeFrame(frame)) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new ConnectionClosedError(`cannot send ${method}: session is closing`));
      }
    });
  }

  async destroy(): Promise<void> {
    if (!this.destroyed) {
      this.destroyed = true;
      if (this.child.exitCode === null) {
        this.child.kill("SIGTERM");
      }
      const graceExpired = await Promise.race([
        this.exitPromise.then(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), CLOSE_GRACE_MS)),
      ]);
      if (graceExpired && this.child.exitCode === null) {
        this.child.kill("SIGKILL");
      }
      await this.exitPromise;
      this.failAllPending(new ConnectionClosedError("session destroyed"));
    }
    return this.exitPromise;
  }

  private writeFrame(frame: unknown): boolean {
    try {
      this.child.stdin.write(`${JSON.stringify(frame)}\n`);
      return true;
    } catch {
      return false;
    }
  }

  private routeFrame(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (cause) {
      this.failAllPending(new FrameParseError(line, cause));
      return;
    }
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }
    const frame = parsed as Record<string, unknown>;

    // Notifications and server-initiated requests carry no correlatable id.
    if (typeof frame["id"] !== "number") {
      return;
    }
    const pending = this.pending.get(frame["id"]);
    if (pending === undefined) {
      return;
    }
    this.pending.delete(frame["id"]);
    clearTimeout(pending.timer);

    if (frame["error"] !== undefined && typeof frame["error"] === "object" && frame["error"] !== null) {
      pending.reject(decodeRpcError(frame["error"]));
      return;
    }
    const result = frame["result"];
    pending.resolve(
      typeof result === "object" && result !== null && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : {},
    );
  }

  private failAllPending(error: unknown): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

function decodeRpcError(raw: object): JsonRpcError {
  const record = raw as Record<string, unknown>;
  const code = typeof record["code"] === "number" ? record["code"] : RPC_INTERNAL;
  const message =
    typeof record["message"] === "string" ? record["message"] : "unknown server error";
  if (record["data"] === undefined) {
    return new JsonRpcError(code, message);
  }
  return new JsonRpcError(code, message, record["data"]);
}

