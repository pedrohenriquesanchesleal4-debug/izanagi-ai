/**
 * O Decision Journal deixa de ser write-only.
 *
 * Ele era gravado a cada run e lido só por `izanagi explain`: log de auditoria
 * para humano, que é útil e não é retrieval. Nada no runtime consultava a
 * própria escolha anterior, e nenhuma decisão carregava o resultado que ela
 * causou — uma escolha sem consequência conhecida não ensina nada.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DecisionJournal } from '../memory/decisions.js';
import { Commander, type PlanningMemory } from '../orchestration/commander.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';

function journal(): { j: DecisionJournal; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-journal-'));
  return { j: new DecisionJournal({ baseDir: dir }), dir };
}

test('journal: o resultado do run é carimbado nas decisões daquele run, e só nelas', () => {
  const { j, dir } = journal();
  j.record({ kind: 'agent-routing', chosen: 'security', alternatives: [], reason: 'x', runId: 'r1', objective: 'auditar a API' });
  j.record({ kind: 'planning', chosen: 'orchestrated', alternatives: [], reason: 'y', runId: 'r1', objective: 'auditar a API' });
  j.record({ kind: 'agent-routing', chosen: 'qa', alternatives: [], reason: 'z', runId: 'r2', objective: 'outro objetivo' });

  const stamped = j.recordOutcome('r1', { status: 'FAIL', score: 0.3 });
  assert.equal(stamped, 2);
  assert.ok(j.forRun('r1').every((d) => d.outcome?.status === 'FAIL'));
  assert.equal(j.forRun('r2')[0].outcome, undefined, 'decisão de outro run não é tocada');

  // Segundo carimbo não reescreve: o journal registra o que aconteceu, não o
  // que se pensa agora sobre o que aconteceu.
  assert.equal(j.recordOutcome('r1', { status: 'PASS', score: 1 }), 0);
  assert.equal(j.forRun('r1')[0].outcome?.status, 'FAIL');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('journal: recuperação é SELETIVA e exige resultado conhecido', () => {
  const { j, dir } = journal();
  j.record({ kind: 'agent-routing', chosen: 'security', alternatives: [], reason: '', runId: 'r1', objective: 'auditar a segurança da API de pagamentos' });
  j.record({ kind: 'agent-routing', chosen: 'animation', alternatives: [], reason: '', runId: 'r2', objective: 'criar uma landing page com scroll cinematográfico' });
  j.recordOutcome('r1', { status: 'FAIL', score: 0.2 });
  j.recordOutcome('r2', { status: 'PASS', score: 1 });
  // Sem resultado: não entra, mesmo casando o objetivo.
  j.record({ kind: 'agent-routing', chosen: 'qa', alternatives: [], reason: '', runId: 'r3', objective: 'auditar a segurança da API de pagamentos' });

  const achados = j.findRelevant('auditar a segurança da API de pagamentos', { kind: 'agent-routing' });
  assert.deepEqual(achados.map((d) => d.chosen), ['security'], 'só o semelhante COM resultado');
  assert.ok(achados[0].relevance > 0.9);

  assert.deepEqual(j.findRelevant('objetivo totalmente diferente sobre culinária'), []);
  assert.deepEqual(j.findRelevant(''), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

function memoryWith(past: Array<{ chosen: string; outcomeStatus: string; relevance: number }>): PlanningMemory {
  return {
    findRelevantFailures: () => [],
    agentStats: () => undefined,
    pastDecisions: () => past,
  };
}

test('commander: agente queimado no MESMO objetivo sai da disputa, e a decisão diz por quê', () => {
  const capabilities = new AgentCapabilityRegistry({ baseDir: path.resolve(process.cwd()) });
  const plan = new Commander().plan({
    objective: 'auditar a segurança da API',
    mode: 'orchestrated',
    capabilities,
    memory: memoryWith([
      { chosen: 'security', outcomeStatus: 'FAIL', relevance: 0.9 },
      { chosen: 'security', outcomeStatus: 'FAIL', relevance: 0.85 },
    ]),
  });
  assert.ok(
    plan.decisions.some((d) => d.includes('Decision Journal') && d.includes('security')),
    `a decisão precisa dizer que veio do journal: ${plan.decisions.join(' | ')}`,
  );
  assert.ok(
    !plan.graph.nodes.some((n) => n.agent === 'security'),
    'agente queimado naquele objetivo não pode ser escolhido de novo',
  );
});

test('commander: uma falha só não queima, e sucesso no meio também não', () => {
  const capabilities = new AgentCapabilityRegistry({ baseDir: path.resolve(process.cwd()) });
  const umaFalha = new Commander().plan({
    objective: 'auditar a segurança da API',
    mode: 'orchestrated',
    capabilities,
    memory: memoryWith([{ chosen: 'security', outcomeStatus: 'FAIL', relevance: 0.9 }]),
  });
  assert.ok(
    !umaFalha.decisions.some((d) => d.includes('Decision Journal')),
    'um incidente pode ter sido provider fora do ar: não vira política',
  );

  const comSucesso = new Commander().plan({
    objective: 'auditar a segurança da API',
    mode: 'orchestrated',
    capabilities,
    memory: memoryWith([
      { chosen: 'security', outcomeStatus: 'FAIL', relevance: 0.9 },
      { chosen: 'security', outcomeStatus: 'FAIL', relevance: 0.9 },
      { chosen: 'security', outcomeStatus: 'PASS', relevance: 0.9 },
    ]),
  });
  assert.ok(
    !comSucesso.decisions.some((d) => d.includes('Decision Journal')),
    'agente que às vezes fecha o objetivo não é agente queimado nele',
  );
});

test('commander: memória sem `pastDecisions` continua planejando igual', () => {
  const capabilities = new AgentCapabilityRegistry({ baseDir: path.resolve(process.cwd()) });
  const semJournal = new Commander().plan({
    objective: 'auditar a segurança da API',
    mode: 'orchestrated',
    capabilities,
    memory: { findRelevantFailures: () => [], agentStats: () => undefined },
  });
  assert.ok(!semJournal.decisions.some((d) => d.includes('Decision Journal')));
  assert.ok(semJournal.graph.nodes.length > 0);
});
