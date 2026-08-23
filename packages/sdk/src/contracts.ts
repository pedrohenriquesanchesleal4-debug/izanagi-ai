/**
 * Shared wire contracts of the Izanagi polyglot cores.
 *
 * Every type here mirrors a struct validated strictly at a process boundary:
 * - Rust  `izanagi_core` protocol.rs  (NDJSON over stdin/stdout)
 * - Rust  `izanagi_mcp`   client.rs   (JSON-RPC 2.0 over stdio)
 * - Go    swarm_orchestrator domain.go / rpc.go (JSON-RPC 2.0 over UDS)
 * - Py    ast_analyzer    model.py    (JSON report on stdout)
 *
 * The SDK carries zero runtime dependencies, so boundary validation is done
 * through the hand-written guards at the bottom of this file. They reject
 * unknown shapes loudly instead of trusting parsed JSON.
 */

/** Severity reported by the Rust quality gate (`rules.rs::Severity`). */
export type GateSeverity = "error" | "warning";

/** One finding produced by the Rust quality engine (`rules.rs::Finding`). */
export interface Violation {
  readonly rule: string;
  readonly severity: GateSeverity;
  /** 1-based line number where the finding was detected. */
  readonly line: number;
  readonly message: string;
}

/** Response to the `validate` operation (`protocol.rs`). */
export interface QualityGateResult {
  readonly ok: true;
  /** 0..100; each error costs 15 points, each warning 5. */
  readonly score: number;
  readonly findings: readonly Violation[];
}

/** Languages accepted by the Rust engine (`lang.rs::Language`). */
export type GateLanguage = "typescript" | "python" | "go";

/* ------------------------------------------------------------------------- */
/* Anti-Rationalization Engine (`rationalizations.rs`, op scan-rationalizations) */
/* ------------------------------------------------------------------------- */

/** How heavily a rationalization weighs against delivery (`Severity`). */
export type RationalizationSeverity = "blocker" | "major" | "minor";

/** Domains inherited from the skill-migrator library (`Category`). */
export type RationalizationCategory =
  | "engineering"
  | "testing"
  | "security"
  | "design"
  | "docs"
  | "devops"
  | "data"
  | "ai";

const RATIONALIZATION_SEVERITIES: readonly RationalizationSeverity[] = [
  "blocker",
  "major",
  "minor",
];

const RATIONALIZATION_CATEGORIES: readonly RationalizationCategory[] = [
  "engineering",
  "testing",
  "security",
  "design",
  "docs",
  "devops",
  "data",
  "ai",
];

/** One detected rationalization (`rationalizations.rs::RationalizationFinding`). */
export interface RationalizationFinding {
  readonly patternId: string;
  readonly category: RationalizationCategory;
  readonly severity: RationalizationSeverity;
  /** Hit context, ≤120 chars, kept verbatim from the scanned text. */
  readonly excerpt: string;
  readonly line: number;
}

/** Outcome of scanning one text blob (`rationalizations.rs::ScanReport`). */
export interface ScanRationalizationsResult {
  readonly clean: boolean;
  readonly findings: readonly RationalizationFinding[];
}

/** Task identifier enforced by the Go orchestrator (`domain.ValidateTaskID`). */
declare const taskBrand: unique symbol;
export type TaskId = string & { readonly [taskBrand]: "TaskId" };

/** Pattern mirrored from `go-services/.../domain.go`. */
export const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Builds a branded TaskId or throws `InvalidTaskIdError`. */
export function makeTaskId(raw: string): TaskId {
  if (!TASK_ID_PATTERN.test(raw)) {
    throw new InvalidTaskIdError(raw);
  }
  return raw as TaskId;
}

export class InvalidTaskIdError extends Error {
  constructor(readonly raw: string) {
    super(
      `invalid taskId ${JSON.stringify(raw)}: must match ${TASK_ID_PATTERN.source}`,
    );
    this.name = "InvalidTaskIdError";
  }
}

