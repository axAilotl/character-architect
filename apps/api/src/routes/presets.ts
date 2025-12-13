import type { FastifyInstance } from 'fastify';
import { PresetRepository } from '../db/preset-repository.js';
import { validateBody } from '../middleware/validate.js';
import {
  createPresetSchema,
  updatePresetSchema,
  copyPresetSchema,
  importPresetsSchema,
} from '../schemas/index.js';

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
  fastify.post('/presets', async (request, reply) => {
    const validated = validateBody(createPresetSchema, request.body, reply);
    if (!validated.success) return;

    try {
      const preset = presetRepo.create(validated.data);
      reply.code(201);
      return { preset };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500);
      return { error: 'Failed to create preset' };
    }
  });

  // Update preset
  fastify.patch<{ Params: { id: string } }>(
    '/presets/:id',
    async (request, reply) => {
      const validated = validateBody(updatePresetSchema, request.body, reply);
      if (!validated.success) return;

      try {
        const preset = presetRepo.update({ id: request.params.id, ...validated.data });
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

  // Toggle hidden state for a preset
  fastify.post<{ Params: { id: string } }>('/presets/:id/toggle-hidden', async (request, reply) => {
    try {
      const preset = presetRepo.toggleHidden(request.params.id);
      if (!preset) {
        reply.code(404);
        return { error: 'Preset not found' };
      }
      return { preset };
    } catch (err: any) {
      fastify.log.error(err);
      reply.code(500);
      return { error: 'Failed to toggle hidden state' };
    }
  });

  // Copy a preset (creates a new user preset from any preset including built-in)
  fastify.post<{ Params: { id: string } }>(
    '/presets/:id/copy',
    async (request, reply) => {
      const validated = validateBody(copyPresetSchema, request.body || {}, reply);
      if (!validated.success) return;

      try {
        const preset = presetRepo.copy(request.params.id, validated.data.name);
        if (!preset) {
          reply.code(404);
          return { error: 'Preset not found' };
        }
        reply.code(201);
        return { preset };
      } catch (err: any) {
        fastify.log.error(err);
        reply.code(500);
        return { error: 'Failed to copy preset' };
      }
    }
  );

  // Get only visible presets (for LLM assist UI)
  fastify.get('/presets/visible', async () => {
    const presets = presetRepo.getVisible();
    return { presets };
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
  fastify.post(
    '/presets/import',
    async (request, reply) => {
      const validated = validateBody(importPresetsSchema, request.body, reply);
      if (!validated.success) return;

      const imported: string[] = [];
      const failed: Array<{ name: string; error: string }> = [];

      for (const preset of validated.data.presets) {
        try {
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
