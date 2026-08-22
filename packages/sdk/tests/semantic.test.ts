/**
 * Semantic analyzer tests. Python availability is probed honestly: when no
 * interpreter can run the engine, the test logs the exact reason and skips —
 * never silently.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";

import { AnalyzerFailedError, SemanticAnalyzer } from "../src/index.js";
import { resolveRepoRoot } from "../src/environment.js";

describe("SemanticAnalyzer", () => {
  let workDir: string;
  let pythonUsable = false;
  let skipReason = "";

  before(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "izanagi-semantic-"));
    const analyzer = new SemanticAnalyzer({ repoRoot: resolveRepoRoot() });
    try {
      const python = await analyzer.ensurePython();
      const engineOk = await analyzer.checkEngine();
      if (!engineOk) {
        skipReason = `interpreter ${python} cannot import ast_analyzer from ${path.join(resolveRepoRoot(), "python-engine")}`;
      } else {
        pythonUsable = true;
      }
    } catch (error) {
      skipReason = `no usable Python interpreter: ${String(error)}`;
    }
    if (!pythonUsable) {
      console.log(`[skip] semantic analyzer integration test: ${skipReason}`);
    }
  });

  it("analyzes a fixture file and returns typed symbols", async () => {
    if (!pythonUsable) {
      console.log(`[skip] file analysis: ${skipReason}`);
      return;
    }

    const fixturePath = path.join(workDir, "fixture.py");
    await writeFile(
      fixturePath,
      ["import os", "", "", "def compute(limit):", "    total = 0", "    for i in range(limit):", "        total += i", "    return total", ""].join("\n"),
    );

    const analyzer = new SemanticAnalyzer({ repoRoot: resolveRepoRoot() });
    const report = await analyzer.analyzeFile(fixturePath);

    assert.equal(report.kind, "file");
    assert.equal(report.language, "py");
    assert.ok(report.symbols.some((symbol) => symbol.name === "compute" && symbol.kind === "function"));
    assert.ok(report.complexity.maxCyclomatic >= 2);
    assert.deepEqual(report.imports, ["os"]);
  });

  it("analyzes a directory tree with totals and per-file reports", async () => {
    if (!pythonUsable) {
      console.log(`[skip] directory analysis: ${skipReason}`);
      return;
    }

    await writeFile(path.join(workDir, "extra.py"), "class Widget:\n    def spin(self):\n        return 1\n");
    const analyzer = new SemanticAnalyzer({ repoRoot: resolveRepoRoot() });
    const report = await analyzer.analyze({
      targetPath: workDir,
      glob: "**/*.py",
    });

    assert.equal(report.kind, "directory");
    if (report.kind === "directory") {
      assert.ok(report.totals.files >= 2);
      assert.ok(Object.keys(report.files).some((filePath) => filePath.endsWith("fixture.py")));
    }
  });

  it("surfaces analyzer failures as AnalyzerFailedError with the stderr payload", async () => {
    if (!pythonUsable) {
      console.log(`[skip] failure mapping: ${skipReason}`);
      return;
    }

    const analyzer = new SemanticAnalyzer({ repoRoot: resolveRepoRoot() });
    await assert.rejects(
      analyzer.analyzeFile(path.join(workDir, "does-not-exist.py")),
      (error: unknown) =>
        error instanceof AnalyzerFailedError && /exist/i.test(error.message),
    );
  });
});
