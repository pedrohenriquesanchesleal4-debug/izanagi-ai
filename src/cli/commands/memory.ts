/**
 * `izanagi memory inspect | search <query>` — memória persistente do runtime.
 */

import { MemoryStore } from '../../runtime/memory/store.js';

/**
 * @param stateDir Raiz do ESTADO deste projeto, não a raiz de assets do
 *                 framework. O parâmetro se chamava `baseDir` e recebia
 *                 `stateDir`: correto na chamada, enganoso na leitura, e é
 *                 exatamente a confusão de raiz que já produziu dois bugs.
 */
export function memoryCommand(stateDir: string, args: string[]): void {
  const sub = args[0]?.toLowerCase() ?? 'inspect';
  const store = new MemoryStore({ baseDir: stateDir });

  if (sub === 'inspect') {
    memoryInspect(store);
    return;
  }
  if (sub === 'search') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.error('\x1b[31mUsage:\x1b[0m izanagi memory search <query>\n');
      process.exit(1);
    }
    memorySearch(store, query);
    return;
  }
  if (sub === 'invalidate' || sub === 'archive') {
    const pattern = args[1];
    if (!pattern) {
      console.error(`\x1b[31mUsage:\x1b[0m izanagi memory ${sub} <pattern> ${sub === 'invalidate' ? '[reason]' : ''}\n`);
      process.exit(1);
    }
    const ok = sub === 'invalidate' ? store.invalidateFailure(pattern, args.slice(2).join(' ') || undefined) : store.archiveFailure(pattern);
    if (!ok) {
      console.error(`\x1b[31mPattern não encontrado:\x1b[0m ${pattern}\n`);
      process.exit(1);
    }
    store.save();
    console.log(`\x1b[32m✔\x1b[0m padrão "${pattern}" ${sub === 'invalidate' ? 'invalidado' : 'arquivado'}.\n`);
    return;
  }
  console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}`);
  console.error('Usage: izanagi memory <inspect|search|invalidate|archive> [query|pattern]\n');
  process.exit(1);
}

function memoryInspect(store: MemoryStore): void {
  const state = store.raw;
  const entries = store.listEntries();
  const agents = Object.values(state.agents);
  const skills = Object.values(state.skills);
  const failures = Object.values(state.failures);

  console.log(`\n\x1b[35m=== Izanagi AI Memory ===\x1b[0m\n`);
  console.log(`  \x1b[1mEstado do runtime:\x1b[0m ${store.stateFilePath}`);
  console.log(`  \x1b[1mMemória markdown:\x1b[0m ${store.memoryDirPath}\n`);

  console.log(`\x1b[1mCategorias markdown (${entries.length}):\x1b[0m`);
  for (const e of entries) {
    console.log(`  \x1b[32m•\x1b[0m ${e.category.padEnd(12)} ${e.title} \x1b[90m(${e.content.length} chars, atualizado ${e.updatedAt.slice(0, 10)})\x1b[0m`);
  }

  console.log(`\n\x1b[1mAgentes com histórico (${agents.length}):\x1b[0m`);
  for (const [id, s] of Object.entries(state.agents)) {
    console.log(`  • ${id.padEnd(24)} runs ${s.runs} | success ${Math.round((s.successes / Math.max(1, s.runs)) * 100)}% | score médio ${s.avgScore.toFixed(2)} | tokens ${Math.round(s.avgTokens)}`);
  }

  console.log(`\n\x1b[1mSkills com histórico (${skills.length}):\x1b[0m`);
  for (const [id, s] of Object.entries(state.skills).slice(0, 15)) {
    console.log(`  • ${id.padEnd(24)} uses ${s.uses} | success ${Math.round((s.successes / Math.max(1, s.uses)) * 100)}%`);
  }

  const activeFailures = store.listFailures(10);
  const inactiveCount = failures.length - store.listFailures(failures.length).length;
  console.log(`\n\x1b[1mPadrões de falha ativos (${activeFailures.length}${inactiveCount > 0 ? ` de ${failures.length}, ${inactiveCount} invalidado(s)/arquivado(s)` : ''}):\x1b[0m`);
  for (const f of activeFailures) {
    console.log(`  • \x1b[33m${f.pattern}\x1b[0m (${f.occurrences}x, conf ${f.confidence}) — ${f.rootCause.slice(0, 60)}`);
  }

  console.log(`\n\x1b[1mLearnings (${state.learnings.length}):\x1b[0m`);
  for (const l of state.learnings.slice(0, 5)) {
    console.log(`  • ${l.text.slice(0, 110)}`);
  }
  console.log('\nBuscar: \x1b[33mizanagi memory search <termo>\x1b[0m\n');
}

function memorySearch(store: MemoryStore, query: string): void {
  const results = store.search(query, 10);
  console.log(`\n\x1b[35m=== Memory Search: "${query}" (${results.length} resultados) ===\x1b[0m\n`);
  for (const r of results) {
    console.log(`\x1b[1m\x1b[36m• [${r.category}] ${r.title}\x1b[0m \x1b[90m(score ${r.score})\x1b[0m`);
    const snippet = r.content.replace(/\s+/g, ' ').slice(0, 140);
    console.log(`  \x1b[90m${snippet}\x1b[0m\n`);
  }
  if (results.length === 0) {
    console.log('  Nenhum resultado. Considere registrar a informação via memory store.\n');
  }
}
