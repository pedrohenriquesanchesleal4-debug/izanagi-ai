import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ModelRouter, TIER_FOR_ROLE, DEFAULT_PROVIDERS } from '../model/router.js';
import type { RoutingContext } from '../types.js';

const ctx: RoutingContext = {
  task: 'implementar endpoint de login',
  taskComplexity: 3,
  reasoningRequirement: 'medium',
  risk: 0.2,
  tokenBudget: 8000,
  requiresTools: false,
};

function tmpProject(config: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-role-'));
  fs.mkdirSync(path.join(dir, '.izanagi'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.izanagi', 'izanagi.config.json'), JSON.stringify(config), 'utf-8');
  return dir;
}

test('router: papel worker escolhe tier fast, commander escolhe premium', () => {
  const router = new ModelRouter();
  const worker = router.routeForRole('worker', ctx);
  const commander = router.routeForRole('commander', ctx);
  assert.equal(worker.tier, 'fast');
  assert.equal(commander.tier, 'premium');
  assert.notEqual(worker.model.id, commander.model.id, 'worker e commander não podem cair no mesmo modelo');
});

test('router: worker custa estritamente menos que commander no catálogo default', () => {
  const router = new ModelRouter();
  const worker = router.routeForRole('worker', ctx).model;
  const commander = router.routeForRole('commander', ctx).model;
  const workerCost = ModelRouter.costUsd(worker, 1000, 500);
  const commanderCost = ModelRouter.costUsd(commander, 1000, 500);
  assert.ok(workerCost < commanderCost, `worker ($${workerCost}) deveria custar menos que commander ($${commanderCost})`);
});

test('router: catálogo restrito a um provider sem tier premium cai para o tier adjacente', () => {
  const onlyFast = DEFAULT_PROVIDERS.filter((p) => p.id === 'ollama');
  const router = new ModelRouter(onlyFast);
  const routed = router.routeForRole('commander', ctx);
  assert.equal(routed.model.id, 'llama3.1');
  assert.ok(routed.reasons.some((r) => r.includes('indisponível')), 'a queda de tier precisa ficar explícita nas razões');
});

/**
 * Ids para pin saem do catálogo em tempo de teste, não fixados no fonte. Estes
 * dois testes quebraram na atualização de catálogo por citarem `gpt-4.1` e
 * `gemini-2.0-flash`, e o que eles afirmam não tem nada a ver com id nenhum:
 * é que o pin vence a heurística, e que env vence config.
 */
const PIN_CONFIG = DEFAULT_PROVIDERS.find((p) => p.id === 'openai')!.models.find((m) => m.tier === 'premium')!.id;
const PIN_ENV = DEFAULT_PROVIDERS.find((p) => p.id === 'google')!.models.find((m) => m.tier === 'fast')!.id;

test('router: pin por papel no izanagi.config.json vence a heurística', () => {
  const dir = tmpProject({ roles: { worker: { model: PIN_CONFIG } } });
  const policy = ModelRouter.loadRolePolicy(dir);
  assert.ok(policy?.worker, 'policy do worker deveria ser carregada');
  const router = new ModelRouter().withRolePolicy(policy);
  const routed = router.routeForRole('worker', ctx);
  // `PIN_CONFIG` é premium e o papel worker prefere fast: se o pin não
  // vencesse, o id seria outro.
  assert.equal(routed.model.id, PIN_CONFIG);
  assert.ok(routed.reasons[0].includes('fixado'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('router: pin por env vence o pin de config', () => {
  const dir = tmpProject({ roles: { worker: { model: PIN_CONFIG } } });
  const policy = ModelRouter.loadRolePolicy(dir);
  process.env.IZANAGI_MODEL_WORKER = PIN_ENV;
  try {
    const routed = new ModelRouter().withRolePolicy(policy).routeForRole('worker', ctx);
    assert.notEqual(PIN_ENV, PIN_CONFIG, 'os dois pins têm que ser distintos para o teste significar algo');
    assert.equal(routed.model.id, PIN_ENV);
  } finally {
    delete process.env.IZANAGI_MODEL_WORKER;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('router: pin inexistente no catálogo é ignorado (não quebra o run)', () => {
  const router = new ModelRouter().withRolePolicy({ worker: { model: 'modelo-que-nao-existe' } });
  const routed = router.routeForRole('worker', ctx);
  assert.equal(routed.tier, TIER_FOR_ROLE.worker);
});

test('router: escalada de papel sobe worker → specialist → commander e para no topo', () => {
  assert.equal(ModelRouter.escalateRole('worker'), 'specialist');
  assert.equal(ModelRouter.escalateRole('specialist'), 'commander');
  assert.equal(ModelRouter.escalateRole('commander'), null);
});

test('router: modelo local declara custo zero (self-hosted não tem billing por token)', () => {
  const router = new ModelRouter(DEFAULT_PROVIDERS.filter((p) => p.id === 'lmstudio'));
  assert.equal(router.estimateCostForRole('commander', 10_000), 0);
});

test('router: estimativa por papel usa o modelo que de fato será roteado', () => {
  // Dentro de um mesmo provider a escada de preço é monotônica (haiku < sonnet
  // < opus). Entre providers ela NÃO é: um "premium" barato de um vendor pode
  // custar menos que um "balanced" caro de outro, e a estimativa precisa
  // refletir o modelo real escolhido, não uma suposição de ordenação.
  const anthropicOnly = DEFAULT_PROVIDERS.filter((p) => p.id === 'anthropic');
  const router = new ModelRouter(anthropicOnly);
  const worker = router.estimateCostForRole('worker', 10_000);
  const specialist = router.estimateCostForRole('specialist', 10_000);
  const commander = router.estimateCostForRole('commander', 10_000);
  assert.ok(worker < specialist, `worker ${worker} < specialist ${specialist}`);
  assert.ok(specialist < commander, `specialist ${specialist} < commander ${commander}`);

  const routed = router.routeForRole('specialist', ctx);
  const direct = ModelRouter.costUsd(routed.model, 7000, 3000);
  assert.equal(Math.round(specialist * 1e6), Math.round(direct * 1e6), 'estimativa deve bater com o custo do modelo roteado');
});

test('router: tier fast é o mais barato do catálogo pago', () => {
  const cloudOnly = DEFAULT_PROVIDERS.filter((p) => ['openai', 'anthropic', 'google'].includes(p.id));
  const router = new ModelRouter(cloudOnly);
  const worker = router.estimateCostForRole('worker', 10_000);
  assert.ok(worker < router.estimateCostForRole('specialist', 10_000));
  assert.ok(worker < router.estimateCostForRole('commander', 10_000));
});

test('router: route() legado continua funcionando sem mudanças de assinatura', () => {
  const routed = new ModelRouter().route(ctx);
  assert.ok(routed.model.id.length > 0);
  assert.ok(routed.provider.length > 0);
  assert.ok(Array.isArray(routed.candidates));
});
