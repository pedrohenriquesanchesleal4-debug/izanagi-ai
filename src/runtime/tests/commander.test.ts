import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { Commander, classify, decideMode, acceptanceForKind, validateDecomposition } from '../orchestration/commander.js';
import { validateContract, contractOf, isExecutionMode } from '../contracts/task-contract.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';

const repoRoot = path.resolve(process.cwd());

test('commander: tarefa trivial classifica como complexidade baixa e modo direct', () => {
  const c = classify('Converta 10 dólares para reais');
  assert.ok(c.complexity <= 1, `esperava complexidade <= 1, veio ${c.complexity}`);
  assert.equal(decideMode(c).mode, 'direct');
});

test('commander: tarefa de um domínio simples vira assisted, não grafo completo', () => {
  const c = classify('Escreva um teste unitário para a função de soma');
  const mode = decideMode(c).mode;
  assert.ok(mode === 'direct' || mode === 'assisted', `modo inesperado: ${mode}`);
});

test('commander: projeto multi-domínio vira autonomous', () => {
  const c = classify(
    'Construa um SaaS completo de cobrança com frontend em Next.js, API backend, banco Postgres com migrations, auditoria de segurança OWASP e pipeline de deploy',
  );
  assert.ok(c.domains.length >= 3, `esperava 3+ domínios, veio ${c.domains.join(',')}`);
  assert.equal(decideMode(c).mode, 'autonomous');
});

test('commander: override de modo vence a heurística', () => {
  const c = classify('Converta 10 dólares para reais');
  const decided = decideMode(c, 'autonomous');
  assert.equal(decided.mode, 'autonomous');
  assert.match(decided.reason, /forçado/);
});

test('commander: modo direct gera UM nó, sem crítico nem avaliador', () => {
  const plan = new Commander().plan({ objective: 'Converta 10 dólares para reais' });
  assert.equal(plan.mode, 'direct');
  assert.equal(plan.graph.nodes.length, 1);
  assert.equal(plan.contracts.length, 1);
  assert.ok(!plan.graph.nodes.some((n) => n.id === 'critic'), 'direct não deve ter crítico');
});

test('commander: modo orchestrated corta o crítico; autonomous mantém', () => {
  const objective = 'Refatorar a arquitetura de autenticação para Clean Architecture com ADR';
  const orchestrated = new Commander().plan({ objective, mode: 'orchestrated' });
  const autonomous = new Commander().plan({ objective, mode: 'autonomous' });
  assert.ok(!orchestrated.graph.nodes.some((n) => n.id === 'critic'), 'orchestrated não deve manter crítico');
  assert.ok(
    autonomous.graph.nodes.length >= orchestrated.graph.nodes.length,
    'autonomous deve ter pelo menos tantos nós quanto orchestrated',
  );
});

test('commander: todo nó recebe contrato válido anexado', () => {
  const plan = new Commander().plan({ objective: 'Criar uma auditoria de segurança OWASP da API de login' });
  assert.equal(plan.issues.length, 0, `contratos com problema: ${plan.issues.join('; ')}`);
  for (const node of plan.graph.nodes) {
    const contract = contractOf(node);
    assert.ok(contract, `nó "${node.id}" sem contrato anexado`);
    assert.deepEqual(validateContract(contract!), [], `contrato inválido em "${node.id}"`);
    assert.ok(contract!.acceptance.length > 0, `nó "${node.id}" sem critérios de aceite`);
  }
});

test('commander: critérios de aceite derivam do schema real do artefato', () => {
  const criteria = acceptanceForKind('n1', 'security-report');
  const ids = criteria.map((c) => c.id);
  assert.ok(ids.includes('n1:valid'));
  assert.ok(ids.some((id) => id.includes('field:severity')), 'schema security-report exige "severity"');
  assert.ok(ids.some((id) => id.includes('field:remediation')), 'schema security-report exige "remediation"');
  assert.ok(criteria.every((c) => c.kind !== 'deterministic' || c.check), 'todo critério determinístico precisa de check');
});

