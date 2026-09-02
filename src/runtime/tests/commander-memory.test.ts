/**
 * Memória e skills no PLANEJAMENTO (não só na execução).
 *
 * Dois gaps do handoff cobertos aqui:
 *  - o Commander decidia modo e agente sem saber que aquele agente vinha
 *    falhando, nem que existe padrão de falha conhecido para o objetivo;
 *  - a chain de skills era resolvida UMA vez por run e a mesma lista ia para
 *    todos os nós, independente do que cada tarefa pedia.
 *
 * A regra que não pode ser quebrada: recuperação SELETIVA. Memória entra como
 * sinal de decisão, nunca como bloco injetado no contexto.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Commander, classify, decideMode, type PlanningMemory } from '../orchestration/commander.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';

const OBJECTIVE = 'Implementar o endpoint de login da API com validacao de credenciais e testes';

function memoryWith(opts: {
  failures?: Array<{ pattern: string; occurrences: number; confidence: number }>;
  agents?: Record<string, { runs: number; successes: number; failures: number }>;
}): PlanningMemory {
  return {
    findRelevantFailures: () => opts.failures ?? [],
    agentStats: (agent) => opts.agents?.[agent],
  };
}

/* ============================ modo informado pela memória ============================ */

test('memória: padrão de falha conhecido sobe o modo UM degrau', () => {
  const classification = classify(OBJECTIVE);
  const semMemoria = decideMode(classification);
  const comMemoria = decideMode(classification, undefined, { knownFailures: 2 });

  const ladder = ['direct', 'assisted', 'orchestrated', 'autonomous'];
  assert.equal(
    ladder.indexOf(comMemoria.mode) - ladder.indexOf(semMemoria.mode),
    1,
    'memória é evidência de dificuldade, não licença para o modo mais caro',
  );
  assert.match(comMemoria.reason, /padrão\(ões\) de falha conhecido/);
});

test('memória: no topo da escada não há degrau para subir', () => {
  const classification = classify('Construir um SaaS completo do zero com backend, frontend, banco e deploy');
  assert.equal(decideMode(classification).mode, 'autonomous');
  assert.equal(decideMode(classification, undefined, { knownFailures: 9 }).mode, 'autonomous');
});

test('memória: modo forçado pelo usuário vence o sinal da memória', () => {
  const classification = classify(OBJECTIVE);
  const decided = decideMode(classification, 'direct', { knownFailures: 5 });
  assert.equal(decided.mode, 'direct');
});

test('memória: a consulta aparece nas decisões do plano (entra no Decision Journal)', () => {
  const plan = new Commander().plan({
    objective: OBJECTIVE,
    memory: memoryWith({ failures: [{ pattern: 'auth-token-expiry', occurrences: 4, confidence: 0.8 }] }),
  });
  const nota = plan.decisions.find((d) => d.startsWith('memória consultada'));
  assert.ok(nota, `esperava a nota de memória nas decisões: ${JSON.stringify(plan.decisions)}`);
  assert.match(nota!, /1 padrão\(ões\) de falha relevante\(s\)/);
  assert.match(nota!, /auth-token-expiry/);
});

test('memória: sem memória injetada, o plano não menciona consulta nenhuma', () => {
  const plan = new Commander().plan({ objective: OBJECTIVE });
  assert.ok(!plan.decisions.some((d) => d.startsWith('memória consultada')));
});

/* ============================ agente informado pela memória ============================ */

function registryWithAgents(): { registry: AgentCapabilityRegistry; baseDir: string } {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-caps-'));
  fs.mkdirSync(path.join(baseDir, 'agents'), { recursive: true });
  const write = (id: string, purpose: string) =>
    fs.writeFileSync(
      path.join(baseDir, 'agents', `${id}-agent.json`),
      JSON.stringify({
        name: id,
        role: purpose,
        capabilities: ['login', 'endpoint', 'api', 'validacao', 'credenciais'],
        skills: ['tdd'],
        chains: { implement: ['tdd'] },
        token_budget: 4096,
      }),
      'utf-8',
    );
  write('alfa-engineer', 'Implementar endpoint de login da API com validacao de credenciais e testes');
  write('beta-engineer', 'Implementar endpoint de login da API com validacao de credenciais e testes');
  return { registry: new AgentCapabilityRegistry({ baseDir }), baseDir };
}

