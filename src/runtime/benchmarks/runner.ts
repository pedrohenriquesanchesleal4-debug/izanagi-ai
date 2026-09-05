/**
 * Benchmark Runner — executa casos de benchmark e gera relatório comparável.
 *
 * Cada caso valida artefatos esperados + métricas de avaliação. O relatório
 * (BenchmarkReport) é salvo em .izanagi/state/benchmarks/ para comparação
 * entre versões (regression benchmarking).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { BenchmarkCase, BenchmarkReport, BenchmarkResult } from '../types.js';
import { EvaluationEngine } from '../evaluation/engine.js';
import { makeArtifact, validateArtifact } from '../contracts/artifacts.js';
import { safeEvaluate } from '../orchestration/safe-eval.js';
import { aggregateExecution, type ExecutionEvidence } from './arena.js';

/**
 * Onde vivem os relatórios de benchmark, para uma raiz de ESTADO.
 *
 * Existe para que a escrita e a mensagem que a anuncia saiam do MESMO cálculo.
 * Antes eram dois: `path.join(...)` aqui e um literal `.izanagi/state/...` na
 * CLI. Num projeto inicializado a raiz de estado é `<projeto>/.agents`, então o
 * literal apontava para um diretório relativo ao `cwd` que podia existir e
 * guardar relatórios antigos.
 */
export function benchmarkReportsDir(stateDir: string): string {
  return path.join(stateDir, '.izanagi', 'state', 'benchmarks');
}

export interface BenchmarkRunOptions {
  baseDir: string;
  suite?: string;
  /**
   * Executa os validators de cada caso (default: o do construtor, `true`).
   *
   * Antes este campo era lido por ninguém: os validators rodavam sempre, e
   * tanto o parametro do construtor quanto este eram decoracao. Desligar agora
   * desliga, e o resultado registra que rodou sem validators, porque um score
   * medido sobre menos critérios não é comparável a um medido sobre todos.
   */
  runValidators?: boolean;
  /**
   * Checagens que ESTE caminho de medição não consegue medir.
   *
   * Existe por causa do modo output: o producer daquele modo deriva o output do
   * próprio caso, então perguntar "o artefato esperado apareceu?" é circular, e
   * a resposta saía sempre "não apareceu nenhum". O comando reportava
   * `0/11 passaram` desde sempre, em toda versão, e o número dizia respeito à
   * forma do producer, não ao framework.
   *
   * Checagem declarada aqui sai da nota e aparece em `BenchmarkResult.unmeasured`.
   */
  unmeasured?: Array<'expectedArtifacts' | 'validators'>;
}

export class BenchmarkRunner {
  /**
   * @param evaluator Preservado por compatibilidade de assinatura. A nota de um
   *   caso é determinística (artefatos esperados + validators) e não passa pela
   *   `EvaluationEngine`: quem usa a engine é `izanagi eval`.
   * @param runValidators Default de `BenchmarkRunOptions.runValidators`.
   */
  constructor(
    private readonly evaluator = new EvaluationEngine(),
    private readonly runValidators = true,
  ) {}

