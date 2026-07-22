import fs from 'fs';
import path from 'path';

export function listCommand(baseDir: string, filter?: string): void {
  const type = filter ? filter.toLowerCase() : 'all';

  if (type === 'all' || type === 'agents') {
    console.log('\n\x1b[35m=== NexusAI Agents ===\x1b[0m\n');
    const agentsDir = path.join(baseDir, 'agents');
    if (fs.existsSync(agentsDir)) {
      const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try {
          const agent = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
          console.log(`\x1b[1m\x1b[36m• ${agent.name || f}\x1b[0m (v${agent.version || '1.0.0'})`);
          console.log(`  Role: ${agent.role || 'N/A'}`);
          console.log(`  Skills: ${agent.skills ? agent.skills.slice(0, 6).join(', ') + (agent.skills.length > 6 ? '...' : '') : 'None'}\n`);
        } catch {
          // ignore broken files
        }
      }
    }
  }

  if (type === 'all' || type === 'skills') {
    console.log('\x1b[35m=== NexusAI Skill Resolver Aliases ===\x1b[0m\n');
    const resolverPath = path.join(baseDir, 'core', 'skill-resolver.json');
    if (fs.existsSync(resolverPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(resolverPath, 'utf-8'));
        const aliases = data.aliases || {};
        const keys = Object.keys(aliases).sort();
        console.log(`Total skills registered: \x1b[32m${keys.length}\x1b[0m\n`);

        const colWidth = 25;
        for (let i = 0; i < keys.length; i += 2) {
          const k1 = keys[i];
          const k2 = keys[i + 1] || '';
          const p1 = aliases[k1];
          const p2 = k2 ? aliases[k2] : '';

          const item1 = `  \x1b[33m${k1.padEnd(colWidth)}\x1b[0m -> ${p1}`;
          const item2 = k2 ? ` | \x1b[33m${k2.padEnd(colWidth)}\x1b[0m -> ${p2}` : '';
          console.log(item1 + item2);
        }
        console.log('\n');
      } catch (err: any) {
        console.error('Error reading skill-resolver.json:', err.message);
      }
    }
  }
}