/** Unit of work submitted via `orchestrator.submit` (`rpc.go::submitParams`). */
export interface AgentTask {
  readonly taskId: TaskId;
  readonly task: string;
  /** Optional; defaults to the canonical chain inside the Go service. */
  readonly agentChain?: readonly string[];
}

/** Lifecycle states reported by `orchestrator.status` (`domain.TaskState`). */
export type TaskState = "queued" | "running" | "done" | "failed";

/** Event types broadcast by the orchestrator (`domain.go` constants). */
export const AGENT_EVENT_TYPES = [
  "task.submitted",
  "stage.started",
  "stage.completed",
  "stage.failed",
  "task.completed",
  "task.failed",
  "task.canceled",
  "task.dropped",
] as const;
export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

/** Push notification params for method `"event"` (`domain.Event`). */
export interface AgentEvent {
  readonly taskId: string;
  readonly type: string;
  readonly data?: Readonly<Record<string, unknown>>;
  /** RFC 3339 timestamp as serialized by Go's time.Time. */
  readonly at: string;
}

/** Read model returned by `orchestrator.status` (`domain.TaskStatus`). */
export interface TaskStatus {
  readonly taskId: string;
  readonly state: TaskState;
  readonly stage: string;
  readonly error?: string;
  readonly events: readonly AgentEvent[];
}

/** Result frames of `orchestrator.submit` / `orchestrator.cancel`. */
export interface SubmitResult {
  readonly accepted: boolean;
  readonly taskId: string;
}
export interface CancelResult {
  readonly cancelled: boolean;
  readonly taskId: string;
}

/** JSON-RPC 2.0 reserved codes shared by both RPC surfaces. */
export const RPC_PARSE_ERROR = -32700 as const;
export const RPC_INVALID_REQUEST = -32600 as const;
export const RPC_METHOD_NOT_FOUND = -32601 as const;
export const RPC_INVALID_PARAMS = -32602 as const;
export const RPC_INTERNAL_ERROR = -32603 as const;

/** Application codes defined by the Go server (`rpc.go`). */
export const RPC_UNKNOWN_TASK = -32001 as const;
export const RPC_TASK_CONFLICT = -32002 as const;
export const RPC_QUEUE_FULL = -32003 as const;
export const RPC_SHUTTING_DOWN = -32004 as const;
export const RPC_SOCKET_IN_USE = -32005 as const;

/** Canonical default chain of the swarm orchestrator (`domain.DefaultChain`). */
export const DEFAULT_AGENT_CHAIN: readonly string[] = [
  "architect",
  "senior-engineer",
  "qa",
  "security",
] as const;

/** Tool advertised by an MCP server through `tools/list` (`client.rs::Tool`). */
export interface McpTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: unknown;
}

