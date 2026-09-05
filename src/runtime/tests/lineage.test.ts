/**
 * Linhagem de artefato: a travessia, e não o salto.
 *
 * As arestas (`dependencies` + `consumers`) sempre estiveram gravadas, e a
 * leitura parava no primeiro vizinho. Num grafo de sete nós, "de quem este
 * depende" nunca responde "de onde veio isto?".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ArtifactRegistry, MAX_METADATA_BYTES } from '../artifacts/registry.js';

function registry(): { reg: ArtifactRegistry; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-lineage-'));
  return { reg: new ArtifactRegistry({ baseDir: dir }), dir };
}

function put(reg: ArtifactRegistry, nodeId: string, deps: string[], content: string, over: Record<string, unknown> = {}) {
  return reg.register({
    kind: 'raw',
    name: nodeId,
    producer: { runId: 'r1', nodeId },
    hash: 'abc123',
    size: content.length,
    valid: true,
    score: 1,
    dependencies: deps.map((d) => `r1:${d}`),
    content,
    ...over,
  });
}

test('lineage: atravessa a cadeia inteira, dos dois lados', () => {
  const { reg, dir } = registry();
  // survey -> research -> execute -> review
  put(reg, 'survey', [], 'levantamento');
  put(reg, 'research', ['survey'], 'pesquisa');
  put(reg, 'execute', ['research'], 'implementação');
  put(reg, 'review', ['execute'], 'revisão');

  const { ancestors, descendants } = reg.lineage('r1:execute');
  assert.deepEqual(ancestors.map((r) => r.name), ['research', 'survey'], 'ancestrais em ordem de distância');
  assert.deepEqual(descendants.map((r) => r.name), ['review']);

  // A ponta da cadeia enxerga tudo que entrou nela.
  assert.deepEqual(reg.lineage('r1:review').ancestors.map((r) => r.name), ['execute', 'research', 'survey']);
  assert.deepEqual(reg.lineage('r1:survey').ancestors, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('lineage: ciclo termina em vez de girar', () => {
  const { reg, dir } = registry();
  // Um ciclo é recusado pelo builder no PLANO, mas um registro escrito à mão
  // (ou uma decomposição externa) pode produzi-lo, e a travessia não pode ser
  // o lugar onde o runtime trava.
  put(reg, 'a', ['b'], 'a');
  put(reg, 'b', ['a'], 'b');
  const { ancestors } = reg.lineage('r1:a');
  assert.deepEqual(ancestors.map((r) => r.name), ['b']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('lineage: dependência sem registro some, não vira buraco', () => {
  const { reg, dir } = registry();
  // "fantasma" é um nó que não chegou a produzir artefato.
  put(reg, 'execute', ['fantasma'], 'implementação');
  assert.deepEqual(reg.lineage('r1:execute').ancestors, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('compare: diz o que mudou, não só quanto o score caiu', () => {
  const { reg, dir } = registry();
  put(reg, 'execute', [], 'linha 1\nlinha 2\nlinha 3');
  put(reg, 'execute', [], 'linha 1\nlinha 2 corrigida\nlinha 3\nlinha 4');

  const diff = reg.compare('r1:execute', 1, 2);
  assert.equal(diff.a?.version, 1);
  assert.equal(diff.b?.version, 2);
  assert.equal(diff.identical, false);
  assert.deepEqual(diff.changed, { added: 2, removed: 1 });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('compare: conteúdo idêntico é reconhecido pelo checksum, e "não comparável" não vira "não mudou"', () => {
  const { reg, dir } = registry();
  put(reg, 'execute', [], 'mesmo texto');
  put(reg, 'execute', [], 'mesmo texto');
  const igual = reg.compare('r1:execute', 1, 2);
  assert.equal(igual.identical, true);
  assert.deepEqual(igual.changed, { added: 0, removed: 0 });

  // Sem content store, a comparação de conteúdo é AUSENTE, nunca "igual".
  const semStore = new ArtifactRegistry({ baseDir: dir, persistContent: false });
  put(semStore, 'outro', [], 'v1');
  put(semStore, 'outro', [], 'v2');
  const cego = semStore.compare('r1:outro', 1, 2);
  assert.equal(cego.changed, undefined, '"não deu para comparar" não pode se ler como "não mudou"');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('checksum: sha256 completo, e mesmo conteúdo dá o mesmo checksum', () => {
  const { reg, dir } = registry();
  const a = put(reg, 'x', [], 'conteúdo do artefato');
  const b = put(reg, 'y', [], 'conteúdo do artefato');
  const c = put(reg, 'z', [], 'outro conteúdo');
  assert.equal(a.checksum?.length, 64, 'sha256 hex completo, não sha1 truncado em 12');
  assert.equal(a.checksum, b.checksum);
  assert.notEqual(a.checksum, c.checksum);
  // `hash` continua o que era: é o que os registros já gravados carregam.
  assert.equal(a.hash, 'abc123');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('metadata: campo livre com teto, recusado INTEIRO quando estoura', () => {
  const { reg, dir } = registry();
  const ok = put(reg, 'a', [], 'x', { metadata: { origem: 'benchmark', caso: 'sec-owasp-scan' } });
  assert.deepEqual(ok.metadata, { origem: 'benchmark', caso: 'sec-owasp-scan' });

  const gigante = put(reg, 'b', [], 'x', { metadata: { despejo: 'y'.repeat(MAX_METADATA_BYTES + 1) } });
  assert.equal(gigante.metadata, undefined, 'metade que coube seria um metadado que parece completo e não é');

  const vazio = put(reg, 'c', [], 'x', { metadata: {} });
  assert.equal(vazio.metadata, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});
