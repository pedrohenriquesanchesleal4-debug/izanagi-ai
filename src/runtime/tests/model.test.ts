import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ModelRouter, DEFAULT_PROVIDERS } from '../model/router.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-model-'));
}

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

test('router: catálogo default tem 5 providers (3 cloud + 2 locais)', () => {
  assert.equal(DEFAULT_PROVIDERS.length, 5);
  const ids = DEFAULT_PROVIDERS.map((p) => p.id);
  assert.ok(ids.includes('openai'));
  assert.ok(ids.includes('anthropic'));
  assert.ok(ids.includes('google'));
  assert.ok(ids.includes('ollama'));
  assert.ok(ids.includes('lmstudio'));
  const catalog = router.catalog();
  assert.ok(catalog.some((m) => m.id.includes('gpt-4o-mini')));
  assert.ok(catalog.some((m) => m.id.includes('claude')));
  assert.ok(catalog.some((m) => m.id.includes('gemini')));
});

test('router: providers locais (ollama/lmstudio) têm custo zero (self-hosted, sem billing por token)', () => {
  const ollama = DEFAULT_PROVIDERS.find((p) => p.id === 'ollama')!;
  const lmstudio = DEFAULT_PROVIDERS.find((p) => p.id === 'lmstudio')!;
  for (const model of [...ollama.models, ...lmstudio.models]) {
    assert.equal(model.costPer1kInput, 0);
    assert.equal(model.costPer1kOutput, 0);
  }
});

test('router: "openrouter" e "custom" ficam fora do catálogo default (preço não verificável de propósito)', () => {
  const ids = DEFAULT_PROVIDERS.map((p) => p.id);
  assert.ok(!ids.includes('openrouter'));
  assert.ok(!ids.includes('custom'));
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

test('router: IZANAGI_MODEL força o modelo mesmo contra a heurística', () => {
  const prev = process.env.IZANAGI_MODEL;
  // O id sai do catálogo em tempo de teste, não fixado no fonte: um id
  // hardcoded aqui volta a falhar na próxima atualização de catálogo, que é
  // exatamente como este teste quebrou. O que o teste afirma é o pin vencer a
  // heurística — a tarefa é trivial, então a heurística NÃO escolheria premium.
  const premium = DEFAULT_PROVIDERS.find((p) => p.id === 'anthropic')!.models.find((m) => m.tier === 'premium')!;
  try {
    process.env.IZANAGI_MODEL = premium.id;
    const r = router.route({ task: 'oi', taskComplexity: 1, reasoningRequirement: 'low', risk: 0.1, tokenBudget: 1000, requiresTools: false });
    assert.equal(r.model.id, premium.id);
    assert.equal(r.provider, 'anthropic');
    assert.ok(r.reasons.some((x) => x.includes('IZANAGI_MODEL')));
  } finally {
    if (prev === undefined) delete process.env.IZANAGI_MODEL;
    else process.env.IZANAGI_MODEL = prev;
  }
});

test('router: loadProjectProviders sem config retorna defaults', () => {
  const providers = ModelRouter.loadProjectProviders(tmpDir());
  assert.deepEqual(providers, DEFAULT_PROVIDERS);
});

test('router: loadProjectProviders mescla provider customizado do projeto', () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, '.izanagi'), { recursive: true });
  const custom = {
    id: 'local',
    name: 'Local',
    models: [{ id: 'local-llm', tier: 'fast', contextWindow: 8000, costPer1kInput: 0, costPer1kOutput: 0, avgLatencyMs: 50, reasoning: 'low' }],
  };
  fs.writeFileSync(path.join(dir, '.izanagi', 'izanagi.config.json'), JSON.stringify({ models: [custom] }));
  const providers = ModelRouter.loadProjectProviders(dir);
  assert.equal(providers.length, DEFAULT_PROVIDERS.length + 1);
  const r = new ModelRouter(providers);
  assert.ok(r.catalog().some((m) => m.id === 'local-llm'));
});

test('router: loadProjectProviders ignora config inválido sem quebrar', () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, '.izanagi'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.izanagi', 'izanagi.config.json'), '{ not json');
  assert.deepEqual(ModelRouter.loadProjectProviders(dir), DEFAULT_PROVIDERS);
});

test('router: IZANAGI_MODEL desconhecido é ignorado e cai na heurística', () => {
  const prev = process.env.IZANAGI_MODEL;
  try {
    process.env.IZANAGI_MODEL = 'modelo-que-nao-existe';
    const r = router.route({ task: 'oi', taskComplexity: 1, reasoningRequirement: 'low', risk: 0.1, tokenBudget: 1000, requiresTools: false });
    assert.equal(r.model.tier, 'fast');
  } finally {
    if (prev === undefined) delete process.env.IZANAGI_MODEL;
    else process.env.IZANAGI_MODEL = prev;
  }
});
