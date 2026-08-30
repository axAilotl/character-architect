/**
 * Backup/Restore Service
 *
 * Handles creating and restoring full database backups as ZIP files.
 * Includes all cards, versions, assets, and presets.
 *
 * Supports both API backups and client-side (lite/static) backups.
 */

import { Zip, ZipDeflate, zipSync, strToU8, strFromU8, type Unzipped } from 'fflate';
import { preflightZipSizes, streamingUnzipSync } from '@character-foundry/core/zip';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { once } from 'events';
import { tmpdir } from 'os';
import { basename, dirname, join, relative } from 'path';
import { generateId } from '@card-architect/import-core';
import {
  assertBackupCount,
  parseBackupManifest,
  type BackupManifest,
  type RestoreResult,
} from '@card-architect/backup-core';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { PresetRepository } from '../db/preset-repository.js';
import { getSchemaVersion } from '../db/migrations.js';
import { safeJoin } from '../utils/path-security.js';
import { config } from '../config.js';
import type Database from 'better-sqlite3';
import type { Card, CardVersion, Asset, CardAsset, UserPreset } from '../types/index.js';

export type { BackupManifest, RestoreResult } from '@card-architect/backup-core';

export interface BackupOptions {
  includeVersions?: boolean;
  includePresets?: boolean;
}

export interface RestoreOptions {
  mode: 'replace' | 'merge';
  skipConflicts?: boolean;
}

interface FileRollback {
  path: string;
  previous: Buffer | null;
}

interface InternalRestoreOptions extends RestoreOptions {
  transactionActive?: boolean;
  fileRollbacks?: FileRollback[];
}

export interface BackupPreview {
  manifest: BackupManifest;
  cardNames: string[];
}

export interface StagedBackupArchive {
  path: string;
  size: number;
  cleanup: () => Promise<void>;
}

interface BackupFileEntry {
  name: string;
  path: string;
}

interface BackupPlan {
  memoryEntries: Record<string, Uint8Array>;
  fileEntries: BackupFileEntry[];
}

interface MutableBackupPaths {
  settingsPath: string;
  presetStoragePath: string;
  themeImagesPath: string;
}

interface AppSettingBackup {
  key: string;
  value: string;
  updatedAt: string;
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
  private mutablePaths: MutableBackupPaths;
  private restoreQueue: Promise<void> = Promise.resolve();

  constructor(
    db: Database.Database,
    storagePath: string,
    mutablePaths: MutableBackupPaths = {
      settingsPath: config.settingsPath,
      presetStoragePath: config.presetStoragePath,
      themeImagesPath: config.themeImagesPath,
    },
  ) {
    this.db = db;
    this.cardRepo = new CardRepository(db);
    this.assetRepo = new AssetRepository(db);
    this.cardAssetRepo = new CardAssetRepository(db);
    this.presetRepo = new PresetRepository(db);
    this.storagePath = storagePath;
    this.mutablePaths = mutablePaths;
  }

