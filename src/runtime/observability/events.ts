/**
 * Event System — pub/sub em tempo real sobre o ciclo de vida de um run.
 *
 * Complementa o Tracer em vez de substituí-lo: o Tracer registra spans e
 * persiste o RunTrace completo em disco DEPOIS que o run termina; o EventBus
 * notifica observadores (dashboard futuro, `izanagi run --watch`, plugins)
 * ENQUANTO o run ainda está executando. Um consome o outro: nada aqui é
 * persistido por padrão — é passageiro, do processo, como qualquer
 * EventEmitter.
 */

import { EventEmitter } from 'events';

export type IzanagiEventName =
  | 'run.started'
  | 'run.completed'
  | 'node.started'
  | 'node.completed'
  | 'evaluation.started'
  | 'evaluation.completed'
  | 'diagnosis.started'
  | 'diagnosis.completed'
  | 'healing.started'
  | 'healing.completed'
  | 'verification.started'
  | 'verification.completed'
  | 'quality_gate.passed'
  | 'quality_gate.failed';

export interface IzanagiEvent {
  name: IzanagiEventName;
  runId: string;
  at: string;
  data?: Record<string, unknown>;
}

/** Nome coringa para observar todos os eventos de um run num só handler. */
export const ALL_EVENTS = '*' as const;

export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor(private readonly runId: string) {
    // Múltiplos observadores (dashboard + CLI --watch + plugins) não deve gerar warning.
    this.emitter.setMaxListeners(50);
  }

  emit(name: IzanagiEventName, data?: Record<string, unknown>): void {
    const event: IzanagiEvent = { name, runId: this.runId, at: new Date().toISOString(), data };
    this.emitter.emit(name, event);
    this.emitter.emit(ALL_EVENTS, event);
  }

  /** Assina um evento (ou `ALL_EVENTS` para todos). Retorna função de unsubscribe. */
  on(name: IzanagiEventName | typeof ALL_EVENTS, handler: (event: IzanagiEvent) => void): () => void {
    this.emitter.on(name, handler);
    return () => {
      this.emitter.off(name, handler);
    };
  }

  once(name: IzanagiEventName | typeof ALL_EVENTS, handler: (event: IzanagiEvent) => void): void {
    this.emitter.once(name, handler);
  }
}
