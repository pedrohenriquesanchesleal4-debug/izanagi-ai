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
  MIN_EXECUTION_PHASE_SHARE,
  AGENT_CLI_VARIANCE_HEADROOM,
} from '../llm/agent-cli.js';

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
