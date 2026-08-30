// Client-side backup service
// Handles backup/restore for both full mode (via API) and lite/static mode (client-side)

import { zipSync, strToU8, strFromU8, type Unzipped } from 'fflate';
import { preflightZipSizes, streamingUnzipSync } from '@character-foundry/core/zip';
import { localDB, type StoredAsset, type StoredVersion } from './db';
import { getDeploymentConfig } from '../config/deployment';
import type { Card } from './types';
import {
  assertBackupCount,
  parseBackupManifest,
  type BackupManifest,
  type RestoreResult,
} from '@card-architect/backup-core';

export type { BackupManifest, RestoreResult } from '@card-architect/backup-core';

export interface BackupOptions {
  includeVersions?: boolean;
  includePresets?: boolean;
}

export interface RestoreOptions {
  mode: 'replace' | 'merge';
  skipConflicts?: boolean;
}

export interface BackupPreview {
  manifest: BackupManifest;
  cardNames: string[];
  totalSize: number;
}

// All localStorage keys we need to backup
const LOCALSTORAGE_KEYS = [
  'card-architect-settings',     // Main settings store (zustand)
  'ca-llm-providers',            // LLM provider configs
  'ca-llm-active-provider',      // Active LLM provider
  'ca-llm-presets',              // User LLM presets
  'ca-templates',                // User templates
  'ca-snippets',                 // User snippets
  'ca-wwwyzzerdd-prompts',       // wwwyzzerdd AI prompts
  'ca-sillytavern-settings',     // SillyTavern integration settings
  'ca-federation-settings',      // Federation settings
  'ca-package-optimizer-settings', // CHARX optimizer settings
];

const MAX_BACKUP_FILE_SIZE = 300 * 1024 * 1024;
const BACKUP_ZIP_LIMITS = {
  maxFileSize: 100 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
  maxFiles: 2_000,
  unsafePathHandling: 'reject' as const,
};

interface ParsedClientBackup {
  manifest: BackupManifest;
  cards: Card[];
  images: Array<{ cardId: string; type: string; data: string }>;
  versions: StoredVersion[];
  assets: StoredAsset[];
  localStorageData: Record<string, string>;
  includesLocalStorage: boolean;
}

function extractBackupArchive(bytes: Uint8Array): Unzipped {
  preflightZipSizes(bytes, BACKUP_ZIP_LIMITS);
  return streamingUnzipSync(bytes, BACKUP_ZIP_LIMITS);
}

function parseJsonEntry(unzipped: Unzipped, name: string, required = false): unknown {
  const entry = unzipped[name];
  if (!entry) {
    if (required) throw new Error(`Invalid backup: missing ${name}`);
    return undefined;
  }
  try {
    return JSON.parse(strFromU8(entry));
  } catch {
    throw new Error(`Invalid backup: ${name} is not valid JSON`);
  }
}

function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid backup: ${name} must contain an array`);
  return value;
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid backup: ${name} must contain an object`);
  }
  return value as Record<string, unknown>;
}

