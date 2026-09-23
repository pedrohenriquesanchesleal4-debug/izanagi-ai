import assert from "node:assert/strict";
import test from "node:test";

import { parseFrontmatter } from "./migrate.mjs";

test("parseFrontmatter aceita skills salvas com CRLF no Windows", () => {
  const source = [
    "---",
    "name: anti-ai-slop",
    'description: "Audita UI"',
    "triggers:",
    "  - revisar UI",
    "---",
    "# Conteúdo",
  ].join("\r\n");

  const parsed = parseFrontmatter(source);

  assert.equal(parsed.data.name, "anti-ai-slop");
  assert.equal(parsed.data.description, "Audita UI");
  assert.deepEqual(parsed.data.triggers, ["revisar UI"]);
  assert.equal(parsed.body, "# Conteúdo");
});
