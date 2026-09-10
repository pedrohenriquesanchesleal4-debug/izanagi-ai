/**
 * O caminho SEM API KEY tem que entregar.
 *
 * Estado antes desta rodada, medido rodando `izanagi run` de verdade nesta
 * máquina, sem flag nenhuma: o run terminava em `HUMAN_REQUIRED`, com "teto de
 * tentativas esgotado" e NENHUM arquivo gravado. Três defeitos empilhados, e
 * cada bloco abaixo prende um:
 *
 * 1. `budgetForMode('direct')` dá 2.000 tokens ao run. Um nó do executor por
 *    CLI de agente foi medido em ~20.000 (o CLI hospedeiro cobra o próprio
 *    system prompt em toda chamada). O teto do modo foi calibrado quando um nó
 *    era uma requisição HTTP com prompt curto, e ninguém reconciliou os dois.
 * 2. O piso recomendado (30.000) vinha de dividir a MÉDIA medida pela fatia da
 *    fase `execution`. Média não é piso, e a fatia varia com a complexidade:
 *    quatro execuções gastaram 19.799, 20.706 e ~20.1k, e as três estouravam.
 * 3. A varredura anti-stub reprovava `/TODO/i` como substring, então qualquer
 *    artefato em português com "todo", "toda" ou "todos" era recusado como
 *    código inacabado. Uma implementação correta de `validarCPF` foi reprovada
 *    por um comentário que dizia "rejeita CPFs com todos os dígitos iguais".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { buildExecutionPlan } from '../execute.js';
import { validateArtifact } from '../contracts/artifacts.js';
import {
  recommendedBudget,
  measuredTokensPerNode,
  nodeCostWithHeadroom,
  MIN_EXECUTION_PHASE_SHARE,
  MIN_RECOVERY_PHASE_SHARE,
  AGENT_CLI_VARIANCE_HEADROOM,
} from '../llm/agent-cli.js';
import { defaultWeights } from '../token/budget.js';

const repoRoot = path.resolve(process.cwd());
const OBJETIVO = 'Escreva a função validarCPF em TypeScript, com testes';

test('executor por CLI de agente: o teto do run cobre o que um nó realmente gasta', () => {
  const plano = buildExecutionPlan(repoRoot, { objective: OBJETIVO, availableProviders: ['claude-cli'] });
  const teto = plano.plan!.graph.budget.maxTokens;
  const medido = measuredTokensPerNode('none');
  assert.ok(teto >= recommendedBudget('none'), `teto ${teto} abaixo do piso ${recommendedBudget('none')}`);
  // O que decide não é o teto do run, é a fatia da fase que executa.
  assert.ok(
    teto * MIN_EXECUTION_PHASE_SHARE > medido,
    `a fatia de execution (${Math.floor(teto * MIN_EXECUTION_PHASE_SHARE)}) não cobre o nó medido (${medido})`,
  );
});

test('o piso vale por política de tools: ler o repositório custa ~3,8x e o teto acompanha', () => {
  const semTools = buildExecutionPlan(repoRoot, { objective: OBJETIVO, availableProviders: ['claude-cli'] });
  const comTools = buildExecutionPlan(repoRoot, {
    objective: OBJETIVO,
    availableProviders: ['claude-cli'],
    agentTools: 'read',
  });
  assert.ok(
    comTools.plan!.graph.budget.maxTokens > semTools.plan!.graph.budget.maxTokens,
    'a política que custa mais tem que receber teto maior',
  );
  assert.ok(comTools.plan!.graph.budget.maxTokens * MIN_EXECUTION_PHASE_SHARE > measuredTokensPerNode('read'));
});

test('o piso é do EXECUTOR: provider por chave continua com o teto do modo', () => {
  const porChave = buildExecutionPlan(repoRoot, { objective: OBJETIVO, availableProviders: ['anthropic'] });
  // 2.000 é `budgetForMode('direct')`. Um provider HTTP não carrega o system
  // prompt de um CLI hospedeiro, e inflar o teto dele seria pagar por um custo
  // que não existe naquele caminho.
  assert.equal(porChave.plan!.graph.budget.maxTokens, 2000);
});

test('teto explícito do usuário vence o piso: quem declarou um limite decidiu', () => {
  const explicito = buildExecutionPlan(repoRoot, {
    objective: OBJETIVO,
    availableProviders: ['claude-cli'],
    maxTokens: 5000,
  });
  assert.equal(explicito.plan!.graph.budget.maxTokens, 5000);
});

test('o piso recomendado sai da medição com folga, não de uma constante escolhida à mão', () => {
  for (const policy of ['none', 'read'] as const) {
    const esperado = Math.ceil(
      (measuredTokensPerNode(policy) * AGENT_CLI_VARIANCE_HEADROOM) / MIN_EXECUTION_PHASE_SHARE / 1000,
    ) * 1000;
    assert.equal(recommendedBudget(policy), esperado, `piso de ${policy} descolou da medição`);
  }
  // A folga existe porque a medição é média. Um piso igual à média reprova
  // metade das execuções por definição.
  assert.ok(AGENT_CLI_VARIANCE_HEADROOM > 1);
});

test('o teto conta TODO nó que chama modelo, não só os de kind `agent`', () => {
  const plano = buildExecutionPlan(repoRoot, {
    objective: 'Auditar a segurança do módulo de autenticação de uma API Node com JWT',
    mode: 'orchestrated',
    availableProviders: ['claude-cli'],
    output: 'tmp/x',
  });
  const nodes = plano.plan!.graph.nodes;
  // O grafo tem `evaluator` e nós de tool. Contar só `agent` subdimensionava o
  // teto: um run real com 4 nós de modelo recebeu teto para 3 e morreu no
  // último (124.553 de 117.000) depois de quase todo o trabalho feito.
  const queGastam = nodes.filter((n) => !['tool', 'gate', 'approval'].includes(n.kind ?? 'agent')).length;
  assert.ok(nodes.some((n) => n.kind === 'evaluator'), 'o fixture precisa ter um nó evaluator');
  assert.ok(nodes.some((n) => n.kind === 'tool'), 'o fixture precisa ter nó de tool');
  assert.equal(plano.plan!.graph.budget.maxTokens, queGastam * recommendedBudget('none'));
});

test('nó determinístico não infla o teto: tool, gate e approval custam zero', () => {
  const semTool = buildExecutionPlan(repoRoot, {
    objective: OBJETIVO,
    mode: 'direct',
    availableProviders: ['claude-cli'],
  });
  const comTool = buildExecutionPlan(repoRoot, {
    objective: OBJETIVO,
    mode: 'direct',
    availableProviders: ['claude-cli'],
    output: 'tmp/x',
  });
  assert.ok(comTool.plan!.graph.nodes.length > semTool.plan!.graph.nodes.length, 'o output acrescenta nó de tool');
  assert.equal(comTool.plan!.graph.budget.maxTokens, semTool.plan!.graph.budget.maxTokens);
});

test('onde há retentativa, a fase recovery comporta uma: healing decorativo é pior que nenhum', () => {
  const plano = buildExecutionPlan(repoRoot, {
    objective: OBJETIVO,
    mode: 'orchestrated',
    availableProviders: ['claude-cli'],
  });
  const budget = plano.plan!.graph.budget;
  assert.ok(budget.maxAttempts > 1, 'orchestrated retenta');
  assert.ok(
    budget.maxTokens * MIN_RECOVERY_PHASE_SHARE >= nodeCostWithHeadroom('none'),
    `recovery (${Math.floor(budget.maxTokens * MIN_RECOVERY_PHASE_SHARE)}) não paga uma retentativa (${nodeCostWithHeadroom('none')})`,
  );
});

test('planning não recebe fatia grande: nenhum caminho do runtime cobra tokens dela', () => {
  // Medido num run real: planning fechou em 0/17.550 enquanto recovery
  // estourava em 16.420/16.420. Reservar para quem não gasta é tirar de quem
  // gasta.
  for (const complexity of [1, 3, 5]) {
    const w = defaultWeights(complexity);
    assert.ok(w.planning <= 0.05, `planning com ${w.planning} numa complexidade ${complexity}`);
    assert.ok(w.recovery > w.planning, 'recovery, que gasta, tem que receber mais que planning, que não gasta');
  }
});

test('anti-stub: "todos" em português não é um marcador de código inacabado', () => {
  const portugues = [
    '/** Rejeita CPFs com todos os dígitos iguais (111.111.111-11). */',
    'it("rejeita CPF com todos os dígitos iguais", () => { expect(validarCPF("00000000000")).toBe(false); });',
    'Toda entrada é normalizada antes da validação.',
  ].join('\n');
  const report = validateArtifact('raw', portugues);
  assert.ok(report.valid, `artefato legítimo reprovado: ${report.issues.join('; ')}`);
});

test('anti-stub: o marcador de verdade continua reprovado', () => {
  for (const stub of [
    'function validarCPF() { // TODO: implementar\n}',
    '// FIXME(joao): quebra com zero à esquerda',
    'const x = 1; // XXX revisar',
    'function f() { throw new Error("not implemented"); }',
  ]) {
    const report = validateArtifact('raw', stub);
    assert.ok(!report.valid, `stub passou batido: ${stub}`);
  }
});
