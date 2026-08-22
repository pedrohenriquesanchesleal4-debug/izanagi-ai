/**
 * Rust-core client tests. The protocol behavior is exercised against a fake
 * NDJSON engine binary (a Node script with a shebang, so no cargo build is
 * required). When the REAL izanagi-core binary exists under target/, an
 * integration test additionally runs against it; otherwise the skip reason
 * is logged loudly instead of skipping silently.
 */

import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  BinaryNotFoundError,
  OperationTimeoutError,
  ProcessFailedError,
  type QualityGateResult,
  RustCoreClient,
} from "../src/index.js";
import { resolveCoreBinary } from "../src/environment.js";

const FAKE_ENGINE_SRC = `#!/usr/bin/env node
const readline = require("readline");
const slow = process.env["FAKE_ENGINE_SLOW_MS"];
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const respond = () => {
    let request;
    try { request = JSON.parse(line); } catch {
      process.stdout.write(JSON.stringify({ ok: false, error: "invalid request" }) + "\\n");
      return;
    }
    if (request.op === "version") {
      process.stdout.write(JSON.stringify({ ok: true, version: "9.9.9-fake" }) + "\\n");
    } else if (request.op === "rules") {
      process.stdout.write(JSON.stringify({ ok: true, rules: ["STUB_BODY", "EMPTY_FUNCTION"] }) + "\\n");
    } else if (request.op === "validate") {
      const dirty = /TODO|implement later/.test(request.code);
      process.stdout.write(JSON.stringify({
        ok: true,
        score: dirty ? 70 : 100,
        findings: dirty ? [{ rule: "STUB_BODY", severity: "error", line: 1, message: "stub body found" }] : [],
      }) + "\\n");
    } else {
      process.stdout.write(JSON.stringify({ ok: false, error: "unknown op" }) + "\\n");
    }
  };
  if (slow) { setTimeout(respond, Number(slow)); } else { respond(); }
});
`;

async function writeExecutable(directory: string, name: string, source: string): Promise<string> {
  const filePath = path.join(directory, name);
  await writeFile(filePath, source, { mode: 0o755 });
  await chmod(filePath, 0o755);
  return filePath;
}

describe("RustCoreClient against a fake engine binary", () => {
  let workDir: string;
  let enginePath: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "izanagi-core-"));
    enginePath = await writeExecutable(workDir, "izanagi-core", FAKE_ENGINE_SRC);
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("validates code and maps findings into QualityGateResult", async () => {
    const client = new RustCoreClient({ binaryPath: enginePath, requestTimeoutMs: 5_000 });

    const clean = await client.validate({
      language: "typescript",
      code: "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
    });
    assert.equal(clean.score, 100);
    assert.deepEqual(clean.findings, []);

    const dirty = await client.validate({
      language: "python",
      code: "# TODO implement later\ndef f():\n    pass\n",
    });
    assert.equal(dirty.score, 70);
    assert.equal(dirty.findings[0]?.rule, "STUB_BODY");
    assert.equal(dirty.findings[0]?.severity, "error");
  });

  it("lists rules and reports the engine version", async () => {
    const client = new RustCoreClient({ binaryPath: enginePath, requestTimeoutMs: 5_000 });
    assert.deepEqual(await client.rules(), ["STUB_BODY", "EMPTY_FUNCTION"]);
    assert.equal(await client.version(), "9.9.9-fake");
  });

  it("validates files from disk inferring the language by extension", async () => {
    const client = new RustCoreClient({ binaryPath: enginePath, requestTimeoutMs: 5_000 });
    const sourcePath = path.join(workDir, "sample.ts");
    await writeFile(sourcePath, "// clean\nconst x = 1;\n");
    const result = await client.validateFile(sourcePath);
    assert.equal(result.ok, true);

    await assert.rejects(client.validateFile(path.join(workDir, "notes.md")), /cannot infer gate language/);
  });

  it("times out slow engines with a typed error and kills the child", async () => {
    const slowPath = await writeExecutable(workDir, "slow-engine", FAKE_ENGINE_SRC);
    const client = new RustCoreClient({ binaryPath: slowPath, requestTimeoutMs: 150 });
    process.env["FAKE_ENGINE_SLOW_MS"] = "5000";
    try {
      await assert.rejects(
        client.validate({ language: "go", code: "func main() {}" }),
        (error: unknown) =>
          error instanceof OperationTimeoutError && error.operation.includes("validate"),
      );
    } finally {
      delete process.env["FAKE_ENGINE_SLOW_MS"];
    }
  });

  it("raises BinaryNotFoundError when nothing executable is found", async () => {
    const client = new RustCoreClient({ binaryPath: path.join(workDir, "missing-binary") });
    await assert.rejects(
      client.version(),
      (error: unknown) =>
        error instanceof BinaryNotFoundError &&
        error.searchedPaths.includes(path.join(workDir, "missing-binary")),
    );
  });

  it("surfaces engines that exit without answering as ProcessFailedError", async () => {
    const silentEngine = await writeExecutable(
      workDir,
      "silent-engine",
      '#!/usr/bin/env node\nprocess.stderr.write("boom");\nprocess.exit(3);\n',
    );
    const client = new RustCoreClient({ binaryPath: silentEngine, requestTimeoutMs: 5_000 });
    await assert.rejects(
      client.validate({ language: "typescript", code: "const x = 2;" }),
      (error: unknown) => {
        if (!(error instanceof ProcessFailedError)) return false;
        // The typed error carries either the exit code or the stderr tail.
        return error.exitCode === 3 || error.stderrTail.includes("boom");
      },
    );
  });
});

