/**
 * `izanagi-next gates check <file>`: runs the Rust quality gate on one file
 * and exits non-zero when any error-severity violation is found.
 */

import { access, constants } from "node:fs/promises";
import path from "node:path";

import type { QualityGateResult } from "../../../sdk/src/index.ts";
import { EXIT_FAILURE, EXIT_OK, type CommandContext } from "../context.js";

import { out } from "../console.js";

export interface GatesCheckOptions {
  readonly file: string;
}

function renderGateResult(filePath: string, result: QualityGateResult): string {
  const lines = [
    `file:   ${filePath}`,
    `score:  ${result.score}/100`,
    `status: ${result.findings.some((finding) => finding.severity === "error") ? "REFUSED" : "PASSED"}`,
    `findings (${result.findings.length}):`,
  ];
  if (result.findings.length === 0) {
    lines.push("  (none)");
  }
  for (const finding of result.findings) {
    lines.push(`  L${finding.line} [${finding.severity.toUpperCase()}] ${finding.rule}: ${finding.message}`);
  }
  return lines.join("\n");
}

export async function gatesCheckCommand(
  context: CommandContext,
  checkOptions: GatesCheckOptions,
): Promise<number> {
  const absolutePath = path.resolve(checkOptions.file);
  try {
    await access(absolutePath, constants.R_OK);
  } catch {
    throw new Error(`cannot read file "${absolutePath}"`);
  }

  const result = await context.pipeline.gate.validateFile(absolutePath);

  if (context.options.json) {
    out(JSON.stringify({ file: absolutePath, ...result }, null, 2));
  } else {
    out(renderGateResult(absolutePath, result));
  }

  return result.findings.some((finding) => finding.severity === "error") ? EXIT_FAILURE : EXIT_OK;
}
