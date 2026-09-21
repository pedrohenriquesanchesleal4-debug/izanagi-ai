/**
 * Canvas Orchestration — testes de VALIDAÇÃO (schema + semântica).
 *
 * Contrato sob teste (src/runtime/canvas/validate.ts):
 *   - ERROR bloqueia execução; WARNING sinaliza risco;
 *   - dependências do runtime (agents/skills/modelos) são injetadas: sem elas
 *     a validação é puramente estrutural, nunca um falso "tudo certo";
 *   - ciclos sem semântica de loop, loops sem teto e webhook inseguro são ERROR.
 *
 * Casos rodam contra conjuntos LOCAIS (determinísticos) e, no fim, contra o
 * registry real do repositório via `loadValidatorDeps`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { findCycles, validateCanvas } from '../canvas/validate.js';
import { CAN_CODES, type Diagnostic, type ValidationResult } from '../canvas/diagnostics.js';
import { loadValidatorDeps } from '../canvas/api.js';
import type { CanvasDefinition, CanvasEdge, CanvasNode, IzanagiNodeKind } from '../canvas/types.js';

const repoRoot = path.resolve(process.cwd());

function node(id: string, izanagi: Record<string, unknown>, base: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    text: id,
    izanagi: izanagi as CanvasNode['izanagi'],
    ...base,
  };
}

function edge(id: string, fromNode: string, toNode: string, izanagi?: Record<string, unknown>): CanvasEdge {
  return { id, fromNode, toNode, ...(izanagi ? { izanagi: izanagi as CanvasEdge['izanagi'] } : {}) };
}

function def(nodes: CanvasNode[], edges: CanvasEdge[] = []): CanvasDefinition {
  return { nodes, edges };
}

const codes = (r: ValidationResult): string[] => r.diagnostics.map((d: Diagnostic) => d.code);
const has = (r: ValidationResult, code: string): boolean => codes(r).includes(code);

test('validate: workflow input → output é válido sem deps do runtime', () => {
  const r = validateCanvas(def([node('a', { kind: 'input' }), node('b', { kind: 'output' })], [edge('e1', 'a', 'b')]));
  assert.equal(r.valid, true);
  assert.equal(r.errors.length, 0);
});

test('validate: nó sem id válido gera CAN-102', () => {
  const weird = { id: '', type: 'text', x: 0, y: 0 } as unknown as CanvasNode;
  const r = validateCanvas(def([weird]));
  assert.ok(has(r, CAN_CODES.INVALID_NODE_TYPE));
  assert.match(r.errors[0]!.message, /nó sem id válido/);
});

test('validate: tipo de nó inválido e x/y ausentes geram CAN-102 (dois erros por nó)', () => {
  const quebrado = { id: 'a', type: 'bogus', izanagi: { kind: 'input' } } as unknown as CanvasNode;
  const r = validateCanvas(def([quebrado]));
  const c102 = r.errors.filter((d) => d.code === CAN_CODES.INVALID_NODE_TYPE);
  assert.equal(c102.length, 2);
  assert.ok(c102.some((d) => /tipo "bogus" inválido/.test(d.message)));
  assert.ok(c102.some((d) => /x\/y são obrigatórios/.test(d.message)));
});

test('validate: izanagi.kind ausente ou desconhecido gera CAN-103', () => {
  const semKind = node('a', {});
  const kindRuim = node('b', { kind: 'inexistente' });
  assert.match(validateCanvas(def([semKind])).errors[0]!.message, /"izanagi.kind" ausente/);
  assert.deepEqual(
    validateCanvas(def([kindRuim])).errors.map((d) => d.code),
    [CAN_CODES.INVALID_KIND],
  );
});

test('validate: agente inexistente no registry gera CAN-104; existente passa', () => {
  const deps = { agents: new Set(['qa']), skills: new Set<string>() };
  const fantasma = validateCanvas(def([node('a', { kind: 'agent', agent: 'fantasma' })]), deps);
  assert.ok(has(fantasma, CAN_CODES.UNKNOWN_AGENT));
  assert.match(fantasma.errors[0]!.message, /agente "fantasma" não existe no registry/);

  const conhecido = validateCanvas(def([node('a', { kind: 'agent', agent: 'qa' })]), deps);
  assert.equal(has(conhecido, CAN_CODES.UNKNOWN_AGENT), false);
});

test('validate: referencia a agente não é checada quando o registry está ausente', () => {
  const r = validateCanvas(def([node('a', { kind: 'agent', agent: 'fantasma' })]));
  assert.equal(has(r, CAN_CODES.UNKNOWN_AGENT), false);
});

test('validate: skill fora do catálogo gera CAN-105 por skill', () => {
  const deps = { agents: new Set<string>(), skills: new Set(['qa']) };
  const r = validateCanvas(def([node('a', { kind: 'agent', skills: ['qa', 'nao-existe', 'outra'] })]), deps);
  const c105 = r.errors.filter((d) => d.code === CAN_CODES.MISSING_SKILL);
  assert.equal(c105.length, 2);
  assert.ok(c105.some((d) => /skill "nao-existe"/.test(d.message)));
});

test('validate: aresta para nó inexistente gera CAN-106 nas duas pontas', () => {
  const r = validateCanvas(def([node('a', { kind: 'input' })], [edge('e1', 'a', 'ghost')]));
  const c106 = r.errors.filter((d) => d.code === CAN_CODES.EDGE_UNKNOWN_NODE);
  assert.equal(c106.length, 1);
  assert.match(c106[0]!.message, /toNode "ghost" não existe/);

  const ambos = validateCanvas(def([], [edge('e1', 'x', 'y')]));
  assert.equal(ambos.errors.filter((d) => d.code === CAN_CODES.EDGE_UNKNOWN_NODE).length, 2);
});

test('validate: aresta sem id válido gera CAN-106 e é ignorada', () => {
  const r = validateCanvas(def([node('a', { kind: 'input' })], [edge('', 'a', 'a')]));
  assert.ok(r.errors.some((d) => d.code === CAN_CODES.EDGE_UNKNOWN_NODE && /sem id válido/.test(d.message)));
});

test('validate: auto-aresta exige loop declarado no nó', () => {
  const semLoop = validateCanvas(def([node('a', { kind: 'agent' })], [edge('e1', 'a', 'a')]));
  assert.ok(has(semLoop, CAN_CODES.CYCLE_NO_LOOP));
  assert.match(semLoop.errors[0]!.message, /auto-aresta exige loop declarado/);

  const comLoop = validateCanvas(
    def([node('a', { kind: 'agent', loop: { maxIterations: 3 } })], [edge('e1', 'a', 'a')]),
  );
  assert.equal(has(comLoop, CAN_CODES.CYCLE_NO_LOOP), false);
});

test('validate: ciclo entre dois nós sem loop é ERROR CAN-109', () => {
  const r = validateCanvas(
    def([node('a', { kind: 'agent' }), node('b', { kind: 'agent' })], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]),
  );
  assert.ok(has(r, CAN_CODES.CYCLE_NO_LOOP));
  assert.match(
    r.errors.find((d) => d.code === CAN_CODES.CYCLE_NO_LOOP)!.message,
    /ciclo detectado .*sem nó com semântica de loop/,
  );
});

test('validate: ciclo que passa por nó com loop é permitido', () => {
  const r = validateCanvas(
    def(
      [node('a', { kind: 'agent' }), node('b', { kind: 'agent', loop: { maxIterations: 2, terminationCondition: "result == 'ok'" } })],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
    ),
  );
  assert.equal(has(r, CAN_CODES.CYCLE_NO_LOOP), false);
  assert.equal(r.valid, true);
});

test('validate: nó sem aresta chegando e não-entrada vira WARNING CAN-107', () => {
  const r = validateCanvas(
    def([node('in', { kind: 'input' }), node('orq', { kind: 'orchestrator' }), node('solto', { kind: 'agent' })], []),
  );
  const c107 = r.warnings.filter((d) => d.code === CAN_CODES.ORPHAN_NODE);
  assert.deepEqual(
    c107.map((d) => d.refId),
    ['solto'],
  );
  assert.equal(r.valid, true, 'órfão é warning, não erro');
});

test('validate: grupo não conta como órfão', () => {
  const r = validateCanvas(def([node('g', { kind: 'group' })]));
  assert.equal(has(r, CAN_CODES.ORPHAN_NODE), false);
});

test('validate: condição inválida de nó e de término de loop gera CAN-202', () => {
  const condNode = validateCanvas(def([node('a', { kind: 'agent', condition: '/invalida' })]));
  assert.ok(has(condNode, CAN_CODES.INVALID_CONDITION));

  const loopCond = validateCanvas(
    def([node('a', { kind: 'agent', loop: { maxIterations: 2, terminationCondition: 'a ===' } })]),
  );
  assert.ok(loopCond.errors.some((d) => d.code === CAN_CODES.INVALID_CONDITION && /término do loop/.test(d.message)));
});

test('validate: loop sem maxIterations → CAN-203; acima de 50 → CAN-204', () => {
  const semTeto = validateCanvas(def([node('a', { kind: 'agent', loop: { maxIterations: 0 } })]));
  assert.ok(semTeto.errors.some((d) => d.code === CAN_CODES.LOOP_NO_TERMINATION));

  const exagerado = validateCanvas(def([node('a', { kind: 'agent', loop: { maxIterations: 51 } })]));
  assert.ok(exagerado.errors.some((d) => d.code === CAN_CODES.LOOP_TOO_MANY));

  const noLimite = validateCanvas(def([node('a', { kind: 'agent', loop: { maxIterations: 50 } })]));
  assert.equal(has(noLimite, CAN_CODES.LOOP_TOO_MANY), false);
  assert.equal(has(noLimite, CAN_CODES.LOOP_NO_TERMINATION), false);
});

test('validate: webhook sem URL http(s) válida gera CAN-205', () => {
  const semUrl = validateCanvas(def([node('w', { kind: 'webhook' })]));
  assert.ok(has(semUrl, CAN_CODES.WEBHOOK_UNSAFE));

  const ftp = validateCanvas(def([node('w', { kind: 'webhook', url: 'ftp://hooks.example.com/x' })]));
  assert.ok(has(ftp, CAN_CODES.WEBHOOK_UNSAFE));

  const relativo = validateCanvas(def([node('w', { kind: 'webhook', url: '/apenas/um/path' })]));
  assert.ok(has(relativo, CAN_CODES.WEBHOOK_UNSAFE));

  const https = validateCanvas(def([node('w', { kind: 'webhook', url: 'https://hooks.example.com/izanagi' })]));
  assert.equal(has(https, CAN_CODES.WEBHOOK_UNSAFE), false);
});

test('validate: condição de aresta — tipo inválido e score sem limiar são CAN-202', () => {
  const tipoRuim = validateCanvas(
    def([node('a', { kind: 'input' }), node('b', { kind: 'output' })], [edge('e1', 'a', 'b', { condition: { type: 'xpto' } })]),
  );
  assert.ok(has(tipoRuim, CAN_CODES.INVALID_CONDITION));

  const scoreSemLimiar = validateCanvas(
    def([node('a', { kind: 'input' }), node('b', { kind: 'output' })], [edge('e1', 'a', 'b', { condition: { type: 'score' } })]),
  );
  assert.ok(has(scoreSemLimiar, CAN_CODES.INVALID_CONDITION));

  const scoreOk = validateCanvas(
    def(
      [node('a', { kind: 'input' }), node('b', { kind: 'output' })],
      [edge('e1', 'a', 'b', { condition: { type: 'score', threshold: 0.8 } })],
    ),
  );
  assert.equal(has(scoreOk, CAN_CODES.INVALID_CONDITION), false);
});

test('validate: expressão inválida em condição custom de aresta gera CAN-202', () => {
  const r = validateCanvas(
    def(
      [node('a', { kind: 'input' }), node('b', { kind: 'output' })],
      [edge('e1', 'a', 'b', { condition: { type: 'custom', expression: 'a ===' } })],
    ),
  );
  assert.ok(has(r, CAN_CODES.INVALID_CONDITION));
  assert.match(r.errors[0]!.message, /expressão inválida/);
});

test('validate: modelo manual incompleto é CAN-110', () => {
  const r = validateCanvas(def([node('a', { kind: 'agent', model: { mode: 'manual', model: 'gpt-4o' } })]));
  assert.ok(has(r, CAN_CODES.INVALID_MODEL));
  assert.match(r.errors[0]!.message, /exige provider e model/);
});

test('validate: modelo manual é conferido contra o catálogo real do ModelRouter', () => {
  const router = loadValidatorDeps(repoRoot).router!;
  const specs = router.catalog();
  assert.ok(specs.length > 0, 'catálogo do ModelRouter não pode estar vazio');

  const premium = specs.find((s) => s.reasoning === 'high') ?? specs[0]!;
  const provider = router.providerOf(premium.id);
  const outroProvider = specs.map((s) => router.providerOf(s.id)).find((p) => p !== provider);
  assert.ok(outroProvider, 'o catálogo precisa ter mais de um provider para este teste');

  const valido = validateCanvas(
    def([node('a', { kind: 'agent', model: { mode: 'manual', provider, model: premium.id } })]),
    { router },
  );
  assert.equal(has(valido, CAN_CODES.INVALID_MODEL), false);

  const inexistente = validateCanvas(
    def([node('a', { kind: 'agent', model: { mode: 'manual', provider, model: 'modelo-que-nao-existe' } })]),
    { router },
  );
  assert.match(inexistente.errors[0]!.message, /não existe no catálogo do ModelRouter/);

  const providerErrado = validateCanvas(
    def([node('a', { kind: 'agent', model: { mode: 'manual', provider: outroProvider!, model: premium.id } })]),
    { router },
  );
  assert.match(providerErrado.errors[0]!.message, /pertence ao provider/);
});

test('validate: reasoning acima do suportado vira WARNING CAN-111 (não bloqueia)', () => {
  const router = loadValidatorDeps(repoRoot).router!;
  const simples = router.catalog().find((s) => s.reasoning === 'low') ?? router.catalog()[0]!;
  const r = validateCanvas(
    def([
      node('a', {
        kind: 'agent',
        model: { mode: 'manual', provider: router.providerOf(simples.id), model: simples.id, reasoning: { effort: 'high' } },
      }),
    ]),
    { router },
  );
  assert.ok(has(r, CAN_CODES.UNSUPPORTED_REASONING));
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((d) => /será degradado em execução/.test(d.message)));
});

test('findCycles: detecta ciclo simples, auto-ciclo e devolve lista vazia em DAG', () => {
  const ids = new Set(['a', 'b', 'c', 'd']);
  const ciclos = findCycles(ids, [
    { fromNode: 'a', toNode: 'b' },
    { fromNode: 'b', toNode: 'a' },
    { fromNode: 'c', toNode: 'c' },
    { fromNode: 'd', toNode: 'd' },
  ]);
  assert.deepEqual(ciclos, [
    ['a', 'b', 'a'],
    ['c', 'c'],
    ['d', 'd'],
  ]);

  assert.deepEqual(
    findCycles(new Set(['a', 'b']), [
      { fromNode: 'a', toNode: 'b' },
    ]),
    [],
  );
});

test('validate: registry real do repositório reprova agente fantasma e aprova agente core', () => {
  const deps = loadValidatorDeps(repoRoot);
  assert.ok((deps.agents?.size ?? 0) > 0, 'registry de agentes vazio');
  assert.equal(deps.skills?.has('qa'), true, 'skill "qa" precisa existir no catálogo');

  const algumAgente = [...(deps.agents ?? [])][0]!;
  const fantasma = validateCanvas(def([node('a', { kind: 'agent', agent: 'agente-que-nao-existe', skills: ['qa'] })]), deps);
  assert.ok(has(fantasma, CAN_CODES.UNKNOWN_AGENT));

  const core = validateCanvas(def([node('a', { kind: 'agent', agent: algumAgente, skills: ['qa'] })]), deps);
  assert.equal(core.errors.length, 0);
});
