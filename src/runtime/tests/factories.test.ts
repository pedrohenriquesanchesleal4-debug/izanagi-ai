import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillResolver } from '../routing/resolver.js';
import { AgentFactory, validateGenome } from '../factories/agent-factory.js';
import { SkillFactory } from '../factories/skill-factory.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-factory-'));
}

const repoBase = process.cwd();

test('agent factory: gera genome completo, valida e registra em agents/generated', () => {
  const baseDir = tmpDir();
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new AgentFactory(resolver);
  const generated = factory.generate({
    requirement: 'migração de PHP legado para Laravel',
    targetDir: path.join(baseDir, 'agents', 'generated'),
  });

  assert.ok(generated.validation.valid, `genome válido: ${generated.validation.issues.join('; ')}`);
  assert.ok(generated.genome.name.toLowerCase().includes('laravel'), `nome derivado da requirement: ${generated.genome.name}`);
  assert.ok(generated.genome.capabilities.some((c) => /php|laravel/i.test(c)), 'capabilities derivadas');
  assert.ok(generated.chain.length >= 1, 'chain de skills não vazia');
  assert.ok(generated.genome.requiredSkills.length >= 1, 'requiredSkills preenchidas');
  assert.ok(fs.existsSync(generated.file), 'arquivo do genome gravado');
  assert.match(generated.file, /agents[\\/]generated[\\/].*-agent\.json$/, 'registrado em agents/generated/');
});

test('agent factory: agente gerado é descoberto pelo resolver (loadAgent)', () => {
  const baseDir = tmpDir();
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new AgentFactory(resolver);
  const generated = factory.generate({
    requirement: 'automação de planilhas financeiras',
    targetDir: path.join(baseDir, 'agents', 'generated'),
  });
  const id = path.basename(generated.file).replace(/-agent\.json$/, '');

  const withGenerated = new SkillResolver({ baseDir });
  const loaded = withGenerated.loadAgent(id);
  assert.ok(loaded, 'loadAgent encontra o agente gerado');
  assert.equal(loaded!.genome.name, generated.genome.name);
  assert.equal(loaded!.file, generated.file);
});

test('agent factory: genome com purpose curto é rejeitado (anti-stub)', () => {
  const issues = validateGenome({
    name: 'X',
    version: '1.0.0',
    purpose: 'curto',
    capabilities: ['x'],
    requiredSkills: ['qa'],
    optionalSkills: [],
    inputs: ['task'],
    outputs: ['implementation'],
    constraints: [],
    permissions: [],
    handoffs: [],
    memory: [],
    evaluation: { metrics: ['correctness'], minScore: 0.7 },
    tokenBudget: 1000,
    compatibility: '>=2.0.0',
  });
  assert.ok(!issues.valid, 'genome inválido');
  assert.ok(issues.issues.some((i) => i.includes('purpose')), 'aponta purpose curto');
});

test('skill factory: lacuna coberta é recusada sem force (anti-poluição)', () => {
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new SkillFactory(resolver);
  const { covered } = factory.detectCoverage('testes automatizados com playwright');
  assert.ok(covered, 'lacuna de testes já coberta');
  assert.throws(
    () => factory.generate({ gap: 'testes automatizados com playwright' }),
    /já coberta por/,
    'gera erro em vez de duplicar skill',
  );
});

test('skill factory: lacuna real gera skill com scan LOW e registro em pasta própria', () => {
  const baseDir = tmpDir();
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new SkillFactory(resolver);
  const generated = factory.generate({
    gap: 'orquestração de filas rabbitmq com retry',
    force: true,
    targetDir: path.join(baseDir, 'skills', 'generated'),
  });

  assert.ok(generated.registered, 'skill registrada');
  assert.equal(generated.scan.level, 'LOW', `security scan limpo (${generated.scan.level})`);
  assert.ok(generated.validation.valid, 'artefato válido');
  assert.ok(fs.existsSync(generated.file), 'arquivo criado');
  assert.match(generated.file, /skills[\\/]generated[\\/].+[\\/]SKILL\.md$/, 'pasta própria por skill (sem overwrite)');
  const content = fs.readFileSync(generated.file, 'utf-8');
  assert.match(content, /^---\r?\nname:/, 'frontmatter presente');
  assert.match(content, /## Workflow/, 'corpo com workflow real');
});

test('skill factory: lacuna inexistente não é considerada coberta', () => {
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new SkillFactory(resolver);
  const { covered, candidates } = factory.detectCoverage('fabricação de tecidos de algodão orgânico');
  assert.ok(!covered, 'não coberta');
  assert.ok(Array.isArray(candidates));
});
