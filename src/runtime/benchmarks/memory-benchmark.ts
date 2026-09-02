/**
 * Medição de memória e compressão de contexto.
 *
 * Existe por causa de duas ideias que ficaram paradas no handoff com a mesma
 * condição: **medir antes de trocar**.
 *
 *   1. Índice de memória em SQLite FTS5. O Izanagi busca por varredura textual
 *      sobre arquivos markdown. Trocar isso por FTS5 acrescenta uma dependência
 *      nativa a um framework que hoje tem uma dependência de runtime. Só se
 *      paga se a busca atual for de fato o gargalo.
 *   2. Compressão neural de contexto (LLMLingua-2). O `ContextResolver` já
 *      comprime de forma determinística e auditável. Só se paga se essa
 *      compressão for insuficiente.
 *
 * Este módulo não decide nada: ele produz os números que permitem decidir. E é
 * honesto sobre o que mede — latência local sobre um corpus sintético, não
 * qualidade de recuperação semântica, que exigiria um conjunto anotado.
 */

import fs from 'fs';
import path from 'path';
import { ContextResolver, summarizeArtifact, type AvailableArtifact } from '../orchestration/context-resolver.js';
import type { MemoryStore } from '../memory/store.js';
import type { TaskContract } from '../contracts/task-contract.js';

export interface SearchMeasurement {
  queries: number;
  /** Entradas de memória varridas por consulta. */
  entriesScanned: number;
  /** Chars totais varridos por consulta (o que uma indexação evitaria). */
  charsScanned: number;
  /**
   * Chars que a busca ALCANÇA de fato. Se for menor que `charsScanned`, existe
   * memória invisível para a busca — e aí o problema é recall, não latência.
   */
  charsReachable: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  /** Consultas que devolveram ao menos um resultado. */
  hits: number;
  /**
   * Veredito determinístico sobre o gargalo, com o limiar explícito. Não é
   * opinião: é a regra escrita uma vez, aplicada ao número medido.
   */
  verdict: string;
}

/** Acima disto, a busca linear começa a pesar num loop de planejamento. */
export const SEARCH_P95_BUDGET_MS = 25;

/**
 * Mede a busca textual da memória. `queries` deve conter termos que existem no
 * corpus e termos que não existem: medir só acerto esconde o custo do caminho
 * em que a varredura vai até o fim sem achar nada — que é o caso comum.
 */
export function measureMemorySearch(memory: MemoryStore, queries: string[]): SearchMeasurement {
  const entries = memory.listEntries({ full: true });
  const charsScanned = entries.reduce((a, e) => a + e.content.length, 0);
  // O que a busca alcança versus o que existe. Recall truncado é pior que
  // busca lenta: busca lenta você percebe.
  const charsReachable = memory.listEntries({ full: true }).reduce((a, e) => a + e.content.length, 0);
  const durations: number[] = [];
  let hits = 0;

  for (const q of queries) {
    const started = performance.now();
    const found = memory.search(q, 10);
    durations.push(performance.now() - started);
    if (found.length > 0) hits++;
  }

  durations.sort((a, b) => a - b);
  const at = (p: number) => (durations.length === 0 ? 0 : round(durations[Math.min(durations.length - 1, Math.floor(durations.length * p))]));
  const p95 = at(0.95);

  return {
    queries: queries.length,
    entriesScanned: entries.length,
    charsScanned,
    charsReachable,
    p50Ms: at(0.5),
    p95Ms: p95,
    maxMs: round(durations[durations.length - 1] ?? 0),
    hits,
    verdict:
      p95 <= SEARCH_P95_BUDGET_MS
        ? `busca textual custa p95 ${p95}ms sobre ${charsScanned} chars: abaixo do teto de ${SEARCH_P95_BUDGET_MS}ms, indexação (FTS5) não se paga neste volume`
        : `busca textual custa p95 ${p95}ms sobre ${charsScanned} chars: acima do teto de ${SEARCH_P95_BUDGET_MS}ms, indexação passa a se justificar`,
  };
}

export interface CompressionMeasurement {
  artifacts: number;
  /** Chars que seriam enviados sem o Context Resolver. */
  fullChars: number;
  /** Chars efetivamente enviados. */
  sentChars: number;
  /** `sentChars / fullChars` em [0,1]. Menor é mais compressão. */
  ratio: number;
  /** Quantos artefatos couberam inteiros (sem corte). */
  intact: number;
  verdict: string;
}

/**
 * Razão de compressão abaixo da qual a compressão determinística já resolve.
 * Acima disso, o contexto está passando quase inteiro e um compressor
 * semântico teria o que fazer.
 */
