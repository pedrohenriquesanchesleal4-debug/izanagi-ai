import test from 'node:test';
import assert from 'node:assert/strict';
import { Commander } from '../orchestration/commander.js';

/**
 * `optional` decidia por id literal: `new Set(['critic'])`. Um template de
 * workflow do projeto do usuário com o nó de crítica sob outro nome, ou um
 * agente gerado que produz `critique`, nunca era marcado como opcional — então
 * nem o early stopping (pular o que revisaria algo já comprovado) nem o corte
 * de opcionais por pressão de orçamento o alcançavam. A decisão passa a sair do
 * QUE o nó produz, que é o dado estrutural; id é nome.
 *
 * Exceção conhecida e deliberada: `orchestrator-review` produz `critique`
 * (mecanismo A2A de reabertura) mas NÃO é reforço — é o gate de aprovação do
 * orquestrador, condição do modo orchestrated/autonomous. Reforço é dispensável;
 * o gate é o que torna a aprovação auditada. Por isso ele é o único nó que
 * produz `critique` sem `optional: true`.
 */

const OBJECTIVE = 'Implementar autenticação com refresh token e testes de integração';

test('optional: nó que produz critique é marcado opcional em modo autonomous', () => {
  const plan = new Commander().plan({ objective: OBJECTIVE, mode: 'autonomous' });
  // O gate do orquestrador é a exceção documentada: produz critique por
  // MECANISMO (reabertura A2A), mas é condição do modo, não reforço.
  const critique = plan.graph.nodes.filter(
    (n) => (n.outputs ?? []).includes('critique') && n.id !== 'orchestrator-review',
  );
  assert.ok(critique.length > 0, 'o template autonomous tem nó de crítica');
  for (const node of critique) {
    assert.equal(node.metadata?.optional, true, `${node.id} deveria ser opcional`);
  }
});

test('optional: o nó de avaliação NUNCA é opcional', () => {
  // O veredito é o que fecha a execução: pular o avaliador porque tudo passou
  // seria pular exatamente quem afirma que passou.
  const plan = new Commander().plan({ objective: OBJECTIVE, mode: 'autonomous' });
  const evaluation = plan.graph.nodes.filter((n) => n.kind === 'evaluator' || (n.outputs ?? []).includes('evaluation'));
  assert.ok(evaluation.length > 0, 'o plano tem nó de avaliação');
  for (const node of evaluation) {
    assert.notEqual(node.metadata?.optional, true, `${node.id} não pode ser opcional`);
  }
});

test('optional: o nó que produz evidência não é opcional', () => {
  const plan = new Commander().plan({ objective: OBJECTIVE, mode: 'autonomous' });
  const evidence = plan.graph.nodes.filter(
    (n) => (n.outputs ?? []).some((o) => ['implementation-plan', 'qa-report', 'test-plan', 'security-report', 'architecture'].includes(o)),
  );
  assert.ok(evidence.length > 0, 'o plano produz evidência');
  for (const node of evidence) {
    assert.notEqual(node.metadata?.optional, true, `${node.id} produz evidência e não pode ser dispensado`);
  }
});

test('optional: modo orchestrated corta o reforço do grafo em vez de marcá-lo', () => {
  // Crítica adversarial é reforço: em orchestrated ela não entra, e o corte
  // não pode deixar dependência pendurada apontando para um nó removido.
  // O orchestrator-review NÃO é reforço (é o gate de aprovação do modo), por
  // isso a contagem exclui o id do gate.
  const plan = new Commander().plan({ objective: OBJECTIVE, mode: 'orchestrated' });
  const reforcos = plan.graph.nodes.filter(
    (n) => (n.outputs ?? []).includes('critique') && n.id !== 'orchestrator-review',
  );
  assert.equal(reforcos.length, 0);
  const ids = new Set(plan.graph.nodes.map((n) => n.id));
  for (const node of plan.graph.nodes) {
    for (const dep of node.dependencies ?? []) {
      assert.ok(ids.has(dep), `${node.id} depende de "${dep}", que não está no grafo`);
    }
  }
});

test('optional: todo nó opcional produz reforço, e nenhum nó de reforço fica obrigatório', () => {
  // A invariante nos dois sentidos, com a exceção documentada do gate de
  // revisão do orquestrador (produz critique por mecanismo, não por ser
  // reforço: é a condição da aprovação em modos orquestrados).
  const plan = new Commander().plan({ objective: OBJECTIVE, mode: 'autonomous' });
  for (const node of plan.graph.nodes) {
    const isGate = node.id === 'orchestrator-review';
    if (isGate) {
      assert.notEqual(node.metadata?.optional, true, 'o gate de revisão do orquestrador nunca é dispensável');
      continue;
    }
    const reinforcement = (node.outputs ?? []).includes('critique') || node.agent === 'adversarial-critic';
    assert.equal(
      node.metadata?.optional === true,
      reinforcement,
      `${node.id}: optional=${node.metadata?.optional} para outputs=[${(node.outputs ?? []).join(',')}] agent=${node.agent}`,
    );
  }
});
