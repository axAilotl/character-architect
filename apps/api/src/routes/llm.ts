/**
 * LLM Gateway Routes
 * Handles LLM provider invocations, settings management, and RAG operations
 */

import type { FastifyInstance } from 'fastify';
import type { LLMSettings } from '../types/index.js';
import { openaiResponses, openaiChat } from '../providers/openai.js';
import { anthropicMessages } from '../providers/anthropic.js';
import { getSettings, saveSettings } from '../utils/settings.js';
import { buildPrompt } from '../utils/llm-prompts.js';
import { computeDiff } from '../utils/diff.js';
import { getTokenizer } from '../utils/tokenizer.js';
import { validateLLMProviderURL } from '../utils/ssrf-protection.js';
import { validateBody } from '../middleware/validate.js';
import {
  updateLLMSettingsSchema,
  testConnectionSchema,
  llmInvokeSchema,
  llmAssistSchema,
} from '../schemas/index.js';

export async function llmRoutes(fastify: FastifyInstance) {
  /**
   * Get LLM settings
   */
  fastify.get('/llm/settings', async (_request, reply) => {
    try {
      const settings = await getSettings();
      // Redact API keys in response
      const sanitized = {
        ...settings,
        providers: settings.providers.map((p) => ({
          ...p,
          apiKey: p.apiKey ? '***REDACTED***' : '',
        })),
      };
      reply.send(sanitized);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to load settings' });
    }
  });

  /**
   * Update LLM settings
   */
  fastify.post('/llm/settings', async (request, reply) => {
    const validated = validateBody(updateLLMSettingsSchema, request.body, reply);
    if (!validated.success) return;

    try {
      const updates = validated.data;
      const currentSettings = await getSettings();

      // Merge providers while preserving existing secrets when values are redacted or omitted
      const mergedProviders = updates.providers
        ? updates.providers.map((incoming) => {
            const existing = currentSettings.providers.find((p) => p.id === incoming.id);
            const apiKey =
              incoming.apiKey && incoming.apiKey !== '***REDACTED***'
                ? incoming.apiKey
                : existing?.apiKey || '';

            return {
              ...existing,
              ...incoming,
              apiKey,
            };
          })
        : currentSettings.providers;

      const newSettings: LLMSettings = {
        providers: mergedProviders,
        activeProviderId: updates.activeProviderId ?? currentSettings.activeProviderId,
        rag: updates.rag ?? currentSettings.rag,
      };

      await saveSettings(newSettings);
      reply.send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to save settings' });
    }
  });

  /**
   * Test provider connection
   */
  fastify.post(
    '/llm/test-connection',
    async (request, reply) => {
      const validated = validateBody(testConnectionSchema, request.body, reply);
      if (!validated.success) return;

      try {
        const { providerId } = validated.data;
        const settings = await getSettings();
        const provider = settings.providers.find((p) => p.id === providerId);

        if (!provider) {
          return reply.status(404).send({ error: 'Provider not found' });
        }

        // Validate provider URL for SSRF
        try {
          validateLLMProviderURL(provider.baseURL);
        } catch (error: any) {
          return reply.status(400).send({ error: error.message });
        }

        // Simple test: request 1 token completion
        const testMessage = { role: 'user' as const, content: 'Hi' };

        let result;
        if (provider.kind === 'openai' || provider.kind === 'openai-compatible') {
          const mode = provider.mode ?? 'chat';
          const fn = mode === 'responses' ? openaiResponses : openaiChat;
          result = await fn(
            {
              baseURL: provider.baseURL,
              apiKey: provider.apiKey,
              organization: provider.organization,
            },
            {
              model: provider.defaultModel,
              messages: [testMessage],
              maxTokens: 1,
              stream: false,
            }
          );
        } else if (provider.kind === 'anthropic') {
          result = await anthropicMessages(
            {
              baseURL: provider.baseURL,
              apiKey: provider.apiKey,
              anthropicVersion: provider.anthropicVersion ?? '2023-06-01',
            },
            {
              model: provider.defaultModel,
              messages: [testMessage],
              maxTokens: 1,
              stream: false,
            }
          );
        } else {
          return reply.status(400).send({ error: 'Unknown provider kind' });
        }

        reply.send({ success: true, model: (result as any).model });
      } catch (error: any) {
        fastify.log.error(error);
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * Invoke LLM (low-level)
   */
  fastify.post('/llm/invoke', async (request, reply) => {
    const validated = validateBody(llmInvokeSchema, request.body, reply);
    if (!validated.success) return;

    try {
      const { providerId, model, mode, messages, system, temperature, maxTokens, stream } =
        validated.data;

      const settings = await getSettings();
      const provider = settings.providers.find((p) => p.id === providerId);

      if (!provider) {
        return reply.status(404).send({ error: 'Provider not found' });
      }

      // Validate provider URL for SSRF
      try {
        validateLLMProviderURL(provider.baseURL);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }

      let result;

      if (provider.kind === 'openai' || provider.kind === 'openai-compatible') {
        const effectiveMode = mode ?? provider.mode ?? 'chat';
        const fn = effectiveMode === 'responses' ? openaiResponses : openaiChat;
        result = await fn(
          {
            baseURL: provider.baseURL,
            apiKey: provider.apiKey,
            organization: provider.organization,
          },
          {
            model: model || provider.defaultModel,
            messages,
            system,
            temperature,
            maxTokens,
            stream,
          }
        );
      } else if (provider.kind === 'anthropic') {
        result = await anthropicMessages(
          {
            baseURL: provider.baseURL,
            apiKey: provider.apiKey,
            anthropicVersion: provider.anthropicVersion ?? '2023-06-01',
          },
          {
            model: model || provider.defaultModel,
            messages,
            system,
            temperature,
            maxTokens,
            stream,
          }
        );
      } else {
        return reply.status(400).send({ error: 'Unknown provider kind' });
      }

      // Handle streaming
      if (stream) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        for await (const chunk of result as AsyncIterable<any>) {
          reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        reply.raw.end();
      } else {
        reply.send(result);
      }
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * LLM Assist (high-level with prompt building)
   */
  fastify.post('/llm/assist', async (request, reply) => {
    const validated = validateBody(llmAssistSchema, request.body, reply);
    if (!validated.success) return;

    try {
      const {
        providerId,
        model,
        instruction,
        context,
        preset,
        temperature,
        maxTokens,
        stream,
      } = validated.data;

      const settings = await getSettings();
      const provider = settings.providers.find((p) => p.id === providerId);

      if (!provider) {
        return reply.status(404).send({ error: 'Provider not found' });
      }

      // Validate provider URL for SSRF
      try {
        validateLLMProviderURL(provider.baseURL);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }

      // Build prompt from context and preset
      const { system, messages } = buildPrompt(instruction, context, preset);

      let result;

      if (provider.kind === 'openai' || provider.kind === 'openai-compatible') {
        const effectiveMode = provider.mode ?? 'chat';
        const fn = effectiveMode === 'responses' ? openaiResponses : openaiChat;
        result = await fn(
          {
            baseURL: provider.baseURL,
            apiKey: provider.apiKey,
            organization: provider.organization,
          },
          {
            model: model || provider.defaultModel,
            messages,
            system,
            temperature: temperature ?? provider.temperature,
            maxTokens: maxTokens ?? provider.maxTokens,
            stream,
          }
        );
      } else if (provider.kind === 'anthropic') {
        result = await anthropicMessages(
          {
            baseURL: provider.baseURL,
            apiKey: provider.apiKey,
            anthropicVersion: provider.anthropicVersion ?? '2023-06-01',
          },
          {
            model: model || provider.defaultModel,
            messages,
            system,
            temperature: temperature ?? provider.temperature,
            maxTokens: maxTokens ?? provider.maxTokens ?? 1024,
            stream,
          }
        );
      } else {
        return reply.status(400).send({ error: 'Unknown provider kind' });
      }

      // Handle streaming for assist
      if (stream) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        let accumulated = '';
        for await (const chunk of result as AsyncIterable<any>) {
          accumulated += chunk.content;
          reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        // Send final assist response with diff
        const tokenizer = getTokenizer();
        const diff = computeDiff(context.currentValue, accumulated);
        const beforeTokens = tokenizer.count(context.currentValue);
        const afterTokens = tokenizer.count(accumulated);

        const finalChunk = {
          done: true,
          content: '',
          assistResponse: {
            original: context.currentValue,
            revised: accumulated,
            diff,
            tokenDelta: {
              before: beforeTokens,
              after: afterTokens,
              delta: afterTokens - beforeTokens,
            },
          },
        };

        reply.raw.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        reply.raw.end();
      } else {
        // Non-streaming response
        const response = result as any;
        const tokenizer = getTokenizer();
        const diff = computeDiff(context.currentValue, response.content);
        const beforeTokens = tokenizer.count(context.currentValue);
        const afterTokens = tokenizer.count(response.content);

        reply.send({
          original: context.currentValue,
          revised: response.content,
          diff,
          tokenDelta: {
            before: beforeTokens,
            after: afterTokens,
            delta: afterTokens - beforeTokens,
          },
          metadata: {
            provider: providerId,
            model: response.model,
            temperature: temperature ?? provider.temperature ?? 0.7,
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
          },
        });
      }
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });
}