test('memória: agente com histórico ruim perde a vaga para o par confiável', () => {
  const { registry, baseDir } = registryWithAgents();
  const semMemoria = new Commander().plan({ objective: OBJECTIVE, mode: 'assisted', capabilities: registry });
  const escolhidoSemMemoria = semMemoria.contracts[0].agent!;
  const rival = escolhidoSemMemoria === 'alfa-engineer' ? 'beta-engineer' : 'alfa-engineer';

  const comMemoria = new Commander().plan({
    objective: OBJECTIVE,
    mode: 'assisted',
    capabilities: registry,
    memory: memoryWith({ agents: { [escolhidoSemMemoria]: { runs: 8, successes: 1, failures: 7 } } }),
  });
  assert.equal(comMemoria.contracts[0].agent, rival, 'agente com 1/8 de sucesso não deveria continuar sendo o default');
  assert.ok(comMemoria.decisions.some((d) => d.includes('despriorizado')));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('memória: histórico ruim em TODOS não paralisa o plano', () => {
  const { registry, baseDir } = registryWithAgents();
  const plan = new Commander().plan({
    objective: OBJECTIVE,
    mode: 'assisted',
    capabilities: registry,
    memory: memoryWith({
      agents: {
        'alfa-engineer': { runs: 5, successes: 0, failures: 5 },
        'beta-engineer': { runs: 5, successes: 0, failures: 5 },
      },
    }),
  });
  assert.ok(plan.contracts[0].agent, 'melhor um agente com histórico ruim do que nenhum agente');
  assert.equal(plan.issues.length, 0);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('memória: amostra pequena não desclassifica ninguém', () => {
  const { registry, baseDir } = registryWithAgents();
  const base = new Commander().plan({ objective: OBJECTIVE, mode: 'assisted', capabilities: registry });
  const escolhido = base.contracts[0].agent!;
  // 1 falha em 2 runs: taxa ruim, amostra insuficiente para confiar nela.
  const comPoucaAmostra = new Commander().plan({
    objective: OBJECTIVE,
    mode: 'assisted',
    capabilities: registry,
    memory: memoryWith({ agents: { [escolhido]: { runs: 2, successes: 0, failures: 2 } } }),
  });
  assert.equal(comPoucaAmostra.contracts[0].agent, escolhido);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ skills por tarefa ============================ */

test('skills: cada tarefa carrega o próprio ranking, não a chain do run', () => {
  const queries: string[] = [];
  const plan = new Commander().plan({
    objective: 'Auditar a seguranca OWASP da API de login, corrigir e testar',
    mode: 'autonomous',
    skillChain: ['chain-do-run-a', 'chain-do-run-b'],
    resolveSkills: (objective, limit) => {
      queries.push(objective);
      // Ranking simulado: devolve uma skill que carrega o id do nó, para
      // provar que a resolução aconteceu POR TAREFA.
      return [`skill-para-${objective.split(' ')[0]}`].slice(0, limit);
    },
  });

  const comSkills = plan.graph.nodes.filter((n) => n.kind === 'agent');
  assert.ok(comSkills.length >= 2);
  for (const node of comSkills) {
    assert.deepEqual(node.skills, [`skill-para-${node.id}`], `nó "${node.id}" deveria carregar a skill do próprio objetivo`);
  }
  assert.equal(new Set(queries).size, queries.length, 'cada tarefa deveria gerar a própria consulta');

  // Nós determinísticos não carregam skill: não há prompt para elas ocuparem.
  for (const node of plan.graph.nodes.filter((n) => n.kind === 'gate' || n.kind === 'evaluator')) {
    assert.ok(!node.skills || node.skills.length === 0 || node.skills[0].startsWith('chain-do-run'));
  }
});

test('skills: sem resolver injetado, a chain do run continua valendo', () => {
  const plan = new Commander().plan({
    objective: OBJECTIVE,
    mode: 'assisted',
    skillChain: ['tdd', 'clean-code-validator'],
  });
  assert.deepEqual(plan.graph.nodes[0].skills, ['tdd', 'clean-code-validator']);
});

test('skills: resolver que quebra não derruba o planejamento', () => {
  const plan = new Commander().plan({
    objective: OBJECTIVE,
    mode: 'assisted',
    skillChain: ['tdd'],
    resolveSkills: () => {
      throw new Error('índice de skills corrompido');
    },
  });
  assert.deepEqual(plan.graph.nodes[0].skills, ['tdd'], 'cai na chain do run em vez de falhar o plano');
  assert.equal(plan.issues.length, 0);
});

test('skills: o teto por tarefa é respeitado mesmo com resolver generoso', () => {
  const plan = new Commander().plan({
    objective: OBJECTIVE,
    mode: 'assisted',
    resolveSkills: () => ['a', 'b', 'c', 'd', 'e', 'f'],
  });
  assert.ok(plan.graph.nodes[0].skills!.length <= 3, 'carregar 100 skills por tarefa é exatamente o que a arquitetura proíbe');
});
