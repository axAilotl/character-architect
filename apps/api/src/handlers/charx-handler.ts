/**
 * CHARX Format Handler
 *
 * Handles import/export of character cards in CHARX format (ZIP archive).
 * CHARX is always V3 format and can include assets.
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
  buildCharx,
  validateCharxBuild,
  isZipBuffer,
  findZipStart,
  isVoxtaCard,
  convertCardMacros,
  voxtaToStandard,
} from '../utils/file-handlers.js';
import { detectSpec, type CCv2Data, type CCv3Data } from '@character-foundry/schemas';
import { validateCharxExport, applyExportFixes } from '../utils/charx-validator.js';
import { convertToEmbeddedUrls } from '../routes/image-archival.js';
import { CardImportService } from '../services/card-import.service.js';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import type Database from 'better-sqlite3';

export class CHARXHandler extends BaseFormatHandler {
  readonly id = 'charx' as const;
  readonly name = 'CHARX Package';
  readonly extensions = ['.charx', '.CHARX'];
  readonly mimeTypes = ['application/zip', 'application/x-zip-compressed'];

  private cardImportService?: CardImportService;

  /**
   * Initialize the handler with database connection
   */
  init(db: Database.Database): void {
    const cardRepo = new CardRepository(db);
    const assetRepo = new AssetRepository(db);
    const cardAssetRepo = new CardAssetRepository(db);
    this.cardImportService = new CardImportService(cardRepo, assetRepo, cardAssetRepo);
  }

  detect(
    buffer: Buffer,
    filename?: string,
    _mimetype?: string
  ): FormatDetectionResult {
    // Check extension first (most reliable for CHARX)
    if (this.hasMatchingExtension(filename)) {
      return {
        format: 'charx',
        confidence: 'high',
      };
    }

    // Check for ZIP magic bytes
    if (isZipBuffer(buffer)) {
      // Could be CHARX or Voxta - medium confidence without extension
      return {
        format: 'charx',
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
    options: ImportOptions
  ): Promise<ImportResult> {
    const { buffer, filename, logger } = context;
    const warnings: string[] = [];

    if (!this.cardImportService) {
      return this.importFailure('CHARX handler not initialized - call init() first');
    }

    // Write buffer to temp file (yauzl requires file path)
    // Use findZipStart to handle SFX (self-extracting) archives
    const tempPath = join(tmpdir(), `charx-${Date.now()}-${filename || 'upload.charx'}`);

    try {
      await fs.writeFile(tempPath, findZipStart(buffer));

      const result = await this.cardImportService.importCharxFromFile(tempPath, {
        storagePath: options.storagePath,
        preserveTimestamps: options.preserveTimestamps ?? true,
        setAsOriginalImage: options.setAsOriginalImage ?? true,
      });

      warnings.push(...result.warnings);

      logger.info(
        {
          cardId: result.card.meta.id,
          assetsImported: result.assetsImported,
          warnings: result.warnings,
        },
        'Successfully imported CHARX file'
      );

      return this.importSuccess(
        [result.card.meta.id],
        result.assetsImported,
        warnings
      );
    } catch (err) {
      logger.error({ error: err, filename }, 'Failed to import CHARX');
      return this.importFailure(
        `Failed to import CHARX: ${err instanceof Error ? err.message : String(err)}`,
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
        // Save the original image to storage temporarily for CHARX build
        const iconFilename = `${cardId}-icon.png`;
        const iconPath = join(options.storagePath, cardId, iconFilename);

        // Ensure directory exists
        await fs.mkdir(join(options.storagePath, cardId), { recursive: true });
        await fs.writeFile(iconPath, originalImage);

        const now = new Date().toISOString();

        // Add as a virtual asset for CHARX build
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

        logger.info({ cardId }, 'Using card original image as main icon for CHARX export');
      }

      // CHARX is always V3 - convert if needed
      let charxData: CCv3Data;
      const currentSpec = detectSpec(cardData);

      if (currentSpec === 'v2') {
        // Convert V2 to V3 format
        const v2Data = cardData as unknown as {
          spec?: string;
          spec_version?: string;
          data?: CCv2Data;
        } & CCv2Data;
        const sourceData = v2Data.data || v2Data;

        charxData = {
          spec: 'chara_card_v3',
          spec_version: '3.0',
          data: {
            name: sourceData.name || '',
            description: sourceData.description || '',
            personality: sourceData.personality || '',
            scenario: sourceData.scenario || '',
            first_mes: sourceData.first_mes || '',
            mes_example: sourceData.mes_example || '',
            creator: sourceData.creator || '',
            character_version: sourceData.character_version || '',
            tags: sourceData.tags || [],
            creator_notes: sourceData.creator_notes || '',
            system_prompt: sourceData.system_prompt || '',
            post_history_instructions: sourceData.post_history_instructions || '',
            alternate_greetings: sourceData.alternate_greetings || [],
            group_only_greetings: [],
            character_book: sourceData.character_book as CCv3Data['data']['character_book'],
            extensions: sourceData.extensions,
          },
        } as CCv3Data;

        logger.info({ cardId }, 'Converted V2 card to V3 for CHARX export');
      } else {
        charxData = cardData as CCv3Data;
      }

      // Convert Voxta macros to standard format if this is a Voxta card
      if (isVoxtaCard(cardData)) {
        charxData = convertCardMacros(
          charxData as unknown as Record<string, unknown>,
          voxtaToStandard
        ) as unknown as CCv3Data;
        logger.info({ cardId }, 'Converted Voxta macros to standard format');
      }

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
        const characterName = charxData.data?.name || cardMeta.name || 'character';
        const { cardData: convertedData } = convertToEmbeddedUrls(
          charxData as unknown as Record<string, unknown>,
          archivedAssets,
          characterName
        );
        charxData = convertedData as unknown as CCv3Data;

        logger.info(
          { cardId, count: archivedAssets.length },
          'Converted archived image URLs to embedded format'
        );
      }

      // Pre-export validation with auto-fixes
      const exportValidation = await validateCharxExport(
        charxData,
        assets,
        options.storagePath
      );

      if (exportValidation.errors.length > 0) {
        logger.error(
          { cardId, errors: exportValidation.errors },
          'CHARX export validation failed'
        );
        return this.exportFailure('Cannot export CHARX: validation errors', [
          ...warnings,
          ...exportValidation.errors,
        ]);
      }

      warnings.push(...exportValidation.warnings);

      // Apply auto-fixes
      if (exportValidation.fixes.length > 0) {
        assets = applyExportFixes(assets);
      }

      // Legacy validation check
      const validation = validateCharxBuild(charxData, assets);
      if (!validation.valid) {
        logger.warn({ errors: validation.errors }, 'CHARX build validation warnings');
      }

      // Build CHARX ZIP with optimization
      const result = await buildCharx(charxData, assets, {
        storagePath: options.storagePath,
        optimization: options.optimization,
      });

      logger.info(
        {
          cardId,
          assetCount: result.assetCount,
          totalSize: result.totalSize,
          validationWarnings: exportValidation.warnings.length,
          appliedFixes: exportValidation.fixes.length,
        },
        'CHARX export successful'
      );

      return this.exportSuccess(
        result.buffer,
        'application/zip',
        `${cardMeta.name}.charx`,
        {
          assetCount: result.assetCount,
          totalSize: result.totalSize,
          warnings,
        }
      );
    } catch (err) {
      logger.error({ error: err, cardId }, 'Failed to create CHARX export');
      return this.exportFailure(
        `Failed to create CHARX export: ${err instanceof Error ? err.message : String(err)}`,
        warnings
      );
    }
  }

}

// Export singleton instance
export const charxHandler = new CHARXHandler();
