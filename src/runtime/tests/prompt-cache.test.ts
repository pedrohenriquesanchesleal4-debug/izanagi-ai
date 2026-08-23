import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DYNAMIC_MARKER,
  MIN_CACHEABLE_TOKENS,
  splitStaticDynamic,
  joinWithoutMarker,
  estimateStaticTokens,
  isPromptCacheEligible,
} from '../llm/prompt-cache.js';
import { OpenAIAdapter, AnthropicAdapter, LLMClient } from '../llm/client.js';

/** Mesmo padrão do llm.test.ts: stub global de fetch capturando url/init. */
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

/** System estático acima do piso Anthropic (1024 tokens ≈ 4096 chars pela heurística chars/4). */
function longStaticSystem(): string {
  // ~4.3k chars ≈ 1075 tokens estimados — folga acima de MIN_CACHEABLE_TOKENS.
  return `Você é o agente Izanagi. ${'Regra estável de comportamento e qualidade. '.repeat(95)}`.trimEnd();
}

test('cache: splitStaticDynamic corta no delimitador (estático antes, dinâmico depois)', () => {
  const system = `${'A'.repeat(200)}\n${DYNAMIC_MARKER}\nContexto volátil da sessão #42`;
  const s = splitStaticDynamic(system);
  assert.equal(s.hasMarker, true);
  assert.equal(s.staticText, `${'A'.repeat(200)}\n`);
  assert.equal(s.dynamicText, '\nContexto volátil da sessão #42');
});

test('cache: splitStaticDynamic sem delimitador = tudo estático; vazio/undefined seguros', () => {
  const s = splitStaticDynamic('prompt totalmente estático');
  assert.deepEqual(s, { staticText: 'prompt totalmente estático', dynamicText: '', hasMarker: false });
  assert.deepEqual(splitStaticDynamic(), { staticText: '', dynamicText: '', hasMarker: false });
  assert.deepEqual(splitStaticDynamic(''), { staticText: '', dynamicText: '', hasMarker: false });
});

test('cache: múltiplos delimitadores — só o primeiro corta', () => {
  const s = splitStaticDynamic(`fixo${DYNAMIC_MARKER}volátil1${DYNAMIC_MARKER}volátil2`);
  assert.equal(s.staticText, 'fixo');
  assert.equal(s.dynamicText, `volátil1${DYNAMIC_MARKER}volátil2`);
});

test('cache: joinWithoutMarker reproduz a entrada exata sem o marcador', () => {
  const system = `prefixo\n${DYNAMIC_MARKER}\nsufixo`;
  assert.equal(joinWithoutMarker(system), 'prefixo\n\nsufixo');
  assert.equal(joinWithoutMarker('sem marcador'), 'sem marcador');
  assert.equal(joinWithoutMarker(), '');
});

test('cache: estimateStaticTokens usa a mesma heurística chars/4 do client', () => {
  assert.equal(estimateStaticTokens('x'.repeat(40)), 10);
  assert.equal(estimateStaticTokens('x'.repeat(4096)), MIN_CACHEABLE_TOKENS);
  assert.ok(estimateStaticTokens('') >= 1);
});

test('cache: isPromptCacheEligible respeita o piso de 1024 tokens', () => {
  assert.equal(MIN_CACHEABLE_TOKENS, 1024);
  assert.equal(isPromptCacheEligible(longStaticSystem()), true);
  assert.equal(isPromptCacheEligible('system curto'), false);
  assert.equal(isPromptCacheEligible(), false);
});

test('cache: Anthropic com system longo + delimitador envia blocos com cache_control SÓ no estático', async () => {
  const dynamicPart = '\nSessão atual: run abc123, nó 7.';
  const system = `${longStaticSystem()}\n${DYNAMIC_MARKER}${dynamicPart}`;
  const captured = mockFetchCapture([
    {
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1300, output_tokens: 10, cache_read_input_tokens: 1120, cache_creation_input_tokens: 0 },
    },
  ]);

  const adapter = new AnthropicAdapter('ak-test');
  await adapter.complete({ model: 'claude-sonnet-4-5', system, messages: [{ role: 'user', content: 'Oi' }] });

  const payload = captured[0]!.body;
  const blocks = payload.system as Array<{ type: string; text: string; cache_control?: { type: string } }>;
  assert.ok(Array.isArray(blocks), 'system longo deve virar array de blocos');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.type, 'text');
  assert.deepEqual(blocks[0]!.cache_control, { type: 'ephemeral' }, 'bloco estático deve ter cache_control');
  assert.equal(blocks[1]!.type, 'text');
  assert.equal(blocks[1]!.cache_control, undefined, 'bloco dinâmico NÃO deve ter cache_control');
  // Fidelidade: concatenação dos blocos == entrada original sem o marcador.
  assert.equal(`${blocks[0]!.text}${blocks[1]!.text}`, `${longStaticSystem()}\n${dynamicPart}`);
});

