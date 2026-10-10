/**
 * OpenAI Provider Shim
 * Supports both Responses API (newer) and Chat Completions API (legacy)
 * Docs: https://platform.openai.com/docs/guides/responses
 *       https://platform.openai.com/docs/guides/chat-completions
 */

import type { LLMMessage, LLMResponse, LLMStreamChunk } from '../types/index.js';
import { providerEndpoint } from './endpoint.js';

interface OpenAIErrorPayload {
  error?: { message?: string };
}

interface OpenAIResponsePayload {
  output?: Array<{ content?: string; finish_reason?: string }>;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

export interface OpenAIConfig {
  baseURL: string;
  apiKey: string;
  organization?: string;
}

export interface OpenAIRequestParams {
  model: string;
  messages: LLMMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** Use `max_completion_tokens` instead of `max_tokens` (required for OpenAI GPT-5+/o-series) */
  useMaxCompletionTokens?: boolean;
}

/**
 * OpenAI Responses API (preferred when available)
 * POST /v1/responses
 */
export async function openaiResponses(
  config: OpenAIConfig,
  params: OpenAIRequestParams
): Promise<LLMResponse | AsyncIterable<LLMStreamChunk>> {
  const { baseURL, apiKey, organization } = config;
  const { model, messages, system, temperature, maxTokens, stream } = params;

  // Build input messages (Responses API uses 'input' instead of 'messages')
  const input = system
    ? [{ role: 'system' as const, content: system }, ...messages]
    : messages;

  const body = {
    model,
    input,
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { max_output_tokens: maxTokens }), // Note: Responses uses max_output_tokens
    stream: stream ?? false,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (organization) {
    headers['OpenAI-Organization'] = organization;
  }

  const response = await fetch(providerEndpoint(baseURL, 'responses'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } })) as OpenAIErrorPayload;
    throw new Error(`OpenAI Responses API error: ${error.error?.message || response.statusText}`);
  }

  if (stream) {
    return streamOpenAIResponses(response);
  }

  const data = await response.json() as OpenAIResponsePayload;
  return {
    content: data.output?.[0]?.content || '',
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: data.model || model,
    finishReason: mapFinishReason(data.output?.[0]?.finish_reason),
  };
}

/**
 * OpenAI Chat Completions API (fallback/legacy)
 * POST /v1/chat/completions
 */
export async function openaiChat(
  config: OpenAIConfig,
  params: OpenAIRequestParams
): Promise<LLMResponse | AsyncIterable<LLMStreamChunk>> {
  const { baseURL, apiKey, organization } = config;
  const { model, messages, system, temperature, maxTokens, stream, useMaxCompletionTokens } = params;

  // Build messages array (Chat API uses 'messages')
  const chatMessages = system
    ? [{ role: 'system' as const, content: system }, ...messages]
    : messages;

  // GPT-5+ and o-series models require max_completion_tokens; older models use max_tokens
  const tokenParam = useMaxCompletionTokens ? 'max_completion_tokens' : 'max_tokens';

  const body = {
    model,
    messages: chatMessages,
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { [tokenParam]: maxTokens }),
    stream: stream ?? false,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (organization) {
    headers['OpenAI-Organization'] = organization;
  }

  const response = await fetch(providerEndpoint(baseURL, 'chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } })) as OpenAIErrorPayload;
    throw new Error(`OpenAI Chat API error: ${error.error?.message || response.statusText}`);
  }

  if (stream) {
    return streamOpenAIChat(response);
  }

  const data = await response.json() as OpenAIResponsePayload;
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: data.model || model,
    finishReason: mapFinishReason(data.choices?.[0]?.finish_reason),
  };
}

/**
 * Stream handler for Responses API
 */
async function* streamOpenAIResponses(response: Response): AsyncIterable<LLMStreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let totalContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;
        if (line === 'data: [DONE]') {
          yield { content: '', done: true };
          return;
        }

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.output?.[0]?.content || '';
            totalContent += content;

            yield {
              content,
              done: false,
              usage: data.usage
                ? {
                    promptTokens: data.usage.input_tokens || 0,
                    completionTokens: data.usage.output_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0,
                  }
                : undefined,
            };
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: '', done: true };
}

/**
 * Stream handler for Chat Completions API
 */
async function* streamOpenAIChat(response: Response): AsyncIterable<LLMStreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let totalContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;
        if (line === 'data: [DONE]') {
          yield { content: '', done: true };
          return;
        }

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content || '';
            totalContent += content;

            yield {
              content,
              done: false,
              usage: data.usage
                ? {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0,
                  }
                : undefined,
            };
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: '', done: true };
}

/**
 * Map various finish_reason values to our standard format
 */
function mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'content_filter' | undefined {
  if (!reason) return undefined;
  if (reason === 'stop') return 'stop';
  if (reason === 'length' || reason === 'max_tokens') return 'length';
  if (reason === 'content_filter') return 'content_filter';
  return undefined;
}
