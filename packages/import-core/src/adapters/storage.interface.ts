/**
 * Storage Adapter Interface
 *
 * Abstraction layer for persisting cards and assets to different storage backends.
 * Implementations:
 * - ServerStorageAdapter: SQLite + filesystem (server/full mode)
 * - ClientStorageAdapter: IndexedDB + data URLs (client/lite/static mode)
 */

import type { AssetData, AssetLink, CardData } from '../types/index.js';

/**
 * Storage adapter interface
 *
 * Separates business logic from storage implementation.
 * All methods are async to support both sync (SQLite) and async (IndexedDB) backends.
 */
export interface StorageAdapter {
  // ============================================================================
  // CARD OPERATIONS
  // ============================================================================

  /**
   * Create a new card
   * @param data Card data and metadata
   * @returns Promise with created card ID
   */
  createCard(data: CardData): Promise<{ cardId: string }>;

  /**
   * Update an existing card
   * @param cardId Card ID to update
   * @param data Partial card data to update
   */
  updateCard(cardId: string, data: Partial<CardData>): Promise<void>;

  /**
   * Set the card's main image/thumbnail
   * @param cardId Card ID
   * @param imageData Image buffer or data URL
   */
  setCardImage(cardId: string, imageData: Buffer | Uint8Array | string): Promise<void>;

  // ============================================================================
  // ASSET OPERATIONS
  // ============================================================================

  /**
   * Create a new asset
   * @param assetData Asset binary data and metadata
   * @returns Promise with created asset ID and URL for accessing the asset
   */
  createAsset(assetData: AssetData): Promise<{ assetId: string; url: string }>;

  /**
   * Link an asset to a card
   * @param cardId Card ID
   * @param assetId Asset ID
   * @param link Asset metadata (type, tags, order, etc.)
   */
  linkAssetToCard(cardId: string, assetId: string, link: AssetLink): Promise<void>;

  // ============================================================================
  // COLLECTION OPERATIONS
  // ============================================================================

  /**
   * Link a card to a collection (set packageId on child card)
   * @param childCardId Member card ID
   * @param collectionCardId Collection card ID
   */
  linkCardToCollection(childCardId: string, collectionCardId: string): Promise<void>;
}
