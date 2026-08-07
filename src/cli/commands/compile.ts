import fs from 'fs';
import path from 'path';
import { findAgentFile } from '../framework.js';

export function compileCommand(baseDir: string, agentIdentifier?: string, outputFile?: string): void {
  if (!agentIdentifier) {
    console.error('\x1b[31mError:\x1b[0m Please specify an agent name (e.g., architect, security, senior-engineer, techlead, database).');
    process.exit(1);
  }

  const cwd = process.cwd();
  const agentFile = findAgentFile(cwd, baseDir, agentIdentifier);

  if (!agentFile) {
    console.error(`\x1b[31mError:\x1b[0m Agent "${agentIdentifier}" not found.`);
    console.error(`Check \x1b[33magents/\x1b[0m or run \x1b[33mizanagi list agents\x1b[0m to see available agents.`);
    process.exit(1);
  }

  const agent = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));

  // SYSTEM.md / RULES.md: prioriza .agents do projeto, senão raiz do pacote
  const roots = [path.join(cwd, '.agents'), baseDir];
  const findDoc = (name: string): string =>
    roots.map((r) => path.join(r, name)).find((p) => fs.existsSync(p)) || '';

  const systemContent = findDoc('SYSTEM.md');
  const rulesContent = findDoc('RULES.md');

  let compiled = `<!-- IZANAGI AI COMPILED SYSTEM PROMPT -->\n`;
  compiled += `<!-- AGENT: ${agent.name} (v${agent.version || '1.0.0'}) -->\n\n`;
  compiled += `### ROLE & IDENTITY\n${agent.identity || agent.role}\n\n`;

  if (agent.always && agent.always.length > 0) {
    compiled += `### ALWAYS DO\n` + agent.always.map((a: string) => `- ${a}`).join('\n') + `\n\n`;
  }

  if (agent.never && agent.never.length > 0) {
    compiled += `### NEVER DO\n` + agent.never.map((n: string) => `- ${n}`).join('\n') + `\n\n`;
  }

  if (systemContent && fs.existsSync(systemContent)) {
    const sysText = fs.readFileSync(systemContent, 'utf-8');
    compiled += `--- SYSTEM FOUNDATION ---\n${sysText}\n\n`;
  }
  if (rulesContent && fs.existsSync(rulesContent)) {
    const rulesText = fs.readFileSync(rulesContent, 'utf-8');
    compiled += `--- OPERATIONAL RULES ---\n${rulesText}\n\n`;
  }

  if (outputFile) {
    const outPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(outPath, compiled, 'utf-8');
    console.log(`\x1b[32m✔\x1b[0m Compiled prompt for \x1b[1m${agent.name}\x1b[0m saved to: \x1b[36m${outPath}\x1b[0m`);
  } else {
    console.log(compiled);
  }
}
