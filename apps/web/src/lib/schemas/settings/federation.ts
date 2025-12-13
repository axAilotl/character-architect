/**
 * Federation Settings Schema
 *
 * Note: Federation settings use per-platform config cards with async operations.
 * AutoForm is not directly used since each platform card manages its own state
 * and requires async test/connect/disconnect functionality.
 */

import { z } from 'zod';
import type { PlatformId } from '../../../modules/federation/lib/types';

// Platform config schema
export const platformConfigSchema = z.object({
  baseUrl: z.string().default('').describe('Platform base URL'),
  apiKey: z.string().optional().describe('API key for authentication'),
  enabled: z.boolean().optional().describe('Whether platform is enabled'),
  connected: z.boolean().optional().describe('Whether currently connected'),
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;

// Platform info for UI
export const PLATFORM_INFO: Record<PlatformId, { name: string; description: string; placeholder: string }> = {
  sillytavern: {
    name: 'SillyTavern',
    description: 'Sync via CForge federation plugin. Requires CForge plugin with federation support.',
    placeholder: 'http://localhost:8000',
  },
  hub: {
    name: 'CardsHub',
    description: 'Central hub for sharing and discovering character cards.',
    placeholder: 'https://cardshub.example.com',
  },
  archive: {
    name: 'Character Archive',
    description: 'Personal archive for storing and organizing your cards.',
    placeholder: 'https://archive.example.com',
  },
  editor: {
    name: 'Character Architect',
    description: 'Local editor storage (always enabled).',
    placeholder: '',
  },
  risu: {
    name: 'RisuAI',
    description: 'Sync with RisuAI character library.',
    placeholder: 'https://risuai.example.com',
  },
  chub: {
    name: 'Chub.ai',
    description: 'Sync with Chub.ai character library.',
    placeholder: 'https://chub.ai',
  },
  custom: {
    name: 'Custom Platform',
    description: 'Connect to a custom federation-compatible platform.',
    placeholder: 'https://custom.example.com',
  },
};

/**
 * Normalize URL by removing trailing slashes
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Check if platform requires API key input
 */
export function platformRequiresApiKey(platform: PlatformId): boolean {
  return platform === 'hub' || platform === 'archive';
}
