/**
 * Canvas Orchestration — message bus agente-a-agente e estado do workflow.
 *
 * Requisito central do produto: agentes se comunicam por MENSAGENS
 * ESTRUTURADAS (não pela concatenação de outputs) — o bus é o canal real.
 * Arenstas do canvas com `izanagi.messageType` viram mensagens no bus; o
 * request/reply usa `correlationId` sem duplicar instância no grafo.
 *
 * O estado compartilhado (`WorkflowState`) é CONTROLADO: cada nó recebe o
 * contexto da sua política, nunca o run inteiro.
 */

import type { AgentMessage, AgentMessageType, CanvasNodeResult, WorkflowState, WorkflowStatus } from './types.js';

let seq = 0;

export class MessageBus {
  readonly runId: string;
  private readonly messages: AgentMessage[] = [];

  constructor(runId: string) {
    this.runId = runId;
  }

  /** Envia mensagem direta (from → to). Retorna a mensagem criada (id estável). */
  send(
    from: string,
    to: string | string[],
    type: AgentMessageType,
    payload: Record<string, unknown>,
    opts: { priority?: 'low' | 'normal' | 'high'; tokenEstimate?: number; correlationId?: string } = {},
  ): AgentMessage {
    const msg: AgentMessage = {
      id: `${this.runId}-m${(seq += 1)}`,
      runId: this.runId,
      from,
      to,
      type,
      payload,
      metadata: {
        timestamp: new Date().toISOString(),
        priority: opts.priority,
        tokenEstimate: opts.tokenEstimate,
        correlationId: opts.correlationId,
      },
    };
    this.messages.push(msg);
    return msg;
  }

  /** Broadcast não-direcionado (orchestrator para especialistas, por exemplo). */
  broadcast(from: string, type: AgentMessageType, payload: Record<string, unknown>, to?: string[]): AgentMessage {
    return this.send(from, to ?? [], type, payload, { priority: 'high' });
  }

  /** Requisição com espera de resposta (request/reply via correlationId). */
  request(from: string, to: string, payload: Record<string, unknown>): { message: AgentMessage; reply: Promise<AgentMessage> } {
    const message = this.send(from, to, 'question', payload);
    const reply = new Promise<AgentMessage>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`request sem resposta: ${from} → ${to} (corr ${message.id})`)), 120_000);
      const check = (): void => {
        const answer = this.findByCorrelation(message.id);
        if (answer && answer.from === to) {
          clearTimeout(deadline);
          resolve(answer);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
    return { message, reply };
  }

  /** Responde a uma mensagem original (preenche correlationId). */
  replyTo(original: AgentMessage, from: string, payload: Record<string, unknown>, type: AgentMessageType = 'answer'): AgentMessage {
    return this.send(from, original.from, type, payload, { correlationId: original.id, priority: original.metadata.priority });
  }

  findByCorrelation(correlationId: string): AgentMessage | undefined {
    return this.messages.find((m) => m.metadata.correlationId === correlationId);
  }

  all(): readonly AgentMessage[] {
    return this.messages;
  }

  /** Mensagens recebidas por um nó (qualquer remetente). */
  receivedBy(nodeId: string): AgentMessage[] {
    return this.messages.filter((m) => m.to === nodeId || (Array.isArray(m.to) && m.to.includes(nodeId)));
  }

  /** Mensagens trocadas entre dois nós (em qualquer direção). */
  between(a: string, b: string): AgentMessage[] {
    return this.messages.filter((m) => {
      const tos = Array.isArray(m.to) ? m.to : [m.to];
      return m.from === a && tos.includes(b);
    });
  }
}

/** Cria estado inicial de workflow. */
export function createWorkflowState(runId: string, input: unknown): WorkflowState {
  return {
    runId,
    input,
    artifacts: {},
    messages: [],
    nodeResults: {},
    variables: {},
    memoryRefs: [],
    metrics: { totalTokens: 0, totalLatencyMs: 0 },
    status: 'pending',
  };
}

export function setWorkflowStatus(state: WorkflowState, status: WorkflowStatus): void {
  state.status = status;
}

export function recordNodeResult(state: WorkflowState, result: CanvasNodeResult): void {
  state.nodeResults[result.nodeId] = result;
  state.metrics.totalLatencyMs += result.latencyMs ?? 0;
  if (result.costUsd !== undefined) {
    state.metrics.estimatedCost = (state.metrics.estimatedCost ?? 0) + result.costUsd;
  }
}

export function accrueTokens(state: WorkflowState, tokens: { input: number; output: number }): void {
  state.metrics.totalTokens += tokens.input + tokens.output;
}

/** Constrói o resumo de mensagem para o trace (resumo de uma linha, não o payload). */
export function summarizeMessage(msg: AgentMessage): string {
  const keys = Object.keys(msg.payload);
  const size = JSON.stringify(msg.payload)?.length ?? keys.length;
  return `${msg.type} de ${msg.from} (${keys.length} chave(s), ~${size} bytes)`;
}