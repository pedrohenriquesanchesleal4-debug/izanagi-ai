/**
 * Caminho "local-first + agendador do SO".
 *
 * Decisão de produto tomada: o Izanagi NÃO fica de pé. Quem agenda é o cron ou
 * o Task Scheduler; o que faltava era o Izanagi ser consumível por eles — saída
 * estruturada, código de saída com significado, e um aviso de fim.
 *
 * A regra que estes testes protegem é a do payload: o webhook leva METADADO,
 * nunca conteúdo de artefato. Um endpoint de notificação costuma ser um canal
 * de equipe ou um serviço que ninguém auditou, e mandar para lá o que os
 * agentes produziram é exfiltração com aparência de conveniência.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotification,
  exitCodeFor,
  notifyWebhook,
  validateWebhookUrl,
  type NotifiableRun,
} from '../notify/webhook.js';
import { parseRunArgs } from '../../cli/commands/run.js';

const SEGREDO = 'CONTEUDO-SENSIVEL-DO-ARTEFATO-QUE-NAO-PODE-SAIR';

function runResult(overrides: Partial<NotifiableRun> = {}): NotifiableRun {
  return {
    status: 'PASS',
    score: 0.92,
    mode: 'orchestrated',
    healing: [{ kind: 'retry', nodeId: 'execute' }],
    verification: [{ nodeId: 'execute', result: { status: 'VERIFIED', score: 1 } }],
    telemetry: { estimatedCostUsd: 0.0123 },
    traceFile: '/tmp/trace.json',
    trace: {
      runId: 'izanagi-1',
      task: 'auditar a API',
      durationMs: 4200,
      tokens: { total: 1500 },
      artifacts: [{ name: 'execute', kind: 'raw', valid: true }],
    },
    ...overrides,
  };
}

/* ============================ payload ============================ */

test('agendador: a notificação leva metadado, nunca conteúdo de artefato', () => {
  const payload = buildNotification(runResult());
  const serializado = JSON.stringify(payload);
  assert.ok(!serializado.includes(SEGREDO));
  assert.ok(!serializado.includes('content'), 'nenhum campo de conteúdo pode existir no payload');
  assert.deepEqual(payload.artifacts, [{ name: 'execute', kind: 'raw', valid: true }]);
  assert.equal(payload.runId, 'izanagi-1');
  assert.equal(payload.tokens, 1500);
  assert.equal(payload.costUsd, 0.0123);
  assert.equal(payload.verification[0].status, 'VERIFIED');
});

test('agendador: artefato sem validade avaliada não vira "válido"', () => {
  const payload = buildNotification(runResult({
    trace: { runId: 'r', task: 't', durationMs: 1, artifacts: [{ name: 'x', kind: 'raw' }] },
  }));
  assert.equal(payload.artifacts[0].valid, false);
});

test('agendador: o payload diz O QUE foi gravado, em caminho relativo', () => {
  const payload = buildNotification(runResult({
    produced: { delivered: 'docs/auditar-a-api.md', materialized: ['docs/auditar-a-api/src/routes/a.ts'] },
  }));
  assert.equal(payload.produced?.delivered, 'docs/auditar-a-api.md');
  assert.deepEqual(payload.produced?.materialized, ['docs/auditar-a-api/src/routes/a.ts']);
  // Caminho é metadado e cabe na regra; caminho ABSOLUTO não cabe, porque
  // carrega o diretório do usuário para um endpoint que costuma ser canal de
  // equipe. Quem monta o payload é responsável por mandar relativo.
  assert.ok(!JSON.stringify(payload.produced).includes('/home/'));
  assert.ok(!JSON.stringify(payload.produced).includes('C:\\'));
});

test('agendador: run que não gravou nada omite o campo — ausência significa "não gravou"', () => {
  assert.equal(buildNotification(runResult()).produced, undefined);
  assert.equal(buildNotification(runResult({ produced: { materialized: [] } })).produced, undefined);
});

/* ============================ código de saída ============================ */