test('cache: Anthropic sem delimitador mas longo — bloco único todo cacheável', async () => {
  const captured = mockFetchCapture([{ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1200, output_tokens: 5 } }]);
  const adapter = new AnthropicAdapter('ak-test');
  await adapter.complete({ model: 'claude-sonnet-4-5', system: longStaticSystem(), messages: [{ role: 'user', content: 'Oi' }] });

  const blocks = captured[0]!.body.system as Array<{ text: string; cache_control?: unknown }>;
  assert.ok(Array.isArray(blocks));
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0]!.cache_control, { type: 'ephemeral' });
  assert.equal(blocks[0]!.text, longStaticSystem());
});

test('cache: Anthropic system curto permanece STRING simples (retrocompatível)', async () => {
  const captured = mockFetchCapture([{ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 3, output_tokens: 2 } }]);
  const adapter = new AnthropicAdapter('ak-test');
  await adapter.complete({ model: 'claude-sonnet-4-5', system: 'Sistema', messages: [{ role: 'user', content: 'Ola' }] });

  assert.equal(captured[0]!.body.system, 'Sistema', 'abaixo do piso, wire format inalterado');
});

test('cache: Anthropic system curto COM delimitador também fica string crua (como hoje)', async () => {
  const system = `regras curtas\n${DYNAMIC_MARKER}\nctx volátil`;
  const captured = mockFetchCapture([{ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 8, output_tokens: 2 } }]);
  const adapter = new AnthropicAdapter('ak-test');
  await adapter.complete({ model: 'claude-sonnet-4-5', system, messages: [{ role: 'user', content: 'Oi' }] });

  assert.equal(captured[0]!.body.system, system, 'sem elegibilidade, payload byte-a-byte como antes');
});

test('cache: Anthropic extrai cachedTokens de cache_read_input_tokens', async () => {
  mockFetchCapture([
    {
      content: [{ type: 'text', text: 'resp' }],
      usage: { input_tokens: 50, output_tokens: 20, cache_read_input_tokens: 1024 },
    },
  ]);
  const adapter = new AnthropicAdapter('ak-test');
  const result = await adapter.complete({
    model: 'claude-sonnet-4-5',
    system: `${longStaticSystem()}\n${DYNAMIC_MARKER}\ndinâmico`,
    messages: [{ role: 'user', content: 'Oi' }],
  });
  assert.equal(result.cachedTokens, 1024);
  assert.equal(result.tokens, 70); // input+output reportados, sem regressão
});

test('cache: cachedTokens fica AUSENTE quando o provider não reporta nada de cache', async () => {
  mockFetchCapture([{ content: [{ type: 'text', text: 'resp' }], usage: { input_tokens: 10, output_tokens: 5 } }]);
  const adapter = new AnthropicAdapter('ak-test');
  const result = await adapter.complete({ model: 'claude-sonnet-4-5', system: 'Sistema', messages: [{ role: 'user', content: 'Oi' }] });
  assert.equal(result.cachedTokens, undefined);
  assert.equal(result.tokens, 15);
});

test('cache: OpenAI extrai cached_tokens de prompt_tokens_details', async () => {
  mockFetchCapture([
    {
      choices: [{ message: { content: 'resp openai' } }],
      usage: { total_tokens: 100, prompt_tokens: 80, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 64 } },
    },
  ]);
  const adapter = new OpenAIAdapter('sk-test');
  const result = await adapter.complete({ model: 'gpt-4o-mini', system: 'qualquer', messages: [{ role: 'user', content: 'Oi' }] });
  assert.equal(result.cachedTokens, 64);
  assert.equal(result.tokens, 100);
});

