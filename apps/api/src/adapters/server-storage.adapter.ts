/**
 * Server Storage Adapter
 *
 * Implements StorageAdapter interface using server-side repositories:
 * - CardRepository (SQLite)
 * - AssetRepository (SQLite)
 * - CardAssetRepository (SQLite)
 * - Filesystem (for asset files)
 */

import type { StorageAdapter, AssetData, AssetLink, CardData } from '@card-architect/import-core';
import type { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { nanoid } from 'nanoid';
import { join } from 'path';
import { writeFile } from 'fs/promises';

export class ServerStorageAdapter implements StorageAdapter {
  constructor(
    private cardRepo: CardRepository,
    private assetRepo: AssetRepository,
    private cardAssetRepo: CardAssetRepository,
    private storagePath: string
  ) {}

  // ============================================================================
  // CARD OPERATIONS
  // ============================================================================

  async createCard(data: CardData): Promise<{ cardId: string }> {
    // The server repository's create() method returns the full Card with generated ID
    const card = this.cardRepo.create({
      meta: data.meta,
      data: data.data
    });

    return { cardId: card.meta.id };
  }

  async updateCard(cardId: string, data: Partial<CardData>): Promise<void> {
    // Convert CardData partial to CardUpdate format
    const updates: any = {};

    if (data.meta) {
      updates.meta = data.meta;
    }

    if (data.data) {
      updates.data = data.data;
    }

    this.cardRepo.update(cardId, updates);
  }

  async setCardImage(cardId: string, imageData: Buffer | Uint8Array | string): Promise<void> {
    // Convert Uint8Array to Buffer if needed
    let buffer: Buffer;
    if (imageData instanceof Uint8Array && !(imageData instanceof Buffer)) {
      buffer = Buffer.from(imageData);
    } else if (typeof imageData === 'string') {
      // If it's a data URL, we need to decode it
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = imageData as Buffer;
    }

    this.cardRepo.updateImage(cardId, buffer);
  }

  // ============================================================================
  // ASSET OPERATIONS
  // ============================================================================

  async createAsset(assetData: AssetData): Promise<{ assetId: string; url: string }> {
    // 1. Generate filename and save to filesystem
    const fileId = nanoid();
    const ext = assetData.filename.split('.').pop() || 'bin';
    const storageFilename = `${fileId}.${ext}`;
    const storagePath = join(this.storagePath, storageFilename);

    // Convert Uint8Array to Buffer if needed
    let buffer: Buffer;
    if (assetData.buffer instanceof Uint8Array && !(assetData.buffer instanceof Buffer)) {
      buffer = Buffer.from(assetData.buffer);
    } else {
      buffer = assetData.buffer as Buffer;
    }

    await writeFile(storagePath, buffer);

    // 2. Create asset record in database
    const assetRecord = this.assetRepo.create({
      filename: storageFilename,
      mimetype: assetData.mimetype,
      size: assetData.size,
      url: `/storage/${storageFilename}`,
      width: assetData.width,
      height: assetData.height
    });

    return { assetId: assetRecord.id, url: assetRecord.url };
  }

  async linkAssetToCard(cardId: string, assetId: string, link: AssetLink): Promise<void> {
    this.cardAssetRepo.create({
      cardId,
      assetId,
      type: link.type,
      name: link.name,
      ext: link.ext,
      order: link.order,
      isMain: link.isMain,
      tags: link.tags
    });
  }

  // ============================================================================
  // COLLECTION OPERATIONS
  // ============================================================================

  async linkCardToCollection(childCardId: string, collectionCardId: string): Promise<void> {
    // Update the child card's packageId to point to the collection
    this.cardRepo.update(childCardId, {
      meta: {
        packageId: collectionCardId
      }
    });
  }
}
