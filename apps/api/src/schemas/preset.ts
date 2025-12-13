/**
 * Preset route schemas
 */

import { z } from 'zod';

// Create preset request
export const createPresetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  instruction: z.string().min(1).max(5000),
  category: z.string().max(50).optional(),
});

// Update preset request (partial)
export const updatePresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  instruction: z.string().min(1).max(5000).optional(),
  category: z.string().max(50).optional(),
});

// Copy preset request
export const copyPresetSchema = z.object({
  name: z.string().max(100).optional(),
});

// Import presets request
export const importPresetsSchema = z.object({
  presets: z.array(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    instruction: z.string().min(1).max(5000),
    category: z.string().max(50).optional(),
  })),
});

export type CreatePresetInput = z.infer<typeof createPresetSchema>;
export type UpdatePresetInput = z.infer<typeof updatePresetSchema>;
export type CopyPresetInput = z.infer<typeof copyPresetSchema>;
export type ImportPresetsInput = z.infer<typeof importPresetsSchema>;
