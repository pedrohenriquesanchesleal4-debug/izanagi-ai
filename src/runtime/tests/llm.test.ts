import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIAdapter, AnthropicAdapter, GoogleAdapter, OpenRouterAdapter, OllamaAdapter, LMStudioAdapter, CustomOpenAICompatibleAdapter, LLMClient } from '../llm/client.js';

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

test('llm: OpenRouterAdapter usa wire format OpenAI-compatible com sua própria chave', async () => {
  mockFetchOnce(async (url, init) => {
    assert.ok(url.includes('openrouter.ai/api/v1/chat/completions') || url.includes('/chat/completions'));
    assert.ok((init.headers as Record<string, string>).Authorization.includes('Bearer or-test'));
    return { choices: [{ message: { content: 'Resposta openrouter' } }], usage: { total_tokens: 7 } };
  });

  const adapter = new OpenRouterAdapter('or-test');
  assert.equal(adapter.configured, true);
  const result = await adapter.complete({ model: 'meta-llama/llama-3', messages: [{ role: 'user', content: 'Oi' }] });
  assert.equal(result.text, 'Resposta openrouter');
  assert.equal(result.provider, 'openrouter');
});

test('llm: OllamaAdapter exige opt-in explícito (não fica configured por padrão — preserva modo headless)', () => {
  const disabled = new OllamaAdapter('http://localhost:11434/v1', false);
  assert.equal(disabled.configured, false);
  const enabled = new OllamaAdapter('http://localhost:11434/v1', true);
  assert.equal(enabled.configured, true);
});

test('llm: OllamaAdapter completa sem enviar Authorization (servidor local, sem key)', async () => {
  mockFetchOnce(async (url, init) => {
    assert.ok(url.includes('11434/v1/chat/completions'));
    assert.equal((init.headers as Record<string, string>).Authorization, undefined);
    return { choices: [{ message: { content: 'Resposta local' } }], usage: { total_tokens: 3 } };
  });

  const adapter = new OllamaAdapter('http://localhost:11434/v1', true);
  const result = await adapter.complete({ model: 'llama3', messages: [{ role: 'user', content: 'Oi' }] });
  assert.equal(result.text, 'Resposta local');
  assert.equal(result.provider, 'ollama');
});

test('llm: LMStudioAdapter também exige opt-in explícito', async () => {
  assert.equal(new LMStudioAdapter('http://localhost:1234/v1', false).configured, false);
  const adapter = new LMStudioAdapter('http://localhost:1234/v1', true);
  assert.equal(adapter.configured, true);

  mockFetchOnce(async (url) => {
    assert.ok(url.includes('1234/v1/chat/completions'));
    return { choices: [{ message: { content: 'Resposta lmstudio' } }], usage: { total_tokens: 4 } };
  });
  const result = await adapter.complete({ model: 'local-model', messages: [{ role: 'user', content: 'Oi' }] });
  assert.equal(result.provider, 'lmstudio');
});

test('llm: CustomOpenAICompatibleAdapter só fica configured com base URL explícita', async () => {
  assert.equal(new CustomOpenAICompatibleAdapter('', '').configured, false);
  const adapter = new CustomOpenAICompatibleAdapter('ck-test', 'https://gateway.interno.example/v1');
  assert.equal(adapter.configured, true);

  mockFetchOnce(async (url, init) => {
    assert.ok(url.startsWith('https://gateway.interno.example/v1/chat/completions'));
    assert.ok((init.headers as Record<string, string>).Authorization.includes('Bearer ck-test'));
    return { choices: [{ message: { content: 'Resposta custom' } }], usage: { total_tokens: 6 } };
  });
  const result = await adapter.complete({ model: 'custom-model', messages: [{ role: 'user', content: 'Oi' }] });
  assert.equal(result.provider, 'custom');
});
