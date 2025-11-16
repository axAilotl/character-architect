/**
 * CHARX Import Service
 * Handles importing CHARX files into the database
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import type { CharxData, Card, CardMeta } from '@card-architect/schemas';
import { AssetRepository, CardAssetRepository, CardRepository } from '../db/repository.js';
import { getMimeTypeFromExt } from '../utils/uri-utils.js';

export interface CharxImportOptions {
  storagePath: string; // Base path for asset storage
  preserveTimestamps?: boolean; // Whether to preserve creation/modification timestamps
  setAsOriginalImage?: boolean; // Set main icon as original_image
}

export interface CharxImportResult {
  card: Card;
  assetsImported: number;
  warnings: string[];
}

export class CharxImportService {
  constructor(
    private cardRepo: CardRepository,
    private assetRepo: AssetRepository,
    private cardAssetRepo: CardAssetRepository
  ) {}

  /**
   * Import a CHARX file into the database
   */
  async import(data: CharxData, options: CharxImportOptions): Promise<CharxImportResult> {
    const warnings: string[] = [];
    let assetsImported = 0;

    // Ensure storage directory exists
    await fs.mkdir(options.storagePath, { recursive: true });

    // Extract card data
    const cardData = data.card.data;

    // Set timestamps if preserving
    const now = Math.floor(Date.now() / 1000);
    if (options.preserveTimestamps) {
      if (!cardData.creation_date) {
        cardData.creation_date = now;
      }
      if (!cardData.modification_date) {
        cardData.modification_date = now;
      }
    } else {
      cardData.creation_date = now;
      cardData.modification_date = now;
    }

    // Create card metadata
    const cardMeta: Omit<CardMeta, 'id' | 'createdAt' | 'updatedAt'> = {
      name: cardData.name,
      spec: 'v3',
      tags: cardData.tags || [],
      creator: cardData.creator,
      characterVersion: cardData.character_version,
    };

    // Find main icon for original_image
    let originalImageBuffer: Buffer | undefined;
    if (options.setAsOriginalImage) {
      const mainIconAsset = data.assets.find(
        (a) => a.descriptor.type === 'icon' && a.descriptor.name === 'main' && a.buffer
      );

      if (mainIconAsset?.buffer) {
        originalImageBuffer = mainIconAsset.buffer;
      } else {
        // Fallback to first icon
        const firstIcon = data.assets.find(
          (a) => a.descriptor.type === 'icon' && a.buffer
        );
        if (firstIcon?.buffer) {
          originalImageBuffer = firstIcon.buffer;
          warnings.push('Main icon not found, using first available icon');
        } else {
          warnings.push('No icon assets found for original_image');
        }
      }
    }

    // Create the card
    const card = this.cardRepo.create(
      {
        meta: cardMeta,
        data: data.card,
      },
      originalImageBuffer
    );

    // Import assets
    let order = 0;
    for (const assetInfo of data.assets) {
      try {
        // Skip assets without buffers (remote URLs, ccdefault, etc.)
        if (!assetInfo.buffer) {
          // Store the descriptor but don't create physical asset
          // We'll handle remote/default assets differently
          continue;
        }

        // Generate asset ID
        const assetId = nanoid();
        const ext = assetInfo.descriptor.ext;
        const filename = `${assetId}.${ext}`;
        const assetPath = join(options.storagePath, filename);

        // Determine MIME type
        const mimetype = getMimeTypeFromExt(ext);

        // Get image dimensions if it's an image
        let width: number | undefined;
        let height: number | undefined;

        if (mimetype.startsWith('image/')) {
          try {
            const metadata = await sharp(assetInfo.buffer).metadata();
            width = metadata.width;
            height = metadata.height;
          } catch (err) {
            warnings.push(`Failed to read image metadata for ${assetInfo.descriptor.name}: ${err}`);
          }
        }

        // Write file to storage
        await fs.writeFile(assetPath, assetInfo.buffer);

        // Create asset record
        const asset = this.assetRepo.create({
          filename,
          mimetype,
          size: assetInfo.buffer.length,
          width,
          height,
          url: `/assets/${assetId}`,
        });

        // Create card_asset association
        const isMain = assetInfo.descriptor.name === 'main';
        this.cardAssetRepo.create({
          cardId: card.meta.id,
          assetId: asset.id,
          type: assetInfo.descriptor.type,
          name: assetInfo.descriptor.name,
          ext: assetInfo.descriptor.ext,
          order,
          isMain,
        });

        assetsImported++;
        order++;
      } catch (err) {
        warnings.push(`Failed to import asset ${assetInfo.descriptor.name}: ${err}`);
      }
    }

    // Update card data to use internal asset references
    // This converts embeded:// URIs to our internal /assets/:id format
    if (cardData.assets) {
      const cardAssets = this.cardAssetRepo.listByCardWithDetails(card.meta.id);

      cardData.assets = cardData.assets.map((descriptor) => {
        const cardAsset = cardAssets.find(
          (ca) => ca.type === descriptor.type && ca.name === descriptor.name
        );

        if (cardAsset) {
          // Replace with internal URL
          return {
            ...descriptor,
            uri: cardAsset.asset.url,
          };
        }

        // Keep original URI for remote/default assets
        return descriptor;
      });

      // Update the card with new URIs
      this.cardRepo.update(card.meta.id, {
        data: data.card,
      });
    }

    return {
      card,
      assetsImported,
      warnings,
    };
  }

  /**
   * Import CHARX from file path
   */
  async importFromFile(filePath: string, options: CharxImportOptions): Promise<CharxImportResult> {
    const { extractCharx } = await import('../utils/charx-handler.js');
    const data = await extractCharx(filePath);
    return this.import(data, options);
  }
}
