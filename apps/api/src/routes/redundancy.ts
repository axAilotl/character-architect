import type { FastifyInstance } from 'fastify';
import { RedundancyKiller, type ConsolidationSuggestion } from '../services/redundancy-killer.js';
import { tokenizerRegistry } from '@card-architect/tokenizers';
import type { CCv2Data, CCv3Data } from '@card-architect/schemas';

/**
 * Redundancy Detection Routes
 */
export async function redundancyRoutes(fastify: FastifyInstance) {
  /**
   * POST /redundancy/analyze
   * Analyze a card for redundant content
   */
  fastify.post<{
    Body: {
      card: CCv2Data | CCv3Data;
      tokenizerModel?: string;
    };
  }>('/api/redundancy/analyze', async (request, reply) => {
    const { card, tokenizerModel = 'gpt2-bpe-approx' } = request.body;

    if (!card) {
      reply.code(400);
      return { error: 'Missing card data' };
    }

    // Get tokenizer
    const tokenizer = tokenizerRegistry.get(tokenizerModel);
    if (!tokenizer) {
      reply.code(400);
      return {
        error: `Unknown tokenizer model: ${tokenizerModel}`,
        available: tokenizerRegistry.list().map((t) => t.id),
      };
    }

    // Create redundancy killer
    const killer = new RedundancyKiller((text: string) => tokenizer.estimate(text));

    try {
      const report = killer.analyzeCard(card);

      return {
        success: true,
        report,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to analyze redundancy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * POST /redundancy/apply-fix
   * Apply a consolidation fix
   */
  fastify.post<{
    Body: {
      card: CCv2Data | CCv3Data;
      suggestion: ConsolidationSuggestion;
    };
  }>('/api/redundancy/apply-fix', async (request, reply) => {
    const { card, suggestion } = request.body;

    if (!card || !suggestion) {
      reply.code(400);
      return { error: 'Missing card or suggestion' };
    }

    try {
      // Apply the fix
      const updatedCard = { ...card };

      // Update proposed content
      for (const [fieldName, newContent] of Object.entries(suggestion.proposedContent)) {
        if ('data' in updatedCard && updatedCard.data) {
          (updatedCard.data as any)[fieldName] = newContent;
        } else {
          (updatedCard as any)[fieldName] = newContent;
        }
      }

      return {
        success: true,
        card: updatedCard,
        tokenDelta: suggestion.tokenDelta,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to apply fix',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
