/**
 * Canvas Orchestration — protocolo de eventos de workflow.
 *
 * Ponte de observabilidade entre a execução do canvas e o mundo exterior
 * (CLI `--verbose`, servidor de edição visual via SSE, SDK). Cada evento É um
 * fato do runtime: nada aqui é inventado — a origem são as chamadas reais de
 * `produce`, o message bus agente-a-agente e o resultado do Orchestrator.
 *
 * O formato é estável e versionável: consumidores podem renderizar a execução
 * ao vivo (animar arestas quando `message.sent`, pintar nós quando
 * `node.started`/`node.completed`) ou re-executar a timeline de um run
 * (`events` no resultado de `executeWorkflow`).
 */

import { EventEmitter } from 'events';

export type WorkflowEventType =
  | 'workflow.started'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'node.started'
  | 'node.completed'
  | 'node.failed'
  | 'message.sent'
  | 'model.resolved';

export interface WorkflowEventBase {
  type: WorkflowEventType;
  runId: string;
  /** ISO timestamp do evento (origem: relógio do processo). */
  at: string;
}

/** Nó começou a produzir (uma chamada real de `produce`). */
export interface NodeStartedEvent extends WorkflowEventBase {
  type: 'node.started';
  nodeId: string;
  kind: string;
  agent?: string;
  attempt?: number;
}

/** Nó terminou de produzir com sucesso (ou foi pulado). */
export interface NodeCompletedEvent extends WorkflowEventBase {
  type: 'node.completed';
  nodeId: string;
  status: 'succeeded' | 'skipped';
  latencyMs: number;
  tokens: number;
  model?: string;
  provider?: string;
  /** Resumo curto do artefato produzido (nunca o conteúdo integral). */
  outputSummary?: string;
}

/** Nó falhou ao produzir (o Orchestrator decide retry/heal; o evento registra o fato). */
export interface NodeFailedEvent extends WorkflowEventBase {
  type: 'node.failed';
  nodeId: string;
  error: string;
  attempt?: number;
}

/** Mensagem agente-a-agente publicada no bus (aresta com `izanagi.messageType`). */
export interface MessageSentEvent extends WorkflowEventBase {
  type: 'message.sent';
  messageId: string;
  from: string;
  to: string | string[];
  messageType: string;
  tokenEstimate?: number;
  /** Chaves do payload — NUNCA o conteúdo (pode conter segredos/artefatos). */
  payloadKeys: string[];
}

/** Modelo resolvido por nó (auto via ModelRouter / manual / inherit). */
export interface ModelResolvedEvent extends WorkflowEventBase {
  type: 'model.resolved';
  nodeId: string;
  model: string;
  provider: string;
  source: 'auto' | 'manual' | 'inherit';
  reasons: string[];
}

/** Eventos de ciclo de vida do workflow inteiro. */
export interface WorkflowLifecycleEvent extends WorkflowEventBase {
  type: 'workflow.started' | 'workflow.paused' | 'workflow.resumed' | 'workflow.completed' | 'workflow.failed' | 'workflow.cancelled';
  /** Status do run quando aplicável (PASS/FAIL/BLOCKED/HUMAN_REQUIRED...). */
  status?: string;
  score?: number;
  reason?: string;
}

export type WorkflowEvent =
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | MessageSentEvent
  | ModelResolvedEvent
  | WorkflowLifecycleEvent;

/** Mapa tipo de evento → shape do evento (para assinatura tipada). */
export type WorkflowEventOfType<K extends WorkflowEventType> = Extract<WorkflowEvent, { type: K }>;

/**
 * Coletor + distribuidor de eventos de workflow.
 *
 * Um run cria UMA instância (com o runId do run) e a passa ao executor via
 * `onWorkflowEvent`. A instância registra todos os eventos (replay possível
 * para o editor visual/JU) e notifica assinantes em tempo real (SSE).
 */
export class WorkflowEventBus {
  private readonly events: WorkflowEvent[] = [];
  private readonly emitter = new EventEmitter();

