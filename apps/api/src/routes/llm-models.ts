import type { FastifyInstance } from 'fastify';
import { providerEndpoint } from '../providers/endpoint.js';
import { getSettings } from '../utils/settings.js';
import { validateLLMProviderURL } from '../utils/ssrf-protection.js';
import { validateBody } from '../middleware/validate.js';
import { testConnectionSchema } from '../schemas/llm.js';

export async function llmModelRoutes(fastify: FastifyInstance) {
  fastify.post('/llm/models', async (request, reply) => {
    const validated = validateBody(testConnectionSchema, request.body, reply);
    if (!validated.success) return;

    const settings = await getSettings();
    const provider = settings.providers.find(p => p.id === validated.data.providerId);
    if (!provider) return reply.status(404).send({ success: false, error: 'Provider not found' });

    let url: string;
    try {
      url = providerEndpoint(provider.baseURL, 'models');
      validateLLMProviderURL(url);
    } catch (error) {
      return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : 'Invalid provider URL' });
    }

    const headers: Record<string, string> = provider.kind === 'anthropic'
      ? { 'x-api-key': provider.apiKey, 'anthropic-version': provider.anthropicVersion || '2023-06-01' }
      : { Authorization: `Bearer ${provider.apiKey}` };
    if (provider.organization && provider.kind !== 'anthropic') headers['OpenAI-Organization'] = provider.organization;

    try {
      const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
      const data = await response.json() as {
        data?: Array<{ id?: unknown; model?: unknown; name?: unknown } | null>;
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        throw new Error(message || `Failed to fetch models (${response.status})`);
      }
      const models = Array.isArray(data.data)
        ? [...new Set(data.data.map(model => model?.id || model?.model || model?.name)
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
          .sort((a, b) => a.localeCompare(b))
        : [];
      if (!models.length) throw new Error('No models returned by provider');
      return { success: true, models };
    } catch (error) {
      return reply.status(502).send({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch models' });
    }
  });
}
