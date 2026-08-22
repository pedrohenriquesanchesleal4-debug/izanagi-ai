/**
 * `izanagi-next skill list`: prints skill metadata from `.skills/`
 * (v2 front-matter) with legacy `skills/` fallback, filterable by category
 * and by substring search across name+description.
 */

import { EXIT_OK, type CommandContext } from "../context.js";
import { out, table, truncate } from "../console.js";

export interface SkillListOptions {
  readonly category?: string | undefined;
  readonly search?: string | undefined;
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
