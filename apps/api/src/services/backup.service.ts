/**
 * Backup/Restore Service
 *
 * Handles creating and restoring full database backups as ZIP files.
 * Includes all cards, versions, assets, and presets.
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { promises as fs } from 'fs';
import { join } from 'path';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { PresetRepository } from '../db/preset-repository.js';
import type Database from 'better-sqlite3';
import type { Card, CardVersion, Asset, CardAsset, UserPreset } from '../types/index.js';

export interface BackupManifest {
  version: '1.0';
  createdAt: string;
  sourceMode: 'full' | 'lite' | 'static';
  appVersion: string;
  schemaVersion: number;
  counts: {
    cards: number;
    versions: number;
    assets: number;
    presets: number;
  };
}

export interface BackupOptions {
  includeVersions?: boolean;
  includePresets?: boolean;
}

export interface RestoreOptions {
  mode: 'replace' | 'merge';
  skipConflicts?: boolean;
}

export interface RestoreResult {
  success: boolean;
  imported: {
    cards: number;
    versions: number;
    assets: number;
    presets: number;
  };
  skipped: number;
  errors: string[];
}

export interface BackupPreview {
  manifest: BackupManifest;
  cardNames: string[];
}

export class BackupService {
  private cardRepo: CardRepository;
  private assetRepo: AssetRepository;
  private cardAssetRepo: CardAssetRepository;
  private presetRepo: PresetRepository;
  private storagePath: string;

  constructor(
    db: Database.Database,
    storagePath: string
  ) {
    this.cardRepo = new CardRepository(db);
    this.assetRepo = new AssetRepository(db);
    this.cardAssetRepo = new CardAssetRepository(db);
    this.presetRepo = new PresetRepository(db);
    this.storagePath = storagePath;
  }

  /**
   * Create a full backup as a ZIP buffer
   */
  async createBackup(options: BackupOptions = {}): Promise<Buffer> {
    const includeVersions = options.includeVersions ?? true;
    const includePresets = options.includePresets ?? true;

    // Gather all data
    const cardsResult = this.cardRepo.list('', 1, 999999);
    const cards = cardsResult.items;

    // Get all versions if requested
    const allVersions: CardVersion[] = [];
    if (includeVersions) {
      for (const card of cards) {
        const versions = this.cardRepo.listVersions(card.meta.id);
        allVersions.push(...versions);
      }
    }

    // Get all card assets
    const allCardAssets: CardAsset[] = [];
    for (const card of cards) {
      const cardAssets = this.cardAssetRepo.listByCard(card.meta.id);
      allCardAssets.push(...cardAssets);
    }

    // Get unique assets
    const assetIds = new Set(allCardAssets.map(ca => ca.assetId));
    const assets: Asset[] = [];
    for (const assetId of assetIds) {
      const asset = this.assetRepo.get(assetId);
      if (asset) {
        assets.push(asset);
      }
    }

    // Get presets if requested
    const presets = includePresets ? this.presetRepo.getAll() : [];

    // Create manifest
    const manifest: BackupManifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      sourceMode: 'full',
      appVersion: process.env.npm_package_version || '1.0.0',
      schemaVersion: 1,
      counts: {
        cards: cards.length,
        versions: allVersions.length,
        assets: assets.length,
        presets: presets.length,
      },
    };

    // Build ZIP structure
    const zipContents: Record<string, Uint8Array> = {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'cards.json': strToU8(JSON.stringify(cards, null, 2)),
      'card_assets.json': strToU8(JSON.stringify(allCardAssets, null, 2)),
      'assets.json': strToU8(JSON.stringify(assets, null, 2)),
    };

    if (includeVersions) {
      zipContents['versions.json'] = strToU8(JSON.stringify(allVersions, null, 2));
    }

    if (includePresets) {
      zipContents['presets.json'] = strToU8(JSON.stringify(presets, null, 2));
    }

    // Add original card images
    for (const card of cards) {
      const originalImage = this.cardRepo.getOriginalImage(card.meta.id);
      if (originalImage) {
        zipContents[`images/cards/${card.meta.id}.png`] = new Uint8Array(originalImage);
      }
    }

    // Add physical asset files
    for (const asset of assets) {
      try {
        // Asset URL can be either absolute path or relative path
        const assetPath = asset.url.startsWith('/')
          ? asset.url.substring(1) // Remove leading slash
          : asset.url;

        const fullPath = join(this.storagePath, assetPath);
        const fileBuffer = await fs.readFile(fullPath);
        zipContents[`assets/${asset.filename}`] = new Uint8Array(fileBuffer);
      } catch (err) {
        // Asset file not found - skip it but log a warning
        console.warn(`Asset file not found: ${asset.filename}, skipping`);
      }
    }

    // Create ZIP
    const zipBuffer = zipSync(zipContents, { level: 6 });
    return Buffer.from(zipBuffer);
  }

  /**
   * Restore from a backup ZIP buffer
   */
  async restoreBackup(zipBuffer: Buffer, options: RestoreOptions): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      imported: { cards: 0, versions: 0, assets: 0, presets: 0 },
      skipped: 0,
      errors: [],
    };

    try {
      // Unzip
      const unzipped = unzipSync(new Uint8Array(zipBuffer));

      // Validate manifest
      if (!unzipped['manifest.json']) {
        throw new Error('Invalid backup: missing manifest.json');
      }

      const manifest: BackupManifest = JSON.parse(strFromU8(unzipped['manifest.json']));

      if (manifest.version !== '1.0') {
        throw new Error(`Unsupported backup version: ${manifest.version}`);
      }

      // Parse backup data
      const cards: Card[] = unzipped['cards.json']
        ? JSON.parse(strFromU8(unzipped['cards.json']))
        : [];

      const versions: CardVersion[] = unzipped['versions.json']
        ? JSON.parse(strFromU8(unzipped['versions.json']))
        : [];

      const assets: Asset[] = unzipped['assets.json']
        ? JSON.parse(strFromU8(unzipped['assets.json']))
        : [];

      const cardAssets: CardAsset[] = unzipped['card_assets.json']
        ? JSON.parse(strFromU8(unzipped['card_assets.json']))
        : [];

      const presets: UserPreset[] = unzipped['presets.json']
        ? JSON.parse(strFromU8(unzipped['presets.json']))
        : [];

      // Handle replace mode - delete all existing data
      if (options.mode === 'replace') {
        // Get all existing cards and delete them
        const existingCards = this.cardRepo.list('', 1, 999999);
        for (const card of existingCards.items) {
          // Delete card assets first
          this.cardAssetRepo.deleteByCard(card.meta.id);
          // Delete card
          this.cardRepo.delete(card.meta.id);
        }

        // Delete user presets (but keep built-in)
        const existingPresets = this.presetRepo.getAll();
        for (const preset of existingPresets) {
          if (!preset.isBuiltIn) {
            this.presetRepo.delete(preset.id);
          }
        }
      }

      // Restore assets first
      for (const asset of assets) {
        try {
          // Check if asset already exists
          const existing = this.assetRepo.get(asset.id);

          if (existing && options.mode === 'merge' && options.skipConflicts) {
            result.skipped++;
            continue;
          }

          // Restore physical file
          const assetFileName = `assets/${asset.filename}`;
          if (unzipped[assetFileName]) {
            // Extract card ID from asset URL
            const urlParts = asset.url.split('/');
            const cardId = urlParts.length > 1 ? urlParts[0] : 'unknown';

            const assetDir = join(this.storagePath, cardId);
            await fs.mkdir(assetDir, { recursive: true });

            const targetPath = join(assetDir, asset.filename);
            await fs.writeFile(targetPath, unzipped[assetFileName]);
          }

          // Create asset record if it doesn't exist
          if (!existing) {
            this.assetRepo.create({
              filename: asset.filename,
              mimetype: asset.mimetype,
              size: asset.size,
              width: asset.width,
              height: asset.height,
              url: asset.url,
            });
            result.imported.assets++;
          }
        } catch (err) {
          result.errors.push(`Failed to restore asset ${asset.filename}: ${err}`);
        }
      }

      // Restore cards
      for (const card of cards) {
        try {
          const existing = this.cardRepo.get(card.meta.id);

          if (existing && options.mode === 'merge' && options.skipConflicts) {
            result.skipped++;
            continue;
          }

          // Get original image if present
          const imageFileName = `images/cards/${card.meta.id}.png`;
          const originalImage = unzipped[imageFileName]
            ? Buffer.from(unzipped[imageFileName])
            : undefined;

          if (!existing) {
            // Create new card
            this.cardRepo.create({
              data: card.data,
              meta: {
                name: card.meta.name,
                spec: card.meta.spec,
                tags: card.meta.tags,
                creator: card.meta.creator,
                characterVersion: card.meta.characterVersion,
                rating: card.meta.rating,
                packageId: card.meta.packageId,
                memberCount: card.meta.memberCount,
              },
            }, originalImage);
            result.imported.cards++;
          } else if (options.mode === 'replace') {
            // Update existing card
            this.cardRepo.update(card.meta.id, {
              data: card.data,
              meta: card.meta,
            });
            if (originalImage) {
              this.cardRepo.updateOriginalImage(card.meta.id, originalImage);
            }
            result.imported.cards++;
          }
        } catch (err) {
          result.errors.push(`Failed to restore card ${card.meta.name}: ${err}`);
        }
      }

      // Restore card assets
      for (const cardAsset of cardAssets) {
        try {
          // Check if card exists
          const card = this.cardRepo.get(cardAsset.cardId);
          if (!card) {
            result.skipped++;
            continue;
          }

          // Create card asset association
          this.cardAssetRepo.create({
            cardId: cardAsset.cardId,
            assetId: cardAsset.assetId,
            type: cardAsset.type,
            name: cardAsset.name,
            ext: cardAsset.ext,
            order: cardAsset.order,
            isMain: cardAsset.isMain,
            tags: cardAsset.tags,
            originalUrl: cardAsset.originalUrl,
          });
        } catch (err) {
          // Card asset might already exist - ignore
          result.skipped++;
        }
      }

      // Restore versions
      for (const version of versions) {
        try {
          // Check if card exists
          const card = this.cardRepo.get(version.cardId);
          if (!card) {
            result.skipped++;
            continue;
          }

          // Note: We can't use createVersion as it auto-increments version numbers
          // We need to manually insert to preserve version numbers
          // This is a limitation - for now, skip versions or implement raw SQL insert
          result.skipped++;
        } catch (err) {
          result.errors.push(`Failed to restore version: ${err}`);
        }
      }

      // Restore presets (skip built-in)
      for (const preset of presets) {
        try {
          if (preset.isBuiltIn) {
            result.skipped++;
            continue;
          }

          const existing = this.presetRepo.getById(preset.id);

          if (existing && options.mode === 'merge' && options.skipConflicts) {
            result.skipped++;
            continue;
          }

          if (!existing) {
            this.presetRepo.create({
              name: preset.name,
              description: preset.description,
              instruction: preset.instruction,
              category: preset.category,
            });
            result.imported.presets++;
          }
        } catch (err) {
          result.errors.push(`Failed to restore preset ${preset.name}: ${err}`);
        }
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (err) {
      result.errors.push(`Backup restore failed: ${err instanceof Error ? err.message : String(err)}`);
      return result;
    }
  }

  /**
   * Validate a backup ZIP without restoring
   */
  async validateBackup(zipBuffer: Buffer): Promise<{
    valid: boolean;
    manifest?: BackupManifest;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Unzip
      const unzipped = unzipSync(new Uint8Array(zipBuffer));

      // Check manifest
      if (!unzipped['manifest.json']) {
        errors.push('Missing manifest.json');
        return { valid: false, errors };
      }

      const manifest: BackupManifest = JSON.parse(strFromU8(unzipped['manifest.json']));

      if (manifest.version !== '1.0') {
        errors.push(`Unsupported backup version: ${manifest.version}`);
      }

      // Check required files
      if (!unzipped['cards.json']) {
        errors.push('Missing cards.json');
      }

      if (!unzipped['assets.json']) {
        errors.push('Missing assets.json');
      }

      if (!unzipped['card_assets.json']) {
        errors.push('Missing card_assets.json');
      }

      return {
        valid: errors.length === 0,
        manifest,
        errors,
      };
    } catch (err) {
      errors.push(`Failed to validate backup: ${err instanceof Error ? err.message : String(err)}`);
      return { valid: false, errors };
    }
  }

  /**
   * Preview backup contents without restoring
   */
  async previewBackup(zipBuffer: Buffer): Promise<BackupPreview> {
    const validation = await this.validateBackup(zipBuffer);

    if (!validation.valid || !validation.manifest) {
      throw new Error(`Invalid backup: ${validation.errors.join(', ')}`);
    }

    // Parse cards to get names
    const unzipped = unzipSync(new Uint8Array(zipBuffer));
    const cards: Card[] = unzipped['cards.json']
      ? JSON.parse(strFromU8(unzipped['cards.json']))
      : [];

    const cardNames = cards.map(c => c.meta.name);

    return {
      manifest: validation.manifest,
      cardNames,
    };
  }
}
