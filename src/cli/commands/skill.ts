/**
 * `izanagi skill list | search <q> | inspect <name>` — Skill Manifest.
 */

import fs from 'fs';
import path from 'path';
import { SkillResolver } from '../../runtime/routing/resolver.js';
import { SkillFactory } from '../../runtime/factories/skill-factory.js';
import { SkillManager } from '../../runtime/skills/manager.js';

export async function skillCommand(baseDir: string, args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase() ?? 'list';

  if (sub === 'list') {
    const installedOnly = args.includes('--installed');
    skillList(baseDir, installedOnly);
    return;
  }
  if (sub === 'search' || sub === 'find') {
    const query = args.slice(1).filter((a) => !a.startsWith('--')).join(' ');
    if (!query) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi skill search <query> [--stack=<stack>]\n');
      process.exit(1);
    }
    const stack = args.find((a) => a.startsWith('--stack='))?.split('=')[1];
    skillSearch(baseDir, query, stack);
    return;
  }
  if (sub === 'install' || sub === 'add') {
    const source = args[1];
    if (!source) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi skill install <source> [--force] [--global] [--as=<name>]\n');
      process.exit(1);
    }
    const force = args.includes('--force');
    const global = args.includes('--global') || args.includes('-g');
    const asName = args.find((a) => a.startsWith('--as='))?.split('=')[1];
    await skillInstall(baseDir, source, { force, global, asName });
    return;
  }
  if (sub === 'remove' || sub === 'uninstall') {
    const name = args[1];
    if (!name) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi skill remove <name> [--global]\n');
      process.exit(1);
    }
    const global = args.includes('--global') || args.includes('-g');
    skillRemove(baseDir, name, global);
    return;
  }
  if (sub === 'update' || sub === 'upgrade') {
    const name = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
    const force = args.includes('--force');
    const global = args.includes('--global') || args.includes('-g');
    await skillUpdate(baseDir, name, { force, global });
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
    const stacks = args.find((a) => a.startsWith('--stack='))?.split('=')[1]?.split(',').filter(Boolean);
    if (!name) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi skill create <name> [--gap="<descrição da lacuna>"] [--stack=go,rust] [--force]\n');
      process.exit(1);
    }
    skillCreate(baseDir, name, gap, force, stacks);
    return;
  }
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi skill <list|search|find|inspect|install|remove|update|create> [args]\n');
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

