import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ArtifactRegistry } from '../artifacts/registry.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-artifacts-'));
}

test('artifact registry: register + get roundtrip com hash/size/versão 1', () => {
  const registry = new ArtifactRegistry({ baseDir: tmpDir() });
  const record = registry.register({
    kind: 'implementation',
    name: 'execute',
    producer: { runId: 'run-1', nodeId: 'execute', agent: 'senior-engineer' },
    hash: 'abc123',
    size: 500,
    valid: true,
    score: 0.9,
  });

  assert.equal(record.id, 'run-1:execute');
  assert.equal(record.version, 1);
  const fetched = registry.get('run-1:execute');
  assert.equal(fetched?.hash, 'abc123');
  assert.equal(fetched?.producer.agent, 'senior-engineer');
});

test('artifact registry: registrar o mesmo (runId,nodeId) de novo incrementa versão (retry/replan)', () => {
  const registry = new ArtifactRegistry({ baseDir: tmpDir() });
  registry.register({ kind: 'implementation', name: 'execute', producer: { runId: 'run-1', nodeId: 'execute' }, hash: 'v1', size: 10, valid: false, score: 0.2 });
  registry.register({ kind: 'implementation', name: 'execute', producer: { runId: 'run-1', nodeId: 'execute' }, hash: 'v2', size: 20, valid: true, score: 0.9 });

  const history = registry.history('run-1:execute');
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((h) => h.version), [1, 2]);
  // get() devolve sempre a última versão
  assert.equal(registry.get('run-1:execute')?.hash, 'v2');
});

test('artifact registry: forRun lista todos os artefatos de um run na ordem de registro', () => {
  const registry = new ArtifactRegistry({ baseDir: tmpDir() });
  registry.register({ kind: 'implementation', name: 'execute', producer: { runId: 'run-1', nodeId: 'execute' }, hash: 'a', size: 1, valid: true, score: 1 });
  registry.register({ kind: 'qa-report', name: 'verify', producer: { runId: 'run-1', nodeId: 'verify' }, hash: 'b', size: 1, valid: true, score: 1 });
  registry.register({ kind: 'implementation', name: 'execute', producer: { runId: 'run-2', nodeId: 'execute' }, hash: 'c', size: 1, valid: true, score: 1 });

  const forRun1 = registry.forRun('run-1');
  assert.equal(forRun1.length, 2);
  assert.deepEqual(forRun1.map((r) => r.id), ['run-1:execute', 'run-1:verify']);
});

test('artifact registry: consumers() rastreia quem depende de um artefato', () => {
  const registry = new ArtifactRegistry({ baseDir: tmpDir() });
  registry.register({ kind: 'implementation', name: 'execute', producer: { runId: 'run-1', nodeId: 'execute' }, hash: 'a', size: 1, valid: true, score: 1 });
  registry.register({
    kind: 'qa-report',
    name: 'verify',
    producer: { runId: 'run-1', nodeId: 'verify' },
    hash: 'b',
    size: 1,
    valid: true,
    score: 1,
    dependencies: ['run-1:execute'],
  });

  const consumers = registry.consumers('run-1:execute');
  assert.equal(consumers.length, 1);
  assert.equal(consumers[0].id, 'run-1:verify');
});

test('artifact registry: persiste em disco e recarrega em nova instância', () => {
  const baseDir = tmpDir();
  const r1 = new ArtifactRegistry({ baseDir });
  r1.register({ kind: 'implementation', name: 'execute', producer: { runId: 'run-1', nodeId: 'execute' }, hash: 'a', size: 1, valid: true, score: 1 });

  const r2 = new ArtifactRegistry({ baseDir });
  assert.ok(r2.get('run-1:execute'));
});
