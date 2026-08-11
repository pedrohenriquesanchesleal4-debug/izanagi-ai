/**
 * Evaluation Engine — avalia resultados de agentes e workflows.
 *
 * Deriva um verdict (PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED / UNKNOWN)
 * a partir de métricas em [0,1] ponderadas, resultados de testes e regressões.
 *
 * Uso:
 *   const engine = new EvaluationEngine();
 *   const result = engine.evaluate({ metrics: {...}, tests: {...} });
 */

import type {
  EvaluationReport,
  EvaluationResult,
  EvaluationThresholds,
  MetricName,
  MetricWeightings,
  TestSummary,
  Verdict,
} from '../types.js';

export const DEFAULT_WEIGHTINGS: MetricWeightings = {
  correctness: 0.3,
  requirementCoverage: 0.15,
  testResults: 0.2,
  architecture: 0.1,
  security: 0.1,
  performance: 0.05,
  maintainability: 0.05,
  artifactValidity: 0.05,
};

export const DEFAULT_THRESHOLDS: EvaluationThresholds = {
  pass: 0.85,
  passWithWarnings: 0.7,
};

export interface EvaluateInput {
  metrics?: Partial<Record<MetricName, number>>;
  tests?: TestSummary;
  regressions?: string[];
  recommendations?: string[];
  weightings?: Partial<MetricWeightings>;
  thresholds?: Partial<EvaluationThresholds>;
  /** Se true, retorna BLOCKED em vez de FAIL quando há regressões críticas. */
  blockOnCriticalRegression?: boolean;
}

const WEIGHTED_METRICS: MetricName[] = [
  'correctness',
  'requirementCoverage',
  'testResults',
  'architecture',
  'security',
  'performance',
  'maintainability',
  'artifactValidity',
];

export class EvaluationEngine {
  constructor(
    private readonly defaults: { weightings?: MetricWeightings; thresholds?: EvaluationThresholds } = {},
  ) {}

  /**
   * Computa o score ponderado das métricas informadas.
   * Métricas ausentes não penalizam o score (são ignoradas).
   */
  weightedScore(metrics: Partial<Record<MetricName, number>>, weightings: MetricWeightings): number {
    const w = weightings as unknown as Record<string, number>;
    let total = 0;
    let weights = 0;
    for (const m of WEIGHTED_METRICS) {
      const v = metrics[m];
      if (v !== undefined && Number.isFinite(v)) {
        total += v * w[m];
        weights += w[m];
      }
    }
    return weights === 0 ? 0 : total / weights;
  }

  /**
   * Deriva o verdict a partir de score, testes e regressões.
   */
  computeVerdict(
    score: number,
    opts: { tests?: TestSummary; regressions?: string[]; thresholds: EvaluationThresholds },
  ): Verdict {
    const { tests, regressions, thresholds } = opts;

    // BLOCKED: falha estrutural que impede conclusão
    if (tests && tests.failed > 0 && tests.passed === 0) return 'BLOCKED';
    if (score === 0 && (tests === undefined || (tests.failed > 0 && tests.passed === 0))) return 'BLOCKED';

    // FAIL: regressões ou testes falhando ou score baixo
    if (regressions && regressions.length > 0) return 'FAIL';
    if (tests && tests.failed > 0) return 'FAIL';
    if (score < thresholds.passWithWarnings) return 'FAIL';

    // PASS_WITH_WARNINGS
    if (score < thresholds.pass) return 'PASS_WITH_WARNINGS';
    if (tests && tests.skipped && tests.skipped > 0) return 'PASS_WITH_WARNINGS';

    return 'PASS';
  }

  /**
   * Métricas a partir do resultado de testes.
   */
  testMetrics(tests: TestSummary): { testResults: number; confidence: number } {
    const total = tests.total ?? tests.passed + tests.failed;
    if (total === 0) return { testResults: 0, confidence: 0 };
    const passRate = total > 0 ? tests.passed / total : 0;
    const failurePenalty = tests.failed * 0.25;
    return {
      testResults: Math.max(0, Math.min(1, passRate - failurePenalty)),
      confidence: Math.min(0.95, 0.3 + passRate * 0.6),
    };
  }

  /**
   * Avalia um resultado de agente/workflow.
   */
  evaluate(input: EvaluateInput): EvaluationResult {
    const weightings: MetricWeightings = { ...DEFAULT_WEIGHTINGS, ...this.defaults.weightings, ...input.weightings };
    const thresholds: EvaluationThresholds = { ...DEFAULT_THRESHOLDS, ...this.defaults.thresholds, ...input.thresholds };

    const metrics: Partial<Record<MetricName, number>> = { ...input.metrics };

    // Deriva testResults das métricas de teste se não informado
    if (input.tests && metrics.testResults === undefined) {
      metrics.testResults = this.testMetrics(input.tests).testResults;
    }

    const score = this.weightedScore(metrics, weightings);
    const confidence = input.metrics?.confidence ?? this.computeConfidence(metrics, input.tests);

    const verdict = this.computeVerdict(score, {
      tests: input.tests,
      regressions: input.regressions,
      thresholds,
    });

    const recommendations = [...(input.recommendations ?? [])];
    if (verdict === 'FAIL' || verdict === 'BLOCKED') {
      if (!metrics.correctness || metrics.correctness < 0.8) {
        recommendations.push('Revisar correção: implementação divergente dos requisitos.');
      }
      if (input.tests && input.tests.failed > 0) {
        recommendations.push(`Corrigir ${input.tests.failed} teste(s) falhando antes de considerar a entrega concluída.`);
      }
      if (input.regressions && input.regressions.length > 0) {
        recommendations.push('Regressões detectadas: investigar causa raiz e adicionar teste de regressão.');
      }
    }

    return { verdict, score, confidence, metrics, tests: input.tests, regressions: input.regressions ?? [], recommendations, thresholds };
  }

  /**
   * Confiança derivada de quantas métricas foram medidas de fato.
   */
  computeConfidence(metrics: Partial<Record<MetricName, number>>, tests?: TestSummary): number {
    let measured = 0;
    for (const m of WEIGHTED_METRICS) {
      if (metrics[m] !== undefined) measured++;
    }
    const base = 0.35 + measured * 0.08;
    const testBoost = tests ? Math.min(0.2, (tests.passed || 0) / 100) : 0;
    return Math.min(0.97, base + testBoost);
  }

  /**
   * Constrói um relatório completo com metadados do run.
   */
  buildReport(input: EvaluateInput & { taskId: string; task: string; agentId?: string }): EvaluationReport {
    const result = this.evaluate(input);
    return {
      ...result,
      taskId: input.taskId,
      task: input.task,
      agentId: input.agentId,
      createdAt: new Date().toISOString(),
      weightings: input.weightings ? { ...DEFAULT_WEIGHTINGS, ...input.weightings } : undefined,
      thresholds: result.thresholds,
    };
  }
}

/** Helper: clamp de métrica para [0,1]. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
