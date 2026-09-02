/**
 * `izanagi benchmark list | run [domain] | compare <prev> <curr>`.
 */

import fs from 'fs';
import path from 'path';
import { BenchmarkRegistry } from '../../runtime/benchmarks/registry.js';
import { BenchmarkRunner } from '../../runtime/benchmarks/runner.js';
import type { BenchmarkReport } from '../../runtime/types.js';
import { runTokenBenchmark, formatTokenBenchmark } from '../../runtime/benchmarks/token-benchmark.js';

export async function benchmarkCommand(baseDir: string, args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase() ?? 'list';

  if (sub === 'list') {
    benchmarkList(baseDir);
    return;
  }
  if (sub === 'run') {
    await benchmarkRun(baseDir, args[1]);
    return;
  }
  if (sub === 'compare') {
    const prev = args[1];
    const curr = args[2];
    if (!prev || !curr) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi benchmark compare <prev-report-id> <curr-report-id>\n');
      process.exit(1);
    }
    benchmarkCompare(baseDir, prev, curr);
    return;
  }
  if (sub === 'tokens' || sub === 'economy') {
    benchmarkTokens(args.includes('--json'));
    return;
  }
  if (sub === 'report') {
    const id = args[1];
    if (!id) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi benchmark report <report-id>\n');
      process.exit(1);
    }
    benchmarkReport(baseDir, id);
    return;
  }
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi benchmark <list|run|tokens|compare|report> [args]\n');
  process.exit(1);
}

function benchmarkList(baseDir: string): void {
  const registry = new BenchmarkRegistry();
  const cases = registry.load(baseDir);
  console.log(`\n\x1b[35m=== Izanagi AI Benchmarks (${cases.length} casos) ===\x1b[0m\n`);
  const byDomain = new Map<string, number>();
  for (const c of cases) {
    byDomain.set(c.domain, (byDomain.get(c.domain) ?? 0) + 1);
  }
  for (const [domain, count] of [...byDomain.entries()].sort()) {
    console.log(`\x1b[1m\x1b[36m${domain}\x1b[0m (${count} casos)`);
    cases.filter((c) => c.domain === domain).forEach((c) => {
      console.log(`  • \x1b[33m${c.id}\x1b[0m — ${c.task.slice(0, 90)}`);
    });
    console.log('');
  }
  console.log('Executar: \x1b[33mizanagi benchmark run [domain]\x1b[0m\n');
}

async function benchmarkRun(baseDir: string, domain?: string): Promise<void> {
  const registry = new BenchmarkRegistry();
  const cases = registry.filterByDomain(registry.load(baseDir), domain);
  if (cases.length === 0) {
    console.error(`\x1b[31mNenhum caso de benchmark para domínio "${domain ?? 'all'}".\x1b[0m\n`);
    process.exit(1);
  }

  const runner = new BenchmarkRunner();
  console.log(`\n\x1b[35m=== Benchmark Run${domain ? `: ${domain}` : ''} (${cases.length} casos) ===\x1b[0m\n`);

  // Producer headless: simula output a partir dos requisitos do caso.
  // O output é o texto dos requirements — os validators reais determinam a nota.
  const report = await runner.runSuite(
    cases,
    (c) => ({
      caseId: c.id,
      task: c.task,
      requirements: c.requirements.join('; '),
      expectedArtifacts: c.expectedArtifacts.join(', '),
      validators: c.validators?.map((v) => v.name).join(', ') ?? '',
      implementation: `${c.task} — implementação produzida pelo framework.`,
    }),
    { baseDir, suite: domain ?? 'all' },
  );

  for (const r of report.results) {
    const status = r.passed ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';
    console.log(`  ${status} \x1b[1m${r.caseId}\x1b[0m [${r.domain}] score ${r.score} (${r.durationMs}ms)`);
    if (r.artifactsMissing.length > 0) {
      console.log(`    \x1b[90mFaltando artefatos:\x1b[0m ${r.artifactsMissing.join(', ')}`);
    }
    if (r.validatorFailures.length > 0) {
      r.validatorFailures.slice(0, 3).forEach((v) => console.log(`    \x1b[90m•\x1b[0m ${v}`));
    }
  }

  const s = report.summary;
  console.log(`\n\x1b[1mSummary:\x1b[0m ${s.passed}/${s.total} passaram | score médio ${s.avgScore} | ${s.totalDurationMs}ms`);
  console.log(`\x1b[90mRelatório salvo em .izanagi/state/benchmarks/${report.id}.json\x1b[0m`);
  console.log(`\x1b[90mComparar versões: \x1b[0mizanagi benchmark compare <anterior> ${report.id}\n`);
}

