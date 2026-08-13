/**
 * `izanagi skill list | search <q> | inspect <name>` — Skill Manifest.
 */

import fs from 'fs';
import path from 'path';
import { SkillResolver } from '../../runtime/routing/resolver.js';
import { SkillFactory } from '../../runtime/factories/skill-factory.js';

export function skillCommand(baseDir: string, args: string[]): void {
  const sub = args[0]?.toLowerCase() ?? 'list';

  if (sub === 'list') {
    skillList(baseDir);
    return;
  }
  if (sub === 'search') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi skill search <query>\n');
      process.exit(1);
    }
    skillSearch(baseDir, query);
    return;
  }
  if (sub === 'inspect') {
    const name = args[1];
    if (!name) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi skill inspect <name>\n');
      process.exit(1);
    }
    skillInspect(baseDir, name);
    return;
  }
  if (sub === 'create') {
    const name = args[1];
    const gap = args.find((a) => a.startsWith('--gap='))?.split('=')[1];
    const force = args.includes('--force');
    if (!name) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi skill create <name> [--gap="<descrição da lacuna>"] [--force]\n');
      process.exit(1);
    }
    skillCreate(baseDir, name, gap, force);
    return;
  }
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi skill <list|search|inspect|create> [args]\n');
  process.exit(1);
}

/** Badge de lifecycle — só exibe algo quando foge do caso comum ('active'). */
function lifecycleBadge(lifecycle?: string): string {
  switch (lifecycle) {
    case 'draft':
      return ' \x1b[35m[draft]\x1b[0m';
    case 'discovered':
      return ' \x1b[90m[discovered]\x1b[0m';
    case 'validated':
      return ' \x1b[36m[validated]\x1b[0m';
    case 'deprecated':
      return ' \x1b[33m[deprecated]\x1b[0m';
    case 'archived':
      return ' \x1b[90m[archived]\x1b[0m';
    default:
      return '';
  }
}

