/**
 * Canvas Orchestration — testes do PARSER do JSON Canvas 1.0.
 *
 * Contrato sob teste (src/runtime/canvas/parser.ts + diagnostics.ts):
 *   - estrutura estrita: a raiz precisa ser objeto com `nodes`/`edges` arrays;
 *   - tolerância a campos desconhecidos: azulejo de editores canvas compatíveis
 *     é PRESERVADO intacto (nome do arquivo, cores, campos futuros);
 *   - `parseCanvasFromFile` deriva o nome do workflow do nome do arquivo.
 *
 * Determinístico e sem I/O: apenas strings JSON literais.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasParseError, parseCanvas, parseCanvasFromFile } from '../canvas/parser.js';
import { CAN_CODES, formatDiagnostic, makeDiagnostic, validateResult } from '../canvas/diagnostics.js';

test('parser: canvas mínimo válido não gera diagnóstico', () => {
  const parsed = parseCanvas('{"nodes":[],"edges":[]}');
  assert.equal(parsed.diagnostics.valid, true);
  assert.equal(parsed.diagnostics.diagnostics.length, 0);
  assert.deepEqual(parsed.nodes, []);
  assert.deepEqual(parsed.edges, []);
});

test('parser: campos desconhecidos do editor são preservados no topo do canvas', () => {
  const parsed = parseCanvas('{"nodes":[],"edges":[],"unknown":{"a":1},"custom":"x"}');
  assert.deepEqual(parsed.unknown, { a: 1 });
  assert.equal(parsed.custom, 'x');
});

test('parser: campos desconhecidos de nós e arestas sobrevivem ao parse', () => {
  const parsed = parseCanvas(
    '{"nodes":[{"id":"a","type":"text","x":1,"y":2,"zIndex":7,"obsidian":"meta"}],' +
      '"edges":[{"id":"e1","fromNode":"a","toNode":"a","strokeWidth":3}]}',
  );
  assert.equal(parsed.nodes[0]!.zIndex, 7);
  assert.equal(parsed.nodes[0]!.obsidian, 'meta');
  assert.equal(parsed.edges[0]!.strokeWidth, 3);
});

test('parser: `nodes` ausente gera CAN-101 (ERROR) e assume lista vazia', () => {
  const parsed = parseCanvas('{"edges":[]}');
  assert.equal(parsed.diagnostics.valid, false);
  assert.deepEqual(
    parsed.diagnostics.errors.map((d) => d.code),
    [CAN_CODES.PARSE_JSON],
  );
  assert.match(parsed.diagnostics.errors[0]!.message, /"nodes" ausente ou não é array/);
  assert.deepEqual(parsed.nodes, []);
});

test('parser: `edges` ausente gera CAN-101 (ERROR)', () => {
  const parsed = parseCanvas('{"nodes":[]}');
  assert.deepEqual(
    parsed.diagnostics.errors.map((d) => d.code),
    [CAN_CODES.PARSE_JSON],
  );
  assert.match(parsed.diagnostics.errors[0]!.message, /"edges" ausente ou não é array/);
});

test('parser: `nodes` que não é array é diagnosticado e zerado', () => {
  const parsed = parseCanvas('{"nodes":"nao-e-array","edges":[]}');
  assert.equal(parsed.diagnostics.errors.length, 1);
  assert.deepEqual(parsed.nodes, []);
});

test('parser: JSON sintaticamente inválido lança CanvasParseError', () => {
  assert.throws(
    () => parseCanvas('{i'),
    (err: unknown) => {
      assert.ok(err instanceof CanvasParseError);
      assert.equal((err as Error).name, 'CanvasParseError');
      assert.match((err as Error).message, /JSON inválido/);
      return true;
    },
  );
});

test('parser: raiz que não é objeto (array, null, string) lança CanvasParseError', () => {
  for (const json of ['[]', 'null', '"texto"', '42']) {
    assert.throws(() => parseCanvas(json), /canvas deve ser um objeto JSON/, `raiz inválida aceita: ${json}`);
  }
});

test('parser: parseCanvasFromFile remove as extensões do nome do workflow', () => {
  // COMPORTAMENTO ATUAL (e reportado como defeito): o nome sai do CAMINHO
  // INTEIRO com as extensões removidas, não do basename — quem carrega
  // `canvases/example.canvas` obtém `canvases/example` como nome do workflow.
  assert.equal(parseCanvasFromFile('C:/wf/alpha.canvas', '{"nodes":[],"edges":[]}').name, 'C:/wf/alpha');
  assert.equal(parseCanvasFromFile('beta.json', '{"nodes":[],"edges":[]}').name, 'beta');
  assert.equal(parseCanvasFromFile('gama.canvas.json', '{"nodes":[],"edges":[]}').name, 'gama', 'as duas extensões são removidas');
});

test('parser: parseCanvasFromFile devolve o canvas parseado', () => {
  const { canvas } = parseCanvasFromFile('wf.canvas', '{"nodes":[{"id":"a"}],"edges":[]}');
  assert.equal(canvas.nodes.length, 1);
  assert.equal(canvas.nodes[0]!.id, 'a');
});

test('diagnostics: makeDiagnostic preserva nível, código, mensagem e refId', () => {
  const d = makeDiagnostic('WARNING', 'CAN-107', 'nó órfão', 'a');
  assert.deepEqual(d, { level: 'WARNING', code: 'CAN-107', message: 'nó órfão', refId: 'a' });
});

test('diagnostics: validateResult separa níveis e só ERROR invalida', () => {
  const withError = validateResult([makeDiagnostic('ERROR', 'CAN-101', 'x'), makeDiagnostic('WARNING', 'CAN-107', 'y')]);
  assert.equal(withError.valid, false);
  assert.equal(withError.errors.length, 1);
  assert.equal(withError.warnings.length, 1);
  assert.equal(withError.infos.length, 0);

  const onlyWarnings = validateResult([makeDiagnostic('WARNING', 'CAN-107', 'y'), makeDiagnostic('INFO', 'CAN-301', 'z')]);
  assert.equal(onlyWarnings.valid, true);
  assert.equal(onlyWarnings.errors.length, 0);
  assert.equal(onlyWarnings.infos.length, 1);
  assert.equal(onlyWarnings.diagnostics.length, 2);
});

test('diagnostics: formatDiagnostic pinta o nível e inclui código e refId', () => {
  const linha = formatDiagnostic(makeDiagnostic('ERROR', 'CAN-104', 'agente ausente', 'a'));
  assert.match(linha, /\x1b\[31mERROR\x1b\[0m/);
  assert.match(linha, /CAN-104 \[a\]: agente ausente/);

  const warning = formatDiagnostic(makeDiagnostic('WARNING', 'CAN-107', 'sem entrada'));
  assert.match(warning, /\x1b\[33mWARNING\x1b\[0m/);
  assert.doesNotMatch(warning, /\[a\]/);
});
