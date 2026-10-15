import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryStore } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-mem-del-'));
}

test('MemoryStore: busca com filtro de categoria e exclusão seletiva de memória', async () => {
  const dir = tmpDir();
  try {
    const store = new MemoryStore({ baseDir: dir });

    const memoriaDir = path.join(dir, '.agents', 'memoria');
    fs.mkdirSync(memoriaDir, { recursive: true });

    fs.writeFileSync(
      path.join(memoriaDir, 'decisoes.md'),
      `# Decisões Arquiteturais

## ADR-001: Usar SQLite para persistência de memória
Decidido usar SQLite para armazenar sessões locais sem overhead.

## ADR-002: Modularizar adaptadores de CLI
Separar adaptadores de Antigravity e OpenCode em módulos isolados.
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(memoriaDir, 'semantica.md'),
      `# Conhecimento Semântico

## Playwright Container Setup
Playwright headless necessita de xvfb em certos contêineres Linux.
`,
      'utf-8',
    );

    // Busca filtrada por categoria
    const decisionMatches = store.search('SQLite', { category: 'decision' });
    assert.equal(decisionMatches.length, 1);
    assert.equal(decisionMatches[0].category, 'decision');
    assert.match(decisionMatches[0].content, /SQLite/);

    const learningMatches = store.search('Playwright', { category: 'semantic' });
    assert.equal(learningMatches.length, 1);
    assert.equal(learningMatches[0].category, 'semantic');
    assert.match(learningMatches[0].content, /Playwright/);

    // Busca em categoria que não contém o termo
    const wrongCategoryMatches = store.search('Playwright', { category: 'decision' });
    assert.equal(wrongCategoryMatches.length, 0);

    // Exclusão por título específico
    const deletedOne = store.deleteMemory('decision', 'ADR-001: Usar SQLite para persistência de memória');
    assert.equal(deletedOne, true);

    const afterDelete = store.search('SQLite', { category: 'decision' });
    assert.equal(afterDelete.length, 0);

    const remainingDecisions = store.search('Modularizar', { category: 'decision' });
    assert.equal(remainingDecisions.length, 1);

    // Exclusão total de categoria via wildcard '*'
    const deletedAllDecisions = store.deleteMemory('decision', '*');
    assert.equal(deletedAllDecisions, true);

    const noDecisions = store.search('Modularizar', { category: 'decision' });
    assert.equal(noDecisions.length, 0);

    // A categoria semantic/learning continua preservada
    const stillHasLearning = store.search('Playwright', { category: 'semantic' });
    assert.equal(stillHasLearning.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