test('agendador: o código de saída diz o que aconteceu sem parsear nada', () => {
  assert.equal(exitCodeFor({ status: 'PASS' }), 0);
  assert.equal(exitCodeFor({ status: 'PASS_WITH_WARNINGS' }), 0);
  assert.equal(exitCodeFor({ status: 'FAIL' }), 1);
  assert.equal(exitCodeFor({ status: 'UNKNOWN' }), 1);
  // Aguardar aprovação não é falha e não deve alertar como falha: alguém
  // precisa aprovar, não consertar.
  assert.equal(exitCodeFor({ status: 'BLOCKED', pendingApproval: { nodeId: 'gate' } }), 2);
});

/* ============================ webhook ============================ */

test('webhook: só http e https; file: e data: são caminho de leitura, não notificação', () => {
  assert.equal(validateWebhookUrl('https://exemplo.com/hook').ok, true);
  assert.equal(validateWebhookUrl('http://localhost:3000/hook').ok, true);
  for (const ruim of ['file:///etc/passwd', 'data:text/plain,x', 'ftp://x/y', 'nao-e-url']) {
    const r = validateWebhookUrl(ruim);
    assert.equal(r.ok, false, `deveria recusar: ${ruim}`);
  }
});

test('webhook: entrega o payload como JSON no POST', async () => {
  let visto: { url: string; body: string; method?: string } | null = null;
  const out = await notifyWebhook('https://exemplo.com/hook', buildNotification(runResult()), {
    fetchImpl: (async (url: string, init: RequestInit) => {
      visto = { url: String(url), body: String(init.body), ...(init.method ? { method: init.method } : {}) };
      return { ok: true, status: 204 } as Response;
    }) as unknown as typeof fetch,
  });
  assert.equal(out.ok, true);
  assert.equal(out.attempts, 1);
  assert.equal(visto!.method, 'POST');
  assert.equal(JSON.parse(visto!.body).runId, 'izanagi-1');
});

test('webhook: 4xx não é repetido, 5xx é', async () => {
  let chamadas = 0;
  const comStatus = (status: number) =>
    notifyWebhook('https://exemplo.com/hook', buildNotification(runResult()), {
      fetchImpl: (async () => {
        chamadas++;
        return { ok: false, status } as Response;
      }) as unknown as typeof fetch,
    });

  chamadas = 0;
  const quatro = await comStatus(404);
  assert.equal(quatro.ok, false);
  assert.equal(chamadas, 1, 'configuração errada não melhora repetindo');

  chamadas = 0;
  const cinco = await comStatus(503);
  assert.equal(cinco.ok, false);
  assert.equal(chamadas, 2, 'instabilidade merece uma segunda tentativa');
});

test('webhook: falha de rede volta como resultado, nunca como exceção', async () => {
  const out = await notifyWebhook('https://exemplo.com/hook', buildNotification(runResult()), {
    fetchImpl: (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch,
  });
  assert.equal(out.ok, false);
  assert.match(out.error ?? '', /ECONNREFUSED/);
  assert.equal(out.attempts, 2);
});

test('webhook: URL inválida nem chega a fazer requisição', async () => {
  let chamou = false;
  const out = await notifyWebhook('file:///etc/passwd', buildNotification(runResult()), {
    fetchImpl: (async () => {
      chamou = true;
      return { ok: true, status: 200 } as Response;
    }) as unknown as typeof fetch,
  });
  assert.equal(out.ok, false);
  assert.equal(chamou, false);
  assert.equal(out.attempts, 0);
});

/* ============================ flags ============================ */

test('agendador: --json e --notify-webhook são reconhecidos nas duas formas', () => {
  const igual = parseRunArgs(['auditar', 'a', 'API', '--json', '--notify-webhook=https://exemplo.com/h']);
  assert.equal(igual.json, true);
  assert.equal(igual.notifyWebhook, 'https://exemplo.com/h');

  const espaco = parseRunArgs(['--task', 'x', '--notify-webhook', 'https://outro.com/h']);
  assert.equal(espaco.notifyWebhook, 'https://outro.com/h');
  assert.equal(espaco.json, false);
});

test('agendador: sem as flags, o comportamento é o de sempre', () => {
  const parsed = parseRunArgs(['criar', 'uma', 'landing']);
  assert.equal(parsed.json, false);
  assert.equal(parsed.notifyWebhook, undefined);
});
