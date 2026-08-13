/**
 * Checkpoint Store — estado persistente suficiente para reconstruir e
 * retomar uma execução interrompida (crash, kill, timeout do processo).
 *
 * Diferente do Tracer (que só persiste o resultado FINAL de um run), o
 * checkpoint é salvo incrementalmente durante a execução — a cada rodada de
 * batches do Orchestrator — para que `izanagi resume <run-id>` continue de
 * onde parou em vez de reexecutar tudo.
 */

import fs from 'fs';
import path from 'path';
import type { ExecutionGraph } from '../types.js';
import type { PhaseId } from '../token/budget.js';

export interface CheckpointArtifact {
  nodeId: string;
  kind: string;
  content: unknown;
  valid: boolean;
  score: number;
}

export interface CheckpointData {
  runId: string;
  task: string;
  category: string;
  primaryAgent: string;
  skillChain: string[];
  model: string;
  provider: string;
  graph: ExecutionGraph;
  artifacts: CheckpointArtifact[];
  budgetSpent: Partial<Record<PhaseId, number>>;
  attempts: number;
  tokensUsed: number;
  savedAt: string;
}

const CHECKPOINT_DIR_REL = path.join('.izanagi', 'state', 'checkpoints');

export class CheckpointStore {
  private readonly dir: string;

  constructor(opts: { baseDir: string }) {
    this.dir = path.join(opts.baseDir, CHECKPOINT_DIR_REL);
  }

  get directory(): string {
    return this.dir;
  }

  private fileFor(runId: string): string {
    return path.join(this.dir, `${runId}.json`);
  }

  /** Persiste (sobrescreve) o checkpoint do run — chamado a cada rodada de batches. */
  save(data: CheckpointData): string {
    fs.mkdirSync(this.dir, { recursive: true });
    const file = this.fileFor(data.runId);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return file;
  }

  load(runId: string): CheckpointData | null {
    const file = this.fileFor(runId);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as CheckpointData;
    } catch {
      return null;
    }
  }

  /** Remove o checkpoint — chamado quando o run completa (nada mais a resumir). */
  delete(runId: string): void {
    const file = this.fileFor(runId);
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  /** Lista checkpoints pendentes (execuções interrompidas, resumíveis), mais recente primeiro. */
  list(): CheckpointData[] {
    if (!fs.existsSync(this.dir)) return [];
    const out: CheckpointData[] = [];
    for (const f of fs.readdirSync(this.dir).filter((n) => n.endsWith('.json'))) {
      try {
        out.push(JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf-8')) as CheckpointData);
      } catch {
        // checkpoint corrompido — ignora, não derruba a listagem
      }
    }
    return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  }
}

/** Progresso resumido de um checkpoint — usado por `izanagi resume`/`doctor`/`explain`. */
export function checkpointProgress(data: CheckpointData): { done: number; total: number; pendingNodeIds: string[] } {
  const done = data.graph.nodes.filter((n) => n.status === 'succeeded' || n.status === 'skipped').length;
  const pendingNodeIds = data.graph.nodes
    .filter((n) => n.status !== 'succeeded' && n.status !== 'skipped')
    .map((n) => n.id);
  return { done, total: data.graph.nodes.length, pendingNodeIds };
}
