/**
 * As skills declaram o metadado pelo qual são encontradas.
 *
 * Medido antes desta rodada: das 106 skills da biblioteca, ZERO declaravam
 * `triggers` ou `capabilities`. Todo o resto vinha de default no `readSkill`,
 * então o haystack de `rankSkills` incluía dois arrays sempre vazios e o
 * ranking escolhia entre 106 descrições soltas.
 *
 * Este teste é o gate: se o campo voltar a ficar vazio em massa nas skills que
 * as chains realmente usam, ele quebra. Um catálogo que perde metadado perde
 * em silêncio, e silêncio é o modo de falha que esta suíte existe para impedir.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { SkillResolver } from '../routing/resolver.js';

const repoRoot = path.resolve(process.cwd());

/**
 * Skills que as chains do `core/skill-resolver.json` mais acionam, e que por
 * isso são as que o ranking mais precisa distinguir. A lista é explícita: um
 * teste que descobrisse o conjunto sozinho passaria a medir a descoberta, e
 * não a cobertura.
 */
const DECLARAM: string[] = [
  'qa',
  'ui-ux-pro-max',
  'memoria-projeto',
  'frontend',
  'design-directions',
  'web-perf-seo',
  'anti-ai-slop',
  'software-architect',
  'observability-expert',
  'editorial-layout',
  'motion-design',
  'animation-web',
  'webgl-3d',
  'conversion-copywriting',
  'graphql',
  'logging-expert',
  'iac-terraform',
  'security-privacy',
  'tdd',
  'deep-research',
  'payments-billing',
  'parallel-agents',
];

test('skills: as mais usadas declaram triggers e capabilities em campo próprio', () => {
  const resolver = new SkillResolver({ baseDir: repoRoot });
  const semTrigger: string[] = [];
  const semCapability: string[] = [];

  for (const alias of DECLARAM) {
    const arquivo = path.join(repoRoot, 'skills', alias, 'SKILL.md');
    assert.ok(fs.existsSync(arquivo), `skill "${alias}" não existe mais em skills/: atualize a lista ou o catálogo`);
    const loaded = resolver.loadSkill(alias);
    assert.ok(loaded, `skill "${alias}" não resolve`);
    if (loaded!.manifest.triggers.length === 0) semTrigger.push(alias);
    if (loaded!.manifest.capabilities.length === 0) semCapability.push(alias);
  }

  assert.deepEqual(semTrigger, [], `skills sem triggers declarados: ${semTrigger.join(', ')}`);
  assert.deepEqual(semCapability, [], `skills sem capabilities declaradas: ${semCapability.join(', ')}`);
});

test('skills: o metadado declarado acrescenta VOCABULÁRIO, não repete a descrição', () => {
  // O catálogo v2 já tinha gatilhos, como PROSA dentro da própria description
  // ("Gatilhos de ativação: ..."). Aquilo serve para relevância léxica e não
  // acrescenta um termo sequer ao haystack: são as mesmas palavras duas vezes.
  const resolver = new SkillResolver({ baseDir: repoRoot });
  const semNovidade: string[] = [];
  for (const alias of DECLARAM) {
    const m = resolver.loadSkill(alias)!.manifest;
    const naDescricao = new Set(
      m.description
        .toLowerCase()
        .split(/[^a-záàâãéêíóôõúüç0-9-]+/i)
        .filter((w) => w.length > 3),
    );
    const novos = [...m.triggers, ...m.capabilities]
      .join(' ')
      .toLowerCase()
      .split(/[^a-záàâãéêíóôõúüç0-9-]+/i)
      .filter((w) => w.length > 3 && !naDescricao.has(w));
    if (novos.length < 3) semNovidade.push(alias);
  }
  assert.deepEqual(semNovidade, [], `metadado que só repete a descrição: ${semNovidade.join(', ')}`);
});

test('skills: o ranking usa os campos declarados, e não só a descrição', () => {
  const resolver = new SkillResolver({ baseDir: repoRoot });
  // "red-green-refactor" não aparece na description da skill tdd: se o
  // ranking a encontrar por esse termo, ele está lendo `capabilities`.
  const porCapacidade = resolver.rankSkills('red-green-refactor failing-test-first', 8);
  assert.ok(
    porCapacidade.some((s) => s.alias === 'tdd'),
    `tdd precisa ser encontrada pela capacidade declarada, veio: ${porCapacidade.map((s) => s.alias).join(', ')}`,
  );

  const tdd = resolver.loadSkill('tdd')!.manifest;
  assert.ok(!tdd.description.toLowerCase().includes('red-green-refactor'), 'o termo não pode estar na description');
});
