import type { FastifyInstance } from 'fastify';
import { CardRepository, CardAssetRepository } from '../db/repository.js';
import { validateV2, validateV3, type CCv2Data, type CCv3Data, type CardMeta } from '@card-architect/schemas';
import { normalizeLorebookEntries } from './import-export.js';

export async function cardRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);

  // List cards
  fastify.get('/cards', async (request) => {
    const { query, page } = request.query as { query?: string; page?: string };
    const cards = cardRepo.list(query, parseInt(page || '1', 10));
    return cards;
  });

  // Get single card
  fastify.get<{ Params: { id: string } }>('/cards/:id', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }
    return card;
  });

  // Get card assets
  fastify.get<{ Params: { id: string } }>('/cards/:id/assets', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    const assets = cardAssetRepo.listByCardWithDetails(request.params.id);
    return assets;
  });

  // Set asset as main
  fastify.patch<{ Params: { id: string; assetId: string } }>(
    '/cards/:id/assets/:assetId/main',
    async (request, reply) => {
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const success = cardAssetRepo.setMain(request.params.id, request.params.assetId);
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
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const success = cardAssetRepo.delete(request.params.assetId);
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
    const body = request.body as { data: unknown; meta?: unknown };

    // Validate based on spec
    const spec = body.meta && typeof body.meta === 'object' && 'spec' in body.meta
      ? (body.meta as { spec: string }).spec
      : 'v2';

    const validation = spec === 'v3' ? validateV3(body.data) : validateV2(body.data);

    if (!validation.valid) {
      reply.code(400);
      return { error: 'Validation failed', errors: validation.errors };
    }

    // Extract name from data
    let name = 'Untitled';
    if (body.data && typeof body.data === 'object') {
      if ('name' in body.data && typeof body.data.name === 'string') {
        name = body.data.name;
      } else if ('data' in body.data && typeof body.data.data === 'object' && body.data.data && 'name' in body.data.data) {
        name = (body.data.data as { name: string }).name;
      }
    }

    // Filter out fields that should be auto-generated
    const userMeta = body.meta as Record<string, unknown> | undefined;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...safeMeta } = userMeta || {};

    const card = cardRepo.create({
      data: body.data as (CCv2Data | CCv3Data),
      meta: {
        name,
        spec: spec as 'v2' | 'v3',
        tags: [],
        ...safeMeta,
      },
    });

    reply.code(201);
    return card;
  });

  // Update card
  fastify.patch<{ Params: { id: string } }>('/cards/:id', async (request, reply) => {
    const body = request.body as { data?: unknown; meta?: unknown };

    const existing = cardRepo.get(request.params.id);
    if (!existing) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    // Normalize and validate if data is being updated
    if (body.data) {
      const spec = existing.meta.spec;

      // Normalize lorebook entries before validation
      // Handle both wrapped ({spec, data}) and unwrapped formats
      const dataObj = body.data as Record<string, unknown>;
      if ('data' in dataObj && typeof dataObj.data === 'object' && dataObj.data) {
        normalizeLorebookEntries(dataObj.data as Record<string, unknown>);
      } else {
        normalizeLorebookEntries(dataObj);
      }

      const validation = spec === 'v3' ? validateV3(body.data) : validateV2(body.data);

      if (!validation.valid) {
        fastify.log.error({ errors: validation.errors, spec }, 'Card validation failed');
        reply.code(400);
        return { error: 'Validation failed', errors: validation.errors };
      }
    }

    // Using object with optional partial properties for the update
    const updateData: { data?: CCv2Data | CCv3Data; meta?: Partial<CardMeta> } = {};

    // Start with any meta updates from the request
    if (body.meta && typeof body.meta === 'object') {
      updateData.meta = body.meta as Partial<CardMeta>;
    }

    if (body.data) {
      updateData.data = body.data as (CCv2Data | CCv3Data);

      // Extract name from data and sync to meta.name
      let name: string | undefined;
      const dataObj = body.data as Record<string, unknown>;
      if ('name' in dataObj && typeof dataObj.name === 'string') {
        name = dataObj.name;
      } else if ('data' in dataObj && typeof dataObj.data === 'object' && dataObj.data) {
        const innerData = dataObj.data as Record<string, unknown>;
        if ('name' in innerData && typeof innerData.name === 'string') {
          name = innerData.name;
        }
      }

      // Update meta.name if we found a name in the data
      if (name) {
        updateData.meta = { ...(updateData.meta || {}), name };
      }
    }

    // Cast is safe because repository.update merges with existing card
    const card = cardRepo.update(request.params.id, updateData as any);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    return card;
  });

  // Delete card
  fastify.delete<{ Params: { id: string } }>('/cards/:id', async (request, reply) => {
    const deleted = cardRepo.delete(request.params.id);
    if (!deleted) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    reply.code(204);
    return;
  });

  // List versions
  fastify.get<{ Params: { id: string } }>('/cards/:id/versions', async (request) => {
    const versions = cardRepo.listVersions(request.params.id);
    return versions;
  });

  // Create version snapshot
  fastify.post<{ Params: { id: string } }>('/cards/:id/versions', async (request, reply) => {
    const body = request.body as { message?: string };
    const version = cardRepo.createVersion(request.params.id, body.message);

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
      const card = cardRepo.restoreVersion(request.params.id, request.params.versionId);

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
      const deleted = cardRepo.deleteVersion(request.params.id, request.params.versionId);

      if (!deleted) {
        reply.code(404);
        return { error: 'Card or version not found' };
      }

      reply.code(204);
      return;
    }
  );
}
