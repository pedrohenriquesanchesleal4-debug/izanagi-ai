/**
 * Approval Store — human-in-the-loop real para nós `kind: 'approval'` do
 * grafo de execução (deploy de produção, operação destrutiva, migração de
 * schema, exceção de segurança, mudança arquitetural grande).
 *
 * Um nó de aprovação nunca "passa sozinho": ao ser alcançado sem decisão
 * registrada, o Orchestrator salva checkpoint e PARA (não é falha, não
 * aciona self-healing) — `izanagi approve <run-id>` ou `izanagi reject
 * <run-id>` decide e retoma via o mesmo mecanismo de checkpoint/resume.
 */

import fs from 'fs';
import path from 'path';

export type ApprovalDecision = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  runId: string;
  nodeId: string;
  decision: ApprovalDecision;
  /** Contexto da solicitação (ex.: descrição da ação de alto risco). */
  context?: string;
  reason?: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

const APPROVALS_DIR_REL = path.join('.izanagi', 'state', 'approvals');

export class ApprovalStore {
  private readonly dir: string;

  constructor(opts: { baseDir: string }) {
    this.dir = path.join(opts.baseDir, APPROVALS_DIR_REL);
  }

  get directory(): string {
    return this.dir;
  }

  private fileFor(runId: string): string {
    return path.join(this.dir, `${runId}.json`);
  }

  private loadAll(runId: string): Record<string, ApprovalRecord> {
    const file = this.fileFor(runId);
    if (!fs.existsSync(file)) return {};
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, ApprovalRecord>;
    } catch {
      return {};
    }
  }

  private saveAll(runId: string, records: Record<string, ApprovalRecord>): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.fileFor(runId), JSON.stringify(records, null, 2), 'utf-8');
  }

  /** Cria (ou devolve, se já existir) a solicitação de aprovação pendente para um nó. */
  request(runId: string, nodeId: string, context?: string): ApprovalRecord {
    const all = this.loadAll(runId);
    if (all[nodeId]) return all[nodeId];
    const record: ApprovalRecord = { runId, nodeId, decision: 'pending', context, requestedAt: new Date().toISOString() };
    all[nodeId] = record;
    this.saveAll(runId, all);
    return record;
  }

  get(runId: string, nodeId: string): ApprovalRecord | undefined {
    return this.loadAll(runId)[nodeId];
  }

  /** Todas as aprovações pendentes de um run — usado por `izanagi approve/reject` sem nodeId explícito. */
  pendingFor(runId: string): ApprovalRecord[] {
    return Object.values(this.loadAll(runId)).filter((r) => r.decision === 'pending');
  }

  decide(runId: string, nodeId: string, decision: 'approved' | 'rejected', opts: { reason?: string; decidedBy?: string } = {}): ApprovalRecord {
    const all = this.loadAll(runId);
    const existing = all[nodeId] ?? { runId, nodeId, decision: 'pending' as const, requestedAt: new Date().toISOString() };
    const updated: ApprovalRecord = {
      ...existing,
      decision,
      reason: opts.reason,
      decidedBy: opts.decidedBy,
      decidedAt: new Date().toISOString(),
    };
    all[nodeId] = updated;
    this.saveAll(runId, all);
    return updated;
  }
}

/**
 * Acha o próximo nó de aprovação a decidir: primeiro no ApprovalStore (caso
 * normal — o Orchestrator já criou a solicitação ao pausar); se vazio, cai
 * para uma varredura defensiva do grafo do checkpoint por um nó `approval`
 * ainda não decidido (não deveria ser necessário na prática, mas evita que
 * `izanagi approve/reject` fiquem sem saída por uma inconsistência de estado).
 */
export function findPendingApprovalNodeId(
  approvals: ApprovalStore,
  runId: string,
  graph?: { nodes: Array<{ id: string; kind: string; status?: string }> },
): string | undefined {
  const fromStore = approvals.pendingFor(runId)[0]?.nodeId;
  if (fromStore) return fromStore;
  return graph?.nodes.find((n) => n.kind === 'approval' && n.status !== 'succeeded' && n.status !== 'failed')?.id;
}
