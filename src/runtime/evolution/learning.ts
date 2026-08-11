/**
 * Evolution / Learning — extrai aprendizado estruturado das avaliações.
 *
 * Ciclo: Run → Evaluate → Reflect → Record → Improve next run.
 * - Registra estatísticas por agente/skill na memória.
 * - Converte falhas em padrões reutilizáveis (Failure Memory).
 * - Gera recomendações de melhoria (anti-prompt-bloat: menos prompt, mais sistema).
 */

import type { EvaluationReport, FailurePattern } from '../types.js';
import type { MemoryStore } from '../memory/store.js';

export interface LearningOutcome {
  learnings: string[];
  patternsRecorded: number;
  recommendations: string[];
}

export class LearningEngine {
  constructor(private readonly memory: MemoryStore) {}

  /**
   * Processa um relatório de avaliação pós-run.
   */
  process(report: EvaluationReport, opts: { agentId?: string; skillIds?: string[]; tokens?: number }): LearningOutcome {
    const learnings: string[] = [];
    let patternsRecorded = 0;

    // 1. Estatísticas de agente
    if (opts.agentId) {
      this.memory.recordAgentRun(opts.agentId, {
        success: report.verdict === 'PASS' || report.verdict === 'PASS_WITH_WARNINGS',
        score: report.score,
        tokens: opts.tokens ?? 0,
      });
    }

    // 2. Estatísticas de skills
    for (const skill of opts.skillIds ?? []) {
      this.memory.recordSkillRun(skill, {
        success: report.verdict === 'PASS' || report.verdict === 'PASS_WITH_WARNINGS',
        score: report.score,
        tokens: opts.tokens ?? 0,
      });
    }

    // 3. Regressões → padrões de falha
    for (const regression of report.regressions) {
      const pattern: FailurePattern = {
        pattern: slugify(`REGRESSION-${regression}`),
        symptoms: [regression.slice(0, 60)],
        rootCause: regression,
        solution: 'Adicionar teste de regressão e investigar causa raiz (systematic-debugging)',
        confidence: 0.6,
        occurrences: 1,
        kind: 'validation',
        tags: ['regression', ...(opts.agentId ? [opts.agentId] : [])],
      };
      this.memory.recordFailure(pattern);
      patternsRecorded++;
    }

    // 4. Learnings textuais por verdict
    if (report.verdict === 'FAIL' || report.verdict === 'BLOCKED') {
      const lesson = `[${report.verdict}] ${report.task.slice(0, 80)} — score ${report.score.toFixed(2)}: ${report.recommendations[0] ?? 'revisar correção antes de prosseguir'}`;
      this.memory.addLearning(lesson, report.agentId ?? 'evaluation', 0.7);
      learnings.push(lesson);
    } else if (report.verdict === 'PASS') {
      const lesson = `[PASS] ${report.task.slice(0, 80)} — score ${report.score.toFixed(2)} com ${report.metrics.correctness !== undefined ? `correctness ${report.metrics.correctness.toFixed(2)}` : 'métricas parciais'}`;
      this.memory.addLearning(lesson, report.agentId ?? 'evaluation', 0.9);
      learnings.push(lesson);
    }

    // 5. Recomendações anti-prompt-bloat: sugere artefatos/validators
    const recommendations = buildImprovementRecommendations(report);

    return { learnings, patternsRecorded, recommendations };
  }
}

function buildImprovementRecommendations(report: EvaluationReport): string[] {
  const recs: string[] = [];
  const measured = Object.keys(report.metrics).length;
  if (measured < 4) {
    recs.push('Medir mais métricas (correctness/security/testResults) para confiança maior da avaliação.');
  }
  if (report.confidence < 0.6) {
    recs.push('Baixa confiança de avaliação: adicionar validators de artefato ao workflow.');
  }
  if (report.recommendations.length > 0) {
    recs.push(...report.recommendations.slice(0, 2));
  }
  return recs;
}

function slugify(text: string): string {
  const accents: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', â: 'a', ê: 'e', ô: 'o', ã: 'a', õ: 'o', ç: 'c' };
  return text
    .toUpperCase()
    .split('')
    .map((c) => accents[c] ?? c)
    .join('')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
