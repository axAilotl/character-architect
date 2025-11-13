import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { CardRepository } from '../db/repository.js';
import { extractFromPNG, embedIntoPNG, validatePNGSize } from '../utils/png.js';
import { detectSpec, validateV2, validateV3, type CCv2Data, type CCv3Data } from '@card-architect/schemas';
import { config } from '../config.js';

export async function importExportRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);

  // Import from JSON or PNG
  fastify.post('/import', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file provided' };
    }

    const buffer = await data.toBuffer();
    const warnings: string[] = [];

    let cardData: unknown;
    let spec: 'v2' | 'v3';

    // Detect format
    if (data.mimetype === 'application/json') {
      try {
        cardData = JSON.parse(buffer.toString('utf-8'));
        const detectedSpec = detectSpec(cardData);
        if (!detectedSpec) {
          const obj = cardData as Record<string, unknown>;
          fastify.log.error({
            keys: Object.keys(obj).slice(0, 10),
            hasSpec: 'spec' in obj,
            specValue: obj.spec,
            hasSpecVersion: 'spec_version' in obj,
            specVersionValue: obj.spec_version,
            specVersionType: typeof obj.spec_version,
            hasData: 'data' in obj,
            hasName: 'name' in obj,
            dataHasName: obj.data && typeof obj.data === 'object' && 'name' in obj.data,
          }, 'Failed to detect spec for JSON card');
          reply.code(400);
          return {
            error: 'Invalid card format: unable to detect v2 or v3 spec. The JSON structure does not match expected character card formats.',
            details: 'Expected either: (1) v3 format with "spec":"chara_card_v3" and "data" object, (2) v2 format with "spec":"chara_card_v2" and "data" object, or (3) legacy v2 with direct "name" field.'
          };
        }
        spec = detectedSpec;
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to parse JSON');
        reply.code(400);
        return { error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else if (data.mimetype === 'image/png') {
      // Validate PNG size
      const sizeCheck = validatePNGSize(buffer, {
        max: config.limits.maxPngSizeMB,
        warn: config.limits.warnPngSizeMB,
      });

      if (!sizeCheck.valid) {
        fastify.log.warn({ warnings: sizeCheck.warnings }, 'PNG size validation failed');
        reply.code(400);
        return { error: 'PNG too large', warnings: sizeCheck.warnings };
      }

      warnings.push(...sizeCheck.warnings);

      try {
        const extracted = await extractFromPNG(buffer);
        if (!extracted) {
          fastify.log.error('No character card data found in PNG');
          reply.code(400);
          return {
            error: 'No character card data found in PNG',
            details: 'This PNG does not contain embedded character card data in its text chunks. Make sure the PNG was exported from a character card editor that embeds the card data. Common text chunk keys checked: chara, ccv2, ccv3, character, chara_card_v3.'
          };
        }
        cardData = extracted.data;
        spec = extracted.spec;
        fastify.log.info({ spec }, 'Successfully extracted card from PNG');
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to extract card from PNG');
        reply.code(400);
        return { error: `Failed to extract card from PNG: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else {
      fastify.log.warn({ mimetype: data.mimetype }, 'Unsupported file type');
      reply.code(400);
      return { error: `Unsupported file type: ${data.mimetype}. Only JSON and PNG are supported.` };
    }

    // Validate card data
    const validation = spec === 'v3' ? validateV3(cardData) : validateV2(cardData);
    if (!validation.valid) {
      fastify.log.error({
        spec,
        errors: validation.errors,
        keys: Object.keys(cardData as Record<string, unknown>).slice(0, 10),
      }, 'Card validation failed');
      reply.code(400);
      return { error: 'Card validation failed', errors: validation.errors };
    }

    warnings.push(...validation.errors.filter((e) => e.severity !== 'error').map((e) => e.message));

    // Extract name
    let name = 'Untitled';
    if (cardData && typeof cardData === 'object') {
      if ('name' in cardData && typeof cardData.name === 'string') {
        name = cardData.name;
      } else if ('data' in cardData && typeof cardData.data === 'object' && cardData.data && 'name' in cardData.data) {
        name = (cardData.data as { name: string }).name;
      }
    }

    // Create card
    const card = cardRepo.create({
      data: cardData as (CCv2Data | CCv3Data),
      meta: {
        name,
        spec,
        tags: [],
      },
    });

    reply.code(201);
    return { card, warnings };
  });

  // Export card as JSON or PNG
  fastify.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/cards/:id/export',
    async (request, reply) => {
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const format = request.query.format || 'json';

      if (format === 'json') {
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="${card.meta.name}.json"`);
        return JSON.stringify(card.data, null, 2);
      } else if (format === 'png') {
        // For PNG export, we need a base image
        // In a real implementation, this would use the card's avatar or a default image
        reply.code(501);
        return { error: 'PNG export requires an avatar image (not yet implemented)' };
      } else {
        reply.code(400);
        return { error: 'Invalid export format' };
      }
    }
  );

  // Convert between v2 and v3
  fastify.post('/convert', async (request, reply) => {
    const body = request.body as { from: string; to: string; card: unknown };

    if (!body.from || !body.to || !body.card) {
      reply.code(400);
      return { error: 'Missing required fields' };
    }

    // Validate input
    const validation = body.from === 'v3' ? validateV3(body.card) : validateV2(body.card);
    if (!validation.valid) {
      reply.code(400);
      return { error: 'Invalid input card', errors: validation.errors };
    }

    // Convert
    if (body.from === 'v2' && body.to === 'v3') {
      // v2 to v3 conversion
      const v2 = body.card as import('@card-architect/schemas').CCv2Data;
      const v3: import('@card-architect/schemas').CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: v2.name,
          description: v2.description,
          personality: v2.personality,
          scenario: v2.scenario,
          first_mes: v2.first_mes,
          mes_example: v2.mes_example,
          creator: v2.creator || '',
          character_version: v2.character_version || '1.0',
          tags: v2.tags || [],
          creator_notes: v2.creator_notes,
          system_prompt: v2.system_prompt,
          post_history_instructions: v2.post_history_instructions,
          alternate_greetings: v2.alternate_greetings,
          character_book: v2.character_book,
          extensions: v2.extensions,
        },
      };
      return v3;
    } else if (body.from === 'v3' && body.to === 'v2') {
      // v3 to v2 conversion
      const v3 = body.card as import('@card-architect/schemas').CCv3Data;
      const v2: import('@card-architect/schemas').CCv2Data = {
        name: v3.data.name,
        description: v3.data.description,
        personality: v3.data.personality,
        scenario: v3.data.scenario,
        first_mes: v3.data.first_mes,
        mes_example: v3.data.mes_example,
        creator: v3.data.creator,
        character_version: v3.data.character_version,
        tags: v3.data.tags,
        creator_notes: v3.data.creator_notes,
        system_prompt: v3.data.system_prompt,
        post_history_instructions: v3.data.post_history_instructions,
        alternate_greetings: v3.data.alternate_greetings,
        character_book: v3.data.character_book as import('@card-architect/schemas').CCv2CharacterBook,
        extensions: v3.data.extensions,
      };
      return v2;
    } else {
      reply.code(400);
      return { error: 'Invalid conversion' };
    }
  });
}
