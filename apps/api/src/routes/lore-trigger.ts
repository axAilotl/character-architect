import type { FastifyInstance } from 'fastify';
import { LoreTriggerTester } from '../services/lore-trigger-tester.js';
import { tokenizerRegistry } from '@card-architect/tokenizers';
import type { CCv2Data, CCv3Data, CharacterBook } from '@card-architect/schemas';

/**
 * Lore Trigger Testing Routes
 */
export async function loreTriggerRoutes(fastify: FastifyInstance) {
  /**
   * POST /lore-trigger/test
   * Test which lorebook entries would activate for a given input
   */
  fastify.post<{
    Body: {
      card: CCv2Data | CCv3Data;
      input: string;
      chatHistory?: string[];
      tokenizerModel?: string;
    };
  }>('/api/lore-trigger/test', async (request, reply) => {
    const { card, input, chatHistory = [], tokenizerModel = 'gpt2-bpe-approx' } = request.body;

    if (!card || input === undefined) {
      reply.code(400);
      return { error: 'Missing card or input' };
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

    // Extract character book
    let characterBook: CharacterBook | undefined;

    if ('character_book' in card) {
      characterBook = card.character_book;
    } else if ('data' in card && card.data && 'character_book' in card.data) {
      characterBook = (card.data as any).character_book;
    }

    // Create tester
    const tester = new LoreTriggerTester((text: string) => tokenizer.estimate(text));

    try {
      const result = tester.testInput(input, characterBook, chatHistory);

      return {
        success: true,
        result,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to test triggers',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * POST /lore-trigger/stats
   * Get statistics about lorebook entries
   */
  fastify.post<{
    Body: {
      card: CCv2Data | CCv3Data;
    };
  }>('/api/lore-trigger/stats', async (request, reply) => {
    const { card } = request.body;

    if (!card) {
      reply.code(400);
      return { error: 'Missing card' };
    }

    // Extract character book
    let characterBook: CharacterBook | undefined;

    if ('character_book' in card) {
      characterBook = card.character_book;
    } else if ('data' in card && card.data && 'character_book' in card.data) {
      characterBook = (card.data as any).character_book;
    }

    // Create tester
    const tester = new LoreTriggerTester(() => 0); // No tokenizer needed for stats

    try {
      const stats = tester.getEntryStats(characterBook);

      return {
        success: true,
        stats,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to get stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
