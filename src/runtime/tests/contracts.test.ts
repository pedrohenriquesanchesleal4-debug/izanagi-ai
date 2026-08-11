import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateArtifact, makeArtifact, validateHandoffShape } from '../contracts/artifacts.js';

test('contracts: requirements válido passa', () => {
  const content = JSON.stringify({
    title: 'Sistema de Gestão de Clientes para SaaS de faturamento recorrente com módulos de cobrança e relatórios',
    functional: ['login com autenticação JWT', 'CRUD de clientes com validação de CPF', 'geração de notas fiscais', 'relatório mensal de receita'],
    acceptance: ['Given usuário logado When acessa o dashboard Then vê métricas de receita', 'Given cliente cadastrado When gera nota Then nota é emitida com status 201'],
  });
  const report = validateArtifact('requirements', content);
  assert.equal(report.valid, true);
  assert.ok(report.score > 0.9);
});

test('contracts: requirements com stub falha', () => {
  const content = JSON.stringify({
    title: 'Sistema X',
    functional: ['login'],
    acceptance: ['TODO: implementar critérios'],
  });
  const report = validateArtifact('requirements', content);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((i) => i.toLowerCase().includes('todo')));
});

test('contracts: requirements curto demais falha', () => {
  const report = validateArtifact('requirements', JSON.stringify({ title: 'X', functional: [], acceptance: [] }));
  assert.equal(report.valid, false);
});

test('contracts: database-schema sem PK falha', () => {
  const content = 'model User { name String }\nmodel Post { title String }';
  const report = validateArtifact('database-schema', content);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((i) => i.includes('chave primária')));
});

test('contracts: database-schema com PK e relations passa', () => {
  const content = `// Schema Prisma com relações completas
model User {
  id Int @id @default(autoincrement())
  email String @unique
  name String
  posts Post[]
}
model Post {
  id Int @id @default(autoincrement())
  title String
  content String
  userId Int
  user User @relation(fields: [userId], references: [id])
}
// relations: um usuário possui vários posts`;
  const report = validateArtifact('database-schema', content);
  assert.equal(report.valid, true);
});

test('contracts: api-contract com campos obrigatórios passa', () => {
  const content = JSON.stringify({
    method: 'POST',
    path: '/clients',
    description: 'Cria um novo cliente no sistema de faturamento, validando CPF e dados de contato obrigatórios',
    request: { body: 'zod schema com name, email, cpf, phone', headers: ['Authorization: Bearer JWT'] },
    response: { status: 201, body: 'Cliente criado com id, timestamps e status' },
  });
  assert.equal(validateArtifact('api-contract', content).valid, true);
});

test('contracts: api-contract sem path falha', () => {
  const content = JSON.stringify({ method: 'GET', request: {}, response: {} });
  const report = validateArtifact('api-contract', content);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((i) => i.includes('path')));
});

test('contracts: makeArtifact gera ref com hash, size e issues', () => {
  const ref = makeArtifact('implementation-plan', 'plan.md', 'steps: [x]\nfiles: [y]\nTODO implement later');
  assert.equal(ref.valid, false);
  assert.equal(ref.hash?.length, 12);
  assert.ok((ref.size ?? 0) > 0);
  assert.ok((ref.issues ?? []).length > 0);
});

test('contracts: makeArtifact válido sem issues', () => {
  const ref = makeArtifact('raw', 'nota.md', '# Nota\nConteúdo real e completo da nota de contexto.');
  assert.equal(ref.valid, true);
});

test('contracts: handoff sem reason ou artifacts é inválido', () => {
  assert.ok(validateHandoffShape({ from: 'a', to: 'b', reason: 'x', artifacts: [] }).length > 0);
  assert.ok(validateHandoffShape({ from: 'a', to: 'b', reason: 'schema_required', artifacts: ['schema.md'] }).length === 0);
});
