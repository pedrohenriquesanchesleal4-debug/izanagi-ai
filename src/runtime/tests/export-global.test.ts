import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exportToClaude } from '../../exporters.js';

/**
 * Escopo pessoal (`izanagi export --cli claude --global`, destino `~/`).
 *
 * O problema que ele resolve: agente e skill são descobertos por PROJETO, então
 * abrir a CLI em outro diretório não encontra nenhum dos 22 agentes nem a
 * biblioteca de skills, e quem vê isso conclui que o framework não funciona.
 *
 * O risco que ele NÃO pode criar: escrever `~/CLAUDE.md`. Esse arquivo é a
 * memória global do usuário e passaria a injetar a descrição de um framework
 * em todo repositório que ele abrisse.
 */

function tmpHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-tests-exportglobal-'));
}

test('export --global: instala agentes, comandos e skills SEM escrever o CLAUDE.md do usuário', () => {
  const home = tmpHome();
  // Fonte = repo do framework; destino = o "home" temporário. Fonte e destino
  // separados é o que o escopo pessoal exige: `~/` não contém framework.
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
  const created = exportToClaude(home, { rootDoc: false, sourceDir: repoRoot });

  assert.equal(fs.existsSync(path.join(home, 'CLAUDE.md')), false, '~/CLAUDE.md é do usuário, não do framework');
  assert.equal(created.some((f) => f === 'CLAUDE.md' || f.endsWith(`${path.sep}CLAUDE.md`)), false);

  const agents = fs.readdirSync(path.join(home, '.claude', 'agents'));
  assert.ok(agents.length >= 22, `esperado 22+ agentes, veio ${agents.length}`);
  assert.ok(agents.includes('senior-engineer.md'));

  const commands = fs.readdirSync(path.join(home, '.claude', 'commands'));
  assert.ok(commands.includes('agents.md'), 'o orquestrador /agents tem que vir junto');

  const skills = fs.readdirSync(path.join(home, '.claude', 'skills'));
  assert.ok(skills.length >= 100, `esperado 100+ skills, veio ${skills.length}`);
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'tdd', 'SKILL.md')));

  fs.rmSync(home, { recursive: true, force: true });
});

test('export por projeto (default) continua escrevendo o CLAUDE.md da raiz', () => {
  const dir = tmpHome();
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
  exportToClaude(dir, { sourceDir: repoRoot });
  assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), true);
  fs.rmSync(dir, { recursive: true, force: true });
});
