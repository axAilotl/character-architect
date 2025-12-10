/**
 * PNG Format Handler
 *
 * Handles import/export of character cards embedded in PNG images.
 * Card data is stored in PNG text chunks (tEXt/iTXt) with keyword 'chara'.
 */

import sharp from 'sharp';
import { BaseFormatHandler } from './format-handler.js';
import type {
  FormatDetectionResult,
  ImportContext,
  ImportResult,
  ImportOptions,
  ExportContext,
  ExportResult,
  ExportOptions,
} from './types.js';
import {
  extractFromPNG,
  validatePNGSize,
  createCardPNG,
  isVoxtaCard,
  convertCardMacros,
  voxtaToStandard,
} from '../utils/file-handlers.js';
import type { CCv2Data, CCv3Data } from '@character-foundry/schemas';
import { validateV2, validateV3 } from '../utils/validation.js';
import { restoreOriginalUrls } from '../routes/image-archival.js';
import { normalizeCardData } from './utils/normalization.js';

// PNG Magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class PNGHandler extends BaseFormatHandler {
  readonly id = 'png' as const;
  readonly name = 'PNG Character Card';
  readonly extensions = ['.png', '.PNG'];
  readonly mimeTypes = ['image/png'];

  detect(
    buffer: Buffer,
    filename?: string,
    mimetype?: string
  ): FormatDetectionResult {
    // Check magic bytes first (most reliable)
    const hasMagic = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC);

    if (hasMagic) {
      return {
        format: 'png',
        confidence: 'high',
      };
    }

    // Check extension
    if (this.hasMatchingExtension(filename)) {
      return {
        format: 'png',
        confidence: 'medium',
      };
    }

    // Check MIME type
    if (this.hasMatchingMimeType(mimetype)) {
      return {
        format: 'png',
        confidence: 'medium',
      };
    }

    return {
      format: 'unknown',
      confidence: 'low',
    };
  }

  canImport(): boolean {
    return true;
  }

  canExport(): boolean {
    return true;
  }

  async import(
    context: ImportContext,
    _options: ImportOptions
  ): Promise<ImportResult> {
    const { buffer, filename, logger } = context;
    const warnings: string[] = [];

    // Validate PNG size
    const sizeCheck = validatePNGSize(buffer, {
      max: 15, // Default max MB
      warn: 5, // Default warn MB
    });

    if (!sizeCheck.valid) {
      logger.warn({ warnings: sizeCheck.warnings }, 'PNG size validation failed');
      return this.importFailure('PNG too large', sizeCheck.warnings);
    }

    warnings.push(...sizeCheck.warnings);

    // Extract card data from PNG
    let extracted;
    try {
      extracted = await extractFromPNG(buffer);
      if (!extracted) {
        logger.error({ filename }, 'No character card data found in PNG');
        return this.importFailure(
          'No character card data found in PNG',
          warnings
        );
      }
    } catch (err) {
      logger.error({ error: err, filename }, 'Failed to extract card from PNG');
      return this.importFailure(
        `Failed to extract card from PNG: ${err instanceof Error ? err.message : String(err)}`,
        warnings
      );
    }

    const { data: cardData, spec, extraChunks } = extracted;
    logger.info({ spec, filename }, 'Successfully extracted card from PNG');

    // Normalize card data
    normalizeCardData(cardData, spec);

    // Validate card data
    const validation = spec === 'v3' ? validateV3(cardData) : validateV2(cardData);
    if (!validation.valid) {
      logger.error({ spec, errors: validation.errors }, 'Card validation failed');
      return this.importFailure('Card validation failed', [
        ...warnings,
        ...validation.errors.map((e) => e.message),
      ]);
    }

    warnings.push(
      ...validation.errors
        .filter((e) => e.severity !== 'error')
        .map((e) => e.message)
    );

    // Return the parsed data for the route to handle storage
    // Note: Actual card creation is handled by the route
    return {
      success: true,
      cardIds: [], // Filled by route after card creation
      assetsImported: 0,
      warnings,
      // Attach parsed data for route to use
      ...({
        _parsedData: cardData,
        _spec: spec,
        _originalImage: buffer,
        _extraChunks: extraChunks,
      } as unknown as Record<string, unknown>),
    };
  }

  async export(
    context: ExportContext,
    _options: ExportOptions
  ): Promise<ExportResult> {
    const { cardId, cardData, cardMeta, originalImage, assets, logger } = context;
    const warnings: string[] = [];

    try {
      // Use original image or create placeholder
      let baseImage = originalImage;

      if (!baseImage) {
        logger.info({ cardId }, 'No original image found, creating placeholder');
        baseImage = await sharp({
          create: {
            width: 400,
            height: 600,
            channels: 4,
            background: { r: 100, g: 120, b: 150, alpha: 1 },
          },
        })
          .png()
          .toBuffer();
      } else {
        logger.info(
          { cardId, imageSize: baseImage.length },
          'Using original image for export'
        );
      }

      // Prepare card data for export
      let exportData = cardData as unknown as Record<string, unknown>;

      // Convert Voxta macros to standard format
      if (isVoxtaCard(cardData)) {
        exportData = convertCardMacros(exportData, voxtaToStandard);
        logger.info({ cardId }, 'Converted Voxta macros to standard format');
      }

      // Restore original URLs for archived images
      const archivedAssets = assets
        .filter((a) => a.originalUrl)
        .map((a) => ({
          assetId: a.assetId,
          ext: a.ext,
          originalUrl: a.originalUrl!,
          filename: a.asset?.filename,
          name: a.name,
        }));

      if (archivedAssets.length > 0) {
        const characterName =
          (exportData.name as string) ||
          ((exportData.data as Record<string, unknown>)?.name as string) ||
          'character';
        exportData = restoreOriginalUrls(exportData, archivedAssets, characterName);
        logger.info(
          { cardId, count: archivedAssets.length },
          'Restored original URLs for PNG export'
        );
      }

      // Create PNG with embedded card data
      // createCardPNG expects a Card object, but only uses card.data
      const now = new Date().toISOString();
      const pngBuffer = await createCardPNG(baseImage, {
        meta: {
          ...cardMeta,
          tags: [],
          createdAt: now,
          updatedAt: now,
        },
        data: exportData as unknown as CCv2Data | CCv3Data,
      });

      return this.exportSuccess(pngBuffer, 'image/png', `${cardMeta.name}.png`, {
        warnings,
      });
    } catch (err) {
      logger.error({ error: err, cardId }, 'Failed to create PNG export');
      return this.exportFailure(
        `Failed to create PNG export: ${err instanceof Error ? err.message : String(err)}`,
        warnings
      );
    }
  }
}

// Export singleton instance
export const pngHandler = new PNGHandler();
