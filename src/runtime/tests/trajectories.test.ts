/**
 * Trajetórias e a medição que destravou (ou não) as ideias do Hermes.
 *
 * Duas coisas sendo protegidas aqui:
 *
 *  1. Síntese de skill a partir de trajetória recorrente. O risco é sintetizar
 *     demais: uma skill genérica por run bem-sucedido polui a biblioteca e
 *     compete com as boas no ranking. Metade dos testes verifica a BARRA.
 *  2. A busca de memória, que tinha recall truncado em silêncio — buscava
 *     apenas sobre os primeiros 4000 chars de cada arquivo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  describeTrajectory,
  isRecurrent,
  signatureOf,
  skillNameFor,
  MIN_OCCURRENCES_TO_SYNTHESIZE,
  type Trajectory,
  type TrajectoryStep,
} from '../evolution/trajectories.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import { Orchestrator } from '../orchestrator.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { attachContract, type TaskContract } from '../contracts/task-contract.js';
import {
  measureContextCompression,
  measureMemorySearch,
  syntheticArtifacts,
  writeSyntheticMemory,
  COMPRESSION_TARGET_RATIO,
} from '../benchmarks/memory-benchmark.js';
import type { CommanderPlan } from '../orchestration/commander.js';
import type { GraphNode } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-traj-'));
}

const PASSOS: TrajectoryStep[] = [
  { nodeId: 'scan', agent: 'security', kind: 'security-report', verified: true },
  { nodeId: 'fix', agent: 'senior-engineer', kind: 'implementation', verified: true },
  { nodeId: 'qa', agent: 'qa', kind: 'test-plan', verified: true },
];

/* ============================ assinatura ============================ */

test('trajetória: o mesmo caminho gera a mesma assinatura, com objetivos diferentes', () => {
  const a = signatureOf(PASSOS)!;
  const b = signatureOf(PASSOS.map((p) => ({ ...p, nodeId: `outro-${p.nodeId}` })))!;
  assert.equal(a.signature, b.signature, 'a assinatura é o caminho (agente -> kind), não o id do nó');
  assert.deepEqual(a.steps, ['security -> security-report', 'senior-engineer -> implementation', 'qa -> test-plan']);
});

test('trajetória: passo não verificado não entra no caminho', () => {
  const comFuro = signatureOf(PASSOS.map((p, i) => (i === 1 ? { ...p, verified: false } : p)))!;
  assert.equal(comFuro.steps.length, 2);
  assert.notEqual(comFuro.signature, signatureOf(PASSOS)!.signature);
});

test('trajetória: execução curta demais não é procedimento', () => {
  assert.equal(signatureOf([PASSOS[0]]), null);
  assert.equal(signatureOf([]), null);
  assert.equal(signatureOf(PASSOS.map((p) => ({ ...p, verified: false }))), null);
});

/* ============================ memória ============================ */