  /**
   * Executa um único caso contra um output produzido.
   * O output pode ser: diretório (verifica arquivos), string, ou objeto.
   */
  runCase(
    c: BenchmarkCase,
    output: unknown,
    opts: {
      durationMs?: number;
      tokensUsed?: number;
      execution?: ExecutionEvidence;
      /** Teto aplicado pela execução real deste caso. */
      budgetApplied?: { maxTokens?: number; maxCostUsd?: number };
      /** Sobrepõe o default do runner para este caso. */
      runValidators?: boolean;
      /**
       * Diretório onde a execução real gravou. Presente, a checagem de
       * artefato é feita contra os ARQUIVOS que existem ali, e não contra as
       * chaves do objeto de output: um run é medido pelo que escreveu.
       */
      filesRoot?: string;
      /** Checagens que este caminho não mede (ver `BenchmarkRunOptions`). */
      unmeasured?: Array<'expectedArtifacts' | 'validators'>;
    } = {},
  ): BenchmarkResult {
    const started = Date.now();
    const artifactsFound: string[] = [];
    const artifactsMissing: string[] = [];
    const validatorFailures: string[] = [];
    const unmeasured = opts.unmeasured ?? [];
    const measuresArtifacts = !unmeasured.includes('expectedArtifacts');

    // Artefatos esperados: arquivos no diretório onde o run gravou (quando a
    // execução informou um), senão no output.
    const filesRoot = opts.filesRoot && fs.existsSync(opts.filesRoot) ? opts.filesRoot : undefined;
    for (const expected of measuresArtifacts ? c.expectedArtifacts : []) {
      if (filesRoot) {
        if (fs.existsSync(path.join(filesRoot, expected))) artifactsFound.push(expected);
        else artifactsMissing.push(expected);
      } else if (isFsPath(output)) {
        const full = path.join(String(output), expected);
        if (fs.existsSync(full)) artifactsFound.push(expected);
        else artifactsMissing.push(expected);
      } else if (typeof output === 'string') {
        // output textual: verifica menção ao artefato
        if (output.toLowerCase().includes(expected.toLowerCase().replace(/[\\/]/g, ''))) {
          artifactsFound.push(expected);
        } else {
          artifactsMissing.push(expected);
        }
      } else {
        const obj = output as Record<string, unknown>;
        if (obj[expected] !== undefined) artifactsFound.push(expected);
        else artifactsMissing.push(expected);
      }
    }

    // Validators (check simples em texto)
    const runValidators = (opts.runValidators ?? this.runValidators) && !unmeasured.includes('validators');
    const validators = runValidators ? (c.validators ?? []) : [];
    // O texto do validator é o CONTEÚDO do que a execução gravou quando existe
    // uma raiz de arquivos. Antes era `String(output)`, que num output de
    // diretório é o caminho: `has-owasp` media se a palavra "owasp" estava no
    // nome da pasta temporária. O validator passava ou reprovava por uma
    // propriedade do diretório de trabalho, nunca pelo relatório escrito nele.
    const text = validatorText(output, filesRoot, artifactsFound);
    for (const v of validators) {
      let pass = true;
      try {
        pass = Boolean(safeEvaluate(v.check, { text }));
      } catch {
        pass = false;
      }
      if (!pass) validatorFailures.push(`${v.name}: ${v.message}`);
    }

    // Score: TODOS os critérios do caso, não só os artefatos.
    //
    // Antes era só a razão de artefatos, e validator não entrava na nota. Um
    // caso cujos arquivos apareceram e cujos validators reprovaram TODOS saía
    // com `score: 1.00, passed: false`, e a média da suíte dizia 1.00 com zero
    // caso aprovado. Pior: `compareBaselines` rankeia por `avgScore`, então o
    // baseline que produziu os nomes de arquivo certos e o conteúdo errado
    // vencia o que acertou o conteúdo e errou um nome.
    const checks = (measuresArtifacts ? c.expectedArtifacts.length : 0) + validators.length;
    const checksPassed = artifactsFound.length + (validators.length - validatorFailures.length);
    // Sem critério não há nota. `0/0` valia 1 aqui, e isso aprovava um caso
    // que não conferiu nada (a carga do registry agora recusa esse caso, e
    // isto é a segunda barreira, para o caso construído em memória).
    const score = checks > 0 ? checksPassed / checks : 0;

    const metrics: Record<string, number> = {};
    // Métrica que este caminho MEDE: a razão de artefatos esperados que
    // apareceram. Ausente quando o caso não espera artefato nenhum, porque
    // `0/0` não é 100% de validade.
    //
    // Antes, toda métrica declarada pelo caso recebia essa mesma razão. O
    // relatório salvo mostrava `correctness`, `security` e `architecture` com o
    // mesmo número, e quem o lesse veria três medidas independentes que
    // concordam onde havia uma medida repetida três vezes. As que exigem julgar
    // conteúdo saem em `metricsNotMeasured`: pedidas, não medidas.
    const measured = new Set<string>();
    if (measuresArtifacts && c.expectedArtifacts.length > 0) {
      metrics.artifactValidity = artifactsFound.length / c.expectedArtifacts.length;
      measured.add('artifactValidity');
    }

    const durationMs = opts.durationMs ?? Date.now() - started;
    if (c.metrics.includes('latency')) {
      metrics.latency = durationMs;
      measured.add('latency');
    }
    const metricsNotMeasured = c.metrics.filter((m) => !measured.has(m));

    const result: BenchmarkResult = {
      caseId: c.id,
      domain: c.domain,
      passed: checks > 0 && artifactsMissing.length === 0 && validatorFailures.length === 0,
      score: Math.round(score * 100) / 100,
      artifactsFound,
      artifactsMissing,
      validatorFailures,
      metrics,
      durationMs,
      tokensUsed: opts.tokensUsed ?? opts.execution?.tokensUsed,
      ...(opts.execution ? { execution: opts.execution } : {}),
      ...(metricsNotMeasured.length > 0 ? { metricsNotMeasured } : {}),
      ...(opts.budgetApplied ? { budgetApplied: opts.budgetApplied } : {}),
      ...(unmeasured.length > 0 ? { unmeasured: [...unmeasured] } : {}),
    };
    return result;
  }

