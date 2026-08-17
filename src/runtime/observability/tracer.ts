/**
 * Observability / Tracing — registra cada execução do runtime em disco (JSON).
 *
 * Cada run gera um arquivo `.izanagi/state/traces/<runId>.json` com spans
 * estruturados: task, decisões, agentes, skills, tools, modelo, tokens,
 * latência, retries, falhas, artefatos, avaliação e score final.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { RunTrace, TraceSpan } from '../types.js';
import { EventBus, ALL_EVENTS, type IzanagiEvent } from './events.js';

export const TRACE_DIR_REL = path.join('.izanagi', 'state', 'traces');

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

export interface TraceStoreOptions {
  baseDir: string;
}

/**
 * Store de traces em disco. Thread-safe o suficiente para CLI single-process.
 */
export class TraceStore {
  private readonly dir: string;

  constructor(private readonly opts: TraceStoreOptions) {
    this.dir = path.join(opts.baseDir, TRACE_DIR_REL);
  }

  get directory(): string {
    return this.dir;
  }

  ensure(): void {
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /** Gera um novo run id legível (izanagi-YYYYMMDD-HHMMSS-xxxx). */
  static newRunId(): string {
    const d = new Date();
    const pad = (n: number, l = 2) => String(n).padStart(l, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `izanagi-${stamp}-${crypto.randomBytes(2).toString('hex')}`;
  }

  private fileFor(runId: string): string {
    return path.join(this.dir, `${runId}.json`);
  }

  /** Persiste um trace completo. */
  save(trace: RunTrace): string {
    this.ensure();
    const file = this.fileFor(trace.runId);
    fs.writeFileSync(file, JSON.stringify(trace, null, 2), 'utf-8');
    return file;
  }

  /** Carrega um trace pelo runId (ou path). */
  load(runId: string): RunTrace | null {
    const file = path.join(this.dir, `${runId}.json`);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as RunTrace;
    } catch {
      return null;
    }
  }

  /** Lista traces, mais recentes primeiro. */
  list(limit = 20): RunTrace[] {
    if (!fs.existsSync(this.dir)) return [];
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf-8')) as RunTrace;
        } catch {
          return null;
        }
      })
      .filter((t): t is RunTrace => t !== null)
      .sort((a, b) => {
        if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? 1 : -1;
        return (b.seq ?? 0) - (a.seq ?? 0);
      })
      .slice(0, limit);
  }
}

export interface TraceContext {
  runId: string;
  task: string;
  command: string;
  startedAt: string;
  agents: Set<string>;
  skills: Set<string>;
  tools: Set<string>;
  retries: number;
  failures: number;
  spans: TraceSpan[];
}

/** Contador monotônico do processo — desempata runs criados no mesmo milissegundo. */
let seqCounter = 0;

/**
 * Sessão de tracing ativa durante um run. Fecha o span ao finalizar e
 * produz um RunTrace persistível.
 */
export class Tracer {
  private readonly ctx: TraceContext;
  private readonly store: TraceStore;
  private readonly seq: number;
  private tokensIn = 0;
  private tokensOut = 0;
  /** Event System — pub/sub em tempo real do ciclo de vida deste run (ver observability/events.ts). */
  readonly events: EventBus;

  constructor(store: TraceStore, opts: { runId?: string; task: string; command: string; onEvent?: (event: IzanagiEvent) => void }) {
    this.store = store;
    this.seq = seqCounter++;
    this.ctx = {
      runId: opts.runId || TraceStore.newRunId(),
      task: opts.task,
      command: opts.command,
      startedAt: nowIso(),
      agents: new Set(),
      skills: new Set(),
      tools: new Set(),
      retries: 0,
      failures: 0,
      spans: [],
    };
    this.events = new EventBus(this.ctx.runId);
    // Assina ANTES de emitir o primeiro evento — senão um onEvent passado pelo
    // caller nunca veria 'run.started' (a subscrição chegaria tarde demais).
    if (opts.onEvent) this.events.on(ALL_EVENTS, opts.onEvent);
    this.events.emit('run.started', { task: opts.task, command: opts.command });
  }

  get runId(): string {
    return this.ctx.runId;
  }

  get task(): string {
    return this.ctx.task;
  }

  /**
   * Abre um span; retorna uma função close(ok?, error?) que registra duração.
   */
  span(
    name: string,
    type: TraceSpan['type'],
    metadata?: Record<string, unknown>,
  ): (ok?: boolean, error?: string) => void {
    const started = nowMs();
    const startedAt = nowIso();
    const id = `${this.ctx.spans.length + 1}-${name.replace(/[^a-z0-9-]/gi, '').slice(0, 24)}`;
    let closed = false;

    const close = (ok = true, error?: string): void => {
      if (closed) return;
      closed = true;
      const ended = nowMs();
      this.ctx.spans.push({
        id,
        name,
        type,
        status: ok ? 'ok' : 'error',
        startedAt,
        endedAt: nowIso(),
        durationMs: ended - started,
        metadata,
        error,
      });
      if (!ok) {
        this.ctx.failures++;
        if (metadata?.retry) this.ctx.retries++;
      }
    };

    return close;
  }

  markAgent(agent: string): void {
    this.ctx.agents.add(agent);
  }

  markSkill(skill: string): void {
    this.ctx.skills.add(skill);
  }

  markTool(tool: string): void {
    this.ctx.tools.add(tool);
  }

  addTokens(input: number, output: number): void {
    this.tokensIn += input;
    this.tokensOut += output;
  }

  /** Finaliza a sessão e devolve o RunTrace montado. */
  finish(extra?: Partial<RunTrace>): RunTrace {
    const ended = nowMs();
    const startedMs = Date.parse(this.ctx.startedAt);
    const trace: RunTrace = {
      runId: this.ctx.runId,
      task: this.ctx.task,
      seq: this.seq,
      startedAt: this.ctx.startedAt,
      endedAt: nowIso(),
      durationMs: ended - startedMs,
      command: this.ctx.command,
      tokens: { input: this.tokensIn, output: this.tokensOut, total: this.tokensIn + this.tokensOut },
      retries: this.ctx.retries,
      failures: this.ctx.failures,
      agents: Array.from(this.ctx.agents),
      skills: Array.from(this.ctx.skills),
      tools: Array.from(this.ctx.tools),
      artifacts: [],
      spans: this.ctx.spans,
      ...extra,
    };
    return trace;
  }

  /** Finaliza e persiste. Retorna o runId. */
  finishAndSave(extra?: Partial<RunTrace>): { trace: RunTrace; file: string } {
    const trace = this.finish(extra);
    const file = this.store.save(trace);
    this.events.emit('run.completed', { verdict: trace.evaluation?.verdict, score: trace.evaluation?.score, durationMs: trace.durationMs });
    return { trace, file };
  }
}
