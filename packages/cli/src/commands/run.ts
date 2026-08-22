/**
 * `izanagi-next run`: the four-phase pipeline.
 *
 *   Fase 1 - Routing        reads ONLY SKILL.md front-matter to select
 *                           candidate skills (--skills=a,b overrides the
 *                           heuristic scorer).
 *   Fase 2 - Loading        injects the bodies of the selected SKILL.md
 *                           documents into the task payload.
 *   Fase 3 - Submission     submits to the Go swarm orchestrator over its
 *                           Unix socket; when the socket is unavailable the
 *                           command falls back to STANDALONE mode, executing
 *                           locally and persisting the composed payload via
 *                           MCP (when an MCP server is configured) or plain
 *                           filesystem writes.
 *   Fase 4 - Quality gate   runs the Rust engine on every produced file.
 *                           Critical violations REFUSE the final receipt and
 *                           trigger the auto-heal loop: up to N retries that
 *                           re-submit the task with the violation report
 *                           attached.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type QualityGateResult,
  type SkillMeta,
  SocketUnavailableError,
  makeTaskId,
} from "../../../sdk/src/index.ts";
import { EXIT_FAILURE, EXIT_OK, type CommandContext } from "../context.js";
import { out } from "../console.js";

export interface RunOptions {
  readonly agent: string;
  readonly task: string;
  readonly skills?: string | undefined;
  readonly files: readonly string[];
  readonly maxHealAttempts: number;
  readonly standalone: boolean;
  readonly timeoutMs: number;
}

const MAX_INJECTED_BODY_CHARS = 4_000;

/* ------------------------------------------------------------------------ */
/* Phase 1 - routing                                                         */
/* ------------------------------------------------------------------------ */

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9à-ú]+/i)
      .filter((token) => token.length >= 3),
  );
}

function scoreSkill(skill: SkillMeta, taskTokens: ReadonlySet<string>): number {
  let score = 0;
  for (const token of taskTokens) {
    if (tokenize(skill.name).has(token)) {
      score += 3;
    }
    if (skill.category !== undefined && tokenize(skill.category).has(token)) {
      score += 2;
    }
    const descriptionTokens = tokenize(skill.description);
    // Partial credit: the token appears inside the description vocabulary.
    for (const descriptionToken of descriptionTokens) {
      if (descriptionToken.startsWith(token)) {
        score += 1;
        break;
      }
    }
  }
  return score;
}