test('trajetória: repetições consolidam em vez de duplicar', () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  for (let i = 0; i < 3; i++) {
    memory.recordTrajectory({ steps: PASSOS, objective: `auditar sistema ${i}`, domains: ['security'], success: true });
  }
  memory.recordTrajectory({ steps: PASSOS, objective: 'auditar sistema 4', domains: ['security'], success: false });

  const todas = memory.listTrajectories();
  assert.equal(todas.length, 1, 'o mesmo caminho é uma trajetória, não quatro');
  assert.equal(todas[0].occurrences, 4);
  assert.equal(todas[0].successes, 3);
  assert.equal(todas[0].examples.length, 4);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('trajetória: a barra é recorrência COM sucesso, não só repetição', () => {
  const base: Trajectory = {
    signature: 'abc', steps: ['a -> b', 'b -> c'], domains: [], occurrences: 5, successes: 1,
    firstSeen: '', lastSeen: '', examples: [],
  };
  assert.equal(isRecurrent(base), false, 'repetir e falhar não é procedimento');
  assert.equal(isRecurrent({ ...base, successes: 5 }), true);
  assert.equal(isRecurrent({ ...base, successes: 5, occurrences: 2 }), false);
  assert.equal(isRecurrent({ ...base, successes: 5, synthesizedSkill: 'x' }), false, 'não sintetiza duas vezes');
});

test('trajetória: estado gravado antes desta versão continua legível', () => {
  const baseDir = tmpDir();
  const file = path.join(baseDir, '.izanagi', 'state', 'runtime-state.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, agents: {}, skills: {}, failures: {}, learnings: [], updatedAt: '' }), 'utf-8');
  const memory = new MemoryStore({ baseDir });
  assert.deepEqual(memory.listTrajectories(), []);
  assert.ok(memory.recordTrajectory({ steps: PASSOS, objective: 'x', success: true }));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('trajetória: a skill descreve o caminho observado e declara o próprio limite', () => {
  const t: Trajectory = {
    signature: 'abc123', steps: ['security -> security-report', 'qa -> test-plan'], domains: ['security'],
    occurrences: 4, successes: 4, firstSeen: '', lastSeen: '', examples: ['auditar API'],
  };
  const corpo = describeTrajectory(t);
  assert.ok(corpo.includes('security -> security-report'));
  assert.ok(corpo.includes('4 execuções'));
  assert.ok(/não uma garantia de que/.test(corpo), 'a skill não pode prometer mais do que a evidência mostra');
  assert.equal(skillNameFor(t), 'procedimento-security-abc123');
});

/* ============================ gatilho no runtime ============================ */

const LONGO = 'Conteudo real e completo do artefato entregue pela tarefa. '.repeat(6);

function planoSimples(): CommanderPlan {
  const mk = (id: string, agent: string, deps: string[]): GraphNode =>
    attachContract(
      { id, kind: 'agent', agent, outputs: ['raw'], dependencies: deps, status: 'pending', tokenBudget: 1000, retryPolicy: { maxAttempts: 1, backoffMs: 0 } },
      {
        id, objective: `${id}: auditar`, role: 'specialist', agent, inputs: deps, constraints: [],
        expectedOutput: { kind: 'raw' }, dependencies: deps, priority: 'normal', budget: { maxTokens: 1000 },
        verification: { deterministic: [{ kind: 'artifact-valid' }] },
        acceptance: [{ id: `${id}:v`, description: 'valido', kind: 'deterministic', check: { kind: 'artifact-valid' } }],
      } satisfies TaskContract,
    );
  const graph = new ExecutionGraphBuilder().build({
    task: 'auditar',
    nodes: [mk('scan', 'security', []), mk('fix', 'senior-engineer', ['scan'])],
    budget: { maxAttempts: 1, maxTokens: 20_000, maxTimeMs: 120_000 },
  });
  return {
    runObjective: 'auditar', mode: 'orchestrated', modeReason: 'teste',
    classification: { complexity: 3, domains: ['security'], category: 'security_audit', reasoning: 'medium', risk: 0.8, reasons: [] },
    graph, contracts: [],
    estimate: { nodes: 2, parallelStages: 2, maxTokens: 2000, byRole: { commander: { tasks: 0, tokens: 0 }, specialist: { tasks: 2, tokens: 2000 }, worker: { tasks: 0, tokens: 0 } } },
    decisions: [], issues: [],
  };
}

async function rodarNVezes(n: number, baseDir: string, skillsDir: string) {
  const memory = new MemoryStore({ baseDir });
  for (let i = 0; i < n; i++) {
    const orchestrator = new Orchestrator({
      baseDir,
      command: 'test',
      task: `auditar o sistema ${i}`,
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: [],
      plan: planoSimples(),
      generatedSkillsDir: skillsDir,
      produce: () => ({ content: LONGO, kind: 'raw', tokens: 50 }),
    });
    orchestrator.setMemory(memory);
    orchestrator.setStore(new TraceStore({ baseDir }));
    await orchestrator.run();
  }
  return memory;
}

test('trajetória: run repetido e verificado vira skill procedural', async () => {
  const baseDir = tmpDir();
  const skillsDir = path.join(baseDir, 'geradas');
  const memory = await rodarNVezes(MIN_OCCURRENCES_TO_SYNTHESIZE, baseDir, skillsDir);

  const t = memory.listTrajectories()[0];
  assert.ok(t, 'a trajetória do run precisa ter sido registrada');
  assert.equal(t.occurrences, MIN_OCCURRENCES_TO_SYNTHESIZE);
  assert.ok(t.synthesizedSkill, `esperava skill sintetizada, trajetória: ${JSON.stringify(t)}`);

  const arquivo = path.join(skillsDir, t.synthesizedSkill!, 'SKILL.md');
  assert.ok(fs.existsSync(arquivo), `skill não foi gravada em ${arquivo}`);
  const conteudo = fs.readFileSync(arquivo, 'utf-8');
  assert.ok(conteudo.includes('security -> raw'), 'a skill precisa descrever o caminho observado');
  assert.ok(memory.listLearnings().some((l) => /trajetória recorrente/.test(l.text)));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('trajetória: abaixo da barra de recorrência, nada é sintetizado', async () => {
  const baseDir = tmpDir();
  const skillsDir = path.join(baseDir, 'geradas');
  const memory = await rodarNVezes(MIN_OCCURRENCES_TO_SYNTHESIZE - 1, baseDir, skillsDir);

  const t = memory.listTrajectories()[0];
  assert.equal(t.occurrences, MIN_OCCURRENCES_TO_SYNTHESIZE - 1);
  assert.equal(t.synthesizedSkill, undefined, 'sintetizar cedo demais polui a biblioteca de skills');
  assert.equal(fs.existsSync(skillsDir), false);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ busca de memória ============================ */

test('memória: a busca alcança conteúdo além dos primeiros 4000 chars', () => {
  const baseDir = tmpDir();
  const dir = path.join(baseDir, '.agents', 'memoria');
  fs.mkdirSync(dir, { recursive: true });
  // Termo escondido muito depois do corte antigo de 4000 chars.
  fs.writeFileSync(path.join(dir, 'decisoes.md'), `${'preenchimento irrelevante. '.repeat(1000)}\n## marcador-profundo-unico\ndecisao registrada`, 'utf-8');

  const memory = new MemoryStore({ baseDir });
  const encontrado = memory.search('marcador-profundo-unico');
  assert.equal(encontrado.length, 1, 'memória além do corte era invisível para a busca');
  assert.ok(encontrado[0].content.includes('marcador-profundo-unico'), 'a busca devolve a janela do match, não o começo do arquivo');
  assert.ok(encontrado[0].content.length < 2000, 'a janela precisa ser um trecho, não o arquivo inteiro');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('memória: preview continua cortado — só a busca vê o arquivo inteiro', () => {
  const baseDir = tmpDir();
  const dir = path.join(baseDir, '.agents', 'memoria');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'decisoes.md'), 'x'.repeat(20_000), 'utf-8');

  const memory = new MemoryStore({ baseDir });
  assert.equal(memory.listEntries()[0].content.length, 4000, 'entrada inteira no contexto é o que a arquitetura proíbe');
  assert.equal(memory.listEntries({ full: true })[0].content.length, 20_000);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ medição ============================ */

test('medição: a busca é medida sobre o corpus completo e o veredito traz o limiar', () => {
  const baseDir = tmpDir();
  const entradas = writeSyntheticMemory(baseDir, { entriesPerFile: 40, charsPerEntry: 1000 });
  assert.ok(entradas > 100);

  const m = measureMemorySearch(new MemoryStore({ baseDir }), ['contexto', 'decisao', 'termo-inexistente-zzz']);
  assert.ok(m.charsScanned > 100_000, `esperava corpus grande, veio ${m.charsScanned}`);
  assert.equal(m.charsScanned, m.charsReachable, 'todo char do corpus precisa ser alcançável pela busca');
  assert.ok(m.hits >= 1);
  assert.match(m.verdict, /teto de 25ms/);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('medição: a compressão determinística é medida contra um alvo declarado', () => {
  const contract = {
    id: 'b', objective: 'medir', role: 'specialist', inputs: [], constraints: [],
    expectedOutput: { kind: 'raw' }, dependencies: [], priority: 'normal', budget: { maxTokens: 4000 },
    verification: { deterministic: [] }, acceptance: [],
  } as unknown as TaskContract;

  const m = measureContextCompression(contract, syntheticArtifacts(6, 8000));
  assert.equal(m.fullChars, 48_000);
  assert.ok(m.ratio < COMPRESSION_TARGET_RATIO, `razão ${m.ratio} deveria estar abaixo do alvo`);
  assert.match(m.verdict, /não se justifica pelo tamanho/);
});