/** Invocation request handed to `tools/call` (`client.rs::call_tool`). */
export interface McpToolCall {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/** Result envelope returned by `tools/call` (MCP spec, in-band failures). */
export interface McpToolResult {
  readonly content?: readonly unknown[];
  readonly isError?: boolean;
  readonly structuredContent?: unknown;
}

/** Server identity returned during the MCP handshake. */
export interface McpServerInfo {
  readonly name: string;
  readonly version?: string;
}

/** Output of tool discovery performed by the `izanagi-mcp` binary harness. */
export interface McpDiscoveryResult {
  readonly protocolVersion?: string;
  readonly serverInfo?: McpServerInfo;
  readonly tools: readonly McpTool[];
}

/** Skill metadata parsed from SKILL.md front-matter (v2 schema). */
export interface SkillMeta {
  readonly name: string;
  readonly description: string;
  readonly version?: string;
  readonly category?: string;
  /** MCP servers/tools declared under `tools.mcp[]` in v2 front-matter. */
  readonly mcpTools: readonly string[];
  /** Where the file was found: `.skills/` (v2) or legacy `skills/`. */
  readonly origin: "v2" | "legacy";
  /** Absolute path of the originating SKILL.md. */
  readonly path: string;
  /** Body of the markdown document (everything after the front-matter). */
  readonly body: string;
}

/* ------------------------------------------------------------------------- */
/* Python ast_analyzer report model (model.py, snake_case on the wire)       */
/* ------------------------------------------------------------------------- */

/** Language tag produced by the analyzer (`model.py::LanguageTag`). */
export type AnalyzerLanguage = "ts" | "tsx" | "py" | "go";

export interface SemanticSymbol {
  readonly name: string;
  readonly kind: "function" | "class" | "method";
  readonly line: number;
  readonly end: number;
  readonly params: readonly string[];
}

export interface SemanticCapabilities {
  readonly treeSitter: boolean;
}

/** One-file analysis (`model.py::FileReport`). */
export interface SemanticFileReport {
  readonly kind: "file";
  readonly file: string;
  readonly language: AnalyzerLanguage;
  readonly symbols: readonly SemanticSymbol[];
  readonly complexity: { readonly maxCyclomatic: number; readonly avg: number };
  readonly imports: readonly string[];
  readonly capabilities: SemanticCapabilities;
}

export interface SemanticDirError {
  readonly file: string;
  readonly error: string;
}

export interface SemanticTotals {
  readonly files: number;
  readonly symbols: number;
  readonly functions: number;
  readonly methods: number;
  readonly classes: number;
  readonly importsUnique: number;
  readonly chunks: number;
  readonly maxCyclomatic: number;
  readonly avgCyclomatic: number;
  readonly byLanguage: Readonly<Record<string, number>>;
  readonly errors: number;
}

/** Directory-tree analysis (`model.py::DirReport`). */
export interface SemanticDirReport {
  readonly kind: "directory";
  readonly root: string;
  readonly glob: string;
  readonly capabilities: SemanticCapabilities;
  readonly files: Readonly<Record<string, SemanticFileReport>>;
  readonly totals: SemanticTotals;
  readonly errors: readonly SemanticDirError[];
}

export type SemanticReport = SemanticFileReport | SemanticDirReport;

/** Error payload the analyzer prints to stderr on failure (`cli.py`). */
export interface SemanticErrorPayload {
  readonly type: string;
  readonly message: string;
  readonly path: string;
}

const ANALYZER_LANGUAGES: readonly AnalyzerLanguage[] = ["ts", "tsx", "py", "go"];

function parseSymbolKind(value: unknown): SemanticSymbol["kind"] {
  if (value === "function" || value === "class" || value === "method") {
    return value;
  }
  throw new ContractViolationError("function|class|method symbol kind", value);
}

export function parseSemanticSymbol(value: unknown): SemanticSymbol {
  if (!isRecord(value)) {
    throw new ContractViolationError("symbol object", value);
  }
  const paramsRaw = value["params"];
  const params = Array.isArray(paramsRaw)
    ? paramsRaw.map((param) => {
        if (typeof param !== "string") {
          throw new ContractViolationError("string param", param);
        }
        return param;
      })
    : [];
  return {
    name: expectString(value, "name"),
    kind: parseSymbolKind(value["kind"]),
    line: expectNumber(value, "line"),
    end: expectNumber(value, "end"),
    params,
  };
}

function parseSemanticCapabilities(value: unknown): SemanticCapabilities {
  if (!isRecord(value)) {
    throw new ContractViolationError("capabilities object", value);
  }
  return { treeSitter: value["tree_sitter"] === true };
}

function parseSemanticImports(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    if (typeof entry !== "string") {
      throw new ContractViolationError("string import", entry);
    }
    return entry;
  });
}

function parseAnalyzerLanguage(value: unknown): AnalyzerLanguage {
  if (typeof value !== "string") {
    throw new ContractViolationError("ts|tsx|py|go language tag", value);
  }
  const found = ANALYZER_LANGUAGES.find((tag) => tag === value);
  if (found === undefined) {
    throw new ContractViolationError("ts|tsx|py|go language tag", value);
  }
  return found;
}

