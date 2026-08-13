import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from '../security/policy.js';

const policy = new PolicyEngine();

test('policy: deploy de produção sempre requer aprovação', () => {
  const d = policy.evaluate({ kind: 'production-deploy', environment: 'production' });
  assert.equal(d.allowed, false);
  assert.equal(d.requiresApproval, true);
  assert.equal(d.ruleId, 'PROD-DEPLOY-001');
});

test('policy: delete de filesystem em dev é permitido, em produção requer aprovação', () => {
  const dev = policy.evaluate({ kind: 'filesystem-delete', environment: 'development' });
  assert.equal(dev.allowed, true);
  const prod = policy.evaluate({ kind: 'filesystem-delete', environment: 'production' });
  assert.equal(prod.allowed, false);
  assert.equal(prod.requiresApproval, true);
});

test('policy: instalação de dependência só requer aprovação em produção', () => {
  const ci = policy.evaluate({ kind: 'dependency-install', environment: 'ci' });
  assert.equal(ci.allowed, true);
  const prod = policy.evaluate({ kind: 'dependency-install', environment: 'production' });
  assert.equal(prod.allowed, false);
});

test('policy: trust tier community não recebe permissões destrutivas por default', () => {
  const write = policy.evaluate({ kind: 'tool', environment: 'development', permission: 'fs:write', trustTier: 'community' });
  assert.equal(write.allowed, false);
  assert.equal(write.ruleId, 'COMMUNITY-DESTRUCTIVE-001');

  const shell = policy.evaluate({ kind: 'tool', environment: 'development', permission: 'shell', trustTier: 'community' });
  assert.equal(shell.allowed, false);

  const read = policy.evaluate({ kind: 'tool', environment: 'development', permission: 'fs:read', trustTier: 'community' });
  assert.equal(read.allowed, true, 'fs:read não é destrutivo — deve permanecer permitido');
});

test('policy: trust tier generated não recebe shell por default, mas builtin recebe', () => {
  const generated = policy.evaluate({ kind: 'tool', environment: 'development', permission: 'shell', trustTier: 'generated' });
  assert.equal(generated.allowed, false);
  assert.equal(generated.ruleId, 'GENERATED-SHELL-001');

  const builtin = policy.evaluate({ kind: 'tool', environment: 'development', permission: 'shell', trustTier: 'builtin' });
  assert.equal(builtin.allowed, true);
});

test('policy: sem regra aplicável, default allow explicado', () => {
  const d = policy.evaluate({ kind: 'network', environment: 'development' });
  assert.equal(d.allowed, true);
  assert.equal(d.ruleId, 'DEFAULT-ALLOW');
});

test('policy: engine aceita regras customizadas (composição, não substituição)', () => {
  const custom = new PolicyEngine([
    {
      id: 'CUSTOM-001',
      applies: (r) => r.kind === 'network' && r.target === 'internal-only.corp',
      decide: () => ({ allowed: false, requiresApproval: false, reason: 'domínio interno bloqueado por política customizada' }),
    },
  ]);
  const blocked = custom.evaluate({ kind: 'network', environment: 'development', target: 'internal-only.corp' });
  assert.equal(blocked.allowed, false);
  const allowed = custom.evaluate({ kind: 'network', environment: 'development', target: 'example.com' });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.ruleId, 'DEFAULT-ALLOW');
});
