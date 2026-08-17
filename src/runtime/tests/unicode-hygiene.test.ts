import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeText } from '../text/unicode-hygiene.js';

test('unicode-hygiene: remove zero-width space no meio de um identificador', () => {
  const dirty = `const foo${'​'}bar = 1;`;
  const result = sanitizeText(dirty);
  assert.equal(result.text, 'const foobar = 1;');
  assert.equal(result.removed, 1);
  assert.equal(result.changed, true);
});

test('unicode-hygiene: normaliza non-breaking space e outros espaços homóglifos para espaço comum', () => {
  const dirty = `const${' '}x${' '}=${'　'}1;`; // NBSP, em space, ideographic space
  const result = sanitizeText(dirty);
  assert.equal(result.text, 'const x = 1;');
  assert.equal(result.normalizedSpaces, 3);
});

test('unicode-hygiene: remove marcas bidi/de formatação invisíveis (BOM, word joiner, RLO)', () => {
  const dirty = `${'﻿'}function f()${'⁠'} { return${'‮'}1; }`;
  const result = sanitizeText(dirty);
  assert.equal(result.text, 'function f() { return1; }');
  assert.equal(result.removed, 3);
});

test('unicode-hygiene: texto limpo não é alterado (changed=false, removed=0)', () => {
  const clean = 'function add(a, b) {\n  return a + b;\n}';
  const result = sanitizeText(clean);
  assert.equal(result.text, clean);
  assert.equal(result.removed, 0);
  assert.equal(result.normalizedSpaces, 0);
  assert.equal(result.changed, false);
});

test('unicode-hygiene: preserva emoji e texto em outros idiomas (não é uma denylist de tudo não-ASCII)', () => {
  const text = 'função calcular_média() # 中文注释 🚀';
  const result = sanitizeText(text);
  assert.equal(result.text, text);
  assert.equal(result.changed, false);
});

test('unicode-hygiene: lida com múltiplos caracteres invisíveis seguidos sem quebrar surrogate pairs', () => {
  const dirty = `a${'​'}${'‌'}${'‍'}b 🚀${'﻿'}c`;
  const result = sanitizeText(dirty);
  assert.equal(result.text, 'ab 🚀c');
  assert.equal(result.removed, 4);
});
