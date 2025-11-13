/**
 * Anthropic Provider Shim
 * Uses the Messages API with top-level system message
 * Docs: https://docs.anthropic.com/en/api/messages
 */

import type { LLMMessage, LLMResponse, LLMStreamChunk } from '@card-architect/schemas';

export interface AnthropicConfig {
  baseURL: string;
  apiKey: string;
  anthropicVersion: string; // e.g., "2023-06-01"
}

export interface AnthropicRequestParams {
  model: string;
  messages: LLMMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * Anthropic Messages API
 * POST /v1/messages
 */
export async function anthropicMessages(
  config: AnthropicConfig,
  params: AnthropicRequestParams
): Promise<LLMResponse | AsyncIterable<LLMStreamChunk>> {
  const { baseURL, apiKey, anthropicVersion } = config;
  const { model, messages, system, temperature, maxTokens, stream } = params;

  // Anthropic requires max_tokens and uses system at top-level
  const body = {
    model,
    messages: messages.map((m) => ({
      role: m.role === 'system' ? 'user' : m.role, // Anthropic doesn't allow system in messages array
      content: m.content,
    })),
    max_tokens: maxTokens ?? 1024, // Required by Anthropic
    ...(system && { system }), // Top-level system
    ...(temperature !== undefined && { temperature }),
    stream: stream ?? false,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': anthropicVersion,
  };

  const response = await fetch(`${baseURL}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
  }

  if (stream) {
    return streamAnthropic(response);
  }

  const data = await response.json();

  // Extract content from Anthropic's response format
  let content = '';
  if (Array.isArray(data.content)) {
    content = data.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');
  } else if (typeof data.content === 'string') {
    content = data.content;
  }

  return {
    content,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    model: data.model || model,
    finishReason: mapFinishReason(data.stop_reason),
  };
}

/**
 * Stream handler for Anthropic Messages API
 * Handles event types: message_start, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop
 */
async function* streamAnthropic(response: Response): AsyncIterable<LLMStreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let totalContent = '';
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // Anthropic uses "event:" and "data:" lines
        if (line.startsWith('event:')) {
          continue; // We'll process the event when we get the data
        }

        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());

            // Handle different event types
            if (data.type === 'message_start') {
              // Initial message metadata
              if (data.message?.usage) {
                usage.promptTokens = data.message.usage.input_tokens || 0;
              }
            } else if (data.type === 'content_block_delta') {
              // Content chunk
              const delta = data.delta;
              if (delta?.type === 'text_delta' && delta.text) {
                totalContent += delta.text;
                yield {
                  content: delta.text,
                  done: false,
                };
              }
            } else if (data.type === 'message_delta') {
              // Final usage info
              if (data.usage) {
                usage.completionTokens = data.usage.output_tokens || 0;
                usage.totalTokens = usage.promptTokens + usage.completionTokens;
              }
            } else if (data.type === 'message_stop') {
              // End of stream
              yield {
                content: '',
                done: true,
                usage: usage.totalTokens > 0 ? usage : undefined,
              };
              return;
            }
          } catch (e) {
            // Skip invalid JSON
            console.error('Error parsing Anthropic stream chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: '', done: true, usage: usage.totalTokens > 0 ? usage : undefined };
}

/**
 * Map Anthropic's stop_reason to our standard format
 */
function mapFinishReason(
  reason: string | undefined
): 'stop' | 'length' | 'content_filter' | undefined {
  if (!reason) return undefined;
  if (reason === 'end_turn') return 'stop';
  if (reason === 'max_tokens') return 'length';
  if (reason === 'stop_sequence') return 'stop';
  return undefined;
}
