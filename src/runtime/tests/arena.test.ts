/**
 * Izanagi Arena: as métricas que só uma execução real produz.
 *
 * A regra que estes testes protegem: métrica ausente aparece como ausente.
 * Um relatório que rodou sem execução não pode exibir "verificação 0%" — 0% é
 * uma afirmação sobre o resultado, e não houve resultado.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  aggregateExecution,
  evidenceFromRun,
  formatExecutionSummary,
  measureGroundedness,
  type ExecutionEvidence,
  type RunLikeResult,
} from '../benchmarks/arena.js';
import { BenchmarkRunner } from '../benchmarks/runner.js';
import type { BenchmarkCase } from '../types.js';

function run(overrides: Partial<RunLikeResult> = {}): RunLikeResult {
  return {
    status: 'PASS',
    mode: 'orchestrated',
    healing: [],
    graph: { nodes: [{ id: 'a', status: 'succeeded', attempts: 1 }] },
    verification: [{ nodeId: 'a', result: { status: 'VERIFIED' } }],
    telemetry: { estimatedCostUsd: 0.01 },
    trace: { durationMs: 1200, tokens: { total: 900 } },
    ...overrides,
  };
}

test('arena: taxa de verificação sai das tarefas realmente verificadas', () => {
  const e = evidenceFromRun(
    run({
      verification: [
        { nodeId: 'a', result: { status: 'VERIFIED' } },
        { nodeId: 'b', result: { status: 'UNVERIFIED' } },
        { nodeId: 'c', result: { status: 'FAILED' } },
        { nodeId: 'd', result: { status: 'VERIFIED' } },
      ],
    }),
  );
  assert.equal(e.verificationRate, 0.5);
  assert.equal(e.verifiedTasks, 2);
  assert.equal(e.totalVerifiedTasks, 4);
});

test('arena: recuperação conta o CONSERTO, não a tentativa de consertar', () => {
  const e = evidenceFromRun(
    run({
      // 'a' falhou e terminou bem (curado); 'b' falhou e ficou falho.
      graph: {
        nodes: [
          { id: 'a', status: 'succeeded', attempts: 3 },
          { id: 'b', status: 'failed', attempts: 2 },
          { id: 'c', status: 'succeeded', attempts: 1 },
        ],
      },
      healing: [{ kind: 'retry' }, { kind: 'retry' }, { kind: 'skill_replacement' }, { kind: 'abort' }],
    }),
  );
  assert.equal(e.failures, 2);
  assert.equal(e.recovered, 1);
  assert.equal(e.recoveryRate, 0.5, '4 ações de healing não são 4 recuperações');
  assert.equal(e.retries, 3, 'attempts além da primeira, somadas');
  assert.equal(e.healingActions, 4);
});

test('arena: sem falha e sem verificação, a taxa é ausente e não zero', () => {
  const e = evidenceFromRun(run({ verification: [], graph: { nodes: [{ id: 'a', status: 'succeeded', attempts: 1 }] } }));
  assert.equal(e.verificationRate, null);
  assert.equal(e.recoveryRate, null);
});

test('arena: run sem grafo no trace não quebra a extração', () => {
  const semGrafo = run();
  delete (semGrafo as { graph?: unknown }).graph;
  const e = evidenceFromRun(semGrafo);
  assert.equal(e.failures, 0);
  assert.equal(e.retries, 0);
});

test('arena: o agregado soma totais, não faz média de médias', () => {
  const um: ExecutionEvidence = {
    status: 'PASS',
    verifiedTasks: 9,
    totalVerifiedTasks: 9,
    verificationRate: 1,
    recoveryRate: null,
    failures: 0,
    recovered: 0,
    retries: 0,
    healingActions: 0,
    tokensUsed: 5000,
    costUsd: 0.05,
    durationMs: 3000,
  };
  const outro: ExecutionEvidence = { ...um, verifiedTasks: 0, totalVerifiedTasks: 1, verificationRate: 0, tokensUsed: 100, costUsd: 0.001, durationMs: 100 };

  const agg = aggregateExecution([um, outro])!;
  // Média de médias daria 0.5. A taxa real é 9 de 10.
  assert.equal(agg.verificationRate, 0.9);
  assert.equal(agg.cases, 2);
  assert.equal(agg.tokensUsed, 5100);
  assert.equal(agg.costUsd, 0.051);
});

test('arena: sem evidência nenhuma, o agregado é ausente e o texto diz por quê', () => {
  assert.equal(aggregateExecution([]), null);
  assert.match(formatExecutionSummary(null), /sem execução real/);
  assert.match(formatExecutionSummary(null), /não verificação nem recuperação/);
});

/* ============================ integração com o runner ============================ */

const CASE: BenchmarkCase = {
  id: 'caso-teste',
  domain: 'architecture',
  task: 'projetar um monolito modular',
  requirements: ['camadas isoladas'],
  expectedArtifacts: ['architecture'],
  metrics: ['correctness'],
  validators: [],
  tags: ['teste'],
} as BenchmarkCase;

