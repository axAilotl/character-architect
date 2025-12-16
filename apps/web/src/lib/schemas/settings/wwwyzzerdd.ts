/**
 * wwwyzzerdd Settings Schema
 *
 * Zod schema for wwwyzzerdd prompt set editor.
 * Note: Prompt set list, CRUD operations, and import/export stay manual.
 */

import { z } from 'zod';
import type { UIHints } from '@character-foundry/character-foundry/app-framework';

// Prompt set editor schema
export const promptSetEditorSchema = z.object({
  name: z.string().min(1).describe('Prompt set name'),
  description: z.string().optional().describe('Brief description'),
  characterPrompt: z.string().min(1).describe('Character creation system prompt'),
  lorePrompt: z.string().min(1).describe('Lore/worldbuilding system prompt'),
  personality: z.string().min(1).describe('wwwyzzerdd personality/tone'),
});

export type PromptSetEditor = z.infer<typeof promptSetEditorSchema>;

export const promptSetEditorUiHints: UIHints<PromptSetEditor> = {
  name: {
    label: 'Name',
    placeholder: 'e.g., Creative Wizard',
  },
  description: {
    label: 'Description',
    placeholder: 'Brief description',
  },
  characterPrompt: {
    label: 'Character Prompt',
    widget: 'textarea',
    placeholder: 'System prompt for character creation assistance...',
    rows: 6,
  },
  lorePrompt: {
    label: 'Lore Prompt',
    widget: 'textarea',
    placeholder: 'System prompt for lore/worldbuilding assistance...',
    rows: 4,
  },
  personality: {
    label: 'Personality',
    widget: 'textarea',
    placeholder: 'How wwwyzzerdd should speak and behave...',
    rows: 3,
  },
};
