/**
 * Skill catalog access with a minimal embedded YAML front-matter parser.
 *
 * Layouts supported:
 * - v2:      `.skills/<name>/SKILL.md` with front-matter keys
 *            name, description, version, category, tools.mcp[]
 * - legacy:  `skills/<name>/SKILL.md` with name/description front-matter
 *
 * The v2 directory wins whenever it holds at least one SKILL.md; otherwise
 * the loader falls back to the legacy tree. The YAML parser covers exactly
 * the schema above (scalars, quoted strings, inline arrays and one nesting
 * level of maps/lists) — deliberately NOT a general YAML implementation.
 */

import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import { type SkillMeta, ContractViolationError } from "./contracts.js";
import { resolveRepoRoot } from "./environment.js";

export interface FrontMatterResult {
  readonly data: Record<string, unknown>;
  readonly body: string;
}

interface YamlLine {
  readonly indent: number;
  readonly text: string;
}

const FRONT_MATTER_DELIMITER = "---";

/** Extracts a leading `--- ... ---` block plus its trailing body. */
export function splitFrontMatter(content: string): FrontMatterResult | null {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const first = lines[0]?.trim();
  if (first !== FRONT_MATTER_DELIMITER) {
    return null;
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === FRONT_MATTER_DELIMITER) {
      closingIndex = i;
      break;
    }
  }
  if (closingIndex < 0) {
    return null;
  }
  const yamlLines = lines.slice(1, closingIndex).filter((line) => line.trim().length > 0);
  const data = parseYamlBlock(
    yamlLines.map((line) => ({
      indent: countIndent(line),
      text: line.trim(),
    })),
  );
  return {
    data,
    body: lines.slice(closingIndex + 1).join("\n").replace(/^\n+/, ""),
  };
}

function countIndent(line: string): number {
  const match = /^[ ]*/.exec(line);
  return match === null ? 0 : match[0].length;
}

/** Parses the restricted YAML subset used by SKILL.md front-matters. */
function parseYamlBlock(lines: YamlLine[]): Record<string, unknown> {
  const [value] = parseNode(lines, 0, 0);
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseNode(lines: readonly YamlLine[], start: number, indent: number): [unknown, number] {
  if (start >= lines.length) {
    return [{}, start];
  }
  if (lines[start]?.text.startsWith("- ") || lines[start]?.text === "-") {
    return parseList(lines, start, indent);
  }
  return parseMap(lines, start, indent);
}

function parseList(lines: readonly YamlLine[], start: number, indent: number): [unknown[], number] {
  const items: unknown[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || line.indent < indent || !(line.text.startsWith("- ") || line.text === "-")) {
      break;
    }
    const inlineValue = line.text.slice(1).trim();
    if (inlineValue.length > 0) {
      items.push(parseScalar(inlineValue));
      index += 1;
    } else {
      const [nested, next] = parseNode(lines, index + 1, indent + 1);
      items.push(nested);
      index = next;
    }
  }
  return [items, index];
}

function parseMap(lines: readonly YamlLine[], start: number, indent: number): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      // Stray deeper indentation without a parent key: skip defensively.
      index += 1;
      continue;
    }
    const separatorIndex = findKeySeparator(line.text);
    if (separatorIndex < 0) {
      index += 1;
      continue;
    }

    const key = unquote(line.text.slice(0, separatorIndex).trim());
    const rawValue = line.text.slice(separatorIndex + 1).trim();

    if (rawValue.length > 0) {
      result[key] = parseScalar(rawValue);
      index += 1;
      continue;
    }
    const childIndent = lines[index + 1]?.indent ?? indent;
    if (childIndent > indent) {
      const [child, next] = parseNode(lines, index + 1, childIndent);
      result[key] = child;
      index = next;
    } else if (lines[index + 1]?.text.startsWith("- ") === true) {
      // List items may sit at the same indent level as their key.
      const [child, next] = parseList(lines, index + 1, indent);
      result[key] = child;
      index = next;
    } else {
      result[key] = null;
      index += 1;
    }
  }
  return [result, index];
}

