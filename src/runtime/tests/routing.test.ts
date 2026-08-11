import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CandidateScorer, semanticRelevance } from '../routing/scorer.js';
import { SkillResolver, parseFrontmatter } from '../routing/resolver.js';
import { AgentFactory, validateGenome } from '../factories/agent-factory.js';
import { SkillFactory } from '../factories/skill-factory.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-rt-'));
}

test('scorer: score ponderado com pesos da missão', () => {
  const s = new CandidateScorer().score({
    candidate: 'database-agent',
    relevance: 0.97,
    historicalSuccess: 0.93,
    compatibility: 1,
    risk: 0.08,
    cost: 0.31,
  });
  assert.ok(s.finalScore > 0.85);
  assert.ok(s.reasons.length >= 2);
});

test('scorer: risco alto penaliza mesmo com relevância alta', () => {
  const s = new CandidateScorer().score({
    candidate: 'x',
    relevance: 1,
    historicalSuccess: 0.9,
    compatibility: 1,
    risk: 0.95,
    cost: 0.95,
  });
  assert.ok(s.finalScore < 0.85);
  assert.ok(s.reasons.some((r) => r.includes('risco')));
});

test('scorer: semântica determinística', () => {
  const a = semanticRelevance('criar banco de dados postgres com indices', 'modelagem banco de dados sql');
  const b = semanticRelevance('modelagem banco de dados sql', 'criar banco de dados postgres com indices');
  assert.ok(a > 0.5, `a=${a}`);
  assert.ok(b > 0.5, `b=${b}`);
  assert.equal(semanticRelevance('xyzabc', 'completamente diferente'), 0);
});

test('scorer: ranking manual por finalScore', () => {
  const scorer = new CandidateScorer();
  const low = scorer.score({ candidate: 'low', relevance: 0.1, historicalSuccess: 0.1, compatibility: 0.1, risk: 0.9, cost: 0.9 });
  const high = scorer.score({ candidate: 'high', relevance: 0.99, historicalSuccess: 0.99, compatibility: 1, risk: 0.01, cost: 0.01 });
  assert.ok(high.finalScore > low.finalScore);
});

test('resolver: parseFrontmatter extrai campos', () => {
  const fm = parseFrontmatter(`---
name: tdd
description: Test Driven Development
version: 1.0.0
triggers: [test, tdd]
compatibility: ">= 2.0.0"
---
Conteúdo da skill...`);
  assert.equal(fm.name, 'tdd');
  assert.equal(fm.version, '1.0.0');
  assert.deepEqual(fm.triggers, ['test', 'tdd']);
});

test('resolver: em baseDir vazio não há aliases nem skills', () => {
  const base = tmpDir();
  const resolver = new SkillResolver({ baseDir: base });
  assert.equal(resolver.aliasCount, 0);
  assert.equal(resolver.resolvePath('nao-existe'), null);
  assert.equal(resolver.loadSkill('nao-existe'), null);
  assert.equal(resolver.loadAgent('ghost'), null);
});

test('resolver: resolve aliases do skill-resolver.json real', () => {
  const resolver = new SkillResolver({ baseDir: process.cwd() });
  assert.ok(resolver.aliasCount > 200, `aliases carregados: ${resolver.aliasCount}`);
  const tddPath = resolver.resolvePath('tdd');
  assert.ok(tddPath, 'alias tdd deve resolver');
  const loaded = resolver.loadSkill('tdd');
  assert.ok(loaded, 'skill tdd deve carregar');
  assert.equal(loaded.manifest.name, 'tdd');
  assert.ok((loaded.manifest.body ?? '').length > 0);
});

test('resolver: loadAgent retorna genome de agentes reais', () => {
  const resolver = new SkillResolver({ baseDir: process.cwd() });
  const qa = resolver.loadAgent('qa');
  assert.ok(qa, 'agente qa deve existir');
  assert.ok(qa.genome.requiredSkills.length > 0);
  const v = validateGenome(qa.genome);
  assert.equal(v.valid, true, v.issues.join('; '));
});

test('factory: AgentFactory gera genome válido e arquivo em targetDir', () => {
  const base = tmpDir();
  const resolver = new SkillResolver({ baseDir: base });
  const factory = new AgentFactory(resolver);
  const target = path.join(base, 'agents', 'generated');
  const out = factory.generate({
    requirement: 'migração de PHP legado para Laravel',
    name: 'php-laravel-migrator',
    requiredSkills: ['frontend'],
    targetDir: target,
  });
  assert.equal(out.validation.valid, true, out.validation.issues.join('; '));
  assert.equal(out.genome.name, 'Php Laravel Migrator');
  assert.ok(out.genome.capabilities.some((c) => c.includes('migra')));
  assert.ok(fs.existsSync(out.file));
  const parsed = JSON.parse(fs.readFileSync(out.file, 'utf-8'));
  assert.ok(parsed.requiredSkills.length > 0);
  assert.ok(parsed.handoffs.length >= 2);
});

test('factory: AgentFactory valida genome (rejeita vazio)', () => {
  const v = validateGenome({
    name: '', version: '', purpose: 'x', capabilities: [],
    requiredSkills: [], optionalSkills: [], inputs: [], outputs: [],
    constraints: [], permissions: [], handoffs: [], memory: [],
    evaluation: { metrics: [], minScore: 0.5 }, tokenBudget: 0, compatibility: '>=2.0.0',
  });
  assert.equal(v.valid, false);
  assert.ok(v.issues.length >= 3);
});

test('factory: SkillFactory gera manifest completo em targetDir', () => {
  const base = tmpDir();
  const resolver = new SkillResolver({ baseDir: base });
  const factory = new SkillFactory(resolver);
  const target = path.join(base, 'skills', 'generated');
  const out = factory.generate({
    gap: 'trabalhar com filas RabbitMQ com dead letter e retry',
    targetDir: target,
  });
  assert.equal(out.scan.level, 'LOW');
  assert.equal(out.registered, true);
  assert.ok(out.manifest.capabilities.some((c) => c.toLowerCase() === 'rabbitmq'));
  assert.equal(out.manifest.version, '1.0.0');
  assert.ok(out.manifest.tokenBudget > 0);
  assert.ok((out.manifest.changelog ?? []).length >= 1);
  assert.ok(fs.existsSync(out.file));
  const content = fs.readFileSync(out.file, 'utf-8');
  assert.ok(content.startsWith('---'));
  assert.ok(content.includes('compatibility'));
});

test('factory: SkillFactory detecta lacuna já coberta (anti-poluição)', () => {
  const base = tmpDir();
  fs.mkdirSync(path.join(base, 'skills', 'filas'), { recursive: true });
  fs.mkdirSync(path.join(base, 'core'), { recursive: true });
  fs.writeFileSync(
    path.join(base, 'skills', 'filas', 'SKILL.md'),
    '---\nname: filas\ndescription: "trabalhar com filas rabbitmq, dead letter e retry"\ntriggers:\n  - rabbitmq\n  - filas\n---\n# Filas\n',
    'utf-8',
  );
  fs.writeFileSync(path.join(base, 'core', 'skill-resolver.json'), JSON.stringify({ aliases: { filas: 'skills/filas/SKILL' }, compositions: {} }), 'utf-8');
  const resolver = new SkillResolver({ baseDir: base });
  const factory = new SkillFactory(resolver);
  assert.throws(() => factory.generate({ gap: 'trabalhar com filas RabbitMQ com dead letter e retry' }), /coberta/);
});
