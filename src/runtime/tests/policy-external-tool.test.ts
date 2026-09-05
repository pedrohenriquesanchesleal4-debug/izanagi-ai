/**
 * `requiresApproval` deixa de ser um campo que ninguém lê, e o default-allow
 * deixa de valer para tool que o runtime nunca viu.
 *
 * O que estes testes protegem: uma tool registrada em tempo de execução não
 * executa por não haver regra escrita contra ela, e um bloqueio destravável
 * por pessoa não se confunde com um "não" definitivo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ToolRegistry, type ToolDefinition } from '../tools/registry.js';
import { PolicyEngine } from '../security/policy.js';

const externa: ToolDefinition = {
  id: 'plugin.echo',
  description: 'devolve o que recebeu',
  requiredPermission: 'fs:read',
  validateInput: () => [],
  execute: (input) => ({ echo: input }),
};

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-policy-'));
}

test('policy: tool registrada em runtime não passa pelo default-allow', async () => {
  const dir = tmp();
  const registry = new ToolRegistry();
  registry.register(externa);

  const out = await registry.execute('plugin.echo', { x: 1 }, {
    permissions: ['fs:read'],
    baseDir: dir,
    trustTier: 'community',
  });
  assert.equal(out.ok, false, 'sem regra escrita para ela, "não previsto" não pode virar "permitido"');
  assert.equal(out.requiresApproval, true, 'é bloqueio destravável por pessoa, não um "não" definitivo');
  assert.match(out.error ?? '', /EXTERNAL-TOOL-001/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('policy: quem registrou a tool (trust tier builtin) executa', async () => {
  const dir = tmp();
  const registry = new ToolRegistry();
  registry.register(externa);
  const out = await registry.execute('plugin.echo', { x: 1 }, {
    permissions: ['fs:read'],
    baseDir: dir,
    trustTier: 'builtin',
  });
  assert.equal(out.ok, true, 'o dono do processo registrou a tool: é ele mesmo pedindo');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('policy: as builtin continuam passando exatamente como antes', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'conteúdo', 'utf-8');
  const registry = new ToolRegistry();
  for (const tier of ['builtin', 'generated', 'community'] as const) {
    const out = await registry.execute('fs.read', { file: 'a.txt' }, {
      permissions: ['fs:read'],
      baseDir: dir,
      trustTier: tier,
    });
    assert.equal(out.ok, true, `fs.read com fs:read concedido deve seguir passando para "${tier}"`);
    assert.equal(out.requiresApproval, undefined);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('policy: negativa definitiva NÃO se apresenta como destravável', async () => {
  const dir = tmp();
  // `shell` para trust tier community: COMMUNITY-DESTRUCTIVE-001 nega, e não é
  // uma decisão que aprovação humana pontual deveria contornar.
  const out = await registry_execute(dir);
  assert.equal(out.ok, false);
  assert.equal(out.requiresApproval, undefined, 'não pode oferecer izanagi approve para o que a política nega de vez');
  fs.rmSync(dir, { recursive: true, force: true });
});

async function registry_execute(dir: string) {
  return await new ToolRegistry().execute('code.execute', { code: 'console.log(1)' }, {
    permissions: ['shell'],
    baseDir: dir,
    trustTier: 'community',
  });
}

test('policy: substituir uma builtin por register também marca origem', async () => {
  const dir = tmp();
  const registry = new ToolRegistry();
  registry.register({ ...externa, id: 'fs.read' });
  const out = await registry.execute('fs.read', {}, { permissions: ['fs:read'], baseDir: dir, trustTier: 'community' });
  assert.equal(out.requiresApproval, true, 'a substituição é o caso em que a origem mais importa');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('policy: a decisão traz o motivo e a regra que decidiu', () => {
  const decision = new PolicyEngine().evaluate({
    kind: 'tool',
    environment: 'development',
    permission: 'fs:read',
    trustTier: 'community',
    target: 'plugin.echo',
    toolOrigin: 'registered',
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, true);
  assert.equal(decision.ruleId, 'EXTERNAL-TOOL-001');
  assert.match(decision.reason, /plugin\.echo/);
});

test('policy: chamador direto da ToolRegistry, sem tier declarado, continua passando', async () => {
  const dir = tmp();
  const registry = new ToolRegistry();
  registry.register(externa);
  // Dentro de um run o Orchestrator SEMPRE declara o tier. Tier ausente é o
  // chamador em processo, que é o dono dele: pedir aprovação ali seria pedir a
  // decisão a quem já a tomou, num caminho onde não existe quem aprove.
  const out = await registry.execute('plugin.echo', { x: 1 }, { permissions: ['fs:read'], baseDir: dir });
  assert.equal(out.ok, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
