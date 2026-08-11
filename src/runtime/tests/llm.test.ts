import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIAdapter, AnthropicAdapter, GoogleAdapter, LLMClient } from '../llm/client.js';

function mockFetchOnce(handler: (url: string, init: RequestInit) => Promise<unknown>): void {
  (globalThis as Record<string, unknown>).fetch = (async (url: string, init: RequestInit) => {
    const body = await handler(url, init);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as unknown as typeof fetch;
}

function mockFetchError(status: number, body: string): void {
  (globalThis as Record<string, unknown>).fetch = (async () => ({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({}),
    text: async () => body,
  })) as unknown as typeof fetch;
}

test('llm: OpenAIAdapter completa com texto e tokens', async () => {
  mockFetchOnce(async (url, init) => {
    assert.ok(url.includes('/chat/completions'));
    const parsed = JSON.parse(String(init.body));
    assert.equal(parsed.model, 'gpt-4o-mini');
    assert.ok(parsed.messages[0].role === 'system');
    assert.ok((init.headers as Record<string, string>).Authorization.includes('Bearer'));
    return { choices: [{ message: { content: 'Resposta do modelo' } }], usage: { total_tokens: 42 } };
  });

  const adapter = new OpenAIAdapter('sk-test');
  const result = await adapter.complete({
    model: 'gpt-4o-mini',
    system: 'Você é um agente.',
    messages: [{ role: 'user', content: 'Oi' }],
  });

  assert.equal(result.text, 'Resposta do modelo');
  assert.equal(result.tokens, 42);
  assert.equal(result.provider, 'openai');
  assert.ok(result.latencyMs >= 0);
});

test('llm: AnthropicAdapter monta payload da Messages API', async () => {
  mockFetchOnce(async (url, init) => {
    assert.ok(url.includes('/v1/messages'));
    const parsed = JSON.parse(String(init.body));
    assert.equal(parsed.model, 'claude-sonnet-4-5');
    assert.ok((init.headers as Record<string, string>)['x-api-key'] === 'ak-test');
    return { content: [{ type: 'text', text: 'Resposta anthropic' }], usage: { input_tokens: 10, output_tokens: 5 } };
  });

  const adapter = new AnthropicAdapter('ak-test');
  const result = await adapter.complete({
    model: 'claude-sonnet-4-5',
    system: 'Sistema',
    messages: [{ role: 'user', content: 'Ola' }],
  });

  assert.equal(result.text, 'Resposta anthropic');
  assert.equal(result.tokens, 15);
});

test('llm: GoogleAdapter usa generateContent', async () => {
  mockFetchOnce(async (url) => {
    assert.ok(url.includes(':generateContent'));
    return { candidates: [{ content: { parts: [{ text: 'Resposta gemini' }] } }], usageMetadata: { totalTokenCount: 33 } };
  });

  const adapter = new GoogleAdapter('gk-test');
  const result = await adapter.complete({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'Oi' }] });
  assert.equal(result.text, 'Resposta gemini');
  assert.equal(result.tokens, 33);
});

test('llm: erro HTTP propaga com status', async () => {
  mockFetchError(401, 'invalid api key');
  const adapter = new OpenAIAdapter('sk-invalida');
  await assert.rejects(
    () => adapter.complete({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'x' }] }),
    /401/,
  );
});

test('llm: configured reflete presença de chave', () => {
  const withKey = new OpenAIAdapter('sk-x');
  assert.equal(withKey.configured, true);
  const without = new OpenAIAdapter('');
  assert.equal(without.configured, false);
});

test('llm: LLMClient rejeita provider desconhecido', async () => {
  const client = new LLMClient();
  await assert.rejects(
    () => client.complete('watson', { model: 'x', messages: [{ role: 'user', content: 'x' }] }),
    /não suportado/,
  );
});

test('llm: LLMClient rejeita provider sem chave configurada', async () => {
  const client = new LLMClient([new OpenAIAdapter('')]);
  await assert.rejects(
    () => client.complete('openai', { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'x' }] }),
    /não configurado/,
  );
});

test('llm: configuredProviders lista apenas os com chave', () => {
  const client = new LLMClient([new OpenAIAdapter('sk-x'), new AnthropicAdapter(''), new GoogleAdapter('')]);
  assert.deepEqual(client.configuredProviders(), ['openai']);
  assert.equal(client.isConfigured('openai'), true);
  assert.equal(client.isConfigured('anthropic'), false);
});