  constructor(readonly runId: string) {
    this.emitter.setMaxListeners(50);
  }

  /** Registra e notifica. Retorna o próprio evento (para cadeias). */
  emit(event: WorkflowEvent): WorkflowEvent {
    this.events.push(event);
    this.emitter.emit(event.type, event);
    // Assinantes de `'*'` vivem no canal `all`: sem esta segunda emissão eles
    // nunca veriam nada (o emit acima vai só para o canal do tipo específico).
    this.emitter.emit('all', event);
    return event;
  }

  /** Assina um tipo (ou `'*'` para todos). Retorna unsubscribe. */
  on<K extends WorkflowEventType | '*'>(
    type: K,
    handler: (event: K extends WorkflowEventType ? WorkflowEventOfType<K> : WorkflowEvent) => void,
  ): () => void {
    // O EventEmitter entrega o evento pelo canal certo; o cast preserva o
    // contrato estreito que o handler declarou para `K`.
    const listener = (e: WorkflowEvent): void => handler(e as never);
    this.emitter.on(type === '*' ? 'all' : type, listener);
    return () => {
      this.emitter.off(type === '*' ? 'all' : type, listener);
    };
  }

  /** Todos os eventos registrados até agora (timeline do run). */
  all(): readonly WorkflowEvent[] {
    return this.events;
  }

  close(): void {
    this.emitter.removeAllListeners();
  }
}

/* ============================ FACTORY HELPERS ============================ */

function base<T extends WorkflowEventType>(type: T, runId: string): { type: T; runId: string; at: string } {
  return { type, runId, at: new Date().toISOString() };
}

export function makeNodeStarted(runId: string, nodeId: string, kind: string, agent?: string, attempt?: number): NodeStartedEvent {
  return { ...base('node.started', runId), nodeId, kind, ...(agent ? { agent } : {}), ...(attempt !== undefined ? { attempt } : {}) };
}

export function makeNodeCompleted(
  runId: string,
  nodeId: string,
  data: { status?: 'succeeded' | 'skipped'; latencyMs?: number; tokens?: number; model?: string; provider?: string; outputSummary?: string },
): NodeCompletedEvent {
  return {
    ...base('node.completed', runId),
    nodeId,
    status: data.status ?? 'succeeded',
    latencyMs: data.latencyMs ?? 0,
    tokens: data.tokens ?? 0,
    ...(data.model ? { model: data.model } : {}),
    ...(data.provider ? { provider: data.provider } : {}),
    ...(data.outputSummary ? { outputSummary: data.outputSummary } : {}),
  };
}

export function makeNodeFailed(runId: string, nodeId: string, error: string, attempt?: number): NodeFailedEvent {
  return { ...base('node.failed', runId), nodeId, error, ...(attempt !== undefined ? { attempt } : {}) };
}

export function makeMessageSent(
  runId: string,
  data: { messageId: string; from: string; to: string | string[]; messageType: string; tokenEstimate?: number; payloadKeys: string[] },
): MessageSentEvent {
  return {
    ...base('message.sent', runId),
    messageId: data.messageId,
    from: data.from,
    to: data.to,
    messageType: data.messageType,
    ...(data.tokenEstimate !== undefined ? { tokenEstimate: data.tokenEstimate } : {}),
    payloadKeys: data.payloadKeys,
  };
}

export function makeModelResolved(runId: string, data: { nodeId: string; model: string; provider: string; source: 'auto' | 'manual' | 'inherit'; reasons: string[] }): ModelResolvedEvent {
  return { ...base('model.resolved', runId), ...data };
}

export function makeWorkflowLifecycle(
  runId: string,
  type: WorkflowLifecycleEvent['type'],
  data?: { status?: string; score?: number; reason?: string },
): WorkflowLifecycleEvent {
  return {
    ...base(type, runId),
    ...(data?.status ? { status: data.status } : {}),
    ...(data?.score !== undefined ? { score: data.score } : {}),
    ...(data?.reason ? { reason: data.reason } : {}),
  };
}