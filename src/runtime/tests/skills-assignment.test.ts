import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Skills Assignment: zero unreferenced skills across the framework', () => {
  const getSkills = (dir: string) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => fs.existsSync(path.join(dir, f, 'SKILL.md')));
  };

  const v1 = getSkills('skills');
  const v2 = getSkills('.skills');
  const allSkills = Array.from(new Set([...v1, ...v2])).sort();

  const resolverJson = JSON.parse(fs.readFileSync('core/skill-resolver.json', 'utf-8'));
  const aliases = resolverJson.aliases || {};

  const resolveToSkillName = (s: string) => {
    if (allSkills.includes(s)) return s;
    if (aliases[s]) {
      const target = aliases[s].replace(/\/SKILL$/, '');
      const base = path.basename(target);
      if (allSkills.includes(base)) return base;
    }
    return s;
  };

  const agentsDir = 'agents';
  const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.json'));
  const allResolvedSkills = new Set<string>();

  for (const f of agentFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
    const skills = [
      ...(content.skills || []),
      ...(content.requiredSkills || []),
      ...Object.values(content.chains || {}).flat() as string[],
    ];
    for (const s of skills) {
      allResolvedSkills.add(resolveToSkillName(s));
    }
  }

  const unreferenced = allSkills.filter((s) => !allResolvedSkills.has(s));
  assert.equal(
    unreferenced.length,
    0,
    `Não pode haver skills soltas/não referenciadas! Encontradas: ${unreferenced.join(', ')}`,
  );
});

test('Agent Genomes: todos os agentes possuem skills e chains atribuídas', () => {
  const agentsDir = 'agents';
  const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.json'));

  for (const f of agentFiles) {
    const content = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
    assert.ok(
      Array.isArray(content.skills) && content.skills.length > 0,
      `Agente ${f} deve possuir array de skills não-vazio`,
    );
    assert.ok(
      content.chains && Object.keys(content.chains).length > 0,
      `Agente ${f} deve possuir chains de execução`,
    );
  }
});

test('CLI Adapters: exportações incluem cláusulas de uso obrigatório de skills', () => {
  // 1. OpenCode
  const opencodeFile = path.join('.opencode', 'agent', 'senior-engineer.md');
  assert.ok(fs.existsSync(opencodeFile), '.opencode senior-engineer.md deve existir');
  const opencodeContent = fs.readFileSync(opencodeFile, 'utf-8');
  assert.match(opencodeContent, /## Skills Obrigatórias \(Mandatory Skills\)/);
  assert.match(opencodeContent, /CLÁUSULA DE USO OBRIGATÓRIO DE SKILLS/);

  // 2. Claude Code
  const claudeAgentFile = path.join('.claude', 'agents', 'senior-engineer.md');
  assert.ok(fs.existsSync(claudeAgentFile), '.claude senior-engineer.md deve existir');
  const claudeContent = fs.readFileSync(claudeAgentFile, 'utf-8');
  assert.match(claudeContent, /## Skills Obrigatórias \(Mandatory Skills - Uso Estrito\)/);
  assert.match(claudeContent, /CLÁUSULA DE USO OBRIGATÓRIO DE SKILLS/);

  // 3. Antigravity
  const agSkillFile = path.join('.agents', 'skills', 'izanagi-senior-engineer', 'SKILL.md');
  assert.ok(fs.existsSync(agSkillFile), 'Antigravity izanagi-senior-engineer SKILL.md deve existir');
  const agContent = fs.readFileSync(agSkillFile, 'utf-8');
  assert.match(agContent, /## Skills Obrigatórias \(Mandatory Skills\)/);
  assert.match(agContent, /DIRETRIZ DE USO MANDATÓRIO/);
});

test('Token Economy: selectRelevantSkills carrega cirurgicamente apenas as skills relevantes para a tarefa', async () => {
  const { selectRelevantSkills } = await import('../../cli/commands/run.js');

  const candidates = [
    'browser-playwright',
    'graphql',
    'wasm',
    'mobile-dev',
    'web-design-guidelines',
    'database',
  ];

  // 1. Tarefa de teste de UI/Playwright deve selecionar browser-playwright e web-design-guidelines
  const uiTest = selectRelevantSkills(candidates, 'executar testes e2e de navegacao com playwright', 2);
  assert.ok(uiTest.includes('browser-playwright'), 'deve selecionar browser-playwright');
  assert.ok(uiTest.length <= 2, 'não pode carregar mais que o limite (2 skills)');

  // 2. Tarefa de GraphQL deve selecionar graphql
  const apiTest = selectRelevantSkills(candidates, 'desenvolver schema graphql e resolvers da api', 2);
  assert.ok(apiTest.includes('graphql'), 'deve selecionar graphql');
  assert.ok(!apiTest.includes('mobile-dev'), 'não deve carregar mobile-dev desnecessariamente');

  // 3. Tarefa genérica sem palavras-chave carrega no máximo 1 skill primária
  const genericTest = selectRelevantSkills(candidates, 'tarefa generica sem termos especificos', 2);
  assert.equal(genericTest.length, 1, 'tarefa genérica carrega apenas 1 skill primária');
});