test('commander: estimativa de custo degrada o modo quando estoura o teto', () => {
  const objective =
    'Construa um SaaS completo de cobrança com frontend Next.js, API backend, banco Postgres com migrations, auditoria de segurança OWASP e pipeline de deploy';
  // 1 USD por 1k tokens: qualquer plano grande estoura um teto de $1.
  const estimateCostUsd = (_role: 'commander' | 'specialist' | 'worker', tokens: number) => tokens / 1000;
  const cheap = new Commander().plan({ objective, estimateCostUsd, maxCostUsd: 1 });
  const free = new Commander().plan({ objective, estimateCostUsd });
  assert.equal(free.mode, 'autonomous');
  assert.ok(cheap.mode !== 'autonomous', `esperava degradação, veio ${cheap.mode}`);
  assert.ok(
    cheap.decisions.some((d) => d.includes('degradando')),
    'a degradação deve ficar registrada nas decisões',
  );
  assert.ok((cheap.estimate.maxCostUsd ?? 0) < (free.estimate.maxCostUsd ?? 0), 'plano degradado deve custar menos');
});

test('commander: modo forçado pelo usuário NÃO degrada por custo', () => {
  const plan = new Commander().plan({
    objective: 'Construa um SaaS completo com frontend, backend, banco e segurança',
    mode: 'autonomous',
    estimateCostUsd: (_r, tokens) => tokens / 1000,
    maxCostUsd: 0.001,
  });
  assert.equal(plan.mode, 'autonomous', 'override explícito não pode ser degradado em silêncio');
});

test('commander: decomposição externa inválida cai no template em vez de executar plano quebrado', () => {
  const plan = new Commander().plan({
    objective: 'Implementar autenticação com JWT no backend e tela de login no frontend',
    mode: 'orchestrated',
    decompose: () => [
      { id: 'a', objective: 'fazer algo' },
      { id: 'b', objective: 'outra coisa', dependencies: ['ghost'] },
    ],
  });
  assert.ok(plan.graph.nodes.length > 0);
  assert.ok(!plan.graph.nodes.some((n) => n.id === 'ghost'), 'nenhum nó fantasma deve entrar no grafo');
  assert.ok(plan.graph.nodes.every((n) => (n.metadata?.decomposed ?? false) === false), 'decomposição inválida deve ser descartada');
});

test('commander: decomposição externa válida é adotada', () => {
  const plan = new Commander().plan({
    objective: 'Implementar autenticação com JWT no backend e tela de login no frontend',
    mode: 'orchestrated',
    decompose: () => [
      { id: 'backend', objective: 'implementar JWT', agent: 'senior-engineer', outputKind: 'raw' },
      { id: 'frontend', objective: 'tela de login', agent: 'senior-engineer', outputKind: 'raw', dependencies: ['backend'] },
    ],
  });
  assert.deepEqual(plan.graph.nodes.map((n) => n.id), ['backend', 'frontend']);
  assert.deepEqual(plan.graph.parallelBatches, [['backend'], ['frontend']]);
});

test('commander: validateDecomposition detecta id duplicado, dependência fantasma e auto-dependência', () => {
  const issues = validateDecomposition([
    { id: 'a', objective: 'x1' },
    { id: 'a', objective: 'x2' },
    { id: 'b', objective: 'x3', dependencies: ['nope', 'b'] },
  ]);
  assert.ok(issues.some((i) => i.includes('duplicado')));
  assert.ok(issues.some((i) => i.includes('nope')));
  assert.ok(issues.some((i) => i.includes('si mesma')));
});

test('commander: capability registry escolhe agente por capacidade, não por nome fixo', () => {
  const registry = new AgentCapabilityRegistry({ baseDir: repoRoot });
  assert.ok(registry.ids().length >= 10, `esperava agentes descobertos em disco, veio ${registry.ids().length}`);
  const best = registry.bestFor('auditoria de segurança OWASP com vulnerabilidades e mitigação');
  assert.ok(best, 'deveria encontrar um agente capaz');
  assert.equal(best!.id, 'security');
});

test('commander: registry respeita o papel pedido (não gasta commander em tarefa de worker)', () => {
  const registry = new AgentCapabilityRegistry({ baseDir: repoRoot });
  const commanders = registry.findCapable('arquitetura de sistema distribuído', { role: 'commander' });
  assert.ok(commanders.length > 0);
  assert.ok(commanders.every((m) => m.agent.role === 'commander'));
});

test('commander: isExecutionMode valida modos aceitos', () => {
  assert.ok(isExecutionMode('autonomous'));
  assert.ok(!isExecutionMode('turbo'));
});
