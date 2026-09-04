import test from 'node:test';
import assert from 'node:assert/strict';
import { contextForNode } from '../execute.js';
import { attachContract, contractFromNode, type TaskContract } from '../contracts/task-contract.js';
import type { GraphNode, RoutingContext } from '../types.js';

/**
 * O `RoutingContext` era montado UMA vez em `buildExecutionPlan` e reusado em
 * todos os nós: `reasoningRequirement: 'medium'`, `risk: 0.2`, `tokenBudget` do
 * run inteiro e nenhum `historicalPerformance`. O `scoreModel` do
 * `ModelRouter` lê todos esses campos — então metade dos critérios de
 * roteamento estava implementada no scorer e nunca era alimentada, e dentro de
 * um run o modelo escolhido era função só do papel.
 */

const RUN_CONTEXT: RoutingContext = {
  task: 'objetivo do run inteiro',
  taskComplexity: 3,
  reasoningRequirement: 'medium',
  risk: 0.2,
  tokenBudget: 16000,
  requiresTools: false,
};

function nodeWith(contract: Partial<TaskContract>, node: Partial<GraphNode> = {}): GraphNode {
  const base: GraphNode = { id: 'n1', kind: 'agent', status: 'pending', ...node } as GraphNode;
  const full = { ...contractFromNode(base, { objective: 'tarefa' }), ...contract } as TaskContract;
  return attachContract(base, full);
}

test('routing: sem nó, o contexto do run passa intocado', () => {
  assert.deepEqual(contextForNode(RUN_CONTEXT), RUN_CONTEXT);
});

test('routing: papel do contrato define a exigência de raciocínio', () => {
  assert.equal(contextForNode(RUN_CONTEXT, nodeWith({ role: 'worker' })).reasoningRequirement, 'low');
  assert.equal(contextForNode(RUN_CONTEXT, nodeWith({ role: 'specialist' })).reasoningRequirement, 'medium');
  assert.equal(contextForNode(RUN_CONTEXT, nodeWith({ role: 'commander' })).reasoningRequirement, 'high');
});

test('routing: prioridade do contrato vira risco, e risco alto é onde errar custa mais', () => {
  assert.equal(contextForNode(RUN_CONTEXT, nodeWith({ priority: 'low' })).risk, 0.1);
  assert.equal(contextForNode(RUN_CONTEXT, nodeWith({ priority: 'normal' })).risk, 0.2);
  assert.equal(contextForNode(RUN_CONTEXT, nodeWith({ priority: 'high' })).risk, 0.5);
  assert.equal(contextForNode(RUN_CONTEXT, nodeWith({ priority: 'critical' })).risk, 0.8);
});

test('routing: o teto de janela é o da TAREFA, não o do run inteiro', () => {
  // Com o teto do run, todo modelo de janela menor perdia score em toda
  // tarefa, inclusive nas curtas.
  const ctx = contextForNode(RUN_CONTEXT, nodeWith({ budget: { maxTokens: 900 } } as Partial<TaskContract>));
  assert.equal(ctx.tokenBudget, 900);
});

test('routing: o saldo do orçamento aperta o teto da tarefa', () => {
  const ctx = contextForNode(
    RUN_CONTEXT,
    nodeWith({ budget: { maxTokens: 8000 } } as Partial<TaskContract>),
    { remainingTokens: 1200 },
  );
  assert.equal(ctx.tokenBudget, 1200);
});

test('routing: saldo zerado não zera a janela pedida', () => {
  // Roteamento com `tokenBudget: 0` afirmaria que qualquer janela serve, e o
  // score de contexto pararia de discriminar exatamente quando o orçamento
  // aperta. Saldo 0 significa "sem informação útil", e vale o teto da tarefa.
  const ctx = contextForNode(
    RUN_CONTEXT,
    nodeWith({ budget: { maxTokens: 4000 } } as Partial<TaskContract>),
    { remainingTokens: 0 },
  );
  assert.equal(ctx.tokenBudget, 4000);
});

test('routing: nó de tool declara requiresTools', () => {
  const plain = contextForNode(RUN_CONTEXT, nodeWith({}));
  assert.equal(plain.requiresTools, false);
  const tool = contextForNode(RUN_CONTEXT, nodeWith({ tool: { id: 'fs.write', input: {} } } as Partial<TaskContract>));
  assert.equal(tool.requiresTools, true);
});

test('routing: histórico medido entra; histórico vazio não entra como sinal', () => {
  const withHistory = contextForNode(RUN_CONTEXT, nodeWith({}), {
    historicalPerformance: { 'claude-sonnet-5': 0.9 },
  });
  assert.deepEqual(withHistory.historicalPerformance, { 'claude-sonnet-5': 0.9 });

  // Mapa vazio é ausência de amostra, e ausência não deve virar campo presente
  // com conteúdo vazio: o router trata ausência como neutro.
  const empty = contextForNode(RUN_CONTEXT, nodeWith({}), { historicalPerformance: {} });
  assert.equal(empty.historicalPerformance, undefined);
});

test('routing: o objetivo da TAREFA substitui o objetivo do run no contexto', () => {
  const ctx = contextForNode(RUN_CONTEXT, nodeWith({ objective: 'gravar a entrega no projeto' }));
  assert.equal(ctx.task, 'gravar a entrega no projeto');
});

test('routing: nó sem contrato herda o contexto do run', () => {
  const bare: GraphNode = { id: 'legado', kind: 'agent', status: 'pending' } as GraphNode;
  const ctx = contextForNode(RUN_CONTEXT, bare);
  assert.equal(ctx.reasoningRequirement, RUN_CONTEXT.reasoningRequirement);
  assert.equal(ctx.risk, RUN_CONTEXT.risk);
  assert.equal(ctx.tokenBudget, RUN_CONTEXT.tokenBudget);
});
