import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exportToAntigravity } from '../../exporters.js';
import { doctorCommand } from '../../cli/commands/doctor.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-ag-test-'));
}

async function capture(fn: () => void | Promise<void>): Promise<{ logs: string[]; errors: string[]; exitCode: number | null }> {
  const logs: string[] = [];
  const errors: string[] = [];
  let exitCode: number | null = null;
  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;
  console.log = (m?: unknown) => { logs.push(String(m)); };
  console.error = (m?: unknown) => { errors.push(String(m)); };
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`PROCESS_EXIT:${exitCode}`);
  }) as never;
  try {
    await fn();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('PROCESS_EXIT')) {
      // esperado
    } else {
      throw err;
    }
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }
  return { logs, errors, exitCode };
}

test('Antigravity export: cria .agents/skills.json, GEMINI.md, rules e agent-skills', async () => {
  const dir = tmpDir();
  try {
    // Cria um agente mock em agents/
    const agentsDir = path.join(dir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'architect-agent.json'),
      JSON.stringify({
        name: 'architect',
        version: '3.0.0',
        purpose: 'System design and software architecture',
        capabilities: ['system-design', 'adr', 'clean-arch'],
        identity: 'Izanagi Architect Specialist',
        permissions: ['fs:read'],
      }),
      'utf-8',
    );

    const generated = exportToAntigravity(dir);
    assert.ok(generated.length >= 4, 'gerou skills.json, GEMINI.md, rule e agent-skill');

    // 1. skills.json
    const skillsJsonPath = path.join(dir, '.agents', 'skills.json');
    assert.ok(fs.existsSync(skillsJsonPath), '.agents/skills.json existe');
    const skillsJson = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf-8'));
    assert.ok(Array.isArray(skillsJson.entries), 'entries é um array');
    assert.ok(skillsJson.entries.some((e: { path: string }) => e.path === 'skills'));
    assert.ok(skillsJson.entries.some((e: { path: string }) => e.path === '.skills'));

    // 2. GEMINI.md
    const geminiMdPath = path.join(dir, 'GEMINI.md');
    assert.ok(fs.existsSync(geminiMdPath), 'GEMINI.md existe');
    const geminiMd = fs.readFileSync(geminiMdPath, 'utf-8');
    assert.match(geminiMd, /Izanagi AI Framework/);
    assert.match(geminiMd, /Antigravity/);

    // 3. Rule
    const rulePath = path.join(dir, '.agents', 'rules', 'izanagi-core.md');
    assert.ok(fs.existsSync(rulePath), '.agents/rules/izanagi-core.md existe');
    const ruleContent = fs.readFileSync(rulePath, 'utf-8');
    assert.match(ruleContent, /High-Craft & Anti-Generic/);

    // 4. Agent skill
    const agentSkillPath = path.join(dir, '.agents', 'skills', 'izanagi-architect', 'SKILL.md');
    assert.ok(fs.existsSync(agentSkillPath), 'agent skill SKILL.md existe');
    const agentSkillContent = fs.readFileSync(agentSkillPath, 'utf-8');
    assert.match(agentSkillContent, /name: izanagi-architect/);
    assert.match(agentSkillContent, /System design and software architecture/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Doctor --target antigravity: diagnostica descoberta e sugere correção quando ausente', async () => {
  const dir = tmpDir();
  try {
    // Mock de arquivos core para satisfazer integridade básica
    fs.writeFileSync(path.join(dir, 'SYSTEM.md'), '# System\n', 'utf-8');
    fs.writeFileSync(path.join(dir, 'RULES.md'), '# Rules\n', 'utf-8');

    // Executa doctor sem inicializar
    const res = await capture(() => {
      doctorCommand(dir, ['--target', 'antigravity']);
    });
    const out = res.logs.join('\n') + res.errors.join('\n');
    assert.match(out, /Antigravity não descobre as skills do Izanagi no projeto/);
    assert.match(out, /izanagi export --cli antigravity/);

    // Exporta e testa novamente
    const agentsDir = path.join(dir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'architect-agent.json'),
      JSON.stringify({
        name: 'architect',
        version: '3.0.0',
        purpose: 'System design and software architecture',
        capabilities: ['system-design'],
        permissions: ['fs:read'],
      }),
      'utf-8',
    );
    exportToAntigravity(dir);

    const res2 = await capture(() => {
      doctorCommand(dir, ['--target', 'antigravity']);
    });
    const out2 = res2.logs.join('\n');
    assert.match(out2, /Antigravity skills\.json configurado/);
    assert.match(out2, /agentes disponíveis como skills invocáveis no Antigravity/);
    assert.ok(!out2.includes('Antigravity não descobre as skills'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
