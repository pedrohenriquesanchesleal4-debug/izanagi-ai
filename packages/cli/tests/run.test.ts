/**
 * End-to-end tests for the `run` command's phase 4 (quality gates +
 * anti-rationalization gate). The pipeline is exercised through the compiled
 * CLI binary in a sandbox cwd, with IZANAGI_CORE_BIN pointing at a fake NDJSON
 * engine (same pattern as packages/sdk/tests/rust-core.test.ts — a Node script
 * with a shebang, so no cargo build is required). When the REAL izanagi-core
 * binary exists under target/, an integration test additionally runs against
 * it; otherwise the skip reason is logged loudly instead of failing.
 */

import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { resolveCoreBinary } from "../../sdk/src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.join(HERE, "..", "src", "index.js");

/**
 * Fake izanagi-core speaking the real NDJSON contract: `validate` always
 * passes structurally (so refusals come from the rationalization gate alone)
 * and `scan-rationalizations` mirrors the real engine's severity semantics:
 * two `[x]` checkboxes -> blocker; "checklist:" -> major; "nice to have" ->
 * minor. String.raw keeps every backslash literal for the generated JS.
 */
const FAKE_ENGINE_SRC = String.raw`#!/usr/bin/env node
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let request;
  try { request = JSON.parse(line); } catch {
    process.stdout.write(JSON.stringify({ ok: false, error: "invalid request" }) + "\n");
    return;
  }
  if (request.op === "version") {
    process.stdout.write(JSON.stringify({ ok: true, version: "9.9.9-fake" }) + "\n");
  } else if (request.op === "rules") {
    process.stdout.write(JSON.stringify({ ok: true, rules: ["STUB_BODY"] }) + "\n");
  } else if (request.op === "validate") {
    process.stdout.write(JSON.stringify({ ok: true, score: 100, findings: [] }) + "\n");
  } else if (request.op === "scan-rationalizations") {
    const text = String(request.text);
    const lines = text.split("\n");
    const findings = [];
    let checkboxHits = 0;
    lines.forEach((textLine, index) => {
      if (/\[x\]/i.test(textLine)) {
        checkboxHits += 1;
        if (checkboxHits === 2) {
          findings.push({ pattern_id: "ENG-CHECKBOX-DELIVERY", category: "engineering", severity: "blocker", excerpt: textLine.slice(0, 120), line: index + 1 });
        }
      }
      if (/checklist:/i.test(textLine)) {
        findings.push({ pattern_id: "ENG-CHECKLIST-DELIVERY", category: "engineering", severity: "major", excerpt: textLine.slice(0, 120), line: index + 1 });
      }
      if (/nice to have/i.test(textLine)) {
        findings.push({ pattern_id: "DESIGN-NICE-TO-HAVE", category: "design", severity: "minor", excerpt: textLine.slice(0, 120), line: index + 1 });
      }
    });
    process.stdout.write(JSON.stringify({ ok: true, clean: findings.length === 0, findings }) + "\n");
  } else {
    process.stdout.write(JSON.stringify({ ok: false, error: "unknown op" }) + "\n");
  }
});
`;

