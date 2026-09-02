/**
 * Memory Store — memória persistente estruturada do runtime.
 *
 * Categorias: episodic, semantic, procedural, decision, failure, skill, project.
 * Local: .izanagi/state/memory.json (estado do runtime) + .agents/memoria/ (markdown humano).
 *
 * Complementa (não substitui) a memória markdown existente de .agents/memoria/.
 *
 * Toda mutação (recordAgentRun/recordSkillRun/recordModelRun/recordFailure/
 * invalidateFailure/archiveFailure/addLearning) persiste em disco na hora —
 * não fica só em memória esperando um `.save()` explícito no fim do run. Se
 * o processo for encerrado no meio de uma execução (Ctrl+C, crash, terminal
 * fechado), o que já foi registrado até aquele ponto não se perde.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { FailurePattern, MemoryCategory, MemoryEntry, RuntimeState } from '../types.js';
import { isRecurrent, signatureOf, type Trajectory, type TrajectoryStep } from '../evolution/trajectories.js';

export const STATE_FILE_REL = path.join('.izanagi', 'state', 'runtime-state.json');

const MEMORY_MD_REL = path.join('.agents', 'memoria');

function nowIso(): string {
  return new Date().toISOString();
}

function shortId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(3).toString('hex')}`;
}

export interface MemoryStoreOptions {
  baseDir: string;
}

export class MemoryStore {
  private readonly stateFile: string;
  private readonly memoryDir: string;
  private state: RuntimeState;

  constructor(private readonly opts: MemoryStoreOptions) {
    this.stateFile = path.join(opts.baseDir, STATE_FILE_REL);
    this.memoryDir = path.join(opts.baseDir, MEMORY_MD_REL);
    this.state = this.load();
  }

  private load(): RuntimeState {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8')) as RuntimeState;
        if (raw && typeof raw === 'object' && raw.schemaVersion >= 1) {
          // Migração leve: estado persistido antes da introdução de `models`/
          // `trajectories` não tem o campo.
          raw.models ??= {};
          raw.trajectories ??= {};
          return raw;
        }
      }
    } catch {
      // estado corrompido → recomeça
    }
    return {
      schemaVersion: 1,
      agents: {},
      skills: {},
      models: {},
      trajectories: {},
      failures: {},
      learnings: [],
      updatedAt: nowIso(),
    };
  }

  /** Persiste o estado atual. */
  save(): void {
    this.state.updatedAt = nowIso();
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  get raw(): RuntimeState {
    return this.state;
  }

  /* ==================== AGENT STATS ==================== */

  recordAgentRun(agent: string, opts: { success: boolean; score: number; tokens: number; domains?: string[] }): void {
    const s = (this.state.agents[agent] ??= { runs: 0, successes: 0, failures: 0, avgScore: 0, avgTokens: 0 });
    s.runs++;
    if (opts.success) s.successes++;
    else s.failures++;
    s.avgScore = (s.avgScore * (s.runs - 1) + opts.score) / s.runs;
    s.avgTokens = (s.avgTokens * (s.runs - 1) + opts.tokens) / s.runs;
    s.lastRunAt = nowIso();
    // Recorte por domínio: um agente que vai bem em backend e mal em frontend
    // não pode ser julgado por uma média só. O run conta em TODOS os domínios
    // que ele tocou, porque o trabalho foi de fato feito em todos eles.
    for (const domain of opts.domains ?? []) {
      const d = ((s.byDomain ??= {})[domain] ??= { runs: 0, successes: 0, failures: 0, avgScore: 0 });
      d.runs++;
      if (opts.success) d.successes++;
      else d.failures++;
      d.avgScore = (d.avgScore * (d.runs - 1) + opts.score) / d.runs;
    }
    this.save();
  }

  /**
   * Estatística do agente. Com `domain`, devolve o recorte daquele domínio —
   * e `undefined` quando não há histórico ali, o que é diferente de "vai mal":
   * quem chama precisa tratar ausência como ausência de sinal, não como falha.
   */
  agentStats(agent: string, domain?: string) {
    const stats = this.state.agents[agent];
    if (!stats || !domain) return stats;
    const scoped = stats.byDomain?.[domain];
    if (!scoped) return undefined;
    return {
      runs: scoped.runs,
      successes: scoped.successes,
      failures: scoped.failures,
      avgScore: scoped.avgScore,
      avgTokens: stats.avgTokens,
      ...(stats.lastRunAt ? { lastRunAt: stats.lastRunAt } : {}),
    };
  }

  /* ==================== SKILL STATS ==================== */

  recordSkillRun(skill: string, opts: { success: boolean; score: number; tokens: number }): void {
    const s = (this.state.skills[skill] ??= { uses: 0, successes: 0, failures: 0, avgScore: 0, avgTokens: 0 });
    s.uses++;
    if (opts.success) s.successes++;
    else s.failures++;
    s.avgScore = (s.avgScore * (s.uses - 1) + opts.score) / s.uses;
    s.avgTokens = (s.avgTokens * (s.uses - 1) + opts.tokens) / s.uses;
    s.lastUsedAt = nowIso();
    this.save();
  }

  skillStats(skill: string) {
    return this.state.skills[skill];
  }

  /* ==================== MODEL STATS ==================== */

  recordModelRun(modelId: string, opts: { success: boolean; score: number; tokens: number }): void {
    const s = (this.state.models[modelId] ??= { runs: 0, successes: 0, failures: 0, avgScore: 0, avgTokens: 0 });
    s.runs++;
    if (opts.success) s.successes++;
    else s.failures++;
    s.avgScore = (s.avgScore * (s.runs - 1) + opts.score) / s.runs;
    s.avgTokens = (s.avgTokens * (s.runs - 1) + opts.tokens) / s.runs;
    s.lastRunAt = nowIso();
    this.save();
  }

  modelStats(modelId: string) {
    return this.state.models[modelId];
  }

  /**
   * Taxa de sucesso histórica por modelo (0-1), pronta para alimentar
   * `RoutingContext.historicalPerformance` do ModelRouter. Modelos sem
   * histórico ficam de fora do mapa (o router trata ausência como neutro).
   */
  historicalPerformance(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [modelId, stats] of Object.entries(this.state.models)) {
      if (stats.runs > 0) out[modelId] = stats.successes / stats.runs;
    }
    return out;
  }

  /* ==================== TRAJETÓRIAS ==================== */

  /**
   * Registra o caminho percorrido por um run. O simétrico de `recordFailure`:
   * o `LearningEngine` já convertia falha em padrão reutilizável, e sucesso não
   * virava nada além de estatística agregada.
   *
   * Devolve a trajetória consolidada, ou `null` quando a execução é curta
   * demais para ser procedimento (menos de 2 tarefas verificadas).
   */
  recordTrajectory(input: {
    steps: TrajectoryStep[];
    objective: string;
    domains?: string[];
    success: boolean;
  }): Trajectory | null {
    const signed = signatureOf(input.steps);
    if (!signed) return null;
    const now = nowIso();
    const store = (this.state.trajectories ??= {});
    const existing = store[signed.signature];

    if (existing) {
      existing.occurrences++;
      if (input.success) existing.successes++;
      existing.lastSeen = now;
      existing.domains = Array.from(new Set([...existing.domains, ...(input.domains ?? [])]));
      // Amostra de objetivos, não histórico: o valor está na variedade dos
      // exemplos, e guardar todos faria o estado crescer sem limite.
      if (!existing.examples.includes(input.objective) && existing.examples.length < 5) {
        existing.examples.push(input.objective);
      }
      this.save();
      return existing;
    }

    const entry: Trajectory = {
      signature: signed.signature,
      steps: signed.steps,
      domains: input.domains ?? [],
      occurrences: 1,
      successes: input.success ? 1 : 0,
      firstSeen: now,
      lastSeen: now,
      examples: [input.objective],
    };
    store[signed.signature] = entry;
    this.save();
    return entry;
  }

  /** Trajetórias que já se repetiram o bastante e ainda não viraram skill. */
  recurrentTrajectories(): Trajectory[] {
    return Object.values(this.state.trajectories ?? {})
      .filter(isRecurrent)
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  listTrajectories(limit = 20): Trajectory[] {
    return Object.values(this.state.trajectories ?? {})
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  /** Marca a trajetória como já sintetizada, para não gerar a skill duas vezes. */
  markTrajectorySynthesized(signature: string, skill: string): boolean {
    const entry = this.state.trajectories?.[signature];
    if (!entry) return false;
    entry.synthesizedSkill = skill;
    this.save();
    return true;
  }

  /* ==================== FAILURE PATTERNS ==================== */

  /**
   * Registra (ou consolida) um padrão de falha reutilizável.
   * Se o mesmo pattern já existe, incrementa occurrences e atualiza confiança.
   */
  recordFailure(pattern: Partial<FailurePattern> & { pattern: string; rootCause: string; solution: string }): FailurePattern {
    const now = nowIso();
    const existing = this.state.failures[pattern.pattern];
    if (existing) {
      existing.occurrences++;
      existing.confidence = Math.min(0.99, existing.confidence + 0.03);
      existing.lastSeen = now;
      if (pattern.symptoms?.length) existing.symptoms = Array.from(new Set([...existing.symptoms, ...pattern.symptoms]));
      // Recorrência real é sinal de que a invalidação foi precoce — reativa.
      // 'archived' é decisão manual e final: uma recorrência não a desfaz sozinha.
      if (existing.status === 'invalidated') {
        existing.status = 'active';
        existing.invalidatedReason = undefined;
      }
      this.save();
      return existing;
    }
    const entry: FailurePattern = {
      pattern: pattern.pattern,
      symptoms: pattern.symptoms ?? [],
      rootCause: pattern.rootCause,
      solution: pattern.solution,
      confidence: pattern.confidence ?? 0.7,
      occurrences: 1,
      kind: pattern.kind,
      firstSeen: now,
      lastSeen: now,
      tags: pattern.tags,
      status: 'active',
    };
    this.state.failures[entry.pattern] = entry;
    this.save();
    return entry;
  }

  /**
   * Invalida um padrão: a solução registrada não se aplica mais (ex.: causa
   * raiz mudou com uma refatoração). Some da busca ativa, mas fica no
   * histórico — se a mesma falha recorrer de verdade, `recordFailure`
   * reativa sozinho. Devolve false se o pattern não existe.
   */
  invalidateFailure(pattern: string, reason?: string): boolean {
    const entry = this.state.failures[pattern];
    if (!entry) return false;
    entry.status = 'invalidated';
    entry.invalidatedReason = reason;
    this.save();
    return true;
  }

  /**
   * Arquiva um padrão: decisão manual e final de não usá-lo mais. Ao
   * contrário de invalidação, uma recorrência não reativa sozinha — exige
   * `recordFailure` explícito tratando como novo, ou reversão manual do status.
   * Devolve false se o pattern não existe.
   */
  archiveFailure(pattern: string): boolean {
    const entry = this.state.failures[pattern];
    if (!entry) return false;
    entry.status = 'archived';
    this.save();
    return true;
  }

  /** Busca padrões de falha relevantes para uma tarefa (match por tags/symptoms). Ignora invalidated/archived por padrão. */
  findRelevantFailures(query: string, opts: { includeInactive?: boolean } = {}): FailurePattern[] {
    const q = query.toLowerCase();
    return Object.values(this.state.failures)
      .filter((p) => opts.includeInactive || (p.status ?? 'active') === 'active')
      .filter(
        (p) =>
          p.symptoms.some((s) => q.includes(s.toLowerCase())) ||
          (p.tags ?? []).some((t) => q.includes(t.toLowerCase())) ||
          p.pattern.toLowerCase().split('-').some((w) => w.length > 3 && q.includes(w)),
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  listFailures(limit = 50, opts: { includeInactive?: boolean } = {}): FailurePattern[] {
    return Object.values(this.state.failures)
      .filter((p) => opts.includeInactive || (p.status ?? 'active') === 'active')
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  /* ==================== MEMORY ENTRIES (markdown humano) ==================== */

  private entryFile(category: MemoryCategory): string {
    const map: Record<MemoryCategory, string> = {
      episodic: 'episodios.md',
      semantic: 'semantica.md',
      procedural: 'procedimentos.md',
      decision: 'decisoes.md',
      failure: 'erros-corrigidos.md',
      skill: 'skills.md',
      project: 'contexto.md',
    };
    return map[category];
  }

  /**
   * Lista entradas de memória markdown existentes.
   *
   * Por padrão o conteúdo vem CORTADO em 4000 chars, porque uma entrada inteira
   * indo para o contexto de um prompt é justamente o que a arquitetura proíbe.
   * `full: true` devolve o arquivo completo, e existe porque BUSCAR sobre o
   * conteúdo cortado significava não encontrar nada além do começo do arquivo.
   */
  listEntries(opts: { full?: boolean } = {}): MemoryEntry[] {
    if (!fs.existsSync(this.memoryDir)) return [];
    const categories: MemoryCategory[] = ['episodic', 'semantic', 'procedural', 'decision', 'failure', 'skill', 'project'];
    const entries: MemoryEntry[] = [];
    for (const cat of categories) {
      const file = path.join(this.memoryDir, this.entryFile(cat));
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      const stat = fs.statSync(file);
      entries.push({
        id: `${cat}-file`,
        category: cat,
        title: this.entryFile(cat),
        content: opts.full ? content : content.slice(0, MEMORY_PREVIEW_CHARS),
        tags: [cat],
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        source: file,
      });
    }
    return entries;
  }

  /**
   * Busca por termo nas entradas markdown.
   *
   * Duas correções sobre a versão anterior, e as duas mudam o RESULTADO, não a
   * velocidade:
   *
   *  - varre o arquivo INTEIRO. Antes buscava sobre o conteúdo já cortado em
   *    4000 chars, então tudo que o projeto aprendeu depois das primeiras
   *    páginas de cada arquivo era invisível para a busca — recall truncado em
   *    silêncio, que é a pior forma de estar errado;
   *  - devolve a JANELA em volta da ocorrência, não o começo do arquivo. Quem
   *    busca "erro de timeout" quer o trecho sobre timeout, não a primeira
   *    entrada do arquivo de erros.
   */
  search(query: string, limit = 10): Array<MemoryEntry & { score: number }> {
    const q = query.toLowerCase();
    const terms = q.split(/\s+/).filter((t) => t.length > 2);
    const scored: Array<MemoryEntry & { score: number }> = [];

    for (const e of this.listEntries({ full: true })) {
      const body = e.content.toLowerCase();
      let score = 0;
      let firstHit = -1;
      for (const t of terms) {
        const at = body.indexOf(t);
        if (at === -1) continue;
        score += 1;
        if (firstHit === -1 || at < firstHit) firstHit = at;
      }
      if (e.title.toLowerCase().includes(q)) score += 2;
      if (e.tags.some((t) => t.includes(q))) score += 1;
      if (score === 0) continue;
      scored.push({ ...e, content: excerpt(e.content, firstHit), score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /* ==================== LEARNINGS ==================== */

  addLearning(text: string, source: string, confidence = 0.8): void {
    this.state.learnings.unshift({
      id: shortId('learn'),
      text,
      source,
      createdAt: nowIso(),
      confidence,
    });
    this.state.learnings = this.state.learnings.slice(0, 200);
    this.save();
  }

  listLearnings(limit = 20) {
    return this.state.learnings.slice(0, limit);
  }
}

/** Chars de uma entrada de memória expostos por padrão (preview, não busca). */
const MEMORY_PREVIEW_CHARS = 4000;
/** Janela devolvida em volta da ocorrência encontrada pela busca. */
const MEMORY_EXCERPT_CHARS = 800;

/**
 * Trecho em volta da ocorrência. Sem ocorrência posicional (casou por título ou
 * tag), devolve o começo — que continua sendo a melhor aposta nesse caso.
 */
function excerpt(content: string, at: number): string {
  if (at < 0) return content.slice(0, MEMORY_EXCERPT_CHARS);
  const start = Math.max(0, at - Math.floor(MEMORY_EXCERPT_CHARS / 3));
  const slice = content.slice(start, start + MEMORY_EXCERPT_CHARS);
  return start > 0 ? `[...] ${slice}` : slice;
}
