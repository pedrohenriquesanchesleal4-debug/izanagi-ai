/**
 * Notificação de fim de run por webhook.
 *
 * Existe para fechar o caminho "local-first + agendador do SO": o cron (ou o
 * Task Scheduler) invoca o Izanagi, o Izanagi faz o trabalho e avisa. Não há
 * processo de longa duração, não há porta escutando, não há credencial em
 * repouso — o Izanagi continua rodando só quando alguém o invoca, e quem
 * invoca é o agendador do sistema.
 *
 * ## A regra que decide o que vai no payload
 *
 * O webhook leva **metadado, nunca conteúdo de artefato**. Um endpoint de
 * notificação costuma ser um canal de equipe, um túnel de terceiro, ou um
 * serviço que ninguém auditou; mandar para lá o que os agentes produziram é
 * exfiltração acidental com aparência de conveniência. Quem quiser o conteúdo
 * usa `izanagi explain <run-id> --artifacts`, na máquina onde o run aconteceu.
 *
 * Falha de notificação nunca derruba o run: o trabalho já foi feito e
 * verificado quando esta função é chamada.
 */

export interface RunNotification {
  runId: string;
  status: string;
  score: number;
  mode?: string;
  durationMs: number;
  tokens: number;
  costUsd: number;
  /** Verificação por tarefa — status e score, sem o conteúdo verificado. */
  verification: Array<{ nodeId: string; status: string; score: number }>;
  healing: Array<{ kind: string; nodeId?: string }>;
  /** Nome, tipo e validade. Nunca o conteúdo. */
  artifacts: Array<{ name: string; kind: string; valid: boolean }>;
  /**
   * O que o run gravou no projeto, em caminhos RELATIVOS: o documento entregue
   * e os arquivos materializados.
   *
   * Caminho é metadado e cabe na regra do payload; caminho ABSOLUTO não cabe —
   * carrega o diretório do usuário para um endpoint que pode ser um canal de
   * equipe. Ausente quando o run não gravou nada, e ausência aqui significa
   * "não gravou", não "não sei": o agendador precisa dessa diferença para
   * decidir se tem trabalho novo para buscar.
   */
  produced?: { delivered?: string; materialized?: string[] };
  pendingApproval?: { nodeId: string; context?: string };
  traceFile: string;
  task: string;
  notifiedAt: string;
}

export interface WebhookResult {
  ok: boolean;
  status?: number;
  attempts: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Uma retentativa. Endpoint fora do ar não é problema do runtime resolver. */
const MAX_ATTEMPTS = 2;

/**
 * Valida a URL do webhook antes de qualquer requisição.
 *
 * Só `http`/`https`: um `file:` ou `data:` vindo de configuração é caminho de
 * leitura de arquivo, não de notificação. `http` é permitido porque endpoint
 * em rede local (`http://localhost:3000/hook`) é o caso comum de quem está
 * montando isso na própria máquina.
 */
export function validateWebhookUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `URL inválida: "${raw}"` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `protocolo não suportado para webhook: ${url.protocol} (use http ou https)` };
  }
  return { ok: true, url };
}

/**
 * Envia a notificação. Nunca lança: quem chama já terminou o trabalho, e uma
 * falha de rede aqui não pode transformar um run bem-sucedido em erro.
 */
export async function notifyWebhook(
  rawUrl: string,
  payload: RunNotification,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<WebhookResult> {
  const validated = validateWebhookUrl(rawUrl);
  if (!validated.ok) return { ok: false, attempts: 0, error: validated.reason };

  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await doFetch(validated.url.toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'izanagi-ai' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return { ok: true, status: response.status, attempts: attempt };
      lastError = `endpoint respondeu ${response.status}`;
      // 4xx é configuração errada, não instabilidade: repetir não ajuda.
      if (response.status >= 400 && response.status < 500) {
        return { ok: false, status: response.status, attempts: attempt, error: lastError };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, attempts: MAX_ATTEMPTS, error: lastError };
}

/** Superfície mínima do resultado do run consumida pela notificação. */
export interface NotifiableRun {
  status: string;
  score: number;
  mode?: string;
  healing: Array<{ kind: string; nodeId?: string }>;
  verification?: Array<{ nodeId: string; result: { status: string; score: number } }>;
  telemetry?: { estimatedCostUsd?: number };
  pendingApproval?: { nodeId: string; context?: string };
  /** Caminhos relativos do que foi gravado, montados por quem executou o run. */
  produced?: { delivered?: string; materialized?: string[] };
  traceFile: string;
  trace: {
    runId: string;
    task: string;
    durationMs: number;
    tokens?: { total: number };
    artifacts?: Array<{ name: string; kind: string; valid?: boolean }>;
  };
}

/** Monta o payload a partir do resultado do run, aplicando a regra do metadado. */
export function buildNotification(result: NotifiableRun): RunNotification {
  return {
    runId: result.trace.runId,
    status: result.status,
    score: result.score,
    ...(result.mode ? { mode: result.mode } : {}),
    durationMs: result.trace.durationMs,
    tokens: result.trace.tokens?.total ?? 0,
    costUsd: result.telemetry?.estimatedCostUsd ?? 0,
    verification: (result.verification ?? []).map((v) => ({
      nodeId: v.nodeId,
      status: v.result.status,
      score: v.result.score,
    })),
    healing: result.healing.map((h) => ({ kind: h.kind, ...(h.nodeId ? { nodeId: h.nodeId } : {}) })),
    // `valid` ausente no trace significa não avaliado, e a notificação não pode
    // transformar isso em "válido" por conveniência de tipo.
    artifacts: (result.trace.artifacts ?? []).map((a) => ({ name: a.name, kind: a.kind, valid: a.valid === true })),
    ...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {}),
    ...(result.produced && (result.produced.delivered || result.produced.materialized?.length)
      ? { produced: result.produced }
      : {}),
    traceFile: result.traceFile,
    task: result.trace.task,
    notifiedAt: new Date().toISOString(),
  };
}

/**
 * Código de saída do processo, para o agendador saber o que aconteceu sem
 * parsear nada:
 *
 *   0 — trabalho concluído (PASS ou PASS_WITH_WARNINGS)
 *   1 — trabalho falhou
 *   2 — pausado aguardando decisão humana (não é falha, e não deve alertar
 *       como falha: alguém precisa aprovar, não consertar)
 */
export function exitCodeFor(result: { status: string; pendingApproval?: unknown }): number {
  if (result.pendingApproval) return 2;
  return result.status === 'PASS' || result.status === 'PASS_WITH_WARNINGS' ? 0 : 1;
}
