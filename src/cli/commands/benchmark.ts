/**
 * `izanagi benchmark list | run [domain] | compare <prev> <curr>`.
 */

import fs from 'fs';
import path from 'path';
import { BenchmarkRegistry, type BenchmarkLoadIssue } from '../../runtime/benchmarks/registry.js';
import { BenchmarkRunner, benchmarkReportsDir } from '../../runtime/benchmarks/runner.js';
import type { BenchmarkCase, BenchmarkReport } from '../../runtime/types.js';
import { runTokenBenchmark, formatTokenBenchmark } from '../../runtime/benchmarks/token-benchmark.js';
import { evidenceFromRun, formatExecutionSummary } from '../../runtime/benchmarks/arena.js';
import {
  measureContextCompression,
  measureMemorySearch,
  syntheticArtifacts,
  writeSyntheticMemory,
} from '../../runtime/benchmarks/memory-benchmark.js';
import { MemoryStore } from '../../runtime/memory/store.js';
import os from 'os';
import { run as runObjective } from '../../sdk.js';

/**
 * @param baseDir  Raiz dos ASSETS do framework (agentes, skills).
 * @param stateDir Raiz do ESTADO deste projeto (`.izanagi/state`). Default:
 *                 `baseDir`. Ver `resolveStateRoot` no installer.
 */
export async function benchmarkCommand(baseDir: string, args: string[], stateDir = baseDir): Promise<void> {
  const sub = args[0]?.toLowerCase() ?? 'list';

  if (sub === 'list') {
    benchmarkList(baseDir);
    return;
  }
  if (sub === 'run') {
    const domain = args.slice(1).find((a) => !a.startsWith('-'));
    await benchmarkRun(
      baseDir,
      domain,
      { execute: args.includes('--execute'), compare: args.includes('--compare') },
      stateDir,
    );
    return;
  }
  if (sub === 'compare') {
    const prev = args[1];
    const curr = args[2];
    if (!prev || !curr) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi benchmark compare <prev-report-id> <curr-report-id>\n');
      process.exit(1);
    }
    benchmarkCompare(stateDir, prev, curr);
    return;
  }
  if (sub === 'memory' || sub === 'context') {
    benchmarkMemory(stateDir, args.includes('--json'));
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
    benchmarkReport(stateDir, id);
    return;
  }
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi benchmark <list|run|tokens|memory|compare|report> [args]\n');
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