function routeSkills(
  catalogSkills: readonly SkillMeta[],
  task: string,
  explicit: readonly string[],
): { selected: readonly SkillMeta[]; strategy: "explicit" | "heuristic" | "none" } {
  if (explicit.length > 0) {
    const byName = new Map(catalogSkills.map((skill) => [skill.name.toLowerCase(), skill]));
    const selected: SkillMeta[] = [];
    for (const requested of explicit) {
      const found = byName.get(requested.toLowerCase());
      if (found === undefined) {
        throw new Error(`unknown skill "${requested}" (catalog has ${catalogSkills.length} entries)`);
      }
      selected.push(found);
    }
    return { selected, strategy: "explicit" };
  }

  const taskTokens = tokenize(task);
  const scored = catalogSkills
    .map((skill) => ({ skill, score: scoreSkill(skill, taskTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  return {
    selected: scored.map((entry) => entry.skill),
    strategy: scored.length > 0 ? "heuristic" : "none",
  };
}

/* ------------------------------------------------------------------------ */
/* Phase 2 - progressive loading                                             */
/* ------------------------------------------------------------------------ */

function composePayload(task: string, selected: readonly SkillMeta[]): string {
  if (selected.length === 0) {
    return task;
  }
  const sections = selected.map((skill) => {
    const header = `## Skill: ${skill.name}${skill.version === undefined ? "" : ` v${skill.version}`} [${skill.origin}]`;
    const body =
      skill.body.length > MAX_INJECTED_BODY_CHARS
        ? `${skill.body.slice(0, MAX_INJECTED_BODY_CHARS)}\n\n<!-- truncated (${skill.body.length} chars total) -->`
        : skill.body;
    return `${header}\n\n${body.trimEnd()}`;
  });
  return `${task}\n\n---\n# Injected skill context\n\n${sections.join("\n\n---\n\n")}`;
}

/* ------------------------------------------------------------------------ */
/* Phase 3 - submission                                                      */
/* ------------------------------------------------------------------------ */

interface SubmissionOutcome {
  readonly mode: "orchestrator" | "standalone-mcp" | "standalone-fs";
  readonly taskId: string;
  detail: string;
}

async function persistStandaloneArtifact(
  pipeline: CommandContext["pipeline"],
  artifactPath: string,
  content: string,
): Promise<"standalone-mcp" | "standalone-fs"> {
  if (pipeline.mcp !== null) {
    try {
      await pipeline.mcp.connect();
      await pipeline.mcp.callTool({
        name: "fs_write",
        arguments: { path: artifactPath, content },
      });
      return "standalone-mcp";
    } catch (error) {
      out(`note: MCP path unavailable (${error instanceof Error ? error.message : String(error)}); writing directly`);
    }
  }
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, content, "utf8");
  return "standalone-fs";
}

async function submitTask(
  pipeline: CommandContext["pipeline"],
  options: RunOptions,
  taskIdBase: string,
  payload: string,
  suffix: string,
): Promise<SubmissionOutcome> {
  const taskId = makeTaskId(`${taskIdBase}${suffix}`);

  if (!options.standalone && (await pipeline.orchestrator.isReachable())) {
    try {
      const result = await pipeline.orchestrator.submit({
        taskId,
        task: payload,
      });
      const wait = await pipeline.orchestrator.awaitTerminal(taskId, {
        timeoutMs: options.timeoutMs,
      });
      return {
        mode: "orchestrator",
        taskId,
        detail: `accepted=${String(result.accepted)}, final state=${wait.status.state}, polls=${String(wait.pollCount)}`,
      };
    } catch (error) {
      if (!(error instanceof SocketUnavailableError)) {
        throw error;
      }
      out("note: orchestrator socket dropped mid-submission; falling back to standalone mode");
    }
  }

  const artifactsDir = path.join(process.cwd(), ".izanagi", "tasks", taskId);
  const artifactPath = path.join(artifactsDir, "prompt.md");
  const mode = await persistStandaloneArtifact(pipeline, artifactPath, payload);
  return {
    mode,
    taskId,
    detail: `artifact written to ${artifactPath}`,
  };
}

/* ------------------------------------------------------------------------ */
/* Phase 4 - quality gates                                                   */
/* ------------------------------------------------------------------------ */

interface FileGateReport {
  readonly file: string;
  readonly result: QualityGateResult | null;
  readonly error?: string;
}

function criticalViolations(report: FileGateReport): readonly string[] {
  if (report.result === null) {
    return [`gate error: ${report.error ?? "unknown"}`];
  }
  return report.result.findings
    .filter((finding) => finding.severity === "error")
    .map((finding) => `${path.basename(report.file)}:${finding.line} [${finding.rule}] ${finding.message}`);
}

function renderViolationReport(reports: readonly FileGateReport[]): string {
  const lines: string[] = ["# Quality gate violations", ""];
  for (const report of reports) {
    lines.push(`## ${report.file}`);
    if (report.result === null) {
      lines.push(`- gate failed: ${report.error ?? "unknown"}`);
      continue;
    }
    lines.push(`- score: ${report.result.score}/100`);
    for (const finding of report.result.findings) {
      lines.push(`- L${finding.line} [${finding.severity}] ${finding.rule}: ${finding.message}`);
    }
    lines.push("");
  }
  lines.push("Fix every severity=error violation above and re-submit.");
  return lines.join("\n");
}

async function gateAllFiles(pipeline: CommandContext["pipeline"], files: readonly string[]): Promise<FileGateReport[]> {
  const reports: FileGateReport[] = [];
  for (const file of files) {
    try {
      reports.push({ file, result: await pipeline.gate.validateFile(file) });
    } catch (error) {
      reports.push({
        file,
        result: null,
        ...(error instanceof Error ? { error: error.message } : {}),
      });
    }
  }
  return reports;
}

/* ------------------------------------------------------------------------ */
/* Command                                                                   */
/* ------------------------------------------------------------------------ */

export async function runCommand(context: CommandContext, runOptions: RunOptions): Promise<number> {
  if (!Number.isInteger(runOptions.maxHealAttempts) || runOptions.maxHealAttempts < 0) {
    runOptions = { ...runOptions, maxHealAttempts: 2 };
  }

  const catalog = await context.pipeline.skills();

  // ---- Phase 1: routing -------------------------------------------------
  const explicitSkillNames =
    runOptions.skills === undefined
      ? []
      : runOptions.skills.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  const routed = routeSkills(catalog.skills, runOptions.task, explicitSkillNames);
  out(`[1/4] routing: ${routed.strategy} -> ${routed.selected.map((skill) => skill.name).join(", ") || "(no skills)"}`);

  // ---- Phase 2: progressive loading ------------------------------------
  const payload = composePayload(runOptions.task, routed.selected);
  out(`[2/4] loading: payload composed (${payload.length} chars, ${routed.selected.length} skill bodies injected)`);

  const taskIdBase = `t${Date.now().toString(36)}-${runOptions.agent.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 12) || "agent"}`;

  // ---- Phase 3: submission ----------------------------------------------
  let submission = await submitTask(context.pipeline, runOptions, taskIdBase, payload, "");
  out(`[3/4] submission: mode=${submission.mode}, taskId=${submission.taskId} (${submission.detail})`);

  // ---- Phase 4: quality gates + auto-heal loop --------------------------
  let attempt = 0;
  for (;;) {
    if (runOptions.files.length === 0) {
      out("[4/4] quality gates: no --files provided, skipping gate phase");
      return EXIT_OK;
    }

    const reports = await gateAllFiles(context.pipeline, runOptions.files);
    const violations = reports.flatMap(criticalViolations);

    if (violations.length === 0) {
      const scores = reports
        .filter((report): report is FileGateReport & { result: QualityGateResult } => report.result !== null)
        .map((report) => `${path.basename(report.file)}=${String(report.result.score)}`);
      out(`[4/4] quality gates: PASSED (${scores.join(", ")})`);
      const receiptsDir = path.join(process.cwd(), ".izanagi", "tasks", submission.taskId);
      await mkdir(receiptsDir, { recursive: true });
      await writeFile(
        path.join(receiptsDir, "result.json"),
        JSON.stringify(
          {
            taskId: submission.taskId,
            agent: runOptions.agent,
            mode: submission.mode,
            attempts: attempt + 1,
            files: reports.map((report) => ({
              file: report.file,
              score: report.result?.score ?? null,
              findings: report.result?.findings ?? [],
            })),
          },
          null,
          2,
        ),
        "utf8",
      );
      out(`receipt: ${path.join(receiptsDir, "result.json")}`);
      return EXIT_OK;
    }

    out(
      `[4/4] quality gates: REFUSED with ${String(violations.length)} critical violation(s) (attempt ${String(attempt + 1)})`,
    );
    for (const violation of violations.slice(0, 10)) {
      out(`       - ${violation}`);
    }

    if (attempt >= runOptions.maxHealAttempts) {
      process.stderr.write(
        `run failed: critical violations persisted after ${String(runOptions.maxHealAttempts + 1)} gate round(s); refusing to record success\n`,
      );
      const reportDir = path.join(process.cwd(), ".izanagi", "tasks", submission.taskId);
      await mkdir(reportDir, { recursive: true });
      const reportPath = path.join(reportDir, "violations.md");
      await writeFile(reportPath, renderViolationReport(reports), "utf8");
      process.stderr.write(`violation report: ${reportPath}\n`);
      return EXIT_FAILURE;
    }

    attempt += 1;
    out(`auto-heal: re-submitting with violation report attached (attempt ${String(attempt + 1)})`);
    const healPayload = `${payload}\n\n---\n# Previous attempt rejected by quality gate\n\n${renderViolationReport(reports)}`;
    submission = await submitTask(
      context.pipeline,
      runOptions,
      taskIdBase,
      healPayload,
      `-r${String(attempt)}`,
    );
    out(`           new submission taskId=${submission.taskId} (${submission.detail})`);
  }
}
