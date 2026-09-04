/**
 * Prazo por nó.
 *
 * `node.timeoutMs` é escrito por TODO o caminho de planejamento (templates do
 * Planner, os quatro modos do Commander, os três nós de tool) e vira
 * `TaskContract.budget.maxTimeMs`. Nada no runtime lia esses campos: um
 * provider pendurado ou uma tool externa registrada por `ToolRegistry.register`
 * travava o nó até o timeout HTTP do cliente de modelo, e uma tool sem cliente
 * HTTP nenhum travava indefinidamente. Prazo declarado e não aplicado é pior
 * que prazo ausente, porque o plano afirma um limite que não existe.
 *
 * Prazo e CANCELAMENTO andam juntos aqui, e a diferença entre os dois importa:
 *
 * - **Prazo** (`timeoutMs`) interrompe a ESPERA de um nó. Ele não cancela a
 *   requisição por si: o que se ganha é o nó parar de bloquear o grafo, e a
 *   falha ser classificável (`timeout` já é `recoverable` no `Healer`).
 * - **Cancelamento** (`signal`) é do RUN inteiro, e chega até a requisição: o
 *   `AbortSignal` é combinado com o timeout HTTP em `llm/client.ts`, então a
 *   chamada em voo é abortada de verdade em vez de continuar consumindo cota
 *   de um run que ninguém mais espera. Cancelamento antes de começar não gasta
 *   a chamada.
 *
 * As duas rejeições são de tipos distintos (`DeadlineExceededError` e
 * `RunAbortedError`) porque o healing decide coisas diferentes: prazo estourado
 * é retentável, run cancelado não é (`non-recoverable` no `Healer`, pela mesma
 * regra dos tetos: cancelar de novo não muda o resultado).
 */

/** Erro de cancelamento do run, distinto de estouro de prazo e de falha do trabalho. */
export class RunAbortedError extends Error {
  constructor(readonly label: string, reason?: string) {
    super(`run cancelado${reason ? `: ${reason}` : ''} durante "${label}"`);
    this.name = 'RunAbortedError';
  }
}

/** Erro de prazo, para o caller distinguir estouro de prazo de falha do trabalho. */
export class DeadlineExceededError extends Error {
  constructor(readonly label: string, readonly timeoutMs: number) {
    super(`timeout de ${timeoutMs}ms excedido em "${label}"`);
    this.name = 'DeadlineExceededError';
  }
}

/** Piso de prazo. Abaixo disto o prazo derrubaria trabalho legítimo. */
export const MIN_DEADLINE_MS = 1000;

/**
 * Resolve o prazo efetivo de um nó: o MENOR entre o do contrato e o do nó,
 * quando os dois existem. Valor ausente, zero ou negativo significa "sem
 * prazo", nunca "prazo zero" — a mesma regra de "ausência não é aprovação"
 * aplicada a um teto.
 */
export function resolveDeadlineMs(
  candidates: Array<number | undefined>,
): number | undefined {
  const valid = candidates.filter(
    (ms): ms is number => typeof ms === 'number' && Number.isFinite(ms) && ms >= MIN_DEADLINE_MS,
  );
  if (valid.length === 0) return undefined;
  return Math.min(...valid);
}

/**
 * Executa `work` com prazo. Sem prazo, devolve `work` intocado: nenhum timer,
 * nenhuma diferença de comportamento para quem não declarou limite.
 *
 * A promise perdedora recebe um `catch` vazio de propósito — sem ele, o
 * trabalho que falha DEPOIS do prazo derrubaria o processo com
 * `unhandledRejection`, transformando um nó lento num crash do run.
 */
export async function withDeadline<T>(
  work: () => Promise<T>,
  timeoutMs: number | undefined,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  // Cancelamento antes de começar: não gasta a chamada.
  if (signal?.aborted) throw new RunAbortedError(label, abortReason(signal));
  if (timeoutMs === undefined && !signal) return work();

  let timer: NodeJS.Timeout | undefined;
  let onAbort: (() => void) | undefined;
  const started = work();
  started.catch(() => {});
  try {
    const racers: Array<Promise<T>> = [started];
    if (timeoutMs !== undefined) {
      racers.push(new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DeadlineExceededError(label, timeoutMs)), timeoutMs);
        // O timer não deve manter o processo vivo: um run que terminou não
        // espera o prazo de um nó que já respondeu.
        timer.unref?.();
      }));
    }
    if (signal) {
      racers.push(new Promise<never>((_, reject) => {
        onAbort = () => reject(new RunAbortedError(label, abortReason(signal)));
        signal.addEventListener('abort', onAbort, { once: true });
      }));
    }
    return await Promise.race(racers);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}

/** Motivo do abort em texto, quando quem cancelou informou um. */
function abortReason(signal: AbortSignal): string | undefined {
  const reason = signal.reason;
  if (reason === undefined || reason === null) return undefined;
  if (reason instanceof Error) return reason.message;
  return typeof reason === 'string' ? reason : undefined;
}