export function parseSemanticFileReport(value: unknown): SemanticFileReport {
  if (!isRecord(value)) {
    throw new ContractViolationError("file report object", value);
  }
  const complexity = value["complexity"];
  if (!isRecord(complexity)) {
    throw new ContractViolationError("complexity object", complexity);
  }
  const symbolsRaw = value["symbols"];
  return {
    kind: "file",
    file: expectString(value, "file"),
    language: parseAnalyzerLanguage(value["language"]),
    symbols: Array.isArray(symbolsRaw) ? symbolsRaw.map(parseSemanticSymbol) : [],
    complexity: {
      maxCyclomatic: Math.trunc(expectNumber(complexity, "max_cyclomatic")),
      avg: expectNumber(complexity, "avg"),
    },
    imports: parseSemanticImports(value["imports"]),
    capabilities: parseSemanticCapabilities(value["capabilities"]),
  };
}

export function isSemanticFilePayload(value: unknown): boolean {
  return isRecord(value) && typeof value["file"] === "string" && value["symbols"] !== undefined;
}

function parseSemanticTotals(value: unknown): SemanticTotals {
  if (!isRecord(value)) {
    throw new ContractViolationError("totals object", value);
  }
  const byLanguageRaw = value["by_language"];
  const byLanguage: Record<string, number> = {};
  if (isRecord(byLanguageRaw)) {
    for (const [key, count] of Object.entries(byLanguageRaw)) {
      if (typeof count === "number") {
        byLanguage[key] = count;
      }
    }
  }
  return {
    files: Math.trunc(expectNumber(value, "files")),
    symbols: Math.trunc(expectNumber(value, "symbols")),
    functions: Math.trunc(expectNumber(value, "functions")),
    methods: Math.trunc(expectNumber(value, "methods")),
    classes: Math.trunc(expectNumber(value, "classes")),
    importsUnique: Math.trunc(expectNumber(value, "imports_unique")),
    chunks: Math.trunc(expectNumber(value, "chunks")),
    maxCyclomatic: Math.trunc(expectNumber(value, "max_cyclomatic")),
    avgCyclomatic: expectNumber(value, "avg_cyclomatic"),
    byLanguage,
    errors: Math.trunc(expectNumber(value, "errors")),
  };
}

export function parseSemanticDirReport(value: unknown): SemanticDirReport {
  if (!isRecord(value)) {
    throw new ContractViolationError("directory report object", value);
  }
  const filesRaw = value["files"];
  const files: Record<string, SemanticFileReport> = {};
  if (isRecord(filesRaw)) {
    for (const [filePath, report] of Object.entries(filesRaw)) {
      files[filePath] = parseSemanticFileReport(report);
    }
  }
  const errorsRaw = value["errors"];
  return {
    kind: "directory",
    root: expectString(value, "root"),
    glob: typeof value["glob"] === "string" ? value["glob"] : "",
    capabilities: parseSemanticCapabilities(value["capabilities"]),
    files,
    totals: parseSemanticTotals(value["totals"]),
    errors: Array.isArray(errorsRaw)
      ? errorsRaw.map((entry) => {
          if (!isRecord(entry)) {
            throw new ContractViolationError("dir error entry", entry);
          }
          return { file: expectString(entry, "file"), error: expectString(entry, "error") };
        })
      : [],
  };
}

/** Parses the analyzer's stderr failure payload; null when not JSON. */
export function parseSemanticErrorPayload(stderrText: string): SemanticErrorPayload | null {
  const trimmed = stderrText.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.split("\n").at(-1)?.trim() ?? trimmed) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed["error"])) {
    return null;
  }
  const error = parsed["error"];
  return {
    type: typeof error["type"] === "string" ? error["type"] : "UnknownError",
    message: typeof error["message"] === "string" ? error["message"] : trimmed.slice(0, 200),
    path: typeof error["path"] === "string" ? error["path"] : "",
  };
}