  private async collectFiles(root: string, prefix: string): Promise<BackupFileEntry[]> {
    const entries: BackupFileEntry[] = [];
    const walk = async (directory: string): Promise<void> => {
      let children;
      try {
        children = await fs.readdir(directory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }

      for (const child of children) {
        const childPath = join(directory, child.name);
        if (child.isDirectory()) await walk(childPath);
        else if (child.isFile()) {
          const archivePath = relative(root, childPath).replace(/\\/g, '/');
          entries.push({ name: `${prefix}/${archivePath}`, path: childPath });
        }
      }
    };

    await walk(root);
    return entries;
  }

  private async buildBackupPlan(options: BackupOptions = {}): Promise<BackupPlan> {
    let appVersion = 'unknown';
    try {
      const packageJson = JSON.parse(
        await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'),
      ) as { version?: string };
      appVersion = packageJson.version || appVersion;
    } catch {
      // A missing package manifest should not prevent users from backing up data.
    }
    const includeVersions = options.includeVersions ?? true;
    const includePresets = options.includePresets ?? true;
    const cardsResult = this.cardRepo.list('', 1, 999999);
    const cards = cardsResult.items;
    const allVersions: CardVersion[] = [];
    if (includeVersions) {
      for (const card of cards) {
        allVersions.push(...this.cardRepo.listVersions(card.meta.id));
      }
    }
    const allCardAssets: CardAsset[] = [];
    for (const card of cards) {
      allCardAssets.push(...this.cardAssetRepo.listByCard(card.meta.id));
    }
    const assetIds = new Set(allCardAssets.map(ca => ca.assetId));
    const assets: Asset[] = [];
    for (const assetId of assetIds) {
      const asset = this.assetRepo.get(assetId);
      if (asset) assets.push(asset);
    }
    const presets = includePresets ? this.presetRepo.getAll() : [];
    const appSettings = this.db.prepare(
      'SELECT key, value, updated_at AS updatedAt FROM app_settings ORDER BY key'
    ).all() as Array<{ key: string; value: string; updatedAt: string }>;

    const memoryEntries: Record<string, Uint8Array> = {
      'cards.json': strToU8(JSON.stringify(cards, null, 2)),
      'card_assets.json': strToU8(JSON.stringify(allCardAssets, null, 2)),
      'assets.json': strToU8(JSON.stringify(assets, null, 2)),
      'app_settings.json': strToU8(JSON.stringify(appSettings, null, 2)),
    };
    if (includeVersions) memoryEntries['versions.json'] = strToU8(JSON.stringify(allVersions, null, 2));
    if (includePresets) memoryEntries['presets.json'] = strToU8(JSON.stringify(presets, null, 2));

    let imagesCount = 0;
    for (const card of cards) {
      const originalImage = this.cardRepo.getOriginalImage(card.meta.id);
      if (originalImage) {
        memoryEntries[`images/cards/${card.meta.id}.png`] = new Uint8Array(originalImage);
        imagesCount++;
      }
    }

    const fileEntries: BackupFileEntry[] = [];
    for (const asset of assets) {
      const fullPath = this.resolveStorageFilePath(asset.url);
      if (!fullPath) {
        throw new Error(`Cannot create a complete backup: asset ${asset.id} has an unsafe or non-storage path`);
      }
      try {
        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) throw new Error('path is not a regular file');
        fileEntries.push({ name: `assets/${asset.id}`, path: fullPath });
      } catch (error) {
        throw new Error(
          `Cannot create a complete backup: asset file is unavailable for ${asset.id} (${asset.filename})`,
          { cause: error },
        );
      }
    }

    try {
      const settingsStat = await fs.stat(this.mutablePaths.settingsPath);
      if (settingsStat.isFile()) {
        fileEntries.push({ name: 'mutable/settings.json', path: this.mutablePaths.settingsPath });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const presetFiles = await this.collectFiles(this.mutablePaths.presetStoragePath, 'mutable/presets');
    const themeFiles = await this.collectFiles(this.mutablePaths.themeImagesPath, 'mutable/theme-images');
    fileEntries.push(...presetFiles, ...themeFiles);

    const manifest: BackupManifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      sourceMode: 'full',
      appVersion,
      schemaVersion: getSchemaVersion(this.db),
      counts: {
        cards: cards.length,
        versions: allVersions.length,
        assets: assets.length,
        presets: presets.length,
        images: imagesCount,
        settings: appSettings.length,
        settingsFile: fileEntries.some((entry) => entry.name === 'mutable/settings.json') ? 1 : 0,
        presetFiles: presetFiles.length,
        themeImages: themeFiles.length,
      },
    };
    memoryEntries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
    return { memoryEntries, fileEntries };
  }

  /** Create a full backup buffer for callers that explicitly need one. */
  async createBackup(options: BackupOptions = {}): Promise<Buffer> {
    const plan = await this.buildBackupPlan(options);
    for (const entry of plan.fileEntries) {
      plan.memoryEntries[entry.name] = new Uint8Array(await fs.readFile(entry.path));
    }
    return Buffer.from(zipSync(plan.memoryEntries, { level: 6 }));
  }

  /**
   * Create a backup in a private temporary file. Disk-backed assets are fed to
   * the ZIP incrementally so a large library is never duplicated in RAM.
   */
  async createBackupArchive(options: BackupOptions = {}): Promise<StagedBackupArchive> {
    const plan = await this.buildBackupPlan(options);
    const temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'character-architect-backup-'));
    const archivePath = join(temporaryDirectory, 'backup.zip');

