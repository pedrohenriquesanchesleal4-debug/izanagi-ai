/**
 * Escolha de agente: o despacho medido contra o catálogo REAL.
 *
 * Motivo deste arquivo: o roteamento de MODELO por papel estava certo e
 * verificado, e o que saía errado era outra pergunta, sem teste nenhum: QUAL
 * agente atende o objetivo. Medido contra os 22 agentes do repositório, 7 de 14
 * objetivos comuns despachavam para o agente errado — `automation-engineer`
 * para "escreva a função validarCPF", `skill-architect` para uma migration
 * Postgres e para uma auditoria OWASP, `adversarial-critic` para "definir a
 * arquitetura".
 *
 * Eram quatro causas independentes, e cada bloco abaixo prende uma:
 *   1. domínio inferido também das skills e chains, o que inflava o alcance de
 *      todo agente até domínio deixar de separar candidato;
 *   2. relevância léxica que satura (um termo longo em comum = ~0.8), então os
 *      empates eram desfeitos por ordem alfabética, e todo erro observado caiu
 *      num agente alfabeticamente inicial;
 *   3. penalidade subtrativa calibrada para a escala antiga, que sobre notas
 *      menores passou a decidir o ranking em vez de desempatá-lo;
 *   4. papel usado como portão: filtrava por papel e aceitava o que sobrasse,
 *      por pior que fosse.
 *
 * A tabela de despacho no fim é o gate: ela quebra se qualquer uma voltar.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import { capabilityCoverage, semanticRelevance } from '../routing/scorer.js';
import { Commander } from '../orchestration/commander.js';

const repoRoot = path.resolve(process.cwd());
const registry = () => new AgentCapabilityRegistry({ baseDir: repoRoot });

/**
 * O mesmo critério do `pickAgent` do Commander: papel é preferência, não
 * portão. Reproduzido aqui para a tabela medir a ESCOLHA e não só o ranking.
 */
function chooseSpecialist(reg: AgentCapabilityRegistry, objective: string): string {
  const inRole = reg.findCapable(objective, { role: 'specialist', limit: 1 })[0];
  const anyRole = reg.findCapable(objective, { limit: 1 })[0];
  if (inRole && anyRole) return inRole.score >= anyRole.score * 0.6 ? inRole.agent.id : anyRole.agent.id;
  return anyRole?.agent.id ?? inRole?.agent.id ?? 'senior-engineer';
}

test('domínio do agente vem do que ele É, não das skills que ele usa no caminho', () => {
  const reg = registry();
  const database = reg.get('database');
  assert.ok(database, 'agente database deveria existir no catálogo');
  // Carrega `security-privacy`, `error-recovery` e `architecture-patterns` na
  // chain, e por causa disso cobria [database, security, debugging, architecture].
  assert.deepEqual(database!.domains, ['database'], `domínios inflados: [${database!.domains.join(',')}]`);

  const security = reg.get('security');
  assert.deepEqual(security!.domains, ['security'], `domínios inflados: [${security!.domains.join(',')}]`);

  // Nenhum agente pode cobrir mais da metade dos domínios: um agente que cobre
  // tudo não informa nada, e era o estado de `automation-engineer` (7 de 11).
  for (const agent of reg.list()) {
    assert.ok(agent.domains.length <= 5, `${agent.id} cobre ${agent.domains.length} domínios`);
  }
});

test('agente transversal declara domínio vazio e para de disputar o domínio que apenas cita', () => {
  const reg = registry();
  // `adversarial-critic` diz caçar "problemas de arquitetura"; isso o fazia
  // cobrir o domínio `architecture` e ganhar de `architect`. Um crítico que
  // menciona arquitetura não é um arquiteto.
  assert.deepEqual(reg.get('adversarial-critic')!.domains, []);
  assert.deepEqual(reg.get('evaluator')!.domains, []);
  assert.deepEqual(reg.get('techlead')!.domains, []);

  // Lista vazia declarada é uma DECLARAÇÃO, não ausência de campo: não pode
  // cair de volta na inferência.
  const inferred = reg.get('animation')!.domains;
  assert.deepEqual(inferred, ['frontend'], 'agente sem `domains` continua inferido');
});

test('capabilityCoverage mede cobertura do objetivo, e não satura como a relevância léxica', () => {
  const objetivo = 'Escreva a função validarCPF em TypeScript';
  const alvoUmTermo = 'typescript';

  // A função antiga devolve ~0.8 para um único termo casado, e era isso que
  // empatava agentes diferentes na mesma nota.
  assert.ok(semanticRelevance(objetivo, alvoUmTermo) > 0.7);

  // A nova mede fração do objetivo coberta: 1 de 3 termos significativos
  // ("escreva" é verbo de embalagem e não conta).
  const cobertura = capabilityCoverage(objetivo, alvoUmTermo);
  assert.ok(cobertura > 0 && cobertura < 0.4, `esperava cobertura parcial, veio ${cobertura}`);
  assert.ok(
    capabilityCoverage(objetivo, 'typescript funcao validarcpf') > cobertura,
    'cobrir mais termos do objetivo tem que valer mais',
  );
});

test('cobertura casa por prefixo e entre idiomas, que é onde os termos decisivos se perdiam', () => {
  // Prefixo: sem isto o agente `database` tirava zero num objetivo sobre
  // migration Postgres, enquanto quem casou o verbo "criar" tirava 0.67.
  assert.ok(capabilityCoverage('migration postgres', 'postgresql migrações') > 0.9);

  // Idioma: a descrição de `architect` está em inglês e o objetivo vem em
  // português. Sem canonizar, o arquiteto não casava "arquitetura".
  assert.ok(capabilityCoverage('arquitetura limpa', 'Clean Architecture, DDD, CQRS') > 0);
  assert.ok(capabilityCoverage('revisar o PR', 'Code Review pedagógico') > 0);
});

