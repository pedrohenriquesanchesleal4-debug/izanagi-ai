import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runTokenBenchmark,
  formatTokenBenchmark,
  legacyMetrics,
  commanderMetrics,
  PAID_CATALOG,
  TOKEN_BENCHMARK_CASES,
} from '../benchmarks/token-benchmark.js';
import { ModelRouter, DEFAULT_PROVIDERS } from '../model/router.js';

test('benchmark: é determinístico (duas execuções produzem os mesmos números)', () => {
  const a = runTokenBenchmark();
  const b = runTokenBenchmark();
  assert.deepEqual(
    a.rows.map((r) => [r.id, r.legacy.maxCostUsd, r.commander.maxCostUsd, r.commander.mode]),
    b.rows.map((r) => [r.id, r.legacy.maxCostUsd, r.commander.maxCostUsd, r.commander.mode]),
  );
});

test('benchmark: catálogo default exclui modelos locais de custo zero', () => {
  const report = runTokenBenchmark();
  assert.deepEqual(report.catalog.sort(), ['anthropic', 'google', 'openai']);
  assert.ok(!report.catalog.includes('ollama'), 'custo 0 do self-hosted zeraria a comparação de preço');
});

test('benchmark: tarefa trivial reduz chamadas e tokens de forma expressiva', () => {
  const row = runTokenBenchmark().rows.find((r) => r.id === 'trivial-conversion');
  assert.ok(row);
  assert.equal(row!.commander.mode, 'direct');
  assert.equal(row!.commander.modelCalls, 1);
  assert.ok(row!.legacy.modelCalls >= 3, 'o caminho legado montava grafo até para tarefa trivial');
  assert.ok(row!.tokenReduction > 0.8, `esperava redução de tokens acima de 80%, veio ${row!.tokenReduction}`);
});

test('benchmark: projeto amplo continua no modo completo (a economia não vem de cortar trabalho real)', () => {
  const row = runTokenBenchmark().rows.find((r) => r.id === 'saas-fullstack');
  assert.ok(row);
  assert.equal(row!.commander.mode, 'autonomous');
  assert.ok(row!.commander.modelCalls >= row!.legacy.modelCalls - 1, 'projeto grande não deve perder etapas');
});

test('benchmark: totais somam chamadas, tokens e custo separadamente', () => {
  const report = runTokenBenchmark();
  const calls = report.rows.reduce((a, r) => a + r.commander.modelCalls, 0);
  const tokens = report.rows.reduce((a, r) => a + r.commander.maxTokens, 0);
  assert.equal(report.totals.commanderModelCalls, calls);
  assert.equal(report.totals.commanderTokens, tokens);
  assert.ok(report.totals.callReduction > 0.3, `esperava queda de chamadas acima de 30%, veio ${report.totals.callReduction}`);
  assert.ok(report.totals.tokenReduction > 0.3, `esperava queda de tokens acima de 30%, veio ${report.totals.tokenReduction}`);
});

test('benchmark: métricas por papel somam o teto total do plano', () => {
  const router = new ModelRouter(PAID_CATALOG);
  const metrics = commanderMetrics(TOKEN_BENCHMARK_CASES[4].objective, router);
  const byRoleTotal = Object.values(metrics.byRole ?? {}).reduce((a, v) => a + v, 0);
  assert.equal(byRoleTotal, metrics.maxTokens);
});

test('benchmark: caminho legado usa um único modelo para o run inteiro', () => {
  const router = new ModelRouter(PAID_CATALOG);
  const legacy = legacyMetrics('Corrigir o erro 500 intermitente no endpoint de login', router);
  assert.equal(legacy.mode, 'legacy');
  assert.equal(legacy.byRole, undefined, 'o legado não distingue papéis: essa é a diferença medida');
  assert.ok(legacy.maxTokens > 0);
});

test('benchmark: relatório em texto declara as três dimensões e a ressalva de leitura', () => {
  const text = formatTokenBenchmark(runTokenBenchmark());
  assert.ok(text.includes('chamadas'));
  assert.ok(text.includes('tokens'));
  assert.ok(text.includes('custo'));
  assert.ok(text.includes('Leitura honesta'), 'o relatório precisa dizer quando o custo sobe e por quê');
});

test('benchmark: aceita catálogo customizado (ex.: só um provider)', () => {
  const anthropicOnly = DEFAULT_PROVIDERS.filter((p) => p.id === 'anthropic');
  const report = runTokenBenchmark({ providers: anthropicOnly });
  assert.deepEqual(report.catalog, ['anthropic']);
  assert.ok(report.rows.every((r) => r.commander.maxCostUsd >= 0));
});
