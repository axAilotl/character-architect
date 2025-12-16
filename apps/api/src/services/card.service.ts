/**
 * Card Service
 *
 * Business logic layer for card operations. Separates business rules
 * (validation, normalization, name extraction) from HTTP handling.
 */

import { CardRepository, CardAssetRepository } from '../db/repository.js';
import type { Card, CardVersion, CardAssetWithDetails } from '../types/index.js';
import type { CCv2Data, CCv3Data } from '@character-foundry/character-foundry/schemas';
import { validateV2, validateV3 } from '../utils/validation.js';
import { normalizeLorebookEntries } from '../handlers/index.js';
import type { CardMeta } from '../types/index.js';

/**
 * Result of card validation
 */
export interface CardValidationResult {
  valid: boolean;
  errors?: unknown[];
}

/**
 * Input for creating a card
 */
export interface CreateCardInput {
  data: unknown;
  meta?: unknown;
}

/**
 * Input for updating a card
 */
export interface UpdateCardInput {
  data?: unknown;
  meta?: unknown;
}

export class CardService {
  constructor(
    private cardRepo: CardRepository,
    private cardAssetRepo: CardAssetRepository
  ) {}

  /**
   * List cards with optional search and pagination
   */
  list(query?: string, page?: number, limit?: number): { items: Card[]; total: number } {
    return this.cardRepo.list(query, page ?? 1, limit ?? 50);
  }

  /**
   * Get a single card by ID
   */
  get(id: string): Card | null {
    return this.cardRepo.get(id);
  }

  /**
   * Detect spec from meta object
   */
  private detectSpec(meta: unknown): string {
    if (meta && typeof meta === 'object' && 'spec' in meta) {
      return (meta as { spec: string }).spec;
    }
    return 'v2';
  }

  /**
   * Extract name from card data (handles both wrapped and unwrapped formats)
   */
  private extractName(data: unknown): string {
    if (data && typeof data === 'object') {
      if ('name' in data && typeof data.name === 'string') {
        return data.name;
      } else if ('data' in data && typeof data.data === 'object' && data.data && 'name' in data.data) {
        return (data.data as { name: string }).name;
      }
    }
    return 'Untitled';
  }

  /**
   * Sanitize meta by removing auto-generated fields
   */
  private sanitizeMeta(meta: unknown): Record<string, unknown> {
    if (!meta || typeof meta !== 'object') {
      return {};
    }
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...safeMeta } = meta as Record<string, unknown>;
    return safeMeta;
  }

  /**
   * Validate card data based on spec
   */
  validateCard(data: unknown, spec: string): CardValidationResult {
    // Skip validation for collection and lorebook cards (they use v3 structure internally)
    if (spec === 'collection' || spec === 'lorebook') {
      return { valid: true };
    }
    const validation = spec === 'v3' ? validateV3(data) : validateV2(data);
    return {
      valid: validation.valid,
      errors: validation.errors,
    };
  }

  /**
   * Create a new card
   * Handles validation, name extraction, and meta sanitization
   */
  create(input: CreateCardInput): { card: Card } | { error: string; errors?: unknown[] } {
    const spec = this.detectSpec(input.meta);

    // Skip validation for collection and lorebook cards
    if (spec !== 'collection' && spec !== 'lorebook') {
      const validation = this.validateCard(input.data, spec);
      if (!validation.valid) {
        return { error: 'Validation failed', errors: validation.errors };
      }
    }

    const name = this.extractName(input.data);
    const safeMeta = this.sanitizeMeta(input.meta);

    const card = this.cardRepo.create({
      data: input.data as (CCv2Data | CCv3Data),
      meta: {
        name,
        spec: spec as 'v2' | 'v3',
        tags: [],
        ...safeMeta,
      },
    });

    return { card };
  }

  /**
   * Normalize lorebook entries in card data
   * Handles both wrapped ({spec, data}) and unwrapped formats
   */
  private normalizeData(data: unknown): void {
    const dataObj = data as Record<string, unknown>;
    if ('data' in dataObj && typeof dataObj.data === 'object' && dataObj.data) {
      normalizeLorebookEntries(dataObj.data as Record<string, unknown>);
    } else {
      normalizeLorebookEntries(dataObj);
    }
  }

  /**
   * Update an existing card
   * Handles validation, normalization, and name sync
   */
  update(id: string, input: UpdateCardInput): { card: Card } | { error: string; errors?: unknown[] } | null {
    const existing = this.cardRepo.get(id);
    if (!existing) {
      return null;
    }

    // Validate if data is being updated
    if (input.data) {
      const spec = existing.meta.spec;

      // Skip validation for collection and lorebook cards
      if (spec !== 'collection' && spec !== 'lorebook') {
        // Normalize lorebook entries before validation
        this.normalizeData(input.data);

        const validation = this.validateCard(input.data, spec);
        if (!validation.valid) {
          return { error: 'Validation failed', errors: validation.errors };
        }
      }
    }

    // Build update object
    const updateData: { data?: CCv2Data | CCv3Data; meta?: Partial<CardMeta> } = {};

    // Start with any meta updates from the request
    if (input.meta && typeof input.meta === 'object') {
      updateData.meta = input.meta as Partial<CardMeta>;
    }

    if (input.data) {
      updateData.data = input.data as (CCv2Data | CCv3Data);

      // Extract name from data and sync to meta.name
      const name = this.extractName(input.data);
      if (name !== 'Untitled') {
        updateData.meta = { ...(updateData.meta || {}), name };
      }
    }

    const card = this.cardRepo.update(id, updateData);
    if (!card) {
      return null;
    }

    return { card };
  }

  /**
   * Delete a card
   */
  delete(id: string): boolean {
    return this.cardRepo.delete(id);
  }

  // ============================================================================
  // VERSION METHODS
  // ============================================================================

  /**
   * List all versions for a card
   */
  listVersions(id: string): CardVersion[] {
    return this.cardRepo.listVersions(id);
  }

  /**
   * Create a version snapshot
   */
  createVersion(id: string, message?: string): CardVersion | null {
    return this.cardRepo.createVersion(id, message);
  }

  /**
   * Restore a card from a version
   */
  restoreVersion(id: string, versionId: string): Card | null {
    return this.cardRepo.restoreVersion(id, versionId);
  }

  /**
   * Delete a version
   */
  deleteVersion(id: string, versionId: string): boolean {
    return this.cardRepo.deleteVersion(id, versionId);
  }

  // ============================================================================
  // ASSET METHODS
  // ============================================================================

  /**
   * Get all assets for a card
   * Returns null if card doesn't exist
   */
  getAssets(id: string): CardAssetWithDetails[] | null {
    const card = this.cardRepo.get(id);
    if (!card) {
      return null;
    }
    return this.cardAssetRepo.listByCardWithDetails(id);
  }

  /**
   * Set an asset as main for its type
   * Returns null if card doesn't exist, false if asset doesn't exist
   */
  setMainAsset(id: string, assetId: string): boolean | null {
    const card = this.cardRepo.get(id);
    if (!card) {
      return null;
    }
    return this.cardAssetRepo.setMain(id, assetId);
  }

  /**
   * Delete a card asset
   * Returns null if card doesn't exist, false if asset doesn't exist
   */
  deleteAsset(id: string, assetId: string): boolean | null {
    const card = this.cardRepo.get(id);
    if (!card) {
      return null;
    }
    return this.cardAssetRepo.delete(assetId);
  }
}
