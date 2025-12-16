/**
 * Client Storage Adapter
 *
 * Implements StorageAdapter interface using client-side storage:
 * - IndexedDB via LocalDB
 * - Data URLs for asset storage (no filesystem)
 */

import type { StorageAdapter, AssetData, AssetLink, CardData } from '@card-architect/import-core';
import type { LocalDB } from '../lib/db.js';
import { nanoid } from 'nanoid';

/**
 * Convert Buffer or Uint8Array to base64 data URL
 */
function bufferToDataURL(buffer: Buffer | Uint8Array, mimetype: string): string {
  // Convert to base64
  let base64: string;

  if (typeof Buffer !== 'undefined' && buffer instanceof Buffer) {
    base64 = buffer.toString('base64');
  } else {
    // Uint8Array - convert to binary string then base64
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }

  return `data:${mimetype};base64,${base64}`;
}

export class ClientStorageAdapter implements StorageAdapter {
  constructor(private db: LocalDB) {}

  // ============================================================================
  // CARD OPERATIONS
  // ============================================================================

  async createCard(data: CardData): Promise<{ cardId: string }> {
    const cardId = nanoid();
    const now = new Date().toISOString();

    // Format as Card for IndexedDB (includes meta.id and timestamps)
    const card = {
      meta: {
        id: cardId,
        ...data.meta,
        createdAt: now,
        updatedAt: now
      },
      data: data.data
    };

    await this.db.saveCard(card);
    return { cardId };
  }

  async updateCard(cardId: string, data: Partial<CardData>): Promise<void> {
    // Get existing card
    const existing = await this.db.getCard(cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    // Merge updates
    const updated = {
      meta: {
        ...existing.meta,
        ...data.meta,
        id: cardId, // Preserve ID
        updatedAt: new Date().toISOString()
      },
      data: data.data || existing.data
    };

    await this.db.saveCard(updated);
  }

  async setCardImage(cardId: string, imageData: Buffer | Uint8Array | string): Promise<void> {
    // Ensure data is a data URL
    let dataUrl: string;

    if (typeof imageData === 'string') {
      // Already a data URL or base64
      dataUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
    } else {
      // Convert Buffer/Uint8Array to data URL (assume PNG for thumbnails)
      dataUrl = bufferToDataURL(imageData, 'image/png');
    }

    await this.db.saveImage(cardId, 'thumbnail', dataUrl);
  }

  // ============================================================================
  // ASSET OPERATIONS
  // ============================================================================

  async createAsset(assetData: AssetData): Promise<{ assetId: string; url: string }> {
    const assetId = nanoid();
    const now = new Date().toISOString();

    // Convert buffer to data URL
    const dataUrl = bufferToDataURL(assetData.buffer, assetData.mimetype);

    // For client storage, we don't create a separate asset record yet
    // Assets are stored inline with their card via saveAsset
    // Just return the ID and data URL

    return { assetId, url: dataUrl };
  }

  async linkAssetToCard(cardId: string, assetId: string, link: AssetLink): Promise<void> {
    // For client-side storage, we need to store the asset with the link metadata
    // The assetId was generated in createAsset, but the actual data URL was returned
    // We need to retrieve the data URL and create the StoredAsset record

    // NOTE: This is a limitation of the current adapter pattern - we lose the data URL
    // between createAsset and linkAssetToCard. For now, we'll need to refactor this
    // or store a temporary mapping. Let's store a mapping for now.

    // For the initial implementation, we'll skip this and handle it in the processor
    // The processor should call a combined method or we need to rethink the interface
    console.warn('linkAssetToCard not fully implemented for client adapter - use combined save method');
  }

  // ============================================================================
  // COLLECTION OPERATIONS
  // ============================================================================

  async linkCardToCollection(childCardId: string, collectionCardId: string): Promise<void> {
    // Update the child card's meta.packageId
    const card = await this.db.getCard(childCardId);
    if (!card) {
      throw new Error(`Card ${childCardId} not found`);
    }

    card.meta.packageId = collectionCardId;
    card.meta.updatedAt = new Date().toISOString();

    await this.db.saveCard(card);
  }

  // ============================================================================
  // HELPER METHODS (Client-specific)
  // ============================================================================

  /**
   * Save asset with data URL directly (client-specific method)
   * This bypasses the createAsset/linkAssetToCard split
   */
  async saveAssetWithData(
    cardId: string,
    assetData: AssetData,
    link: AssetLink
  ): Promise<string> {
    const assetId = nanoid();
    const now = new Date().toISOString();
    const dataUrl = bufferToDataURL(assetData.buffer, assetData.mimetype);

    await this.db.saveAsset({
      id: assetId,
      cardId,
      name: link.name,
      type: link.type as any, // Type narrowing issue with AssetType
      ext: link.ext,
      mimetype: assetData.mimetype,
      size: assetData.size,
      width: assetData.width,
      height: assetData.height,
      data: dataUrl,
      isMain: link.isMain,
      tags: link.tags,
      createdAt: now,
      updatedAt: now
    });

    return assetId;
  }
}
