/**
 * Tests for `izanagi-next skill show`: progressive disclosure over the v2
 * skill catalog. The compiled CLI binary is spawned in a sandbox cwd whose
 * `.skills/` tree is generated per-test (same pattern as run.test.ts):
 * front-matter summary output, declared-references field vs directory-scan
 * fallback, confined --ref reads, and refusal of path traversal.
 */

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.join(HERE, "..", "src", "index.js");

interface CliRunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function runCli(args: readonly string[], cwd: string): Promise<CliRunResult> {
  return new Promise<CliRunResult>((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      cwd,
      env: { ...process.env },
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

/** Front-matter WITH a declared references field that deliberately diverges
 * from disk (field says api-examples.md; disk only has references.md) so the
 * test proves the field wins over the directory scan. */
const DECLARED_SKILL_MD = `---
name: demo-skill
description: "Skill com campo references declarado no front-matter."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
references:
  - "api-examples.md"
---

# Demo Skill

Body.
`;

/** Front-matter WITHOUT the references field: CLI must fall back to scanning. */
const SCAN_SKILL_MD = `---
name: scan-skill
description: "Skill sem campo references; fallback por scan do diretório."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
---

# Scan Skill

Body.
`;

describe("skill show (progressive disclosure)", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await mkdtemp(path.join(tmpdir(), "izanagi-skill-show-"));
    await writeFile(path.join(sandbox, "package.json"), "{}\n", "utf8");
    await mkdir(path.join(sandbox, "crates"), { recursive: true });

    const demoDir = path.join(sandbox, ".skills", "demo-skill", "references");
    const scanDir = path.join(sandbox, ".skills", "scan-skill", "references");
    await mkdir(demoDir, { recursive: true });
    await mkdir(scanDir, { recursive: true });

    await writeFile(path.join(sandbox, ".skills", "demo-skill", "SKILL.md"), DECLARED_SKILL_MD, "utf8");
    // On-disk reference diverges on purpose: only references.md exists here,
    // while the declared field lists api-examples.md.
    await writeFile(
      path.join(demoDir, "references.md"),
      "REFERENCE-CONTENT-MARKER-1234\nlegacy copy body\n",
      "utf8",
    );

    await writeFile(path.join(sandbox, ".skills", "scan-skill", "SKILL.md"), SCAN_SKILL_MD, "utf8");
    await writeFile(path.join(scanDir, "extra-notes.md"), "extra notes body\n", "utf8");
    await writeFile(path.join(scanDir, "references.md"), "scan legacy body\n", "utf8");
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true }).catch(() => undefined);
  });

  it("lists declared references from the front-matter field, taking precedence over the directory scan", async () => {
    const result = await runCli(["skill", "show", "demo-skill"], sandbox);

    assert.equal(result.code, 0, `stderr:\n${result.stderr}`);
    assert.match(result.stdout, /name:\s+demo-skill/);
    assert.match(result.stdout, /version:\s+2\.0\.0/);
    assert.match(result.stdout, /category:\s+design/);
    assert.match(result.stdout, /references \(1, source: front-matter\):/);
    assert.match(result.stdout, /- api-examples\.md/);
    assert.doesNotMatch(result.stdout, /references\.md/);
  });

  it("falls back to a sorted directory scan when the front-matter declares no references field", async () => {
    const result = await runCli(["skill", "show", "scan-skill"], sandbox);

    assert.equal(result.code, 0, `stderr:\n${result.stderr}`);
    assert.match(result.stdout, /references \(2, source: directory-scan\):/);
    assert.ok(
      result.stdout.indexOf("extra-notes.md") < result.stdout.indexOf("references.md"),
      "expected sorted listing (extra-notes.md before references.md)",
    );
  });

  it("reads a reference's content via --ref when the path stays inside references/", async () => {
    const result = await runCli(["skill", "show", "demo-skill", "--ref=references.md"], sandbox);

    assert.equal(result.code, 0, `stderr:\n${result.stderr}`);
    assert.match(result.stdout, /REFERENCE-CONTENT-MARKER-1234/);
    assert.match(result.stdout, /legacy copy body/);
  });

  it("refuses ../ path traversal with exit 2 without leaking outside content", async () => {
    const secretPath = path.join(sandbox, "secret.txt");
    await writeFile(secretPath, "TOP-SECRET-OUTSIDE\n", "utf8");

    const result = await runCli(["skill", "show", "demo-skill", "--ref=../../secret.txt"], sandbox);

    assert.equal(result.code, 2, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stderr, /usage error: invalid --ref/);
    assert.doesNotMatch(result.stdout, /TOP-SECRET-OUTSIDE/);
  });

  it("refuses nested traversal and absolute paths alike", async () => {
    const nested = await runCli(
      ["skill", "show", "demo-skill", "--ref=sub/../../../escape.txt"],
      sandbox,
    );
    assert.equal(nested.code, 2, `stdout:\n${nested.stdout}\nstderr:\n${nested.stderr}`);
    assert.match(nested.stderr, /invalid --ref/);

    const absolute = await runCli(
      ["skill", "show", "demo-skill", "--ref=/etc/passwd"],
      sandbox,
    );
    assert.equal(absolute.code, 2, `stdout:\n${absolute.stdout}\nstderr:\n${absolute.stderr}`);
    assert.match(absolute.stderr, /invalid --ref/);
  });

  it("exits 2 for an unknown skill name", async () => {
    const result = await runCli(["skill", "show", "no-such-skill"], sandbox);

    assert.equal(result.code, 2, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stderr, /unknown skill "no-such-skill"/);
  });

  it("exits 2 when the requested reference file does not exist inside references/", async () => {
    const result = await runCli(["skill", "show", "demo-skill", "--ref=missing.md"], sandbox);

    assert.equal(result.code, 2, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stderr, /reference "missing\.md" not found/);
  });

  it("keeps `skill list` light and rejects unknown subcommands (exit 2)", async () => {
    const list = await runCli(["skill", "list"], sandbox);
    assert.equal(list.code, 0, `stderr:\n${list.stderr}`);
    assert.match(list.stdout, /demo-skill/);
    assert.match(list.stdout, /scan-skill/);

    const bogus = await runCli(["skill", "frobnicate"], sandbox);
    assert.equal(bogus.code, 2);
    assert.match(bogus.stderr, /usage error: usage: izanagi-next skill/);

    const missingName = await runCli(["skill", "show"], sandbox);
    assert.equal(missingName.code, 2);
    assert.match(missingName.stderr, /usage: izanagi-next skill show <name>/);
  });
});
