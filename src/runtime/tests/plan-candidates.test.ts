/**
 * Cost-aware planning: comparar ESTRATÉGIAS, não só descer a escada.
 *
 * A estimativa existia e era injetada em produção, mas o único ajuste era
 * degradar o modo quando o custo estourava — e isso é redução de ESCOPO, não
 * uma estratégia equivalente mais barata. Não havia candidatos nem piso de
 * qualidade contra o qual escolher.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { Commander, planQuality } from '../orchestration/commander.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import type { TaskContract } from '../contracts/task-contract.js';

const capabilities = new AgentCapabilityRegistry({ baseDir: path.resolve(process.cwd()) });

function contract(over: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'x',
    objective: 'o',
    role: 'specialist',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 100 },
    verification: { deterministic: [] },
    acceptance: [],
    ...over,
  };
}

test('planQuality: monótona — comprometer-se com MAIS verificação nunca pontua menos', () => {
  const base = [contract()];
  const q0 = planQuality(base);

  const estrito = [contract({ verification: { deterministic: [], requireAllCriteria: true } })];
  assert.ok(planQuality(estrito) > q0, 'política estrita precisa somar');

  const revisado = [contract(), contract({ id: 'critic', expectedOutput: { kind: 'critique' } })];
  assert.ok(planQuality(revisado) > q0, 'revisão independente precisa somar');

  const semantico = [contract({ acceptance: [{ id: 'a', description: 'd', kind: 'semantic' }] })];
  assert.ok(planQuality(semantico) > q0, 'critério que schema nenhum responde precisa somar');

  const doUsuario = [
    contract({ acceptance: [{ id: 'user:1', description: 'd', kind: 'deterministic', check: { kind: 'contains', text: 'x' } }] }),
  ];
  assert.ok(planQuality(doUsuario) > q0, 'critério do usuário fala do objetivo, e precisa somar');
});

test('planQuality: acrescentar tarefa pouco verificada NÃO abaixa a nota', () => {
  // O incentivo perverso que a primeira versão desta métrica tinha: media
  // critérios por tarefa, então um grafo maior pontuava menos e um piso de
  // qualidade empurraria para grafos menores.
  const um = [contract({ verification: { deterministic: [], requireAllCriteria: true } })];
  const dois = [...um, contract({ id: 'extra' })];
  assert.ok(planQuality(dois) >= planQuality(um));
});

test('planQuality: nota é de VERIFICAÇÃO, não de riqueza de schema', () => {
  // Dois contratos com o mesmo compromisso e schemas de riqueza diferente
  // pontuam igual: contagem de critérios de schema é propriedade do tipo de
  // saída, não do rigor do plano.
  const raw = [contract({ expectedOutput: { kind: 'raw' }, verification: { deterministic: [], requireAllCriteria: true } })];
  const rico = [
    contract({ expectedOutput: { kind: 'security-report' }, verification: { deterministic: [], requireAllCriteria: true } }),
  ];
  assert.equal(planQuality(raw), planQuality(rico));
});

test('commander: sem piso, o plano é o de sempre e não há candidatos', () => {
  const plan = new Commander().plan({ objective: 'auditar a segurança da API', capabilities });
  assert.equal(plan.candidates, undefined, 'lista de um item daria aparência de deliberação que não houve');
});

test('commander: com piso, escolhe o MAIS BARATO que o atinge e registra a comparação', () => {
  const plan = new Commander().plan({
    objective: 'auditar a segurança da API de pagamentos',
    mode: 'autonomous',
    capabilities,
    minQuality: 0.3,
    // Com o survey ligado, todo nó ganha o critério de fundamentação, que fala
    // do PROJETO e não da forma do artefato: os modos intermediários passam a
    // atingir o piso, e a escolha deixa de ser trivial.
    survey: true,
    estimateCostUsd: (role, tokens) => (role === 'commander' ? 3 : role === 'specialist' ? 1 : 0.1) * tokens * 1e-6,
  });
  assert.ok(plan.candidates && plan.candidates.length === 4, 'os quatro modos até o sugerido viram candidatos');
  const escolhido = plan.candidates!.find((c) => c.verdict.startsWith('escolhido'));
  assert.ok(escolhido, 'algum candidato precisa ser o escolhido');
  assert.equal(plan.mode, escolhido!.mode);
  assert.ok(escolhido!.estimate.quality >= 0.3);

  // Mais barato entre os elegíveis: nenhum outro que atinja o piso custa menos.
  const custo = (c: (typeof plan.candidates)[number]) => c.estimate.maxCostUsd ?? c.estimate.maxTokens;
  for (const c of plan.candidates!) {
    if (c.estimate.quality >= 0.3) assert.ok(custo(c) >= custo(escolhido!), `${c.mode} atinge o piso e é mais barato`);
  }
  assert.ok(
    plan.decisions.some((d) => d.includes('piso de verificação')),
    'a escolha precisa aparecer nas decisões, que é o que vai para o Decision Journal',
  );
  assert.match(plan.modeReason, /piso de verificação/);
});

test('commander: piso inalcançável não sobe o modo em silêncio, e diz que não cumpriu', () => {
  const plan = new Commander().plan({
    objective: 'converta 10 dólares para reais',
    capabilities,
    minQuality: 0.99,
  });
  assert.equal(plan.mode, 'direct', 'subir o modo para alcançar o piso seria o orçamento decidindo escopo');
  assert.ok(
    plan.decisions.some((d) => d.includes('NÃO alcançado')),
    `o plano precisa declarar que o piso não foi cumprido: ${plan.decisions.join(' | ')}`,
  );
});

test('commander: piso fora de [0,1] é fixado na faixa, não ignorado', () => {
  const plan = new Commander().plan({ objective: 'auditar a segurança da API', mode: 'orchestrated', capabilities, minQuality: 5 });
  assert.ok(plan.candidates, 'a comparação acontece mesmo com piso absurdo');
  assert.ok(plan.decisions.some((d) => d.includes('1')), 'o piso aplicado é 1, não 5');
});
