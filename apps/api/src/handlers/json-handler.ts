/**
 * JSON Format Handler
 *
 * Handles import/export of character cards as raw JSON files.
 */

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
import { detectSpec } from '@character-foundry/schemas';
import { validateV2, validateV3 } from '../utils/validation.js';
import {
  isVoxtaCard,
  convertCardMacros,
  voxtaToStandard,
} from '../utils/file-handlers.js';
import { restoreOriginalUrls } from '../routes/image-archival.js';
import { normalizeCardData } from './utils/normalization.js';

export class JSONHandler extends BaseFormatHandler {
  readonly id = 'json' as const;
  readonly name = 'JSON Character Card';
  readonly extensions = ['.json', '.JSON'];
  readonly mimeTypes = ['application/json', 'text/json'];

  detect(
    buffer: Buffer,
    filename?: string,
    mimetype?: string
  ): FormatDetectionResult {
    // Check extension first
    if (this.hasMatchingExtension(filename)) {
      return {
        format: 'json',
        confidence: 'high',
      };
    }

    // Check MIME type
    if (this.hasMatchingMimeType(mimetype)) {
      return {
        format: 'json',
        confidence: 'high',
      };
    }

    // Try to parse as JSON
    try {
      const text = buffer.toString('utf-8').trim();
      // Quick check for JSON structure
      if (text.startsWith('{') || text.startsWith('[')) {
        JSON.parse(text);
        return {
          format: 'json',
          confidence: 'medium',
        };
      }
    } catch {
      // Not valid JSON
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

    // Parse JSON
    let cardData: unknown;
    try {
      cardData = JSON.parse(buffer.toString('utf-8'));
    } catch (err) {
      // Try greedy JSON search for embedded JSON
      const text = buffer.toString('utf-8');
      let found = false;

      const patterns = [
        /"spec"\s*:\s*"chara_card_v3"/,
        /"spec"\s*:\s*"chara_card_v2"/,
        /"name"\s*:/,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match.index !== undefined) {
          const lastBrace = text.lastIndexOf('{', match.index);
          if (lastBrace !== -1) {
            try {
              const substring = text.substring(lastBrace);
              const lastCloseBrace = substring.lastIndexOf('}');
              if (lastCloseBrace !== -1) {
                const jsonCandidate = substring.substring(0, lastCloseBrace + 1);
                cardData = JSON.parse(jsonCandidate);
                found = true;
                logger.info(
                  { filename, matchIndex: lastBrace },
                  'Recovered card data using greedy JSON search'
                );
                break;
              }
            } catch {
              // Continue searching
            }
          }
        }
      }

      if (!found) {
        logger.error({ error: err, filename }, 'Failed to parse JSON');
        return this.importFailure(
          `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          warnings
        );
      }
    }

    // Detect spec
    const spec = detectSpec(cardData);
    if (!spec) {
      const obj = cardData as Record<string, unknown>;
      logger.error(
        {
          filename,
          keys: Object.keys(obj).slice(0, 10),
          hasSpec: 'spec' in obj,
          specValue: obj.spec,
        },
        'Failed to detect spec for JSON card'
      );
      return this.importFailure(
        'Invalid card format: unable to detect v2 or v3 spec. The JSON structure does not match expected character card formats.',
        warnings
      );
    }

    logger.info({ spec, filename }, 'Successfully parsed JSON card');

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
    return {
      success: true,
      cardIds: [], // Filled by route after card creation
      assetsImported: 0,
      warnings,
      // Attach parsed data for route to use
      ...({
        _parsedData: cardData,
        _spec: spec,
      } as unknown as Record<string, unknown>),
    };
  }

  async export(
    context: ExportContext,
    _options: ExportOptions
  ): Promise<ExportResult> {
    const { cardId, cardData, cardMeta, assets, logger } = context;
    const warnings: string[] = [];

    try {
      logger.info(
        {
          cardId,
          spec: cardMeta.spec,
          hasSpec: 'spec' in (cardData as unknown as Record<string, unknown>),
          hasSpecVersion:
            'spec_version' in (cardData as unknown as Record<string, unknown>),
          dataKeys: Object.keys(cardData as unknown as Record<string, unknown>),
          isVoxta: isVoxtaCard(cardData),
        },
        'Exporting card as JSON'
      );

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
          'Restored original URLs for JSON export'
        );
      }

      // Create JSON buffer with pretty printing
      const jsonString = JSON.stringify(exportData, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');

      return this.exportSuccess(
        buffer,
        'application/json; charset=utf-8',
        `${cardMeta.name}.json`,
        { warnings }
      );
    } catch (err) {
      logger.error({ error: err, cardId }, 'Failed to create JSON export');
      return this.exportFailure(
        `Failed to create JSON export: ${err instanceof Error ? err.message : String(err)}`,
        warnings
      );
    }
  }
}

// Export singleton instance
export const jsonHandler = new JSONHandler();
