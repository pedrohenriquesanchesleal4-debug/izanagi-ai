import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContextResolver, summarizeArtifact, type AvailableArtifact } from '../orchestration/context-resolver.js';
import { parseCritique, isBlocking, worstSeverity, formatCorrection, extractJsonObject, createMessage } from '../protocol/messages.js';
import type { TaskContract } from '../contracts/task-contract.js';

function contract(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'implementation',
    objective: 'implementar o endpoint de login',
    role: 'specialist',
    inputs: ['architecture', 'database-design'],
    constraints: ['zero stubs'],
    expectedOutput: { kind: 'raw' },
    dependencies: ['architecture', 'database-design'],
    priority: 'normal',
    budget: { maxTokens: 4000 },
    verification: { deterministic: [{ kind: 'artifact-valid' }] },
    acceptance: [{ id: 'a', description: 'artefato válido', kind: 'deterministic', check: { kind: 'artifact-valid' } }],
    ...overrides,
  };
}

function artifacts(entries: Array<[string, string]>): Map<string, AvailableArtifact> {
  return new Map(entries.map(([nodeId, content]) => [nodeId, { nodeId, kind: 'raw', content, valid: true, ref: `run1:${nodeId}` }]));
}

test('context: só entram os artefatos declarados como insumo, nunca o run inteiro', () => {
  const resolved = new ContextResolver().resolve(
    contract(),
    artifacts([
      ['architecture', 'decisão arquitetural'],
      ['database-design', 'schema com tabelas'],
      ['unrelated', 'artefato de outro ramo do grafo que NÃO deve vazar'],
    ]),
  );
  assert.deepEqual(resolved.upstream.map((u) => u.nodeId), ['architecture', 'database-design']);
  assert.ok(!new ContextResolver().render(resolved).includes('NÃO deve vazar'));
});

test('context: artefato grande é resumido e a economia é medida', () => {
  const big = 'x'.repeat(20_000);
  const resolved = new ContextResolver({ maxCharsPerArtifact: 500, maxTotalChars: 2000 }).resolve(
    contract({ inputs: ['architecture'], dependencies: ['architecture'] }),
    artifacts([['architecture', big]]),
  );
  assert.equal(resolved.upstream[0].truncated, true);
  assert.ok(resolved.upstreamChars < 1000, `esperava contexto enxuto, veio ${resolved.upstreamChars}`);
  assert.equal(resolved.upstreamCharsFull, 20_000);
  assert.ok(resolved.upstreamChars / resolved.upstreamCharsFull < 0.1, 'compressão deveria ser de pelo menos 10x');
});

test('context: resumo preserva começo e fim do artefato', () => {
  const text = `INICIO-MARCADOR${'m'.repeat(5000)}FIM-MARCADOR`;
  const { summary, truncated } = summarizeArtifact(text, 600);
  assert.equal(truncated, true);
  assert.ok(summary.startsWith('INICIO-MARCADOR'));
  assert.ok(summary.endsWith('FIM-MARCADOR'));
  assert.ok(summary.includes('chars omitidos'));
});

test('context: sem orçamento restante, o artefato vira referência em vez de conteúdo', () => {
  const resolved = new ContextResolver({ maxCharsPerArtifact: 400, maxTotalChars: 420 }).resolve(
    contract(),
    artifacts([['architecture', 'a'.repeat(5000)], ['database-design', 'b'.repeat(5000)]]),
  );
  const second = resolved.upstream[1];
  assert.ok(second.summary.includes('omitido por orçamento'), `segundo insumo deveria virar referência: ${second.summary.slice(0, 60)}`);
  assert.equal(second.ref, 'run1:database-design');
});

test('context: render inclui critérios de aceite e referências de artefato', () => {
  const resolved = new ContextResolver().resolve(contract(), artifacts([['architecture', 'ADR-001 escolhida']]));
  const rendered = new ContextResolver().render(resolved);
  assert.ok(rendered.includes('CRITÉRIOS DE ACEITE'));
  assert.ok(rendered.includes('run1:architecture'));
  assert.ok(rendered.includes('ADR-001 escolhida'));
});

test('protocolo: crítica em JSON cercado por prosa é parseada', () => {
  const critique = parseCritique('Segue minha análise:\n```json\n{"status":"needs_revision","issues":[{"severity":"critical","description":"SQL injection no login","suggestedFix":"usar query parametrizada"}]}\n```\nFim.');
  assert.equal(critique.status, 'needs_revision');
  assert.equal(critique.issues.length, 1);
  assert.equal(critique.issues[0].severity, 'critical');
  assert.equal(isBlocking(critique), true);
});

test('protocolo: crítica sem issues vira approved e não bloqueia', () => {
  const critique = parseCritique('{"issues": []}');
  assert.equal(critique.status, 'approved');
  assert.equal(isBlocking(critique), false);
  assert.equal(worstSeverity(critique), null);
});

test('protocolo: saída não parseável NÃO é tratada como aprovação', () => {
  const critique = parseCritique('achei tudo ótimo, parabéns');
  assert.equal(critique.status, 'needs_revision');
  assert.equal(critique.issues.length, 1);
  assert.match(critique.issues[0].description, /estruturad/);
});

test('protocolo: severidade em português é normalizada', () => {
  const critique = parseCritique('{"issues":[{"severity":"alta","description":"x"},{"severity":"nit","description":"y"}]}');
  assert.deepEqual(critique.issues.map((i) => i.severity), ['high', 'low']);
  assert.equal(worstSeverity(critique), 'high');
});

test('protocolo: correção envia só os bloqueantes, sem histórico', () => {
  const critique = parseCritique(JSON.stringify({
    status: 'needs_revision',
    issues: [
      { severity: 'low', description: 'nome de variável ruim' },
      { severity: 'critical', description: 'senha em texto claro', suggestedFix: 'usar Argon2' },
    ],
  }));
  const correction = formatCorrection(critique);
  assert.ok(correction.includes('senha em texto claro'));
  assert.ok(correction.includes('Argon2'));
  assert.ok(!correction.includes('nome de variável ruim'), 'issue não bloqueante não deve entrar na correção');
});

test('protocolo: extractJsonObject respeita chaves dentro de string', () => {
  const json = extractJsonObject('ruído {"a":"}{ ainda dentro","b":1} cauda');
  assert.equal(json, '{"a":"}{ ainda dentro","b":1}');
});

test('protocolo: mensagem carrega referência de artefato, não o conteúdo', () => {
  const msg = createMessage({ from: 'critic', to: 'implementation', type: 'critique', taskId: 'implementation', artifactRefs: ['run1:implementation'] });
  assert.match(msg.id, /^msg-/);
  assert.deepEqual(msg.artifactRefs, ['run1:implementation']);
  assert.equal(msg.payload, undefined);
});
