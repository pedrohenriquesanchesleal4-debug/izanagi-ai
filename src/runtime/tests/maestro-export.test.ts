/**
 * Cobertura do mapeamento grafo Commander -> Auto Run docs (spec §3.1 e §6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { exportGraphToDocs, tierFromModelHint } from '../maestro/export-plan.js';
import type { ExecutionGraph, GraphNode } from '../types.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function buildGraph(nodes: GraphNode[], task = 'Construir um SaaS de faturamento com paginação'): ExecutionGraph {
  return new ExecutionGraphBuilder().build({ task, nodes });
}

test('export-plan: tool e gate nunca viram task', () => {
  const dir = tmpDir('izanagi-maestro-skip-');
  const graph = buildGraph([
    { id: 'survey', kind: 'tool' },
    { id: 'verify-tests', kind: 'tool' },
    { id: 'gate-qualidade', kind: 'gate' },
    { id: 'arquiteto', kind: 'agent', agent: 'architect', model: 'opus' },
  ]);
  const out = exportGraphToDocs(graph, { out: dir });

  assert.equal(out.docs.length, 1, 'tool/gate pulados deixam só o nó de agente');
  assert.equal(out.taskCount, 1);
  assert.deepEqual(out.skipped.sort(), ['gate-qualidade', 'survey', 'verify-tests']);
  const content = out.docs[0]!.content;
  assert.ok(content.includes('- [ ] arquiteto'), 'task do agente existe');
  assert.ok(!content.includes('survey'), 'nó tool não vaza para a doc');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('export-plan: approval vira task com MAESTRO:HITL', () => {
  const dir = tmpDir('izanagi-maestro-hitl-');
  const graph = buildGraph([
    { id: 'aprovar-prod', kind: 'approval', metadata: { reason: 'aprovar deploy em produção' }, outputs: ['deploy'] },
  ]);
  const out = exportGraphToDocs(graph, { out: dir });

  assert.equal(out.hitlCount, 1);
  assert.equal(out.taskCount, 1);
  const content = out.docs[0]!.content;
  assert.ok(content.includes('<!-- MAESTRO:HITL reason="aprovar deploy em produção" -->'));
  assert.ok(content.includes('- [ ] aprovar deploy em produção'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('export-plan: uma doc por parallelBatch, em ordem topológica', () => {
  const dir = tmpDir('izanagi-maestro-batch-');
  const graph = buildGraph([
    { id: 'a', kind: 'agent', agent: 'architect' },
    { id: 'b', kind: 'agent', agent: 'engineer' },
    { id: 'c', kind: 'agent', agent: 'qa', dependencies: ['a'] },
    { id: 'd', kind: 'agent', agent: 'reviewer', dependencies: ['c'] },
  ]);
  const out = exportGraphToDocs(graph, { out: dir });

  // topo: [a,b] paralelos, depois [c], depois [d]
  assert.equal(out.docs.length, 3);
  assert.deepEqual(
    out.docs.map((d) => d.filename),
    ['01-fase-1.md', '02-fase-2-qa.md', '03-fase-3-reviewer.md'],
  );
  // Ordem dentro da doc segue o grafo (a antes de b na fase 1)
  const first = out.docs[0]!;
  assert.ok(first.content.indexOf('- [ ] a') < first.content.indexOf('- [ ] b'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('export-plan: tier map premium/balanced/fast -> high/medium/low', () => {
  assert.equal(tierFromModelHint('opus'), 'high');
  assert.equal(tierFromModelHint('claude-sonnet-5'), 'medium');
  assert.equal(tierFromModelHint('haiku'), 'low');
  assert.equal(tierFromModelHint('balanced'), 'medium');
  assert.equal(tierFromModelHint(undefined), undefined);
  assert.equal(tierFromModelHint('modelo-desconhecido'), undefined);
});

test('export-plan: MAESTRO:MODEL com tier e reason do agente', () => {
  const dir = tmpDir('izanagi-maestro-model-');
  const graph = buildGraph([
    { id: 'arq', kind: 'agent', agent: 'architect', model: 'sonnet' },
    { id: 'eng', kind: 'skill', agent: 'engineer', model: 'haiku' },
  ]);
  const out = exportGraphToDocs(graph, { out: dir });
  const content = out.docs[0]!.content;

  assert.ok(content.includes('<!-- MAESTRO:MODEL tier="medium" reason="architect" -->'));
  assert.ok(content.includes('<!-- MAESTRO:MODEL tier="low" reason="engineer" -->'));
  assert.ok(content.includes('- [ ] arq'));
  assert.ok(content.includes('- [ ] eng'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('export-plan: grava docs no disco com slug do objetivo no diretório', () => {
  const dir = tmpDir('izanagi-maestro-files-');
  const graph = buildGraph([
    { id: 'a', kind: 'agent', agent: 'architect', model: 'opus' },
    { id: 'b', kind: 'agent', agent: 'engineer', dependencies: ['a'] },
  ]);
  const out = exportGraphToDocs(graph, { out: dir });

  const slug = out.slug;
  assert.ok(slug.length > 0, 'slug não pode ser vazio');
  assert.ok(out.dir.endsWith(slug), `dir deve terminar com o slug: ${out.dir} / ${slug}`);
  assert.equal(out.docs.length, 2);
  for (const doc of out.docs) {
    const file = path.join(out.dir, doc.filename);
    assert.ok(fs.existsSync(file), `doc gravada: ${file}`);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith(`# ${slug} - `), 'cabeçalho com slug e fase');
    assert.ok(text.includes('- [ ] '), 'checkbox real, não checklist vazio');
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('export-plan: grafo só com nodes pulados não grava diretório', () => {
  const dir = tmpDir('izanagi-maestro-vazio-');
  const graph = buildGraph([
    { id: 'survey', kind: 'tool' },
    { id: 'gate', kind: 'gate' },
  ]);
  const out = exportGraphToDocs(graph, { out: path.join(dir, 'playbooks') });
  assert.equal(out.docs.length, 0);
  assert.equal(out.dir, '');
  assert.equal(out.taskCount, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});