function bytesToDataUrl(bytes: Uint8Array, mimetype: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mimetype};base64,${btoa(binary)}`;
}

function parseClientPayload(unzipped: Unzipped): ParsedClientBackup {
  const manifest = parseBackupManifest(parseJsonEntry(unzipped, 'manifest.json', true));

  const cards = requireArray(parseJsonEntry(unzipped, 'cards.json', true), 'cards.json') as Card[];
  let versions = requireArray(parseJsonEntry(unzipped, 'versions.json') ?? [], 'versions.json') as StoredVersion[];
  let images: Array<{ cardId: string; type: string; data: string }> = [];
  let assets: StoredAsset[];

  const cardIds = new Set<string>();
  for (const card of cards) {
    if (!card?.meta || typeof card.meta.id !== 'string' || !card.meta.id || typeof card.meta.name !== 'string' || !card.data) {
      throw new Error('Invalid backup: every card must have meta.id, meta.name, and data');
    }
    if (cardIds.has(card.meta.id)) throw new Error(`Invalid backup: duplicate card id ${card.meta.id}`);
    cardIds.add(card.meta.id);
  }

  const isClientBackup = !!unzipped['images.json'] && !unzipped['card_assets.json'];
  if (isClientBackup) {
    images = requireArray(parseJsonEntry(unzipped, 'images.json') ?? [], 'images.json') as typeof images;
    assets = requireArray(parseJsonEntry(unzipped, 'assets.json') ?? [], 'assets.json') as StoredAsset[];
  } else {
    const apiAssets = requireArray(parseJsonEntry(unzipped, 'assets.json') ?? [], 'assets.json') as Array<Record<string, unknown>>;
    const cardAssets = requireArray(parseJsonEntry(unzipped, 'card_assets.json', true), 'card_assets.json') as Array<Record<string, unknown>>;
    const assetsById = new Map(apiAssets.map((asset) => [String(asset.id), asset]));

    for (const cardId of cardIds) {
      const image = unzipped[`images/cards/${cardId}.png`];
      if (image) images.push({ cardId, type: 'icon', data: bytesToDataUrl(image, 'image/png') });
    }

    assets = cardAssets.map((link) => {
      const assetId = String(link.assetId || '');
      const asset = assetsById.get(assetId);
      if (!asset) throw new Error(`Invalid backup: card asset references missing asset ${assetId}`);
      const filename = String(asset.filename || `${assetId}.bin`);
      const bytes = unzipped[`assets/${assetId}`] || unzipped[`assets/${filename}`];
      if (!bytes) throw new Error(`Invalid backup: missing bytes for asset ${assetId}`);
      const cardId = String(link.cardId || '');
      return {
        // Server assets may be shared by multiple card-asset links, while the
        // browser store owns one asset record per card. Preserve the link ID.
        id: String(link.id || assetId),
        cardId,
        name: String(link.name || filename),
        type: String(link.type || 'custom') as StoredAsset['type'],
        ext: String(link.ext || filename.split('.').pop() || 'bin'),
        mimetype: String(asset.mimetype || 'application/octet-stream'),
        size: Number(asset.size || bytes.byteLength),
        width: typeof asset.width === 'number' ? asset.width : undefined,
        height: typeof asset.height === 'number' ? asset.height : undefined,
        data: bytesToDataUrl(bytes, String(asset.mimetype || 'application/octet-stream')),
        isMain: Boolean(link.isMain),
        tags: Array.isArray(link.tags) ? link.tags.map(String) : [],
        actorIndex: typeof link.actorIndex === 'number' ? link.actorIndex : undefined,
        createdAt: String(link.createdAt || manifest.createdAt),
        updatedAt: String(link.updatedAt || link.createdAt || manifest.createdAt),
      };
    });

    versions = versions.map((version) => {
      const serverVersion = version as unknown as Record<string, unknown>;
      return {
        id: String(serverVersion.id),
        cardId: String(serverVersion.cardId),
        versionNumber: Number(serverVersion.versionNumber ?? serverVersion.version),
        message: typeof serverVersion.message === 'string' ? serverVersion.message : undefined,
        data: serverVersion.data as StoredVersion['data'],
        createdAt: String(serverVersion.createdAt || manifest.createdAt),
      };
    });
  }

  for (const image of images) {
    if (!image || typeof image.cardId !== 'string' || !cardIds.has(image.cardId) || typeof image.type !== 'string' || typeof image.data !== 'string') {
      throw new Error('Invalid backup: image has invalid fields or references a missing card');
    }
  }
  for (const version of versions) {
    if (!version || typeof version.id !== 'string' || typeof version.cardId !== 'string' || !cardIds.has(version.cardId)) {
      throw new Error('Invalid backup: version has invalid fields or references a missing card');
    }
  }
  for (const asset of assets) {
    if (!asset || typeof asset.id !== 'string' || typeof asset.cardId !== 'string' || !cardIds.has(asset.cardId) || typeof asset.data !== 'string') {
      throw new Error('Invalid backup: asset has invalid fields or references a missing card');
    }
  }
  assertBackupCount(manifest, 'cards', cards.length);
  assertBackupCount(manifest, 'versions', versions.length);
  assertBackupCount(manifest, 'assets', assets.length);
  assertBackupCount(manifest, 'images', images.length);

  const includesLocalStorage = !!unzipped['localStorage.json'];
  const localStorageRaw = parseJsonEntry(unzipped, 'localStorage.json') ?? {};
  const localStorageRecord = requireRecord(localStorageRaw, 'localStorage.json');
  const localStorageData: Record<string, string> = {};
  for (const [key, value] of Object.entries(localStorageRecord)) {
    if (!LOCALSTORAGE_KEYS.includes(key) || typeof value !== 'string') {
      throw new Error(`Invalid backup: unsupported localStorage entry ${key}`);
    }
    localStorageData[key] = value;
  }

  return { manifest, cards, images, versions, assets, localStorageData, includesLocalStorage };
}

// Create backup - delegates to API in full mode, does client-side in lite/static
export async function createBackup(options: BackupOptions = {}): Promise<Blob> {
  const config = getDeploymentConfig();

  if (config.mode === 'full') {
    // Use API endpoint
    const response = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!response.ok) throw new Error('Backup failed');
    return response.blob();
  }

  // Client-side backup for lite/static mode
  return createClientBackup(options);
}

async function createClientBackup(options: BackupOptions): Promise<Blob> {
  console.log('[backup] Starting client backup...');

  const exported = await localDB.exportAll();
  const config = getDeploymentConfig();

  console.log('[backup] Exported data counts:');
  console.log('[backup]   Cards:', exported.cards.length);
  console.log('[backup]   Images:', exported.images.length);
  console.log('[backup]   Versions:', exported.versions.length);
  console.log('[backup]   Assets:', exported.assets.length);

  // Collect localStorage data
  const localStorageData: Record<string, string> = {};
  const foundKeys: string[] = [];
  for (const key of LOCALSTORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      localStorageData[key] = value;
      foundKeys.push(key);
    }
  }
  console.log('[backup]   LocalStorage keys:', foundKeys.length);

  const manifest: BackupManifest = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    sourceMode: config.mode,
    appVersion: '0.1.0',
    counts: {
      cards: exported.cards.length,
      versions: options.includeVersions !== false ? exported.versions.length : 0,
      assets: exported.assets.length,
      images: exported.images.length,
    },
    localStorageKeys: foundKeys,
  };

  const zipData: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'cards.json': strToU8(JSON.stringify(exported.cards, null, 2)),
    'images.json': strToU8(JSON.stringify(exported.images, null, 2)),
    'localStorage.json': strToU8(JSON.stringify(localStorageData, null, 2)),
  };

  if (options.includeVersions !== false) {
    zipData['versions.json'] = strToU8(JSON.stringify(exported.versions, null, 2));
  }

  // Assets are stored as base64 in IndexedDB, include them in the backup
  zipData['assets.json'] = strToU8(JSON.stringify(exported.assets, null, 2));

  console.log('[backup] Creating ZIP with files:', Object.keys(zipData));

  const zipped = zipSync(zipData, { level: 6 });

  // Convert to proper ArrayBuffer for Blob compatibility
  const arrayBuffer = new ArrayBuffer(zipped.byteLength);
  const uint8Result = new Uint8Array(arrayBuffer);
  uint8Result.set(zipped);

  console.log('[backup] Backup created, size:', uint8Result.byteLength);

  return new Blob([uint8Result], { type: 'application/zip' });
}

// Restore backup
export async function restoreBackup(file: File, options: RestoreOptions): Promise<RestoreResult> {
  const config = getDeploymentConfig();

  if (config.mode === 'full') {
    // Use API endpoint
    const formData = new FormData();
    formData.append('file', file);
    const skipConflicts = options.skipConflicts ?? true;
    const response = await fetch(`/api/backup/restore?mode=${options.mode}&skipConflicts=${skipConflicts}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json() as { message?: string; error?: string; errors?: string[] };
      throw new Error(error.message || error.error || error.errors?.join(', ') || 'Restore failed');
    }
    const result = await response.json() as Partial<RestoreResult>;
    return {
      success: result.success === true,
      imported: {
        cards: result.imported?.cards ?? 0,
        versions: result.imported?.versions ?? 0,
        assets: result.imported?.assets ?? 0,
        images: result.imported?.images ?? 0,
        presets: result.imported?.presets ?? 0,
        settings: result.imported?.settings ?? 0,
        files: result.imported?.files ?? 0,
      },
      skipped: result.skipped ?? 0,
      errors: result.errors ?? [],
    };
  }

  // Client-side restore for lite/static mode
  return restoreClientBackup(file, options);
}

