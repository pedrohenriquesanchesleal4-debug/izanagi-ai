/**
 * `izanagi workflow list | inspect <name>` — workflows do planner + composições.
 */

import fs from 'fs';
import path from 'path';
import { WORKFLOW_TEMPLATES, TEMPLATE_ORDER } from '../../runtime/orchestration/planner.js';

export function workflowCommand(baseDir: string, args: string[]): void {
  const sub = args[0]?.toLowerCase() ?? 'list';

  if (sub === 'list') {
    workflowList(baseDir);
    return;
  }
  if (sub === 'inspect') {
    const name = args[1];
    if (!name) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi workflow inspect <name>\n');
      process.exit(1);
    }
    workflowInspect(baseDir, name);
    return;
  }
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi workflow <list|inspect> [name]\n');
  process.exit(1);
}

export function workflowList(baseDir: string): void {
  // Compositions do skill-resolver
  const resolverFiles = [
    path.join(baseDir, 'core', 'skill-resolver.json'),
    path.join(baseDir, '.agents', 'core', 'skill-resolver.json'),
  ];
  let compositions: Record<string, { triggers: string[]; chain: string[] }> = {};
  for (const f of resolverFiles) {
    if (fs.existsSync(f)) {
      try {
        const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
        compositions = data.compositions ?? {};
        break;
      } catch {
        // próximo
      }
    }
  }

  console.log(`\n\x1b[35m=== Izanagi AI Workflows ===\x1b[0m\n`);

  console.log(`\x1b[1mRuntime templates (Execution Graph):\x1b[0m ${TEMPLATE_ORDER.length}\n`);
  for (const id of TEMPLATE_ORDER) {
    const nodes = WORKFLOW_TEMPLATES[id]?.({
      task: '',
      category: id,
      primaryAgent: 'senior-engineer',
      skillChain: [],
    });
    const chain = nodes.map((n) => n.id).join(' → ');
    console.log(`\x1b[1m\x1b[36m• ${id}\x1b[0m`);
    console.log(`  \x1b[90m${chain}\x1b[0m\n`);
  }

  const comps = Object.entries(compositions);
  console.log(`\x1b[1mSkill compositions (resolver):\x1b[0m ${comps.length}\n`);
  for (const [id, c] of comps.slice(0, 15)) {
    console.log(`\x1b[1m\x1b[36m• ${id}\x1b[0m \x1b[90m[${c.chain.length} skills]\x1b[0m`);
    console.log(`  \x1b[90mChain: ${c.chain.join(' → ')}\x1b[0m\n`);
  }
  console.log('Dica: \x1b[33mizanagi workflow inspect <name>\x1b[0m\n');
}

export function workflowInspect(baseDir: string, name: string): void {
  const template = WORKFLOW_TEMPLATES[name];
  if (!template) {
    console.error(`\x1b[31mWorkflow "${name}" não encontrado. Disponíveis: ${TEMPLATE_ORDER.join(', ')}\x1b[0m`);
    process.exit(1);
  }
  const nodes = template({ task: '<task>', category: name, primaryAgent: 'senior-engineer', skillChain: [] });
  console.log(`\n\x1b[35m=== Execution Graph: ${name} ===\x1b[0m\n`);
  for (const n of nodes) {
    console.log(`\x1b[1m\x1b[36m${n.id}\x1b[0m \x1b[90m(${n.kind})\x1b[0m`);
    if (n.agent) console.log(`  \x1b[90mAgent:\x1b[0m ${n.agent}`);
    if (n.skills?.length) console.log(`  \x1b[90mSkills:\x1b[0m ${n.skills.join(', ')}`);
    console.log(`  \x1b[90mOutputs:\x1b[0m ${n.outputs?.join(', ') ?? '—'}`);
    console.log(`  \x1b[90mDepends on:\x1b[0m ${n.dependencies?.join(', ') ?? '—'}`);
    console.log(`  \x1b[90mRetry:\x1b[0m max ${n.retryPolicy?.maxAttempts ?? 0} | timeout ${n.timeoutMs ?? 0}ms | tokens ${n.tokenBudget ?? 0}\n`);
  }
}
