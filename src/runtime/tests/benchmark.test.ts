import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BenchmarkRegistry } from '../benchmarks/registry.js';
import { BenchmarkRunner } from '../benchmarks/runner.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-bm-'));
}

test('benchmark: registry expõe casos embutidos com contrato completo', () => {
  const reg = new BenchmarkRegistry();
  const cases = reg.load(tmpDir());
  assert.ok(cases.length >= 10);
  const ids = new Set(cases.map((c) => c.id));
  assert.equal(ids.size, cases.length, 'ids devem ser únicos');
  const domains = new Set(cases.map((c) => c.domain));
  assert.ok(domains.size >= 9, `domínios: ${[...domains].join(', ')}`);
  for (const c of cases) {
    assert.ok(c.task && c.requirements.length >= 1 && c.expectedArtifacts.length >= 1 && c.metrics.length >= 1);
  }
});

test('benchmark: filterByDomain funciona', () => {
  const reg = new BenchmarkRegistry();
  const cases = reg.load(tmpDir());
  const sec = reg.filterByDomain(cases, 'security');
  assert.ok(sec.length >= 1);
  assert.ok(sec.every((c) => c.domain === 'security'));
  assert.equal(reg.filterByDomain(cases, 'all').length, cases.length);
});

test('benchmark: runner gera relatório completo com avaliação', async () => {
  const dir = tmpDir();
  const reg = new BenchmarkRegistry();
  const cases = reg.load(dir).slice(0, 3);
  const runner = new BenchmarkRunner();
  const report = await runner.runSuite(
    cases,
    (c) => ({
      text: `Artefato para: ${c.task}. Inclui: ${c.requirements.join(', ')}. Artefatos esperados: ${c.expectedArtifacts.join(', ')}. Com mermaid, OWASP, ADR e testes.`,
      requirements: c.requirements,
      expectedArtifacts: c.expectedArtifacts,
    }),
    { baseDir: dir, suite: 'smoke' },
  );
  assert.equal(report.summary.total, 3);
  assert.equal(report.results.length, 3);
  for (const r of report.results) {
    assert.ok(r.score >= 0 && r.score <= 1);
    assert.ok(r.durationMs >= 0);
  }
  const savedFiles = fs.readdirSync(path.join(dir, '.izanagi', 'state', 'benchmarks'));
  assert.ok(savedFiles.some((f) => f.includes(report.id)));
});

test('benchmark: validators executados sobre texto de output', () => {
  const dir = tmpDir();
  const reg = new BenchmarkRegistry();
  const cases = reg.load(dir).filter((c) => c.id === 'sec-owasp-scan');
  const runner = new BenchmarkRunner();
  const bad = runner.runCase(cases[0], 'relatório TODO sem conteúdo e sem estrutura', { durationMs: 5 });
  assert.equal(bad.passed, false);
  assert.ok(bad.validatorFailures.length > 0);
  const good = runner.runCase(
    cases[0],
    'relatório de segurança com OWASP e severidade alta e remediação docssecurity-report.md completo',
    { durationMs: 5 },
  );
  assert.equal(good.passed, true);
});