    try {
      await this.writeBackupArchive(archivePath, plan);
      const stat = await fs.stat(archivePath);
      return {
        path: archivePath,
        size: stat.size,
        cleanup: () => fs.rm(temporaryDirectory, { recursive: true, force: true }),
      };
    } catch (error) {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  private async writeBackupArchive(destination: string, plan: BackupPlan): Promise<void> {
    const output = createWriteStream(destination, { mode: 0o600 });
    const finished = once(output, 'finish');
    let needsDrain = false;
    let zipError: Error | null = null;
    const zip = new Zip((error, data, final) => {
      if (error) {
        zipError = error;
        output.destroy(error);
        return;
      }
      if (data.length > 0 && !output.write(data)) needsDrain = true;
      if (final) output.end();
    });

    const waitForDrain = async (): Promise<void> => {
      if (!needsDrain) return;
      await once(output, 'drain');
      needsDrain = false;
    };
    const addBytes = async (name: string, bytes: Uint8Array): Promise<void> => {
      const entry = new ZipDeflate(name, { level: 6 });
      zip.add(entry);
      entry.push(bytes, true);
      await waitForDrain();
    };

    try {
      for (const [name, bytes] of Object.entries(plan.memoryEntries)) {
        await addBytes(name, bytes);
      }
      for (const file of plan.fileEntries) {
        const entry = new ZipDeflate(file.name, { level: 6 });
        zip.add(entry);
        for await (const chunk of createReadStream(file.path)) {
          entry.push(new Uint8Array(chunk as Buffer), false);
          await waitForDrain();
        }
        entry.push(new Uint8Array(), true);
        await waitForDrain();
      }
      zip.end();
      await finished;
      if (zipError) throw zipError;
    } catch (error) {
      output.destroy(error as Error);
      await finished.catch(() => undefined);
      throw error;
    }
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

  private resolveMutableFilePath(archiveName: string): string | null {
    if (archiveName === 'mutable/settings.json') return this.mutablePaths.settingsPath;

    const roots: Array<[prefix: string, root: string]> = [
      ['mutable/presets/', this.mutablePaths.presetStoragePath],
      ['mutable/theme-images/', this.mutablePaths.themeImagesPath],
    ];
    for (const [prefix, root] of roots) {
      if (!archiveName.startsWith(prefix)) continue;
      const relativePath = archiveName.slice(prefix.length);
      if (!relativePath || relativePath.endsWith('/')) return null;
      return safeJoin(root, ...relativePath.split('/'));
    }
    return null;
  }

  private extractBackupArchive(zipBuffer: Buffer): Unzipped {
    const bytes = new Uint8Array(zipBuffer);
    const limits = {
      maxFileSize: config.security.zipSecurity.maxFileSize,
      maxTotalSize: config.security.zipSecurity.maxUncompressedSize,
      maxFiles: config.security.zipSecurity.maxFiles,
      unsafePathHandling: 'reject' as const,
    };
    preflightZipSizes(bytes, limits);
    return streamingUnzipSync(bytes, limits);
  }

  private parseArrayEntry(unzipped: Unzipped, name: string, required = false): unknown[] {
    const entry = unzipped[name];
    if (!entry) {
      if (required) throw new Error(`Invalid backup: missing ${name}`);
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(strFromU8(entry));
    } catch {
      throw new Error(`Invalid backup: ${name} is not valid JSON`);
    }
    if (!Array.isArray(parsed)) throw new Error(`Invalid backup: ${name} must contain an array`);
    return parsed;
  }

  private parseManifestEntry(unzipped: Unzipped): BackupManifest {
    const entry = unzipped['manifest.json'];
    if (!entry) throw new Error('Invalid backup: missing manifest.json');
    try {
      return parseBackupManifest(JSON.parse(strFromU8(entry)));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid backup: manifest.json is not valid JSON', { cause: error });
      }
      throw error;
    }
  }

  private validateArchiveStructure(unzipped: Unzipped, manifest: BackupManifest): void {
    const hasClientMarker = !!unzipped['images.json'];
    const hasApiMarker = !!unzipped['card_assets.json'];
    if (hasClientMarker === hasApiMarker) {
      throw new Error('Invalid backup: archive format is missing or ambiguous');
    }

    const cards = this.parseArrayEntry(unzipped, 'cards.json', true) as Card[];
    const versions = this.parseArrayEntry(unzipped, 'versions.json') as Array<CardVersion | ClientVersion>;
    const assets = this.parseArrayEntry(unzipped, 'assets.json') as Array<Asset | ClientAsset>;
    const cardIds = new Set<string>();
    const versionIds = new Set<string>();
    const assetIds = new Set<string>();

    for (const card of cards) {
      if (!card?.meta || typeof card.meta.id !== 'string' || !card.meta.id || typeof card.meta.name !== 'string' || !card.data) {
        throw new Error('Invalid backup: card is missing required fields');
      }
      if (cardIds.has(card.meta.id)) throw new Error(`Invalid backup: duplicate card id ${card.meta.id}`);
      cardIds.add(card.meta.id);
    }
    for (const version of versions) {
      if (!version || typeof version.id !== 'string' || versionIds.has(version.id) || !cardIds.has(version.cardId)) {
        throw new Error('Invalid backup: version is duplicated or references a missing card');
      }
      versionIds.add(version.id);
    }
    for (const asset of assets) {
      if (!asset || typeof asset.id !== 'string' || assetIds.has(asset.id)) {
        throw new Error('Invalid backup: asset id is missing or duplicated');
      }
      assetIds.add(asset.id);
      if (hasClientMarker) {
        const clientAsset = asset as ClientAsset;
        if (!cardIds.has(clientAsset.cardId) || typeof clientAsset.data !== 'string') {
          throw new Error('Invalid backup: client asset references a missing card or has no data');
        }
      }
    }
    assertBackupCount(manifest, 'cards', cards.length);
    assertBackupCount(manifest, 'versions', versions.length);
    assertBackupCount(manifest, 'assets', assets.length);

    if (unzipped['app_settings.json']) {
      const settings = this.parseArrayEntry(unzipped, 'app_settings.json') as Array<Record<string, unknown>>;
      const settingKeys = new Set<string>();
      for (const setting of settings) {
        if (!setting || typeof setting.key !== 'string' || !setting.key ||
            typeof setting.value !== 'string' || typeof setting.updatedAt !== 'string' ||
            settingKeys.has(setting.key)) {
          throw new Error('Invalid backup: application setting is malformed or duplicated');
        }
        settingKeys.add(setting.key);
      }
      assertBackupCount(manifest, 'settings', settings.length);
    }

    for (const archiveName of Object.keys(unzipped)) {
      if (archiveName.startsWith('mutable/') && !this.resolveMutableFilePath(archiveName)) {
        throw new Error(`Invalid backup: unsupported mutable file path ${archiveName}`);
      }
    }

    if (hasClientMarker) {
      const images = this.parseArrayEntry(unzipped, 'images.json') as ClientImage[];
      for (const image of images) {
        if (!image || !cardIds.has(image.cardId) || typeof image.type !== 'string' || typeof image.data !== 'string') {
          throw new Error('Invalid backup: image references a missing card or has invalid data');
        }
      }
      assertBackupCount(manifest, 'images', images.length);
      return;
    }

    const presets = this.parseArrayEntry(unzipped, 'presets.json');
    assertBackupCount(manifest, 'presets', presets.length);
    assertBackupCount(
      manifest,
      'images',
      Object.keys(unzipped).filter((name) => name.startsWith('images/cards/') && !name.endsWith('/')).length,
    );
    assertBackupCount(manifest, 'settingsFile', unzipped['mutable/settings.json'] ? 1 : 0);
    assertBackupCount(
      manifest,
      'presetFiles',
      Object.keys(unzipped).filter((name) => name.startsWith('mutable/presets/') && !name.endsWith('/')).length,
    );
    assertBackupCount(
      manifest,
      'themeImages',
      Object.keys(unzipped).filter((name) => name.startsWith('mutable/theme-images/') && !name.endsWith('/')).length,
    );

    const cardAssets = this.parseArrayEntry(unzipped, 'card_assets.json', true) as CardAsset[];
    const cardAssetIds = new Set<string>();
    for (const cardAsset of cardAssets) {
      if (!cardAsset || typeof cardAsset.id !== 'string' || cardAssetIds.has(cardAsset.id) ||
          !cardIds.has(cardAsset.cardId) || !assetIds.has(cardAsset.assetId)) {
        throw new Error('Invalid backup: card-asset link is duplicated or has a missing relationship');
      }
      cardAssetIds.add(cardAsset.id);
    }
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
    return this.withRestoreLock(() => this.restoreBackupUnlocked(zipBuffer, options));
  }

  private async restoreBackupUnlocked(zipBuffer: Buffer, options: RestoreOptions): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      imported: { cards: 0, versions: 0, assets: 0, images: 0, presets: 0, settings: 0, files: 0 },
      skipped: 0,
      errors: [],
    };

