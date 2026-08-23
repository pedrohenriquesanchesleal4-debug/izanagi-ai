import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCLI } from '../../cli/index.js';
import {
  parseFrontmatter,
  splitTopLevelSections,
  isV2Skill,
  buildV2Summary,
  layeredSkillSummary,
  findV2Counterpart,
} from '../../runtime/text/frontmatter.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** SKILL.md v2 sintético com seções dimensionáveis (n linhas cada). */
function writeV2Skill(dir: string, sizes: { workflow?: number; redFlags?: number; verification?: number; rationalizations?: number }): string {
  const block = (title: string, n: number, prefix: string) =>
    n > 0 ? `\n## ${title}\n${Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n')}\n` : '';
  const content = `---
name: "skill-fake"
description: "Skill sintética para testar progressive disclosure em camadas."
version: 2.0.0
category: ai
tools:
  mcp:
    - mcp:fs_read
references:
  - "references.md"
---

# Skill Fake

## Triggering Criteria

- **Domínio:** IA & Agentes (\`ai\`)
- **Ativar quando:** Use quando o teste pedir disclosure em camadas.
${block('Step-by-Step Workflow', sizes.workflow ?? 0, '- passo')}
${block('Verification Steps', sizes.verification ?? 0, '- verifique')}
${block('Common Rationalizations', sizes.rationalizations ?? 0, '- racionalizo')}
${block('Red Flags', sizes.redFlags ?? 0, '- flag vermelha')}
## Legacy Reference (v1)

Conteúdo legado integral que nunca deve entrar no prompt (duplicata do corpo original).
`;
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

test('frontmatter: parseia scalar com aspas, sem aspas, lista inline e block list', () => {
  const fm = parseFrontmatter(
    `---
name: "minha-skill"
version: 2.0.0
tags: [a, b, "c d"]
refs:
  - "one.md"
  - two.md
---

corpo`,
  );
  assert.ok(fm);
  assert.equal(fm.data.name, 'minha-skill');
  assert.equal(fm.data.version, '2.0.0');
  assert.deepEqual(fm.data.tags, ['a', 'b', 'c d']);
  assert.deepEqual(fm.data.refs, ['one.md', 'two.md']);
  assert.equal(fm.body, '\ncorpo');
});

test('frontmatter: mapa aninhado (tools.mcp) é consumido sem valor e não corrompe irmãs', () => {
  const fm = parseFrontmatter(
    `---
name: x
tools:
  mcp:
    - mcp:fs_read
category: ai
---`,
  );
  assert.ok(fm);
  assert.equal(fm.data.name, 'x');
  assert.equal(fm.data.category, 'ai');
  assert.equal(fm.data.tools, undefined);
});

test('frontmatter: arquivo sem front-matter retorna null (skill legada)', () => {
  assert.equal(parseFrontmatter('# só um título\n\ncorpo\n'), null);
});

test('isV2/splitSections: v2 reconhecida por front-matter + Step-by-Workflow; ### não abre seção nova', () => {
  const dir = tmpDir('izanagi-fm-v2-');
  try {
    const file = writeV2Skill(dir, { workflow: 3 });
    const content = fs.readFileSync(file, 'utf-8');
    assert.equal(isV2Skill(content), true);
    assert.equal(isV2Skill('# legado sem fm\n'), false);
    const titles = splitTopLevelSections(parseFrontmatter(content)!.body).map((s) => s.title);
    assert.deepEqual(titles, ['Triggering Criteria', 'Step-by-Step Workflow', 'Legacy Reference (v1)']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildV2Summary: budget apertado prioriza Workflow e Red Flags antes de Verification/Rationalizations', () => {
  const dir = tmpDir('izanagi-fm-budget-');
  try {
    const file = writeV2Skill(dir, { workflow: 20, redFlags: 12, verification: 15, rationalizations: 15 });
    const content = fs.readFileSync(file, 'utf-8');
    const fm = parseFrontmatter(content)!;
    // Cabeçalho (4 linhas) + Workflow inteiro (22) deixa 9 linhas para Red Flags:
    // ela ENTRA (prioridade) mas truncada, enquanto Verification/Rationalizations
    // ficam inteiramente de fora.
    const summary = buildV2Summary(fm.data, fm.body, file, 35);
    assert.match(summary, /\*\*Name:\*\* skill-fake/);
    assert.match(summary, /\*\*Description:\*\* Skill sintética/);
    assert.match(summary, /\*\*Ativar quando:\*\* Use quando o teste pedir/);
    assert.match(summary, /## Step-by-Step Workflow/);
    assert.match(summary, /## Red Flags/);
    assert.doesNotMatch(summary, /## Verification Steps/);
    assert.doesNotMatch(summary, /## Common Rationalizations/);
    assert.doesNotMatch(summary, /Legacy Reference \(v1\)\n/);
    assert.match(summary, /seções omitidas: Triggering Criteria, Verification Steps, Common Rationalizations, Legacy Reference \(v1\)/);
    assert.match(summary, /seções truncadas: Red Flags/);
    assert.ok(summary.includes(`conteúdo completo em ${file}`));
    const lineCount = summary.split('\n').length;
    assert.ok(lineCount <= 37, `esperado <= 37 linhas, veio ${lineCount}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildV2Summary: budget folgado inclui as 4 seções completas e declara só as fora de prioridade', () => {
  const dir = tmpDir('izanagi-fm-full-');
  try {
    const file = writeV2Skill(dir, { workflow: 5, redFlags: 4, verification: 4, rationalizations: 4 });
    const content = fs.readFileSync(file, 'utf-8');
    const fm = parseFrontmatter(content)!;
    const summary = buildV2Summary(fm.data, fm.body, file, 200);
    for (const title of ['Step-by-Step Workflow', 'Red Flags', 'Verification Steps', 'Common Rationalizations']) {
      assert.match(summary, new RegExp(`## ${title}`));
    }
    assert.doesNotMatch(summary, /truncadas/);
    assert.match(summary, /seções omitidas: Triggering Criteria, Legacy Reference \(v1\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('layeredSkillSummary: skill LEGADA cai no truncamento compatível byte-a-byte', () => {
  const dir = tmpDir('izanagi-fm-legacy-');
  try {
    const file = path.join(dir, 'SKILL.md');
    const lines = Array.from({ length: 50 }, (_, i) => `linha-legada-${i + 1}`);
    const content = `# skill antiga sem frontmatter\n${lines.join('\n')}\n`;
    fs.writeFileSync(file, content, 'utf-8');

    // Dentro do budget: conteúdo integral intocado.
    assert.equal(layeredSkillSummary(file, 100), content);

    // Acima do budget: exatamente o comportamento anterior do run.ts.
    const expected =
      content.split('\n').slice(0, 10).join('\n') +
      `\n\n<!-- (skill truncada em 10 linhas — veja ${file} para o conteúdo completo) -->`;
    assert.equal(layeredSkillSummary(file, 10), expected);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('findV2Counterpart: mapeia <root>/skills/<n>/SKILL.md para <root>/.skills/<n>/SKILL.md nos dois roots', () => {
  const rootA = tmpDir('izanagi-fm-cwd-');
  const rootB = tmpDir('izanagi-fm-base-');
  try {
    fs.mkdirSync(path.join(rootA, 'skills', 'foo'), { recursive: true });
    const legacyA = path.join(rootA, 'skills', 'foo', 'SKILL.md');
    fs.writeFileSync(legacyA, '# foo', 'utf-8');
    // Sem contraparte em root algum -> null.
    assert.equal(findV2Counterpart(rootA, rootB, legacyA), null);

    // Contraparte apenas no baseDir -> encontrada lá.
    fs.mkdirSync(path.join(rootB, '.skills', 'foo'), { recursive: true });
    const v2B = path.join(rootB, '.skills', 'foo', 'SKILL.md');
    fs.writeFileSync(v2B, '---\nname: "foo"\nversion: 2.0.0\ncategory: ai\n---\n\n## Step-by-Step Workflow\n', 'utf-8');
    assert.equal(findV2Counterpart(rootA, rootB, legacyA), v2B);

    // Contraparte no cwd tem precedência sobre o baseDir.
    fs.mkdirSync(path.join(rootA, '.skills', 'foo'), { recursive: true });
    const v2A = path.join(rootA, '.skills', 'foo', 'SKILL.md');
    fs.writeFileSync(v2A, '---\nname: "foo"\nversion: 2.0.0\ncategory: ai\n---\n\n## Step-by-Step Workflow\n', 'utf-8');
    assert.equal(findV2Counterpart(rootA, rootB, legacyA), v2A);

    // Caminho sem segmento /skills/ -> null.
    assert.equal(findV2Counterpart(rootA, rootB, path.join(rootA, 'references', 'x.md')), null);
  } finally {
    fs.rmSync(rootA, { recursive: true, force: true });
    fs.rmSync(rootB, { recursive: true, force: true });
  }
});

test('layeredSkillSummary: catálogo real (.skills/economia-tokens) entra com metadados e Red Flags, sem Legacy Reference', () => {
  const realPath = path.join(process.cwd(), '.skills', 'economia-tokens', 'SKILL.md');
  assert.ok(fs.existsSync(realPath), 'catálogo v2 esperado no repo-fonte');
  const summary = layeredSkillSummary(realPath, 60);
  assert.match(summary, /\*\*Name:\*\* economia-tokens · \*\*Version:\*\* 2\.0\.0 · \*\*Category:\*\* ai/);
  assert.match(summary, /\*\*Description:\*\* Engenharia de contexto/);
  assert.match(summary, /\*\*Ativar quando:\*\* Use sempre/);
  assert.match(summary, /## Step-by-Step Workflow/);
  assert.match(summary, /Silencie ferramentas por padrão|flags quiet/);
  assert.match(summary, /## Red Flags/);
  assert.doesNotMatch(summary, /## Legacy Reference \(v1\)/);
  assert.ok(summary.includes(`conteúdo completo em ${realPath}`), 'omissão aponta para o arquivo v2 completo');
  // Invariante exato: o corpo respeita o budget e só o comentário final (2 linhas) vem depois.
  const budgetMatch = summary.match(/parcial em (\d+) linhas, budget 60:/);
  assert.ok(budgetMatch, 'comentário de omissão presente com contagem declarada');
  const usedLines = Number(budgetMatch[1]);
  assert.ok(usedLines <= 60, `corpo do resumo deve caber no budget, veio ${usedLines}`);
  assert.equal(summary.split('\n').length, usedLines + 2);
});

async function capture(fn: () => void | Promise<void>): Promise<{ logs: string[]; errors: string[] }> {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (m?: unknown) => { logs.push(String(m)); };
  console.error = (m?: unknown) => { errors.push(String(m)); };
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.error = origError;
  }
  return { logs, errors };
}

test('run --prompt-only: todo bloco ### SKILL usa disclosure v2 (metadados presentes, truncamento cego ausente)', async () => {
  const promptPath = path.resolve(process.cwd(), 'izanagi-prompt.md');
  try {
    const out = await capture(() => runCLI(['run', 'corrigir bug de login', '--prompt-only']));
    assert.match(out.logs.join('\n'), /Ready-to-use AI prompt generated/);
    assert.ok(fs.existsSync(promptPath));
    const md = fs.readFileSync(promptPath, 'utf-8');

    const chainChunk = md.split('## COMPUTED SKILL CHAIN')[1]?.split('## SYSTEM FOUNDATION')[0] ?? '';
    const pieces = chainChunk.split('### SKILL: ').slice(1);
    assert.ok(pieces.length >= 1, 'pelo menos uma skill resolvida na chain padrão');

    for (const piece of pieces) {
      assert.match(piece, /\*\*Name:\*\* /, 'front-matter name sempre presente no prompt');
      assert.match(piece, /\*\*Description:\*\* /, 'descrição sempre presente no prompt');
      assert.doesNotMatch(piece, /\(skill truncada em/, 'truncamento cego não deve mais ocorrer em skills v2');
      assert.doesNotMatch(piece, /## Legacy Reference \(v1\)/, 'duplicata v1 nunca entra no prompt');
      assert.match(piece, /conteúdo completo em /, 'omissões declaradas com ponteiro para o arquivo completo');
    }

    // Pelo menos uma skill do catálogo real apontando para .skills/ (progressive disclosure efetivo).
    assert.match(chainChunk, /conteúdo completo em .*\.skills/, 'fonte usada deve ser a contraparte v2 (.skills/)');
  } finally {
    fs.rmSync(promptPath, { force: true });
  }
});
