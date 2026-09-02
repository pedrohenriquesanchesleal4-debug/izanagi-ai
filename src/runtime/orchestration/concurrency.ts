/**
 * Pool de concorrência: executa N tarefas com no máximo `limit` em voo.
 *
 * Existe porque `Promise.all` sobre um batch inteiro não tem teto: no template
 * `fullstack`, o batch `[security-review, database-design, product-spec]` faz
 * 3 chamadas simultâneas ao provider, e um plano maior escala sem limite.
 * Provider com rate limit apertado devolve 429, o 429 vira healing, o healing
 * vira retry, e o retry gasta mais token do que a execução serial gastaria.
 *
 * Preserva a ordem dos resultados (índice de entrada = índice de saída), como
 * `Promise.all`, para que quem chama continue casando resultado com tarefa.
 */

/**
 * Concorrência default: 3 tarefas em voo. Escolhido para caber com folga no
 * limite de requisições por minuto dos planos iniciais dos providers, sem
 * serializar um grafo inteiro.
 */
export const DEFAULT_MAX_CONCURRENCY = 3;

/** Concorrência para modelo local: 1. GPU única não ganha nada com paralelismo. */
export const LOCAL_MAX_CONCURRENCY = 1;

/**
 * Executa `tasks` respeitando o teto. `limit <= 0` ou maior que o número de
 * tarefas equivale a rodar tudo junto. Uma tarefa que rejeita NÃO derruba as
 * outras: a rejeição é propagada apenas no índice dela, e quem chama decide.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<{ ok: true; value: T } | { ok: false; error: unknown }>> {
  const results = new Array<{ ok: true; value: T } | { ok: false; error: unknown }>(tasks.length);
  if (tasks.length === 0) return results;

  const effective = limit > 0 ? Math.min(limit, tasks.length) : tasks.length;
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      try {
        results[index] = { ok: true, value: await tasks[index]() };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  };

  await Promise.all(Array.from({ length: effective }, () => worker()));
  return results;
}

/**
 * Instrumentação para teste: além dos resultados, devolve o pico real de
 * tarefas em voo. É a única forma honesta de provar que o teto foi respeitado
 * (contar chamadas não prova simultaneidade).
 */
export async function runWithConcurrencyTracked<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<{ results: Array<{ ok: true; value: T } | { ok: false; error: unknown }>; peakInFlight: number }> {
  let inFlight = 0;
  let peakInFlight = 0;
  const wrapped = tasks.map((task) => async () => {
    inFlight++;
    peakInFlight = Math.max(peakInFlight, inFlight);
    try {
      return await task();
    } finally {
      inFlight--;
    }
  });
  const results = await runWithConcurrency(wrapped, limit);
  return { results, peakInFlight };
}