    try {
      // Unzip
      const unzipped = this.extractBackupArchive(zipBuffer);

      const manifest = this.parseManifestEntry(unzipped);

      this.validateArchiveStructure(unzipped, manifest);

      // Detect backup type
      const isClient = this.isClientBackup(unzipped);
      console.log(`[backup] Restoring ${isClient ? 'client-side' : 'API'} backup, mode: ${options.mode}`);

      if (options.mode === 'merge' && options.skipConflicts === false) {
        await this.assertNoStrictMergeConflicts(unzipped, isClient);
      }

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

  private async withRestoreLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.restoreQueue;
    let release!: () => void;
    this.restoreQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async assertNoStrictMergeConflicts(
    unzipped: Unzipped,
    isClient: boolean,
  ): Promise<void> {
    const cards = this.parseArrayEntry(unzipped, 'cards.json') as Card[];
    const versions = this.parseArrayEntry(unzipped, 'versions.json') as Array<CardVersion | ClientVersion>;
    let conflicts = 0;
    const countExisting = (table: string, id: string) => {
      if (this.db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)) conflicts++;
    };

    for (const card of cards) countExisting('cards', card.meta.id);
    for (const version of versions) countExisting('versions', version.id);

    if (!isClient) {
      const assets = this.parseArrayEntry(unzipped, 'assets.json') as Asset[];
      const links = this.parseArrayEntry(unzipped, 'card_assets.json') as CardAsset[];
      const presets = this.parseArrayEntry(unzipped, 'presets.json') as UserPreset[];
      const settings = this.parseArrayEntry(unzipped, 'app_settings.json') as AppSettingBackup[];
      for (const asset of assets) countExisting('assets', asset.id);
      for (const link of links) countExisting('card_assets', link.id);
      for (const preset of presets) {
        if (!preset.isBuiltIn) countExisting('llm_presets', preset.id);
      }
      for (const setting of settings) {
        if (this.db.prepare('SELECT 1 FROM app_settings WHERE key = ?').get(setting.key)) conflicts++;
      }
      for (const archiveName of Object.keys(unzipped)) {
        if (!archiveName.startsWith('mutable/')) continue;
        const targetPath = this.resolveMutableFilePath(archiveName);
        if (targetPath && await fs.stat(targetPath).then(() => true).catch(() => false)) conflicts++;
      }
    }

    if (conflicts > 0) {
      throw new Error(`Merge conflict: ${conflicts} incoming records or files already exist`);
    }
  }

