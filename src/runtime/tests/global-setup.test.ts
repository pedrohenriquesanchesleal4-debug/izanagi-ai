import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupGlobal, upsertMarkedBlock } from '../../global-setup.js';
import { getPackageDir } from '../../installer.js';

test('setupGlobal: deixa Claude, Antigravity, OpenCode e Codex prontos no escopo do usuário', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-home-'));
  try {
    // Estado prévio do usuário que precisa sobreviver
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ model: 'opus', hooks: { X: [] } }));
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# Minhas regras\n\nNunca use tabs.\n');
    fs.mkdirSync(path.join(home, '.config', 'opencode'), { recursive: true });
    fs.writeFileSync(path.join(home, '.config', 'opencode', 'AGENTS.md'), 'Regra minha do opencode.\n');

    const res = setupGlobal({
      home,
      packageDir: getPackageDir(),
      clis: ['claude', 'antigravity', 'opencode', 'codex'],
      useAgyBinary: false,
    });

    // Catálogo único
    assert.ok(fs.existsSync(path.join(home, '.izanagi', 'skills', 'signature-experience', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(home, '.izanagi', 'skills', 'signature-experience', 'references.md')));

    // Claude Code
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf-8'));
    assert.equal(settings.agent, 'orchestrator');
    assert.equal(settings.model, 'opus', 'preserva configuração do usuário');
    assert.ok(fs.existsSync(path.join(home, '.claude', 'agents', 'orchestrator.md')));
    assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'find-skills', 'SKILL.md')));
    const claudeMd = fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf-8');
    assert.match(claudeMd, /Nunca use tabs\./);
    assert.match(claudeMd, /Modo padrão: Orquestrador do Izanagi/);
    assert.ok(!fs.existsSync(path.join(home, 'CLAUDE.md')), 'não cria CLAUDE.md solto na home');

    // Antigravity (sem binário: cópia + config.json)
    const plugin = path.join(home, '.gemini', 'config', 'plugins', 'izanagi');
    assert.ok(fs.existsSync(path.join(plugin, 'agents', 'orchestrator.md')));
    assert.ok(fs.existsSync(path.join(plugin, 'library', 'signature-experience', 'references.md')));
    const gcfg = JSON.parse(fs.readFileSync(path.join(home, '.gemini', 'config', 'config.json'), 'utf-8'));
    assert.equal(gcfg.plugins.izanagi.enabled, true);

    // OpenCode
    const oc = path.join(home, '.config', 'opencode');
    assert.equal(JSON.parse(fs.readFileSync(path.join(oc, 'opencode.json'), 'utf-8')).default_agent, 'orchestrator');
    assert.ok(fs.existsSync(path.join(oc, 'agent', 'orchestrator.md')));
    const ocAgents = fs.readFileSync(path.join(oc, 'AGENTS.md'), 'utf-8');
    assert.match(ocAgents, /Regra minha do opencode\./);
    assert.match(ocAgents, /Modo padrão: Orquestrador do Izanagi/);

    // Codex
    assert.match(fs.readFileSync(path.join(home, '.codex', 'AGENTS.md'), 'utf-8'), /Modo padrão: Orquestrador do Izanagi/);

    assert.deepEqual(Object.keys(res.configured).sort(), ['antigravity', 'catalog', 'claude', 'codex', 'opencode']);

    // Idempotente: segundo setup não duplica o bloco
    setupGlobal({ home, packageDir: getPackageDir(), clis: ['claude', 'opencode'], useAgyBinary: false });
    const again = fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf-8');
    assert.equal(again.split('izanagi:begin').length - 1, 1);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('upsertMarkedBlock: troca só o bloco e preserva o resto', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-block-'));
  try {
    const f = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(f, 'antes\n');
    upsertMarkedBlock(f, 'v1');
    fs.appendFileSync(f, '\ndepois\n');
    upsertMarkedBlock(f, 'v2');
    const t = fs.readFileSync(f, 'utf-8');
    assert.match(t, /^antes/);
    assert.match(t, /depois/);
    assert.match(t, /v2/);
    assert.doesNotMatch(t, /v1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