test('benchmark: runCase com output de diretório verifica artefatos', () => {
  const dir = tmpDir();
  const out = path.join(dir, 'out');
  fs.mkdirSync(path.join(out, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(out, 'docs', 'security-report.md'), '# relatório OWASP', 'utf-8');
  const reg = new BenchmarkRegistry();
  const cases = reg.load(dir).filter((c) => c.id === 'sec-owasp-scan');
  const runner = new BenchmarkRunner();
  const result = runner.runCase(cases[0], out, { durationMs: 5 });
  assert.deepEqual(result.artifactsFound, ['docs/security-report.md']);
  assert.deepEqual(result.artifactsMissing, []);
  // O arquivo apareceu e o CONTEÚDO dele é medido: cita OWASP e não tem stub,
  // mas não classifica severidade. 3 de 4 critérios. Esta linha esperava 1,
  // porque a nota era só a razão de artefatos e os validators liam o CAMINHO
  // do diretório em vez do relatório escrito nele.
  assert.equal(result.score, 0.75);
  assert.deepEqual(result.validatorFailures, ['has-severity: deve classificar severidade']);
  assert.equal(result.passed, false, 'artefato presente com conteúdo incompleto não é caso aprovado');
});

test('benchmark: validator de output de diretório lê o arquivo, não o caminho', () => {
  const dir = tmpDir();
  const out = path.join(dir, 'out');
  fs.mkdirSync(path.join(out, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(out, 'docs', 'security-report.md'),
    '# Auditoria OWASP\n\nSQL injection: severidade critical. Remediação: prepared statements.',
    'utf-8',
  );
  const reg = new BenchmarkRegistry();
  const cases = reg.load(dir).filter((c) => c.id === 'sec-owasp-scan');
  const result = new BenchmarkRunner().runCase(cases[0], out, { durationMs: 5 });
  assert.deepEqual(result.validatorFailures, []);
  assert.equal(result.score, 1);
  assert.equal(result.passed, true);
});

test('benchmark: compare detecta regressões', async () => {
  const dir = tmpDir();
  const reg = new BenchmarkRegistry();
  const cases = reg.load(dir).slice(0, 2);
  const runner = new BenchmarkRunner();
  const prev = await runner.runSuite(
    cases,
    (c) => Object.fromEntries(c.expectedArtifacts.map((a) => [a, 'conteúdo completo e válido'])),
    { baseDir: dir, suite: 'compare' },
  );
  const curr = await runner.runSuite(
    cases,
    () => ({ text: 'TODO incompleto sem artefatos' }),
    { baseDir: dir, suite: 'compare' },
  );
  const cmp = runner.compare(prev, curr) as { regressionRate: number; regressions: Array<unknown>; avgDelta: number; from: string; to: string };
  assert.ok(cmp.avgDelta < 0, 'score deve cair');
  assert.ok(cmp.regressions.length > 0);
  assert.ok(cmp.regressionRate > 0);
});

test('benchmark: runBaselines roda a mesma suíte contra N producers nomeados', async () => {
  const dir = tmpDir();
  const reg = new BenchmarkRegistry();
  const cases = reg.load(dir).slice(0, 2);
  const runner = new BenchmarkRunner();

  const reports = await runner.runBaselines(
    cases,
    {
      izanagi: (c) => Object.fromEntries(c.expectedArtifacts.map((a) => [a, 'conteúdo completo e válido'])),
      'direct-model': () => ({ text: 'TODO incompleto sem artefatos' }),
    },
    { baseDir: dir, suite: 'baseline-test' },
  );

  assert.deepEqual(Object.keys(reports).sort(), ['direct-model', 'izanagi']);
  assert.ok(reports.izanagi.summary.avgScore > reports['direct-model'].summary.avgScore, 'izanagi deve pontuar melhor que a alternativa incompleta');
});

test('benchmark: compareBaselines rankeia por avgScore e elege vencedor por caso (sem empate falso)', async () => {
  const dir = tmpDir();
  const reg = new BenchmarkRegistry();
  const cases = reg.load(dir).slice(0, 2);
  const runner = new BenchmarkRunner();

  const reports = await runner.runBaselines(
    cases,
    {
      izanagi: (c) => Object.fromEntries(c.expectedArtifacts.map((a) => [a, 'conteúdo completo e válido'])),
      'direct-model': () => ({ text: 'TODO incompleto sem artefatos' }),
      tied: (c) => Object.fromEntries(c.expectedArtifacts.map((a) => [a, 'conteúdo completo e válido'])),
    },
    { baseDir: dir, suite: 'baseline-cmp' },
  );

  const cmp = runner.compareBaselines(reports);
  assert.equal(cmp.ranking[0].avgScore >= cmp.ranking[1].avgScore, true, 'ranking ordenado desc por avgScore');
  assert.equal(cmp.ranking[cmp.ranking.length - 1].baseline, 'direct-model', 'pior baseline por último');
  // izanagi e tied produzem o mesmo output → empate real por caso → sem vencedor forçado
  for (const row of cmp.byCase) {
    if (row.scores.izanagi === row.scores.tied && row.scores.izanagi >= row.scores['direct-model']) {
      assert.equal(row.winner, null, 'empate real entre os melhores não elege vencedor arbitrário');
    }
  }
});
