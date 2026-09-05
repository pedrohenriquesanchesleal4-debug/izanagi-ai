/**
 * Replanejamento pelo Commander: Plano B, não Plano A repetido.
 *
 * O `Planner.replan` legado reabria o nó falho e devolvia o mesmo grafo, com o
 * mesmo agente e o mesmo papel. Estes testes protegem a diferença: depois de
 * uma falha, ALGUMA coisa da estratégia precisa mudar — ou o replanejamento
 * precisa dizer, explicitamente, que não tinha o que mudar.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Commander, type CommanderInput, type ReplanFailure } from '../orchestration/commander.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import { ExecutionGraphBuilder } from '../orchestration/graph.js';
import { attachContract, contractOf, type TaskContract } from '../contracts/task-contract.js';
import { Orchestrator } from '../orchestrator.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import type { ExecutionGraph, GraphNode } from '../types.js';

const OBJECTIVE = 'Implementar o endpoint de login da API com validacao de credenciais';

function tmpRegistry(ids: string[]): { registry: AgentCapabilityRegistry; baseDir: string } {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-replan-'));
  fs.mkdirSync(path.join(baseDir, 'agents'), { recursive: true });
  for (const id of ids) {
    fs.writeFileSync(
      path.join(baseDir, 'agents', `${id}-agent.json`),
      JSON.stringify({
        name: id,
        role: 'Implementar endpoint de login da API com validacao de credenciais',
        capabilities: ['login', 'endpoint', 'api', 'validacao', 'credenciais'],
        skills: ['tdd'],
        chains: { implement: ['tdd'] },
        token_budget: 4096,
      }),
      'utf-8',
    );
  }
  return { registry: new AgentCapabilityRegistry({ baseDir }), baseDir };
}

function contractFor(id: string, role: TaskContract['role'], agent: string, deps: string[]): TaskContract {
  return {
    id,
    objective: `${id}: ${OBJECTIVE}`,
    role,
    agent,
    inputs: deps,
    constraints: ['zero stubs'],
    expectedOutput: { kind: 'raw' },
    dependencies: deps,
    priority: 'normal',
    budget: { maxTokens: 2000 },
    verification: { deterministic: [{ kind: 'artifact-valid' }] },
    acceptance: [{ id: `${id}:valid`, description: 'artefato valido', kind: 'deterministic', check: { kind: 'artifact-valid' } }],
  };
}

/** Grafo: setup (concluído) -> execute (falhou) -> review (pendente). */
function brokenGraph(role: TaskContract['role'] = 'specialist', agent = 'alfa-engineer'): ExecutionGraph {
  const mk = (id: string, deps: string[], status: GraphNode['status'], a: string): GraphNode =>
    attachContract(
      {
        id,
        kind: 'agent',
        agent: a,
        outputs: ['raw'],
        dependencies: deps,
        status,
        attempts: status === 'failed' ? 1 : 1,
        tokenBudget: 2000,
        timeoutMs: 60_000,
        retryPolicy: { maxAttempts: 3, backoffMs: 0 },
      },
      contractFor(id, id === 'execute' ? role : 'specialist', a, deps),
    );
  return new ExecutionGraphBuilder().build({
    task: OBJECTIVE,
    nodes: [
      mk('setup', [], 'succeeded', 'alfa-engineer'),
      mk('execute', ['setup'], 'failed', agent),
      mk('review', ['execute'], 'pending', 'alfa-engineer'),
    ],
    budget: { maxAttempts: 3, maxTokens: 40_000, maxTimeMs: 600_000 },
  });
}

const FAILURE: ReplanFailure = {
  nodeId: 'execute',
  error: 'verificação falhou: artefato sem tratamento de credenciais inválidas',
  attempt: 1,
  unmet: ['saída cobre "validacao"', 'saída cobre "credenciais"'],
  artifactRef: 'run-1:execute',
  agent: 'alfa-engineer',
};

