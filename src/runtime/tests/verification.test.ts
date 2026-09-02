import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { VerificationEngine, runCheck } from '../verification/engine.js';
import type { TaskContract, AcceptanceCriterion } from '../contracts/task-contract.js';

const engine = new VerificationEngine();

function contract(acceptance: AcceptanceCriterion[], overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'node1',
    objective: 'produzir artefato',
    role: 'specialist',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 1000 },
    verification: { deterministic: [] },
    acceptance,
    ...overrides,
  };
}

test('verificação: artefato que cumpre todos os critérios vira VERIFIED', async () => {
  const result = await engine.verify({
    contract: contract([
      { id: 'c1', description: 'tem pelo menos 20 bytes', kind: 'deterministic', check: { kind: 'min-size', bytes: 20 } },
      { id: 'c2', description: 'menciona login', kind: 'deterministic', check: { kind: 'contains', text: 'login' } },
    ]),
    content: 'Implementação completa do fluxo de login com hashing Argon2.',
  });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.score, 1);
  assert.deepEqual(result.unmet, []);
});

test('verificação: critério reprovado vira FAILED com o motivo concreto', async () => {
  const result = await engine.verify({
    contract: contract([
      { id: 'c1', description: 'sem TODO', kind: 'deterministic', check: { kind: 'not-contains', text: 'TODO' } },
    ]),
    content: 'função pronta\n// TODO: implementar depois',
  });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.unmet.length, 1);
  assert.ok(result.checks[0].message?.includes('TODO'));
});

test('verificação: critério semântico SEM juiz nunca vira VERIFIED', async () => {
  const result = await engine.verify({
    contract: contract([
      { id: 'det', description: 'tem tamanho', kind: 'deterministic', check: { kind: 'min-size', bytes: 5 } },
      { id: 'sem', description: 'a solução é idiomática', kind: 'semantic' },
    ]),
    content: 'conteúdo suficientemente grande para passar',
  });
  assert.equal(result.status, 'UNVERIFIED', 'ausência de verificação semântica não é aprovação semântica');
  assert.ok(result.reason.includes('sem evidência conclusiva'));
  assert.equal(VerificationEngine.isDone(result), false);
});

test('verificação: com juiz semântico o mesmo caso fecha em VERIFIED', async () => {
  const result = await engine.verify({
    contract: contract([
      { id: 'sem', description: 'a solução é idiomática', kind: 'semantic' },
    ]),
    content: 'conteúdo',
    judge: () => ({ pass: true, message: 'juiz aprovou' }),
  });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(VerificationEngine.isDone(result), true);
});

test('verificação: critério de evidência exige que o artefato exista e seja válido', async () => {
  const artifacts = new Map([
    ['tests', { kind: 'test-plan', content: 'plano', valid: false }],
  ]);
  const missing = await engine.verify({
    contract: contract([{ id: 'ev', description: 'existe relatório de testes', kind: 'evidence', evidenceOf: 'nao-existe' }]),
    content: 'x',
    artifacts,
  });
  assert.equal(missing.status, 'FAILED');
  assert.ok(missing.checks[0].message?.includes('não foi produzido'));

  const invalid = await engine.verify({
    contract: contract([{ id: 'ev', description: 'existe relatório de testes', kind: 'evidence', evidenceOf: 'tests' }]),
    content: 'x',
    artifacts,
  });
  assert.equal(invalid.status, 'FAILED');
  assert.ok(invalid.evidence.some((e) => e.ref === 'tests' && !e.valid));
});

test('verificação: critério opcional reprovado não derruba o veredito por padrão', async () => {
  const result = await engine.verify({
    contract: contract([
      { id: 'req', description: 'tamanho mínimo', kind: 'deterministic', check: { kind: 'min-size', bytes: 5 } },
      { id: 'opt', description: 'menciona benchmark', kind: 'deterministic', check: { kind: 'contains', text: 'benchmark' }, optional: true },
    ]),
    content: 'conteúdo válido sem a palavra pedida',
  });
  assert.equal(result.status, 'VERIFIED');
});

test('verificação: requireAllCriteria transforma opcional reprovado em FAILED', async () => {
  const result = await engine.verify({
    contract: contract(
      [
        { id: 'req', description: 'tamanho mínimo', kind: 'deterministic', check: { kind: 'min-size', bytes: 5 } },
        { id: 'opt', description: 'menciona benchmark', kind: 'deterministic', check: { kind: 'contains', text: 'benchmark' }, optional: true },
      ],
      { verification: { deterministic: [], requireAllCriteria: true } },
    ),
    content: 'conteúdo válido sem a palavra pedida',
  });
  assert.equal(result.status, 'FAILED');
});

test('check: file-exists sem baseDir fica UNKNOWN em vez de fingir sucesso', () => {
  const r = runCheck({ kind: 'file-exists', path: 'x.txt' }, { content: '', text: '', kind: 'raw' });
  assert.equal(r.outcome, 'unknown');
});

test('check: file-exists valida dentro da raiz e bloqueia escape de diretório', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-verify-'));
  fs.writeFileSync(path.join(dir, 'ok.txt'), 'x', 'utf-8');
  assert.equal(runCheck({ kind: 'file-exists', path: 'ok.txt' }, { content: '', text: '', kind: 'raw', baseDir: dir }).outcome, 'pass');
  assert.equal(runCheck({ kind: 'file-exists', path: 'nope.txt' }, { content: '', text: '', kind: 'raw', baseDir: dir }).outcome, 'fail');
  const escape = runCheck({ kind: 'file-exists', path: '../../../etc/passwd' }, { content: '', text: '', kind: 'raw', baseDir: dir });
  assert.equal(escape.outcome, 'fail');
  assert.ok(escape.message?.includes('fora da raiz'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('check: json-field detecta campo ausente em objeto e conteúdo não-objeto', () => {
  const ok = runCheck({ kind: 'json-field', field: 'verdict' }, { content: { verdict: 'PASS' }, text: '{}', kind: 'evaluation' });
  assert.equal(ok.outcome, 'pass');
  const missing = runCheck({ kind: 'json-field', field: 'verdict' }, { content: { score: 1 }, text: '{}', kind: 'evaluation' });
  assert.equal(missing.outcome, 'fail');
  const notObject = runCheck({ kind: 'json-field', field: 'verdict' }, { content: 'texto', text: 'texto', kind: 'raw' });
  assert.equal(notObject.outcome, 'fail');
});

test('check: regex inválida vira UNKNOWN em vez de derrubar a verificação', () => {
  const r = runCheck({ kind: 'matches', pattern: '([a-z' }, { content: 'x', text: 'x', kind: 'raw' });
  assert.equal(r.outcome, 'unknown');
});

test('verificação: score reflete a fração de critérios obrigatórios aprovados', async () => {
  const result = await engine.verify({
    contract: contract([
      { id: 'c1', description: 'a', kind: 'deterministic', check: { kind: 'contains', text: 'alpha' } },
      { id: 'c2', description: 'b', kind: 'deterministic', check: { kind: 'contains', text: 'beta' } },
      { id: 'c3', description: 'c', kind: 'deterministic', check: { kind: 'contains', text: 'gamma' } },
      { id: 'c4', description: 'd', kind: 'deterministic', check: { kind: 'contains', text: 'delta' } },
    ]),
    content: 'alpha beta',
  });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.score, 0.5);
});
