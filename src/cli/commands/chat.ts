import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { findAgentFile, loadSkillResolver, resolveSkillPath, loadProjectConfig } from '../framework.js';
import { classifyTask, resolveChainForCategory } from './run.js';

function agentLabel(agent: any): string {
  return agent.name || 'Custom agent';
}

export function chatCommand(baseDir: string): void {
  const cwd = process.cwd();
  
  console.log('\n\x1b[1m\x1b[36m=== Izanagi AI Interactive Shell (REPL) ===\x1b[0m');
  console.log('Type your tasks or questions naturally, or use commands:');
  console.log('  \x1b[33m/agents\x1b[0m   - list available agents');
  console.log('  \x1b[33m/skills\x1b[0m   - list available skills');
  console.log('  \x1b[33m/doctor\x1b[0m   - run integrity check');
  console.log('  \x1b[33m/clear\x1b[0m    - clear screen');
  console.log('  \x1b[33m/exit\x1b[0m     - quit interactive session\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[35mizanagi>\x1b[0m '
  });

  // Em pipes/CI (stdin não-TTY), processa todas as linhas e sai sem segurar o processo
  if (!process.stdin.isTTY) {
    rl.on('line', (line) => { /* linhas são processadas no handler principal abaixo */ });
  }

  // Ctrl+C / SIGINT: encerra o REPL de forma limpa (não "trava")
  rl.on('SIGINT', () => {
    console.log('\n\x1b[32mExiting Izanagi Interactive Shell. Goodbye!\x1b[0m\n');
    process.exit(0);
  });

  // Proteção contra travamento: se o stdin fechar sem /exit, sai limpo
  process.stdin.on('end', () => {
    if (!process.stdin.isTTY) {
      console.log('\n\x1b[32mGoodbye!\x1b[0m\n');
      process.exit(0);
    }
  });

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === '/quit' || input === 'exit' || input === 'quit') {
      console.log('\n\x1b[32mExiting Izanagi Interactive Shell. Goodbye!\x1b[0m\n');
      process.exit(0);
    }

    if (input === '/clear') {
      console.clear();
      rl.prompt();
      return;
    }

    if (input === '/help' || input === '/?') {
      console.log('\n\x1b[36m=== Izanagi REPL Commands ===\x1b[0m');
      console.log('  \x1b[33m/agents\x1b[0m   - list available agents');
      console.log('  \x1b[33m/skills\x1b[0m   - list available skills');
      console.log('  \x1b[33m/doctor\x1b[0m   - run integrity check');
      console.log('  \x1b[33m/clear\x1b[0m    - clear screen');
      console.log('  \x1b[33m/exit\x1b[0m     - quit interactive session');
      console.log('  \x1b[90mOr type a task naturally: "animacao 3d para landing"\n\x1b[0m');
      rl.prompt();
      return;
    }

    if (input === '/doctor') {
      console.log('\n\x1b[36mRunning doctor check...\x1b[0m');
      // Import and call doctor command logic
      const projectRoot = fs.existsSync(path.join(cwd, '.agents')) ? path.join(cwd, '.agents') : baseDir;
      const resolverPath = path.join(projectRoot, 'core', 'skill-resolver.json');
      if (fs.existsSync(resolverPath)) {
        console.log('\x1b[32m✔ Framework & Resolver OK\x1b[0m\n');
      } else {
        console.log('\x1b[31m✖ Resolver missing\x1b[0m\n');
      }
      rl.prompt();
      return;
    }

    if (input === '/agents' || input === '/skills') {
      const type = input === '/agents' ? 'agents' : 'skills';
      const searchDirs = [
        path.join(cwd, '.agents', type),
        path.join(cwd, type),
        path.join(baseDir, type)
      ];
      const found = new Set<string>();
      for (const d of searchDirs) {
        if (fs.existsSync(d)) {
          const files = fs.readdirSync(d);
          files.forEach(f => found.add(f));
        }
      }
      if (type === 'skills') {
        const aliases = loadSkillResolver(cwd, baseDir);
        Object.keys(aliases).forEach(k => found.add(k));
      }

      const items = Array.from(found).slice(0, 30);
      const extras = found.size - items.length;
      console.log(`\n\x1b[36m=== ${type === 'agents' ? 'Available Agents' : 'Available Skills'} (${found.size}) ===\x1b[0m`);
      items.forEach(f => {
        const label = f.replace(/\.json$/i, '').replace(/-agent$/i, '');
        console.log(`  \x1b[32m•\x1b[0m ${label}`);
      });
      if (extras > 0) console.log(`  \x1b[90m… and ${extras} more (use 'izanagi list ${type}' for the full list)\x1b[0m`);
      console.log('');
      rl.prompt();
      return;
    }

    // Process task through Decision Engine
    const task = input;
    try {
      const classified = classifyTask(task);
      const category = classified.category;
      const agentFile = findAgentFile(cwd, baseDir, classified.agent);
      const agent = agentFile ? JSON.parse(fs.readFileSync(agentFile, 'utf-8')) : { name: classified.agent, skills: [] };
      const skillChain = resolveChainForCategory(agent, category);
      const aliases = loadSkillResolver(cwd, baseDir);

      console.log(`\n\x1b[36m--- Decision Engine --- \x1b[0m`);
      console.log(`\x1b[1mTask:\x1b[0m "${task}"`);
      console.log(`\x1b[32m✔ Category:\x1b[0m ${category}`);
      console.log(`\x1b[32m✔ Selected Agent:\x1b[0m ${agentLabel(agent)} (v${agent.version || '1.0.0'})`);
      console.log(`\x1b[32m✔ Skill Chain:\x1b[0m ${skillChain.join(' -> ')}`);

      let resolvedCount = 0;
      skillChain.forEach(skill => {
        const sp = resolveSkillPath(cwd, baseDir, skill);
        if (sp) resolvedCount++;
      });
      console.log(`\x1b[32m✔ Resolved Skills:\x1b[0m ${resolvedCount}/${skillChain.length} ready in context.`);
      console.log(`\x1b[90m(Tip: Use 'izanagi run --task "${task}"' to execute or integrate with opencode for full agent generation.)\x1b[0m\n`);
    } catch (err: any) {
      // Nunca deixa o REPL morrer por um erro de processamento
      console.log(`\x1b[31m✖ Error processing task:\x1b[0m ${err.message || err}\n`);
    }

    rl.prompt();
  }).on('close', () => {
    console.log('\n\x1b[32mGoodbye!\x1b[0m\n');
    process.exit(0);
  });
}