test('replan: falha troca o agente do nó, e o que falhou sai da disputa', () => {
  const { registry, baseDir } = tmpRegistry(['alfa-engineer', 'beta-engineer']);
  const input: CommanderInput = { objective: OBJECTIVE, capabilities: registry };
  const result = new Commander().replan({ graph: brokenGraph() }, FAILURE, input);

  const node = result.graph.nodes.find((n) => n.id === 'execute')!;
  assert.equal(node.agent, 'beta-engineer');
  assert.ok(result.changes.some((c) => /agente de "execute"/.test(c)));
  assert.deepEqual(node.metadata?.triedAgents, ['alfa-engineer']);
  assert.equal(node.status, 'pending');
  assert.equal(node.attempts, 0);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('replan: sem agente alternativo, sobe o papel', () => {
  const { registry, baseDir } = tmpRegistry(['alfa-engineer']);
  const input: CommanderInput = { objective: OBJECTIVE, capabilities: registry };
  const result = new Commander().replan({ graph: brokenGraph('specialist') }, FAILURE, input);

  assert.ok(result.changes.some((c) => /papel de "execute": specialist -> commander/.test(c)));
  const contract = contractOf(result.graph.nodes.find((n) => n.id === 'execute')!)!;
  assert.equal(contract.role, 'commander');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('replan: sem agente novo e sem papel acima, a tarefa é quebrada em duas', () => {
  const { registry, baseDir } = tmpRegistry(['alfa-engineer']);
  const input: CommanderInput = { objective: OBJECTIVE, capabilities: registry };
  // Papel já no topo: não há para onde escalar.
  const result = new Commander().replan({ graph: brokenGraph('commander') }, FAILURE, input);

  const ids = result.graph.nodes.map((n) => n.id);
  assert.ok(ids.includes('execute-draft'), `esperava a quebra em rascunho: ${ids.join(', ')}`);
  assert.ok(result.changes.some((c) => /quebrada em "execute-draft"/.test(c)));

  const draft = result.graph.nodes.find((n) => n.id === 'execute-draft')!;
  const finish = result.graph.nodes.find((n) => n.id === 'execute')!;
  assert.deepEqual(draft.dependencies, ['setup'], 'o rascunho assume as dependências originais');
  assert.deepEqual(finish.dependencies, ['execute-draft'], 'o fechamento consome o rascunho');

  // O ponto da quebra manter o id original: quem dependia de "execute" continua válido.
  const review = result.graph.nodes.find((n) => n.id === 'review')!;
  assert.deepEqual(review.dependencies, ['execute']);
  assert.ok(result.graph.order.indexOf('execute-draft') < result.graph.order.indexOf('execute'));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('replan: a mesma tarefa não é quebrada duas vezes', () => {
  const { registry, baseDir } = tmpRegistry(['alfa-engineer']);
  const input: CommanderInput = { objective: OBJECTIVE, capabilities: registry };
  const first = new Commander().replan({ graph: brokenGraph('commander') }, FAILURE, input);
  // Segunda falha no mesmo nó, já quebrado.
  const failedAgain = {
    ...first.graph,
    nodes: first.graph.nodes.map((n) => (n.id === 'execute' ? { ...n, status: 'failed' as const, attempts: 1 } : n)),
  };
  const second = new Commander().replan({ graph: failedAgain }, { ...FAILURE, attempt: 2 }, input);
  assert.ok(!second.graph.nodes.some((n) => n.id === 'execute-draft-draft'), 'quebrar o quebrado produziria cascata');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('replan: da segunda tentativa em diante troca agente E sobe papel', () => {
  const { registry, baseDir } = tmpRegistry(['alfa-engineer', 'beta-engineer']);
  const input: CommanderInput = { objective: OBJECTIVE, capabilities: registry };
  const result = new Commander().replan({ graph: brokenGraph() }, { ...FAILURE, attempt: 2 }, input);
  assert.ok(result.changes.some((c) => /agente de "execute"/.test(c)));
  assert.ok(result.changes.some((c) => /papel de "execute"/.test(c)));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('replan: a causa e os critérios não comprovados viram restrição do contrato novo', () => {
  const { registry, baseDir } = tmpRegistry(['alfa-engineer', 'beta-engineer']);
  const result = new Commander().replan({ graph: brokenGraph() }, FAILURE, { objective: OBJECTIVE, capabilities: registry });
  const contract = contractOf(result.graph.nodes.find((n) => n.id === 'execute')!)!;
  assert.ok(contract.constraints.some((c) => /tentativa anterior falhou por/.test(c)));
  assert.ok(contract.constraints.some((c) => /credenciais/.test(c)));
  // O delta, não a execução inteira: o contrato não carrega o artefato reprovado.
  assert.ok(!contract.constraints.some((c) => c.length > 400));
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('replan: tarefa já concluída não é paga de novo', () => {
  const { registry, baseDir } = tmpRegistry(['alfa-engineer', 'beta-engineer']);
  const result = new Commander().replan({ graph: brokenGraph() }, FAILURE, { objective: OBJECTIVE, capabilities: registry });
  assert.equal(result.graph.nodes.find((n) => n.id === 'setup')!.status, 'skipped');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('replan: sem alternativa nenhuma, o resultado diz isso em vez de fingir um Plano B', () => {
  // Sem registro de capacidades, papel no topo e sem critério não comprovado.
  const result = new Commander().replan(
    { graph: brokenGraph('commander') },
    { nodeId: 'execute', error: 'timeout', attempt: 1 },
    { objective: OBJECTIVE },
  );
  assert.deepEqual(result.changes, []);
  assert.ok(result.decisions.some((d) => /nenhuma alternativa estrutural/.test(d)));
  assert.equal(result.graph.nodes.find((n) => n.id === 'execute')!.status, 'pending');
});

test('replan: nó inexistente não derruba o replanejamento', () => {
  const graph = brokenGraph();
  const result = new Commander().replan({ graph }, { nodeId: 'fantasma', error: 'x', attempt: 1 }, { objective: OBJECTIVE });
  assert.equal(result.graph, graph);
  assert.deepEqual(result.changes, []);
});

/* ============================ integração com o runtime ============================ */

test('replan: o Orchestrator usa o Plano B do Commander quando o healing pede replanejamento', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-replan-run-'));
  const seen: Array<{ nodeId: string; agent?: string }> = [];
  let replanCalls = 0;

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: OBJECTIVE,
    category: 'implementation',
    primaryAgent: 'alfa-engineer',
    skillChain: [],
    // O grafo já vem com um nó que falha por causa de planejamento, que é o
    // ramo do Healer que dispara `replan`.
    plan: {
      runObjective: OBJECTIVE,
      mode: 'orchestrated',
      modeReason: 'teste',
      classification: { complexity: 3, domains: ['backend'], category: 'implementation', reasoning: 'medium', risk: 0.2, reasons: [] },
      graph: brokenGraph(),
      contracts: [],
      estimate: {
        nodes: 3,
        parallelStages: 3,
        maxTokens: 6000,
        byRole: { commander: { tasks: 0, tokens: 0 }, specialist: { tasks: 3, tokens: 6000 }, worker: { tasks: 0, tokens: 0 } },
      quality: 0.5,
      },
      decisions: [],
      issues: [],
    },
    replan: ({ graph, failure }) => {
      replanCalls++;
      return {
        graph: {
          ...graph,
          nodes: graph.nodes.map((n) => (n.id === failure.nodeId ? { ...n, agent: 'beta-engineer', status: 'pending' as const, attempts: 0 } : n)),
        },
        contracts: [],
        decisions: ['plano B de teste'],
        changes: [`agente de "${failure.nodeId}": alfa-engineer -> beta-engineer`],
      };
    },
    produce: (node: GraphNode) => {
      seen.push({ nodeId: node.id, ...(node.agent ? { agent: node.agent } : {}) });
      // Falha de PLANEJAMENTO no primeiro passe do nó `execute`: é o que leva o
      // Healer a decidir `replan` em vez de retry.
      if (node.id === 'execute' && node.agent === 'alfa-engineer') {
        throw new Error('graph topological plan inconsistente para esta tarefa');
      }
      return { content: 'Conteudo real e completo do artefato produzido. '.repeat(6), kind: 'raw', tokens: 100 };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.ok(replanCalls > 0, 'o healing de planejamento deveria passar pelo Commander');
  assert.ok(seen.some((s) => s.nodeId === 'execute' && s.agent === 'beta-engineer'), 'a nova tentativa deveria usar o agente do Plano B');
  assert.ok(
    result.trace.spans.some((s) => s.name === 'replan:execute'),
    'o replanejamento precisa aparecer no trace para o izanagi explain conseguir mostrá-lo',
  );
  assert.ok(
    (result.conversation ?? []).some((m) => /Plano B/.test(m.summary)),
    'a mudança de plano é uma mensagem do commander para o scheduler',
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});
