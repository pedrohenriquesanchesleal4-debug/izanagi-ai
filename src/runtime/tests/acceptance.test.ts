/**
 * Critérios de aceite VINDOS DO USUÁRIO.
 *
 * O que estes testes protegem: um critério que a pessoa escreveu ou é cobrado,
 * ou é recusado em voz alta. O caminho do meio (aceitar e não medir) faz o run
 * terminar VERIFIED sem ter verificado o que foi pedido, que é pior que não
 * aceitar critério nenhum.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAcceptance, acceptanceTargets, applyAcceptance } from '../contracts/acceptance.js';
import { Commander } from '../orchestration/commander.js';
import { validateContract, type TaskContract } from '../contracts/task-contract.js';

test('acceptance: prosa vira critério semântico, não um `contains` da frase inteira', () => {
  const { criteria, issues } = parseAcceptance(['o endpoint aceita ?page e ?limit']);
  assert.equal(issues.length, 0);
  assert.equal(criteria.length, 1);
  assert.equal(criteria[0].kind, 'semantic');
  assert.equal(criteria[0].check, undefined, 'critério semântico não carrega check determinístico');
  assert.equal(criteria[0].description, 'o endpoint aceita ?page e ?limit');
});

test('acceptance: prefixo conhecido vira o check determinístico correspondente', () => {
  const { criteria, issues } = parseAcceptance([
    'contains: paginação',
    'not-contains: TODO',
    'matches: limit=\\d+',
    'min-size: 500',
    'file-exists: docs/api.md',
    'json-field: total',
    'references-exist',
  ]);
  assert.deepEqual(issues, []);
  assert.deepEqual(
    criteria.map((c) => c.check?.kind),
    ['contains', 'not-contains', 'matches', 'min-size', 'file-exists', 'json-field', 'references-exist'],
  );
  assert.ok(criteria.every((c) => c.kind === 'deterministic'));
  const size = criteria.find((c) => c.check?.kind === 'min-size');
  assert.equal((size?.check as { bytes: number }).bytes, 500);
});

test('acceptance: entrada malformada é RECUSADA com motivo, nunca aceita pela metade', () => {
  const { criteria, issues } = parseAcceptance([
    'min-size: muitos',
    'matches: [nao-fecha',
    'contains:',
    '   ',
    'references-exist: 7',
  ]);
  assert.equal(criteria.length, 0, 'nenhuma das cinco é cobrável');
  assert.equal(issues.length, 5);
  assert.match(issues[0], /min-size/);
  assert.match(issues[1], /regex inválida/);
  assert.match(issues[2], /sem valor/);
  assert.match(issues[3], /vazio/);
  assert.match(issues[4], /entre 0 e 1/);
});

test('acceptance: ids são posicionais, então dois critérios com o mesmo texto não se calam', () => {
  const { criteria } = parseAcceptance(['contains: auth', 'contains: auth']);
  assert.equal(criteria.length, 2);
  assert.notEqual(criteria[0].id, criteria[1].id);
});

function contract(id: string, over: Partial<TaskContract> = {}): TaskContract {
  return {
    id,
    objective: `objetivo de ${id}`,
    role: 'specialist',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 1000 },
    verification: { deterministic: [{ kind: 'artifact-valid' }] },
    acceptance: [{ id: `${id}:valid`, description: 'válido', kind: 'deterministic', check: { kind: 'artifact-valid' } }],
    ...over,
  };
}

test('acceptance: o alvo é a tarefa TERMINAL de produto, não toda tarefa do grafo', () => {
  const contracts = [
    contract('research'),
    contract('execute', { dependencies: ['research'], inputs: ['research'] }),
    contract('evaluation', { dependencies: ['execute'], expectedOutput: { kind: 'evaluation' } }),
    contract('deliver', {
      dependencies: ['execute'],
      expectedOutput: { kind: 'delivery' },
      tool: { id: 'fs.write', input: {} },
    }),
  ];
  assert.deepEqual(acceptanceTargets(contracts), ['execute']);
});

test('acceptance: sem tarefa terminal distinta, todas as de produto são alvo', () => {
  const contracts = [contract('backend'), contract('frontend')];
  assert.deepEqual(acceptanceTargets(contracts).sort(), ['backend', 'frontend']);
});

test('acceptance: o critério determinístico entra TAMBÉM na lista que a verificação aplica', () => {
  const { criteria } = parseAcceptance(['contains: paginação', 'o endpoint responde 200']);
  const [applied] = applyAcceptance([contract('execute')], criteria);
  assert.equal(applied.acceptance.length, 3, 'o gerado pelo schema continua lá, mais os dois do usuário');
  assert.deepEqual(
    applied.verification.deterministic.map((d) => d.kind),
    ['artifact-valid', 'contains'],
    'só o determinístico entra na verificação; o semântico é do juiz',
  );
  assert.ok(
    applied.constraints.some((c) => c.includes('paginação')),
    'o critério também vira restrição do prompt: cobrar sem ter pedido desperdiça a tentativa',
  );
});

test('acceptance: o Commander leva os critérios do usuário ao contrato, e o contrato continua válido', () => {
  const { criteria } = parseAcceptance(['contains: paginação', 'o endpoint aceita ?page']);
  const plan = new Commander().plan({
    objective: 'adicionar paginação em GET /users',
    mode: 'orchestrated',
    acceptance: criteria,
  });
  const cobrados = plan.contracts.filter((c) => c.acceptance.some((a) => a.id.startsWith('user:')));
  assert.ok(cobrados.length > 0, 'algum contrato precisa carregar os critérios do usuário');
  for (const c of plan.contracts) {
    const issues = validateContract(c);
    assert.deepEqual(issues, [], `contrato ${c.id} inválido: ${issues.join('; ')}`);
  }
  // O grafo carrega o contrato atualizado, não a versão anterior à injeção:
  // um critério que vive só na lista de contratos e não no nó nunca é cobrado.
  for (const alvo of cobrados) {
    const node = plan.graph.nodes.find((n) => n.id === alvo.id);
    const attached = node?.metadata?.contract as TaskContract | undefined;
    assert.ok(
      attached?.acceptance.some((a) => a.id.startsWith('user:')),
      `o nó "${alvo.id}" do grafo precisa carregar o contrato com os critérios do usuário`,
    );
  }
});

test('acceptance: sem critério do usuário, o plano é byte a byte o de antes', () => {
  const base = new Commander().plan({ objective: 'adicionar paginação em GET /users', mode: 'orchestrated' });
  const vazio = new Commander().plan({ objective: 'adicionar paginação em GET /users', mode: 'orchestrated', acceptance: [] });
  assert.deepEqual(
    base.contracts.map((c) => c.acceptance.map((a) => a.id)),
    vazio.contracts.map((c) => c.acceptance.map((a) => a.id)),
  );
});

test('acceptance: critério sem evidência é distinguível de critério reprovado', async () => {
  const { VerificationEngine } = await import('../verification/engine.js');
  const { criteria } = parseAcceptance(['contains: paginação', 'o endpoint aceita ?page e ?limit']);
  const [c] = applyAcceptance([contract('execute')], criteria);
  const result = await new VerificationEngine().verify({
    contract: c,
    // Conteúdo válido e longo, sem a palavra cobrada: o determinístico REPROVA,
    // e o semântico fica sem juiz.
    content: 'Resposta completa sobre listagem de usuários. '.repeat(10),
  });
  assert.equal(result.status, 'FAILED');
  const semantico = result.unmet.find((u) => u.includes('?page'));
  assert.ok(semantico?.endsWith('[sem evidência]'), `semântico sem juiz precisa vir marcado, veio: ${semantico}`);
  assert.ok(
    result.unmet.some((u) => u.includes('paginação') && !u.endsWith('[sem evidência]')),
    'o determinístico reprovado NÃO leva a marca: ele foi medido',
  );
});

test('acceptance: a CLI aceita --acceptance repetido e --allow-tool nas duas formas', async () => {
  const { parseRunArgs } = await import('../../cli/commands/run.js');
  const parsed = parseRunArgs([
    'adicionar paginação',
    '--acceptance',
    'o endpoint aceita ?page',
    '--acceptance=contains: LIMIT',
    '--allow-tool',
    'fs.read',
    '--allow-tool=fs.write,project.survey',
  ]);
  assert.deepEqual(parsed.acceptance, ['o endpoint aceita ?page', 'contains: LIMIT']);
  assert.deepEqual(parsed.allowedTools, ['fs.read', 'fs.write', 'project.survey']);
  assert.equal(parsed.task, 'adicionar paginação');
  // Sem as flags os campos ficam ausentes, não vazios: lista vazia de tools é
  // uma declaração ("nenhuma tool") e não pode nascer de não ter sido passada.
  const limpo = parseRunArgs(['auditar a API']);
  assert.equal(limpo.acceptance, undefined);
  assert.equal(limpo.allowedTools, undefined);
});