  /**
   * Restore from a client-side (lite/static) backup
   */
  private async restoreClientBackup(
    unzipped: Record<string, Uint8Array>,
    _manifest: BackupManifest,
    options: InternalRestoreOptions,
    result: RestoreResult
  ): Promise<RestoreResult> {
    if (options.mode === 'replace' && !options.transactionActive) {
      return this.runAtomicReplace(
        (fileRollbacks) => this.restoreClientBackup(
          unzipped,
          _manifest,
          { ...options, transactionActive: true, fileRollbacks },
          result,
        ),
        result,
      );
    }

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
      const clearExisting = () => {
        this.db.exec('DELETE FROM card_assets');
        this.db.exec('DELETE FROM versions');
        this.db.exec('DELETE FROM assets');
        this.db.exec('DELETE FROM cards');
      };
      if (options.transactionActive) clearExisting();
      else this.db.transaction(clearExisting)();
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
        if (originalImage) result.imported.images++;
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
          if (options.fileRollbacks) {
            await this.captureFileRollback(targetPath, options.fileRollbacks);
          }
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
    manifest: BackupManifest,
    options: InternalRestoreOptions,
    result: RestoreResult
  ): Promise<RestoreResult> {
    if (options.mode === 'replace' && !options.transactionActive) {
      return this.runAtomicReplace(
        (fileRollbacks) => this.restoreApiBackup(
          unzipped,
          manifest,
          { ...options, transactionActive: true, fileRollbacks },
          result,
        ),
        result,
      );
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

    const appSettings: AppSettingBackup[] = unzipped['app_settings.json']
      ? JSON.parse(strFromU8(unzipped['app_settings.json']))
      : [];

    console.log(`[backup] API backup contents: ${cards.length} cards, ${assets.length} assets, ${cardAssets.length} card-assets, ${versions.length} versions`);

    // Handle replace mode - delete all existing data
    if (options.mode === 'replace') {
      const clearExisting = () => {
        this.db.exec('DELETE FROM card_assets');
        this.db.exec('DELETE FROM versions');
        this.db.exec('DELETE FROM assets');
        this.db.exec('DELETE FROM cards');
        // Optional categories are only replaced when the archive includes them.
        if (unzipped['presets.json']) {
          this.db.exec('DELETE FROM llm_presets WHERE is_built_in = 0');
        }
        if (unzipped['app_settings.json']) {
          this.db.exec('DELETE FROM app_settings');
        }
      };
      if (options.transactionActive) clearExisting();
      else this.db.transaction(clearExisting)();

      if (options.fileRollbacks) {
        await this.prepareMutableFileReplacement(manifest, options.fileRollbacks);
      }
    }

    const cardExistsStmt = this.db.prepare('SELECT 1 FROM cards WHERE id = ?');
    const assetExistsStmt = this.db.prepare('SELECT 1 FROM assets WHERE id = ?');
    const cardAssetExistsStmt = this.db.prepare('SELECT 1 FROM card_assets WHERE id = ?');
    const versionExistsStmt = this.db.prepare('SELECT 1 FROM versions WHERE id = ?');
    const presetExistsStmt = this.db.prepare('SELECT 1 FROM llm_presets WHERE id = ?');
    const settingExistsStmt = this.db.prepare('SELECT 1 FROM app_settings WHERE key = ?');

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

    const insertSettingStmt = this.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
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
        if (originalImage) result.imported.images++;
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
        if (options.fileRollbacks) {
          await this.captureFileRollback(targetPath, options.fileRollbacks);
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
      } catch {
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

    for (const setting of appSettings) {
      try {
        if (options.mode === 'merge' && settingExistsStmt.get(setting.key)) {
          result.skipped++;
          continue;
        }
        insertSettingStmt.run(setting.key, setting.value, setting.updatedAt);
        result.imported.settings++;
      } catch (err) {
        result.errors.push(`Failed to restore application setting ${setting.key}: ${err}`);
      }
    }

    await this.restoreMutableFiles(unzipped, options, result);

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Keep database replacement and every overwritten asset file recoverable as
   * one operation. SQLite remains uncommitted until filesystem writes finish;
   * failures roll back both surfaces before returning.
   */
  private async runAtomicReplace(
    operation: (fileRollbacks: FileRollback[]) => Promise<RestoreResult>,
    result: RestoreResult,
  ): Promise<RestoreResult> {
    const fileRollbacks: FileRollback[] = [];
    this.db.exec('BEGIN IMMEDIATE');

    try {
      const operationResult = await operation(fileRollbacks);
      if (!operationResult.success) {
        throw new Error(operationResult.errors.join('; ') || 'Restore did not complete');
      }
      this.db.exec('COMMIT');
      return operationResult;
    } catch (error) {
      if (this.db.inTransaction) this.db.exec('ROLLBACK');
      await this.restoreFiles(fileRollbacks);
      result.success = false;
      result.imported = { cards: 0, versions: 0, assets: 0, images: 0, presets: 0, settings: 0, files: 0 };
      if (result.errors.length === 0) {
        result.errors.push(`Backup restore failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`);
      }
      return result;
    }
  }

  private async prepareMutableFileReplacement(
    manifest: BackupManifest,
    rollbacks: FileRollback[],
  ): Promise<void> {
    if (typeof manifest.counts.settingsFile === 'number') {
      await this.captureFileRollback(this.mutablePaths.settingsPath, rollbacks);
      await fs.unlink(this.mutablePaths.settingsPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }

    const roots: string[] = [];
    if (typeof manifest.counts.presetFiles === 'number') roots.push(this.mutablePaths.presetStoragePath);
    if (typeof manifest.counts.themeImages === 'number') roots.push(this.mutablePaths.themeImagesPath);
    for (const root of roots) {
      for (const file of await this.collectFiles(root, 'unused')) {
        await this.captureFileRollback(file.path, rollbacks);
        await fs.unlink(file.path);
      }
    }
  }

  private async restoreMutableFiles(
    unzipped: Record<string, Uint8Array>,
    options: InternalRestoreOptions,
    result: RestoreResult,
  ): Promise<void> {
    for (const [archiveName, bytes] of Object.entries(unzipped)) {
      if (!archiveName.startsWith('mutable/')) continue;
      const targetPath = this.resolveMutableFilePath(archiveName);
      if (!targetPath) {
        result.errors.push(`Failed to restore unsupported mutable file ${archiveName}`);
        continue;
      }

      try {
        if (options.mode === 'merge') {
          const exists = await fs.stat(targetPath).then(() => true).catch(() => false);
          if (exists) {
            result.skipped++;
            continue;
          }
        }
        if (options.fileRollbacks) {
          await this.captureFileRollback(targetPath, options.fileRollbacks);
        }
        await fs.mkdir(dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, bytes, { mode: 0o600 });
        result.imported.files++;
      } catch (err) {
        result.errors.push(`Failed to restore mutable file ${archiveName}: ${err}`);
      }
    }
  }

  private async captureFileRollback(path: string, rollbacks: FileRollback[]): Promise<void> {
    try {
      rollbacks.push({ path, previous: await fs.readFile(path) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      rollbacks.push({ path, previous: null });
    }
  }

  private async restoreFiles(rollbacks: FileRollback[]): Promise<void> {
    for (const rollback of [...rollbacks].reverse()) {
      try {
        if (rollback.previous) {
          await fs.mkdir(dirname(rollback.path), { recursive: true });
          await fs.writeFile(rollback.path, rollback.previous);
        } else {
          await fs.unlink(rollback.path).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
        }
      } catch (error) {
        console.error(`[backup] Failed to restore file during rollback: ${rollback.path}`, error);
      }
    }
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
      const unzipped = this.extractBackupArchive(zipBuffer);

      // Check manifest
      if (!unzipped['manifest.json']) {
        errors.push('Missing manifest.json');
        return { valid: false, errors };
      }

      const manifest = this.parseManifestEntry(unzipped);

      if (errors.length === 0) this.validateArchiveStructure(unzipped, manifest);

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
    const unzipped = this.extractBackupArchive(zipBuffer);
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