/** Finds the `key:` separator outside quotes. */
function findKeySeparator(text: string): number {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ":") {
      const next = text.charAt(i + 1);
      if (next === "" || next === " ") {
        return i;
      }
    }
  }
  return -1;
}

function parseScalar(raw: string): unknown {
  if (raw.startsWith("[")) {
    return parseInlineArray(raw);
  }
  return unquote(raw);
}

function parseInlineArray(raw: string): readonly unknown[] {
  const inner = raw.endsWith("]") ? raw.slice(1, -1) : raw.slice(1);
  if (inner.trim().length === 0) {
    return [];
  }
  const items: unknown[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of inner) {
    if (quote !== null) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      items.push(unquote(current.trim()));
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) {
    items.push(unquote(current.trim()));
  }
  return items;
}

function unquote(raw: string): string {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw
      .slice(1, -1)
      .replace(/\\(["\\nt])/g, (_match, escaped: string) =>
        escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped,
      );
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

/* ------------------------------------------------------------------------- */
/* Catalog loading                                                           */
/* ------------------------------------------------------------------------- */

export interface SkillCatalogOptions {
  readonly repoRoot?: string;
}

export interface SkillCatalog {
  /** Parsed metadata ordered by name. */
  readonly skills: readonly SkillMeta[];
  /** Which directory actually supplied the entries. */
  readonly originDirectory: "v2" | "legacy" | "none";
  /** Directories probed during loading. */
  readonly searchedDirectories: readonly string[];
}

async function readSkillsFromDirectory(directory: string, origin: "v2" | "legacy"): Promise<SkillMeta[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: SkillMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillPath = path.join(directory, entry.name, "SKILL.md");
    let content: string;
    try {
      content = await readFile(skillPath, "utf8");
    } catch {
      continue;
    }
    try {
      skills.push(parseSkillDocument(content, skillPath, origin));
    } catch {
      // A malformed SKILL.md must not take down the whole catalog listing;
      // the entry is skipped silently here and surfaced via `origin`.
    }
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Parses one SKILL.md document into `SkillMeta`. Throws
 * `ContractViolationError` when required fields are missing or mistyped.
 */
export function parseSkillDocument(content: string, filePath: string, origin: "v2" | "legacy"): SkillMeta {
  const frontMatter = splitFrontMatter(content);
  if (frontMatter === null) {
    throw new ContractViolationError("YAML front-matter block", filePath);
  }
  const name = frontMatter.data["name"];
  const description = frontMatter.data["description"];
  if (typeof name !== "string" || name.length === 0) {
    throw new ContractViolationError('non-empty string "name"', name);
  }
  if (typeof description !== "string") {
    throw new ContractViolationError('string "description"', description);
  }

  const version = frontMatter.data["version"];
  const category = frontMatter.data["category"];
  const toolsRaw = frontMatter.data["tools"];
  const mcpTools =
    typeof toolsRaw === "object" && toolsRaw !== null && !Array.isArray(toolsRaw)
      ? extractStringArray((toolsRaw as Record<string, unknown>)["mcp"])
      : [];

  return {
    name,
    description,
    ...(typeof version === "string" ? { version } : {}),
    ...(typeof category === "string" ? { category } : {}),
    mcpTools,
    origin,
    path: filePath,
    body: frontMatter.body,
  };
}

function extractStringArray(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string");
}

/** Loads the skill catalog: `.skills/` when populated, otherwise `skills/`. */
export async function loadSkillCatalog(options: SkillCatalogOptions = {}): Promise<SkillCatalog> {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const v2Directory = path.join(repoRoot, ".skills");
  const legacyDirectory = path.join(repoRoot, "skills");

  const v2Skills = await readSkillsFromDirectory(v2Directory, "v2");
  if (v2Skills.length > 0) {
    return { skills: v2Skills, originDirectory: "v2", searchedDirectories: [v2Directory, legacyDirectory] };
  }

  const legacySkills = await readSkillsFromDirectory(legacyDirectory, "legacy");
  return {
    skills: legacySkills,
    originDirectory: legacySkills.length > 0 ? "legacy" : "none",
    searchedDirectories: [v2Directory, legacyDirectory],
  };
}
