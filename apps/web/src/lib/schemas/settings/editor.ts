/**
 * Editor Settings Schema
 *
 * Zod schema for editor behavior settings.
 */

import { z } from 'zod';
import type { UIHints } from '@character-foundry/app-framework';

export const exportSpecSchema = z.enum(['v2', 'v3']);

export const extendedFocusedFieldsSchema = z.object({
  personality: z.boolean().default(true),
  appearance: z.boolean().default(true),
  characterNote: z.boolean().default(true),
  exampleDialogue: z.boolean().default(true),
  systemPrompt: z.boolean().default(true),
  postHistory: z.boolean().default(true),
});

// Core editor settings (used in EditorSettingsPanel)
export const editorSettingsSchema = z.object({
  showV3Fields: z
    .boolean()
    .default(true)
    .describe('Show V3-only fields in editor'),
  exportSpec: exportSpecSchema
    .default('v3')
    .describe('Default export spec version'),
  showExtensionsTab: z
    .boolean()
    .default(true)
    .describe('Show Extensions tab in editor'),
});

// Full editor settings including focused fields (for store compatibility)
export const fullEditorSettingsSchema = editorSettingsSchema.extend({
  extendedFocusedFields: extendedFocusedFieldsSchema.describe(
    'Extended focused editor fields'
  ),
});

export type EditorSettings = z.infer<typeof editorSettingsSchema>;
export type FullEditorSettings = z.infer<typeof fullEditorSettingsSchema>;
export type ExportSpec = z.infer<typeof exportSpecSchema>;
export type ExtendedFocusedFields = z.infer<typeof extendedFocusedFieldsSchema>;

export const editorSettingsUiHints: UIHints<EditorSettings> = {
  exportSpec: {
    label: 'Export Format',
    widget: 'select',
    options: [
      { value: 'v3', label: 'CCv3 (Character Card v3)' },
      { value: 'v2', label: 'CCv2 (Character Card v2)' },
    ],
    helperText:
      'Choose the default spec version for PNG and JSON exports. CHARX is always V3, Voxta uses its own format.',
  },
  showV3Fields: {
    label: 'Show V3-Only Fields',
    widget: 'switch',
    helperText:
      'Control visibility of CCv3-only fields in the editor (Group Only Greetings, Source URLs, Multilingual Creator Notes, Metadata Timestamps).',
  },
  showExtensionsTab: {
    label: 'Show Extensions Tab',
    widget: 'switch',
    helperText: 'Show or hide the Extensions tab in the editor.',
  },
};
