/**
 * Materialização: o que o agente escreveu vira arquivo de verdade.
 *
 * O Blueprint Engine já definia o contrato — declare a árvore, escreva cada
 * arquivo completo, zero stub — mas só em `--prompt-only`: um texto para a
 * pessoa colar em outra ferramenta. Dentro do runtime, o código entregue pelo
 * agente ia para o content store como texto e morria lá.
 *
 * A fronteira que torna isto defensável, e que estes testes protegem: os
 * arquivos vão para um subdiretório da SAÍDA, nunca por cima do código do
 * projeto; e a escrita é tudo ou nada, porque materialização parcial que se
 * declara concluída é pior que materialização nenhuma.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseFileManifest, validateManifest, MAX_FILES } from '../tools/file-manifest.js';
import { ToolRegistry } from '../tools/registry.js';
import { Commander } from '../orchestration/commander.js';
import {
  MATERIALIZATION_CONSTRAINT,
  MATERIALIZE_NODE_ID,
  DELIVER_NODE_ID,
  materializeRelDir,
} from '../orchestration/delivery.js';
import { Orchestrator } from '../orchestrator.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import { createHeadlessProducer } from '../execute.js';
import { validateArtifact } from '../contracts/artifacts.js';
import type { GraphNode } from '../types.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-mat-'));
}

const MANIFEST = [
  'Segue a implementação.',
  '',
  '### FILE: src/routes/pagination.ts',
  '```ts',
  'export function paginate(page: number) {',
  '  return { page, size: 20 };',
  '}',
  '```',
  '',
  'E o teste:',
  '',
  '### FILE: tests/pagination.test.ts',
  '```ts',
  'import { paginate } from "../src/routes/pagination";',
  'console.log(paginate(1));',
  '```',
].join('\n');

/* ============================ parser ============================ */

test('parser: marcador + cerca viram arquivo, e a prosa entre eles não vira conteúdo', () => {
  const { files, orphanMarkers } = parseFileManifest(MANIFEST);
  assert.deepEqual(files.map((f) => f.path), ['src/routes/pagination.ts', 'tests/pagination.test.ts']);
  assert.match(files[0].content, /export function paginate/);
  assert.equal(files[0].content.includes('Segue a implementação'), false);
  assert.equal(files[0].language, 'ts');
  assert.deepEqual(orphanMarkers, []);
});

test('parser: aceita as variações que o mesmo modelo produz entre respostas', () => {
  const text = [
    '## FILE: a.ts', '```', 'const a = 1', '```',
    '**FILE: b.py**', '```python', 'b = 1', '```',
    '<!-- FILE: c.go -->', '```go', 'package c', '```',
  ].join('\n');
  assert.deepEqual(parseFileManifest(text).files.map((f) => f.path), ['a.ts', 'b.py', 'c.go']);
});

test('parser: marcador sem bloco fechado NÃO engole o resto da resposta', () => {
  const { files, orphanMarkers } = parseFileManifest('### FILE: x.ts\n```ts\nconst x = 1\n\ne aqui o texto continua para sempre');
  assert.deepEqual(files, [], 'gravar a resposta inteira como se fosse o arquivo é pior que não gravar');
  assert.deepEqual(orphanMarkers, ['x.ts']);
});

test('parser: um segundo marcador corta o anterior — bloco pertence ao marcador mais próximo', () => {
  const { files, orphanMarkers } = parseFileManifest('### FILE: a.ts\n### FILE: b.ts\n```ts\nconst b = 1\n```');
  assert.deepEqual(files.map((f) => f.path), ['b.ts']);
  assert.deepEqual(orphanMarkers, ['a.ts']);
});

test('parser: texto sem marcador nenhum não produz arquivo', () => {
  assert.deepEqual(parseFileManifest('Uma ADR sobre CQRS.\n\n```ts\nconst x = 1\n```').files, []);
});

/* ============================ validação ============================ */

function reasons(text: string): string[] {
  return validateManifest(parseFileManifest(text)).rejected.map((r) => r.reason);
}

test('validação: caminho absoluto e escape de diretório são recusados', () => {
  assert.match(reasons('### FILE: /etc/passwd\n```\nx\n```')[0], /absoluto/);
  assert.match(reasons('### FILE: ../../fora.ts\n```\nx\n```')[0], /sai do diretório/);
});

test('validação: arquivo vazio é stub com outro nome', () => {
  assert.match(reasons('### FILE: a.ts\n```\n\n```')[0], /vazio/);
});

test('validação: marca de trabalho não feito recusa o arquivo', () => {
  assert.match(reasons('### FILE: a.ts\n```ts\n// TODO: implementar\nconst a = 1\n```')[0], /trabalho não feito/);
  assert.match(reasons('### FILE: b.ts\n```ts\nfunction f() { /* implement later */ }\n```')[0], /trabalho não feito/);
});

