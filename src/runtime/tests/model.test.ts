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

test('router: IZANAGI_MODEL força o modelo mesmo contra a heurística', () => {
  const prev = process.env.IZANAGI_MODEL;
  try {
    process.env.IZANAGI_MODEL = 'claude-opus-4-1';
    const r = router.route({ task: 'oi', taskComplexity: 1, reasoningRequirement: 'low', risk: 0.1, tokenBudget: 1000, requiresTools: false });
    assert.equal(r.model.id, 'claude-opus-4-1');
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
