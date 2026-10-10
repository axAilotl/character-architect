import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLLMStore } from './llm-store';

vi.mock('../config/deployment', () => ({
  getDeploymentConfig: () => ({ mode: 'full' }),
}));
vi.mock('../lib/api', () => ({ api: { baseURL: '/api' } }));

describe('self-hosted LLM model discovery', () => {
  beforeEach(() => useLLMStore.setState({ modelCache: {} }));
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['OpenRouter', 'https://openrouter.ai/api/v1'],
    ['DeepSeek', 'https://api.deepseek.com/v1'],
  ])('loads %s models through Architect with the saved server credentials', async (name, baseURL) => {
    useLLMStore.setState({
      settings: {
        ...useLLMStore.getState().settings,
        providers: [{ id: 'provider', name, kind: 'openai-compatible', baseURL,
          apiKey: '***REDACTED***', defaultModel: 'example-model' }],
      },
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url !== '/api/llm/models') throw new TypeError('Failed to fetch: provider CORS blocked');
      return Response.json({ success: true, models: ['example-model'] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await useLLMStore.getState().fetchModelsForProvider('provider');
    expect(result).toEqual({ success: true, models: ['example-model'] });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/llm/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'provider' }),
    });
    expect(useLLMStore.getState().getCachedModels('provider')).toEqual(['example-model']);
  });
});
