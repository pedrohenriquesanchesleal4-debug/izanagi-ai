/**
 * Commit limpo: o projeto consumidor nunca deve commitar `.env` nem os artefatos
 * que o Izanagi e os adaptadores de CLI escrevem. `ensureGitignore` grava um bloco
 * marcado no `.gitignore`, idempotente, sem tocar no que o usuário escreveu, e sem
 * esconder documento autoral (AGENTS.md/CLAUDE.md sem o rodapé de proveniência).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureGitignore, GITIGNORE_BEGIN, GITIGNORE_END } from '../../installer.js';
import { DEFAULT_ORCHESTRATOR_MODE, GENERATED_MARKER } from '../../exporters.js';

function tmpProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-gitignore-'));
}

test('ensureGitignore: cria bloco com segredos e artefatos existentes do framework', () => {
  const dir = tmpProject();
  fs.mkdirSync(path.join(dir, '.agents'));
  fs.mkdirSync(path.join(dir, '.claude', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cursor', 'rules'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.cursor', 'rules', 'izanagi-core.mdc'), 'x');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), `# x\n\n> ${GENERATED_MARKER}: init\n`);
  fs.writeFileSync(path.join(dir, 'opencode.json'), '{}');

  const listed = ensureGitignore(dir, ['opencode.json']);
  const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');

  for (const entry of ['.env', '.env.*', '!.env.example', '*.pem', '.agents/', '.claude/agents/', '.cursor/rules/izanagi-*', 'CLAUDE.md', 'opencode.json']) {
    assert.ok(gi.split('\n').includes(entry), `faltou ${entry}`);
  }
  assert.ok(!gi.includes('.codex/'), 'pasta inexistente não entra');
  assert.ok(listed.includes('.agents/'));
});

test('ensureGitignore: preserva conteúdo do usuário, é idempotente e não esconde doc autoral', () => {
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Meu AGENTS.md escrito à mão\n');

  ensureGitignore(dir);
  const first = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  ensureGitignore(dir);
  const second = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');

  assert.equal(first, second, 'segunda execução não muda nada');
  assert.ok(first.startsWith('node_modules/\ndist/\n'), 'linhas do usuário ficam intactas no topo');
  assert.equal(first.split(GITIGNORE_BEGIN).length, 2, 'um bloco só');
  assert.ok(first.includes(GITIGNORE_END));
  assert.ok(!first.split('\n').includes('AGENTS.md'), 'AGENTS.md autoral não é ignorado');
});

test('ensureGitignore: atualiza só o bloco quando o framework ganha artefato novo', () => {
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'build/\n');
  ensureGitignore(dir);
  fs.mkdirSync(path.join(dir, '.opencode'));
  fs.appendFileSync(path.join(dir, '.gitignore'), 'coverage/\n');
  ensureGitignore(dir);
  const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  assert.ok(gi.split('\n').includes('.opencode/'));
  assert.ok(gi.includes('build/') && gi.includes('coverage/'));
  assert.equal(gi.split(GITIGNORE_BEGIN).length, 2);
});

test('modo padrão traz a regra de commit limpo sem carregar o marcador de arquivo gerado', () => {
  assert.match(DEFAULT_ORCHESTRATOR_MODE, /Commit limpo/);
  assert.match(DEFAULT_ORCHESTRATOR_MODE, /git rm --cached/);
  // Se o texto citasse o marcador, um CLAUDE.md autoral com o bloco global seria
  // tratado como gerado e reescrito pelo próximo export.
  assert.ok(!DEFAULT_ORCHESTRATOR_MODE.includes(GENERATED_MARKER));
});
