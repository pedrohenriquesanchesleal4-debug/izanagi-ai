/**
 * O comando de teste do projeto, executado de verdade.
 *
 * O que estes testes protegem: que a evidência de teste venha de um PROCESSO e
 * não de um texto, e que nenhum caminho de entrada consiga escolher o comando
 * que roda. O segundo é o que distingue este caminho de um shell arbitrário
 * com outro nome.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectTestRunner, runProjectTests } from '../tools/project-test.js';
import { ToolRegistry } from '../tools/registry.js';
import { runCheck } from '../verification/engine.js';
import { Commander } from '../orchestration/commander.js';
import { TEST_NODE_ID } from '../orchestration/test-gate.js';
import { contractOf, validateContract } from '../contracts/task-contract.js';

function tmpProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-tests-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

test('project.test: detecta o runner pelo manifesto, e recusa o placeholder do npm init', () => {
  const comTeste = tmpProject({ 'package.json': JSON.stringify({ scripts: { test: 'node --test' } }) });
  assert.equal(detectTestRunner(comTeste).runner?.id, 'npm');

  const placeholder = tmpProject({
    'package.json': JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
  });
  const verdict = detectTestRunner(placeholder);
  assert.equal(verdict.runner, undefined, 'o placeholder sairia exit 1 e o check diria que os testes falharam');
  assert.match(verdict.reason ?? '', /placeholder/);

  const semNada = tmpProject({ 'leia.md': '# projeto' });
  assert.equal(detectTestRunner(semNada).runner, undefined);

  const rust = tmpProject({ 'Cargo.toml': '[package]\nname = "x"' });
  assert.equal(detectTestRunner(rust).runner?.id, 'cargo');

  const go = tmpProject({ 'go.mod': 'module exemplo' });
  assert.equal(detectTestRunner(go).runner?.id, 'go');

  const py = tmpProject({ 'pyproject.toml': '[project]\nname = "x"' });
  assert.equal(detectTestRunner(py).runner?.id, 'pytest');

  for (const d of [comTeste, placeholder, semNada, rust, go, py]) fs.rmSync(d, { recursive: true, force: true });
});

test('project.test: o exit code vem do processo, aprovando E reprovando', async () => {
  // Node puro: sem `npm install`, sem rede, e o mesmo binário que roda esta
  // suíte. O runner detectado é `npm`, e o `scripts.test` é do projeto.
  const verde = tmpProject({
    'package.json': JSON.stringify({ name: 'verde', scripts: { test: 'node -e "process.exit(0)"' } }),
  });
  const ok = await runProjectTests({ dir: verde, timeoutMs: 60_000 });
  assert.equal(ok.passed, true, `esperava exit 0, veio ${ok.exitCode}: ${ok.stderr.slice(0, 300)}`);
  assert.equal(ok.exitCode, 0);
  assert.equal(ok.runner, 'npm');

  const vermelho = tmpProject({
    'package.json': JSON.stringify({ name: 'vermelho', scripts: { test: 'node -e "process.exit(3)"' } }),
  });
  const fail = await runProjectTests({ dir: vermelho, timeoutMs: 60_000 });
  assert.equal(fail.passed, false);
  assert.notEqual(fail.exitCode, 0, 'exit não-zero precisa chegar como não-zero');

  fs.rmSync(verde, { recursive: true, force: true });
  fs.rmSync(vermelho, { recursive: true, force: true });
});

test('project.test: sem runner detectado, `passed` fica AUSENTE, nunca false', async () => {
  const dir = tmpProject({ 'leia.md': '# sem manifesto' });
  const result = await runProjectTests({ dir });
  assert.equal(result.passed, undefined, '"não medi" não pode se ler como "os testes falharam"');
  assert.equal(result.exitCode, null);
  assert.match(result.error ?? '', /nenhum comando de teste detectado/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('project.test: a tool exige `shell` e não aceita comando nenhum na entrada', async () => {
  const dir = tmpProject({ 'package.json': JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }) });
  const registry = new ToolRegistry();

  const negada = await registry.execute('project.test', { dir: '.' }, { permissions: ['fs:read'], baseDir: dir });
  assert.equal(negada.ok, false, 'sem `shell` a tool não executa');
  assert.match(negada.error ?? '', /permissão negada/);

  // O campo `command` não existe no schema: passá-lo não muda o que roda.
  const comando = await registry.execute(
    'project.test',
    { dir: '.', command: 'node -e "process.exit(7)"' },
    { permissions: ['shell'], baseDir: dir, trustTier: 'builtin' },
  );
  assert.equal(comando.ok, true);
  const result = comando.result as { command: string; exitCode: number };
  assert.match(result.command, /^npm(\.cmd)? test/, `o comando executado é o do runtime, veio "${result.command}"`);
  assert.equal(result.exitCode, 0, 'o exit 7 do campo injetado não aconteceu: ele nunca foi executado');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('project.test: a tool não sai da zona permitida', async () => {
  const dir = tmpProject({ 'package.json': JSON.stringify({ scripts: { test: 'node -e "0"' } }) });
  const out = await new ToolRegistry().execute(
    'project.test',
    { dir: '../..' },
    { permissions: ['shell'], baseDir: dir, trustTier: 'builtin' },
  );
  assert.equal(out.ok, false);
  assert.match(out.error ?? '', /fora da zona permitida/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('exit-zero: aprova em 0, reprova em não-zero, e fica UNKNOWN sem exit code', () => {
  const ctx = (content: unknown) => ({ content, text: JSON.stringify(content), kind: 'test-run' });
  assert.equal(runCheck({ kind: 'exit-zero' }, ctx({ exitCode: 0 })).outcome, 'pass');
  assert.equal(runCheck({ kind: 'exit-zero' }, ctx({ exitCode: 1 })).outcome, 'fail');
  // O caso que importa: comando que não rodou não aprova por ausência.
  assert.equal(runCheck({ kind: 'exit-zero' }, ctx({ exitCode: null, error: 'binário ausente' })).outcome, 'unknown');
  assert.equal(runCheck({ kind: 'exit-zero' }, ctx({ timedOut: true, exitCode: null })).outcome, 'unknown');
  assert.equal(runCheck({ kind: 'exit-zero' }, ctx('texto solto')).outcome, 'unknown');
});

test('commander: --verify-tests acrescenta o nó no FIM, depois de tudo que escreve', () => {
  const plan = new Commander().plan({
    objective: 'adicionar paginação em GET /users',
    mode: 'orchestrated',
    output: 'docs',
    verifyTests: true,
  });
  const node = plan.graph.nodes.find((n) => n.id === TEST_NODE_ID);
  if (!node) throw new Error('o nó de teste precisa existir no grafo');
  const contract = contractOf(node);
  assert.deepEqual(contract?.permissions, ['shell']);
  assert.equal(contract?.tool?.id, 'project.test');
  if (!contract) throw new Error('o nó de teste precisa carregar contrato');
  assert.deepEqual(validateContract(contract), []);
  // Depende de todo nó anterior, inclusive da materialização e da entrega:
  // rodar antes mediria o projeto SEM o que o run escreveu.
  const outros = plan.graph.nodes.filter((n) => n.id !== TEST_NODE_ID).map((n) => n.id);
  for (const id of outros) {
    assert.ok((node.dependencies ?? []).includes(id), `o nó de teste precisa depender de "${id}"`);
  }
});

test('commander: sem --verify-tests o grafo não ganha nó nenhum, e direct nunca ganha', () => {
  const sem = new Commander().plan({ objective: 'adicionar paginação em GET /users', mode: 'orchestrated' });
  assert.equal(sem.graph.nodes.find((n) => n.id === TEST_NODE_ID), undefined);

  const direto = new Commander().plan({ objective: 'converta 10 dólares para reais', verifyTests: true });
  assert.equal(direto.mode, 'direct');
  assert.equal(
    direto.graph.nodes.find((n) => n.id === TEST_NODE_ID),
    undefined,
    'uma resposta de uma chamada não escreve arquivo: não há o que a suíte meça',
  );
});

test('test-run: a varredura anti-stub não roda sobre saída capturada', async () => {
  const { validateArtifact } = await import('../contracts/artifacts.js');
  // O runner de testes do Node imprime "ℹ todo 0" no resumo de uma suíte 100%
  // verde. Enquanto a varredura autoral rodava sobre isso, o artefato de uma
  // suíte que passou era reprovado por "stub detectado": a validação media o
  // vocabulário do programa que rodou.
  const verde = {
    command: 'npm test --silent',
    runner: 'npm',
    exitCode: 0,
    passed: true,
    stdout: 'ℹ tests 1\nℹ pass 1\nℹ fail 0\nℹ todo 0\n',
    stderr: '',
  };
  const report = validateArtifact('test-run', verde);
  assert.equal(report.valid, true, `esperava válido, veio: ${report.issues.join('; ')}`);

  // O que continua valendo: campo obrigatório ausente reprova.
  assert.equal(validateArtifact('test-run', { runner: 'npm', exitCode: 0 }).valid, false);
});