test('verbo genérico de pedido não produz relevância, mas volta a valer quando é tudo que existe', () => {
  // "criar" casava com o texto de qualquer agente e dava 0.67 ao
  // `skill-architect` num objetivo de banco de dados.
  assert.equal(capabilityCoverage('criar escrever implementar', 'design de skills e curadoria'), 0);
  // Objetivo só de verbo genérico: aí eles são o único sinal e não podem ser
  // descartados, senão a nota seria 0 para todo mundo.
  assert.ok(capabilityCoverage('criar', 'criar skills novas') > 0);
});

test('penalidade de custo e amplitude desempata, nunca aniquila a evidência', () => {
  const reg = registry();
  // `animation` e `form-engineer` são os dois `high` e cobrem `frontend`: a
  // penalidade se aplica aos dois e nenhum vai a zero.
  const matches = reg.findCapable('landing page com animação de scroll', { limit: 5 });
  assert.ok(matches.length > 0);
  for (const m of matches) {
    assert.ok(m.score > 0, `${m.agent.id} zerado apesar de ter evidência: ${m.reasons.join(', ')}`);
  }
  // E o ranking continua estritamente ordenado, sem bloco de empates em zero.
  assert.deepEqual(
    [...matches].sort((a, b) => b.score - a.score).map((m) => m.agent.id),
    matches.map((m) => m.agent.id),
  );
});

test('sem evidência suficiente o registry não devolve candidato: default explícito vence sorteio', () => {
  const reg = registry();
  // Objetivo fora de qualquer domínio e de qualquer descrição do catálogo.
  const nenhum = reg.findCapable('qwerty zxcvb plughxyzzy');
  assert.deepEqual(nenhum, [], `esperava nenhum candidato, veio ${nenhum.map((m) => m.agent.id).join(',')}`);
  assert.equal(reg.bestFor('qwerty zxcvb plughxyzzy'), null);
});

test('papel é preferência, não portão: candidato do papel muito pior cede ao melhor de todos', () => {
  const reg = registry();
  const objetivo = 'Definir a arquitetura de um SaaS multi-tenant';
  const specialist = reg.findCapable(objetivo, { role: 'specialist', limit: 1 })[0];
  const geral = reg.findCapable(objetivo, { limit: 1 })[0];
  assert.equal(geral.agent.id, 'architect', 'o melhor de todos tem que ser o arquiteto');
  assert.ok(geral.agent.role === 'commander', 'e ele é commander, que é o que o portão descartava');
  assert.ok(
    !specialist || specialist.score < geral.score * 0.6,
    'o specialist tem que estar muito abaixo para o teste medir a cessão de papel',
  );
  assert.equal(chooseSpecialist(reg, objetivo), 'architect');
});

test('o plano do Commander despacha o agente do domínio, não um agente alfabeticamente inicial', () => {
  const plan = new Commander().plan({
    objective: 'Auditar autenticação JWT contra OWASP Top 10',
    mode: 'orchestrated',
    capabilities: registry(),
  });
  const agentes = plan.graph.nodes.filter((n) => n.kind === 'agent').map((n) => n.agent);
  assert.ok(agentes.includes('security'), `nenhum nó de agente ficou com security: [${agentes.join(', ')}]`);
});

/**
 * O gate. Objetivos reais, um por linha, com o agente que tem que atender.
 *
 * A escolha certa aqui não é opinião: cada linha é o dono declarado daquele
 * domínio no catálogo, ou o agente cuja descrição cobre o objetivo inteiro.
 * Antes desta rodada, sete destas linhas apontavam para outro agente.
 */
const DESPACHO: Array<[objetivo: string, esperado: string]> = [
  ['Escreva a função validarCPF em TypeScript', 'senior-engineer'],
  ['projetar um agente novo para revisar contratos', 'agent-architect'],
  ['Corrigir o bug de login que retorna 500 intermitente', 'bug-hunter'],
  ['Criar migration Postgres para a tabela de usuarios', 'database'],
  ['Auditar autenticação JWT contra OWASP Top 10', 'security'],
  ['Escrever testes E2E do checkout com Playwright', 'qa'],
  ['Comparar Stripe e Paddle para cobrança recorrente no Brasil', 'researcher'],
  ['Configurar pipeline CI/CD com Docker e GitHub Actions', 'devops'],
  ['Automatizar a importação de uma planilha de vendas para o banco', 'automation-engineer'],
  ['Definir a arquitetura de um SaaS multi-tenant', 'architect'],
  ['Revisar este PR antes do merge', 'techlead'],
  ['Implementar RAG com embeddings e vector database', 'ai-engineer'],
];

test('tabela de despacho: cada objetivo cai no agente do domínio', () => {
  const reg = registry();
  const errados: string[] = [];
  for (const [objetivo, esperado] of DESPACHO) {
    const escolhido = chooseSpecialist(reg, objetivo);
    if (escolhido !== esperado) errados.push(`"${objetivo}" -> ${escolhido} (esperado ${esperado})`);
  }
  assert.deepEqual(errados, [], `despacho errado em ${errados.length}/${DESPACHO.length}:\n  ${errados.join('\n  ')}`);
});
