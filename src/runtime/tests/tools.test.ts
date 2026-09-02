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

test('tools: fs.write aplica Unicode Hygiene — remove invisíveis e normaliza espaços homóglifos', async () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const file = path.join(ctx.baseDir, 'code.ts');

  // U+200B (zero-width space) no meio de um identificador + U+00A0 (non-breaking space) como separador
  const dirty = `const foo${'\u200B'}bar${'\u00A0'}=${'\u00A0'}1;`;
  await registry.execute('fs.write', { file, content: dirty }, ctx);

  const written = fs.readFileSync(file, 'utf-8');
  assert.equal(written, 'const foobar = 1;');
  assert.ok(!written.includes('\u200B'), 'zero-width space removido');
  assert.ok(!written.includes('\u00A0'), 'non-breaking space normalizado para espaço comum');
});

test('tools: fs.write + fs.read em ciclo completo', async () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const file = path.join(ctx.baseDir, 'sub', 'note.txt');

  const w = await registry.execute('fs.write', { file, content: 'olá mundo' }, ctx);
  assert.ok(w.ok, `write ok: ${w.error ?? ''}`);
  assert.ok(fs.existsSync(file), 'arquivo gravado');

  const r = await registry.execute('fs.read', { file }, ctx);
  assert.ok(r.ok);
  assert.equal((r.result as { content: string }).content, 'olá mundo');
});


test('tools: execução sem permissão é negada (least privilege)', async () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const res = await registry.execute(
    'fs.write',
    { file: path.join(ctx.baseDir, 'x.txt'), content: 'x' },
    { baseDir: ctx.baseDir, permissions: ['fs:read'] },
  );
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /permissão negada/);
});

test('tools: path traversal fora da zona permitida é bloqueado', async () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const evil = path.join(ctx.baseDir, '..', '..', 'outside.txt');
  const res = await registry.execute('fs.write', { file: evil, content: 'x' }, ctx);
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /fora da zona permitida/);
});

test('tools: input inválido é rejeitado antes da execução', async () => {
  const registry = new ToolRegistry();
  const ctx = tmpCtx();
  const res = await registry.execute('fs.write', { content: 'sem file' }, ctx);
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /input inválido/);
});

test('tools: tool desconhecida retorna erro estruturado', async () => {
  const registry = new ToolRegistry();
  const res = await registry.execute('nope', {}, tmpCtx());
  assert.ok(!res.ok);
  assert.match(res.error ?? '', /tool desconhecida/);
});

test('tools: registro de tool externa (MCP-style) com validação própria', async () => {
  const registry = new ToolRegistry();
  const tool: ToolDefinition = {
    id: 'custom.upper',
    description: 'Upper case',
    requiredPermission: 'fs:read',
    validateInput: (i) => ((i as { text?: unknown }).text ? [] : ['campo text obrigatório']),
    execute: (input) => ({ upper: (input as { text: string }).text.toUpperCase() }),
  };
  registry.register(tool);

  const ok = await registry.execute('custom.upper', { text: 'abc' }, tmpCtx());
  assert.ok(ok.ok);
  assert.equal((ok.result as { upper: string }).upper, 'ABC');

  const bad = await registry.execute('custom.upper', {}, tmpCtx());
  assert.ok(!bad.ok);
});

test('tools: Policy Engine nega fs:write para trust tier "community" mesmo com permissão concedida', async () => {
  const registry = new ToolRegistry();
  const ctx = { ...tmpCtx(), trustTier: 'community' as const };
  const file = path.join(ctx.baseDir, 'note.txt');

  const denied = await registry.execute('fs.write', { file, content: 'x' }, ctx);
  assert.ok(!denied.ok);
  assert.match(denied.error ?? '', /policy negou|COMMUNITY-DESTRUCTIVE-001/);
  assert.ok(!fs.existsSync(file), 'nada deve ser escrito quando a policy nega');

  // fs:read não é destrutivo — segue permitido mesmo para community.
  fs.writeFileSync(file, 'seed', 'utf-8');
  const read = await registry.execute('fs.read', { file }, ctx);
  assert.ok(read.ok);
});

test('tools: Policy Engine respeita environment "production" (delete só via aprovação)', async () => {
  const registry = new ToolRegistry();
  const ctx = { ...tmpCtx(), environment: 'production' as const };
  // fs.write não é modelado como filesystem-delete aqui (é o kind 'tool' com
  // permissão fs:write) — a regra de produção que se aplica é a de trust tier,
  // não a de ambiente, então builtin/undefined em produção segue permitido.
  const ok = await registry.execute('fs.write', { file: path.join(ctx.baseDir, 'a.txt'), content: 'x' }, ctx);
  assert.ok(ok.ok);
});
