/**
 * Voxta Format Handler
 *
 * Handles import/export of character cards in Voxta package format (.voxpkg).
 * Voxta packages are ZIP archives with a specific structure.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
  buildVoxtaPackage,
  isZipBuffer,
  findZipStart,
  convertCardMacros,
  standardToVoxta,
} from '../utils/file-handlers.js';
import type { CCv3Data } from '@character-foundry/character-foundry/schemas';
import { convertToEmbeddedUrls } from '../routes/image-archival.js';
import { VoxtaImportService } from '../services/voxta-import.service.js';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import type Database from 'better-sqlite3';

export class VoxtaHandler extends BaseFormatHandler {
  readonly id = 'voxta' as const;
  readonly name = 'Voxta Package';
  readonly extensions = ['.voxpkg', '.VOXPKG'];
  readonly mimeTypes = ['application/zip', 'application/x-zip-compressed'];

  private voxtaImportService?: VoxtaImportService;
  private cardRepo?: CardRepository;

  /**
   * Initialize the handler with database connection
   */
  init(db: Database.Database): void {
    this.cardRepo = new CardRepository(db);
    const assetRepo = new AssetRepository(db);
    const cardAssetRepo = new CardAssetRepository(db);
    this.voxtaImportService = new VoxtaImportService(
      this.cardRepo,
      assetRepo,
      cardAssetRepo
    );
  }

  detect(
    buffer: Buffer,
    filename?: string,
    _mimetype?: string
  ): FormatDetectionResult {
    // Check extension first (most reliable for Voxta)
    if (this.hasMatchingExtension(filename)) {
      return {
        format: 'voxta',
        confidence: 'high',
      };
    }

    // Check for ZIP magic bytes - could be Voxta or CHARX
    if (isZipBuffer(buffer)) {
      // Without .voxpkg extension, we can't distinguish from CHARX
      return {
        format: 'unknown',
        confidence: 'low',
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

    if (!this.voxtaImportService || !this.cardRepo) {
      return this.importFailure('Voxta handler not initialized - call init() first');
    }

    // Write buffer to temp file
    // Use findZipStart to handle SFX (self-extracting) archives
    const tempPath = join(tmpdir(), `voxta-${Date.now()}-${filename || 'upload.voxpkg'}`);

    try {
      await fs.writeFile(tempPath, findZipStart(buffer));

      const cardIds = await this.voxtaImportService.importPackage(tempPath);

      if (cardIds.length === 0) {
        throw new Error('No cards found in Voxta package');
      }

      logger.info(
        {
          filename,
          importedCount: cardIds.length,
          cardIds,
        },
        'Successfully imported Voxta package'
      );

      return this.importSuccess(cardIds, 0, warnings);
    } catch (err) {
      logger.error({ error: err, filename }, 'Failed to import Voxta package');
      return this.importFailure(
        `Failed to import Voxta package: ${err instanceof Error ? err.message : String(err)}`,
        warnings
      );
    } finally {
      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {});
    }
  }

  async export(
    context: ExportContext,
    options: ExportOptions
  ): Promise<ExportResult> {
    const { cardId, cardData, cardMeta, originalImage, logger } = context;
    let { assets } = context;
    const warnings: string[] = [];

    try {
      // If no main icon asset exists, use the card's uploaded PNG as the icon
      const hasMainIcon = assets.some((a) => a.type === 'icon' && a.isMain);
      if (!hasMainIcon && originalImage) {
        const iconFilename = `${cardId}-icon.png`;
        const iconPath = join(options.storagePath, cardId, iconFilename);

        // Ensure directory exists
        await fs.mkdir(join(options.storagePath, cardId), { recursive: true });
        await fs.writeFile(iconPath, originalImage);

        const now = new Date().toISOString();

        // Add as a virtual asset for Voxta build (will become thumbnail)
        assets = [
          ...assets,
          {
            id: `temp-icon-${cardId}`,
            cardId,
            assetId: `temp-asset-${cardId}`,
            type: 'icon',
            name: 'main',
            ext: 'png',
            order: 0,
            isMain: true,
            createdAt: now,
            updatedAt: now,
            asset: {
              id: `temp-asset-${cardId}`,
              filename: iconFilename,
              mimetype: 'image/png',
              size: originalImage.length,
              url: `/storage/${cardId}/${iconFilename}`,
              createdAt: now,
            },
          },
        ];

        logger.info({ cardId }, 'Using card original image as main icon for Voxta export');
      }

      // Convert standard macros to Voxta format (add spaces)
      let voxtaData = convertCardMacros(
        cardData as unknown as Record<string, unknown>,
        standardToVoxta
      ) as unknown as CCv3Data;

      logger.info({ cardId }, 'Converted standard macros to Voxta format');

      // Convert local URLs to embedded format for archived images
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
        const voxtaObj = voxtaData as unknown as Record<string, unknown>;
        const characterName = voxtaObj.data
          ? ((voxtaObj.data as Record<string, unknown>).name as string)
          : (voxtaObj.name as string) || cardMeta.name || 'character';

        const { cardData: convertedData } = convertToEmbeddedUrls(
          voxtaData as unknown as Record<string, unknown>,
          archivedAssets,
          characterName
        );
        voxtaData = convertedData as unknown as CCv3Data;

        logger.info(
          { cardId, count: archivedAssets.length },
          'Converted archived image URLs to embedded format'
        );
      }

      // Build Voxta package
      const result = await buildVoxtaPackage(voxtaData, assets, {
        storagePath: options.storagePath,
        optimization: options.optimization,
      });

      logger.info(
        {
          cardId,
          assetCount: result.assetCount,
          totalSize: result.totalSize,
        },
        'Voxta export successful'
      );

      return this.exportSuccess(
        result.buffer,
        'application/zip',
        `${cardMeta.name}.voxpkg`,
        {
          assetCount: result.assetCount,
          totalSize: result.totalSize,
          warnings,
        }
      );
    } catch (err) {
      logger.error({ error: err, cardId }, 'Failed to create Voxta export');
      return this.exportFailure(
        `Failed to create Voxta export: ${err instanceof Error ? err.message : String(err)}`,
        warnings
      );
    }
  }

}

// Export singleton instance
export const voxtaHandler = new VoxtaHandler();
