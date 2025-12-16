import type { FastifyInstance } from 'fastify';
import { registry } from '@character-foundry/character-foundry/tokenizers';
import type { TokenizeRequest, TokenizeResponse } from '../types/index.js';

export async function tokenizeRoutes(fastify: FastifyInstance) {
  // List available tokenizers
  fastify.get('/tokenizers', async (_request, _reply) => {
    const tokenizers = registry.list();
    return tokenizers.map((t) => ({ id: t.id, name: t.name }));
  });

  // Tokenize text
  fastify.post('/tokenize', async (request, reply) => {
    const body = request.body as TokenizeRequest;

    if (!body.model || !body.payload) {
      reply.code(400);
      return { error: 'Missing model or payload' };
    }

    const tokenizer = registry.get(body.model);

    const fields: Record<string, number> = {};
    let total = 0;

    for (const [key, value] of Object.entries(body.payload)) {
      const count = tokenizer.count(value);
      fields[key] = count;
      total += count;
    }

    const response: TokenizeResponse = {
      model: body.model,
      fields,
      total,
    };

    return response;
  });
}
