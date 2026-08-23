/**
 * Client for the `izanagi-core` quality-gate binary.
 *
 * Wire contract (crates/izanagi_core/src/protocol.rs): newline-delimited JSON,
 * one response line per request line, session ends at EOF. This client uses
 * one short-lived process per request — the simplest way to keep FIFO framing
 * airtight and survive engine crashes without session desync.
 *
 * Resolution order for the binary: explicit option > $IZANAGI_CORE_BIN >
 * target/debug|release under the workspace root.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  type CoreResponse,
  type GateLanguage,
  type QualityGateResult,
  type ScanRationalizationsResult,
  inferGateLanguage,
  parseCoreResponse,
} from "./contracts.js";
import { OperationTimeoutError, ProcessFailedError } from "./errors.js";
import { resolveCoreBinary } from "./environment.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export interface RustCoreOptions {
  /** Explicit binary path; wins over env and build-output search. */
  readonly binaryPath?: string;
  /** Workspace root for build-output discovery. */
  readonly repoRoot?: string;
  /** Per-request deadline in milliseconds. The process is killed on expiry. */
  readonly requestTimeoutMs?: number;
}

/** A single validation input for the Rust engine. */
export interface ValidateInput {
  readonly language: GateLanguage;
  readonly code: string;
}

export class RustCoreClient {
  private readonly binaryPath: string | undefined;
  private readonly repoRoot: string | undefined;
  private readonly requestTimeoutMs: number;
  private cachedBinaryPath?: string;

  constructor(options: RustCoreOptions = {}) {
    this.binaryPath = options.binaryPath;
    this.repoRoot = options.repoRoot;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  /** Scores source code, returning score plus every violation found. */
  async validate(input: ValidateInput): Promise<QualityGateResult> {
    const response = await this.exchange(
      JSON.stringify({ op: "validate", language: input.language, code: input.code }),
      "validate",
    );
    if (response.kind !== "validate") {
      throw new Error(`izanagi-core answered "${response.kind}" to a validate request`);
    }
    return response.result;
  }

  /** Lists the rule identifiers compiled into the engine. */
  async rules(): Promise<readonly string[]> {
    const response = await this.exchange(JSON.stringify({ op: "rules" }), "rules");
    if (response.kind !== "rules") {
      throw new Error(`izanagi-core answered "${response.kind}" to a rules request`);
    }
    return response.rules;
  }

  /** Reports the crate version of the connected binary. */
  async version(): Promise<string> {
    const response = await this.exchange(JSON.stringify({ op: "version" }), "version");
    if (response.kind !== "version") {
      throw new Error(`izanagi-core answered "${response.kind}" to a version request`);
    }
    return response.version;
  }

  /**
   * Scans raw text for curated rationalization patterns (anti-rationalization
   * gate). Severity semantics live in the engine: blocker = stub-grade
   * deliveries, major = concrete process failures, minor = review-worthy
   * smells.
   */
  async scanRationalizations(text: string): Promise<ScanRationalizationsResult> {
    const response = await this.exchange(
      JSON.stringify({ op: "scan-rationalizations", text }),
      "scan-rationalizations",
    );
    if (response.kind !== "scan-rationalizations") {
      throw new Error(`izanagi-core answered "${response.kind}" to a scan-rationalizations request`);
    }
    return response.result;
  }

  /**
   * Validates a file from disk. Language is inferred from its extension;
   * unsupported extensions throw instead of guessing.
   */
  async validateFile(filePath: string): Promise<QualityGateResult> {
    const language = inferGateLanguage(filePath);
    if (language === null) {
      throw new Error(`cannot infer gate language for "${filePath}": unsupported extension`);
    }
    const code = await readFile(filePath, "utf8");
    return this.validate({ language, code });
  }

  /** Resolves (and caches) the binary location up front. */
  async ensureBinary(): Promise<string> {
    this.cachedBinaryPath ??= await resolveCoreBinary(this.binaryPath, this.repoRoot);
    return this.cachedBinaryPath;
  }

  /**
   * Sends exactly one request line to a fresh engine process and parses the
   * first response line. Any transport failure surfaces as a typed error.
   */
  private async exchange(line: string, operation: string): Promise<CoreResponse> {
    const binaryPath = await this.ensureBinary();
    const child = spawn(binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });

    const outcome = await new Promise<
      { ok: true; responseLine: string } | { ok: false; error: unknown }
    >((resolve) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      const settle = (result: { ok: true; responseLine: string } | { ok: false; error: unknown }): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        settle({ ok: false, error: new OperationTimeoutError(`izanagi-core ${operation}`, this.requestTimeoutMs) });
      }, this.requestTimeoutMs);

      child.once("error", (spawnError) => {
        settle({ ok: false, error: spawnError });
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.once("close", (code, signal) => {
        const text = Buffer.concat(stdoutChunks).toString("utf8");
        const firstLine = text
          .split("\n")
          .map((entry) => entry.trim())
          .find((entry) => entry.length > 0);
        if (firstLine === undefined) {
          settle({
            ok: false,
            error: new ProcessFailedError(
              `${binaryPath} (${operation})`,
              code,
              signal,
              Buffer.concat(stderrChunks).toString("utf8"),
            ),
          });
          return;
        }
        settle({ ok: true, responseLine: firstLine });
      });

      try {
        child.stdin.write(`${line}\n`);
        child.stdin.end();
      } catch {
        // The close handler reports the failure through an empty stdout.
      }
    });

    if (!outcome.ok) {
      throw outcome.error;
    }
    return parseCoreResponse(outcome.responseLine);
  }
}
