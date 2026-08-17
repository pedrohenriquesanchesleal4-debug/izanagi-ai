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

export interface BenchmarkRunOptions {
  baseDir: string;
  suite?: string;
  /** Executa os validators de cada caso. */
  runValidators?: boolean;
}

export class BenchmarkRunner {
  constructor(
    private readonly evaluator = new EvaluationEngine(),
    private readonly runValidators = true,
  ) {}

  /**
   * Executa um único caso contra um output produzido.
   * O output pode ser: diretório (verifica arquivos), string, ou objeto.
   */
  runCase(c: BenchmarkCase, output: unknown, opts: { durationMs?: number; tokensUsed?: number } = {}): BenchmarkResult {
    const started = Date.now();
    const artifactsFound: string[] = [];
    const artifactsMissing: string[] = [];
    const validatorFailures: string[] = [];

    // Artefatos esperados: arquivos no diretório de output
    for (const expected of c.expectedArtifacts) {
      if (isFsPath(output)) {
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
    const text = typeof output === 'string' ? output : JSON.stringify(output ?? {});
    for (const v of c.validators ?? []) {
      let pass = true;
      try {
        pass = Boolean(safeEvaluate(v.check, { text }));
      } catch {
        pass = false;
      }
      if (!pass) validatorFailures.push(`${v.name}: ${v.message}`);
    }

    const artifactRatio = c.expectedArtifacts.length > 0 ? artifactsFound.length / c.expectedArtifacts.length : 1;
    const metrics: Record<string, number> = {};

    // Mapeia métricas do caso: métricas de qualidade derivam da razão de
    // artefatos encontrados (proxy honesto do output); latency/uso são reais.
    for (const m of c.metrics) {
      metrics[m] = artifactRatio;
    }
    metrics.artifactValidity = artifactRatio;

    const durationMs = opts.durationMs ?? Date.now() - started;
    if (c.metrics.includes('latency')) metrics.latency = durationMs;
    const result: BenchmarkResult = {
      caseId: c.id,
      domain: c.domain,
      passed: artifactsMissing.length === 0 && validatorFailures.length === 0,
      score: Math.round(artifactRatio * 100) / 100,
      artifactsFound,
      artifactsMissing,
      validatorFailures,
      metrics,
      durationMs,
      tokensUsed: opts.tokensUsed,
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
        const output = await producer(c);
        results.push(this.runCase(c, output));
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
    };

    const dir = path.join(opts.baseDir, '.izanagi', 'state', 'benchmarks');
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
