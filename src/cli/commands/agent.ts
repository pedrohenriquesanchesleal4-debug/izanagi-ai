/**
 * `izanagi agent list | inspect <name>` — inspeciona agentes via Agent Genome.
 */

import fs from 'fs';
import path from 'path';
import { SkillResolver } from '../../runtime/routing/resolver.js';

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
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi agent <list|inspect> [name]\n');
  process.exit(1);
}

export function agentList(baseDir: string): void {
  const dirs = [path.join(baseDir, 'agents'), path.join(baseDir, '.agents', 'agents')];
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
