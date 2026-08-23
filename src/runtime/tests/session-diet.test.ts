import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dietHistory,
  summarizeObservation,
  MIN_TURNS,
  RECENT_WINDOW,
  MAX_OBS_CHARS,
  SUMMARY_HEAD_CHARS,
  type DietTurnMessage,
} from '../llm/session-diet.js';
import { OpenAIAdapter, LLMClient } from '../llm/client.js';

/** Mesmo padrão de prompt-cache.test.ts / llm.test.ts: stub de fetch capturando url/init. */
type CapturedRequest = { url: string; body: Record<string, unknown>; headers: Record<string, string> };

function mockFetchCapture(responses: Array<Record<string, unknown>>): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  let call = 0;
  (globalThis as Record<string, unknown>).fetch = (async (url: string, init: RequestInit) => {
    captured.push({
      url,
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const body = responses[Math.min(call, responses.length - 1)] ?? {};
    call += 1;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as unknown as typeof fetch;
  return captured;
}

/** Primeira linha canônica da observação longa (≤ 120 chars, entra inteira no resumo). */
const FIRST_LINE = 'Falha no passo 7 do pipeline de ingestão';

/**
 * Observação multi-linha determinística com métricas calculadas EXPLICITAMENTE
 * a partir das partes (não via implementação sob teste).
 */
function makeLongObservation(rowCount: number, rowBody: string): {
  text: string;
  hiddenLines: number;
  hiddenChars: number;
} {
  const rows = Array.from({ length: rowCount }, (_, i) => `r${i}:${rowBody}`);
  const text = [FIRST_LINE, ...rows].join('\n');
  return {
    text,
    hiddenLines: rows.length,
    hiddenChars: text.length - FIRST_LINE.length,
  };
}

/**
 * Histórico canônico de 12 turnos (≥ MIN_TURNS):
 *   idx 0  system curto          → NUNCA mascarado (prefixo CAPC)
 *   idx 1  user OBSERVAÇÃO LONGA → fora da janela → mascarado
 *   idx 2..7 curtas              → fora da janela, mas curtas → intocadas
 *   idx 8..11 últimas 4          → janela recente RECENT_WINDOW → byte-a-byte
 */
function canonicalHistory(): DietTurnMessage[] {
  const obs = makeLongObservation(12, 'x'.repeat(45));
  return [
    { role: 'system', content: 'Você é o agente Izanagi.' },
    { role: 'user', content: obs.text },
    { role: 'assistant', content: 'Entendi a observação.' },
    { role: 'user', content: 'Continue o passo 8.' },
    { role: 'assistant', content: 'Passo 8 executado.' },
    { role: 'user', content: 'E o passo 9?' },
    { role: 'assistant', content: 'Passo 9 concluído.' },
    { role: 'user', content: 'Registre o resultado.' },
    { role: 'assistant', content: 'Registrado com sucesso.' },
    { role: 'user', content: 'Qual o próximo passo?' },
    { role: 'assistant', content: 'Próximo passo preparado.' },
    { role: 'user', content: 'Execute agora.' },
  ];
}

test('diet: constantes públicas expostas com os valores contratuais', () => {
  assert.equal(MIN_TURNS, 10);
  assert.equal(RECENT_WINDOW, 4);
  assert.equal(MAX_OBS_CHARS, 400);
  assert.equal(SUMMARY_HEAD_CHARS, 120);
});

test('diet: histórico abaixo de MIN_TURNS é retornado INTACTO (identidade referencial)', () => {
  const obs = makeLongObservation(12, 'x'.repeat(45));
  const short: DietTurnMessage[] = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: obs.text }, // longa DEMAIS — ainda assim no-op abaixo do piso
    { role: 'assistant', content: 'ok' },
    { role: 'user', content: 'vá' },
    { role: 'assistant', content: 'feito' },
    { role: 'user', content: 'de novo' },
    { role: 'assistant', content: 'ok de novo' },
    { role: 'user', content: 'mais' },
    { role: 'assistant', content: 'mais feito' },
  ];
  assert.equal(short.length, MIN_TURNS - 1);
  const result = dietHistory(short);
  assert.equal(result, short, '< MIN_TURNS deve devolver a MESMA instância (no-op)');
  assert.equal(result.length, short.length);

  // Knob minTurns customizado: mesmo histórico passa a ser elegível e a
  // observação longa antiga é mascarada (prova de que o piso é configurável).
  const dieted = dietHistory(short, { minTurns: 3 });
  assert.notEqual(dieted, short);
  assert.match(dieted[1]!.content, /\[\+\d+ linhas \/ ~\d+ chars ocultados\]$/);
});

test('diet: ≥10 turnos com observação longa antiga → mascarada em 1 linha com métricas corretas', () => {
  const obs = makeLongObservation(12, 'x'.repeat(45));
  assert.ok(obs.text.length > MAX_OBS_CHARS, `fixture deve exceder ${MAX_OBS_CHARS} (tem ${obs.text.length})`);
  const hist = canonicalHistory();
  const dieted = dietHistory(hist);

  assert.equal(dieted.length, hist.length, 'dieta NUNCA remove mensagens');
  const masked = dieted[1]!;
  assert.equal(masked.role, 'user');
  assert.ok(!masked.content.includes('\n'), 'resumo deve caber em UMA linha');
  assert.equal(
    masked.content,
    `${FIRST_LINE} … [+${obs.hiddenLines} linhas / ~${obs.hiddenChars} chars ocultados]`,
    'formato sintético exato: primeira linha + métricas do que ficou oculto',
  );
  assert.ok(masked.content.length < obs.text.length, 'resumo deve ser menor que o original');

  // Knob maxObsChars customizado: conteúdo médio (abaixo do default) é
  // mascarado com piso menor.
  const medium = `${FIRST_LINE}\n${'y'.repeat(60)}`; // ~101 chars < 400
  const tight = dietHistory(
    [{ role: 'user', content: medium }, { role: 'assistant', content: 'ok' }],
    { minTurns: 1, recentWindow: 0, maxObsChars: 50 },
  );
  assert.match(tight[0]!.content, /^Falha no passo 7 do pipeline de ingestão … \[\+1 linhas \/ ~\d+ chars ocultados\]$/);
});

test('diet: primeira linha acima de 120 chars é truncada EXATAMENTE a SUMMARY_HEAD_CHARS', () => {
  const big = `${'Z'.repeat(300)}\n${'w'.repeat(120)}`;
  assert.equal(big.length, 421);
  assert.ok(big.length > MAX_OBS_CHARS);
  const summary = summarizeObservation(big);
  const expectedHead = 'Z'.repeat(SUMMARY_HEAD_CHARS);
  assert.ok(summary.startsWith(expectedHead), 'head = prefixo de 120 chars da primeira linha não-vazia');
  assert.equal(summary, `${expectedHead} … [+1 linhas / ~${big.length - SUMMARY_HEAD_CHARS} chars ocultados]`);
});

test('diet: janela recente (últimas 4) e curtas fora da janela permanecem BYTE-A-BYTE (mesma referência)', () => {
  const hist = canonicalHistory();
  const dieted = dietHistory(hist);
  assert.equal(dieted.length, hist.length);

  const windowStart = hist.length - RECENT_WINDOW;
  for (let i = windowStart; i < hist.length; i += 1) {
    assert.equal(dieted[i], hist[i], `janela recente idx ${i} deve ser a MESMA referência`);
  }
  // Curtas fora da janela (2..7): intocadas — só conteúdo longo é mascarado.
  for (let i = 2; i <= 7; i += 1) {
    assert.equal(dieted[i], hist[i], `mensagem curta idx ${i} deve ficar intocada`);
  }
  // E a janela recente NEM EXISTIRIA se recentWindow fosse 0 — knob funciona:
  const noWindow = dietHistory(canonicalHistory(), { recentWindow: 0 });
  assert.notEqual(noWindow[11], hist[11]);
  assert.match(noWindow[11]!.content, /Execute agora\. … \[\+0 linhas \/ ~\d+ chars ocultados\]|^Execute agora\.$/);
});

test('diet: role system NUNCA é mascarado — nem longo, nem fora da janela (prefixo cacheável CAPC)', () => {
  const longSystem = 'Regra estável de cache. '.repeat(70); // ~1680 chars >> 400
  const hist: DietTurnMessage[] = [
    { role: 'system', content: longSystem },
    ...canonicalHistory().slice(1),
  ];
  assert.ok(longSystem.length > MAX_OBS_CHARS);
  const dieted = dietHistory(hist, { recentWindow: 2 }); // system bem fora da janela
  assert.equal(dieted[0], hist[0], 'system deve permanecer a MESMA referência (byte-a-byte)');
  assert.equal(dieted[0]!.content, longSystem);
});

test('diet: determinismo — duas execuções sobre a mesma entrada produzem saída idêntica', () => {
  const hist = canonicalHistory();
  const a = dietHistory(hist);
  const b = dietHistory(hist);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // E re-aplicar a dieta sobre uma saída já dietada é idempotente em conteúdo
  // (resumos são estáveis: mesma primeira linha, mesmas métricas congeladas).
  const again = dietHistory(a);
  assert.equal(JSON.stringify(again), JSON.stringify(a));
});

test('diet: bordas do summarizer — linha única, conteúdo só-whitespace e curto intacto', () => {
  // Linha única de 500 chars (sem \n): 0 linhas ocultas, mas o truncamento do
  // head conta como chars ocultados (~280).
  const single = 'q'.repeat(500);
  assert.equal(
    summarizeObservation(single),
    `${'q'.repeat(SUMMARY_HEAD_CHARS)} … [+0 linhas / ~${single.length - SUMMARY_HEAD_CHARS} chars ocultados]`,
  );
  // Só whitespace/newlines (sem primeira linha não-vazia): head vazio, formato
  // colapsa sem espaço inicial.
  const blank = '\n'.repeat(450);
  const blankSummary = summarizeObservation(blank);
  assert.equal(blankSummary, `… [+${blank.split('\n').length - 1} linhas / ~${blank.length} chars ocultados]`);
  // Abaixo do piso: identidade (função total, sem surpresas).
  assert.equal(summarizeObservation('curta'), 'curta');
});

test('diet: integração LLMClient — diet:true envia histórico MASCARADO no fio; sem diet, byte-a-byte', async () => {
  const hist = canonicalHistory();
  const captured = mockFetchCapture([
    { choices: [{ message: { content: 'com dieta' } }], usage: { total_tokens: 10 } },
    { choices: [{ message: { content: 'sem dieta' } }], usage: { total_tokens: 10 } },
  ]);
  const client = new LLMClient([new OpenAIAdapter('sk-test')]);

  await client.complete('openai', { model: 'gpt-4o-mini', messages: hist, diet: true });
  const sentDieted = captured[0]!.body.messages as DietTurnMessage[];
  assert.equal(sentDieted.length, hist.length, 'dieta mascara, nunca remove');
  assert.ok(!sentDieted[1]!.content.includes('\n'));
  const obs = makeLongObservation(12, 'x'.repeat(45));
  assert.equal(sentDieted[1]!.content, `${FIRST_LINE} … [+${obs.hiddenLines} linhas / ~${obs.hiddenChars} chars ocultados]`);

  await client.complete('openai', { model: 'gpt-4o-mini', messages: hist }); // diet ausente = false
  const sentPlain = captured[1]!.body.messages as DietTurnMessage[];
  assert.equal(
    JSON.stringify(sentPlain),
    JSON.stringify(hist),
    'sem diet, o histórico chega ao fio EXATAMENTE como entrou',
  );
});
