/**
 * Benchmark Registry: carrega e lista casos de benchmark.
 *
 * Casos podem ser definidos em benchmarks/*.json (repo) ou via registry
 * embutido (definitions.ts). Cada caso: task, requirements, expectedArtifacts,
 * validators, metrics.
 *
 * A carga VALIDA o caso antes de aceitá-lo. Antes não validava, e o efeito não
 * era um caso ignorado: era um caso aceito pela metade. Um JSON sem
 * `expectedArtifacts` chegava ao runner, `for (const x of undefined)` estourava
 * dentro do `try` da suíte, e o relatório registrava `producer falhou: Cannot
 * read properties of undefined`, culpando a execução por um defeito da
 * definição. Caso recusado agora diz o motivo e diz qual arquivo o trouxe.
 */

import fs from 'fs';
import path from 'path';
import type { BenchmarkCase, BenchmarkDomain, MetricName } from '../types.js';
import { BUILTIN_BENCHMARKS } from './definitions.js';

/** Por que um caso de um arquivo `benchmarks/*.json` não entrou na suíte. */
export interface BenchmarkLoadIssue {
  /** Arquivo que trouxe o caso. */
  file: string;
  /** Id do caso, quando havia um legível. */
  id?: string;
  reason: string;
}

const METRICS: readonly MetricName[] = [
  'correctness',
  'requirementCoverage',
  'testResults',
  'architecture',
  'security',
  'performance',
  'maintainability',
  'confidence',
  'cost',
  'latency',
  'artifactValidity',
];

const DOMAINS: readonly BenchmarkDomain[] = [
  'coding',
  'debugging',
  'architecture',
  'security',
  'database',
  'frontend',
  'backend',
  'automation',
  'research',
  'refactoring',
];

export class BenchmarkRegistry {
  /**
   * Carrega casos: embutidos + benchmarks/*.json do diretório base.
   *
   * @param issues Coletor opcional. Presente, recebe um registro por caso
   *   recusado e por arquivo ilegível: o que antes desaparecia num `catch`
   *   vazio. Ausente, o comportamento é o de sempre: a suíte é o que passou.
   */
  load(baseDir: string, issues?: BenchmarkLoadIssue[]): BenchmarkCase[] {
    const cases = [...BUILTIN_BENCHMARKS];
    const dirs = [
      path.join(baseDir, 'benchmarks'),
      path.join(baseDir, '.agents', 'benchmarks'),
    ];
    const seen = new Set(cases.map((c) => c.id));
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        const file = path.join(dir, f);
        let batch: unknown[];
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
          batch = Array.isArray(data) ? data : [data];
        } catch (err) {
          issues?.push({ file, reason: `JSON ilegível: ${err instanceof Error ? err.message : String(err)}` });
          continue;
        }
        for (const raw of batch) {
          const verdict = normalizeCase(raw);
          if (!verdict.ok) {
            issues?.push({ file, ...(verdict.id ? { id: verdict.id } : {}), reason: verdict.reason });
            continue;
          }
          if (seen.has(verdict.value.id)) {
            issues?.push({ file, id: verdict.value.id, reason: 'id já existe na suíte (embutido ou arquivo anterior)' });
            continue;
          }
          seen.add(verdict.value.id);
          cases.push(verdict.value);
        }
      }
    }
    return cases;
  }

  /** Filtra casos por domínio. */
  filterByDomain(cases: BenchmarkCase[], domain?: string): BenchmarkCase[] {
    if (!domain || domain === 'all') return cases;
    return cases.filter((c) => c.domain === domain);
  }
}

type NormalizeResult =
  | { ok: true; value: BenchmarkCase }
  | { ok: false; id?: string; reason: string };

/**
 * Valida e normaliza um caso vindo de JSON.
 *
 * A regra de recusa é uma só: um caso precisa ser MENSURÁVEL. Sem artefato
 * esperado e sem validator não há o que medir, e aceitar isso produzia o pior
 * resultado possível: razão de artefatos `0/0 = 1`, score 1.00 e `passed:
 * true` para um caso que não conferiu nada.
 */
export function normalizeCase(raw: unknown): NormalizeResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'caso não é um objeto' };
  const c = raw as Record<string, unknown>;

  const id = typeof c.id === 'string' ? c.id.trim() : '';
  if (!id) return { ok: false, reason: 'campo `id` ausente ou vazio' };

  const task = typeof c.task === 'string' ? c.task.trim() : '';
  if (!task) return { ok: false, id, reason: 'campo `task` ausente ou vazio' };

  if (typeof c.domain !== 'string' || !DOMAINS.includes(c.domain as BenchmarkDomain)) {
    return { ok: false, id, reason: `campo \`domain\` inválido (${String(c.domain)}); esperado um de: ${DOMAINS.join(', ')}` };
  }

  const expectedArtifacts = stringArray(c.expectedArtifacts);
  if (expectedArtifacts === null) return { ok: false, id, reason: '`expectedArtifacts` deve ser um array de strings' };

  const validators = normalizeValidators(c.validators);
  if (validators === null) return { ok: false, id, reason: '`validators` deve ser um array de { name, message, check }' };

  if (expectedArtifacts.length === 0 && validators.length === 0) {
    return { ok: false, id, reason: 'caso sem critério: precisa de ao menos um `expectedArtifacts` ou um `validators`' };
  }

  const metrics = stringArray(c.metrics);
  if (metrics === null) return { ok: false, id, reason: '`metrics` deve ser um array de strings' };
  const unknownMetric = metrics.find((m) => !METRICS.includes(m as MetricName));
  if (unknownMetric !== undefined) {
    return { ok: false, id, reason: `métrica desconhecida "${unknownMetric}"; esperado um de: ${METRICS.join(', ')}` };
  }

  const requirements = stringArray(c.requirements);
  if (requirements === null) return { ok: false, id, reason: '`requirements` deve ser um array de strings' };

  const tags = stringArray(c.tags);
  if (tags === null) return { ok: false, id, reason: '`tags` deve ser um array de strings' };

  const budget = normalizeBudget(c.budget);
  if (budget === null) return { ok: false, id, reason: '`budget` deve ser { maxTokens?: number > 0, maxCostUsd?: number > 0 }' };

  return {
    ok: true,
    value: {
      id,
      domain: c.domain as BenchmarkDomain,
      task,
      requirements,
      expectedArtifacts,
      ...(validators.length > 0 ? { validators } : {}),
      metrics: metrics as MetricName[],
      tags,
      ...(budget ? { budget } : {}),
    },
  };
}

/** Array de strings, `[]` quando ausente, `null` quando presente e malformado. */
function stringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    out.push(item);
  }
  return out;
}

function normalizeValidators(value: unknown): NonNullable<BenchmarkCase['validators']> | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: NonNullable<BenchmarkCase['validators']> = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const v = item as Record<string, unknown>;
    if (typeof v.name !== 'string' || typeof v.check !== 'string') return null;
    out.push({ name: v.name, message: typeof v.message === 'string' ? v.message : v.name, check: v.check });
  }
  return out;
}

/** `undefined` quando ausente, `null` quando presente e malformado. */
function normalizeBudget(value: unknown): BenchmarkCase['budget'] | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') return null;
  const b = value as Record<string, unknown>;
  const out: { maxTokens?: number; maxCostUsd?: number } = {};
  for (const key of ['maxTokens', 'maxCostUsd'] as const) {
    const n = b[key];
    if (n === undefined) continue;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
    out[key] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
