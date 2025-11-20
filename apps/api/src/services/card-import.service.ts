/**
 * Card Import Service
 * Handles importing Cards (CharX, JSON, PNG) and extracting assets
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import type { CharxData, Card, CardMeta, AssetTag, CCv3Data } from '@card-architect/schemas';
import { detectAnimatedAsset } from '@card-architect/schemas';
import { AssetRepository, CardAssetRepository, CardRepository } from '../db/repository.js';
import { getMimeTypeFromExt } from '../utils/uri-utils.js';

export interface ImportOptions {
  storagePath: string; // Base path for asset storage
  preserveTimestamps?: boolean; // Whether to preserve creation/modification timestamps
  setAsOriginalImage?: boolean; // Set main icon as original_image
}

export interface ImportResult {
  card: Card;
  assetsImported: number;
  warnings: string[];
}

export class CardImportService {
  constructor(
    private cardRepo: CardRepository,
    private assetRepo: AssetRepository,
    private cardAssetRepo: CardAssetRepository
  ) {}

  /**
   * Extract tags from asset descriptor and buffer
   */
  private extractTags(descriptor: any, buffer: Buffer | undefined, mimetype: string): AssetTag[] {
    const tags: AssetTag[] = [];

    // Extract tags from descriptor if present (CharX extended format)
    if (descriptor.tags && Array.isArray(descriptor.tags)) {
      descriptor.tags.forEach((tag: string) => {
        // Actor tags
        if (tag.startsWith('actor-')) {
          tags.push(tag as AssetTag);
        }
        // Other special tags
        if (['portrait-override', 'expression', 'main-background', 'animated'].includes(tag)) {
          tags.push(tag as AssetTag);
        }
      });
    }

    // Auto-detect portrait override for main icons
    if (descriptor.name === 'main' && descriptor.type === 'icon') {
      if (!tags.includes('portrait-override')) {
        tags.push('portrait-override');
      }
    }

    // Auto-detect main background
    if (descriptor.name === 'main' && descriptor.type === 'background') {
      if (!tags.includes('main-background')) {
        tags.push('main-background');
      }
    }

    // Detect animated assets from buffer
    if (buffer && !tags.includes('animated')) {
      const isAnimated = detectAnimatedAsset(buffer, mimetype);
      if (isAnimated) {
        tags.push('animated');
      }
    }

    return tags;
  }

  /**
   * Import a CHARX file into the database
   */
  async importCharx(data: CharxData, options: ImportOptions): Promise<ImportResult> {
    const warnings: string[] = [];
    let assetsImported = 0;

    console.log('[Card Import] Starting CHARX import...');
    console.log(`[Card Import] Card spec: ${data.card.spec}`);
    console.log(`[Card Import] Card name: ${data.card.data.name || 'Untitled'}`);
    console.log(`[Card Import] Assets to import: ${data.assets.length}`);

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
          console.log(`[Card Import] Skipping remote/default asset: ${assetInfo.descriptor.name} (${assetInfo.descriptor.uri})`);
          // Store the descriptor but don't create physical asset
          // We'll handle remote/default assets differently
          continue;
        }

        console.log(`[Card Import] Importing asset: ${assetInfo.descriptor.type}/${assetInfo.descriptor.name} (${assetInfo.buffer.length} bytes)`);

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

        // Extract tags from descriptor and buffer
        const tags = this.extractTags(assetInfo.descriptor, assetInfo.buffer, mimetype);
        console.log(`[Card Import] Extracted tags for ${assetInfo.descriptor.name}: ${tags.join(', ')}`);

        // Write file to storage
        await fs.writeFile(assetPath, assetInfo.buffer);
        console.log(`[Card Import] Wrote asset to disk: ${assetPath}`);

        // Create asset record
        const assetUrl = `/storage/${filename}`;
        const asset = this.assetRepo.create({
          filename,
          mimetype,
          size: assetInfo.buffer.length,
          width,
          height,
          url: assetUrl,
        });
        console.log(`[Card Import] Created asset record with URL: ${assetUrl}`);

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
          tags: tags as string[],
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

    console.log(`[Card Import] Import completed successfully`);
    console.log(`[Card Import] Card ID: ${card.meta.id}`);
    console.log(`[Card Import] Assets imported: ${assetsImported}/${data.assets.length}`);
    if (warnings.length > 0) {
      console.warn(`[Card Import] Warnings (${warnings.length}):`, warnings);
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
  async importCharxFromFile(filePath: string, options: ImportOptions): Promise<ImportResult> {
    const { extractCharx } = await import('../utils/charx-handler.js');
    const data = await extractCharx(filePath);
    return this.importCharx(data, options);
  }

  /**
   * Extract assets from Data URIs or PNG chunks in card data
   */
  async extractAssetsFromDataURIs(
    data: CCv3Data,
    options: ImportOptions,
    extraChunks?: Array<{keyword: string, text: string}>
  ): Promise<{ data: CCv3Data; assetsImported: number; warnings: string[] }> {
    const warnings: string[] = [];
    let assetsImported = 0;
    const cardData = { ...data.data };

    if (!cardData.assets || !Array.isArray(cardData.assets)) {
      return { data, assetsImported, warnings };
    }

    // Ensure storage directory exists
    await fs.mkdir(options.storagePath, { recursive: true });

    console.log(`[Card Import] Processing Data URI extraction for ${cardData.assets.length} assets`);
    console.log(`[Card Import] Extra PNG chunks available: ${extraChunks?.length || 0}`);
    if (extraChunks) {
        console.log(`[Card Import] Extra chunk keys: ${extraChunks.map(c => c.keyword).join(', ')}`);
    }

    // Process assets
    cardData.assets = await Promise.all(
      cardData.assets.map(async (descriptor) => {
        if (!descriptor.uri) {
            console.log(`[Card Import] Asset ${descriptor.name} has no URI`);
            return descriptor;
        }
        
        let buffer: Buffer | undefined;
        let mimetype: string | undefined;

        // Case 1: Data URI
        if (descriptor.uri.startsWith('data:')) {
          try {
            const matches = descriptor.uri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              mimetype = matches[1];
              buffer = Buffer.from(matches[2], 'base64');
            } else {
              warnings.push(`Invalid Data URI for asset ${descriptor.name}`);
            }
          } catch (e) {
            warnings.push(`Failed to parse Data URI for ${descriptor.name}: ${e}`);
          }
        } 
        // Case 2: PNG Chunk Reference (e.g. __asset:0)
        else if (extraChunks && (descriptor.uri.startsWith('__asset:') || !descriptor.uri.includes(':') || descriptor.uri.startsWith('asset:'))) {
            let assetId = descriptor.uri;
            if (descriptor.uri.startsWith('__asset:')) assetId = descriptor.uri.split(':')[1];
            if (descriptor.uri.startsWith('asset:')) assetId = descriptor.uri.split(':')[1];
            
            // Try different key variations
            const candidates = [
                assetId,                        // "0" or "filename.png"
                descriptor.uri,                 // "__asset:0"
                `asset:${assetId}`,             // "asset:0"
                `__asset_${assetId}`,           // "__asset_0"
                `chara-ext-asset_${assetId}`,   // "chara-ext-asset_0" or "chara-ext-asset_filename.png"
                `chara-ext-asset_:${assetId}`   // "chara-ext-asset_:0" (implied by user comment about :90)
            ];

            const chunk = extraChunks.find(c => candidates.includes(c.keyword)) || 
                          extraChunks.find(c => {
                              // Fallback: Check for chara-ext-asset_ prefix matching
                              if (c.keyword.startsWith('chara-ext-asset_')) {
                                  const suffix = c.keyword.replace('chara-ext-asset_', '');
                                  return suffix === assetId || suffix === `:${assetId}` || suffix === descriptor.uri;
                              }
                              return false;
                          });
            
            if (chunk) {
                console.log(`[Card Import] Found embedded asset chunk for ${descriptor.uri} (key: ${chunk.keyword})`);
                try {
                    buffer = Buffer.from(chunk.text, 'base64');
                    // Guess mimetype from extension if available
                    if (descriptor.ext) {
                        mimetype = getMimeTypeFromExt(descriptor.ext);
                    } else {
                        mimetype = 'application/octet-stream'; // Fallback
                    }
                } catch (e) {
                    warnings.push(`Failed to decode embedded asset chunk ${chunk.keyword}: ${e}`);
                }
            } else {
                console.warn(`[Card Import] Referenced asset chunk not found: ${descriptor.uri} (checked: ${candidates.join(', ')})`);
                // Don't spam logs with all chunks if there are too many, just show first few matching pattern
                if (extraChunks) {
                    const similarChunks = extraChunks.filter(c => c.keyword.includes('asset') || c.keyword.includes(assetId));
                    if (similarChunks.length > 0) {
                        console.warn(`[Card Import] Similar chunks found: ${similarChunks.map(c => `"${c.keyword}"`).join(', ')}`);
                    }
                }
            }
        }
        else {
          console.log(`[Card Import] Asset ${descriptor.name} URI is not data or known reference: (starts with ${descriptor.uri.substring(0, 20)}...)`);
          return descriptor;
        }

        if (!buffer || !mimetype) {
            return descriptor;
        }

        try {
          // Validate extension
          const ext = descriptor.ext || mimetype.split('/')[1];
          if (!ext) {
            warnings.push(`Could not determine extension for asset ${descriptor.name}`);
            return descriptor;
          }

          console.log(`[Card Import] Extracting asset: ${descriptor.name} (${buffer.length} bytes)`);

          // Generate asset ID and save file
          const assetId = nanoid();
          const filename = `${assetId}.${ext}`;
          const assetPath = join(options.storagePath, filename);

          // Get image dimensions
          let width: number | undefined;
          let height: number | undefined;

          if (mimetype.startsWith('image/')) {
            try {
              const metadata = await sharp(buffer).metadata();
              width = metadata.width;
              height = metadata.height;
            } catch (err) {
              warnings.push(`Failed to read image metadata for ${descriptor.name}: ${err}`);
            }
          }

          // Extract tags
          const tags = this.extractTags(descriptor, buffer, mimetype);

          // Write file
          await fs.writeFile(assetPath, buffer);

          // Create asset record
          const assetUrl = `/storage/${filename}`;
          const asset = this.assetRepo.create({
            filename,
            mimetype,
            size: buffer.length,
            width,
            height,
            url: assetUrl,
          });
          
          console.log(`[Card Import] Created asset record ${asset.id} for ${descriptor.name}`);

          assetsImported++;

          // Return descriptor with updated URI and temporary fields for linking
          return {
            ...descriptor,
            uri: assetUrl,
            _assetId: asset.id, // Temporary field to help linking
            _tags: tags,
          };
        } catch (err) {
          console.error(`[Card Import] Failed to extract asset ${descriptor.name}:`, err);
          warnings.push(`Failed to extract asset ${descriptor.name}: ${err}`);
          return descriptor;
        }
      })
    );

    return {
      data: { ...data, data: cardData },
      assetsImported,
      warnings,
    };
  }

  /**
   * Link extracted assets to the created card
   */
  async linkAssetsToCard(cardId: string, cardData: CCv3Data['data']): Promise<void> {
    console.log(`[Card Import] Linking assets to card ${cardId}`);
    if (!cardData.assets) {
        console.log('[Card Import] No assets to link');
        return;
    }

    let order = 0;
    for (const asset of cardData.assets) {
      const internalAsset = asset as any;
      if (internalAsset._assetId) {
        console.log(`[Card Import] Linking asset ${internalAsset._assetId} (${asset.name}) to card`);
        const isMain = asset.name === 'main';
        
        this.cardAssetRepo.create({
          cardId,
          assetId: internalAsset._assetId,
          type: asset.type,
          name: asset.name,
          ext: asset.ext,
          order,
          isMain,
          tags: internalAsset._tags || [],
        });
        
        // Clean up temporary fields
        delete internalAsset._assetId;
        delete internalAsset._tags;
      } else {
          console.log(`[Card Import] Asset ${asset.name} has no _assetId, skipping link`);
      }
      order++;
    }
  }
}
