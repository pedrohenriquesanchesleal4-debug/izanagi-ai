import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  DOC_VERSION_BANNERS,
  docVersionWarning,
  minorOf,
  readDocVersions,
  staleDocVersions,
} from '../../scripts/doc-version.js';

/**
 * A drift de banner de versão já foi corrigida à mão uma vez (v3.6.0) e voltou
 * na minor seguinte, porque nada a media. Estes testes são o gate: limite
 * testado é um limite, limite só documentado é esperança.
 */

/** `dist/runtime/tests/x.test.js` → raiz do repositório. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function packageVersion(): string {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8')).version;
}

test('doc-version: nenhum documento de raiz declara uma MAJOR.MINOR diferente do package.json', () => {
  const version = packageVersion();
  const stale = staleDocVersions(repoRoot, version);
  assert.deepEqual(
    stale,
    [],
    `Documentos com banner de versão desatualizado (esperado ${minorOf(version)}.x):\n${docVersionWarning(repoRoot, version)}`,
  );
});

test('doc-version: o padrão de cada banner registrado casa no arquivo real', () => {
  // Um padrão que deixou de casar (porque alguém reescreveu a frase do banner)
  // é pior que banner errado: o gate acima passaria por não encontrar número
  // nenhum. `staleDocVersions` trata isso como `missing-banner`, e aqui a
  // cobertura é por arquivo, para o erro dizer QUAL documento quebrou.
  for (const doc of readDocVersions(repoRoot)) {
    if (!doc.present) continue; // README.md/ARCHITECTURE.md não vão no pacote npm
    assert.ok(
      doc.declared !== null,
      `${doc.file}: banner de versão não encontrado — o padrão em DOC_VERSION_BANNERS não casa mais`,
    );
  }
});

test('doc-version: neste checkout todos os documentos registrados existem', () => {
  // O `present: false` existe para o pacote instalado, onde `README.md` e
  // `ARCHITECTURE.md` não são distribuídos. Rodando do checkout, ausência é
  // arquivo renomeado ou apagado, e o registro precisa saber disso.
  for (const banner of DOC_VERSION_BANNERS) {
    assert.ok(
      fs.existsSync(path.join(repoRoot, banner.file)),
      `${banner.file} está em DOC_VERSION_BANNERS e não existe no checkout`,
    );
  }
});

test('doc-version: patch não é drift, minor é', () => {
  assert.equal(minorOf('3.18.0'), '3.18');
  assert.equal(minorOf('3.18.4'), '3.18');
  assert.notEqual(minorOf('3.19.0'), minorOf('3.18.0'));
});

test('doc-version: arquivo ausente não é reportado como desatualizado', () => {
  // Ausência é "não distribuído", nunca "errado" — a mesma regra de
  // "ausência não é aprovação" aplicada na direção certa: sem arquivo não há
  // afirmação, e sem afirmação não há o que reprovar.
  const empty = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'izanagi-docver-'));
  try {
    assert.deepEqual(staleDocVersions(empty, '9.9.9'), []);
    assert.equal(docVersionWarning(empty, '9.9.9'), '');
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('doc-version: banner presente com minor diferente é reportado com o que declara e o que se espera', () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'izanagi-docver-'));
  try {
    fs.writeFileSync(path.join(dir, 'SYSTEM.md'), '# X\n\n> Version 3.10.0\n');
    const stale = staleDocVersions(dir, '3.18.0');
    assert.equal(stale.length, 1);
    assert.equal(stale[0].file, 'SYSTEM.md');
    assert.equal(stale[0].declared, '3.10.0');
    assert.equal(stale[0].expectedMinor, '3.18');
    assert.equal(stale[0].reason, 'minor-drift');
    assert.match(docVersionWarning(dir, '3.18.0'), /SYSTEM\.md: declara 3\.10\.0, esperado 3\.18\.x/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('doc-version: arquivo presente sem banner reconhecível é missing-banner, não silêncio', () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'izanagi-docver-'));
  try {
    fs.writeFileSync(path.join(dir, 'RULES.md'), '# Regras\n\nSem banner nenhum.\n');
    const stale = staleDocVersions(dir, '3.18.0');
    assert.equal(stale.length, 1);
    assert.equal(stale[0].reason, 'missing-banner');
    assert.equal(stale[0].declared, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('doc-version: patch do package.json não invalida banner da mesma minor', () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'izanagi-docver-'));
  try {
    fs.writeFileSync(path.join(dir, 'SYSTEM.md'), '# X\n\n> Version 3.18.0\n');
    assert.deepEqual(staleDocVersions(dir, '3.18.7'), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
