import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Healer, categorizeFailure } from '../recovery/healing.js';
import { MemoryStore } from '../memory/store.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-cat-'));
}

test('failure-taxonomy: categoriza por conteúdo do erro, independente do kind', () => {
  assert.equal(categorizeFailure('recoverable', 'request timed out after 30s'), 'TIMEOUT');
  assert.equal(categorizeFailure('validation', 'invalid artifact: missing required field'), 'ARTIFACT_FAILURE');
  assert.equal(categorizeFailure('validation', 'test suite failed: 3 assertions'), 'TEST_FAILURE');
  assert.equal(categorizeFailure('tool', 'security scan found a hardcoded secret'), 'SECURITY_FAILURE');
  assert.equal(categorizeFailure('unknown', 'missing .env variable DATABASE_URL'), 'CONFIGURATION_FAILURE');
  assert.equal(categorizeFailure('unknown', 'ENOENT: permission denied'), 'ENVIRONMENT_FAILURE');
});

test('failure-taxonomy: fallback por kind quando a mensagem não bate em nenhuma regra', () => {
  assert.equal(categorizeFailure('dependency', 'cannot find module xyz'), 'DEPENDENCY_FAILURE');
  assert.equal(categorizeFailure('tool', 'comando falhou: exit code 1'), 'TOOL_FAILURE');
  assert.equal(categorizeFailure('agent', 'agente retornou saída inconsistente'), 'AGENT_FAILURE');
  assert.equal(categorizeFailure('validation', 'schema mismatch'), 'VALIDATION_FAILURE');
  assert.equal(categorizeFailure('planning', 'cyclic graph detected'), 'MODEL_FAILURE');
  assert.equal(categorizeFailure('recoverable', '429 rate limit exceeded'), 'MODEL_FAILURE');
  assert.equal(categorizeFailure('unknown', 'algo misterioso aconteceu'), 'UNKNOWN_FAILURE');
});

test('failure-taxonomy: Healer.heal() sempre anexa category à HealingAction', () => {
  const memory = new MemoryStore({ baseDir: tmpDir() });
  const healer = new Healer();

  const retryDecision = healer.heal({
    nodeId: 'n1',
    error: 'request timed out after 30s',
    attempt: 0,
    maxAttempts: 3,
    elapsedMs: 100,
    maxTimeMs: 60_000,
    tokensUsed: 10,
    maxTokens: 10_000,
    memory,
  });
  assert.equal(retryDecision.action.category, 'TIMEOUT');

  const abortDecision = healer.heal({
    nodeId: 'n2',
    error: 'algo misterioso aconteceu',
    attempt: 5,
    maxAttempts: 3,
    elapsedMs: 100,
    maxTimeMs: 60_000,
    tokensUsed: 10,
    maxTokens: 10_000,
    memory,
  });
  assert.equal(abortDecision.action.kind, 'abort');
  assert.equal(abortDecision.action.category, 'UNKNOWN_FAILURE');
});
