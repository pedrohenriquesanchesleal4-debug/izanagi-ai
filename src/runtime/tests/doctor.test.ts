import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveProjectRoot } from '../../cli/commands/doctor.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-doctor-'));
}

test('doctor: instalação completa (.agents/agents com JSON) usa .agents como raiz', () => {
  const cwd = tmpDir();
  fs.mkdirSync(path.join(cwd, '.agents', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.agents', 'agents', 'architect.json'), '{}');
  const baseDir = tmpDir();
  assert.equal(resolveProjectRoot(cwd, baseDir), path.join(cwd, '.agents'));
});

test('doctor: repo-fonte com YAML derivados apenas (ADR-005) NÃO é instalação — raiz continua baseDir', () => {
  const cwd = tmpDir();
  fs.mkdirSync(path.join(cwd, '.agents', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.agents', 'agents', 'software-architect.yaml'), 'name: x\n');
  const baseDir = tmpDir();
  assert.equal(resolveProjectRoot(cwd, baseDir), baseDir);
});

test('doctor: .agents/memoria sozinha não caracteriza instalação', () => {
  const cwd = tmpDir();
  fs.mkdirSync(path.join(cwd, '.agents', 'memoria'), { recursive: true });
  const baseDir = tmpDir();
  assert.equal(resolveProjectRoot(cwd, baseDir), baseDir);
});

test('doctor: sem .agents alguma, raiz é baseDir', () => {
  const cwd = tmpDir();
  const baseDir = tmpDir();
  assert.equal(resolveProjectRoot(cwd, baseDir), baseDir);
});
