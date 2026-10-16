import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryStore, computeLocalEmbedding, cosineSimilarity } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-mem-vector-test-'));
}

test('Vector Embeddings: extrai vetores normalizados e calcula similaridade de cosseno', () => {
  const v1 = computeLocalEmbedding('sistema de autenticação e tokens jwt');
  const v2 = computeLocalEmbedding('autenticacao de usuarios com token jwt');
  const v3 = computeLocalEmbedding('banco de dados postgresql com migrations sql');

  assert.ok(v1.size > 0, 'v1 deve ter termos');
  assert.ok(v2.size > 0, 'v2 deve ter termos');

  const simHigh = cosineSimilarity(v1, v2);
  const simLow = cosineSimilarity(v1, v3);

  assert.ok(simHigh > 0.4, `Similaridade entre textos relacionados deve ser alta (obtido: ${simHigh})`);
  assert.ok(simLow < simHigh, `Similaridade entre tópicos distintos deve ser menor (${simLow} < ${simHigh})`);
});

test('MemoryStore: vectorSearch encontra conhecimento semântico e hybridSearch combina léxico + vetorial', () => {
  const dir = tmpDir();
  try {
    const memoriaDir = path.join(dir, '.agents', 'memoria');
    fs.mkdirSync(memoriaDir, { recursive: true });

    // Cria arquivo de decisões
    fs.writeFileSync(
      path.join(memoriaDir, 'decisoes.md'),
      `# Decisões do Projeto

### ADR-001: Autenticação stateless via tokens JWT
Adotamos autenticação stateless com tokens criptografados para garantir escalabilidade horizontal sem dependência de sessão no servidor.

### ADR-002: Armazenamento relacional PostgreSQL
Adotamos PostgreSQL para garantir integridade relacional e conformidade ACID com migrações tipadas.
`,
      'utf-8',
    );

    const store = new MemoryStore({ baseDir: dir });

    // 1. vectorSearch
    const vecResults = store.vectorSearch('tokens de login e autenticacao', { category: 'decision' });
    assert.ok(vecResults.length > 0, 'vectorSearch deve encontrar resultado');
    assert.equal(vecResults[0].title, 'decisoes.md');
    assert.match(vecResults[0].content, /ADR-001: Autenticação stateless via tokens JWT/);
    assert.ok(vecResults[0].similarity > 0.1, 'similarity deve ser significativa');

    // 2. hybridSearch
    const hybridResults = store.hybridSearch('autenticação stateless JWT', { category: 'decision' });
    assert.ok(hybridResults.length > 0, 'hybridSearch deve retornar resultado');
    assert.equal(hybridResults[0].title, 'decisoes.md');
    assert.match(hybridResults[0].content, /ADR-001: Autenticação stateless via tokens JWT/);
    assert.ok(hybridResults[0].score > 3.0, 'score híbrido deve somar léxico e vetorial');
    assert.ok(hybridResults[0].similarity > 0.2, 'similarity vetorial presente no resultado');

    // 3. search com flag hybrid: true
    const searchHybrid = store.search('tokens JWT', { category: 'decision', hybrid: true });
    assert.ok(searchHybrid.length > 0, 'search(..., { hybrid: true }) funciona');
    assert.equal(searchHybrid[0].title, 'decisoes.md');
    assert.match(searchHybrid[0].content, /ADR-001: Autenticação stateless via tokens JWT/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
