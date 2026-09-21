/**
 * Canvas Orchestration — testes do evaluator de CONDIÇÕES SANDBOXED.
 *
 * Contrato sob teste (src/runtime/canvas/condition.ts):
 *   - gramática fechada: comparações, booleanos, caminhos de propriedade;
 *   - NUNCA executa JS: sem `eval`, sem chamadas de função, sem indexação
 *     dinâmica, sem template — e função no escopo não é exposta;
 *   - expressão inválida LANÇA (o validador converte em CAN-202), nunca
 *     devolve um booleano silencioso.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileCondition, ConditionError, evaluateCondition, isValidCondition } from '../canvas/condition.js';

const scope = {
  result: { score: 0.9, ok: true, status: 'done', list: [1, 2, 3] },
  input: { task: 'refatorar', retries: 0 },
  n: -1,
  zero: 0,
  vazio: '',
  texto: '5',
  numero: 5,
  flag: false,
  nada: null,
};

test('condition: comparações numéricas e limiares de score', () => {
  assert.equal(evaluateCondition('result.score >= 0.8', scope), true);
  assert.equal(evaluateCondition('result.score > 0.95', scope), false);
  assert.equal(evaluateCondition('result.score <= 0.9', scope), true);
  assert.equal(evaluateCondition('result.score != 1', scope), true);
  assert.equal(evaluateCondition('numero == 5', scope), true);
  assert.equal(evaluateCondition('numero < 5', scope), false);
});

test('condition: números negativos e frações são suportados', () => {
  assert.equal(evaluateCondition('n == -1', scope), true);
  assert.equal(evaluateCondition('n < 0', scope), true);
  assert.equal(evaluateCondition('result.score > -1', scope), true);
});

test('condition: booleanos literais e caminhos de tipo boolean', () => {
  assert.equal(evaluateCondition('true', scope), true);
  assert.equal(evaluateCondition('false', scope), false);
  assert.equal(evaluateCondition('result.ok', scope), true);
  assert.equal(evaluateCondition('result.ok == true', scope), true);
  assert.equal(evaluateCondition('flag', scope), false);
  assert.equal(evaluateCondition('flag == false', scope), true);
});

test('condition: strings aceitam aspas simples e duplas', () => {
  assert.equal(evaluateCondition("result.status == 'done'", scope), true);
  assert.equal(evaluateCondition('result.status == "done"', scope), true);
  assert.equal(evaluateCondition("result.status == 'erro'", scope), false);
  assert.equal(evaluateCondition("input.task == 'refatorar'", scope), true);
});

test('condition: igualdade é estrita entre tipos distintos', () => {
  assert.equal(evaluateCondition("'5' == 5", scope), false);
  assert.equal(evaluateCondition("'5' != 5", scope), true);
  assert.equal(evaluateCondition('texto == "5"', scope), true);
  assert.equal(evaluateCondition('numero == 5', scope), true);
});

test('condition: operadores lógicos and/or/&&/|| com precedência (and antes de or)', () => {
  assert.equal(evaluateCondition('result.ok and result.score > 0.5', scope), true);
  assert.equal(evaluateCondition("result.ok && result.status == 'done'", scope), true);
  assert.equal(evaluateCondition("flag or result.status == 'done'", scope), true);
  assert.equal(evaluateCondition('flag || result.ok', scope), true);
  // `or` à esquerda de `and`: true or (false and false) → true
  assert.equal(evaluateCondition('result.ok or flag and false', scope), true);
});

test('condition: parênteses mudam a precedência', () => {
  assert.equal(evaluateCondition('(flag or result.ok) and true', scope), true);
  assert.equal(evaluateCondition('(flag and result.ok) or false', scope), false);
});

test('condition: not e ! negam a verdade do operando', () => {
  assert.equal(evaluateCondition('not flag', scope), true);
  assert.equal(evaluateCondition('! flag', scope), true);
  assert.equal(evaluateCondition('not result.ok', scope), false);
  assert.equal(evaluateCondition('not (result.score > 0.5)', scope), false);
});

test('condition: caminho inexistente — `!=` é verdadeiro, ordenação é falsa', () => {
  assert.equal(evaluateCondition('missing == 1', scope), false);
  assert.equal(evaluateCondition('missing != 1', scope), true);
  assert.equal(evaluateCondition('missing > 1', scope), false);
  assert.equal(evaluateCondition('missing <= 1', scope), false);
  assert.equal(evaluateCondition('missing == missing', scope), true);
  assert.equal(evaluateCondition('nada == nada', scope), true);
  assert.equal(evaluateCondition('nada > 0', scope), false, 'null nunca satisfaz limiar');
});

test('condition: caminhos aninhados e caminhos profundos dentro do teto (8 segmentos)', () => {
  assert.equal(evaluateCondition('input.task == "refatorar"', scope), true);
  assert.equal(evaluateCondition('result.list', scope), true, 'array vazio? não: [1,2,3] é truthy');
  const fundo = { a: { b: { c: { d: { e: { f: { g: { h: true } } } } } } } };
  assert.equal(evaluateCondition('a.b.c.d.e.f.g.h', fundo), true);
});

test('condition: caminho com mais de 8 segmentos é rejeitado', () => {
  const alcancavel = { a: 1 };
  const profundo = 'a.b.c.d.e.f.g.h.i';
  assert.equal(isValidCondition(profundo), false);
  assert.throws(() => evaluateCondition(profundo, alcancavel), /caminho de propriedade longo demais/);
});

test('condition: valores truthy/falsy na posição de expressão', () => {
  assert.equal(evaluateCondition('zero', scope), false);
  assert.equal(evaluateCondition('vazio', scope), false);
  assert.equal(evaluateCondition('nada', scope), false);
  assert.equal(evaluateCondition('texto', scope), true, 'string não-vazia é truthy');
  assert.equal(evaluateCondition('result.list', scope), true, 'array não-vazio é truthy');
});

test('condition: função no escopo nunca é exposta (sem execução de JS)', () => {
  assert.equal(evaluateCondition('f', { f: () => 1 }), false, 'valor de função não é truthy nem chamável');
  assert.equal(evaluateCondition('obj.f', { obj: { f: () => 1 } }), false);
});

test('condition: expressões inválidas lançam ConditionError', () => {
  for (const expr of ['', '   ', '/invalida', '$x', '(', 'a ==', 'a ===', 'a +', 'a..b', 'not']) {
    assert.throws(() => evaluateCondition(expr, scope), ConditionError, `aceitou expressão inválida: "${expr}"`);
    assert.equal(isValidCondition(expr), false, `isValidCondition mentiu para "${expr}"`);
  }
});

test('condition: erro de sintaxe informa o caractere inesperado', () => {
  assert.throws(() => evaluateCondition('a / b', scope), /caractere inesperado "\/"/);
  assert.throws(() => evaluateCondition('a $ b', scope), /caractere inesperado "\$"/);
});

test('condition: expressões válidas passam em isValidCondition sem avaliar', () => {
  assert.equal(isValidCondition('result.score >= 0.8'), true);
  assert.equal(isValidCondition('not (a and b) or c != 2'), true);
  assert.equal(isValidCondition('true'), true);
});

test('condition: compileCondition devolve AST sem avaliar o escopo', () => {
  assert.deepEqual(compileCondition('a == 1'), {
    kind: 'cmp',
    op: '==',
    left: { kind: 'path', parts: ['a'] },
    right: { kind: 'num', value: 1 },
  });
  assert.deepEqual(compileCondition('x and y'), {
    kind: 'and',
    left: { kind: 'path', parts: ['x'] },
    right: { kind: 'path', parts: ['y'] },
  });
  assert.deepEqual(compileCondition('not f'), { kind: 'not', operand: { kind: 'path', parts: ['f'] } });
  assert.deepEqual(compileCondition("'txt'"), { kind: 'str', value: 'txt' });
  assert.deepEqual(compileCondition('false'), { kind: 'bool', value: false });
});

test('condition: ConditionError tem nome estável (o validador depende dele)', () => {
  try {
    evaluateCondition('a ===', {});
    assert.fail('deveria ter lançado');
  } catch (err) {
    assert.ok(err instanceof ConditionError);
    assert.equal((err as Error).name, 'ConditionError');
  }
});
