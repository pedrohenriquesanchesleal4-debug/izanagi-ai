/**
 * Um catálogo de preços em código-fonte apodrece por construção.
 *
 * O catálogo default carregava `claude-opus-4-1`, `claude-sonnet-4-5` e
 * `gpt-4.1` como topo de cada tier: ids de uma geração anterior, com preço de
 * uma geração anterior. Isso não é cosmético. `estimateCostForRole` alimenta o
 * cost-aware planning do Commander e o teto de `ExecutionBudget`: preço errado
 * é teto errado, e o teto é o que decide degradar, rebaixar papel ou pedir
 * aprovação humana. Um id retirado da API, além disso, falha a chamada.
 *
 * O conserto de valor resolve HOJE. O que estes testes fixam é a outra metade:
 * cada provider declara a DATA da sua tabela, e a data aparece para quem lê.
 * Preço velho com data visível é uma decisão de quem usa; preço velho sem data
 * é o framework afirmando um número que ninguém conferiu.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROVIDERS, ModelRouter, catalogAgeDays, STALE_CATALOG_AFTER_DAYS } from '../model/router.js';

const ctx = {
  task: 'implementar autenticacao',
  taskComplexity: 3 as const,
  reasoningRequirement: 'medium' as const,
  risk: 0.2,
  tokenBudget: 16000,
  requiresTools: false,
};

test('catálogo: todo provider pago declara a data da sua tabela de preços', () => {
  for (const p of DEFAULT_PROVIDERS) {
    const pago = p.models.some((m) => m.costPer1kInput > 0 || m.costPer1kOutput > 0);
    if (!pago) continue;
    assert.ok(
      p.pricingAsOf,
      `provider "${p.id}" cobra por token e não diz de quando é o preço`,
    );
    assert.match(p.pricingAsOf!, /^\d{4}-\d{2}-\d{2}$/, `data de "${p.id}" fora do formato ISO`);
    assert.ok(
      !Number.isNaN(Date.parse(p.pricingAsOf!)),
      `data de "${p.id}" não é uma data`,
    );
  }
});

test('catálogo: provider local NÃO declara data, porque custo 0 não envelhece', () => {
  for (const p of DEFAULT_PROVIDERS.filter((p) => ['ollama', 'lmstudio'].includes(p.id))) {
    assert.equal(p.pricingAsOf, undefined, `"${p.id}" é self-hosted: custo 0 é fato, não cotação`);
  }
});

test('catálogo: a idade é medida, não presumida', () => {
  const hoje = new Date('2026-09-03T00:00:00Z');
  assert.equal(catalogAgeDays({ id: 'x', name: 'x', models: [], pricingAsOf: '2026-09-03' }, hoje), 0);
  assert.equal(catalogAgeDays({ id: 'x', name: 'x', models: [], pricingAsOf: '2026-08-04' }, hoje), 30);
  assert.equal(
    catalogAgeDays({ id: 'x', name: 'x', models: [] }, hoje),
    null,
    'sem data declarada a idade é ausente, nunca zero',
  );
});

test('catálogo: o limiar de obsolescência é declarado, não mágico', () => {
  assert.ok(STALE_CATALOG_AFTER_DAYS > 0, 'o limiar tem que existir e ser positivo');
  assert.ok(
    STALE_CATALOG_AFTER_DAYS <= 365,
    'mais de um ano não é aviso de obsolescência, é aviso que nunca dispara',
  );
});

test('catálogo: nenhum id de modelo carrega geração retirada', () => {
  const retirados = ['claude-opus-4-1', 'claude-sonnet-4-5', 'gpt-4.1', 'gpt-4-turbo'];
  const ids = DEFAULT_PROVIDERS.flatMap((p) => p.models.map((m) => m.id));
  for (const r of retirados) {
    assert.ok(!ids.includes(r), `"${r}" saiu do catálogo dos providers e não pode ser default`);
  }
});

test('catálogo: cada tier pago mantém a ordem de custo que o roteamento presume', () => {
  // `demoteRole`/`escalateRole` só fazem sentido se descer de tier for mais
  // barato. Se um preço novo invertesse a ordem, a degradação por orçamento
  // passaria a AUMENTAR o gasto, silenciosamente.
  for (const p of DEFAULT_PROVIDERS) {
    if (!p.pricingAsOf) continue;
    const router = new ModelRouter([p]);
    const worker = router.estimateCostForRole('worker', 10_000);
    const specialist = router.estimateCostForRole('specialist', 10_000);
    const commander = router.estimateCostForRole('commander', 10_000);
    assert.ok(worker <= specialist, `${p.id}: worker ${worker} > specialist ${specialist}`);
    assert.ok(specialist <= commander, `${p.id}: specialist ${specialist} > commander ${commander}`);
  }
});

test('catálogo: contexto e preço são positivos em todo modelo pago', () => {
  for (const p of DEFAULT_PROVIDERS) {
    for (const m of p.models) {
      assert.ok(m.contextWindow > 0, `${p.id}/${m.id}: contextWindow tem que ser real`);
      assert.ok(m.costPer1kInput >= 0 && m.costPer1kOutput >= 0, `${p.id}/${m.id}: preço negativo`);
      if (p.pricingAsOf) {
        assert.ok(
          m.costPer1kOutput >= m.costPer1kInput,
          `${p.id}/${m.id}: saída mais barata que entrada é sinal de campo trocado`,
        );
      }
    }
  }
});

test('router: roteia para os ids da geração atual em cada papel', () => {
  const router = new ModelRouter(DEFAULT_PROVIDERS.filter((p) => p.id === 'anthropic'));
  assert.equal(router.routeForRole('commander', ctx).model.id, 'claude-opus-5');
  assert.equal(router.routeForRole('specialist', ctx).model.id, 'claude-sonnet-5');
  assert.equal(router.routeForRole('worker', ctx).model.id, 'claude-haiku-4-5');
});
