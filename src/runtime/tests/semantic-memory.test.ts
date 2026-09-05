/**
 * A camada semântica passa a ser escrita pelo runtime, e lida DURANTE o run.
 *
 * Antes: `.agents/memoria/semantica.md` só mudava quando uma pessoa o editava,
 * e `MemoryStore.search()` só era chamado pela CLI e pelo benchmark. Dentro de
 * um run, a única recuperação era padrão de falha.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryStore } from '../memory/store.js';
import { ContextResolver } from '../orchestration/context-resolver.js';
import type { TaskContract } from '../contracts/task-contract.js';

function store(): { m: MemoryStore; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-sem-'));
  return { m: new MemoryStore({ baseDir: dir }), dir };
}

test('memória: o runtime escreve na camada semântica, e a busca alcança o que foi escrito', () => {
  const { m, dir } = store();
  const gravou = m.appendKnowledge({
    title: 'Caminho verificado para: adicionar paginação em GET /users',
    body: 'Observado em 3 execuções verificadas.\n\nSequência: survey -> execute -> deliver',
    source: 'trajectory:abc123',
  });
  assert.equal(gravou, true);

  // O ponto: a BUSCA encontra. `addLearning` grava numa lista plana que a
  // busca não alcança, e era o único caminho de escrita que o runtime tinha.
  const achados = m.search('paginação GET users');
  assert.ok(achados.length > 0, 'a busca precisa alcançar o que o runtime gravou');
  assert.match(achados[0].content, /survey -> execute -> deliver/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('memória: escrita é idempotente pelo título', () => {
  const { m, dir } = store();
  assert.equal(m.appendKnowledge({ title: 'Mesmo título', body: 'corpo 1' }), true);
  assert.equal(m.appendKnowledge({ title: 'Mesmo título', body: 'corpo 2' }), false, 'rodar o mesmo objetivo de novo não pode duplicar');
  const arquivo = fs.readFileSync(path.join(dir, '.agents', 'memoria', 'semantica.md'), 'utf-8');
  assert.equal(arquivo.split('### Mesmo título').length - 1, 1);
  assert.ok(!arquivo.includes('corpo 2'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('memória: entrada vazia não entra, e o corpo tem teto', () => {
  const { m, dir } = store();
  assert.equal(m.appendKnowledge({ title: '   ', body: 'corpo' }), false);
  assert.equal(m.appendKnowledge({ title: 'título', body: '  ' }), false);
  assert.equal(m.appendKnowledge({ title: 'longo', body: 'x'.repeat(5000) }), true);
  const arquivo = fs.readFileSync(path.join(dir, '.agents', 'memoria', 'semantica.md'), 'utf-8');
  assert.ok(arquivo.length < 3000, `corpo precisa ser cortado pelo teto, arquivo tem ${arquivo.length}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

function contract(over: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'execute',
    objective: 'adicionar paginação em GET /users',
    role: 'specialist',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 1000 },
    verification: { deterministic: [] },
    acceptance: [],
    ...over,
  };
}

test('context resolver: conhecimento entra POR TAREFA, com teto, e aparece no prompt', () => {
  const resolver = new ContextResolver({
    knowledge: (query, limit) => {
      assert.equal(query, 'adicionar paginação em GET /users', 'a consulta é o objetivo DESTA tarefa');
      assert.ok(limit <= 2, 'no máximo duas entradas por tarefa');
      return [{ title: 'Caminho verificado', content: 'survey -> execute -> deliver' }];
    },
    maxKnowledgeChars: 600,
  });
  const ctx = resolver.resolve(contract(), new Map());
  assert.deepEqual(ctx.knowledge, [{ title: 'Caminho verificado', excerpt: 'survey -> execute -> deliver' }]);
  assert.match(resolver.render(ctx), /O QUE ESTE PROJETO JÁ SABE/);
});

test('context resolver: o teto corta, e numa correção o conhecimento fica de fora', () => {
  const resolver = new ContextResolver({
    knowledge: () => [{ title: 'Enorme', content: 'y'.repeat(5000) }],
    maxKnowledgeChars: 300,
  });
  const ctx = resolver.resolve(contract(), new Map());
  assert.equal(ctx.knowledge?.[0].excerpt.length, 300);

  // Rodada de correção: o nó já recebeu o contexto de fundo na primeira
  // tentativa, e o que falta é a correção, não mais texto.
  const correcao = resolver.resolve(contract(), new Map(), { correction: 'consertar X' });
  assert.equal(correcao.knowledge, undefined);
});

test('context resolver: busca que quebra não derruba o nó, e sem busca nada muda', () => {
  const quebrado = new ContextResolver({
    knowledge: () => {
      throw new Error('memória ilegível');
    },
  });
  assert.equal(quebrado.resolve(contract(), new Map()).knowledge, undefined);

  const semBusca = new ContextResolver();
  const ctx = semBusca.resolve(contract(), new Map());
  assert.equal(ctx.knowledge, undefined);
  assert.ok(!semBusca.render(ctx).includes('JÁ SABE'));
});
