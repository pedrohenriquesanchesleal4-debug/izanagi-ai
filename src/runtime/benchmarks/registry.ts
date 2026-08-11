/**
 * Benchmark Registry — carrega e lista casos de benchmark.
 *
 * Casos podem ser definidos em benchmarks/*.json (repo) ou via registry
 * embutido (definitions.ts). Cada caso: task, requirements, expectedArtifacts,
 * validators, metrics.
 */

import fs from 'fs';
import path from 'path';
import type { BenchmarkCase } from '../types.js';
import { BUILTIN_BENCHMARKS } from './definitions.js';

export class BenchmarkRegistry {
  /**
   * Carrega casos: embutidos + benchmarks/*.json do diretório base.
   */
  load(baseDir: string): BenchmarkCase[] {
    const cases = [...BUILTIN_BENCHMARKS];
    const dirs = [
      path.join(baseDir, 'benchmarks'),
      path.join(baseDir, '.agents', 'benchmarks'),
    ];
    const seen = new Set(cases.map((c) => c.id));
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
          const batch = Array.isArray(data) ? data : [data];
          for (const c of batch) {
            if (c && c.id && c.task && !seen.has(c.id)) {
              seen.add(c.id);
              cases.push(c as BenchmarkCase);
            }
          }
        } catch {
          // ignora arquivo inválido
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
