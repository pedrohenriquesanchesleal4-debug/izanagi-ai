/**
 * Client for the Python `ast_analyzer` engine (python-engine/ast_analyzer).
 *
 * Invocation contract (cli.py / __main__.py):
 *   <python> -m ast_analyzer analyze <path> [--glob PATTERN]
 *   - exit 0: JSON report on stdout (FileReport or DirReport, snake_case)
 *   - exit 1: JSON error payload on stderr: {"ok":false,"error":{type,message,path}}
 *
 * The module must be importable, so the child runs with `cwd` pinned to the
 * python-engine directory.
 *
 * Interpreter resolution order: explicit option > $IZANAGI_PYTHON >
 * python-engine/.venv/bin/python > "python3" on PATH.
 */

import { spawn } from "node:child_process";
import path from "node:path";

import {
  type SemanticFileReport,
  type SemanticReport,
  isSemanticFilePayload,
  parseSemanticDirReport,
  parseSemanticErrorPayload,
  parseSemanticFileReport,
} from "./contracts.js";
import { OperationTimeoutError, ProcessFailedError, PythonNotFoundError } from "./errors.js";
import { resolveRepoRoot } from "./environment.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const VENV_PYTHON = process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python";

export interface SemanticOptions {
  /** Explicit interpreter; wins over env and fallbacks. */
  readonly pythonBin?: string;
  /** Directory containing the ast_analyzer package. */
  readonly engineRoot?: string;
  /** Workspace root used to derive the default engine directory. */
  readonly repoRoot?: string;
  /** Deadline for one analyzer invocation. */
  readonly requestTimeoutMs?: number;
}

export interface AnalyzeRequest {
  /** File or directory to analyze. */
  readonly targetPath: string;
  /** Optional glob for directory scans. */
  readonly glob?: string;
}

export class SemanticAnalyzer {
  private readonly explicitPython: string | undefined;
  private readonly engineRoot: string;
  private readonly requestTimeoutMs: number;
  private resolvedPython?: string;

  constructor(options: SemanticOptions = {}) {
    this.explicitPython = options.pythonBin ?? process.env["IZANAGI_PYTHON"];
    this.engineRoot = options.engineRoot ?? path.join(resolveRepoRoot(options.repoRoot), "python-engine");
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Resolves the interpreter once: explicit option > $IZANAGI_PYTHON >
   * bundled venv python > `python3`. Throws `PythonNotFoundError` listing
   * every candidate when none works.
   */
  async ensurePython(): Promise<string> {
    if (this.resolvedPython !== undefined) {
      return this.resolvedPython;
    }
    const candidates: string[] = [];
    if (this.explicitPython !== undefined && this.explicitPython !== "") {
      candidates.push(this.explicitPython);
    }
    candidates.push(path.join(this.engineRoot, VENV_PYTHON), "python3");

    const failures: unknown[] = [];
    for (const candidate of candidates) {
      const usable = await probeInterpreter(candidate);
      if (usable === true) {
        this.resolvedPython = candidate;
        return candidate;
      }
      failures.push(usable);
    }
    throw new PythonNotFoundError(candidates, failures.at(-1));
  }

  /** Analyzer version probe; also proves the interpreter + module load. */
  async checkEngine(): Promise<boolean> {
    try {
      await this.run(["-c", "import ast_analyzer"]);
      return true;
    } catch {
      return false;
    }
  }

  /** Analyzes a single source file and returns its typed report. */
  async analyzeFile(filePath: string): Promise<SemanticFileReport> {
    const report = await this.analyze({ targetPath: filePath });
    if (report.kind !== "file") {
      throw new Error(`expected a file report for "${filePath}", got a directory report`);
    }
    return report;
  }

  /** Analyzes a file or directory tree; the report kind follows the input. */
  async analyze(request: AnalyzeRequest): Promise<SemanticReport> {
    const python = await this.ensurePython();
    const args = ["-m", "ast_analyzer", "analyze", path.resolve(request.targetPath)];
    if (request.glob !== undefined) {
      args.push("--glob", request.glob);
    }

    let stdoutText: string;
    try {
      stdoutText = await this.run(args);
    } catch (error) {
      if (error instanceof AnalyzerProcessError && error.stderrPayload !== null) {
        throw new AnalyzerFailedError(error.stderrPayload, error.stderrText);
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdoutText) as unknown;
    } catch (cause) {
      throw new Error(`ast_analyzer produced invalid JSON: ${String(cause)}`);
    }
    if (isSemanticFilePayload(parsed)) {
      return parseSemanticFileReport(parsed);
    }
    return parseSemanticDirReport(parsed);
  }

  private run(args: readonly string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(this.resolvedPython as string, [...args], {
        cwd: this.engineRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      const settle = (action: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        action();
      };

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        settle(() =>
          reject(new OperationTimeoutError(`python ${args.slice(0, 3).join(" ")}`, this.requestTimeoutMs)),
        );
      }, this.requestTimeoutMs);

      child.once("error", (spawnError) => {
        settle(() => reject(spawnError));
      });

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      child.once("close", (code, signal) => {
        const stdoutText = Buffer.concat(stdoutChunks).toString("utf8");
        const stderrText = Buffer.concat(stderrChunks).toString("utf8");
        settle(() => {
          if (code === 0) {
            resolve(stdoutText);
            return;
          }
          reject(
            new AnalyzerProcessError(
              `${this.resolvedPython} ${args.join(" ")}`,
              code,
              signal,
              stderrText,
            ),
          );
        });
      });
    });
  }
}

/** Non-zero exit from the analyzer; carries the parsed stderr payload. */
export class AnalyzerProcessError extends ProcessFailedError {
  override name = "AnalyzerProcessError";
  constructor(
    commandLine: string,
    exitCode: number | null,
    signal: NodeJS.Signals | null,
    readonly stderrText: string,
  ) {
    super(commandLine, exitCode, signal, stderrText);
  }

  get stderrPayload(): ReturnType<typeof parseSemanticErrorPayload> {
    return parseSemanticErrorPayload(this.stderrText);
  }
}

/** The analyzer ran but rejected the request (bad path, unreadable, ...). */
export class AnalyzerFailedError extends Error {
  override name = "AnalyzerFailedError";
  constructor(
    readonly payload: { type: string; message: string; path: string },
    readonly stderrText: string,
  ) {
    super(`ast_analyzer failed (${payload.type}): ${payload.message}`);
  }
}

/** Probes an interpreter with `--version`; returns true/false or the error. */
async function probeInterpreter(candidate: string): Promise<boolean | unknown> {
  return new Promise<boolean | unknown>((resolve) => {
    const child = spawn(candidate, ["--version"], { stdio: "ignore" });
    child.once("error", (error) => resolve(error));
    child.once("close", (code) => resolve(code === 0));
  });
}
