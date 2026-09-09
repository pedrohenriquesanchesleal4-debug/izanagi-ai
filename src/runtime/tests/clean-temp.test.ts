import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { cleanTemp, isFrameworkTempEntry, TEMP_PREFIXES } from '../../scripts/clean-temp.js';
import { isFrameworkRepo } from '../../installer.js';

/**
 * O vazamento que estes testes travam: 3.517 diretórios `izanagi-*` no TEMP do
 * usuário, acumulados por ~40 suítes que criam `mkdtempSync` e nenhuma remove.
 * O risco do conserto é o oposto: um limpador que apague o que não criou.
 */

function fakeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-tests-cleantemp-'));
}

test('clean-temp: remove o que tem prefixo do framework e NÃO toca no resto', () => {
  const root = fakeTmp();
  const meu = path.join(root, 'izanagi-mem-AbCdEf');
  const meuTambem = path.join(root, 'izanagi-approvals-123456');
  const doUsuario = path.join(root, 'izanagi-notas-do-pedro');
  const alheio = path.join(root, 'projeto-importante');

  for (const d of [meu, meuTambem, doUsuario, alheio]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(alheio, 'nao-apagar.txt'), 'dado real', 'utf8');

  const res = cleanTemp({ tmpDir: root });

  assert.equal(fs.existsSync(meu), false);
  assert.equal(fs.existsSync(meuTambem), false);
  assert.equal(fs.existsSync(doUsuario), true, 'prefixo parecido não é prefixo do framework');
  assert.equal(fs.existsSync(alheio), true);
  assert.equal(fs.readFileSync(path.join(alheio, 'nao-apagar.txt'), 'utf8'), 'dado real');
  assert.equal(res.removed.length, 2);
  assert.equal(res.scanned, 2);

  fs.rmSync(root, { recursive: true, force: true });
});

test('clean-temp: remove árvore com conteúdo, não só diretório vazio', () => {
  const root = fakeTmp();
  const dir = path.join(root, 'izanagi-artifacts-XyZ123', 'sub', 'mais');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'a.json'), '{}', 'utf8');

  cleanTemp({ tmpDir: root });
  assert.equal(fs.existsSync(path.join(root, 'izanagi-artifacts-XyZ123')), false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('clean-temp: --dry-run relata sem remover', () => {
  const root = fakeTmp();
  const dir = path.join(root, 'izanagi-dash-000001');
  fs.mkdirSync(dir, { recursive: true });

  const res = cleanTemp({ tmpDir: root, dryRun: true });
  assert.deepEqual(res.removed, ['izanagi-dash-000001']);
  assert.equal(fs.existsSync(dir), true, 'dry-run não pode remover nada');

  fs.rmSync(root, { recursive: true, force: true });
});

test('clean-temp: maxAgeHours preserva o que é recente', () => {
  const root = fakeTmp();
  const recente = path.join(root, 'izanagi-tools-recente1');
  fs.mkdirSync(recente, { recursive: true });

  const res = cleanTemp({ tmpDir: root, maxAgeHours: 24 });
  assert.equal(fs.existsSync(recente), true);
  assert.equal(res.kept, 1);
  assert.equal(res.removed.length, 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('clean-temp: todo prefixo declarado termina em "-" (senão casaria nome de usuário)', () => {
  for (const p of TEMP_PREFIXES) {
    assert.ok(p.startsWith('izanagi-'), `${p}: prefixo tem que ser do framework`);
    assert.ok(p.endsWith('-'), `${p}: sem o hífen final, "izanagi-mem" casaria "izanagi-memorias-do-usuario"`);
  }
  assert.equal(isFrameworkTempEntry('izanagi-mem-aB12Cd'), true);
  assert.equal(isFrameworkTempEntry('izanagi-memorias-do-usuario'), false);
  assert.equal(isFrameworkTempEntry('outro-projeto'), false);
});

test('installer: o espelho de assets NÃO é criado dentro do próprio repo do framework', () => {
  // A guarda existia só para os documentos de raiz (v3.21.0). O espelho de
  // assets ficou de fora, e é ele que tem ~700 arquivos: era a origem das duas
  // pastas de agentes que ninguém sabia explicar.
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
  assert.equal(isFrameworkRepo(repoRoot), true, 'o checkout do framework tem que ser reconhecido como tal');

  const projeto = fakeTmp();
  fs.writeFileSync(path.join(projeto, 'package.json'), JSON.stringify({ name: 'app-do-usuario' }), 'utf8');
  assert.equal(isFrameworkRepo(projeto), false, 'projeto de consumidor não é o repo do framework');

  fs.rmSync(projeto, { recursive: true, force: true });
});
