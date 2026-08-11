import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRouter, DEFAULT_PROVIDERS } from '../model/router.js';

const router = new ModelRouter();

test('router: tarefa simples usa tier fast', () => {
  const r = router.route({ task: 'oi', taskComplexity: 1, reasoningRequirement: 'low', risk: 0.1, tokenBudget: 1000, requiresTools: false });
  assert.equal(r.model.tier, 'fast');
  assert.ok(r.reasons.some((x) => x.includes('fast')));
});

test('router: tarefa complexa com risco alto usa premium', () => {
  const r = router.route({ task: 'arquitetura distribuída', taskComplexity: 5, reasoningRequirement: 'high', risk: 0.9, tokenBudget: 30000, requiresTools: true });
  assert.equal(r.model.tier, 'premium');
  assert.ok(r.reasons.some((x) => x.includes('risco')));
});

test('router: catálogo default tem 3 providers', () => {
  assert.equal(DEFAULT_PROVIDERS.length, 3);
  const ids = DEFAULT_PROVIDERS.map((p) => p.id);
  assert.ok(ids.includes('openai'));
  assert.ok(ids.includes('anthropic'));
  assert.ok(ids.includes('google'));
  const catalog = router.catalog();
  assert.ok(catalog.some((m) => m.id.includes('gpt-4o-mini')));
  assert.ok(catalog.some((m) => m.id.includes('claude')));
  assert.ok(catalog.some((m) => m.id.includes('gemini')));
});

test('router: estimateComplexity heurística 1-5', () => {
  assert.equal(ModelRouter.estimateComplexity('oi'), 1);
  const complex = ModelRouter.estimateComplexity('sistema saas completo com microserviços, arquitetura distribuída e segurança');
  assert.ok(complex >= 4);
  const medium = ModelRouter.estimateComplexity('corrigir bug de debug no login');
  assert.ok(medium >= 2);
});

test('router: contexto cabe na janela do modelo', () => {
  const r = router.route({ task: 't', taskComplexity: 2, reasoningRequirement: 'low', risk: 0.1, tokenBudget: 2000, requiresTools: false });
  assert.ok(r.model.contextWindow >= 2000);
});

test('router: risco baixo não justifica premium em tarefa média', () => {
  const r = router.route({ task: 't', taskComplexity: 3, reasoningRequirement: 'medium', risk: 0.1, tokenBudget: 8000, requiresTools: false });
  assert.ok(r.model.tier !== 'premium');
});