test('cache: OpenAI ordenação estável — system (sem delimitador) primeiro, messages na ordem', async () => {
  const mkSystem = (dyn: string) => `instruções fixas do agente\n${DYNAMIC_MARKER}\n${dyn}`;
  const captured = mockFetchCapture([
    { choices: [{ message: { content: 'a' } }], usage: { total_tokens: 9 } },
    { choices: [{ message: { content: 'b' } }], usage: { total_tokens: 9 } },
  ]);
  const adapter = new OpenAIAdapter('sk-test');

  await adapter.complete({
    model: 'gpt-4o-mini',
    system: mkSystem('sessão 1'),
    messages: [
      { role: 'assistant', content: 'antes' },
      { role: 'user', content: 'agora' },
    ],
  });
  await adapter.complete({
    model: 'gpt-4o-mini',
    system: mkSystem('sessão 2'),
    messages: [{ role: 'user', content: 'depois' }],
  });

  for (const req of captured) {
    const messages = req.body.messages as Array<{ role: string; content: string }>;
    assert.equal(messages[0]!.role, 'system');
    assert.ok(!messages[0]!.content.includes(DYNAMIC_MARKER), 'delimitador nunca vai pro fio OpenAI-compatible');
    assert.ok(messages[0]!.content.startsWith('instruções fixas do agente'), 'prefixo estável no início do payload');
  }
  // O PREFIXO do system é byte-idêntico entre chamadas mesmo com dinâmico
  // diferente → é exatamente essa propriedade que habilita o prefix caching.
  const sys1 = (captured[0]!.body.messages as Array<{ role: string; content: string }>)[0]!.content;
  const sys2 = (captured[1]!.body.messages as unknown as Array<{ role: string; content: string }>)[0]!.content;
  const staticPrefix = 'instruções fixas do agente\n';
  let common = 0;
  while (common < Math.min(sys1.length, sys2.length) && sys1[common] === sys2[common]) common += 1;
  assert.ok(common >= staticPrefix.length, `prefixo comum (${common}) deve cobrir toda a parte estática`);
  // E os sufixos voláteis diferem (prova de que o teste não compara strings iguais triviais):
  assert.notEqual(sys1, sys2);
  assert.equal((captured[0]!.body.messages as unknown[]).length, 3, 'system + 2 mensagens, ordem preservada');
  assert.equal((captured[1]!.body.messages as unknown[]).length, 2);
});

test('cache: retrocompatibilidade — payload Anthropic antigo (system curto, sem marker) é byte-a-byte o de hoje', async () => {
  const captured = mockFetchCapture([
    { content: [{ type: 'text', text: 'Resposta anthropic' }], usage: { input_tokens: 10, output_tokens: 5 } },
  ]);
  const adapter = new AnthropicAdapter('ak-test');
  await adapter.complete({
    model: 'claude-sonnet-4-5',
    system: 'Sistema',
    maxTokens: 512,
    temperature: 0.2,
    messages: [{ role: 'user', content: 'Ola' }],
  });

  // Snapshot dos campos essenciais do wire format pré-CAPC:
  assert.deepEqual(captured[0]!.body, {
    model: 'claude-sonnet-4-5',
    max_tokens: 512,
    temperature: 0.2,
    system: 'Sistema',
    messages: [{ role: 'user', content: 'Ola' }],
  });
  assert.equal(captured[0]!.headers['anthropic-version'], '2023-06-01');
});

test('cache: LLMClient existente ganha cache-awareness SEM nenhuma mudança nos chamadores', async () => {
  const captured = mockFetchCapture([
    {
      content: [{ type: 'text', text: 'via client' }],
      usage: { input_tokens: 1300, output_tokens: 12, cache_read_input_tokens: 1120 },
    },
  ]);
  const client = new LLMClient([new AnthropicAdapter('ak-test')]);
  const result = await client.complete('anthropic', {
    model: 'claude-sonnet-4-5',
    system: `${longStaticSystem()}\n${DYNAMIC_MARKER}\nrun xyz`,
    messages: [{ role: 'user', content: 'executa' }],
  });

  const blocks = captured[0]!.body.system as Array<{ cache_control?: unknown }>;
  assert.ok(Array.isArray(blocks), 'client repassa e o adapter aplica blocos automaticamente');
  assert.deepEqual(blocks[0]!.cache_control, { type: 'ephemeral' });
  assert.equal(result.cachedTokens, 1120);
  assert.equal(result.provider, 'anthropic');
});
