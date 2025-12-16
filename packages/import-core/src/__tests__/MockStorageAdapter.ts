/**
 * Mock Storage Adapter for Testing
 *
 * Tracks all method calls and their arguments for verification in tests.
 */

import type { StorageAdapter } from '../adapters/storage.interface.js';
import type { AssetData, AssetLink, CardData } from '../types/index.js';
import { nanoid } from 'nanoid';

export interface MockCall {
  method: string;
  args: any[];
  returnValue?: any;
}

/**
 * Mock implementation of StorageAdapter that tracks all calls
 */
export class MockStorageAdapter implements StorageAdapter {
  public calls: MockCall[] = [];
  public cards: Map<string, CardData> = new Map();
  public assets: Map<string, AssetData> = new Map();
  public cardImages: Map<string, Buffer | Uint8Array | string> = new Map();
  public assetLinks: Array<{ cardId: string; assetId: string; link: AssetLink }> = [];
  public collectionLinks: Array<{ childCardId: string; collectionCardId: string }> = [];

  /**
   * Clear all tracking data
   */
  reset(): void {
    this.calls = [];
    this.cards.clear();
    this.assets.clear();
    this.cardImages.clear();
    this.assetLinks = [];
    this.collectionLinks = [];
  }

  /**
   * Get all calls to a specific method
   */
  getCallsTo(method: string): MockCall[] {
    return this.calls.filter((c) => c.method === method);
  }

  /**
   * Get the number of times a method was called
   */
  getCallCount(method: string): number {
    return this.getCallsTo(method).length;
  }

  /**
   * Get the last call to a specific method
   */
  getLastCallTo(method: string): MockCall | undefined {
    const calls = this.getCallsTo(method);
    return calls[calls.length - 1];
  }

  // ============================================================================
  // STORAGE ADAPTER IMPLEMENTATION
  // ============================================================================

  async createCard(data: CardData): Promise<{ cardId: string }> {
    const cardId = nanoid();
    this.cards.set(cardId, data);

    const returnValue = { cardId };
    this.calls.push({
      method: 'createCard',
      args: [data],
      returnValue,
    });

    return returnValue;
  }

  async updateCard(cardId: string, data: Partial<CardData>): Promise<void> {
    const existing = this.cards.get(cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    // Merge the update
    this.cards.set(cardId, { ...existing, ...data });

    this.calls.push({
      method: 'updateCard',
      args: [cardId, data],
    });
  }

  async setCardImage(cardId: string, imageData: Buffer | Uint8Array | string): Promise<void> {
    this.cardImages.set(cardId, imageData);

    this.calls.push({
      method: 'setCardImage',
      args: [cardId, imageData],
    });
  }

  async createAsset(assetData: AssetData): Promise<{ assetId: string; url: string }> {
    const assetId = nanoid();
    this.assets.set(assetId, assetData);

    const returnValue = {
      assetId,
      url: `/assets/${assetId}/${assetData.filename}`,
    };

    this.calls.push({
      method: 'createAsset',
      args: [assetData],
      returnValue,
    });

    return returnValue;
  }

  async linkAssetToCard(cardId: string, assetId: string, link: AssetLink): Promise<void> {
    this.assetLinks.push({ cardId, assetId, link });

    this.calls.push({
      method: 'linkAssetToCard',
      args: [cardId, assetId, link],
    });
  }

  async linkCardToCollection(childCardId: string, collectionCardId: string): Promise<void> {
    this.collectionLinks.push({ childCardId, collectionCardId });

    this.calls.push({
      method: 'linkCardToCollection',
      args: [childCardId, collectionCardId],
    });
  }
}