/* ------------------------------------------------------------------------- */
/* Runtime boundary validation                                               */
/* ------------------------------------------------------------------------- */

export class ContractViolationError extends Error {
  constructor(
    readonly expected: string,
    readonly value: unknown,
  ) {
    super(`contract violation: expected ${expected}, got ${inspect(value)}`);
    this.name = "ContractViolationError";
  }
}

function inspect(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const truncated = text !== undefined && text.length > 120 ? `${text.slice(0, 117)}...` : text ?? "undefined";
  return truncated;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { isRecord };

function expectString(source: Record<string, unknown>, key: string): string {
  const raw = source[key];
  if (typeof raw !== "string") {
    throw new ContractViolationError(`string at "${key}"`, raw);
  }
  return raw;
}

function expectNumber(source: Record<string, unknown>, key: string): number {
  const raw = source[key];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new ContractViolationError(`finite number at "${key}"`, raw);
  }
  return raw;
}

/** Parses one response line of the Rust core into a discriminated union. */
export type CoreResponse =
  | { readonly kind: "validate"; readonly result: QualityGateResult }
  | { readonly kind: "rules"; readonly rules: readonly string[] }
  | { readonly kind: "version"; readonly version: string }
  | { readonly kind: "scan-rationalizations"; readonly result: ScanRationalizationsResult }
  | { readonly kind: "error"; readonly message: string };

export function parseCoreResponse(line: string): CoreResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch (cause) {
    throw new ContractViolationError("JSON object from izanagi-core", `${line} (${String(cause)})`);
  }
  if (!isRecord(parsed)) {
    throw new ContractViolationError("JSON object from izanagi-core", parsed);
  }
  if (parsed["ok"] !== true && parsed["ok"] !== false) {
    throw new ContractViolationError('boolean "ok"', parsed["ok"]);
  }
  if (parsed["ok"] === false) {
    return { kind: "error", message: expectString(parsed, "error") };
  }

  // Success responses carry exactly one payload key depending on the op.
  // The scan-rationalizations branch is checked first because both ops share
  // the `findings` wire key with disjoint element shapes (`clean` only exists
  // on the rationalization report).
  if (typeof parsed["clean"] === "boolean") {
    const findingsRaw = Array.isArray(parsed["findings"]) ? parsed["findings"] : [];
    return {
      kind: "scan-rationalizations",
      result: {
        clean: parsed["clean"],
        findings: findingsRaw.map(parseRationalizationFinding),
      },
    };
  }
  if (typeof parsed["score"] === "number") {
    const findingsRaw = Array.isArray(parsed["findings"]) ? parsed["findings"] : [];
    return {
      kind: "validate",
      result: {
        ok: true,
        score: expectNumber(parsed, "score"),
        findings: findingsRaw.map(parseViolation),
      },
    };
  }
  if (Array.isArray(parsed["rules"])) {
    const rules = parsed["rules"].map((rule) => {
      if (typeof rule !== "string") {
        throw new ContractViolationError("string rule id", rule);
      }
      return rule;
    });
    return { kind: "rules", rules };
  }
  if (typeof parsed["version"] === "string") {
    return { kind: "version", version: parsed["version"] };
  }
  throw new ContractViolationError("score|rules|version|clean payload", parsed);
}

export function parseViolation(value: unknown): Violation {
  if (!isRecord(value)) {
    throw new ContractViolationError("finding object", value);
  }
  const severity = value["severity"];
  if (severity !== "error" && severity !== "warning") {
    throw new ContractViolationError('"error"|"warning" severity', severity);
  }
  return {
    rule: expectString(value, "rule"),
    severity,
    line: expectNumber(value, "line"),
    message: expectString(value, "message"),
  };
}

