import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillResolver } from '../routing/resolver.js';
import { AgentFactory, validateGenome } from '../factories/agent-factory.js';
import { SkillFactory, validateSkillGenome } from '../factories/skill-factory.js';

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

test('agent factory: stack rust entra no genome com capabilities, guardrails e identity da stack', () => {
  const baseDir = tmpDir();
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new AgentFactory(resolver);
  const generated = factory.generate({
    requirement: 'otimização de desempenho de API de pagamentos',
    stack: 'rust',
    targetDir: path.join(baseDir, 'agents', 'generated'),
  });

  assert.ok(generated.validation.valid, `genome válido: ${generated.validation.issues.join('; ')}`);
  assert.ok(generated.genome.stacks?.includes('rust'), `stacks do genome: ${generated.genome.stacks}`);
  assert.ok(
    generated.genome.capabilities.some((c) => /rust|cargo|clippy/i.test(c)),
    `capabilities da stack rust: ${generated.genome.capabilities.join(', ')}`,
  );
  assert.ok(
    (generated.genome.never ?? []).some((c) => /cargo|clippy|rust/i.test(c)),
    `guardrails de validação da stack: ${generated.genome.never?.join('; ')}`,
  );
  assert.ok(generated.genome.identity?.toLowerCase().includes('rust'), 'identity menciona a stack');
  const onDisk = JSON.parse(fs.readFileSync(generated.file, 'utf-8'));
  assert.deepEqual(onDisk.stacks, ['rust'], 'stack persistida no genome em disco');
});

test('agent factory: default sem stack declarada é all', () => {
  const baseDir = tmpDir();
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new AgentFactory(resolver);
  const generated = factory.generate({
    requirement: 'integração de webhooks com idempotência',
    targetDir: path.join(baseDir, 'agents', 'generated'),
  });
  assert.ok(generated.validation.valid);
  assert.ok(Array.isArray(generated.genome.stacks) && generated.genome.stacks.length >= 1, 'stacks sempre presentes');
});

test('agent factory: validateGenome rejeita stack desconhecido', () => {
  const issues = validateGenome({
    name: 'X',
    version: '1.0.0',
    purpose: 'propósito válido e longo o bastante',
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
    stacks: ['ruby' as 'all'],
  });
  assert.ok(!issues.valid, 'genome com stack desconhecida é inválido');
  assert.ok(issues.issues.some((i) => i.includes('stack')), `aponta stack: ${issues.issues.join('; ')}`);
});

test('skill factory: validateSkillGenome rejeita genome inválido (Skill Genome)', () => {
  const issues = validateSkillGenome({
    name: 'x',
    version: 'abc',
    description: 'curto',
    capabilities: [],
    triggers: [],
    dependencies: [],
    inputs: ['task'],
    outputs: ['implementation'],
    permissions: ['sudo'],
    compatibility: '>=2.0.0',
    risk: 'huge' as 'medium',
    tokenBudget: 0,
  });
  assert.ok(!issues.valid, 'skill genome inválido');
  for (const needle of ['description', 'version', 'triggers', 'capabilities', 'permissions', 'risk', 'tokenBudget']) {
    assert.ok(issues.issues.some((i) => i.includes(needle)), `aponta ${needle}: ${issues.issues.join('; ')}`);
  }
});

test('skill factory: stacks no input entram no frontmatter e na validação do corpo', () => {
  const baseDir = tmpDir();
  const resolver = new SkillResolver({ baseDir: repoBase });
  const factory = new SkillFactory(resolver);
  const generated = factory.generate({
    gap: 'migração de dados com transações atômicas',
    stacks: ['go', 'rust'],
    force: true,
    targetDir: path.join(baseDir, 'skills', 'generated'),
  });

  assert.ok(generated.registered, 'skill registrada');
  assert.ok(generated.validation.valid, `genome válido: ${generated.validation.issues.join('; ')}`);
  const content = fs.readFileSync(generated.file, 'utf-8');
  assert.match(content, /^stacks:$/m, 'frontmatter tem bloco stacks');
  assert.match(content, /^  - go$/m, 'frontmatter declara go');
  assert.match(content, /^  - rust$/m, 'frontmatter declara rust');
  assert.match(content, /go vet .*go test/, 'validação da stack Go no corpo');
  assert.match(content, /cargo clippy .*cargo test/, 'validação da stack Rust no corpo');
});

test('skill factory: genome válido é aceito e default sem stacks não grava stacks no frontmatter', () => {
  const ok = validateSkillGenome({
    name: 'migracao-dados',
    version: '1.0.0',
    description: 'migra dados com consistência e retomada por checkpoint',
    capabilities: ['migração', 'transações'],
    triggers: ['migração de dados'],
    dependencies: [],
    inputs: ['task'],
    outputs: ['implementation'],
    permissions: ['fs:read', 'fs:write'],
    compatibility: '>=2.0.0',
    risk: 'medium',
    tokenBudget: 1200,
  });
  assert.ok(ok.valid, `skill genome válido: ${ok.issues.join('; ')}`);

  const baseDir = tmpDir();
  const factory = new SkillFactory(new SkillResolver({ baseDir: repoBase }));
  const generated = factory.generate({
    gap: 'carga incremental de arquivos parquet',
    force: true,
    targetDir: path.join(baseDir, 'skills', 'generated'),
  });
  const content = fs.readFileSync(generated.file, 'utf-8');
  assert.ok(!/^stacks:/m.test(content), 'sem stacks explícitas, sem bloco stacks no frontmatter (default all)');
});
