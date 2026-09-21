/**
 * Canvas Orchestration — testes da RESOLUÇÃO DE MODELO POR NÓ.
 *
 * Contrato sob teste (src/runtime/canvas/model-config.ts):
 *   - `auto` delega ao ModelRouter por PAPEL (com hint de tier opcional);
 *   - `manual` exige provider + model do catálogo, coerentes entre si;
 *   - `inherit` exige modelo herdado e nunca inventa provider;
 *   - `sanitizeForNode` clampa/remove parâmetros contra as capacidades do
 *     provider: warning sim, erro nunca.
 *
 * Nenhum teste toca rede: o ModelRouter é determinístico e local.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRouter } from '../model/router.js';
import { capabilitiesFor } from '../canvas/model-capabilities.js';
import { resolveNodeModel, sanitizeForNode, tierForHint } from '../canvas/model-config.js';
import type { NodeModelConfig } from '../canvas/types.js';
import type { RoutingContext } from '../types.js';

const router = new ModelRouter();

const ctx: RoutingContext = {
  task: 'revisar módulo de paginação',
  taskComplexity: 3,
  reasoningRequirement: 'medium',
  risk: 0.2,
  tokenBudget: 2000,
  requiresTools: false,
};

const base = { mode: 'auto' as const, role: 'specialist' as const, router, ctx };

test('model-config: modo auto delega ao papel e reporta a fonte', () => {
  const res = resolveNodeModel('n1', base);
  assert.equal(res.node, 'n1');
  assert.equal(res.source, 'auto');
  assert.equal(res.tier, 'balanced', 'papel specialist prefere balanced');
  assert.equal(typeof res.model, 'string');
  assert.equal(typeof res.provider, 'string');
  assert.ok(Array.isArray(res.reasons));
  assert.equal(res.reasoning, undefined, 'auto não declara reasoning');
  assert.equal(res.warnings, undefined);
});

test('model-config: papel worker roteia para o tier rápido', () => {
  const res = resolveNodeModel('worker-1', { ...base, role: 'worker' });
  assert.equal(res.tier, 'fast');
  assert.equal(res.source, 'auto');
});

test('model-config: hint de tier do agente vence a preferência do papel', () => {
  const res = resolveNodeModel('n-hint', { ...base, role: 'worker', hintedTier: 'opus' });
  assert.equal(res.tier, 'premium', 'hint opus → tier premium mesmo no papel worker');
  const rapido = resolveNodeModel('n-hint-fast', { ...base, role: 'specialist', hintedTier: 'haiku' });
  assert.equal(rapido.tier, 'fast');
  const semHint = resolveNodeModel('n-sem-hint', { ...base, role: 'worker' });
  assert.equal(semHint.tier, 'fast');
});

test('model-config: tierForHint traduz o qualificador do genome e degrada para balanced', () => {
  assert.equal(tierForHint('opus'), 'premium');
  assert.equal(tierForHint('sonnet'), 'balanced');
  assert.equal(tierForHint('haiku'), 'fast');
  assert.equal(tierForHint('claude-opus'), 'premium');
  assert.equal(tierForHint('gpt-5'), 'premium');
  assert.equal(tierForHint('gemini-3-pro'), 'premium');
  assert.equal(tierForHint('o4-mini'), 'fast');
  assert.equal(tierForHint('OPUS'), 'premium', 'case-insensitive');
  assert.equal(tierForHint('modelo-inexistente'), 'balanced', 'desconhecido cai no default conservador');
});

test('model-config: modo manual usa provider+model declarados e reporta a razão', () => {
  const espec = router.catalog().find((s) => s.reasoning === 'high')!;
  const provider = router.providerOf(espec.id);
  assert.notEqual(provider, 'unknown', 'o fixture depende de um modelo real do catálogo');

  const res = resolveNodeModel('manual-1', {
    ...base,
    mode: 'manual',
    manual: { provider, model: espec.id, reasoning: { effort: 'high' } },
  });
  assert.equal(res.source, 'manual');
  assert.equal(res.model, espec.id);
  assert.equal(res.provider, provider);
  assert.equal(res.reasoning, 'high', 'effort dentro do cap é preservado');
  assert.equal(res.tier, 'premium', 'reasoning high → tier premium');
  assert.deepEqual(res.reasons, [`manual: ${provider}/${espec.id}`]);
});

test('model-config: modo manual rebaixa reasoning acima do cap do provider com aviso', () => {
  const espec = router.catalog().find((s) => s.reasoning === 'low')!;
  const provider = router.providerOf(espec.id);
  const res = resolveNodeModel('manual-baixo', {
    ...base,
    mode: 'manual',
    manual: { provider, model: espec.id, reasoning: { effort: 'high' } },
  });
  assert.equal(res.reasoning, 'low', 'cap low rebaixa high');
  assert.equal(res.tier, 'fast');
  assert.ok(res.warnings?.some((w) => w.includes('acima do cap')), `esperava aviso de cap, veio ${JSON.stringify(res.warnings)}`);
});

test('model-config: modo manual rejeita modelo fora do catálogo, provider divergente e campos ausentes', () => {
  assert.throws(() => resolveNodeModel('x', { ...base, mode: 'manual', manual: { provider: 'openai', model: 'modelo-inexistente' } }), /não está no catálogo/);
  assert.throws(
    () => resolveNodeModel('x', { ...base, mode: 'manual', manual: { provider: 'openai', model: 'claude-opus-5' } }),
    /é do provider "anthropic", não "openai"/,
  );
  assert.throws(() => resolveNodeModel('x', { ...base, mode: 'manual' }), /exige provider e model/);
});

test('model-config: manual sem reasoning declarado usa o fallback do catálogo, sem avisos', () => {
  const provider = router.providerOf('claude-sonnet-5');
  const res = resolveNodeModel('manual-cli', {
    ...base,
    mode: 'manual',
    manual: { provider, model: 'claude-sonnet-5' },
  });
  assert.equal(res.source, 'manual');
  assert.equal(res.provider, provider);
  assert.equal(res.reasoning, 'medium', 'fallback declarado pelo catálogo do provider');
  assert.equal(res.warnings, undefined, 'nada foi removido porque nada foi pedido');
});

test('model-config: modo inherit usa o modelo do run e exige inheritedId', () => {
  const res = resolveNodeModel('filho', { ...base, mode: 'inherit', inheritedId: 'claude-opus-5' });
  assert.equal(res.source, 'inherit');
  assert.equal(res.model, 'claude-opus-5');
  assert.equal(res.provider, 'anthropic');
  assert.equal(res.tier, 'premium');
  assert.deepEqual(res.reasons, ['herdado do run: claude-opus-5']);

  assert.throws(() => resolveNodeModel('filho', { ...base, mode: 'inherit' }), /sem modelo herdado/);
});

test('model-config: inherit de modelo desconhecido não inventa provider', () => {
  const res = resolveNodeModel('filho', { ...base, mode: 'inherit', inheritedId: 'modelo-de-outro-run' });
  assert.equal(res.model, 'modelo-de-outro-run');
  assert.equal(res.provider, 'unknown');
  assert.equal(res.tier, 'balanced');
});

test('sanitizeForNode: provider sem temperature/topP/reasoning remove os campos com aviso', () => {
  const caps = capabilitiesFor('claude-cli', 'claude-sonnet-5');
  const node: NodeModelConfig = {
    mode: 'manual',
    provider: 'claude-cli',
    model: 'claude-sonnet-5',
    reasoning: { effort: 'high' },
    thinking: { type: 'adaptive', effort: 'high' },
    limits: { temperature: 0.7, topP: 0.9 },
  };
  const { node: sanitizado, warnings } = sanitizeForNode(node, caps);
  assert.notEqual(sanitizado, node, 'devolve cópia, nunca muta a entrada');
  assert.equal(sanitizado.reasoning, undefined);
  assert.equal(sanitizado.thinking, undefined);
  assert.equal(sanitizado.limits?.temperature, undefined);
  assert.equal(sanitizado.limits?.topP, undefined);
  assert.equal(warnings.length, 3, `esperava 3 avisos (temperature, topP, reasoning), veio ${JSON.stringify(warnings)}`);
  assert.ok(warnings.some((w) => w.includes('não suporta temperature')));
  assert.ok(warnings.some((w) => w.includes('não suporta topP')));
  assert.ok(warnings.some((w) => w.includes('não suporta controle de reasoning effort')));
  assert.equal(node.limits?.temperature, 0.7, 'entrada intacta');
});

test('sanitizeForNode: modo manual sem reasoning declarado preenche com o cap do provider', () => {
  const caps = capabilitiesFor('openai', 'gpt-4o');
  const { node: sanitizado, warnings } = sanitizeForNode({ mode: 'manual', provider: 'openai', model: 'gpt-4o' }, caps);
  assert.deepEqual(sanitizado.reasoning, { effort: caps.reasoningEffortCap });
  assert.deepEqual(warnings, []);
});

test('sanitizeForNode: reasoning acima do cap é rebaixado (nunca removido)', () => {
  const caps = capabilitiesFor('openai', 'gpt-4o');
  const { node: sanitizado, warnings } = sanitizeForNode(
    { mode: 'manual', provider: 'openai', model: 'gpt-4o', reasoning: { effort: 'high' } },
    caps,
  );
  assert.deepEqual(sanitizado.reasoning, { effort: 'medium' });
  assert.ok(warnings.some((w) => w.includes('rebaixado')));
});

test('sanitizeForNode: maxCompletionTokens acima do teto é clampado ao teto do provider', () => {
  const caps = capabilitiesFor('openai', 'gpt-4o');
  const { node: sanitizado, warnings } = sanitizeForNode(
    { mode: 'manual', provider: 'openai', model: 'gpt-4o', limits: { maxCompletionTokens: 999_999 } },
    caps,
  );
  assert.equal(sanitizado.limits?.maxCompletionTokens, caps.maxOutputTokens);
  assert.ok(warnings.some((w) => w.includes('excede o teto')));
});

test('sanitizeForNode: provider sem teto de saída conhecido (0) não clampa', () => {
  const caps = capabilitiesFor('claude-cli');
  assert.equal(caps.maxOutputTokens, 0);
  const { node: sanitizado } = sanitizeForNode(
    { mode: 'manual', provider: 'claude-cli', model: 'claude-sonnet-5', limits: { maxCompletionTokens: 1234 } },
    caps,
  );
  assert.equal(sanitizado.limits?.maxCompletionTokens, 1234);
});

test('sanitizeForNode: temperature fora da faixa é clampada, não removida', () => {
  const caps = capabilitiesFor('openai', 'gpt-4o');
  const alto = sanitizeForNode({ mode: 'manual', provider: 'openai', model: 'gpt-4o', limits: { temperature: 5 } }, caps);
  assert.equal(alto.node.limits?.temperature, 2);
  const baixo = sanitizeForNode({ mode: 'manual', provider: 'openai', model: 'gpt-4o', limits: { temperature: -3 } }, caps);
  assert.equal(baixo.node.limits?.temperature, 0);
  assert.ok(alto.warnings.some((w) => w.includes('clampado')));
});
