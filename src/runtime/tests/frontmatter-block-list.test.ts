import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseFrontmatter, SkillResolver } from '../routing/resolver.js';
import { SkillFactory } from '../factories/skill-factory.js';

/**
 * O produtor e o consumidor de frontmatter deste repositório estavam em
 * formatos incompatíveis: a `SkillFactory` escreve lista de BLOCO
 * (`triggers:` + linhas `  - x`) e o parser só entendia escalar ou `[a, b]`
 * inline. A perda era silenciosa — `triggers:` gravava string vazia, as linhas
 * de item não casavam com nada, e `readSkill` derivava `[]`. Toda skill gerada
 * pela Factory (e toda skill sintetizada por trajetória, que usa o mesmo
 * escritor) perdia justamente o metadado pelo qual `rankSkills` a acharia.
 */

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-fm-'));
}

test('frontmatter: lista de bloco é lida como array', () => {
  const fm = parseFrontmatter([
    '---',
    'name: minha-skill',
    'triggers:',
    '  - migração postgres',
    '  - índice composto',
    'capabilities:',
    '  - database',
    '---',
    '',
    '# corpo',
  ].join('\n'));

  assert.deepEqual(fm.triggers, ['migração postgres', 'índice composto']);
  assert.deepEqual(fm.capabilities, ['database']);
  assert.equal(fm.name, 'minha-skill');
});

test('frontmatter: lista inline continua funcionando, com e sem aspas', () => {
  const fm = parseFrontmatter('---\ntriggers: [a, "b c", \'d\']\n---\n');
  assert.deepEqual(fm.triggers, ['a', 'b c', 'd']);
});

test('frontmatter: chave sem valor e sem itens segue string vazia, não lista vazia', () => {
  // Ausência de valor não é lista vazia: transformar em `[]` afirmaria que a
  // skill declarou "nenhum trigger", quando ela não declarou nada.
  const fm = parseFrontmatter('---\nname: x\ntriggers:\ndescription: y\n---\n');
  assert.equal(fm.triggers, '');
  assert.equal(fm.description, 'y');
});

test('frontmatter: a chave DEPOIS de uma lista de bloco não é engolida', () => {
  const fm = parseFrontmatter([
    '---',
    'triggers:',
    '  - um',
    '  - dois',
    'token_budget: 1200',
    'risk: medium',
    '---',
  ].join('\n'));
  assert.deepEqual(fm.triggers, ['um', 'dois']);
  assert.equal(fm.token_budget, '1200');
  assert.equal(fm.risk, 'medium');
});

test('frontmatter: item de lista com aspas perde as aspas, não o conteúdo', () => {
  const fm = parseFrontmatter('---\ntriggers:\n  - "com espaço: e dois pontos"\n---\n');
  assert.deepEqual(fm.triggers, ['com espaço: e dois pontos']);
});

test('frontmatter: chave aninhada segue fora de escopo e não corrompe o resto', () => {
  // `tools:` → `  mcp:` → `    - x` é o formato do catálogo v2. Continua não
  // sendo lido (o `SkillManifest` é plano), mas não pode contaminar as chaves
  // seguintes nem virar lista do pai.
  const fm = parseFrontmatter([
    '---',
    'name: tdd',
    'tools:',
    '  mcp:',
    '    - mcp:execute_command',
    'version: 2.0.0',
    '---',
  ].join('\n'));
  assert.equal(fm.name, 'tdd');
  assert.equal(fm.version, '2.0.0');
  assert.equal(fm.tools, '');
});

test('frontmatter: skill escrita pela SkillFactory é relida com os triggers que ela declarou', () => {
  const dir = tmpDir();
  try {
    const resolver = new SkillResolver({ baseDir: dir });
    const factory = new SkillFactory(resolver);
    const created = factory.generate({
      gap: 'não existe skill para migração de schema em PostgreSQL com índice composto',
      targetDir: path.join(dir, 'skills'),
    } as never);

    assert.ok(created.file, `a skill precisa ter sido escrita: ${created.validation.issues.join('; ')}`);
    assert.ok(created.manifest.triggers.length > 0, 'a Factory declarou triggers');

    // O round-trip é o ponto: o que a Factory escreveu tem que voltar do disco.
    const reread = parseFrontmatter(fs.readFileSync(created.file, 'utf-8'));
    assert.deepEqual(reread.triggers, created.manifest.triggers);
    assert.deepEqual(reread.capabilities, created.manifest.capabilities);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
