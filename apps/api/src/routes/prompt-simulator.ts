import type { FastifyInstance } from 'fastify';
import { PromptSimulator, type PromptProfile, type TokenBudgetConfig } from '../services/prompt-simulator.js';
import { tokenizerRegistry } from '@card-architect/tokenizers';
import type { CCv2Data, CCv3Data } from '@card-architect/schemas';

/**
 * Prompt Simulator Routes
 *
 * Endpoints for simulating how different frontends compose prompts
 */
export async function promptSimulatorRoutes(fastify: FastifyInstance) {
  /**
   * GET /prompt-simulator/profiles
   * Get all available prompt profiles
   */
  fastify.get('/api/prompt-simulator/profiles', async (request, reply) => {
    const profiles = PromptSimulator.getProfiles();
    return { profiles };
  });

  /**
   * POST /prompt-simulator/simulate
   * Simulate prompt composition with a specific profile
   */
  fastify.post<{
    Body: {
      card: CCv2Data | CCv3Data;
      profile: PromptProfile;
      tokenizerModel?: string;
      budget?: {
        maxTokens: number;
        dropPolicy: 'oldest-first' | 'lowest-priority' | 'truncate-end';
        preserveFields?: string[];
      };
    };
  }>('/api/prompt-simulator/simulate', async (request, reply) => {
    const { card, profile, tokenizerModel = 'gpt2-bpe-approx', budget } = request.body;

    if (!card) {
      reply.code(400);
      return { error: 'Missing card data' };
    }

    if (!profile) {
      reply.code(400);
      return { error: 'Missing profile' };
    }

    // Get tokenizer
    const tokenizer = tokenizerRegistry.get(tokenizerModel);
    if (!tokenizer) {
      reply.code(400);
      return {
        error: `Unknown tokenizer model: ${tokenizerModel}`,
        available: tokenizerRegistry.list().map(t => t.id)
      };
    }

    // Create simulator
    const simulator = new PromptSimulator((text: string) => tokenizer.estimate(text));

    // Compose prompt
    const budgetConfig: TokenBudgetConfig | undefined = budget ? {
      maxTokens: budget.maxTokens,
      dropPolicy: budget.dropPolicy,
      preserveFields: budget.preserveFields || ['description', 'first_mes'],
    } : undefined;

    try {
      const composition = simulator.composePrompt(card, profile, budgetConfig);

      return {
        success: true,
        composition,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to compose prompt',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  /**
   * POST /prompt-simulator/compare
   * Compare multiple profiles side-by-side
   */
  fastify.post<{
    Body: {
      card: CCv2Data | CCv3Data;
      profiles?: PromptProfile[];
      tokenizerModel?: string;
      budget?: {
        maxTokens: number;
        dropPolicy: 'oldest-first' | 'lowest-priority' | 'truncate-end';
        preserveFields?: string[];
      };
    };
  }>('/api/prompt-simulator/compare', async (request, reply) => {
    const {
      card,
      profiles = ['generic-ccv3', 'strict-ccv3', 'ccv2-compat'] as PromptProfile[],
      tokenizerModel = 'gpt2-bpe-approx',
      budget
    } = request.body;

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
        available: tokenizerRegistry.list().map(t => t.id)
      };
    }

    // Create simulator
    const simulator = new PromptSimulator((text: string) => tokenizer.estimate(text));

    // Compose for each profile
    const budgetConfig: TokenBudgetConfig | undefined = budget ? {
      maxTokens: budget.maxTokens,
      dropPolicy: budget.dropPolicy,
      preserveFields: budget.preserveFields || ['description', 'first_mes'],
    } : undefined;

    try {
      const comparisons = profiles.map(profile => ({
        profile,
        composition: simulator.composePrompt(card, profile, budgetConfig),
      }));

      return {
        success: true,
        comparisons,
        tokenizerModel,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to compare profiles',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  /**
   * POST /prompt-simulator/preview-field
   * Preview token impact of a single field change
   */
  fastify.post<{
    Body: {
      card: CCv2Data | CCv3Data;
      fieldName: string;
      newValue: string;
      profile: PromptProfile;
      tokenizerModel?: string;
    };
  }>('/api/prompt-simulator/preview-field', async (request, reply) => {
    const {
      card,
      fieldName,
      newValue,
      profile,
      tokenizerModel = 'gpt2-bpe-approx'
    } = request.body;

    if (!card || !fieldName || newValue === undefined || !profile) {
      reply.code(400);
      return { error: 'Missing required parameters' };
    }

    // Get tokenizer
    const tokenizer = tokenizerRegistry.get(tokenizerModel);
    if (!tokenizer) {
      reply.code(400);
      return {
        error: `Unknown tokenizer model: ${tokenizerModel}`,
        available: tokenizerRegistry.list().map(t => t.id)
      };
    }

    // Create simulator
    const simulator = new PromptSimulator((text: string) => tokenizer.estimate(text));

    try {
      // Compose with original card
      const original = simulator.composePrompt(card, profile);

      // Create modified card
      const modifiedCard = { ...card };
      if ('data' in modifiedCard && modifiedCard.data) {
        (modifiedCard.data as any)[fieldName] = newValue;
      } else {
        (modifiedCard as any)[fieldName] = newValue;
      }

      // Compose with modified card
      const modified = simulator.composePrompt(modifiedCard, profile);

      // Calculate delta
      const tokenDelta = modified.totalTokens - original.totalTokens;

      return {
        success: true,
        original: {
          totalTokens: original.totalTokens,
          segment: original.segments.find(s => s.fieldName === fieldName),
        },
        modified: {
          totalTokens: modified.totalTokens,
          segment: modified.segments.find(s => s.fieldName === fieldName),
        },
        tokenDelta,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        error: 'Failed to preview field change',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
