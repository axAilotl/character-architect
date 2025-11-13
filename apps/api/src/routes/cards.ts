import type { FastifyInstance } from 'fastify';
import { CardRepository } from '../db/repository.js';
import { validateV2, validateV3, type CCv2Data, type CCv3Data } from '@card-architect/schemas';

export async function cardRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);

  // List cards
  fastify.get('/cards', async (request, reply) => {
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

    // Validate if data is being updated
    if (body.data) {
      const existing = cardRepo.get(request.params.id);
      if (!existing) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const spec = existing.meta.spec;
      const validation = spec === 'v3' ? validateV3(body.data) : validateV2(body.data);

      if (!validation.valid) {
        reply.code(400);
        return { error: 'Validation failed', errors: validation.errors };
      }
    }

    const updateData: Partial<{ data: CCv2Data | CCv3Data; meta: unknown }> = {};
    if (body.data) {
      updateData.data = body.data as (CCv2Data | CCv3Data);
    }
    if (body.meta) {
      updateData.meta = body.meta;
    }

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
  fastify.get<{ Params: { id: string } }>('/cards/:id/versions', async (request, reply) => {
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
}
