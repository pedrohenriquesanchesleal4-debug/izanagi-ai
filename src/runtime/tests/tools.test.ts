import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ToolRegistry, type ToolDefinition } from '../tools/registry.js';

function tmpCtx(): { baseDir: string; permissions: Array<'fs:read' | 'fs:write'> } {
  return { baseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-tools-')), permissions: ['fs:read', 'fs:write'] };
}

test('tools: discover só expõe tools compatíveis com permissões', () => {
  const registry = new ToolRegistry();
  const readOnly = registry.discover({ baseDir: tmpCtx().baseDir, permissions: ['fs:read'] });
  assert.ok(readOnly.some((t) => t.id === 'fs.read'), 'fs.read disponível');
  assert.ok(!readOnly.some((t) => t.id === 'fs.write'), 'fs.write negado por permissão');
  assert.ok(readOnly.some((t) => t.id === 'fs.ls'), 'fs.ls disponível (requer fs:read)');
});

test('tools: fs.write + fs.read em ciclo completo', () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const file = path.join(ctx.baseDir, 'sub', 'note.txt');

  const w = registry.execute('fs.write', { file, content: 'olá mundo' }, ctx);
  assert.ok(w.ok, `write ok: ${w.error ?? ''}`);
  assert.ok(fs.existsSync(file), 'arquivo gravado');

  const r = registry.execute('fs.read', { file }, ctx);
  assert.ok(r.ok);
  assert.equal((r.result as { content: string }).content, 'olá mundo');
});

test('tools: execução sem permissão é negada (least privilege)', () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const res = registry.execute(
    'fs.write',
    { file: path.join(ctx.baseDir, 'x.txt'), content: 'x' },
    { baseDir: ctx.baseDir, permissions: ['fs:read'] },
  );
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /permissão negada/);
});

test('tools: path traversal fora da zona permitida é bloqueado', () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const evil = path.join(ctx.baseDir, '..', '..', 'outside.txt');
  const res = registry.execute('fs.write', { file: evil, content: 'x' }, ctx);
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /fora da zona permitida/);
});

test('tools: input inválido é rejeitado antes da execução', () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const res = registry.execute('fs.write', { content: 'sem file' }, ctx);
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /input inválido/);
});

test('tools: tool desconhecida retorna erro estruturado', () => {
  const registry = new ToolRegistry();
  const res = registry.execute('nope', {}, tmpCtx());
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /tool desconhecida/);
});

test('tools: registro de tool externa (MCP-style) com validação própria', () => {
  const registry = new ToolRegistry();
  const tool: ToolDefinition = {
    id: 'custom.upper',
    description: 'Upper case',
    requiredPermission: 'fs:read',
    validateInput: (i) => ((i as { text?: unknown }).text ? [] : ['campo text obrigatório']),
    execute: (input) => ({ upper: (input as { text: string }).text.toUpperCase() }),
  };
  registry.register(tool);

  const ok = registry.execute('custom.upper', { text: 'abc' }, tmpCtx());
  assert.ok(ok.ok);
  assert.equal((ok.result as { upper: string }).upper, 'ABC');

  const bad = registry.execute('custom.upper', {}, tmpCtx());
  assert.ok(!bad.ok);
});
