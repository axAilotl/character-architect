import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { llmRoutes } from '../routes/llm.js';
import { getSettings } from '../utils/settings.js';
import type { LLMSettings } from '../types/index.js';

vi.mock('../utils/settings.js', () => ({ getSettings: vi.fn(), saveSettings: vi.fn() }));

describe('LLM provider connections', () => {
  let app: FastifyInstance;
  let settings: LLMSettings;
  beforeEach(async () => {
    settings = { providers: [{ id: 'provider', name: 'Fixture', kind: 'openai-compatible',
      baseURL: 'https://openrouter.ai/', apiKey: 'saved-secret', defaultModel: 'example/model' }] } as LLMSettings;
    vi.mocked(getSettings).mockResolvedValue(settings);
    app = Fastify();
    await app.register(llmRoutes, { prefix: '/api' });
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  it.each([
    ['https://openrouter.ai/', 'https://openrouter.ai/api/v1'],
    ['https://openrouter.ai/api', 'https://openrouter.ai/api/v1'],
    ['https://openrouter.ai/api/v1/', 'https://openrouter.ai/api/v1'],
    ['https://api.deepseek.com', 'https://api.deepseek.com'],
    ['https://api.deepseek.com/v1/', 'https://api.deepseek.com/v1'],
    ['https://api.openai.com', 'https://api.openai.com/v1'],
    ['http://localhost:1234/v1', 'http://localhost:1234/v1'],
  ])('discovers models and completes chats with base URL %s', async (baseURL, expectedBase) => {
    settings.providers[0].baseURL = baseURL;
    const upstream = vi.fn(async (url: string) => url.endsWith('/models')
      ? Response.json({ data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'a-model' }, {}, { id: 42 }] })
      : Response.json({ choices: [{ message: { content: 'Connected' } }], model: 'example/model' }));
    vi.stubGlobal('fetch', upstream);
    const models = await app.inject({ method: 'POST', url: '/api/llm/models', payload: { providerId: 'provider' } });
    expect(models.statusCode).toBe(200);
    expect(models.json()).toEqual({ success: true, models: ['a-model', 'z-model'] });
    expect(models.body).not.toContain('saved-secret');
    expect(upstream).toHaveBeenCalledWith(`${expectedBase}/models`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer saved-secret' }), redirect: 'error',
    }));
    const completion = await app.inject({ method: 'POST', url: '/api/llm/invoke',
      payload: { providerId: 'provider', messages: [{ role: 'user', content: 'Hi' }] } });
    expect(completion.statusCode).toBe(200);
    expect(completion.json().content).toBe('Connected');
    expect(upstream).toHaveBeenLastCalledWith(`${expectedBase}/chat/completions`, expect.objectContaining({ method: 'POST' }));
  });

  it('uses Anthropic headers and accepts a versioned base URL', async () => {
    Object.assign(settings.providers[0], { kind: 'anthropic', baseURL: 'https://api.anthropic.com/v1/' });
    const upstream = vi.fn(async () => Response.json({ data: [{ id: 'claude-model' }] }));
    vi.stubGlobal('fetch', upstream);
    const result = await app.inject({ method: 'POST', url: '/api/llm/models', payload: { providerId: 'provider' } });
    expect(result.statusCode).toBe(200);
    expect(upstream).toHaveBeenCalledWith('https://api.anthropic.com/v1/models', expect.objectContaining({
      headers: { 'x-api-key': 'saved-secret', 'anthropic-version': '2023-06-01' },
    }));
  });

  it.each([
    [{}, 400], [{ providerId: 'missing' }, 404],
  ])('rejects invalid or unknown providers without network access', async (payload, status) => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const result = await app.inject({ method: 'POST', url: '/api/llm/models', payload });
    expect(result.statusCode).toBe(status);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('keeps the existing provider allowlist enforced', async () => {
    settings.providers[0].baseURL = 'http://169.254.169.254';
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const result = await app.inject({ method: 'POST', url: '/api/llm/models', payload: { providerId: 'provider' } });
    expect(result.statusCode).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([
    [401, { error: { message: 'Invalid API key' } }, 'Invalid API key'],
    [200, { data: [] }, 'No models returned by provider'],
  ])('reports provider errors for response %s', async (status, payload, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload, { status })));
    const result = await app.inject({ method: 'POST', url: '/api/llm/models', payload: { providerId: 'provider' } });
    expect(result.statusCode).toBe(502);
    expect(result.json()).toEqual({ success: false, error: message });
  });
});
