/**
 * Package Optimizer Routes
 *
 * Settings for optimizing CHARX and Voxta package exports with WebP/WebM conversion,
 * image optimization, and selective asset type export.
 */

import type { FastifyInstance } from 'fastify';
import { getSettings, saveSettings } from '../utils/settings.js';
import type { CharxExportSettings } from '../types/index.js';
import { z } from 'zod';

const optimizerSettingsSchema = z.object({
  convertToWebp: z.boolean().optional(),
  webpQuality: z.number().int().min(1).max(100).optional(),
  maxMegapixels: z.number().finite().min(0).max(100).optional(),
  stripMetadata: z.boolean().optional(),
  convertMp4ToWebm: z.boolean().optional(),
  webmQuality: z.number().int().min(0).max(63).optional(),
  includedAssetTypes: z.array(z.string().min(1).max(64)).max(100).optional(),
}).strict();

/**
 * Default package export optimization settings
 */
export const DEFAULT_CHARX_EXPORT_SETTINGS: CharxExportSettings = {
  convertToWebp: true,
  webpQuality: 85,
  maxMegapixels: 4,
  stripMetadata: true,
  convertMp4ToWebm: false,
  webmQuality: 30,
  includedAssetTypes: [], // Empty = include all types
};

// Alias for clarity
export const DEFAULT_PACKAGE_EXPORT_SETTINGS = DEFAULT_CHARX_EXPORT_SETTINGS;

export async function charxOptimizerRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/package-optimizer/settings
   * Get current package export optimization settings
   */
  fastify.get('/package-optimizer/settings', async () => {
    const settings = await getSettings();
    const current = settings.charxExport as CharxExportSettings | undefined;
    // Merge with defaults to ensure new fields have values
    return {
      ...DEFAULT_CHARX_EXPORT_SETTINGS,
      ...current,
    };
  });

  /**
   * PATCH /api/package-optimizer/settings
   * Update package export optimization settings
   */
  fastify.patch<{ Body: Partial<CharxExportSettings> }>(
    '/package-optimizer/settings',
    async (request) => {
      const body = optimizerSettingsSchema.parse(request.body);
      const settings = await getSettings();
      const current: CharxExportSettings = {
        ...DEFAULT_CHARX_EXPORT_SETTINGS,
        ...(settings.charxExport as CharxExportSettings),
      };

      const updated: CharxExportSettings = {
        convertToWebp: body.convertToWebp ?? current.convertToWebp,
        webpQuality: body.webpQuality ?? current.webpQuality,
        maxMegapixels: body.maxMegapixels ?? current.maxMegapixels,
        stripMetadata: body.stripMetadata ?? current.stripMetadata,
        convertMp4ToWebm: body.convertMp4ToWebm ?? current.convertMp4ToWebm,
        webmQuality: body.webmQuality ?? current.webmQuality,
        includedAssetTypes: body.includedAssetTypes ?? current.includedAssetTypes,
      };

      settings.charxExport = updated;
      await saveSettings(settings);

      return updated;
    }
  );

  // Legacy endpoint alias for backwards compatibility
  fastify.get('/charx-optimizer/settings', async () => {
    const settings = await getSettings();
    const current = settings.charxExport as CharxExportSettings | undefined;
    return {
      ...DEFAULT_CHARX_EXPORT_SETTINGS,
      ...current,
    };
  });

  fastify.patch<{ Body: Partial<CharxExportSettings> }>(
    '/charx-optimizer/settings',
    async (request) => {
      const body = optimizerSettingsSchema.parse(request.body);
      const settings = await getSettings();
      const current: CharxExportSettings = {
        ...DEFAULT_CHARX_EXPORT_SETTINGS,
        ...(settings.charxExport as CharxExportSettings),
      };

      const updated: CharxExportSettings = {
        convertToWebp: body.convertToWebp ?? current.convertToWebp,
        webpQuality: body.webpQuality ?? current.webpQuality,
        maxMegapixels: body.maxMegapixels ?? current.maxMegapixels,
        stripMetadata: body.stripMetadata ?? current.stripMetadata,
        convertMp4ToWebm: body.convertMp4ToWebm ?? current.convertMp4ToWebm,
        webmQuality: body.webmQuality ?? current.webmQuality,
        includedAssetTypes: body.includedAssetTypes ?? current.includedAssetTypes,
      };

      settings.charxExport = updated;
      await saveSettings(settings);

      return updated;
    }
  );
}
