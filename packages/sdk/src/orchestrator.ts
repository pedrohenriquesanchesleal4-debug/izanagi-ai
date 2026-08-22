/**
 * Client for the Go swarm orchestrator: JSON-RPC 2.0 over a Unix domain
 * socket (go-services/swarm_orchestrator/internal/server).
 *
 * Wire facts extracted from rpc.go / server.go / domain.go:
 * - Methods: `orchestrator.submit`, `orchestrator.status`, `orchestrator.cancel`.
 * - Every request frame MUST carry `jsonrpc: "2.0"` exactly; batches are
 *   rejected; notifications receive no reply.
 * - The server pushes method `"event"` notifications whose params are
 *   `domain.Event` ({taskId, type, data?, at}) to every connected client.
 * - Application error codes: -32001 unknown task, -32002 task conflict,
 *   -32003 queue full, -32004 shutting down, -32005 socket in use.
 */

import { connect as netConnect, type Socket } from "node:net";
import { access, constants } from "node:fs/promises";

import {
  type AgentEvent,
  type CancelResult,
  type SubmitResult,
  type TaskId,
  type TaskStatus,
  parseCancelResult,
  parseSubmitResult,
  parseTaskStatus,
} from "./contracts.js";
import {
  ConnectionClosedError,
  FrameParseError,
  JsonRpcError,
  OperationTimeoutError,
  SocketUnavailableError,
} from "./errors.js";
import { resolveOrchestratorSocket } from "./environment.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY_MS = 250;
const TERMINAL_STATES: readonly TaskStatus["state"][] = ["done", "failed"];

export interface OrchestratorClientOptions {
  /** Unix socket path; wins over $IZANAGI_ORCHESTRATOR_SOCKET and the default. */
  readonly socketPath?: string;
  /** Deadline for each RPC round trip. */
  readonly requestTimeoutMs?: number;
  /** Reconnect budget applied when a live connection drops mid-use. */
  readonly reconnectAttempts?: number;
  /** Base delay between reconnect attempts (doubles each retry). */
  readonly reconnectDelayMs?: number;
}

export type EventListener = (event: AgentEvent) => void;

/** Result of awaiting a task's terminal state via polling. */
export interface TerminalWaitResult {
  readonly status: TaskStatus;
  readonly pollCount: number;
}