test('validação: caminho declarado duas vezes é recusado (qual dos dois valeria?)', () => {
  const text = '### FILE: a.ts\n```\nprimeiro\n```\n### FILE: a.ts\n```\nsegundo\n```';
  assert.match(reasons(text)[0], /duas vezes/);
});

test('validação: manifesto legítimo passa inteiro', () => {
  const { accepted, rejected } = validateManifest(parseFileManifest(MANIFEST));
  assert.equal(rejected.length, 0);
  assert.deepEqual(accepted.map((f) => f.path), ['src/routes/pagination.ts', 'tests/pagination.test.ts']);
});

test('validação: teto de arquivos é declarado e aplicado', () => {
  const many = Array.from({ length: MAX_FILES + 5 }, (_, i) => `### FILE: f${i}.ts\n\`\`\`\nconst x = ${i}\n\`\`\``).join('\n');
  const { accepted, rejected } = validateManifest(parseFileManifest(many));
  assert.equal(accepted.length, MAX_FILES);
  assert.equal(rejected.length, 5);
  assert.match(rejected[0].reason, /teto de \d+ arquivos/);
});

/* ============================ tool ============================ */

test('tool: escreve os arquivos declarados dentro da zona e devolve o comprovante', async () => {
  const root = tmpDir();
  const out = await new ToolRegistry().execute(
    'project.materialize',
    { dir: 'saida/impl', manifest: MANIFEST },
    { permissions: ['fs:write'], baseDir: root },
  );
  assert.equal(out.ok, true);
  const result = out.result as { candidates: number; written: string[] };
  assert.equal(result.candidates, 2);
  assert.deepEqual(result.written, ['src/routes/pagination.ts', 'tests/pagination.test.ts']);
  assert.match(fs.readFileSync(path.join(root, 'saida/impl/src/routes/pagination.ts'), 'utf-8'), /export function paginate/);
  assert.equal(validateArtifact('materialization', result).valid, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('tool: UM arquivo recusado impede a escrita de TODOS', async () => {
  const root = tmpDir();
  const misto = `${MANIFEST}\n\n### FILE: src/broken.ts\n\`\`\`ts\n// TODO: terminar\n\`\`\``;
  const out = await new ToolRegistry().execute(
    'project.materialize',
    { dir: 'saida', manifest: misto },
    { permissions: ['fs:write'], baseDir: root },
  );
  assert.equal(out.ok, false);
  assert.match(out.error ?? '', /manifesto recusado/);
  assert.equal(fs.existsSync(path.join(root, 'saida')), false, '"6 escritos, 3 recusados" é o relatório que engana');
  fs.rmSync(root, { recursive: true, force: true });
});

test('tool: sem permissão de escrita nada acontece', async () => {
  const root = tmpDir();
  const out = await new ToolRegistry().execute(
    'project.materialize',
    { dir: 'saida', manifest: MANIFEST },
    { permissions: [], baseDir: root },
  );
  assert.equal(out.ok, false);
  assert.match(out.error ?? '', /permissão negada/);
  assert.equal(fs.existsSync(path.join(root, 'saida')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('tool: artefato sem manifesto é resultado legítimo, e diz que não escreveu nada', async () => {
  const root = tmpDir();
  const out = await new ToolRegistry().execute(
    'project.materialize',
    { dir: 'saida', manifest: 'Uma ADR sobre CQRS, sem código.' },
    { permissions: ['fs:write'], baseDir: root },
  );
  assert.equal(out.ok, true);
  const result = out.result as { candidates: number; written: string[] };
  assert.equal(result.candidates, 0);
  assert.deepEqual(result.written, []);
  assert.equal(validateArtifact('materialization', result).valid, true, '"nenhum declarado" precisa ser distinguível de "escreveu"');
  fs.rmSync(root, { recursive: true, force: true });
});

/* ============================ plano ============================ */

test('plano: materialização só entra quando existe artefato que pode carregar código', () => {
  const comCodigo = new Commander().plan({ objective: 'auditar a seguranca da API', mode: 'orchestrated', output: 'docs' });
  assert.ok(comCodigo.graph.nodes.some((n) => n.id === MATERIALIZE_NODE_ID), 'o template de segurança produz "fixes"');

  const semCodigo = new Commander().plan({ objective: 'pesquisar padroes de arquitetura de eventos', mode: 'orchestrated', output: 'docs' });
  const kinds = semCodigo.graph.nodes.map((n) => n.outputs?.[0]);
  assert.equal(
    semCodigo.graph.nodes.some((n) => n.id === MATERIALIZE_NODE_ID),
    false,
    `nenhum artefato de ${kinds.join('/')} carrega código: materializar seria ruído com aparência de etapa`,
  );
});

test('plano: o contrato PEDE o formato que o parser reconhece', () => {
  const plan = new Commander().plan({ objective: 'auditar a seguranca da API', mode: 'orchestrated', output: 'docs' });
  const codeNode = plan.contracts.find((c) => c.expectedOutput.kind === 'fixes')!;
  assert.ok(
    codeNode.constraints.includes(MATERIALIZATION_CONSTRAINT),
    'o parser só reconhece o que foi combinado: sem pedir o formato, materializar vira adivinhação',
  );
  const doc = plan.contracts.find((c) => c.expectedOutput.kind === 'security-report')!;
  assert.equal(doc.constraints.includes(MATERIALIZATION_CONSTRAINT), false, 'relatório não é código');
});

test('plano: materializar vem ANTES de entregar, e a entrega depende dele', () => {
  const plan = new Commander().plan({ objective: 'auditar a seguranca da API', mode: 'orchestrated', output: 'docs' });
  const deliver = plan.graph.nodes.find((n) => n.id === DELIVER_NODE_ID)!;
  assert.ok((deliver.dependencies ?? []).includes(MATERIALIZE_NODE_ID));
  const order = plan.graph.order;
  assert.ok(order.indexOf(MATERIALIZE_NODE_ID) < order.indexOf(DELIVER_NODE_ID));
});

/* ============================ execução ============================ */

test('execução: o arquivo do agente aparece no disco, dentro da saída e fora do código do projeto', async () => {
  const workspace = tmpDir();
  fs.mkdirSync(path.join(workspace, 'src'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'src', 'existente.ts'), 'const original = true');

  const objective = 'auditar a seguranca da API';
  const plan = new Commander().plan({ objective, mode: 'orchestrated', output: 'entregas' });
  const headless = createHeadlessProducer(objective);

  const orchestrator = new Orchestrator({
    baseDir: workspace,
    workspaceDir: workspace,
    command: 'test',
    task: objective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode, ctx) => {
      // O nó de código responde no formato do contrato; os outros seguem
      // pela simulação derivada do schema.
      if (node.outputs?.[0] === 'fixes') {
        return { content: `Correções aplicadas.\n\n${MANIFEST}`, kind: 'fixes' };
      }
      return headless(node, ctx);
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: workspace }));
  orchestrator.setStore(new TraceStore({ baseDir: workspace }));
  const result = await orchestrator.run();

  const dir = path.join(workspace, materializeRelDir('entregas', objective));
  assert.equal(fs.existsSync(path.join(dir, 'src/routes/pagination.ts')), true, 'o arquivo do agente precisa existir');
  assert.match(fs.readFileSync(path.join(dir, 'src/routes/pagination.ts'), 'utf-8'), /export function paginate/);

  // A fronteira que torna isto defensável.
  assert.equal(
    fs.readFileSync(path.join(workspace, 'src', 'existente.ts'), 'utf-8'),
    'const original = true',
    'o código do projeto NUNCA é sobrescrito: a materialização vive dentro da saída',
  );
  assert.equal(fs.existsSync(path.join(workspace, 'src', 'routes')), false);

  const verdict = result.verification?.find((v) => v.nodeId === MATERIALIZE_NODE_ID);
  assert.equal(verdict?.result.status, 'VERIFIED');
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('execução: recusa que só o validador de manifesto pega reprova o nó e não deixa arquivo para trás', async () => {
  const workspace = tmpDir();
  const objective = 'auditar a seguranca da API';
  const plan = new Commander().plan({ objective, mode: 'orchestrated', output: 'entregas' });
  const headless = createHeadlessProducer(objective);

  const orchestrator = new Orchestrator({
    baseDir: workspace,
    workspaceDir: workspace,
    command: 'test',
    task: objective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan,
    // Escape de diretório, e NÃO um stub: a marca de trabalho não feito já é
    // recusada pelo schema do artefato lá em cima, e o nó de materialização
    // nem chegaria a ver o manifesto. O caminho que sai da saída passa por
    // toda a validação anterior — é o que só este validador pega.
    produce: (node: GraphNode, ctx) =>
      node.outputs?.[0] === 'fixes'
        ? { content: `${MANIFEST}\n\n### FILE: ../../fora-da-saida.ts\n\`\`\`ts\nexport const fuga = 1\n\`\`\`` , kind: 'fixes' }
        : headless(node, ctx),
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: workspace }));
  orchestrator.setStore(new TraceStore({ baseDir: workspace }));
  const result = await orchestrator.run();

  assert.equal(result.graph.nodes.find((n) => n.id === MATERIALIZE_NODE_ID)?.status, 'failed');
  assert.equal(
    fs.existsSync(path.join(workspace, materializeRelDir('entregas', objective))),
    false,
    'tudo ou nada: o arquivo válido do mesmo manifesto também não é gravado',
  );
  assert.equal(fs.existsSync(path.join(workspace, '..', 'fora-da-saida.ts')), false);
  assert.notEqual(result.status, 'PASS', 'materialização reprovada não pode sair como run bem-sucedido');
  fs.rmSync(workspace, { recursive: true, force: true });
});
