import type { FastifyInstance } from 'fastify';
import { CardRepository, CardAssetRepository } from '../db/repository.js';
import { CardService } from '../services/card.service.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createCardSchema,
  updateCardSchema,
  createVersionSchema,
  listCardsQuerySchema,
} from '../schemas/index.js';

export async function cardRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);
  const cardService = new CardService(cardRepo, cardAssetRepo);

  // List cards with validated query params
  fastify.get('/cards', async (request, reply) => {
    const validation = validateQuery(listCardsQuerySchema, request.query, reply);
    if (!validation.success) return;

    const { query, page, limit } = validation.data;
    const result = cardService.list(query, page, limit);
    return result;
  });

  // Get single card
  fastify.get<{ Params: { id: string } }>('/cards/:id', async (request, reply) => {
    const card = cardService.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }
    return card;
  });

  // Get card assets
  fastify.get<{ Params: { id: string } }>('/cards/:id/assets', async (request, reply) => {
    const assets = cardService.getAssets(request.params.id);
    if (assets === null) {
      reply.code(404);
      return { error: 'Card not found' };
    }
    return assets;
  });

  // Set asset as main
  fastify.patch<{ Params: { id: string; assetId: string } }>(
    '/cards/:id/assets/:assetId/main',
    async (request, reply) => {
      const success = cardService.setMainAsset(request.params.id, request.params.assetId);
      if (success === null) {
        reply.code(404);
        return { error: 'Card not found' };
      }
      if (!success) {
        reply.code(404);
        return { error: 'Asset not found' };
      }
      return { success: true };
    }
  );

  // Delete card asset
  fastify.delete<{ Params: { id: string; assetId: string } }>(
    '/cards/:id/assets/:assetId',
    async (request, reply) => {
      const success = cardService.deleteAsset(request.params.id, request.params.assetId);
      if (success === null) {
        reply.code(404);
        return { error: 'Card not found' };
      }
      if (!success) {
        reply.code(404);
        return { error: 'Asset not found' };
      }
      reply.code(204);
      return;
    }
  );

  // Create card
  fastify.post('/cards', async (request, reply) => {
    const validated = validateBody(createCardSchema, request.body, reply);
    if (!validated.success) return;

    const result = cardService.create({ data: validated.data.data, meta: validated.data.meta });

    if ('error' in result) {
      reply.code(400);
      return { error: result.error, errors: result.errors };
    }

    reply.code(201);
    return result.card;
  });

  // Update card
  fastify.patch<{ Params: { id: string } }>('/cards/:id', async (request, reply) => {
    const validated = validateBody(updateCardSchema, request.body, reply);
    if (!validated.success) return;

    const result = cardService.update(request.params.id, { data: validated.data.data, meta: validated.data.meta });

    if (result === null) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    if ('error' in result) {
      fastify.log.error({ errors: result.errors }, 'Card validation failed');
      reply.code(400);
      return { error: result.error, errors: result.errors };
    }

    return result.card;
  });

  // Delete card
  fastify.delete<{ Params: { id: string } }>('/cards/:id', async (request, reply) => {
    const deleted = cardService.delete(request.params.id);
    if (!deleted) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    reply.code(204);
    return;
  });

  // List versions
  fastify.get<{ Params: { id: string } }>('/cards/:id/versions', async (request) => {
    const versions = cardService.listVersions(request.params.id);
    return versions;
  });

  // Create version snapshot
  fastify.post<{ Params: { id: string } }>('/cards/:id/versions', async (request, reply) => {
    const validated = validateBody(createVersionSchema, request.body, reply);
    if (!validated.success) return;

    const version = cardService.createVersion(request.params.id, validated.data.message);

    if (!version) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    reply.code(201);
    return version;
  });

  // Restore from version
  fastify.post<{ Params: { id: string; versionId: string } }>(
    '/cards/:id/versions/:versionId/restore',
    async (request, reply) => {
      const card = cardService.restoreVersion(request.params.id, request.params.versionId);

      if (!card) {
        reply.code(404);
        return { error: 'Card or version not found' };
      }

      return card;
    }
  );

  // Delete version
  fastify.delete<{ Params: { id: string; versionId: string } }>(
    '/cards/:id/versions/:versionId',
    async (request, reply) => {
      const deleted = cardService.deleteVersion(request.params.id, request.params.versionId);

      if (!deleted) {
        reply.code(404);
        return { error: 'Card or version not found' };
      }

      reply.code(204);
      return;
    }
  );
}