  /**
   * Executa uma suíte (todos os casos de um domínio ou todos) e gera o
   * relatório completo. `producer(case)` deve retornar o output real do caso.
   */
  async runSuite(
    cases: BenchmarkCase[],
    producer: (c: BenchmarkCase) => Promise<unknown> | unknown,
    opts: BenchmarkRunOptions,
  ): Promise<BenchmarkReport> {
    const results: BenchmarkResult[] = [];
    for (const c of cases) {
      try {
        const produced = await producer(c);
        // O producer pode devolver só o output (caminho antigo) ou output +
        // evidência de execução real (Arena). As duas formas coexistem: um
        // relatório pode ter casos com e sem execução.
        const withEvidence = isProducedWithEvidence(produced);
        const output = withEvidence ? produced.output : produced;
        results.push(
          this.runCase(c, output, {
            ...(withEvidence ? { execution: produced.execution } : {}),
            ...(withEvidence && produced.budgetApplied ? { budgetApplied: produced.budgetApplied } : {}),
            ...(withEvidence && produced.filesRoot ? { filesRoot: produced.filesRoot } : {}),
            ...(opts.runValidators !== undefined ? { runValidators: opts.runValidators } : {}),
            ...(opts.unmeasured ? { unmeasured: opts.unmeasured } : {}),
          }),
        );
      } catch (err) {
        results.push({
          caseId: c.id,
          domain: c.domain,
          passed: false,
          score: 0,
          artifactsFound: [],
          artifactsMissing: c.expectedArtifacts,
          validatorFailures: [`producer falhou: ${err instanceof Error ? err.message : String(err)}`],
          metrics: {},
          durationMs: 0,
        });
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    const avgScore = results.length > 0 ? results.reduce((a, r) => a + r.score, 0) / results.length : 0;
    const totalDurationMs = results.reduce((a, r) => a + r.durationMs, 0);

    const byDomain: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.domain] = (counts[r.domain] ?? 0) + 1;
      byDomain[r.domain] = (byDomain[r.domain] ?? 0) + r.score;
    }
    for (const d of Object.keys(byDomain)) {
      byDomain[d] = Math.round((byDomain[d] / (counts[d] ?? 1)) * 100) / 100;
    }

    const executionSummary = aggregateExecution(
      results.map((r) => r.execution).filter((e): e is ExecutionEvidence => Boolean(e)),
    );

    const report: BenchmarkReport = {
      id: `bench-${crypto.randomBytes(3).toString('hex')}`,
      suite: opts.suite ?? 'default',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      frameworkVersion: readFrameworkVersion(opts.baseDir),
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        avgScore: Math.round(avgScore * 100) / 100,
        totalDurationMs,
      },
      byDomain,
      ...(executionSummary ? { execution: executionSummary } : {}),
    };

