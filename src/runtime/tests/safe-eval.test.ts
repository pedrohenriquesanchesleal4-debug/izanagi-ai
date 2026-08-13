import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeEvaluate } from '../orchestration/safe-eval.js';

test('safe-eval: comparação simples e dot-path', () => {
  assert.equal(safeEvaluate('ok === true', { ok: true }), true);
  assert.equal(safeEvaluate('ok === true', { ok: false }), false);
  assert.equal(
    safeEvaluate('artifact.architecture.valid == true', { artifact: { architecture: { valid: true } } }),
    true,
  );
});

test('safe-eval: métodos de string reais usados em benchmarks/definitions.ts', () => {
  assert.equal(safeEvaluate('!text.includes("TODO")', { text: 'implementação completa' }), true);
  assert.equal(safeEvaluate('!text.includes("TODO")', { text: 'contém TODO aqui' }), false);
  assert.equal(safeEvaluate('text.toLowerCase().includes("test")', { text: 'Rodamos os TESTs' }), true);
  assert.equal(
    safeEvaluate('text.toLowerCase().includes("causa") || text.toLowerCase().includes("root")', {
      text: 'root cause analysis',
    }),
    true,
  );
  assert.equal(
    safeEvaluate('!text.toLowerCase().includes("inter") || text.includes("Inter Variable")', {
      text: 'usa Inter Variable como tipografia',
    }),
    true,
  );
});

test('safe-eval: operadores relacionais e length', () => {
  assert.equal(safeEvaluate('text.length > 3', { text: 'abcdef' }), true);
  assert.equal(safeEvaluate('score >= 0.8', { score: 0.9 }), true);
  assert.equal(safeEvaluate('score >= 0.8', { score: 0.5 }), false);
});

test('safe-eval: bloqueia acesso a __proto__/constructor/prototype', () => {
  assert.throws(() => safeEvaluate('text.constructor', { text: 'x' }), /bloqueado/);
  assert.throws(() => safeEvaluate('text.__proto__', { text: 'x' }), /bloqueado/);
  assert.throws(() => safeEvaluate('a.prototype', { a: {} }), /bloqueado/);
});

test('safe-eval: bloqueia métodos/globais fora da allowlist (sem execução de código)', () => {
  assert.throws(() => safeEvaluate('text.replace("a","b")', { text: 'abc' }), /não permitido/);
  assert.throws(() => safeEvaluate('process.exit()', { process: {} }), /não permitido|token inesperado/);
  assert.throws(() => safeEvaluate('require("fs")', {}), /token inesperado/);
});

test('safe-eval: nunca executa código JS arbitrário (sem side effects)', () => {
  let sideEffect = false;
  const context = {
    text: 'abc',
    trigger: () => {
      sideEffect = true;
      return true;
    },
  };
  assert.throws(() => safeEvaluate('trigger()', context));
  assert.equal(sideEffect, false);
});