export function skillList(baseDir: string, installedOnly = false): void {
  const manager = new SkillManager({ baseDir });
  const installed = manager.listInstalled();

  if (installedOnly) {
    console.log(`\n\x1b[35m=== Izanagi AI Installed Skills (${installed.length}) ===\x1b[0m\n`);
    if (installed.length === 0) {
      console.log('  \x1b[90mNenhuma skill externa instalada via `izanagi skill install`.\x1b[0m\n');
      return;
    }
    for (const item of installed) {
      console.log(`\x1b[1m\x1b[36m• ${item.name}\x1b[0m \x1b[90m(v${item.version}, risco ${item.riskLevel})\x1b[0m`);
      console.log(`  \x1b[90mFonte:\x1b[0m ${item.source} · \x1b[90mInstalado em:\x1b[0m ${item.installedAt.slice(0, 10)}`);
      console.log(`  \x1b[90mDestino:\x1b[0m ${item.destination}`);
    }
    console.log('');
    return;
  }

  const resolver = new SkillResolver({ baseDir });
  const skills = resolver.list().sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\n\x1b[35m=== Izanagi AI Skills (${skills.length}) ===\x1b[0m\n`);
  for (const s of skills) {
    console.log(`\x1b[1m\x1b[36m• ${s.name}\x1b[0m \x1b[90m(v${s.version}, ${s.tokenBudget} tok, risco ${s.risk})\x1b[0m${lifecycleBadge(s.lifecycle)}`);
    console.log(`  \x1b[90m${(s.description ?? '').slice(0, 140)}\x1b[0m`);
  }
  if (installed.length > 0) {
    console.log(`\n\x1b[32m✔ ${installed.length} skills externas gerenciadas instaladas (\`izanagi skill list --installed\`).\x1b[0m`);
  }
  console.log('\nDica: \x1b[33mizanagi skill inspect <name>\x1b[0m | \x1b[33mizanagi skill search <query>\x1b[0m | \x1b[33mizanagi skill install <source>\x1b[0m\n');
}

export function skillSearch(baseDir: string, query: string, stack?: string): void {
  const resolver = new SkillResolver({ baseDir });
  const results = resolver.search(query, { limit: 20, stack });
  console.log(`\n\x1b[35m=== Skill Search: "${query}"${stack ? ` [stack=${stack}]` : ''} (${results.length} resultados) ===\x1b[0m\n`);
  for (const s of results) {
    console.log(`\x1b[1m\x1b[36m• ${s.name}\x1b[0m \x1b[90m(v${s.version}, risco ${s.risk})\x1b[0m${lifecycleBadge(s.lifecycle)}`);
    console.log(`  \x1b[90m${(s.description ?? '').slice(0, 130)}\x1b[0m`);
    if (s.triggers.length > 0) console.log(`  \x1b[90mTriggers: ${s.triggers.slice(0, 5).join(' | ')}\x1b[0m`);
    console.log('');
  }
}

export async function skillInstall(
  baseDir: string,
  source: string,
  opts: { force?: boolean; global?: boolean; asName?: string } = {}
): Promise<void> {
  console.log(`\n\x1b[36m=== Izanagi AI Skill Installer ===\x1b[0m`);
  console.log(`  \x1b[90mFonte:\x1b[0m ${source}`);
  console.log(`  \x1b[90mEscopo:\x1b[0m ${opts.global ? 'Global (~/.agents/skills)' : 'Projeto (.agents/skills)'}\n`);

  const manager = new SkillManager({ baseDir });
  try {
    const res = await manager.install(source, { ...opts, baseDir });
    console.log(` \x1b[32m✔\x1b[0m Skill \x1b[1m${res.name}\x1b[0m instalada com sucesso!`);
    console.log(`   \x1b[90mDestino:\x1b[0m ${res.destination}`);
    console.log(`   \x1b[90mNível de risco detectado:\x1b[0m ${res.scan.level}`);
    if (res.warning) {
      console.log(`   \x1b[33m⚠ Aviso de segurança:\x1b[0m ${res.warning}`);
    }
    console.log('');
  } catch (err: any) {
    console.error(`\x1b[31m✖ Erro ao instalar skill:\x1b[0m ${err.message}\n`);
    process.exit(1);
  }
}

export function skillRemove(baseDir: string, name: string, global = false): void {
  const manager = new SkillManager({ baseDir });
  const ok = manager.remove(name, { global });
  if (ok) {
    console.log(`\n\x1b[32m✔\x1b[0m Skill \x1b[1m${name}\x1b[0m removida com sucesso.\n`);
  } else {
    console.log(`\n\x1b[33m•\x1b[0m Skill "${name}" não encontrada no gerenciador.\n`);
  }
}

export async function skillUpdate(
  baseDir: string,
  name?: string,
  opts: { force?: boolean; global?: boolean } = {}
): Promise<void> {
  console.log(`\n\x1b[36m=== Izanagi AI Skill Updater ===\x1b[0m`);
  console.log(`  \x1b[90mAlvo:\x1b[0m ${name ? name : 'Todas as skills instaladas'}`);
  console.log(`  \x1b[90mEscopo:\x1b[0m ${opts.global ? 'Global (~/.agents/skills)' : 'Projeto (.agents/skills)'}\n`);

  const manager = new SkillManager({ baseDir });
  try {
    const updated = await manager.update(name, opts);
    if (updated.length === 0) {
      console.log(`\x1b[33m•\x1b[0m Nenhuma skill instalada encontrada para atualizar.\n`);
      return;
    }
    for (const res of updated) {
      console.log(` \x1b[32m✔\x1b[0m Skill \x1b[1m${res.name}\x1b[0m atualizada com sucesso!`);
      console.log(`   \x1b[90mDestino:\x1b[0m ${res.destination}`);
      console.log(`   \x1b[90mNível de risco:\x1b[0m ${res.scan.level}`);
      if (res.warning) {
        console.log(`   \x1b[33m⚠ Aviso de segurança:\x1b[0m ${res.warning}`);
      }
      console.log('');
    }
  } catch (err: any) {
    console.error(`\x1b[31m✖ Erro ao atualizar skill:\x1b[0m ${err.message}\n`);
    process.exit(1);
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
  if (m.stacks?.length) console.log(`  \x1b[90mStacks:\x1b[0m ${m.stacks.join(', ')}`);
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

export function skillCreate(baseDir: string, name: string, gap?: string, force = false, stacks?: string[]): void {
  // Modo Skill Factory: pipeline real (detecção de lacuna + security scan + registro)
  if (gap) {
    const resolver = new SkillResolver({ baseDir });
    const factory = new SkillFactory(resolver);
    try {
      const generated = factory.generate({ gap, name, force, stacks: stacks as import('../../runtime/types.js').Stack[] | undefined });
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
