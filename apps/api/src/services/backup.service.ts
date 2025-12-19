/**
 * Backup/Restore Service
 *
 * Handles creating and restoring full database backups as ZIP files.
 * Includes all cards, versions, assets, and presets.
 *
 * Supports both API backups and client-side (lite/static) backups.
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { promises as fs } from 'fs';
import { basename, dirname } from 'path';
import { generateId } from '@card-architect/import-core';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { PresetRepository } from '../db/preset-repository.js';
import { getSchemaVersion } from '../db/migrations.js';
import { safeJoin } from '../utils/path-security.js';
import type Database from 'better-sqlite3';
import type { Card, CardVersion, Asset, CardAsset, UserPreset } from '../types/index.js';

export interface BackupManifest {
  version: '1.0';
  createdAt: string;
  sourceMode: 'full' | 'light' | 'static';
  appVersion: string;
  schemaVersion?: number;
  counts: {
    cards: number;
    versions: number;
    assets: number;
    presets?: number;
    images?: number;
  };
  localStorageKeys?: string[];
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

// Client-side asset format (from IndexedDB ASSETS_STORE)
interface ClientAsset {
  id: string;
  cardId: string;
  name: string;
  type: 'icon' | 'background' | 'emotion' | 'sound' | 'workflow' | 'lorebook' | 'custom' | 'package-original';
  ext: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  data: string; // base64 data URL
  isMain: boolean;
  tags: string[];
  actorIndex?: number;
  createdAt: string;
  updatedAt: string;
}

// Client-side image format (from IndexedDB IMAGES_STORE)
interface ClientImage {
  cardId: string;
  type: 'thumbnail' | 'icon' | 'background' | 'asset';
  data: string; // base64 or data URL
}

// Client-side version format (from IndexedDB VERSIONS_STORE)
interface ClientVersion {
  id: string;
  cardId: string;
  versionNumber: number;
  message?: string;
  data: Card['data'];
  createdAt: string;
}

export class BackupService {
  private db: Database.Database;
  private cardRepo: CardRepository;
  private assetRepo: AssetRepository;
  private cardAssetRepo: CardAssetRepository;
  private presetRepo: PresetRepository;
  private storagePath: string;

  constructor(
    db: Database.Database,
    storagePath: string
  ) {
    this.db = db;
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

    // Build ZIP structure
    const zipContents: Record<string, Uint8Array> = {
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
    let imagesCount = 0;
    for (const card of cards) {
      const originalImage = this.cardRepo.getOriginalImage(card.meta.id);
      if (originalImage) {
        zipContents[`images/cards/${card.meta.id}.png`] = new Uint8Array(originalImage);
        imagesCount++;
      }
    }

    // Add physical asset files
    for (const asset of assets) {
      try {
        const fullPath = this.resolveStorageFilePath(asset.url);
        if (!fullPath) {
          console.warn(`[backup] Skipping asset with unsafe or non-storage URL: ${asset.url}`);
          continue;
        }

        const fileBuffer = await fs.readFile(fullPath);
        zipContents[`assets/${asset.id}`] = new Uint8Array(fileBuffer);
      } catch (err) {
        // Asset file not found - skip it but log a warning
        console.warn(`[backup] Asset file not found: ${asset.filename}, skipping`);
      }
    }

    // Create manifest (last so counts reflect actual contents)
    const manifest: BackupManifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      sourceMode: 'full',
      appVersion: process.env.npm_package_version || '1.0.0',
      schemaVersion: getSchemaVersion(this.db),
      counts: {
        cards: cards.length,
        versions: allVersions.length,
        assets: assets.length,
        presets: presets.length,
        images: imagesCount,
      },
    };

    zipContents['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

    // Create ZIP
    const zipBuffer = zipSync(zipContents, { level: 6 });
    return Buffer.from(zipBuffer);
  }

  /**
   * Detect if this is a client-side backup (lite/static mode)
   */
  private isClientBackup(unzipped: Record<string, Uint8Array>): boolean {
    // Client backups have images.json (with base64 data) but no card_assets.json
    return !!unzipped['images.json'] && !unzipped['card_assets.json'];
  }

  private stripQueryAndHash(input: string): string {
    return input.split('#')[0].split('?')[0];
  }

  private getStoragePathSegments(url: string): string[] | null {
    if (!url || typeof url !== 'string') return null;

    // We only support restoring local files into the /storage static directory.
    // Remote URLs and data URLs are not filesystem-backed.
    if (/^https?:\/\//i.test(url) || /^data:/i.test(url)) {
      return null;
    }

    let normalized = this.stripQueryAndHash(url).replace(/\\/g, '/');

    if (normalized.startsWith('/storage/')) {
      normalized = normalized.slice('/storage/'.length);
    } else if (normalized.startsWith('storage/')) {
      normalized = normalized.slice('storage/'.length);
    } else if (normalized.startsWith('/')) {
      normalized = normalized.slice(1);
    }

    const segments = normalized.split('/').filter(Boolean);
    return segments.length > 0 ? segments : null;
  }

  private resolveStorageFilePath(url: string): string | null {
    const segments = this.getStoragePathSegments(url);
    if (!segments) return null;
    return safeJoin(this.storagePath, ...segments);
  }

  private getAssetBytesFromZip(unzipped: Record<string, Uint8Array>, asset: Asset): Uint8Array | undefined {
    const urlBasename = basename(this.stripQueryAndHash(asset.url).replace(/\\/g, '/'));

    const candidates = [
      // New format (unique)
      `assets/${asset.id}`,
      // Optional nested format (if adopted later)
      `assets/${asset.id}/${urlBasename}`,
      // Legacy formats
      `assets/${asset.filename}`,
      `assets/${urlBasename}`,
    ];

    for (const key of candidates) {
      const bytes = unzipped[key];
      if (bytes) return bytes;
    }

    return undefined;
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

      // Detect backup type
      const isClient = this.isClientBackup(unzipped);
      console.log(`[backup] Restoring ${isClient ? 'client-side' : 'API'} backup, mode: ${options.mode}`);

      if (isClient) {
        return this.restoreClientBackup(unzipped, manifest, options, result);
      } else {
        return this.restoreApiBackup(unzipped, manifest, options, result);
      }
    } catch (err) {
      result.errors.push(`Backup restore failed: ${err instanceof Error ? err.message : String(err)}`);
      return result;
    }
  }

  /**
   * Restore from a client-side (lite/static) backup
   */
  private async restoreClientBackup(
    unzipped: Record<string, Uint8Array>,
    _manifest: BackupManifest,
    options: RestoreOptions,
    result: RestoreResult
  ): Promise<RestoreResult> {
    // Parse client backup data
    const cards: Card[] = unzipped['cards.json']
      ? JSON.parse(strFromU8(unzipped['cards.json']))
      : [];

    const clientImages: ClientImage[] = unzipped['images.json']
      ? JSON.parse(strFromU8(unzipped['images.json']))
      : [];

    const clientAssets: ClientAsset[] = unzipped['assets.json']
      ? JSON.parse(strFromU8(unzipped['assets.json']))
      : [];

    const versions: ClientVersion[] = unzipped['versions.json']
      ? JSON.parse(strFromU8(unzipped['versions.json']))
      : [];

    console.log(`[backup] Client backup contents: ${cards.length} cards, ${clientImages.length} images, ${clientAssets.length} assets, ${versions.length} versions`);

    // Handle replace mode - delete all existing data
    if (options.mode === 'replace') {
      this.db.transaction(() => {
        this.db.exec('DELETE FROM card_assets');
        this.db.exec('DELETE FROM versions');
        this.db.exec('DELETE FROM assets');
        this.db.exec('DELETE FROM cards');
      })();
    }

    // Build a map of card images by cardId
    const imagesByCard = new Map<string, Map<string, string>>();
    for (const img of clientImages) {
      if (!imagesByCard.has(img.cardId)) {
        imagesByCard.set(img.cardId, new Map());
      }
      imagesByCard.get(img.cardId)!.set(img.type, img.data);
    }

    // Build a map of assets by cardId
    const assetsByCard = new Map<string, ClientAsset[]>();
    for (const asset of clientAssets) {
      if (!assetsByCard.has(asset.cardId)) {
        assetsByCard.set(asset.cardId, []);
      }
      assetsByCard.get(asset.cardId)!.push(asset);
    }

    const cardExistsStmt = this.db.prepare('SELECT 1 FROM cards WHERE id = ?');
    const insertCardStmt = this.db.prepare(`
      INSERT INTO cards (id, name, spec, data, tags, creator, character_version, rating, original_image, created_at, updated_at, package_id, member_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVersionStmt = this.db.prepare(`
      INSERT INTO versions (id, card_id, version, data, message, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAssetStmt = this.db.prepare(`
      INSERT INTO assets (id, filename, mimetype, size, width, height, path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCardAssetStmt = this.db.prepare(`
      INSERT INTO card_assets (id, card_id, asset_id, type, name, ext, order_index, is_main, tags, original_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const importedCardIds = new Set<string>();

    // Restore cards (preserving IDs so client backups import correctly)
    for (const card of cards) {
      try {
        const exists = !!cardExistsStmt.get(card.meta.id);
        if (exists && options.mode === 'merge') {
          result.skipped++;
          continue;
        }

        // Get original image (the 'icon' type is the full-size image)
        const cardImages = imagesByCard.get(card.meta.id);
        const iconData = cardImages?.get('icon');
        const originalImage = iconData ? this.dataUrlToBuffer(iconData) : null;

        const spec = card.meta.spec === 'chara_card_v2'
          ? 'v2'
          : card.meta.spec === 'chara_card_v3'
            ? 'v3'
            : card.meta.spec;

        const now = new Date().toISOString();
        const createdAt = card.meta.createdAt || now;
        const updatedAt = card.meta.updatedAt || createdAt;

        insertCardStmt.run(
          card.meta.id,
          card.meta.name,
          spec,
          JSON.stringify(card.data),
          JSON.stringify(card.meta.tags || []),
          card.meta.creator || null,
          card.meta.characterVersion || null,
          card.meta.rating || null,
          originalImage,
          createdAt,
          updatedAt,
          card.meta.packageId || null,
          card.meta.memberCount || null
        );

        importedCardIds.add(card.meta.id);
        result.imported.cards++;
      } catch (err) {
        result.errors.push(`Failed to restore card ${card.meta.name}: ${err}`);
      }
    }

    // Restore versions (only for imported cards)
    for (const version of versions) {
      if (!importedCardIds.has(version.cardId)) continue;
      try {
        insertVersionStmt.run(
          version.id,
          version.cardId,
          version.versionNumber,
          JSON.stringify(version.data),
          version.message || null,
          version.createdAt,
          null
        );
        result.imported.versions++;
      } catch {
        result.skipped++;
      }
    }

    // Restore assets (filesystem + DB) for imported cards
    for (const cardId of importedCardIds) {
      const cardAssets = assetsByCard.get(cardId) || [];

      for (const [index, clientAsset] of cardAssets.entries()) {
        const ext = (clientAsset.ext || 'bin').replace(/^\./, '').toLowerCase() || 'bin';
        const assetId = generateId();
        const cardAssetId = generateId();

        const filenameOnDisk = `${assetId}.${ext}`;
        const assetUrl = `/storage/${cardId}/${filenameOnDisk}`;

        const targetPath = safeJoin(this.storagePath, cardId, filenameOnDisk);
        if (!targetPath) {
          result.errors.push(`Failed to restore asset ${clientAsset.name}: unsafe file path`);
          continue;
        }

        try {
          await fs.mkdir(dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, this.dataUrlToBuffer(clientAsset.data));

          insertAssetStmt.run(
            assetId,
            `${clientAsset.name}.${ext}`,
            clientAsset.mimetype,
            clientAsset.size,
            clientAsset.width ?? null,
            clientAsset.height ?? null,
            assetUrl,
            clientAsset.createdAt
          );

          insertCardAssetStmt.run(
            cardAssetId,
            cardId,
            assetId,
            clientAsset.type,
            clientAsset.name,
            ext,
            index,
            clientAsset.isMain ? 1 : 0,
            clientAsset.tags?.length ? JSON.stringify(clientAsset.tags) : null,
            null,
            clientAsset.createdAt,
            clientAsset.updatedAt
          );

          result.imported.assets++;
        } catch (err) {
          result.errors.push(`Failed to restore asset ${clientAsset.name}: ${err}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Restore from an API (full mode) backup
   */
  private async restoreApiBackup(
    unzipped: Record<string, Uint8Array>,
    _manifest: BackupManifest,
    options: RestoreOptions,
    result: RestoreResult
  ): Promise<RestoreResult> {
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

    console.log(`[backup] API backup contents: ${cards.length} cards, ${assets.length} assets, ${cardAssets.length} card-assets, ${versions.length} versions`);

    // Handle replace mode - delete all existing data
    if (options.mode === 'replace') {
      this.db.transaction(() => {
        this.db.exec('DELETE FROM card_assets');
        this.db.exec('DELETE FROM versions');
        this.db.exec('DELETE FROM assets');
        this.db.exec('DELETE FROM cards');
        // Delete user presets (but keep built-in)
        this.db.exec('DELETE FROM llm_presets WHERE is_built_in = 0');
      })();
    }

    const cardExistsStmt = this.db.prepare('SELECT 1 FROM cards WHERE id = ?');
    const assetExistsStmt = this.db.prepare('SELECT 1 FROM assets WHERE id = ?');
    const cardAssetExistsStmt = this.db.prepare('SELECT 1 FROM card_assets WHERE id = ?');
    const versionExistsStmt = this.db.prepare('SELECT 1 FROM versions WHERE id = ?');
    const presetExistsStmt = this.db.prepare('SELECT 1 FROM llm_presets WHERE id = ?');

    const insertCardStmt = this.db.prepare(`
      INSERT INTO cards (id, name, spec, data, tags, creator, character_version, rating, original_image, created_at, updated_at, package_id, member_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAssetStmt = this.db.prepare(`
      INSERT INTO assets (id, filename, mimetype, size, width, height, path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCardAssetStmt = this.db.prepare(`
      INSERT INTO card_assets (id, card_id, asset_id, type, name, ext, order_index, is_main, tags, original_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVersionStmt = this.db.prepare(`
      INSERT INTO versions (id, card_id, version, data, message, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPresetStmt = this.db.prepare(`
      INSERT INTO llm_presets (id, name, description, instruction, category, is_built_in, is_hidden, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const importedCardIds = new Set<string>();

    // Restore cards (preserve IDs so relationships remain valid)
    for (const card of cards) {
      try {
        const exists = !!cardExistsStmt.get(card.meta.id);
        if (exists && options.mode === 'merge') {
          result.skipped++;
          continue;
        }

        const imageFileName = `images/cards/${card.meta.id}.png`;
        const originalImage = unzipped[imageFileName] ? Buffer.from(unzipped[imageFileName]) : null;

        const spec = card.meta.spec === 'chara_card_v2'
          ? 'v2'
          : card.meta.spec === 'chara_card_v3'
            ? 'v3'
            : card.meta.spec;

        const now = new Date().toISOString();
        const createdAt = card.meta.createdAt || now;
        const updatedAt = card.meta.updatedAt || createdAt;

        insertCardStmt.run(
          card.meta.id,
          card.meta.name,
          spec,
          JSON.stringify(card.data),
          JSON.stringify(card.meta.tags || []),
          card.meta.creator || null,
          card.meta.characterVersion || null,
          card.meta.rating || null,
          originalImage,
          createdAt,
          updatedAt,
          card.meta.packageId || null,
          card.meta.memberCount || null
        );

        importedCardIds.add(card.meta.id);
        result.imported.cards++;
      } catch (err) {
        result.errors.push(`Failed to restore card ${card.meta.name}: ${err}`);
      }
    }

    const cardAssetsToImport = cardAssets.filter((ca) => importedCardIds.has(ca.cardId));
    const versionsToImport = versions.filter((v) => importedCardIds.has(v.cardId));

    const assetIdsToImport = new Set(cardAssetsToImport.map((ca) => ca.assetId));
    const assetsToImport = assets.filter((a) => assetIdsToImport.has(a.id));

    const importedAssetIds = new Set<string>();

    // Restore asset records (preserve IDs)
    for (const asset of assetsToImport) {
      try {
        const exists = !!assetExistsStmt.get(asset.id);
        if (exists && options.mode === 'merge') {
          result.skipped++;
          continue;
        }

        insertAssetStmt.run(
          asset.id,
          asset.filename,
          asset.mimetype,
          asset.size,
          asset.width ?? null,
          asset.height ?? null,
          asset.url,
          asset.createdAt
        );

        importedAssetIds.add(asset.id);
        result.imported.assets++;
      } catch (err) {
        result.errors.push(`Failed to restore asset ${asset.filename}: ${err}`);
      }
    }

    // Restore physical asset files (only for newly imported assets to avoid overwrites in merge mode)
    for (const asset of assetsToImport) {
      if (!importedAssetIds.has(asset.id)) continue;

      const bytes = this.getAssetBytesFromZip(unzipped, asset);
      if (!bytes) {
        console.warn(`[backup] Missing asset file bytes for ${asset.filename} (${asset.id}), skipping file restore`);
        continue;
      }

      const targetPath = this.resolveStorageFilePath(asset.url);
      if (!targetPath) {
        console.warn(`[backup] Unsafe asset path for ${asset.filename}: ${asset.url}, skipping file restore`);
        continue;
      }

      try {
        await fs.mkdir(dirname(targetPath), { recursive: true });
        if (options.mode === 'merge') {
          const exists = await fs.stat(targetPath).then(() => true).catch(() => false);
          if (exists) {
            console.warn(`[backup] Asset file already exists, skipping overwrite in merge mode: ${asset.url}`);
            continue;
          }
        }
        await fs.writeFile(targetPath, bytes);
      } catch (err) {
        result.errors.push(`Failed to write asset file ${asset.filename}: ${err}`);
      }
    }

    // Restore card-asset associations (preserve IDs)
    for (const cardAsset of cardAssetsToImport) {
      try {
        const exists = !!cardAssetExistsStmt.get(cardAsset.id);
        if (exists && options.mode === 'merge') {
          result.skipped++;
          continue;
        }

        const assetExists = !!assetExistsStmt.get(cardAsset.assetId);
        if (!assetExists) {
          result.skipped++;
          continue;
        }

        insertCardAssetStmt.run(
          cardAsset.id,
          cardAsset.cardId,
          cardAsset.assetId,
          cardAsset.type,
          cardAsset.name,
          cardAsset.ext,
          cardAsset.order,
          cardAsset.isMain ? 1 : 0,
          cardAsset.tags?.length ? JSON.stringify(cardAsset.tags) : null,
          cardAsset.originalUrl || null,
          cardAsset.createdAt,
          cardAsset.updatedAt
        );
      } catch (err) {
        result.skipped++;
      }
    }

    // Restore versions (preserve IDs)
    for (const version of versionsToImport) {
      try {
        const exists = !!versionExistsStmt.get(version.id);
        if (exists && options.mode === 'merge') {
          result.skipped++;
          continue;
        }

        insertVersionStmt.run(
          version.id,
          version.cardId,
          version.version,
          JSON.stringify(version.data),
          version.message || null,
          version.createdAt,
          version.createdBy || null
        );
        result.imported.versions++;
      } catch {
        result.skipped++;
      }
    }

    // Restore presets (skip built-in; preserve IDs for user presets)
    for (const preset of presets) {
      try {
        if (preset.isBuiltIn) {
          result.skipped++;
          continue;
        }

        const exists = !!presetExistsStmt.get(preset.id);
        if (exists && options.mode === 'merge') {
          result.skipped++;
          continue;
        }

        insertPresetStmt.run(
          preset.id,
          preset.name,
          preset.description || null,
          preset.instruction,
          preset.category || null,
          0,
          preset.isHidden ? 1 : 0,
          preset.createdAt,
          preset.updatedAt
        );
        result.imported.presets++;
      } catch (err) {
        result.errors.push(`Failed to restore preset ${preset.name}: ${err}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Convert a data URL to Buffer
   */
  private dataUrlToBuffer(dataUrl: string): Buffer {
    // Handle both "data:image/png;base64,xxx" and just "xxx" (raw base64)
    const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    const base64Data = base64Match ? base64Match[1] : dataUrl;
    return Buffer.from(base64Data, 'base64');
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

      // Check required files - allow either API or client format
      if (!unzipped['cards.json']) {
        errors.push('Missing cards.json');
      }

      // Client backups have images.json, API backups have card_assets.json
      const isClientBackup = !!unzipped['images.json'];
      const isApiBackup = !!unzipped['card_assets.json'];

      if (!isClientBackup && !isApiBackup) {
        errors.push('Missing images.json (client backup) or card_assets.json (API backup)');
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
