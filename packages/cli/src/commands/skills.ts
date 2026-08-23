/**
 * `izanagi-next skill`: progressive disclosure over the v2 catalog.
 *
 * - `skill list`: light metadata only (front-matter), filterable by category
 *   and by substring search across name+description.
 * - `skill show <name>`: summary front-matter plus the list of reference
 *   files available under `<skill>/references/` — taken from the declared
 *   `references:` field when present, falling back to a directory scan.
 * - `skill show <name> --ref <file>`: prints one reference's content; the
 *   path is strictly confined to the skill's references/ directory.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { splitFrontMatter } from "../../../sdk/src/index.ts";
import {
  EXIT_OK,
  type CommandContext,
  UsageError,
} from "../context.js";
import { out, table, truncate } from "../console.js";

export interface SkillListOptions {
  readonly category?: string | undefined;
  readonly search?: string | undefined;
}

export interface SkillShowOptions {
  readonly name: string;
  readonly ref?: string | undefined;
}

export async function skillListCommand(
  context: CommandContext,
  listOptions: SkillListOptions,
): Promise<number> {
  const catalog = await context.pipeline.skills();

  const category = listOptions.category?.toLowerCase();
  const search = listOptions.search?.toLowerCase();

  const filtered = catalog.skills.filter((skill) => {
    if (category !== undefined && (skill.category ?? "").toLowerCase() !== category) {
      return false;
    }
    if (
      search !== undefined &&
      !`${skill.name}\n${skill.description}`.toLowerCase().includes(search)
    ) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    out("no skills matched");
    out(`searched: ${catalog.searchedDirectories.join(", ")}`);
    return EXIT_OK;
  }

  out(table(
    ["NAME", "CATEGORY", "VERSION", "SOURCE", "DESCRIPTION"],
    filtered.map((skill) => [
      skill.name,
      skill.category ?? "-",
      skill.version ?? "-",
      `${skill.origin}:${catalog.originDirectory}`,
      truncate(skill.description.replaceAll("\n", " "), 72),
    ]),
  ));
  out("");
  out(
    `${filtered.length} skills (source dir: ${catalog.originDirectory}, total in catalog: ${String(catalog.skills.length)})`,
  );
  return EXIT_OK;
}

/* ------------------------------------------------------------------------- */
/* skill show                                                                */
/* ------------------------------------------------------------------------- */

/** Resolves one catalog entry by exact name, else unique case-insensitive match. */
function resolveSkill(
  catalog: Awaited<ReturnType<CommandContext["pipeline"]["skills"]>>,
  name: string,
) {
  const exact = catalog.skills.find((skill) => skill.name === name);
  if (exact !== undefined) {
    return exact;
  }
  const insensitive = catalog.skills.filter(
    (skill) => skill.name.toLowerCase() === name.toLowerCase(),
  );
  const uniqueMatch = insensitive.length === 1 ? insensitive[0] : undefined;
  if (uniqueMatch !== undefined) {
    return uniqueMatch;
  }
  const known = catalog.skills.slice(0, 8).map((skill) => skill.name).join(", ");
  throw new UsageError(
    `unknown skill "${name}"${insensitive.length > 1 ? " (ambiguous case-insensitive match)" : ""}${known ? ` — try: skill list (e.g. ${known}...)` : " — catalog is empty"}`,
  );
}

/**
 * Reference files for a skill: declared `references:` front-matter field
 * when present, otherwise a sorted scan of the references/ directory.
 */
async function listReferences(
  skillMdPath: string,
): Promise<{ files: string[]; source: "front-matter" | "directory-scan" }> {
  const skillDirectory = path.dirname(skillMdPath);
  let content: string;
  try {
    content = await readFile(skillMdPath, "utf8");
  } catch (error) {
    throw new Error(`cannot read skill document "${skillMdPath}": ${String(error)}`);
  }
  const frontMatter = splitFrontMatter(content);
  const declared = frontMatter?.data["references"];
  if (Array.isArray(declared)) {
    const files = declared.filter((entry): entry is string => typeof entry === "string");
    if (files.length > 0) {
      return { files: [...files].sort(), source: "front-matter" };
    }
  }

  const referencesDirectory = path.join(skillDirectory, "references");
  try {
    const entries = await readdir(referencesDirectory, { withFileTypes: true });
    return {
      files: entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort(),
      source: "directory-scan",
    };
  } catch {
    return { files: [], source: "directory-scan" };
  }
}

/** Confines a user-supplied reference path inside the references/ directory. */
function confineReferencePath(referencesDirectory: string, ref: string): string {
  const trimmed = ref.trim();
  if (
    trimmed.length === 0 ||
    path.isAbsolute(trimmed) ||
    trimmed.includes("\\") ||
    path.normalize(trimmed).split(/[\\/]/).includes("..")
  ) {
    throw new UsageError(
      `invalid --ref "${ref}": path must be relative and confined to the skill's references/ directory`,
    );
  }
  const resolved = path.resolve(referencesDirectory, trimmed);
  if (
    path.relative(referencesDirectory, resolved).startsWith("..") ||
    path.relative(referencesDirectory, resolved) === ""
  ) {
    throw new UsageError(
      `invalid --ref "${ref}": resolved path escapes the skill's references/ directory`,
    );
  }
  return resolved;
}

export async function skillShowCommand(
  context: CommandContext,
  showOptions: SkillShowOptions,
): Promise<number> {
  const catalog = await context.pipeline.skills();
  const skill = resolveSkill(catalog, showOptions.name);
  const skillDirectory = path.dirname(skill.path);
  const referencesDirectory = path.join(skillDirectory, "references");

  if (showOptions.ref !== undefined) {
    const referencePath = confineReferencePath(referencesDirectory, showOptions.ref);
    let content: string;
    try {
      content = await readFile(referencePath, "utf8");
    } catch {
      throw new UsageError(
        `reference "${showOptions.ref}" not found under ${path.relative(process.cwd(), referencesDirectory)} — see: skill show ${skill.name}`,
      );
    }
    out(content);
    return EXIT_OK;
  }

  const { files, source } = await listReferences(skill.path);

  const lines = [
    `name:        ${skill.name}`,
    `version:     ${skill.version ?? "-"}`,
    `category:    ${skill.category ?? "-"}`,
    `origin:      ${skill.origin}`,
    `path:        ${skill.path}`,
    `description: ${truncate(skill.description.replaceAll("\n", " "), 160)}`,
    `mcp tools:   ${skill.mcpTools.length > 0 ? skill.mcpTools.join(", ") : "(none)"}`,
    "",
    `references (${files.length}, source: ${source}):`,
  ];
  if (files.length === 0) {
    lines.push("  (none)");
  } else {
    for (const file of files) {
      lines.push(`  - ${file}`);
    }
    lines.push("");
    lines.push(`read one with: izanagi-next skill show ${skill.name} --ref=<file>`);
  }
  out(lines.join("\n"));
  return EXIT_OK;
}