export class OrchestratorClient {
  private readonly socketPath: string;
  private readonly requestTimeoutMs: number;
  private readonly reconnectAttempts: number;
  private readonly reconnectDelayMs: number;
  private readonly eventListeners = new Set<EventListener>();
  private socket: Socket | undefined;
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void; timer: NodeJS.Timeout }
  >();

  constructor(options: OrchestratorClientOptions = {}) {
    this.socketPath = resolveOrchestratorSocket(options.socketPath);
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.reconnectAttempts = options.reconnectAttempts ?? DEFAULT_RECONNECT_ATTEMPTS;
    this.reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  }

  /** Registers an event push listener; returns an unsubscribe function. */
  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Submits a task to the pipeline. Resolves with `{accepted: true}` or
   * throws the mapped JSON-RPC error (conflict, queue full, shutting down).
   */
  async submit(task: { taskId: TaskId; task: string; agentChain?: readonly string[] }): Promise<SubmitResult> {
    const params: Record<string, unknown> = { taskId: task.taskId, task: task.task };
    if (task.agentChain !== undefined) {
      params["agentChain"] = [...task.agentChain];
    }
    return parseSubmitResult(await this.call("orchestrator.submit", params));
  }

  /** Fetches the current pipeline state of a task. */
  async status(taskId: string): Promise<TaskStatus> {
    return parseTaskStatus(await this.call("orchestrator.status", { taskId }));
  }

  /** Requests cancellation; resolves with whether it was still cancellable. */
  async cancel(taskId: string): Promise<CancelResult> {
    return parseCancelResult(await this.call("orchestrator.cancel", { taskId }));
  }

  /**
   * Polls `status` until the task reaches a terminal state (`done`/`failed`)
   * or the deadline expires. Poll interval starts at 150ms and doubles.
   */
  async awaitTerminal(
    taskId: string,
    options: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<TerminalWaitResult> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const startedAt = Date.now();
    let intervalMs = 150;
    let pollCount = 0;

    for (;;) {
      if (options.signal?.aborted) {
        throw new Error(`awaitTerminal(${taskId}): aborted by caller`);
      }
      const status = await this.status(taskId);
      pollCount += 1;
      if (TERMINAL_STATES.includes(status.state)) {
        return { status, pollCount };
      }
      if (Date.now() - startedAt + intervalMs > timeoutMs) {
        throw new OperationTimeoutError(`awaitTerminal(${taskId})`, timeoutMs);
      }
      await sleep(intervalMs);
      intervalMs = Math.min(intervalMs * 2, 2_000);
    }
  }

  /** True when the socket file exists (cheap reachability probe). */
  async isReachable(): Promise<boolean> {
    try {
      await access(this.socketPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /** Closes the connection and fails every in-flight request. */
  close(): void {
    this.socket?.destroy();
    this.socket = undefined;
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new ConnectionClosedError(`client closed with request ${id} in flight`));
      this.pending.delete(id);
    }
  }

  /** Sends one request over a (re)connected socket and awaits its reply. */
  private call(method: string, params: Record<string, unknown>): Promise<unknown> {
    return this.callWithReconnect(method, params, 0);
  }

  private async callWithReconnect(
    method: string,
    params: Record<string, unknown>,
    attempt: number,
  ): Promise<unknown> {
    try {
      const socket = await this.ensureConnected();
      return await this.transact(socket, method, params);
    } catch (error) {
      const retryable =
        error instanceof SocketUnavailableError ||
        error instanceof ConnectionClosedError ||
        hasRetryableErrno(error);
      if (!retryable || attempt >= this.reconnectAttempts) {
        throw error;
      }
      await sleep(this.reconnectDelayMs * 2 ** attempt);
      return this.callWithReconnect(method, params, attempt + 1);
    }
  }

  private async ensureConnected(): Promise<Socket> {
    if (this.socket !== undefined && !this.socket.destroyed && this.socket.readable) {
      return this.socket;
    }
    try {
      await access(this.socketPath, constants.F_OK);
    } catch (cause) {
      throw new SocketUnavailableError(this.socketPath, cause);
    }

    const socket = await new Promise<Socket>((resolve, reject) => {
      const candidate = netConnect(this.socketPath);
      candidate.once("connect", () => resolve(candidate));
      candidate.once("error", (error) => reject(new SocketUnavailableError(this.socketPath, error)));
    });

    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
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
    socket.on("error", () => {
      // Errors surface through pending rejections; destroy triggers 'close'.
      socket.destroy();
    });
    socket.on("close", () => {
      if (this.socket === socket) {
        this.socket = undefined;
      }
      this.failPendingOnDisconnect();
    });

    this.socket = socket;
    return socket;
  }

  private transact(socket: Socket, method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const frame = { jsonrpc: "2.0", id, method, params };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new OperationTimeoutError(`orchestrator.${method}`, this.requestTimeoutMs));
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      try {
        socket.write(`${JSON.stringify(frame)}\n`);
      } catch (cause) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new ConnectionClosedError(`cannot send ${method}: ${String(cause)}`));
      }
    });
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

    // Server push notification: method "event" with domain.Event params.
    if (typeof frame["method"] === "string") {
      if (frame["method"] === "event" && frame["params"] !== undefined) {
        const event = parseAgentEventLenient(frame["params"]);
        for (const listener of this.eventListeners) {
          listener(event);
        }
      }
      return;
    }

    if (typeof frame["id"] !== "number") {
      return;
    }
    const entry = this.pending.get(frame["id"]);
    if (entry === undefined) {
      return;
    }
    this.pending.delete(frame["id"]);
    clearTimeout(entry.timer);

    if (frame["error"] !== undefined && typeof frame["error"] === "object" && frame["error"] !== null) {
      const raw = frame["error"] as Record<string, unknown>;
      entry.reject(
        new JsonRpcError(
          typeof raw["code"] === "number" ? raw["code"] : -32603,
          typeof raw["message"] === "string" ? raw["message"] : "unknown orchestrator error",
          raw["data"],
        ),
      );
      return;
    }
    entry.resolve(frame["result"]);
  }

  private failPendingOnDisconnect(): void {
    this.failAllPending(new ConnectionClosedError("orchestrator connection dropped"));
  }

  private failAllPending(error: unknown): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }
}

function parseAgentEventLenient(raw: unknown): AgentEvent {
  // Push events come from Go's json encoder; keep parsing strict but map a
  // missing data field to undefined instead of failing the whole stream.
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const event: { taskId: string; type: string; at: string } = {
    taskId: typeof record["taskId"] === "string" ? record["taskId"] : "",
    type: typeof record["type"] === "string" ? record["type"] : "",
    at: typeof record["at"] === "string" ? record["at"] : new Date().toISOString(),
  };
  if (typeof record["data"] === "object" && record["data"] !== null && !Array.isArray(record["data"])) {
    return { ...event, data: record["data"] as Record<string, unknown> };
  }
  return event;
}

function hasRetryableErrno(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "ECONNRESET" || code === "EPIPE" || code === "ENOENT";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