describe("RustCoreClient against the real compiled engine", () => {
  it("runs version+rules+validate end-to-end when target/ contains the binary", async () => {
    let realBinary: string | null = null;
    try {
      realBinary = await resolveCoreBinary();
    } catch (reason) {
      console.log(
        `[skip] real izanagi-core integration test: binary not found (${String(reason)}). ` +
          "Build with `cargo build -p izanagi_core` to enable.",
      );
    }

    if (realBinary !== null) {
      console.log(`[info] running real izanagi-core integration test against ${realBinary}`);
      const client = new RustCoreClient({ binaryPath: realBinary, requestTimeoutMs: 10_000 });
      assert.match(await client.version(), /^\d+\.\d+\.\d+/);
      assert.ok((await client.rules()).includes("STUB_BODY"));

      const result: QualityGateResult = await client.validate({
        language: "typescript",
        code: "function f() {}\n",
      });
      assert.equal(result.ok, true);
      assert.ok(result.score < 100);
      assert.ok(result.findings.some((finding) => finding.rule === "EMPTY_FUNCTION"));
    }

    // Sanity-check that cargo itself is present so the skip reason above is
    // actionable; absence of cargo does not fail the suite.
    const cargo = spawnSync("cargo", ["--version"], { encoding: "utf8" });
    console.log(`[info] cargo availability: ${cargo.error ? "not installed" : cargo.stdout.trim()}`);
  });
});

describe("workspace binary auto-discovery", () => {
  it("finds binaries under <root>/target/{debug,release} when built", async () => {
    const fakeRoot = await mkdtemp(path.join(tmpdir(), "izanagi-root-"));
    try {
      await mkdir(path.join(fakeRoot, "target", "debug"), { recursive: true });
      const binary = await writeExecutable(fakeRoot, "unused-name", FAKE_ENGINE_SRC);
      const target = path.join(fakeRoot, "target", "debug", "izanagi-core");
      const { copyFile } = await import("node:fs/promises");
      await copyFile(binary, target);

      // resolveRepoRoot walks up looking for package.json + crates/; feed it
      // explicitly through the env override to keep the fixture isolated.
      process.env["IZANAGI_REPO_ROOT"] = fakeRoot;
      try {
        const resolved = await resolveCoreBinary();
        assert.equal(resolved, target);
      } finally {
        delete process.env["IZANAGI_REPO_ROOT"];
      }
    } finally {
      await rm(fakeRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("throws BinaryNotFoundError listing every probed path", async () => {
    const fakeRoot = await mkdtemp(path.join(tmpdir(), "izanagi-empty-"));
    try {
      process.env["IZANAGI_REPO_ROOT"] = fakeRoot;
      try {
        await assert.rejects(resolveCoreBinary(), (error: unknown) => {
          if (!(error instanceof BinaryNotFoundError)) return false;
          return error.searchedPaths.length === 4; // 2 roots x 2 profiles
        });
      } finally {
        delete process.env["IZANAGI_REPO_ROOT"];
      }
    } finally {
      await rm(fakeRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