export function skillList(baseDir: string): void {
  const resolver = new SkillResolver({ baseDir });
  const skills = resolver.list().sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\n\x1b[35m=== Izanagi AI Skills (${skills.length}) ===\x1b[0m\n`);
  for (const s of skills) {
    console.log(`\x1b[1m\x1b[36m• ${s.name}\x1b[0m \x1b[90m(v${s.version}, ${s.tokenBudget} tok, risco ${s.risk})\x1b[0m${lifecycleBadge(s.lifecycle)}`);
    console.log(`  \x1b[90m${(s.description ?? '').slice(0, 140)}\x1b[0m`);
  }
  console.log('\nDica: \x1b[33mizanagi skill inspect <name>\x1b[0m | \x1b[33mizanagi skill search <query>\x1b[0m\n');
}

export function skillSearch(baseDir: string, query: string): void {
  const resolver = new SkillResolver({ baseDir });
  const results = resolver.search(query, 20);
  console.log(`\n\x1b[35m=== Skill Search: "${query}" (${results.length} resultados) ===\x1b[0m\n`);
  for (const s of results) {
    console.log(`\x1b[1m\x1b[36m• ${s.name}\x1b[0m \x1b[90m(v${s.version})\x1b[0m`);
    console.log(`  \x1b[90m${(s.description ?? '').slice(0, 130)}\x1b[0m`);
    if (s.triggers.length > 0) console.log(`  \x1b[90mTriggers: ${s.triggers.slice(0, 5).join(' | ')}\x1b[0m`);
    console.log('');
  }
}

export function skillInspect(baseDir: string, name: string): void {
  const resolver = new SkillResolver({ baseDir });
  const loaded = resolver.loadSkill(name);
  if (!loaded) {
    console.error(`\x1b[31mSkill "${name}" não encontrada no resolver.\x1b[0m`);
    process.exit(1);
  }
  const m = loaded.manifest;
  console.log(`\n\x1b[35m=== Skill Manifest: ${m.name} ===\x1b[0m\n`);
  console.log(`  \x1b[90mArquivo:\x1b[0m ${m.path}`);
  console.log(`  \x1b[90mVersão:\x1b[0m ${m.version}`);
  console.log(`  \x1b[90mLifecycle:\x1b[0m ${m.lifecycle ?? 'active'}${lifecycleBadge(m.lifecycle)}`);
  console.log(`  \x1b[90mRisco:\x1b[0m ${m.risk}`);
  console.log(`  \x1b[90mToken budget:\x1b[0m ${m.tokenBudget}`);
  console.log(`  \x1b[90mCompatibilidade:\x1b[0m ${m.compatibility}`);
  console.log(`\n  \x1b[1mDescription:\x1b[0m ${m.description}`);
  console.log(`\n  \x1b[1mTriggers (${m.triggers.length}):\x1b[0m`);
  m.triggers.forEach((t) => console.log(`    • ${t}`));
  console.log(`\n  \x1b[1mDependencies:\x1b[0m ${m.dependencies.join(', ') || '—'}`);
  console.log(`  \x1b[1mInputs:\x1b[0m ${m.inputs.join(', ') || '—'}`);
  console.log(`  \x1b[1mOutputs:\x1b[0m ${m.outputs.join(', ') || '—'}`);
  console.log(`  \x1b[1mPermissions:\x1b[0m ${m.permissions.join(', ') || '—'}`);
  if (m.examples?.length) {
    console.log(`\n  \x1b[1mExamples:\x1b[0m`);
    m.examples.forEach((e) => console.log(`    • ${e}`));
  }
  if (m.changelog?.length) {
    console.log(`\n  \x1b[1mChangelog:\x1b[0m`);
    m.changelog.forEach((c) => console.log(`    • v${c.version}: ${c.change}`));
  }
  console.log('');
}

export function skillCreate(baseDir: string, name: string, gap?: string, force = false): void {
  // Modo Skill Factory: pipeline real (detecção de lacuna + security scan + registro)
  if (gap) {
    const resolver = new SkillResolver({ baseDir });
    const factory = new SkillFactory(resolver);
    try {
      const generated = factory.generate({ gap, name, force });
      if (!generated.registered) {
        console.error(`\n\x1b[31mSkill Factory recusou o registro:\x1b[0m`);
        generated.validation.issues.forEach((i) => console.error(`  • ${i}`));
        console.error('  Nenhum arquivo foi criado.\n');
        process.exit(1);
      }
      console.log(`\n\x1b[32m? Skill criada via Skill Factory:\x1b[0m ${generated.file}`);
      console.log(`  \x1b[90mTrigers:\x1b[0m ${generated.manifest.triggers.join(', ')}`);
      console.log(`  \x1b[90mSecurity scan:\x1b[0m ${generated.scan.level} (${generated.scan.findings.length} findings)`);
      console.log(`  \x1b[90mValidação:\x1b[0m ${generated.validation.valid ? 'OK' : generated.validation.issues.join('; ')}`);
      console.log('  Registre o alias em \x1b[33mcore/skill-resolver.json\x1b[0m e rode \x1b[33mnpm run build\x1b[0m.\n');
    } catch (e) {
      console.error(`\x1b[31mSkill Factory falhou:\x1b[0m ${e instanceof Error ? e.message : String(e)}`);
      console.error('  (Se a lacuna já é coberta por skills existentes, use --force para gerar mesmo assim.)\n');
      process.exit(1);
    }
    return;
  }
  const skillsDir = path.join(baseDir, 'skills', name);
  const file = path.join(skillsDir, 'SKILL.md');
  if (fs.existsSync(file)) {
    console.error(`\x1b[31mSkill "${name}" já existe.\x1b[0m`);
    process.exit(1);
  }
  fs.mkdirSync(skillsDir, { recursive: true });
  const template = `---
name: ${name}
description: "Skill de ${name}: workflow, regras e validação."
version: 1.0.0
triggers:
  - task related to ${name}
capabilities:
  - ${name}
dependencies: []
token_budget: 1000
compatibility: ">=2.0.0"
risk: low
---

# ${name}

## Identity

## Goals

## Workflow

## Rules

## Validation
`;
  fs.writeFileSync(file, template, 'utf-8');
  console.log(`\n\x1b[32m✔ Skill criada:\x1b[0m ${file}`);
  console.log(`  Registre o alias em \x1b[33mcore/skill-resolver.json\x1b[0m e rode \x1b[33mnpm run build\x1b[0m para atualizar o manifest.\n`);
}
