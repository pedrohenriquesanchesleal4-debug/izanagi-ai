import fs from 'fs';
import path from 'path';

export function compileCommand(baseDir, agentIdentifier, outputFile) {
  if (!agentIdentifier) {
    console.error('\x1b[31mError:\x1b[0m Please specify an agent name (e.g., architect, security, senior-engineer, techlead, database).');
    process.exit(1);
  }

  const agentsDir = path.join(baseDir, 'agents');
  let agentFile = path.join(agentsDir, `${agentIdentifier}-agent.json`);
  if (!fs.existsSync(agentFile)) {
    agentFile = path.join(agentsDir, `${agentIdentifier}.json`);
  }

  if (!fs.existsSync(agentFile)) {
    console.error(`\x1b[31mError:\x1b[0m Agent "${agentIdentifier}" not found in ${agentsDir}`);
    process.exit(1);
  }

  const agent = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
  const systemContent = fs.existsSync(path.join(baseDir, 'SYSTEM.md')) 
    ? fs.readFileSync(path.join(baseDir, 'SYSTEM.md'), 'utf-8') 
    : '';

  const rulesContent = fs.existsSync(path.join(baseDir, 'RULES.md')) 
    ? fs.readFileSync(path.join(baseDir, 'RULES.md'), 'utf-8') 
    : '';

  let compiled = `<!-- NEXUS AI COMPILED SYSTEM PROMPT -->\n`;
  compiled += `<!-- AGENT: ${agent.name} (v${agent.version || '1.0.0'}) -->\n\n`;
  compiled += `### ROLE & IDENTITY\n${agent.identity || agent.role}\n\n`;

  if (agent.always && agent.always.length > 0) {
    compiled += `### ALWAYS DO\n` + agent.always.map(a => `- ${a}`).join('\n') + `\n\n`;
  }

  if (agent.never && agent.never.length > 0) {
    compiled += `### NEVER DO\n` + agent.never.map(n => `- ${n}`).join('\n') + `\n\n`;
  }

  compiled += `--- SYSTEM FOUNDATION ---\n${systemContent}\n\n`;
  compiled += `--- OPERATIONAL RULES ---\n${rulesContent}\n\n`;

  if (outputFile) {
    const outPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(outPath, compiled, 'utf-8');
    console.log(`\x1b[32m✔\x1b[0m Compiled prompt for \x1b[1m${agent.name}\x1b[0m saved to: \x1b[36m${outPath}\x1b[0m`);
  } else {
    console.log(compiled);
  }
}
