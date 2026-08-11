/**
 * `izanagi agent list | inspect <name>` — inspeciona agentes via Agent Genome.
 */

import fs from 'fs';
import path from 'path';
import { SkillResolver } from '../../runtime/routing/resolver.js';
import { AgentFactory } from '../../runtime/factories/agent-factory.js';

export function agentCommand(baseDir: string, args: string[]): void {
  const sub = args[0]?.toLowerCase() ?? 'list';

  if (sub === 'list') {
    agentList(baseDir);
    return;
  }
  if (sub === 'inspect') {
    const name = args[1];
    if (!name) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi agent inspect <name>\n');
      process.exit(1);
    }
    agentInspect(baseDir, name);
    return;
  }
  if (sub === 'create') {
    const requirement = args
      .slice(1)
      .filter((a) => !a.startsWith('--'))
      .join(' ');
    const nameFlag = args.find((a) => a.startsWith('--name='))?.split('=')[1];
    const skillsFlag = args.find((a) => a.startsWith('--skills='))?.split('=')[1];
    if (!requirement) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi agent create "<requirement>" [--name=slug] [--skills=a,b]\n');
      process.exit(1);
    }
    agentCreate(baseDir, requirement, { name: nameFlag, requiredSkills: skillsFlag?.split(',') });
    return;
  }
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi agent <list|inspect|create> [args]\n');
  process.exit(1);
}

export function agentList(baseDir: string): void {
  const dirs = [
    path.join(baseDir, 'agents'),
    path.join(baseDir, 'agents', 'generated'),
    path.join(baseDir, '.agents', 'agents'),
  ];
  const seen = new Set<string>();
  const agents: Array<{ id: string; genome: NonNullable<ReturnType<SkillResolver['loadAgent']>>['genome'] }> = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f: string) => f.endsWith('.json'))) {
      if (seen.has(f)) continue;
      seen.add(f);
      const id = f.replace(/-agent\.json$/, '').replace(/\.json$/, '');
      const resolver = new SkillResolver({ baseDir });
      const loaded = resolver.loadAgent(id);
      if (loaded) {
        agents.push({ id, genome: loaded.genome });
      }
    }
  }

  console.log(`\n\x1b[35m=== Izanagi AI Agents (${agents.length}) — Agent Genome ===\x1b[0m\n`);
  for (const { id, genome } of agents.sort((a, b) => a.id.localeCompare(b.id))) {
    const skills = genome.requiredSkills.slice(0, 5).join(', ') + (genome.requiredSkills.length > 5 ? '...' : '');
    console.log(`\x1b[1m\x1b[36m• ${genome.name}\x1b[0m \x1b[90m(${id}, v${genome.version})\x1b[0m`);
    console.log(`  \x1b[90mPurpose:\x1b[0m ${(genome.purpose ?? '—').slice(0, 110)}`);
    console.log(`  \x1b[90mSkills:\x1b[0m ${skills || '—'}`);
    console.log(`  \x1b[90mOutputs:\x1b[0m ${genome.outputs.join(', ')}`);
    console.log(`  \x1b[90mHandoffs:\x1b[0m ${genome.handoffs.length > 0 ? genome.handoffs.map((h: { to: string }) => h.to).join(', ') : '—'}\n`);
  }
  console.log('Dica: \x1b[33mizanagi agent inspect <name>\x1b[0m para ver o genome completo.\n');
}

export function agentInspect(baseDir: string, name: string): void {
  const resolver = new SkillResolver({ baseDir });
  const loaded = resolver.loadAgent(name);
  if (!loaded) {
    console.error(`\x1b[31mAgent "${name}" não encontrado.\x1b[0m`);
    process.exit(1);
  }
  const g = loaded.genome;
  console.log(`\n\x1b[35m=== Agent Genome: ${g.name} (${name}) ===\x1b[0m\n`);
  console.log(`  \x1b[90mArquivo:\x1b[0m ${loaded.file}`);
  console.log(`  \x1b[90mVersão:\x1b[0m ${g.version}`);
  console.log(`  \x1b[90mModelo:\x1b[0m ${g.model ?? 'default'}`);
  console.log(`  \x1b[90mToken budget:\x1b[0m ${g.tokenBudget}`);
  console.log(`\n  \x1b[1mPurpose:\x1b[0m ${g.purpose}`);
  console.log(`\n  \x1b[1mCapabilities:\x1b[0m`);
  g.capabilities.forEach((c) => console.log(`    • ${c}`));
  console.log(`\n  \x1b[1mRequired skills (${g.requiredSkills.length}):\x1b[0m`);
  g.requiredSkills.forEach((s) => console.log(`    • ${s}`));
  console.log(`\n  \x1b[1mOptional skills:\x1b[0m ${g.optionalSkills.join(', ') || '—'}`);
  console.log(`\n  \x1b[1mInputs:\x1b[0m ${g.inputs.join(', ')}`);
  console.log(`  \x1b[1mOutputs:\x1b[0m ${g.outputs.join(', ')}`);
  console.log(`\n  \x1b[1mHandoffs:\x1b[0m`);
  g.handoffs.forEach((h) => console.log(`    • → ${h.to} (${h.reason})`));
  console.log(`\n  \x1b[1mEvaluation:\x1b[0m métricas [${g.evaluation.metrics.join(', ')}], minScore ${g.evaluation.minScore}`);
  console.log(`\n  \x1b[1mConstraints:\x1b[0m`);
  g.constraints.forEach((c) => console.log(`    • ${c}`));
  console.log('');
}

export function agentCreate(
  baseDir: string,
  requirement: string,
  opts: { name?: string; requiredSkills?: string[] } = {},
): void {
  const resolver = new SkillResolver({ baseDir });
  const factory = new AgentFactory(resolver);
  try {
    const generated = factory.generate({
      requirement,
      name: opts.name,
      requiredSkills: opts.requiredSkills,
    });
    if (!generated.validation.valid) {
      console.error('\x1b[31mAgent Factory: genome inválido — registro abortado:\x1b[0m');
      generated.validation.issues.forEach((i) => console.error(`  • ${i}`));
      process.exit(1);
    }
    console.log(`\n\x1b[35m=== Agent Factory: ${generated.genome.name} registrado ===\x1b[0m\n`);
    console.log(`  \x1b[90mArquivo:\x1b[0m ${generated.file}`);
    console.log(`  \x1b[90mPropósito:\x1b[0m ${generated.genome.purpose}`);
    console.log(`  \x1b[90mCapabilities:\x1b[0m ${generated.genome.capabilities.join(', ')}`);
    console.log(`  \x1b[90mSkills requeridas (${generated.genome.requiredSkills.length}):\x1b[0m ${generated.chain.join(', ')}`);
    console.log(`  \x1b[90mHandoffs:\x1b[0m ${generated.genome.handoffs.map((h) => h.to).join(', ')}`);
    console.log(`  \x1b[90mToken budget:\x1b[0m ${generated.genome.tokenBudget}`);
    console.log(`  \x1b[90mValidação:\x1b[0m ${generated.validation.issues.length === 0 ? 'OK' : generated.validation.issues.join('; ')}`);
    console.log('\n  Use: \x1b[33mizanagi run <id> --task "<tarefa>"\x1b[0m\n');
  } catch (e) {
    console.error(`\x1b[31mAgent Factory falhou:\x1b[0m ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
