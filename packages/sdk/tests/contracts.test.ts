/**
 * Contract-layer verification: wire-shape parsing, branded ids, language
 * inference and front-matter parsing. Type-level correctness is proven by
 * `tsc --strict` itself; these tests pin down the runtime guards.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ContractViolationError,
  InvalidTaskIdError,
  type TaskStatus,
  TASK_ID_PATTERN,
  inferGateLanguage,
  makeTaskId,
  parseAgentEvent,
  parseCancelResult,
  parseCoreResponse,
  parseMcpTool,
  parseSemanticDirReport,
  parseSemanticFileReport,
  parseSemanticErrorPayload,
  parseSubmitResult,
  parseTaskStatus,
  parseViolation,
  splitFrontMatter,
} from "../src/index.js";

describe("makeTaskId", () => {
  it("accepts identifiers matching the Go orchestrator pattern", () => {
    assert.equal(makeTaskId("task-01"), "task-01");
    assert.equal(makeTaskId("A" + "b.c_d-9"), "Ab.c_d-9");
  });

  it("rejects path traversal and oversized ids", () => {
    assert.throws(() => makeTaskId("../etc/passwd"), InvalidTaskIdError);
    assert.throws(() => makeTaskId(""), InvalidTaskIdError);
    assert.throws(() => makeTaskId("-starts-with-dash"), InvalidTaskIdError);
    assert.throws(() => makeTaskId("x".repeat(65)), InvalidTaskIdError);
  });

  it("mirrors the domain.go regex exactly", () => {
    assert.equal(TASK_ID_PATTERN.source, "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$");
  });
});

describe("parseCoreResponse", () => {
  it("parses a validate success envelope", () => {
    const response = parseCoreResponse(
      '{"ok":true,"score":85,"findings":[{"rule":"STUB_BODY","severity":"error","line":1,"message":"stub"}]}',
    );
    assert.deepEqual(response, {
      kind: "validate",
      result: {
        ok: true,
        score: 85,
        findings: [{ rule: "STUB_BODY", severity: "error", line: 1, message: "stub" }],
      },
    });
  });

  it("parses rules and version envelopes", () => {
    assert.deepEqual(parseCoreResponse('{"ok":true,"rules":["A","B"]}'), {
      kind: "rules",
      rules: ["A", "B"],
    });
    assert.deepEqual(parseCoreResponse('{"ok":true,"version":"0.1.0"}'), {
      kind: "version",
      version: "0.1.0",
    });
  });

  it("parses structured errors and rejects garbage", () => {
    assert.deepEqual(parseCoreResponse('{"ok":false,"error":"boom"}'), {
      kind: "error",
      message: "boom",
    });
    assert.throws(() => parseCoreResponse("{not json"), ContractViolationError);
    assert.throws(() => parseCoreResponse('{"ok":"yes"}'), ContractViolationError);
    assert.throws(() => parseCoreResponse('{"ok":true}'), ContractViolationError);
  });
});

describe("parseViolation", () => {
  it("rejects unknown severities", () => {
    assert.throws(() => parseViolation({ rule: "X", severity: "fatal", line: 1, message: "" }));
    assert.deepEqual(parseViolation({ rule: "X", severity: "warning", line: 3, message: "m" }), {
      rule: "X",
      severity: "warning",
      line: 3,
      message: "m",
    });
  });
});

describe("orchestrator payload parsers", () => {
  it("parses submit/cancel results strictly", () => {
    assert.deepEqual(parseSubmitResult({ accepted: true, taskId: "t1" }), {
      accepted: true,
      taskId: "t1",
    });
    assert.throws(() => parseSubmitResult({ accepted: "yes", taskId: "t1" }));
    assert.deepEqual(parseCancelResult({ cancelled: false, taskId: "t1" }), {
      cancelled: false,
      taskId: "t1",
    });
  });

  it("parses status with events and optional error omitted/present", () => {
    const withoutError: unknown = {
      taskId: "t1",
      state: "running",
      stage: "architect",
      events: [{ taskId: "t1", type: "stage.started", data: { index: 0 }, at: "2026-08-22T00:00:00Z" }],
    };
    const parsed = parseTaskStatus(withoutError);
    assert.equal(parsed.state, "running");
    assert.equal(parsed.events.length, 1);
    assert.equal(parsed.events[0]?.data?.["index"], 0);

    const withError: unknown = { taskId: "t2", state: "failed", stage: "qa", error: "gate refused", events: [] };
    const failed = parseTaskStatus(withError);
    assert.equal(failed.error, "gate refused");
    assert.equal(failed.events.length, 0);

    assert.throws(() => parseTaskStatus({ taskId: "t", state: "paused", stage: "", events: [] }));

    const typed: TaskStatus = parsed;
    assert.equal(typeof typed.taskId, "string");
  });

  it("parses agent events leniently for push frames", () => {
    const event = parseAgentEvent({ taskId: "t", type: "task.submitted", at: "2026-08-22T00:00:00Z" });
    assert.equal(event.type, "task.submitted");
    assert.equal(event.data, undefined);
  });
});

describe("parseMcpTool", () => {
  it("keeps schema verbatim and description optional", () => {
    const tool = parseMcpTool({ name: "fs_write", description: "writes", inputSchema: { type: "object" } });
    assert.equal(tool.name, "fs_write");
    assert.deepEqual(tool.inputSchema, { type: "object" });
    const minimal = parseMcpTool({ name: "bare" });
    assert.equal(minimal.description, undefined);
    assert.throws(() => parseMcpTool({ nope: true }));
  });
});

describe("semantic report parsers", () => {
  it("maps snake_case file reports to camelCase", () => {
    const report = parseSemanticFileReport({
      file: "/tmp/x.py",
      language: "py",
      symbols: [{ name: "run", kind: "function", line: 1, end: 4, params: ["a"] }],
      complexity: { max_cyclomatic: 3, avg: 2.5 },
      imports: ["os"],
      capabilities: { tree_sitter: true },
    });
    assert.equal(report.complexity.maxCyclomatic, 3);
    assert.equal(report.complexity.avg, 2.5);
    assert.equal(report.capabilities.treeSitter, true);
    assert.deepEqual(report.symbols[0]?.params, ["a"]);
  });

  it("parses directory reports including totals", () => {
    const report = parseSemanticDirReport({
      root: "/tmp",
      glob: "**/*.py",
      capabilities: { tree_sitter: false },
      files: {},
      totals: {
        files: 2,
        symbols: 5,
        functions: 4,
        methods: 1,
        classes: 0,
        imports_unique: 3,
        chunks: 7,
        max_cyclomatic: 6,
        avg_cyclomatic: 2.25,
        by_language: { py: 2 },
        errors: 0,
      },
      errors: [],
    });
    assert.equal(report.kind, "directory");
    assert.equal(report.totals.importsUnique, 3);
    assert.equal(report.totals.byLanguage["py"], 2);
  });

  it("extracts the analyzer stderr error payload", () => {
    const payload = parseSemanticErrorPayload(
      '{"ok": false, "error": {"type": "FileReadError", "message": "gone", "path": "/x"}}\n',
    );
    assert.equal(payload?.type, "FileReadError");
    assert.equal(payload?.message, "gone");
    assert.equal(parseSemanticErrorPayload("Traceback (most recent call last):"), null);
  });
});

