/**
 * Typed error taxonomy for every process/IO boundary the SDK touches.
 * Callers branch on `instanceof` instead of string-matching messages.
 */

/** Base class so consumers can `catch (e) { if (e instanceof IzanagiError) }`. */
export class IzanagiError extends Error {
  override name = "IzanagiError";
}

/** The requested native binary does not exist or is not executable. */
export class BinaryNotFoundError extends IzanagiError {
  override name = "BinaryNotFoundError";
  constructor(
    readonly binaryName: string,
    readonly searchedPaths: readonly string[],
    readonly envHint: string,
  ) {
    super(
      `binary "${binaryName}" not found. Set ${envHint} or build it first. Searched: ${
        searchedPaths.length > 0 ? searchedPaths.join(", ") : "(no candidate paths)"
      }`,
    );
  }
}

/** A spawned process exited non-zero or died without producing a response. */
export class ProcessFailedError extends IzanagiError {
  override name = "ProcessFailedError";
  constructor(
    readonly commandLine: string,
    readonly exitCode: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly stderrTail: string,
  ) {
    const reason = signal !== null ? `killed by ${signal}` : `exit code ${String(exitCode)}`;
    const stderr = stderrTail.trim().length > 0 ? `; stderr: ${stderrTail.trim().slice(-400)}` : "";
    super(`process failed (${reason}): ${commandLine}${stderr}`);
  }
}

/** A request outlived its deadline; the underlying session is torn down. */
export class OperationTimeoutError extends IzanagiError {
  override name = "OperationTimeoutError";
  constructor(readonly operation: string, readonly timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms`);
  }
}

/** A wire frame could not be parsed as JSON or violated a known contract. */
export class FrameParseError extends IzanagiError {
  override name = "FrameParseError";
  constructor(readonly frame: string, cause: unknown) {
    super(`unparseable frame (${String(cause)}): ${frame.slice(0, 200)}`, { cause });
  }
}

/** Typed JSON-RPC error carrying the server-side code. */
export class JsonRpcError extends IzanagiError {
  override name = "JsonRpcError";
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }

  /** True when the error belongs to the Go orchestrator's app range. */
  get isApplicationError(): boolean {
    return this.code <= -32000 && this.code > -32099;
  }
}

/** The Unix domain socket is missing or refused the connection. */
export class SocketUnavailableError extends IzanagiError {
  override name = "SocketUnavailableError";
  constructor(
    readonly socketPath: string,
    cause: unknown,
  ) {
    super(`orchestrator socket unavailable at ${socketPath}`, { cause });
  }
}

/** The connection dropped while requests were in flight or mid-session. */
export class ConnectionClosedError extends IzanagiError {
  override name = "ConnectionClosedError";
  constructor(message = "connection closed by peer") {
    super(message);
  }
}

/** The Python interpreter could not be located or refused to start. */
export class PythonNotFoundError extends IzanagiError {
  override name = "PythonNotFoundError";
  constructor(readonly candidates: readonly string[], cause?: unknown) {
    super(
      `no usable Python interpreter (tried: ${candidates.join(", ")}). Set IZANAGI_PYTHON to override.`,
      cause === undefined ? undefined : { cause },
    );
  }
}
