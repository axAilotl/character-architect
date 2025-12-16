/**
 * SillyTavern Settings Schema
 *
 * Zod schema for SillyTavern push integration settings.
 */

import { z } from 'zod';
import type { UIHints } from '@character-foundry/character-foundry/app-framework';

export const sillyTavernSettingsSchema = z.object({
  enabled: z.boolean().default(false).describe('Enable SillyTavern push integration'),
  baseUrl: z.string().default('').describe('SillyTavern base URL'),
  importEndpoint: z.string().default('/api/characters/import').describe('Import endpoint'),
  sessionCookie: z.string().default('').describe('Session cookie for authentication'),
});

export type SillyTavernSettings = z.infer<typeof sillyTavernSettingsSchema>;

export const sillyTavernSettingsUiHints: UIHints<SillyTavernSettings> = {
  enabled: {
    widget: 'switch',
    label: 'Enable SillyTavern Push Integration',
  },
  baseUrl: {
    label: 'SillyTavern Base URL',
    placeholder: 'http://localhost:8000',
    helperText: 'The base URL of your SillyTavern instance (e.g., http://localhost:8000)',
    condition: { field: 'enabled', equals: true },
  },
  importEndpoint: {
    label: 'Import Endpoint',
    placeholder: '/api/characters/import',
    helperText: 'Usually /api/characters/import (default)',
    condition: { field: 'enabled', equals: true },
  },
  sessionCookie: {
    widget: 'textarea',
    label: 'Session Cookie (Optional)',
    placeholder: 'connect.sid=...',
    helperText: 'Optional session cookie for authentication. Usually not needed for local instances.',
    condition: { field: 'enabled', equals: true },
  },
};