async function restoreClientBackup(file: File, options: RestoreOptions): Promise<RestoreResult> {
  console.log('[restore] Starting client restore...');
  console.log('[restore] Mode:', options.mode);

  if (file.size > MAX_BACKUP_FILE_SIZE) {
    throw new Error(`Backup is too large (maximum ${MAX_BACKUP_FILE_SIZE / 1024 / 1024} MB)`);
  }
  const buffer = await file.arrayBuffer();
  const unzipped = extractBackupArchive(new Uint8Array(buffer));
  const { manifest, cards, images, versions, assets, localStorageData, includesLocalStorage } = parseClientPayload(unzipped);
  console.log('[restore] Manifest:', manifest);

  console.log('[restore] Parsed data:');
  console.log('[restore]   Cards:', cards.length);
  console.log('[restore]   Images:', images.length);
  console.log('[restore]   Versions:', versions.length);
  console.log('[restore]   Assets:', assets.length);
  console.log('[restore]   LocalStorage keys:', Object.keys(localStorageData).length);

  // localStorage has no transaction API. Apply it first, keep an exact snapshot,
  // then restore that snapshot if the single IndexedDB transaction aborts.
  const localStorageSnapshot = new Map(
    LOCALSTORAGE_KEYS.map((key) => [key, localStorage.getItem(key)] as const),
  );
  let localStorageSkipped = 0;
  try {
    if (options.mode === 'replace' && includesLocalStorage) {
      for (const key of LOCALSTORAGE_KEYS) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(localStorageData)) {
      if (options.mode === 'merge' && localStorage.getItem(key) !== null) {
        localStorageSkipped++;
      } else {
        localStorage.setItem(key, value);
      }
    }

    console.log('[restore] Importing to IndexedDB atomically...');
    const databaseResult = await localDB.restoreAll(
      { cards, images, versions, assets },
      options.mode,
      options.skipConflicts ?? true,
    );
    console.log('[restore] IndexedDB import complete');

    return {
      success: true,
      imported: {
        ...databaseResult.imported,
        presets: 0,
        settings: Object.keys(localStorageData).length - localStorageSkipped,
        files: 0,
      },
      skipped: databaseResult.skipped + localStorageSkipped,
      errors: [],
    };
  } catch (err) {
    console.error('[restore] IndexedDB import failed:', err);
    for (const [key, value] of localStorageSnapshot) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    const restoreError = new Error(
      `Restore failed without changing existing data: ${err instanceof Error ? err.message : String(err)}`,
    );
    (restoreError as Error & { cause?: unknown }).cause = err;
    throw restoreError;
  }
}

// Validate backup file
export async function validateBackup(file: File): Promise<{ valid: boolean; errors: string[] }> {
  try {
    if (file.size > MAX_BACKUP_FILE_SIZE) {
      return { valid: false, errors: [`Backup exceeds ${MAX_BACKUP_FILE_SIZE / 1024 / 1024} MB limit`] };
    }
    const buffer = await file.arrayBuffer();
    parseClientPayload(extractBackupArchive(new Uint8Array(buffer)));
    return { valid: true, errors: [] };
  } catch (e) {
    return { valid: false, errors: [e instanceof Error ? e.message : 'Invalid ZIP file'] };
  }
}

// Preview backup contents
export async function previewBackup(file: File): Promise<BackupPreview> {
  if (file.size > MAX_BACKUP_FILE_SIZE) {
    throw new Error(`Backup exceeds ${MAX_BACKUP_FILE_SIZE / 1024 / 1024} MB limit`);
  }
  const buffer = await file.arrayBuffer();
  const { manifest, cards } = parseClientPayload(extractBackupArchive(new Uint8Array(buffer)));
  const cardNames = cards.map(c => c.meta.name);

  return {
    manifest,
    cardNames,
    totalSize: file.size,
  };
}