interface CliRunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function runCli(args: readonly string[], env: Readonly<Record<string, string>>, cwd: string): Promise<CliRunResult> {
  return new Promise<CliRunResult>((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}

async function writeExecutable(directory: string, name: string, source: string): Promise<string> {
  const filePath = path.join(directory, name);
  await writeFile(filePath, source, { mode: 0o755 });
  await chmod(filePath, 0o755);
  return filePath;
}

describe("run phase 4 anti-rationalization gate (fake engine)", () => {
  let sandbox: string;
  let enginePath: string;

  beforeEach(async () => {
    sandbox = await mkdtemp(path.join(tmpdir(), "izanagi-run-"));
    enginePath = await writeExecutable(sandbox, "fake-izanagi-core", FAKE_ENGINE_SRC);
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true }).catch(() => undefined);
  });

  async function writePayload(fileName: string, content: string): Promise<string> {
    const payloadPath = path.join(sandbox, fileName);
    await writeFile(payloadPath, content, "utf8");
    return payloadPath;
  }

  it("refuses the run on a blocker finding, auto-heals up to N=2, then exits 1 with a violation report", async () => {
    const artifact = await writePayload(
      "delivery.ts",
      "export function sum(a: number, b: number): number {\n  // [x] parse inputs\n  // [x] add numbers\n  return a + b;\n}\n",
    );

    const result = await runCli(
      [
        "run",
        "--agent=senior-engineer",
        "--task=deliver sum()",
        `--files=${artifact}`,
        "--max-heal-attempts=2",
        "--standalone",
      ],
      { IZANAGI_CORE_BIN: enginePath },
      sandbox,
    );

    assert.equal(result.code, 1, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stdout, /REFUSED/);
    assert.match(result.stdout, /ENG-CHECKBOX-DELIVERY/);
    assert.match(result.stderr, /run failed: critical violations persisted after 3 gate round\(s\)/);

    // Auto-heal actually re-submitted: original + r1 + r2 task directories.
    const tasksDir = path.join(sandbox, ".izanagi", "tasks");
    const taskDirs = (await readdir(tasksDir)).sort();
    assert.ok(taskDirs.length >= 3, `expected original + 2 heal submissions, got ${taskDirs.join(", ")}`);
    assert.ok(taskDirs.some((entry) => /-r1$/.test(entry)), "missing -r1 heal submission");
    assert.ok(taskDirs.some((entry) => /-r2$/.test(entry)), "missing -r2 heal submission");

    // The persisted violation report carries the anti-rationalization section.
    const lastTaskDir = path.join(tasksDir, taskDirs[taskDirs.length - 1] ?? "");
    const violationsMd = await readFile(path.join(lastTaskDir, "violations.md"), "utf8");
    assert.match(violationsMd, /Anti-rationalization findings/);
    assert.match(violationsMd, /\[blocker\/ENG-CHECKBOX-DELIVERY\]/);
  });

  it("annotates major and minor findings without blocking delivery (exit 0)", async () => {
    const artifact = await writePayload(
      "delivery.ts",
      "export function mul(a: number, b: number): number {\n  // checklist: multiply inputs\n  // nice to have: overflow guard\n  return a * b;\n}\n",
    );

    const result = await runCli(
      [
        "run",
        "--agent=senior-engineer",
        "--task=deliver mul()",
        `--files=${artifact}`,
        "--standalone",
      ],
      { IZANAGI_CORE_BIN: enginePath },
      sandbox,
    );

    assert.equal(result.code, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /REFUSED/);
    assert.match(result.stdout, /\[4\/4\] anti-rationalization: 2 note\(s\) \(blocker=0, major=1, minor=1\)/);

    const tasksDir = path.join(sandbox, ".izanagi", "tasks");
    const taskDirs = await readdir(tasksDir);
    const receipt = JSON.parse(await readFile(path.join(tasksDir, taskDirs[0] ?? "", "result.json"), "utf8")) as {
      attempts: number;
      qualityGate: { status: string };
      rationalizations: {
        status: string;
        counts: { blocker: number; major: number; minor: number };
        findings: ReadonlyArray<{ pattern_id: string; severity: string; file: string }>;
      };
    };
    assert.equal(receipt.attempts, 1);
    assert.equal(receipt.qualityGate.status, "passed");
    assert.equal(receipt.rationalizations.status, "passed");
    assert.deepEqual(receipt.rationalizations.counts, { blocker: 0, major: 1, minor: 1 });
    assert.equal(receipt.rationalizations.findings.length, 2);
    assert.ok(receipt.rationalizations.findings.every((finding) => finding.file.endsWith("delivery.ts")));
  });

  it("passes clean artifacts with an explicit empty-scan line and empty receipt findings", async () => {
    const artifact = await writePayload(
      "clean.ts",
      "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
    );

    const result = await runCli(
      [
        "run",
        "--agent=senior-engineer",
        "--task=deliver add()",
        `--files=${artifact}`,
        "--standalone",
      ],
      { IZANAGI_CORE_BIN: enginePath },
      sandbox,
    );

    assert.equal(result.code, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stdout, /\[4\/4\] anti-rationalization: clean \(0 findings across 1 file\(s\)\)/);

    const tasksDir = path.join(sandbox, ".izanagi", "tasks");
    const taskDirs = await readdir(tasksDir);
    const receipt = JSON.parse(await readFile(path.join(tasksDir, taskDirs[0] ?? "", "result.json"), "utf8")) as {
      rationalizations: { status: string; findings: unknown[] };
    };
    assert.equal(receipt.rationalizations.status, "passed");
    assert.deepEqual(receipt.rationalizations.findings, []);
  });

  it("skips both gates with loud warnings when the rust-core binary is unavailable, still exiting 0", async () => {
    const artifact = await writePayload(
      "clean.ts",
      "export function sub(a: number, b: number): number {\n  return a - b;\n}\n",
    );
    const missingBinary = path.join(sandbox, "no-such-core");

    const result = await runCli(
      [
        "run",
        "--agent=senior-engineer",
        "--task=deliver sub()",
        `--files=${artifact}`,
        "--standalone",
      ],
      { IZANAGI_CORE_BIN: missingBinary },
      sandbox,
    );

    assert.equal(result.code, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stdout, /\[4\/4\] quality gates: SKIPPED \(rust core unavailable\)/);
    assert.match(result.stderr, /warn: quality gates skipped: .*unavailable/);
    assert.match(result.stderr, /warn: anti-rationalization gate skipped: .*unavailable/);

    const tasksDir = path.join(sandbox, ".izanagi", "tasks");
    const taskDirs = await readdir(tasksDir);
    const receipt = JSON.parse(await readFile(path.join(tasksDir, taskDirs[0] ?? "", "result.json"), "utf8")) as {
      qualityGate: { status: string; reason: string };
      rationalizations: { status: string; reason: string };
    };
    assert.equal(receipt.qualityGate.status, "skipped");
    assert.equal(receipt.rationalizations.status, "skipped");
    assert.ok(receipt.rationalizations.reason.length > 0);
  });
});

