/**
 * Client-side LLM API support
 *
 * Enables direct browser-to-LLM API calls for providers that support CORS:
 * - OpenRouter (https://openrouter.ai) - Full CORS support
 * - Anthropic - Requires `anthropic-dangerous-direct-browser-access: true` header
 * - Local LLMs (Ollama, LM Studio, LocalAI) - Must have CORS enabled
 *
 * Note: Most LLM providers do NOT support CORS by default.
 * OpenAI, for example, blocks browser requests.
 */

export interface ClientLLMProvider {
  id: string;
  name: string;
  kind: 'openai-compatible' | 'anthropic' | 'openrouter';
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ClientLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ClientLLMRequest {
  provider: ClientLLMProvider;
  messages: ClientLLMMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
}

export interface ClientLLMResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// Storage key for client-side LLM providers
const LLM_PROVIDERS_KEY = 'ca-llm-providers';
const LLM_ACTIVE_PROVIDER_KEY = 'ca-llm-active-provider';

/**
 * Save LLM providers to localStorage
 */
export function saveClientLLMProviders(providers: ClientLLMProvider[]): void {
  localStorage.setItem(LLM_PROVIDERS_KEY, JSON.stringify(providers));
}

/**
 * Load LLM providers from localStorage
 */
export function loadClientLLMProviders(): ClientLLMProvider[] {
  try {
    const stored = localStorage.getItem(LLM_PROVIDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save active provider ID
 */
export function saveActiveProvider(providerId: string | null): void {
  if (providerId) {
    localStorage.setItem(LLM_ACTIVE_PROVIDER_KEY, providerId);
  } else {
    localStorage.removeItem(LLM_ACTIVE_PROVIDER_KEY);
  }
}

/**
 * Load active provider ID
 */
export function loadActiveProvider(): string | null {
  return localStorage.getItem(LLM_ACTIVE_PROVIDER_KEY);
}

/**
 * Call OpenRouter API directly from browser
 * OpenRouter has full CORS support
 */
async function callOpenRouter(request: ClientLLMRequest): Promise<ClientLLMResponse> {
  const { provider, messages, temperature, maxTokens, model } = request;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Card Architect',
      },
      body: JSON.stringify({
        model: model || provider.defaultModel,
        messages,
        temperature: temperature ?? provider.temperature ?? 0.7,
        max_tokens: maxTokens ?? provider.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices?.[0]?.message?.content || '',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OpenRouter request failed',
    };
  }
}

/**
 * Call Anthropic API directly from browser
 * Requires the dangerous direct browser access header
 */
async function callAnthropic(request: ClientLLMRequest): Promise<ClientLLMResponse> {
  const { provider, messages, temperature, maxTokens, model } = request;

  // Extract system message if present
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || provider.defaultModel || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens ?? provider.maxTokens ?? 2048,
        system: systemMessage?.content,
        messages: chatMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: temperature ?? provider.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Anthropic error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content?.[0]?.text || '',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Anthropic request failed',
    };
  }
}

/**
 * Call OpenAI-compatible API (Ollama, LM Studio, LocalAI, etc.)
 * These must have CORS enabled to work from browser
 */
async function callOpenAICompatible(request: ClientLLMRequest): Promise<ClientLLMResponse> {
  const { provider, messages, temperature, maxTokens, model } = request;

  try {
    const url = `${provider.baseURL.replace(/\/$/, '')}/v1/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || provider.defaultModel,
        messages,
        temperature: temperature ?? provider.temperature ?? 0.7,
        max_tokens: maxTokens ?? provider.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices?.[0]?.message?.content || '',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'API request failed',
    };
  }
}

/**
 * Invoke LLM with automatic provider detection
 */
export async function invokeClientLLM(request: ClientLLMRequest): Promise<ClientLLMResponse> {
  const { provider } = request;

  switch (provider.kind) {
    case 'openrouter':
      return callOpenRouter(request);
    case 'anthropic':
      return callAnthropic(request);
    case 'openai-compatible':
    default:
      return callOpenAICompatible(request);
  }
}

/**
 * Test connection to a provider
 */
export async function testClientLLMConnection(provider: ClientLLMProvider): Promise<{ success: boolean; error?: string }> {
  const result = await invokeClientLLM({
    provider,
    messages: [{ role: 'user', content: 'Say "Connection successful" and nothing else.' }],
    maxTokens: 20,
  });

  return {
    success: result.success,
    error: result.error,
  };
}

/**
 * Fetch available models from provider
 */
export async function fetchClientLLMModels(provider: ClientLLMProvider): Promise<{ success: boolean; models?: string[]; error?: string }> {
  try {
    let url: string;
    let headers: Record<string, string> = {};

    if (provider.kind === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/models';
      headers = {
        'Authorization': `Bearer ${provider.apiKey}`,
      };
    } else if (provider.kind === 'anthropic') {
      // Anthropic doesn't have a models endpoint, return known models
      return {
        success: true,
        models: [
          'claude-sonnet-4-20250514',
          'claude-opus-4-20250514',
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
        ],
      };
    } else {
      url = `${provider.baseURL.replace(/\/$/, '')}/v1/models`;
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    const models = Array.isArray(data.data)
      ? data.data.map((m: any) => m.id || m.model || m.name).filter(Boolean).sort()
      : [];

    return { success: true, models };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch models',
    };
  }
}

/**
 * Default provider presets for quick setup
 */
export const CLIENT_LLM_PRESETS: Omit<ClientLLMProvider, 'id' | 'apiKey'>[] = [
  {
    name: 'OpenRouter',
    kind: 'openrouter',
    baseURL: 'https://openrouter.ai/api',
    defaultModel: 'anthropic/claude-sonnet-4',
    temperature: 0.7,
    maxTokens: 2048,
  },
  {
    name: 'Anthropic Direct',
    kind: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 2048,
  },
  {
    name: 'Ollama (Local)',
    kind: 'openai-compatible',
    baseURL: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    temperature: 0.7,
    maxTokens: 2048,
  },
  {
    name: 'LM Studio (Local)',
    kind: 'openai-compatible',
    baseURL: 'http://localhost:1234',
    defaultModel: 'local-model',
    temperature: 0.7,
    maxTokens: 2048,
  },
];
