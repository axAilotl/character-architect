/**
 * Unified Import Service
 *
 * Central orchestrator for card imports across all formats.
 * Separates parsing, processing, and storage.
 */

import type { StorageAdapter } from '../adapters/storage.interface.js';
import type { FileFormat, ProcessedImport } from '../types/index.js';
import { parsePNG } from '../parsers/png.parser.js';
import { parseCHARX } from '../parsers/charx.parser.js';
import { parseVoxta } from '../parsers/voxta.parser.js';
import { parseJSON } from '../parsers/json.parser.js';
import { processCard } from '../processors/card.processor.js';
import { processAsset } from '../processors/asset.processor.js';
import { processCollection } from '../processors/collection.processor.js';

export class UnifiedImportService {
  constructor(private storage: StorageAdapter) {}

  /**
   * Import a file
   * @param file File buffer
   * @param filename Original filename (for format detection)
   * @returns Array of created card IDs
   */
  async importFile(file: Buffer | Uint8Array, filename: string): Promise<string[]> {
    // 1. Detect format and parse
    const format = detectFormat(file, filename);
    console.log(`[Unified Import] Detected format: ${format}`);

    const parsed = this.parseByFormat(format, file);

    // 2. Process (shared business logic)
    const processed = await this.processImport(parsed);

    // 3. Store via adapter
    const cardIds = await this.storeCards(processed);

    return cardIds;
  }

  /**
   * Parse file by detected format
   */
  private parseByFormat(format: FileFormat, file: Buffer | Uint8Array) {
    switch (format) {
      case 'png':
        return parsePNG(file);
      case 'charx':
        return parseCHARX(file);
      case 'voxta':
        return parseVoxta(file);
      case 'json':
        return parseJSON(file);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Process parsed data (validation, normalization, asset processing)
   */
  private async processImport(parsed: any): Promise<ProcessedImport> {
    // Process each character
    const characters = await Promise.all(
      parsed.characters.map(async (char: any) => {
        const processedCard = processCard(char);

        // Process each asset
        const processedAssets = await Promise.all(
          processedCard.assets.map(asset => processAsset(asset))
        );

        return {
          ...processedCard,
          assets: processedAssets
        };
      })
    );

    // Process collection if present
    let collection;
    if (parsed.collection) {
      collection = processCollection(parsed.collection);
    }

    return {
      characters,
      collection,
      isCollection: parsed.isCollection
    };
  }

  /**
   * Store processed data via storage adapter
   */
  private async storeCards(processed: ProcessedImport): Promise<string[]> {
    const cardIds: string[] = [];

    // Store each character
    for (const char of processed.characters) {
      const { cardId } = await this.storage.createCard(char.card);

      // Store thumbnail
      if (char.thumbnail) {
        await this.storage.setCardImage(cardId, char.thumbnail);
      }

      // Store assets
      for (const asset of char.assets) {
        const { assetId } = await this.storage.createAsset({
          buffer: asset.buffer,
          filename: asset.filename,
          mimetype: asset.mimetype,
          size: asset.size,
          width: asset.width,
          height: asset.height
        });

        await this.storage.linkAssetToCard(cardId, assetId, asset.link);
      }

      cardIds.push(cardId);
    }

    // Store collection if multi-character
    if (processed.isCollection && processed.collection) {
      const { cardId: collectionId } = await this.storage.createCard(processed.collection.card);

      // Store collection thumbnail
      if (processed.collection.thumbnail) {
        await this.storage.setCardImage(collectionId, processed.collection.thumbnail);
      }

      // Store original package if present (for delta export)
      if (processed.collection.originalPackage) {
        const { assetId } = await this.storage.createAsset({
          buffer: processed.collection.originalPackage,
          filename: 'original-package.voxpkg',
          mimetype: 'application/octet-stream',
          size: processed.collection.originalPackage.length
        });

        await this.storage.linkAssetToCard(collectionId, assetId, {
          type: 'package-original',
          name: 'original-package',
          ext: 'voxpkg',
          order: 0,
          isMain: false,
          tags: []
        });
      }

      // Link member cards to collection
      for (let i = 0; i < cardIds.length; i++) {
        await this.storage.linkCardToCollection(cardIds[i], collectionId);
      }

      // Return collection first, then members
      return [collectionId, ...cardIds];
    }

    return cardIds;
  }
}

/**
 * Detect file format from magic bytes and filename
 */
function detectFormat(file: Buffer | Uint8Array, filename: string): FileFormat {
  // Browser-safe: check for Uint8Array (Buffer extends Uint8Array in Node)
  const bytes = file instanceof Uint8Array ? file : new Uint8Array(file as ArrayBuffer);

  // Check magic bytes
  if (bytes.length >= 4) {
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'png';
    }

    // ZIP (CHARX, Voxta): 50 4B 03 04 or 50 4B 05 06
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      // Differentiate CHARX vs Voxta by filename
      if (filename.toLowerCase().endsWith('.voxpkg')) {
        return 'voxta';
      }
      if (filename.toLowerCase().endsWith('.charx')) {
        return 'charx';
      }
      // Default to CHARX for unknown ZIP files
      return 'charx';
    }
  }

  // Check filename extension
  if (filename.toLowerCase().endsWith('.json')) {
    return 'json';
  }

  if (filename.toLowerCase().endsWith('.voxpkg')) {
    return 'voxta';
  }

  if (filename.toLowerCase().endsWith('.charx')) {
    return 'charx';
  }

  if (filename.toLowerCase().endsWith('.png')) {
    return 'png';
  }

  throw new Error(`Unable to detect format for file: ${filename}`);
}