test('arena: producer com evidência leva as métricas para o relatório salvo', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-arena-'));
  const report = await new BenchmarkRunner().runSuite(
    [CASE],
    () => ({
      output: { architecture: 'decisao arquitetural real' },
      execution: evidenceFromRun(run({ verification: [{ nodeId: 'a', result: { status: 'VERIFIED' } }] })),
    }),
    { baseDir, suite: 'teste' },
  );

  assert.equal(report.results[0].passed, true);
  assert.equal(report.results[0].execution?.verificationRate, 1);
  assert.equal(report.results[0].tokensUsed, 900, 'o token real do run entra no resultado do caso');
  assert.equal(report.execution?.verificationRate, 1);
  assert.equal(report.execution?.cases, 1);

  const salvo = JSON.parse(fs.readFileSync(path.join(baseDir, '.izanagi', 'state', 'benchmarks', `${report.id}.json`), 'utf-8'));
  assert.equal(salvo.execution.verificationRate, 1, 'a evidência precisa sobreviver ao disco, senão não dá para comparar versões');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('arena: producer sem evidência mantém o relatório sem métricas de execução', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-arena-'));
  const report = await new BenchmarkRunner().runSuite(
    [CASE],
    () => ({ architecture: 'decisao arquitetural real' }),
    { baseDir, suite: 'teste' },
  );
  assert.equal(report.results[0].passed, true);
  assert.equal(report.execution, undefined, 'relatório sem execução não pode exibir taxa nenhuma');
  assert.equal(report.results[0].execution, undefined);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ fundamentação ============================ */

test('arena: fundamentação conta REFERÊNCIAS, não artefatos', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-arena-ground-'));
  fs.mkdirSync(path.join(root, 'src', 'routes'), { recursive: true });

  const evidence = measureGroundedness(
    {
      // Um plano que cita muito e acerta tudo.
      plano: { kind: 'implementation-plan', content: 'Editar src/routes/a.ts, src/routes/b.ts e src/routes/c.ts.' },
      // Uma ADR curta que inventa o layout.
      adr: { kind: 'architecture', content: 'Mover para app/models/user.rb.' },
    },
    root,
  );

  assert.equal(evidence.references, 4);
  assert.equal(evidence.grounded, 3);
  assert.equal(evidence.rate, 0.75, 'média de médias daria 0.5 e esconderia o peso do plano');
  assert.equal(evidence.artifactsWithReferences, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

test('arena: artefato sem caminho citado não entra na conta (não é fundamentação zero)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-arena-none-'));
  const evidence = measureGroundedness({ adr: { kind: 'architecture', content: 'Adotar CQRS.' } }, root);
  assert.equal(evidence.references, 0);
  assert.equal(evidence.rate, null, 'zero significaria "errou tudo"; null significa "não há o que medir"');
  assert.equal(evidence.artifactsWithReferences, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('arena: sem workspace declarado a fundamentação nem é medida', () => {
  const evidence = evidenceFromRun({
    status: 'PASS',
    healing: [],
    trace: { durationMs: 10, tokens: { total: 100 } },
    artifacts: { a: { kind: 'raw', content: 'src/x.ts' } },
  });
  assert.equal(evidence.groundedness, undefined, 'medir contra raiz nenhuma produziria um número sem significado');
});

test('arena: o resumo diz "n/a" quando não houve referência, nunca 0%', () => {
  const semReferencia = aggregateExecution([
    {
      status: 'PASS',
      verifiedTasks: 2,
      totalVerifiedTasks: 2,
      verificationRate: 1,
      recoveryRate: null,
      failures: 0,
      recovered: 0,
      retries: 0,
      healingActions: 0,
      tokensUsed: 100,
      costUsd: 0,
      durationMs: 10,
      groundedness: { references: 0, grounded: 0, rate: null, artifactsWithReferences: 0 },
    },
  ]);
  assert.equal(semReferencia?.groundedness, null);
  assert.match(formatExecutionSummary(semReferencia), /fundamentação n\/a/);
});

test('arena: fundamentação agregada soma sobre os TOTAIS de vários casos', () => {
  const base = {
    status: 'PASS',
    verifiedTasks: 1,
    totalVerifiedTasks: 1,
    verificationRate: 1,
    recoveryRate: null,
    failures: 0,
    recovered: 0,
    retries: 0,
    healingActions: 0,
    tokensUsed: 10,
    costUsd: 0,
    durationMs: 1,
  };
  const summary = aggregateExecution([
    { ...base, groundedness: { references: 10, grounded: 9, rate: 0.9, artifactsWithReferences: 1 } },
    { ...base, groundedness: { references: 2, grounded: 0, rate: 0, artifactsWithReferences: 1 } },
  ]);
  assert.equal(summary?.groundedness?.references, 12);
  assert.equal(summary?.groundedness?.grounded, 9);
  assert.equal(summary?.groundedness?.rate, 0.75);
  assert.match(formatExecutionSummary(summary), /fundamentação 75% \(9\/12\)/);
});
