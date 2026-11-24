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

test('Antigravity export: agentes nativos em .agents/agents com tools reais do agy', async () => {
  const dir = tmpDir();
  try {
    const agentsDir = path.join(dir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    for (const name of ['orchestrator', 'architect']) {
      fs.writeFileSync(
        path.join(agentsDir, `${name}-agent.json`),
        JSON.stringify({
          name,
          version: '3.0.0',
          purpose: name === 'architect' ? 'System design and software architecture' : 'Coordena',
          capabilities: ['x'],
          identity: `Izanagi ${name}`,
          skills: ['find-skills'],
          permissions: ['fs:read'],
        }),
        'utf-8',
      );
    }
    fs.mkdirSync(path.join(dir, '.skills', 'find-skills'), { recursive: true });
    const skillMd = ['---', 'name: find-skills', 'description: x', '---', ''].join('\n');
    fs.writeFileSync(path.join(dir, '.skills', 'find-skills', 'SKILL.md'), skillMd, 'utf-8');
    fs.mkdirSync(path.join(dir, 'skills', 'find-skills'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'skills', 'find-skills', 'SKILL.md'), skillMd, 'utf-8');

    // Legado gerado por versões antigas: deve sumir. Arquivo do usuário sem marcador: deve ficar.
    fs.mkdirSync(path.join(dir, '.gemini', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.gemini', 'subagents', 'architect.md'), 'x\nGerado pelo Izanagi AI: `izanagi export --cli antigravity`\n');
    fs.mkdirSync(path.join(dir, '.gemini', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.gemini', 'agents', 'meu-agente.md'), 'agente do usuário\n');

    exportToAntigravity(dir);

    // skills.json aponta para UM catálogo (sem duplicar skills/ e .skills/)
    const skillsJson = JSON.parse(fs.readFileSync(path.join(dir, '.agents', 'skills.json'), 'utf-8'));
    assert.deepEqual(skillsJson.entries, [{ path: '.skills' }]);

    // Regra com trigger (sem trigger o agy descarta)
    const rule = fs.readFileSync(path.join(dir, '.agents', 'rules', 'izanagi-core.md'), 'utf-8');
    assert.match(rule, /^---\ntrigger: always_on\n---/);
    assert.ok(!rule.includes('EnableWriteTools'), 'parâmetro inexistente no agy');

    // Orquestrador principal, especialista como subagente oculto do seletor
    const orch = fs.readFileSync(path.join(dir, '.agents', 'agents', 'orchestrator.md'), 'utf-8');
    assert.match(orch, /mainAgent: true/);
    assert.match(orch, /invoke_subagent/);
    assert.ok(!orch.includes('preloadSkills'), 'orquestrador não depende de preload (budget de skills)');
    const arch = fs.readFileSync(path.join(dir, '.agents', 'agents', 'architect.md'), 'utf-8');
    assert.match(arch, /mainAgent: false/);
    assert.match(arch, /subagent: true/);
    for (const content of [orch, arch]) {
      const tools = content.match(/^tools: \[([^\]]*)\]/m)![1].split(', ');
      assert.ok(tools.includes('write_file') && tools.includes('edit_file') && tools.includes('run_command'));
      assert.ok(!tools.includes('grep_search') && !tools.includes('find_by_name'), 'nomes inexistentes no agy');
    }

    // Plugin distribuível espelha os agentes em agents/ (subagents/ não é lido pelo agy)
    const pluginAgents = fs.readdirSync(path.join(dir, '.agents', 'plugins', 'izanagi', 'agents')).sort();
    assert.deepEqual(pluginAgents, ['architect.md', 'orchestrator.md']);
    assert.ok(!fs.existsSync(path.join(dir, '.agents', 'plugins', 'izanagi', 'subagents')));
    assert.ok(JSON.parse(fs.readFileSync(path.join(dir, '.agents', 'plugins', 'izanagi', 'plugin.json'), 'utf-8')).version);

    // Limpeza segura do legado
    assert.ok(!fs.existsSync(path.join(dir, '.gemini', 'subagents')), 'legado gerado removido');
    assert.ok(fs.existsSync(path.join(dir, '.gemini', 'agents', 'meu-agente.md')), 'arquivo do usuário preservado');

    // Idempotente
    const again = exportToAntigravity(dir);
    assert.ok(again.length > 0);
    assert.equal(fs.readFileSync(path.join(dir, '.agents', 'agents', 'orchestrator.md'), 'utf-8'), orch);
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
    assert.match(out2, /Antigravity (skills\.json configurado|pasta \.agents\/skills detectada)/);
    assert.match(out2, /agentes nativos em \.agents\/agents\//);
    assert.ok(!out2.includes('Antigravity não descobre as skills'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