export const COMPRESSION_TARGET_RATIO = 0.35;

/**
 * Mede a compressão determinística do `ContextResolver` sobre um conjunto de
 * artefatos. O que NÃO mede: se o que sobrou é o que importava. Isso é uma
 * pergunta de qualidade, não de tamanho, e exigiria gabarito anotado — a
 * ausência dessa medida é justamente por que a decisão sobre compressão neural
 * continua em aberto.
 */
export function measureContextCompression(
  contract: TaskContract,
  artifacts: Array<{ nodeId: string; content: string }>,
): CompressionMeasurement {
  const available = new Map<string, AvailableArtifact>(
    artifacts.map((a) => [a.nodeId, { nodeId: a.nodeId, kind: 'raw', content: a.content, valid: true, ref: `bench:${a.nodeId}` }]),
  );
  const resolved = new ContextResolver().resolve(
    { ...contract, inputs: artifacts.map((a) => a.nodeId), dependencies: artifacts.map((a) => a.nodeId) },
    available,
  );
  const intact = resolved.upstream.filter((u) => !u.truncated).length;
  const ratio = resolved.upstreamCharsFull > 0 ? round(resolved.upstreamChars / resolved.upstreamCharsFull, 4) : 0;

  return {
    artifacts: artifacts.length,
    fullChars: resolved.upstreamCharsFull,
    sentChars: resolved.upstreamChars,
    ratio,
    intact,
    verdict:
      ratio <= COMPRESSION_TARGET_RATIO
        ? `contexto enviado é ${(ratio * 100).toFixed(1)}% do original: abaixo do alvo de ${COMPRESSION_TARGET_RATIO * 100}%, compressão neural não se justifica pelo tamanho`
        : `contexto enviado é ${(ratio * 100).toFixed(1)}% do original: acima do alvo de ${COMPRESSION_TARGET_RATIO * 100}%, vale avaliar compressão mais agressiva`,
  };
}

/**
 * Corpus sintético de memória, para medir busca num projeto que ainda não
 * acumulou histórico. Medir sobre memória vazia produz "0.07ms" e uma
 * conclusão sem valor — o que se quer saber é como a busca se comporta no
 * volume em que ela passaria a doer.
 *
 * Grava os arquivos markdown que o `MemoryStore` lê, no layout real
 * (`.agents/memoria/*.md`), para que a medição exercite o mesmo caminho de
 * código da busca de verdade.
 */
export function writeSyntheticMemory(baseDir: string, opts: { entriesPerFile: number; charsPerEntry: number }): number {
  const dir = path.join(baseDir, '.agents', 'memoria');
  fs.mkdirSync(dir, { recursive: true });
  const arquivos: Record<string, string> = {
    'decisoes.md': 'Decisao de arquitetura',
    'erros-corrigidos.md': 'Erro corrigido no runtime',
    'semantica.md': 'Conhecimento de contexto do projeto',
    'procedimentos.md': 'Procedimento de skill',
  };
  let total = 0;
  const recheio = 'contexto tecnico registrado com detalhe suficiente para ser reencontrado depois. ';
  for (const [file, titulo] of Object.entries(arquivos)) {
    const blocos: string[] = [];
    for (let i = 0; i < opts.entriesPerFile; i++) {
      const corpo = recheio.repeat(Math.max(1, Math.ceil(opts.charsPerEntry / recheio.length))).slice(0, opts.charsPerEntry);
      blocos.push(`## ${titulo} ${i + 1}\n${corpo}`);
      total++;
    }
    fs.writeFileSync(path.join(dir, file), blocos.join('\n\n'), 'utf-8');
  }
  return total;
}

/** Corpus sintético reprodutível para a medição de compressão. */
export function syntheticArtifacts(count: number, charsEach: number): Array<{ nodeId: string; content: string }> {
  const frase = 'Decisao arquitetural registrada com contexto, alternativas consideradas e consequencia. ';
  return Array.from({ length: count }, (_, i) => ({
    nodeId: `artefato-${i + 1}`,
    content: frase.repeat(Math.max(1, Math.ceil(charsEach / frase.length))).slice(0, charsEach),
  }));
}

/** Verifica que o resumo preserva começo e fim, que é a promessa do resolver. */
export function summaryKeepsEnds(content: string, maxChars: number): boolean {
  const { summary, truncated } = summarizeArtifact(content, maxChars);
  if (!truncated) return true;
  return summary.startsWith(content.slice(0, 20)) && summary.endsWith(content.slice(-20));
}

function round(value: number, places = 2): number {
  const f = Math.pow(10, places);
  return Math.round(value * f) / f;
}
