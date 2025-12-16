/**
 * ComfyUI Settings Schema
 *
 * Zod schema for ComfyUI configuration settings.
 */

import { z } from 'zod';
import type { UIHints } from '@character-foundry/character-foundry/app-framework';

export const comfyUISettingsSchema = z.object({
  serverUrl: z.string().default('').describe('ComfyUI server URL'),
  quietMode: z.boolean().default(false).describe('Save images silently'),
});

export type ComfyUISettings = z.infer<typeof comfyUISettingsSchema>;

export const comfyUISettingsUiHints: UIHints<ComfyUISettings> = {
  serverUrl: {
    label: 'ComfyUI Server URL',
    placeholder: 'http://127.0.0.1:8188',
    helperText:
      'The address of your ComfyUI server (e.g., http://127.0.0.1:8188 or https://comfy.example.com)',
  },
  quietMode: {
    widget: 'switch',
    label: 'Quiet Mode',
    helperText: 'Save images silently without showing confirmation panel',
  },
};
