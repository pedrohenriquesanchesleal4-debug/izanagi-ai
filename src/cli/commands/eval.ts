/**
 * `izanagi eval` — avalia artefatos/resultados via Evaluation Engine.
 *
 * Modos:
 *  - eval <file.json>            avalia um artefato JSON (busca métricas)
 *  - eval --report <run-id>      mostra a avaliação de um trace
 *  - eval --metrics correctness=0.9,security=0.8
 */

import fs from 'fs';
import path from 'path';
import { EvaluationEngine } from '../../runtime/evaluation/engine.js';
import { validateArtifact } from '../../runtime/contracts/artifacts.js';
import { TraceStore } from '../../runtime/observability/tracer.js';

export function evalCommand(baseDir: string, args: string[]): void {
  // eval --metrics k=v,k=v
  const metricsIdx = args.findIndex((a) => a === '--metrics');
  if (metricsIdx >= 0) {
    const pairs = (args[metricsIdx + 1] ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    const metrics: Record<string, number> = {};
    for (const p of pairs) {
      const [k, v] = p.split('=');
      if (k && v !== undefined) metrics[k.trim()] = Number(v);
    }
    const engine = new EvaluationEngine();
    const result = engine.evaluate({ metrics: metrics as never });
    printResult(result);
    return;
  }

  // eval --report <run-id>
  const reportIdx = args.findIndex((a) => a === '--report');
  if (reportIdx >= 0) {
    const runId = args[reportIdx + 1];
    if (!runId) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi eval --report <run-id>\n');
      process.exit(1);
    }
    const store = new TraceStore({ baseDir });
    const trace = store.load(runId);
    if (!trace) {
      console.error(`\x1b[31mTrace "${runId}" não encontrado.\x1b[0m\n`);
      process.exit(1);
    }
    if (!trace.evaluation) {
      console.error(`\x1b[33mTrace "${runId}" não possui avaliação registrada.\x1b[0m\n`);
      process.exit(1);
    }
    printResult(trace.evaluation);
    return;
  }

  // eval <file>
  const file = args.find((a) => !a.startsWith('-'));
  if (file) {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) {
      console.error(`\x1b[31mArquivo não encontrado: ${full}\x1b[0m\n`);
      process.exit(1);
    }
    const content = fs.readFileSync(full, 'utf-8');
    let data: unknown = content;
    try {
      data = JSON.parse(content);
    } catch {
      // texto puro
    }
    const engine = new EvaluationEngine();
    const metrics: Record<string, number> = {};
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (obj.metrics && typeof obj.metrics === 'object') {
        for (const [k, v] of Object.entries(obj.metrics as Record<string, unknown>)) {
          const n = Number(v);
          if (Number.isFinite(n)) metrics[k] = n;
        }
      }
    }
    const result = engine.evaluate({ metrics: metrics as never });
    printResult(result);

    // Validação de artefato
    const kind = (data as Record<string, unknown>)?.kind;
    if (typeof kind === 'string' && ['requirements', 'architecture', 'database-schema', 'api-contract', 'security-report', 'test-plan', 'implementation-plan'].includes(kind)) {
      const report = validateArtifact(kind as never, content);
      console.log(`  \x1b[1mArtifact validation (${kind}):\x1b[0m ${report.valid ? '\x1b[32mVALID\x1b[0m' : '\x1b[31mINVALID\x1b[0m'} (score ${report.score})`);
      report.issues.slice(0, 5).forEach((i) => console.log(`    • ${i}`));
    }
    return;
  }

  console.error(`
\x1b[1mUsage:\x1b[0m
  izanagi eval <file.json>            Avalia um artefato/resultado (métricas no JSON).
  izanagi eval --metrics k=v,k=v      Avalia métricas diretas.
  izanagi eval --report <run-id>      Mostra a avaliação de um trace existente.
`);
}

function printResult(result: { verdict: string; score: number; confidence: number; metrics: Record<string, number | undefined>; recommendations: string[] }): void {
  const color = result.verdict === 'PASS' ? '\x1b[32m' : result.verdict === 'PASS_WITH_WARNINGS' ? '\x1b[33m' : result.verdict === 'FAIL' || result.verdict === 'BLOCKED' ? '\x1b[31m' : '\x1b[90m';
  console.log(`\n\x1b[35m=== Evaluation Result ===\x1b[0m`);
  console.log(`  \x1b[1mVerdict:\x1b[0m ${color}${result.verdict}\x1b[0m`);
  console.log(`  \x1b[1mScore:\x1b[0m ${result.score}`);
  console.log(`  \x1b[1mConfidence:\x1b[0m ${result.confidence}`);
  if (Object.keys(result.metrics).length > 0) {
    console.log(`\n  \x1b[1mMetrics:\x1b[0m`);
    for (const [k, v] of Object.entries(result.metrics)) {
      if (v !== undefined) console.log(`    ${k}: ${v}`);
    }
  }
  if (result.recommendations.length > 0) {
    console.log(`\n  \x1b[1mRecommendations:\x1b[0m`);
    result.recommendations.forEach((r) => console.log(`    • ${r}`));
  }
  console.log('');
}
