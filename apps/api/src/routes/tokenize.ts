import type { FastifyInstance } from 'fastify';
import { tokenizerRegistry } from '@card-architect/tokenizers';
import type { TokenizeRequest, TokenizeResponse } from '@card-architect/schemas';

export async function tokenizeRoutes(fastify: FastifyInstance) {
  // List available tokenizers
  fastify.get('/tokenizers', async (_request, _reply) => {
    const tokenizers = tokenizerRegistry.list();
    return tokenizers.map((t) => ({ id: t.id }));
  });

  // Tokenize text
  fastify.post('/tokenize', async (request, reply) => {
    const body = request.body as TokenizeRequest;

    if (!body.model || !body.payload) {
      reply.code(400);
      return { error: 'Missing model or payload' };
    }

    const tokenizer = tokenizerRegistry.get(body.model);
    if (!tokenizer) {
      reply.code(404);
      return { error: 'Tokenizer not found' };
    }

    const fields: Record<string, number> = {};
    let total = 0;

    for (const [key, value] of Object.entries(body.payload)) {
      const count = tokenizer.estimate(value);
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