describe("run phase 4 anti-rationalization gate (real compiled engine)", () => {
  it("blocks on a real [x]-checkbox blocker and passes a clean file when target/ has the binary", async () => {
    let realBinary: string | null = null;
    try {
      realBinary = await resolveCoreBinary();
    } catch (reason) {
      console.log(
        `[skip] real izanagi-core integration test: binary not found (${String(reason)}). ` +
          "Build with `cargo build -p izanagi_core` to enable.",
      );
    }

    if (realBinary === null) {
      assert.ok(true, "skip path exercised; reason logged above");
      return;
    }
    console.log(`[info] running real izanagi-core integration test against ${realBinary}`);

    const sandbox = await mkdtemp(path.join(tmpdir(), "izanagi-run-real-"));
    try {
      const blocked = path.join(sandbox, "blocked.ts");
      await writeFile(
        blocked,
        "export function sum(a: number, b: number): number {\n  // [x] step one\n  // [x] step two\n  return a + b;\n}\n",
        "utf8",
      );

      const refused = await runCli(
        ["run", "--agent=senior-engineer", "--task=deliver", `--files=${blocked}`, "--max-heal-attempts=0", "--standalone"],
        { IZANAGI_CORE_BIN: realBinary },
        sandbox,
      );
      assert.equal(refused.code, 1, `stdout:\n${refused.stdout}\nstderr:\n${refused.stderr}`);
      assert.match(refused.stdout, /ENG-CHECKBOX-DELIVERY/);

      const clean = path.join(sandbox, "clean.ts");
      await writeFile(clean, "export function add(a: number, b: number): number {\n  return a + b;\n}\n", "utf8");

      const passed = await runCli(
        ["run", "--agent=senior-engineer", "--task=deliver", `--files=${clean}`, "--standalone"],
        { IZANAGI_CORE_BIN: realBinary },
        sandbox,
      );
      assert.equal(passed.code, 0, `stdout:\n${passed.stdout}\nstderr:\n${passed.stderr}`);
      assert.match(passed.stdout, /\[4\/4\] anti-rationalization: clean \(0 findings across 1 file\(s\)\)/);
    } finally {
      await rm(sandbox, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