/** Parses one anti-rationalization finding from the scan report wire shape. */
export function parseRationalizationFinding(value: unknown): RationalizationFinding {
  if (!isRecord(value)) {
    throw new ContractViolationError("rationalization finding object", value);
  }
  const severity = value["severity"];
  const severityMatch = RATIONALIZATION_SEVERITIES.find((candidate) => candidate === severity);
  if (severityMatch === undefined) {
    throw new ContractViolationError('"blocker"|"major"|"minor" severity', severity);
  }
  const category = value["category"];
  const categoryMatch = RATIONALIZATION_CATEGORIES.find((candidate) => candidate === category);
  if (categoryMatch === undefined) {
    throw new ContractViolationError("rationalization category", category);
  }
  return {
    patternId: expectString(value, "pattern_id"),
    category: categoryMatch,
    severity: severityMatch,
    excerpt: expectString(value, "excerpt"),
    line: expectNumber(value, "line"),
  };
}

export function parseSubmitResult(value: unknown): SubmitResult {
  if (!isRecord(value)) {
    throw new ContractViolationError("submit result object", value);
  }
  if (typeof value["accepted"] !== "boolean") {
    throw new ContractViolationError('boolean "accepted"', value["accepted"]);
  }
  return { accepted: value["accepted"], taskId: expectString(value, "taskId") };
}

export function parseCancelResult(value: unknown): CancelResult {
  if (!isRecord(value)) {
    throw new ContractViolationError("cancel result object", value);
  }
  if (typeof value["cancelled"] !== "boolean") {
    throw new ContractViolationError('boolean "cancelled"', value["cancelled"]);
  }
  return { cancelled: value["cancelled"], taskId: expectString(value, "taskId") };
}

const TASK_STATES: readonly TaskState[] = ["queued", "running", "done", "failed"];

export function parseAgentEvent(value: unknown): AgentEvent {
  if (!isRecord(value)) {
    throw new ContractViolationError("event object", value);
  }
  const data = value["data"];
  const base: { taskId: string; type: string; data?: Record<string, unknown>; at: string } = {
    taskId: expectString(value, "taskId"),
    type: expectString(value, "type"),
    at: expectString(value, "at"),
  };
  return data === undefined ? base : { ...base, data: assertDataRecord(data) };
}

function assertDataRecord(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new ContractViolationError("object event data", data);
  }
  return data;
}

export function parseTaskStatus(value: unknown): TaskStatus {
  if (!isRecord(value)) {
    throw new ContractViolationError("status object", value);
  }
  const stateValue = value["state"];
  const state = TASK_STATES.find((candidate) => candidate === stateValue);
  if (state === undefined) {
    throw new ContractViolationError("queued|running|done|failed state", stateValue);
  }
  const eventsRaw = value["events"];
  if (eventsRaw !== undefined && !Array.isArray(eventsRaw)) {
    throw new ContractViolationError('array "events"', eventsRaw);
  }
  const errorValue = value["error"];
  const base = {
    taskId: expectString(value, "taskId"),
    state,
    stage: expectString(value, "stage"),
    events: eventsRaw === undefined ? [] : eventsRaw.map(parseAgentEvent),
  };
  return errorValue === undefined ? base : { ...base, error: expectString(value, "error") };
}

export function parseMcpTool(value: unknown): McpTool {
  if (!isRecord(value)) {
    throw new ContractViolationError("tool object", value);
  }
  const description = value["description"];
  const base = {
    name: expectString(value, "name"),
    inputSchema: value["inputSchema"] ?? null,
  };
  return typeof description === "string" ? { ...base, description } : base;
}

/** Infers the gate language from a file extension; null when unsupported. */
export function inferGateLanguage(filePath: string): GateLanguage | null {
  const lower = filePath.toLowerCase();
  if (/\.(ts|tsx|mts|cts)$/.test(lower)) {
    return "typescript";
  }
  if (lower.endsWith(".py")) {
    return "python";
  }
  if (lower.endsWith(".go")) {
    return "go";
  }
  return null;
}