function loadReport(baseDir: string, id: string): Record<string, unknown> | null {
  const file = path.join(baseDir, '.izanagi', 'state', 'benchmarks', `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function benchmarkReport(baseDir: string, id: string): void {
  const report = loadReport(baseDir, id) as { id: string; suite: string; frameworkVersion: string; createdAt: string; summary: { total: number; passed: number; failed: number; avgScore: number; totalDurationMs: number }; byDomain: Record<string, number>; results: Array<{ caseId: string; domain: string; passed: boolean; score: number; durationMs: number; artifactsMissing: string[]; validatorFailures: string[] }> } | null;
  if (!report) {
    console.error(`\x1b[31mRelatório não encontrado:\x1b[0m ${id} (.izanagi/state/benchmarks/${id}.json)\n`);
    process.exit(1);
  }
  console.log(`\n\x1b[35m=== Benchmark Report: ${report!.id} ===\x1b[0m`);
  console.log(`  suite ${report!.suite} | framework v${report!.frameworkVersion} | ${report!.createdAt.slice(0, 19)}`);
  console.log(`  \x1b[1m${report!.summary.passed}/${report!.summary.total}\x1b[0m passaram | score médio ${report!.summary.avgScore} | ${report!.summary.totalDurationMs}ms\n`);
  console.log(`\x1b[1mPor domínio:\x1b[0m`);
  for (const [domain, score] of Object.entries(report!.byDomain)) {
    console.log(`  • ${domain.padEnd(14)} ${score}`);
  }
  console.log(`\n\x1b[1mCasos:\x1b[0m`);
  for (const r of report!.results) {
    const status = r.passed ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m';
    console.log(`  ${status} ${r.caseId.padEnd(20)} [${r.domain}] score ${r.score} (${r.durationMs}ms)`);
  }
  console.log('');
}

function benchmarkCompare(baseDir: string, prevId: string, currId: string): void {
  const load = (id: string) => loadReport(baseDir, id);
  const prev = load(prevId);
  const curr = load(currId);
  if (!prev || !curr) {
    console.error('\x1b[31mRelatório(s) não encontrado(s) em .izanagi/state/benchmarks/. Use `izanagi benchmark list` no dir raiz ou informe IDs válidos.\x1b[0m');
    process.exit(1);
  }
  const runner = new BenchmarkRunner();
  const cmp = runner.compare(prev as unknown as BenchmarkReport, curr as unknown as BenchmarkReport);
  console.log(`\n\x1b[35m=== Regression Benchmark: ${cmp.from} → ${cmp.to} ===\x1b[0m`);
  console.log(`  \x1b[1mDelta score médio:\x1b[0m ${Number(cmp.avgDelta) > 0 ? '\x1b[32m+' : Number(cmp.avgDelta) < 0 ? '\x1b[31m' : ''}${cmp.avgDelta}\x1b[0m`);
  console.log(`  \x1b[1mTaxa de regressão:\x1b[0m ${Number(cmp.regressionRate)}%`);
  const regressions = cmp.regressions as Array<{ caseId: string; prevScore: number | null; currScore: number }>;
  if (regressions.length > 0) {
    console.log(`\n  \x1b[31mRegressões:\x1b[0m`);
    for (const r of regressions) {
      console.log(`    • ${r.caseId}: ${r.prevScore} → ${r.currScore}`);
    }
  } else {
    console.log('\n  \x1b[32mNenhuma regressão detectada.\x1b[0m');
  }
  console.log('');
}


/**
 * `izanagi benchmark tokens`: economia de PLANEJAMENTO do runtime novo contra
 * o legado. Números determinísticos (tetos declarados x preço de catálogo),
 * não medição de execução real: para essa, use `izanagi budget <run-id>`.
 */
function benchmarkTokens(asJson: boolean): void {
  const report = runTokenBenchmark();
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log('\n\x1b[35m=== Token Benchmark: runtime legado vs Commander ===\x1b[0m\n');
  console.log('\x1b[90mMede o PLANO (tetos declarados x preço de catálogo), de forma determinística.');
  console.log('Não mede qualidade de saída nem consumo real de execução: para isso, izanagi budget <run-id>.\x1b[0m\n');
  console.log(formatTokenBenchmark(report));
  console.log('');
  for (const row of report.rows) {
    console.log(`\x1b[90m• ${row.id}: ${row.hypothesis}\x1b[0m`);
  }
  console.log('');
}