async function benchmarkRun(
  baseDir: string,
  domain?: string,
  flags: { execute?: boolean; compare?: boolean } = {},
  stateDir = baseDir,
): Promise<void> {
  const registry = new BenchmarkRegistry();
  const issues: BenchmarkLoadIssue[] = [];
  const cases = registry.filterByDomain(registry.load(baseDir, issues), domain);
  if (cases.length === 0) {
    console.error(`\x1b[31mNenhum caso de benchmark para domínio "${domain ?? 'all'}".\x1b[0m\n`);
    process.exit(1);
  }

  if (flags.compare && !flags.execute) {
    console.error('\x1b[31m--compare exige --execute:\x1b[0m sem execução real os dois lados produzem o MESMO');
    console.error('output derivado do caso, e a comparação sairia empatada por construção.\n');
    process.exit(1);
  }

  const runner = new BenchmarkRunner();
  console.log(`\n\x1b[35m=== Benchmark Run${domain ? `: ${domain}` : ''} (${cases.length} casos)${flags.execute ? ' · execução real' : ''} ===\x1b[0m\n`);

  // Caso recusado na carga aparece. Antes desaparecia num catch vazio, e a
  // suíte rodava menor sem dizer que rodou menor.
  if (issues.length > 0) {
    console.log(`  \x1b[33m${issues.length} caso(s)/arquivo(s) recusado(s) na carga:\x1b[0m`);
    for (const i of issues) {
      console.log(`    \x1b[90m•\x1b[0m ${i.id ? `\x1b[1m${i.id}\x1b[0m ` : ''}${i.reason} \x1b[90m(${i.file})\x1b[0m`);
    }
    console.log('');
  }

  if (!flags.execute) {
    console.log('  \x1b[90mModo output: mede se o artefato esperado apareceu. NÃO mede verificação,');
    console.log('  recuperação nem custo: para isso, use --execute.\x1b[0m\n');
  }

  const withBudget = cases.filter((c) => c.budget).length;
  if (flags.execute) {
    console.log(`  \x1b[90mOrçamento declarado: ${withBudget}/${cases.length} casos. Caso sem teto roda sob a`);
    console.log('  estimativa do plano, e o relatório registra a ausência: dois relatórios só são');
    console.log('  comparáveis nos casos onde o teto foi o mesmo.\x1b[0m\n');
  }

  // Producer sem --execute: deriva o output dos requisitos do caso. Os
  // validators reais determinam a nota, mas nenhum run acontece — por isso o
  // relatório não traz métricas de verificação ou recuperação.
  const outputOnly = (c: (typeof cases)[number]) => ({
    caseId: c.id,
    task: c.task,
    requirements: c.requirements.join('; '),
    expectedArtifacts: c.expectedArtifacts.join(', '),
    validators: c.validators?.map((v) => v.name).join(', ') ?? '',
    implementation: `${c.task} — implementação produzida pelo framework.`,
  });

  // Producer com --execute: roda CADA caso pelo runtime de verdade (o mesmo
  // `izanagi.run()` do SDK) e devolve output + evidência da execução. Sem
  // provider configurado a execução é headless, e isso continua sendo uma
  // execução real do runtime: o grafo roda, a verificação roda, o healing roda.
  // O que não é real ali é o conteúdo dos artefatos, e o relatório diz isso.
  const executed = (opts: { noCommander?: boolean } = {}) => async (c: (typeof cases)[number]) => {
    // O caso declara o teto sob o qual deve ser resolvido, o modo e as tools
    // autorizadas. Antes disto, `--execute` rodava todo caso sem orçamento,
    // sem modo e sem restrição: "budget" e "allowed tools" da base oficial
    // eram observados no relatório e nunca impostos na execução.
    //
    // O teto é o do CASO, não o do dia: sem isso cada execução roda sob a
    // estimativa que o planejador fez naquele momento, e o relatório de hoje
    // não é comparável ao de ontem.
    //
    // Projeto de trabalho por caso, sob a raiz de ESTADO: cada caso escreve num
    // diretório só dele, e nenhum deles escreve no projeto de quem rodou o
    // comando nem na instalação do framework.
    //
    // Sem destino de saída o grafo não tem nó de entrega, nada é gravado, e a
    // checagem de artefato do caso ficava comparando caminhos de arquivo com
    // IDS DE NÓ do run: nenhum caso podia passar, em nenhuma versão, e o
    // `0/N passaram` do relatório era uma propriedade da forma do producer.
    const workDir = path.join(benchmarkReportsDir(stateDir), 'work', c.id);
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(workDir, { recursive: true });
    const result = await runObjective({
      baseDir,
      stateDir,
      workspaceDir: workDir,
      objective: c.task,
      output: '.',
      ...(c.budget ? { budget: c.budget } : {}),
      ...(c.mode ? { mode: c.mode } : {}),
      ...(c.allowedTools ? { allowedTools: c.allowedTools } : {}),
      ...(opts.noCommander ? { noCommander: true } : {}),
    });
    // Onde o run gravou de fato: a raiz da materialização, senão o diretório
    // da entrega. É contra esses arquivos que o caso é medido.
    const receipt = Object.values(result.artifacts).find((a) => a.kind === 'materialization')?.content as
      | { dir?: string }
      | undefined;
    const filesRoot = receipt?.dir ?? (result.deliveredTo ? path.dirname(result.deliveredTo) : workDir);
    return {
      ...(c.budget ? { budgetApplied: c.budget } : {}),
      ...(filesRoot ? { filesRoot } : {}),
      output: {
        ...outputOnly(c),
        ...Object.fromEntries(Object.entries(result.artifacts).map(([id, a]) => [id, a.content])),
      },
      execution: evidenceFromRun({
        status: result.status,
        ...(result.mode ? { mode: result.mode } : {}),
        // Registrado no relatório: verificação e recuperação medem o runtime
        // nos dois casos, mas conteúdo de artefato headless é do simulador.
        headless: result.headless,
        healing: result.healing,
        // O grafo executado vive no trace: o resultado do SDK não o repete.
        ...(result.trace.graph ? { graph: result.trace.graph } : {}),
        ...(result.verification ? { verification: result.verification } : {}),
        ...(result.telemetry ? { telemetry: result.telemetry } : {}),
        trace: result.trace,
        artifacts: result.artifacts,
      // SEM medir fundamentação aqui, de propósito. Os casos do benchmark são
      // tarefas sintéticas ("desenhe a arquitetura de um monólito modular para
      // um SaaS de faturamento") que não falam do projeto onde o comando roda:
      // um artefato correto para o caso citaria `src/modules/billing/` e sairia
      // como não fundamentado em QUALQUER projeto real. O número existiria,
      // pareceria significativo, e mediria a coisa errada.
      //
      // A fundamentação é medida onde a pergunta faz sentido: num `izanagi run`
      // cujo objetivo é sobre o projeto em que ele roda.
      }),
    };
  };

  // --compare: a MESMA suíte pelos dois caminhos de planejamento, com o mesmo
  // teto por caso. Fecha a comparação "runtime antigo x runtime novo" no nível
  // de EXECUÇÃO (`izanagi benchmark tokens` compara PLANO, que é outra coisa) e
  // dá caller a `runBaselines`/`compareBaselines`, que existiam testados e sem
  // ninguém chamando.
  if (flags.compare) {
    await benchmarkCompareRuntimes(runner, cases, executed, { baseDir: stateDir, suite: `${domain ?? 'all'}:compare` }, stateDir);
    return;
  }

  const report = await runner.runSuite(
    cases,
    flags.execute ? executed() : outputOnly,
    {
      baseDir: stateDir,
      suite: `${domain ?? 'all'}${flags.execute ? ':executed' : ''}`,
      // Modo output: o producer deriva o output do próprio caso, então a
      // checagem de artefato é circular e sai da nota, declarada.
      ...(flags.execute ? {} : { unmeasured: ['expectedArtifacts' as const] }),
    },
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
    if (r.unmeasured && r.unmeasured.length > 0) {
      console.log(`    \x1b[90mNão medido neste caminho:\x1b[0m ${r.unmeasured.join(', ')}`);
    }
    if (r.metricsNotMeasured && r.metricsNotMeasured.length > 0) {
      console.log(`    \x1b[90mMétricas pedidas e não medidas:\x1b[0m ${r.metricsNotMeasured.join(', ')}`);
    }
  }

  const s = report.summary;
  console.log(`\n\x1b[1mSummary:\x1b[0m ${s.passed}/${s.total} passaram | score médio ${s.avgScore} | ${s.totalDurationMs}ms`);
  console.log(`\x1b[1mArena:\x1b[0m ${formatExecutionSummary(report.execution ?? null)}`);
  // Um relatório headless e um com provider real ficam indistinguíveis depois
  // de salvos se ninguém disser qual é qual.
  if (report.results.some((r) => r.execution?.headless)) {
    console.log('\x1b[90mExecução headless (sem provider): grafo, verificação e healing são reais; o');
    console.log('CONTEÚDO dos artefatos é simulado, então artefato esperado mede o simulador.\x1b[0m');
  }
  console.log(`\x1b[90mRelatório salvo em ${path.join(benchmarkReportsDir(stateDir), `${report.id}.json`)}\x1b[0m`);
  console.log(`\x1b[90mComparar versões: \x1b[0mizanagi benchmark compare <anterior> ${report.id}\n`);
}

/**
 * `izanagi benchmark run --execute --compare`: a mesma suíte pelos dois
 * caminhos de planejamento, com o mesmo teto por caso.
 *
 * A pergunta que isso responde é a da seção 38 do roadmap ("Old Runtime vs New
 * Runtime") sobre EXECUÇÃO: `izanagi benchmark tokens` compara plano, que é
 * teto declarado, e nunca deve dividir campo com consumo medido.
 *
 * O lado legado é `--no-commander`: planejamento por categoria, sem Commander,
 * que é literalmente o runtime anterior à rearquitetura e continua no código.
 */
async function benchmarkCompareRuntimes(
  runner: BenchmarkRunner,
  cases: BenchmarkCase[],
  executed: (opts?: { noCommander?: boolean }) => (c: BenchmarkCase) => Promise<unknown>,
  opts: { baseDir: string; suite: string },
  stateDir: string,
): Promise<void> {
  const reports = await runner.runBaselines(
    cases,
    { commander: executed(), legado: executed({ noCommander: true }) },
    opts,
  );
  const cmp = runner.compareBaselines(reports);

  console.log('\x1b[1mRanking:\x1b[0m');
  for (const r of cmp.ranking) {
    console.log(`  ${r.baseline.padEnd(10)} score médio ${r.avgScore} | ${r.passed}/${r.total} passaram`);
  }

  console.log('\n\x1b[1mPor caso:\x1b[0m');
  for (const row of cmp.byCase) {
    const scores = cmp.baselines.map((b) => `${b} ${row.scores[b]}`).join(' | ');
    // Empate não elege vencedor, e a linha diz "empate" em vez de omitir.
    console.log(`  ${row.caseId.padEnd(22)} ${scores}  \x1b[90m${row.winner ? `melhor: ${row.winner}` : 'empate'}\x1b[0m`);
  }

  console.log('\n\x1b[1mExecução medida:\x1b[0m');
  for (const b of cmp.baselines) {
    console.log(`  ${b.padEnd(10)} ${formatExecutionSummary(reports[b].execution ?? null)}`);
  }

  const novo = reports.commander.execution ?? null;
  const velho = reports.legado.execution ?? null;
  if (novo && velho) {
    console.log('\n\x1b[1mDelta (commander frente ao legado):\x1b[0m');
    console.log(`  tokens        ${signed(novo.tokensUsed - velho.tokensUsed)} (${velho.tokensUsed} -> ${novo.tokensUsed})`);
    console.log(`  custo         ${signedUsd(novo.costUsd - velho.costUsd)} ($${velho.costUsd.toFixed(4)} -> $${novo.costUsd.toFixed(4)})`);
    console.log(`  retries       ${signed(novo.retries - velho.retries)} (${velho.retries} -> ${novo.retries})`);
    console.log(`  duração       ${signed(novo.durationMs - velho.durationMs)}ms (${velho.durationMs} -> ${novo.durationMs})`);
    // Taxa ausente permanece ausente: sem verificação nos dois lados não existe
    // delta de verificação, e imprimir 0 pontos seria inventar paridade.
    console.log(`  verificação   ${deltaRate(velho.verificationRate, novo.verificationRate)}`);
    console.log(`  recuperação   ${deltaRate(velho.recoveryRate, novo.recoveryRate)}`);
  } else {
    console.log('\n  \x1b[90mSem evidência de execução nos dois lados: nenhum delta calculado.\x1b[0m');
  }

  const dir = benchmarkReportsDir(stateDir);
  console.log(`\n\x1b[90mRelatórios salvos em ${dir}:\x1b[0m`);
  for (const b of cmp.baselines) console.log(`  \x1b[90m${b}: ${reports[b].id}.json\x1b[0m`);
  console.log('');
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function signedUsd(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(n).toFixed(4)}`;
}

/** Delta entre duas taxas em [0,1]. Ausência de qualquer lado sai como `n/a`. */
function deltaRate(before: number | null, after: number | null): string {
  if (before === null || after === null) {
    return `n/a (antes ${before === null ? 'n/a' : `${Math.round(before * 100)}%`}, depois ${after === null ? 'n/a' : `${Math.round(after * 100)}%`})`;
  }
  const pp = Math.round((after - before) * 100);
  return `${pp > 0 ? '+' : ''}${pp}pp (${Math.round(before * 100)}% -> ${Math.round(after * 100)}%)`;
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
    console.error(`\x1b[31mRelatório não encontrado:\x1b[0m ${id} (${path.join(benchmarkReportsDir(baseDir), `${id}.json`)})\n`);
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
    console.error(`\x1b[31mRelatório(s) não encontrado(s) em ${benchmarkReportsDir(baseDir)}. Use \`izanagi benchmark list\` ou informe IDs válidos.\x1b[0m`);
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

/**
 * `izanagi benchmark memory` — os números que faltavam para decidir duas coisas
 * que estavam paradas por falta de medição: trocar a busca de memória por um
 * índice FTS5, e trocar a compressão determinística de contexto por um
 * compressor neural.
 *
 * O comando não decide: ele mede, aplica o limiar declarado no módulo e diz o
 * que o número sustenta. Se a resposta mudar quando o projeto crescer, o
 * comando vai dizer isso sozinho.
 */
function benchmarkMemory(baseDir: string, asJson: boolean): void {
  // Medir sobre memória vazia produz um número sem valor. Sem corpus real, a
  // medição roda sobre um corpus sintético em diretório temporário, e o
  // relatório diz que foi isso que mediu.
  let alvo = baseDir;
  let corpus = 'memória real do projeto';
  if (new MemoryStore({ baseDir }).listEntries().length === 0) {
    alvo = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-membench-'));
    const entradas = writeSyntheticMemory(alvo, { entriesPerFile: 60, charsPerEntry: 1200 });
    corpus = `corpus sintético (${entradas} entradas): o projeto ainda não acumulou memória`;
  }
  const memory = new MemoryStore({ baseDir: alvo });
  // Consultas de acerto E de erro: medir só acerto esconde o custo do caminho
  // em que a varredura vai até o fim sem achar nada, que é o caso comum.
  const queries = [
    'arquitetura', 'decisao', 'erro corrigido', 'skill', 'contexto',
    'termo-que-nao-existe-no-corpus', 'outro-termo-inexistente', 'zzzz',
  ];
  const search = measureMemorySearch(memory, queries);

  const contract = {
    id: 'bench', objective: 'medir compressao', role: 'specialist' as const,
    inputs: [], constraints: [], expectedOutput: { kind: 'raw' }, dependencies: [],
    priority: 'normal' as const, budget: { maxTokens: 4000 },
    verification: { deterministic: [] }, acceptance: [],
  };
  const compression = measureContextCompression(contract, syntheticArtifacts(6, 8000));

  if (alvo !== baseDir) fs.rmSync(alvo, { recursive: true, force: true });

  if (asJson) {
    console.log(JSON.stringify({ corpus, search, compression }, null, 2));
    return;
  }

  console.log('\n\x1b[35m=== Izanagi: memória e compressão de contexto ===\x1b[0m\n');
  console.log('\x1b[1mBusca na memória\x1b[0m');
  console.log(`  corpus: ${corpus}`);
  console.log(`  entradas varridas por consulta: ${search.entriesScanned} (${search.charsScanned} chars)`);
  console.log(`  latência: p50 ${search.p50Ms}ms · p95 ${search.p95Ms}ms · max ${search.maxMs}ms`);
  console.log(`  ${search.hits}/${search.queries} consultas com resultado`);
  console.log(`  \x1b[90m${search.verdict}\x1b[0m\n`);

  console.log('\x1b[1mCompressão de contexto (determinística)\x1b[0m');
  console.log(`  ${compression.artifacts} artefatos · ${compression.fullChars} chars completos -> ${compression.sentChars} enviados`);
  console.log(`  razão ${(compression.ratio * 100).toFixed(1)}% · ${compression.intact} artefato(s) couberam inteiros`);
  console.log(`  \x1b[90m${compression.verdict}\x1b[0m\n`);

  console.log('\x1b[90mO que isto NÃO mede: se o que sobrou na compressão é o que importava.');
  console.log('Isso é qualidade de recuperação, exige gabarito anotado, e é justamente');
  console.log('por isso que a decisão sobre compressão neural continua em aberto.\x1b[0m\n');
}
