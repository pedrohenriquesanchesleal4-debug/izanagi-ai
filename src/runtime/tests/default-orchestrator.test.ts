import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exportToClaude, exportToOpencode, exportToAntigravity, exportToCopilot, exportToCodex } from '../../exporters.js';
import { detectInstalledClis } from '../../installer.js';

function projectWithAgents(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-default-orch-'));
  const agentsDir = path.join(dir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const name of ['orchestrator', 'architect']) {
    fs.writeFileSync(
      path.join(agentsDir, `${name}-agent.json`),
      JSON.stringify({ name, version: '1.0.0', purpose: name, capabilities: ['x'], skills: [], permissions: ['fs:read'] }),
    );
  }
  return dir;
}

test('Claude Code: orquestrador vira o agente padrão sem apagar settings do usuário', () => {
  const dir = projectWithAgents();
  try {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test)'] } }));
    exportToClaude(dir);
    const s = JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf-8'));
    assert.equal(s.agent, 'orchestrator');
    assert.deepEqual(s.permissions, { allow: ['Bash(npm test)'] });

    // Escolha explícita do usuário é respeitada
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({ agent: 'meu-agente' }));
    exportToClaude(dir);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf-8')).agent, 'meu-agente');

    assert.match(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8'), /## Modo padrão: Orquestrador do Izanagi/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('OpenCode: default_agent aponta para o orquestrador e preserva instructions', () => {
  const dir = projectWithAgents();
  try {
    fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({ instructions: ['AGENTS.md'] }));
    exportToOpencode(dir);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'opencode.json'), 'utf-8'));
    assert.equal(cfg.default_agent, 'orchestrator');
    assert.deepEqual(cfg.instructions, ['AGENTS.md']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLIs sem config de agente padrão recebem o modo orquestrador no documento sempre carregado', () => {
  const dir = projectWithAgents();
  try {
    exportToAntigravity(dir);
    exportToCopilot(dir);
    exportToCodex(dir);
    for (const rel of ['GEMINI.md', '.github/copilot-instructions.md', '.codex/instructions.md']) {
      const doc = fs.readFileSync(path.join(dir, rel), 'utf-8');
      assert.match(doc, /## Modo padrão: Orquestrador do Izanagi/, rel);
      assert.match(doc, /references\.md/, rel);
      assert.match(doc, /Gerado pelo Izanagi AI/, `${rel} mantém o marcador`);
    }
    assert.match(fs.readFileSync(path.join(dir, '.agents', 'rules', 'izanagi-core.md'), 'utf-8'), /Orquestrador do Izanagi por padrão/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detectInstalledClis: acha CLIs pelo PATH sem executar nada', () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-bin-'));
  try {
    const ext = process.platform === 'win32' ? '.exe' : '';
    fs.writeFileSync(path.join(bin, `agy${ext}`), '');
    fs.writeFileSync(path.join(bin, `opencode${ext}`), '');
    const prev = process.env.IZANAGI_SKIP_CLI_DETECTION;
    delete process.env.IZANAGI_SKIP_CLI_DETECTION;
    try {
      assert.deepEqual(detectInstalledClis(bin).sort(), ['antigravity', 'opencode']);
    } finally {
      if (prev !== undefined) process.env.IZANAGI_SKIP_CLI_DETECTION = prev;
    }
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
});