    const dir = benchmarkReportsDir(opts.baseDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${report.id}.json`), JSON.stringify(report, null, 2), 'utf-8');

    return report;
  }

  /**
   * Baselines — roda a MESMA suíte contra N producers nomeados (ex.: "izanagi"
   * vs "direct-model" vs outro agente) e devolve um relatório completo por
   * producer. Diferente de `compare()` (2 versões do MESMO producer ao longo
   * do tempo), isso responde "o Izanagi realmente melhora o resultado frente
   * à alternativa?" — a pergunta central da Arena (seção 9.2 do roadmap).
   */
  async runBaselines(
    cases: BenchmarkCase[],
    producers: Record<string, (c: BenchmarkCase) => Promise<unknown> | unknown>,
    opts: BenchmarkRunOptions,
  ): Promise<Record<string, BenchmarkReport>> {
    const reports: Record<string, BenchmarkReport> = {};
    for (const [name, producer] of Object.entries(producers)) {
      reports[name] = await this.runSuite(cases, producer, { ...opts, suite: `${opts.suite ?? 'default'}:${name}` });
    }
    return reports;
  }

  /** Compara N baselines lado a lado por caso e por resumo — sem inventar "vencedor" quando os scores empatam. */
  compareBaselines(reports: Record<string, BenchmarkReport>): {
    baselines: string[];
    byCase: Array<{ caseId: string; scores: Record<string, number>; winner: string | null }>;
    ranking: Array<{ baseline: string; avgScore: number; passed: number; total: number }>;
  } {
    const baselines = Object.keys(reports);
    const caseIds = new Set<string>();
    for (const r of Object.values(reports)) for (const res of r.results) caseIds.add(res.caseId);

    const byCase = Array.from(caseIds).map((caseId) => {
      const scores: Record<string, number> = {};
      for (const [name, report] of Object.entries(reports)) {
        const found = report.results.find((r) => r.caseId === caseId);
        scores[name] = found?.score ?? 0;
      }
      const maxScore = Math.max(...Object.values(scores));
      const topBaselines = baselines.filter((b) => scores[b] === maxScore);
      // Empate real (inclusive entre todos) não elege vencedor — não inventa diferença que não existe.
      const winner = topBaselines.length === 1 ? topBaselines[0] : null;
      return { caseId, scores, winner };
    });

    const ranking = baselines
      .map((name) => ({ baseline: name, avgScore: reports[name].summary.avgScore, passed: reports[name].summary.passed, total: reports[name].summary.total }))
      .sort((a, b) => b.avgScore - a.avgScore);

    return { baselines, byCase, ranking };
  }

  /** Compara duas versões de relatório (regression benchmarking). */
  compare(prev: BenchmarkReport, curr: BenchmarkReport): Record<string, unknown> {
    const prevByCase = new Map(prev.results.map((r) => [r.caseId, r]));
    const deltas: Array<Record<string, unknown>> = [];
    for (const r of curr.results) {
      const p = prevByCase.get(r.caseId);
      deltas.push({
        caseId: r.caseId,
        domain: r.domain,
        prevScore: p?.score ?? null,
        currScore: r.score,
        delta: p ? Math.round((r.score - p.score) * 100) / 100 : null,
        passed: r.passed,
        regressed: p ? r.score < p.score : false,
      });
    }
    const regressions = deltas.filter((d) => d.regressed);
    return {
      from: prev.frameworkVersion,
      to: curr.frameworkVersion,
      avgDelta: Math.round((curr.summary.avgScore - prev.summary.avgScore) * 100) / 100,
      regressions,
      regressionRate: deltas.length > 0 ? Math.round((regressions.length / deltas.length) * 10000) / 100 : 0,
    };
  }
}

/** Lista os relatórios de benchmark já salvos em .izanagi/state/benchmarks/ (mais recente primeiro). */
export function listBenchmarkReports(baseDir: string): BenchmarkReport[] {
  const dir = benchmarkReportsDir(baseDir);
  if (!fs.existsSync(dir)) return [];
  const reports: BenchmarkReport[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try {
      reports.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as BenchmarkReport);
    } catch {
      // relatório corrompido — ignora, não derruba a listagem
    }
  }
  return reports.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Texto contra o qual os validators de um caso rodam.
 *
 * Ordem: conteúdo dos artefatos que a execução gravou (quando há raiz de
 * arquivos), senão o output como veio. Arquivo ilegível é omitido em vez de
 * derrubar a medição: um validator que não conseguiu ler o arquivo reprova por
 * ausência de evidência, que é o comportamento correto, e não por exceção.
 */
function validatorText(output: unknown, filesRoot: string | undefined, artifactsFound: string[]): string {
  const root = filesRoot ?? (isFsPath(output) ? String(output) : undefined);
  if (root) {
    const parts: string[] = [];
    for (const rel of artifactsFound) {
      try {
        parts.push(fs.readFileSync(path.join(root, rel), 'utf-8'));
      } catch {
        // arquivo sumiu entre a checagem e a leitura, ou é binário
      }
    }
    if (parts.length > 0) return parts.join('\n');
  }
  return typeof output === 'string' ? output : JSON.stringify(output ?? {});
}

function isFsPath(v: unknown): boolean {
  return typeof v === 'string' && (v.includes('\\') || v.includes('/')) && fs.existsSync(v);
}

function readFrameworkVersion(baseDir: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(baseDir, 'package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Producer que devolve output + evidência de execução real (Arena). */
function isProducedWithEvidence(
  value: unknown,
): value is {
  output: unknown;
  execution: ExecutionEvidence;
  budgetApplied?: { maxTokens?: number; maxCostUsd?: number };
  filesRoot?: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { output?: unknown; execution?: { verificationRate?: unknown } };
  return 'output' in v && typeof v.execution === 'object' && v.execution !== null && 'verificationRate' in v.execution;
}