describe("inferGateLanguage", () => {
  it("maps extensions to engine languages", () => {
    assert.equal(inferGateLanguage("/a/b.ts"), "typescript");
    assert.equal(inferGateLanguage("/a/b.TSX"), "typescript");
    assert.equal(inferGateLanguage("x.py"), "python");
    assert.equal(inferGateLanguage("x.go"), "go");
    assert.equal(inferGateLanguage("x.rs"), null);
    assert.equal(inferGateLanguage("x.md"), null);
  });
});

describe("splitFrontMatter", () => {
  it("splits v2 documents and parses nested tools.mcp lists", () => {
    const document = [
      "---",
      'name: "quoted-skill"',
      "description: A skill with: colons and \"escapes\"",
      "version: 2.0.0",
      "category: testing",
      "tools:",
      "  mcp:",
      "    - filesystem",
      "    - github",
      "---",
      "",
      "# Body starts here",
    ].join("\n");

    const parsed = splitFrontMatter(document);
    assert.notEqual(parsed, null);
    assert.equal(parsed?.data["name"], "quoted-skill");
    assert.equal(parsed?.data["category"], "testing");
    assert.deepEqual(parsed?.data["tools"], { mcp: ["filesystem", "github"] });
    assert.match(parsed?.body ?? "", /^# Body starts here/);
  });

  it("supports legacy two-key front-matter and inline arrays", () => {
    const parsed = splitFrontMatter("---\nname: tdd\ndescription: short\n---\nbody");
    assert.equal(parsed?.data["name"], "tdd");
    const arrayed = splitFrontMatter("---\nname: x\ndescription: y\ntags: [a, b]\n---\nB");
    assert.deepEqual(arrayed?.data["tags"], ["a", "b"]);
  });

  it("returns null when there is no front-matter", () => {
    assert.equal(splitFrontMatter("# Just markdown"), null);
    assert.equal(splitFrontMatter("---\nno closing delimiter\n"), null);
  });
});
