import type { FastifyInstance } from 'fastify';
import { PresetRepository } from '../db/preset-repository.js';
import type { CreatePresetRequest } from '@card-architect/schemas';

export async function presetRoutes(fastify: FastifyInstance) {
  const presetRepo = new PresetRepository(fastify.db);

  // Initialize built-in presets on server start
  presetRepo.initializeBuiltInPresets();

  // Get all presets
  fastify.get('/presets', async () => {
    const presets = presetRepo.getAll();
    return { presets };
  });

  // Get preset by ID
  fastify.get<{ Params: { id: string } }>('/presets/:id', async (request, reply) => {
    const preset = presetRepo.getById(request.params.id);
    if (!preset) {
      reply.code(404);
      return { error: 'Preset not found' };
    }
    return { preset };
  });

  // Create new preset
  fastify.post<{ Body: CreatePresetRequest }>('/presets', async (request, reply) => {
    const { name, description, instruction, category } = request.body;

    if (!name || !instruction) {
      reply.code(400);
      return { error: 'Name and instruction are required' };
    }

    if (name.length > 100) {
      reply.code(400);
      return { error: 'Name must be 100 characters or less' };
    }

    if (instruction.length > 5000) {
      reply.code(400);
      return { error: 'Instruction must be 5000 characters or less' };
    }

    try {
      const preset = presetRepo.create({ name, description, instruction, category });
      reply.code(201);
      return { preset };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500);
      return { error: 'Failed to create preset' };
    }
  });

  // Update preset
  fastify.patch<{ Params: { id: string }; Body: Partial<CreatePresetRequest> }>(
    '/presets/:id',
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      if (updates.name && updates.name.length > 100) {
        reply.code(400);
        return { error: 'Name must be 100 characters or less' };
      }

      if (updates.instruction && updates.instruction.length > 5000) {
        reply.code(400);
        return { error: 'Instruction must be 5000 characters or less' };
      }

      try {
        const preset = presetRepo.update({ id, ...updates });
        if (!preset) {
          reply.code(404);
          return { error: 'Preset not found' };
        }
        return { preset };
      } catch (err: any) {
        if (err.message?.includes('built-in')) {
          reply.code(403);
          return { error: err.message };
        }
        fastify.log.error(err);
        reply.code(500);
        return { error: 'Failed to update preset' };
      }
    }
  );

  // Delete preset
  fastify.delete<{ Params: { id: string } }>('/presets/:id', async (request, reply) => {
    try {
      const deleted = presetRepo.delete(request.params.id);
      if (!deleted) {
        reply.code(404);
        return { error: 'Preset not found' };
      }
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('built-in')) {
        reply.code(403);
        return { error: err.message };
      }
      fastify.log.error(err);
      reply.code(500);
      return { error: 'Failed to delete preset' };
    }
  });

  // Export all user presets as JSON
  fastify.get('/presets/export/all', async (_request, reply) => {
    const allPresets = presetRepo.getAll();
    const userPresets = allPresets.filter((p) => !p.isBuiltIn);

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="llm-presets.json"');

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      presets: userPresets.map((p) => ({
        name: p.name,
        description: p.description,
        instruction: p.instruction,
        category: p.category,
      })),
    };
  });

  // Import presets from JSON
  fastify.post<{ Body: { presets: CreatePresetRequest[] } }>(
    '/presets/import',
    async (request, reply) => {
      const { presets } = request.body;

      if (!Array.isArray(presets)) {
        reply.code(400);
        return { error: 'Invalid import format: presets must be an array' };
      }

      const imported: string[] = [];
      const failed: Array<{ name: string; error: string }> = [];

      for (const preset of presets) {
        try {
          if (!preset.name || !preset.instruction) {
            failed.push({ name: preset.name || 'Unknown', error: 'Missing required fields' });
            continue;
          }

          const created = presetRepo.create(preset);
          imported.push(created.id);
        } catch (err: any) {
          failed.push({ name: preset.name, error: err.message });
        }
      }

      return {
        success: true,
        imported: imported.length,
        failed: failed.length,
        failures: failed,
      };
    }
  );
}
