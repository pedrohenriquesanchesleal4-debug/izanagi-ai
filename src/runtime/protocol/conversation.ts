/**
 * Conversation Log: o registro do que os agentes falaram entre si durante um run.
 *
 * O `protocol/messages.ts` define os OBJETOS trocados; este módulo é o canal.
 * Existe para responder uma pergunta que o trace sozinho não respondia: quem
 * pediu o quê a quem, com base em qual artefato, e o que voltou.
 *
 * A regra da arquitetura vale aqui inteira: mensagem carrega REFERÊNCIA de
 * artefato (`runId:nodeId`), nunca cópia do conteúdo. Um `payload` só entra
 * quando é uma estrutura pequena e decisória (a lista de issues de uma
 * crítica, por exemplo) — nunca o texto produzido pelo nó. Sem isso o log
 * viraria uma segunda cópia do run inteiro, que é exatamente o desperdício que
 * o protocolo existe para evitar.
 *
 * O log é determinístico: nenhuma chamada de modelo, nenhum resumo gerado.
 */

import { createMessage, type AgentMessage, type AgentMessageType } from './messages.js';

/** Linha compacta do log, formato persistido no `RunTrace`. */
export interface ConversationEntry {
  id: string;
  from: string;
  to: string;
  type: AgentMessageType;
  taskId: string;
  artifactRefs?: string[];
  /** Resumo de UMA linha do que a mensagem carrega. Nunca o conteúdo inteiro. */
  summary: string;
  confidence?: number;
  timestamp: string;
}

/** Teto de mensagens guardadas por run: um grafo grande com healing não vira log infinito. */
const MAX_MESSAGES = 500;
/** Teto de chars do resumo de UMA mensagem. */
const MAX_SUMMARY = 240;

function clip(text: string, max = MAX_SUMMARY): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

export class ConversationLog {
  private readonly entries: ConversationEntry[] = [];
  /** Mensagens descartadas pelo teto: contadas para que o log nunca minta por omissão. */
  private dropped = 0;

  /**
   * Registra uma mensagem. `summary` é obrigatório e é o que aparece no
   * `izanagi explain`: quem não conseguir resumir a mensagem em uma linha
   * provavelmente está tentando mandar conteúdo, e não uma mensagem.
   */
  record(input: {
    from: string;
    to: string;
    type: AgentMessageType;
    taskId: string;
    summary: string;
    artifactRefs?: string[];
    payload?: unknown;
    confidence?: number;
  }): AgentMessage {
    const message = createMessage({
      from: input.from,
      to: input.to,
      type: input.type,
      taskId: input.taskId,
      ...(input.artifactRefs ? { artifactRefs: input.artifactRefs } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    });
    if (this.entries.length >= MAX_MESSAGES) {
      this.dropped++;
      return message;
    }
    this.entries.push({
      id: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      taskId: message.taskId,
      ...(message.artifactRefs ? { artifactRefs: message.artifactRefs } : {}),
      summary: clip(input.summary),
      ...(message.confidence !== undefined ? { confidence: message.confidence } : {}),
      timestamp: message.timestamp,
    });
    return message;
  }

  /** Todas as mensagens registradas, em ordem cronológica. */
  all(): ConversationEntry[] {
    return this.entries.slice();
  }

  /** Mensagens de uma tarefa específica (nodeId). */
  forTask(taskId: string): ConversationEntry[] {
    return this.entries.filter((e) => e.taskId === taskId);
  }

  get size(): number {
    return this.entries.length;
  }

  get droppedCount(): number {
    return this.dropped;
  }

  /** Contagem por tipo, para a telemetria e o relatório final. */
  countByType(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.entries) out[e.type] = (out[e.type] ?? 0) + 1;
    return out;
  }
}
