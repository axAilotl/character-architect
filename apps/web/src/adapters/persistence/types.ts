/**
 * Persistence Adapter Types
 *
 * Defines the interface for abstracting Web/Lite mode storage differences.
 * ServerAdapter uses API calls, LocalAdapter uses IndexedDB/localStorage.
 */

import type { Card, Template, Snippet, CardAssetWithDetails } from '../../lib/types';
import type { StoredAsset } from '../../lib/db';

/**
 * Card metadata for list operations (lighter than full Card)
 */
export interface CardListItem {
  id: string;
  name: string;
  spec: string;
  tags: string[];
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Options for creating/saving assets
 */
export interface AssetSaveOptions {
  cardId: string;
  name: string;
  type: StoredAsset['type'];
  ext: string;
  mimetype: string;
  data: string | Uint8Array | File;
  size?: number;
  width?: number;
  height?: number;
  isMain?: boolean;
  tags?: string[];
  actorIndex?: number;
}

/**
 * Options for updating assets
 */
export interface AssetUpdateOptions {
  name?: string;
  type?: StoredAsset['type'];
  isMain?: boolean;
  tags?: string[];
  actorIndex?: number;
}

/**
 * Version/snapshot data
 */
export interface Version {
  id: string;
  cardId: string;
  versionNumber: number;
  message?: string;
  data: Card['data'];
  createdAt: string;
}

/**
 * Image storage types
 */
export type ImageType = 'thumbnail' | 'icon' | 'background' | 'asset';

/**
 * Core persistence adapter interface
 *
 * Abstracts storage operations between server API and local IndexedDB/localStorage.
 * All methods return Promises for consistent async handling.
 */
export interface PersistenceAdapter {
  /** Adapter mode identifier */
  readonly mode: 'server' | 'local';

  // ============================================
  // Cards
  // ============================================

  /**
   * List all cards, optionally filtered by query
   */
  listCards(query?: string): Promise<CardListItem[]>;

  /**
   * Get a single card by ID
   */
  getCard(id: string): Promise<Card | null>;

  /**
   * Save (create or update) a card
   * Returns the saved card with any server-generated fields
   */
  saveCard(card: Card): Promise<Card>;

  /**
   * Delete a card and all associated data
   */
  deleteCard(id: string): Promise<void>;

  // ============================================
  // Assets
  // ============================================

  /**
   * List assets for a card
   */
  listAssets(cardId: string): Promise<CardAssetWithDetails[] | StoredAsset[]>;

  /**
   * Save a new asset
   */
  saveAsset(options: AssetSaveOptions): Promise<CardAssetWithDetails | StoredAsset>;

  /**
   * Update an existing asset
   */
  updateAsset(cardId: string, assetId: string, updates: AssetUpdateOptions): Promise<void>;

  /**
   * Delete an asset
   */
  deleteAsset(cardId: string, assetId: string): Promise<void>;

  /**
   * Set an asset as the main asset for its type
   */
  setAssetAsMain(cardId: string, assetId: string): Promise<void>;

  // ============================================
  // Templates
  // ============================================

  /**
   * List all templates
   */
  listTemplates(): Promise<Template[]>;

  /**
   * Create a new template
   */
  createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template>;

  /**
   * Update an existing template
   */
  updateTemplate(id: string, updates: Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Template>;

  /**
   * Delete a template
   */
  deleteTemplate(id: string): Promise<void>;

  /**
   * Reset templates to defaults
   */
  resetTemplates(): Promise<Template[]>;

  // ============================================
  // Snippets
  // ============================================

  /**
   * List all snippets
   */
  listSnippets(): Promise<Snippet[]>;

  /**
   * Create a new snippet
   */
  createSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet>;

  /**
   * Update an existing snippet
   */
  updateSnippet(id: string, updates: Partial<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Snippet>;

  /**
   * Delete a snippet
   */
  deleteSnippet(id: string): Promise<void>;

  /**
   * Reset snippets to defaults
   */
  resetSnippets(): Promise<Snippet[]>;

  // ============================================
  // Versions (Snapshots)
  // ============================================

  /**
   * List versions for a card
   */
  listVersions(cardId: string): Promise<Version[]>;

  /**
   * Create a new version/snapshot
   */
  createVersion(cardId: string, data: Card['data'], message?: string): Promise<Version>;

  /**
   * Delete a version
   */
  deleteVersion(cardId: string, versionId: string): Promise<void>;

  // ============================================
  // Images
  // ============================================

  /**
   * Save an image (thumbnail, icon, etc.)
   */
  saveImage(cardId: string, type: ImageType, data: string): Promise<void>;

  /**
   * Get an image
   * Returns data URL or server URL depending on adapter
   */
  getImage(cardId: string, type: ImageType): Promise<string | null>;

  /**
   * Get the URL for a card's main image
   * For server: returns API URL
   * For local: returns data URL or blob URL
   */
  getCardImageUrl(cardId: string): string;

  // ============================================
  // Settings (generic key-value)
  // ============================================

  /**
   * Get a setting value
   */
  getSetting<T>(key: string): Promise<T | null>;

  /**
   * Save a setting value
   */
  saveSetting<T>(key: string, value: T): Promise<void>;
}

/**
 * Result type for operations that may fail
 */
export interface PersistenceResult<T> {
  data?: T;
  error?: string;
}
