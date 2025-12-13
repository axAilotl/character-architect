/**
 * Presets Settings Schema
 *
 * Zod schemas for LLM presets editor and AI generation prompts.
 * Note: Preset list rendering, CRUD operations, and import/export stay manual.
 */

import { z } from 'zod';
import type { UIHints } from '@character-foundry/app-framework';

// Preset category enum
export const presetCategorySchema = z.enum(['rewrite', 'format', 'generate', 'custom']);
export type PresetCategory = z.infer<typeof presetCategorySchema>;

// Preset editor schema
export const presetEditorSchema = z.object({
  name: z.string().min(1).max(100).describe('Preset name'),
  description: z.string().max(500).optional().describe('Brief description'),
  category: presetCategorySchema.default('custom').describe('Preset category'),
  instruction: z.string().min(1).max(5000).describe('LLM instruction prompt'),
});

export type PresetEditor = z.infer<typeof presetEditorSchema>;

export const presetEditorUiHints: UIHints<PresetEditor> = {
  name: {
    label: 'Name',
    placeholder: 'e.g., Tighten to 100 tokens',
    helperText: 'A descriptive name for this preset.',
  },
  description: {
    label: 'Description',
    placeholder: 'Brief description of what this preset does',
  },
  category: {
    label: 'Category',
    widget: 'select',
    options: [
      { value: 'rewrite', label: 'Rewrite' },
      { value: 'format', label: 'Format' },
      { value: 'generate', label: 'Generate' },
      { value: 'custom', label: 'Custom' },
    ],
  },
  instruction: {
    label: 'Instruction',
    widget: 'textarea',
    placeholder: 'The prompt/instruction to send to the LLM',
    rows: 8,
    helperText: 'Max 5000 characters.',
  },
};

// AI generation prompts schema
export const aiPromptsSchema = z.object({
  tagsSystemPrompt: z.string().describe('Tags generation system prompt'),
  taglineSystemPrompt: z.string().describe('Tagline generation system prompt'),
});

export type AIPrompts = z.infer<typeof aiPromptsSchema>;

export const aiPromptsUiHints: UIHints<AIPrompts> = {
  tagsSystemPrompt: {
    label: 'Tags Generation',
    widget: 'textarea',
    rows: 3,
    helperText: '5-10 single-word slugs. Hyphens for compound words.',
  },
  taglineSystemPrompt: {
    label: 'Tagline Generation',
    widget: 'textarea',
    rows: 3,
    helperText: 'Catchy text, up to 500 characters.',
  },
};
