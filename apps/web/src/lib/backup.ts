// Client-side backup service
// Handles backup/restore for both full mode (via API) and lite/static mode (client-side)

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { localDB, type StoredAsset, type StoredVersion } from './db';
import { getDeploymentConfig } from '../config/deployment';
import type { Card } from './types';

export interface BackupManifest {
  version: '1.0';
  createdAt: string;
  sourceMode: 'full' | 'light' | 'static';
  appVersion: string;
  counts: {
    cards: number;
    versions: number;
    assets: number;
    images: number;
  };
  localStorageKeys: string[];
}

export interface BackupOptions {
  includeVersions?: boolean;
  includePresets?: boolean;
}

export interface RestoreOptions {
  mode: 'replace' | 'merge';
}

export interface RestoreResult {
  success: boolean;
  imported: { cards: number; versions: number; assets: number; images: number };
  skipped: number;
  errors: string[];
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
    appVersion: '1.0.0',
    counts: {
      cards: exported.cards.length,
      versions: exported.versions.length,
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
    const response = await fetch(`/api/backup/restore?mode=${options.mode}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Restore failed');
    }
    return response.json();
  }

  // Client-side restore for lite/static mode
  return restoreClientBackup(file, options);
}

async function restoreClientBackup(file: File, options: RestoreOptions): Promise<RestoreResult> {
  console.log('[restore] Starting client restore...');
  console.log('[restore] Mode:', options.mode);

  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));

  console.log('[restore] Unzipped files:', Object.keys(unzipped));

  // Parse manifest
  if (!unzipped['manifest.json']) {
    throw new Error('Invalid backup: missing manifest.json');
  }

  const manifest: BackupManifest = JSON.parse(strFromU8(unzipped['manifest.json']));
  console.log('[restore] Manifest:', manifest);

  // Parse data files
  const cards: Card[] = unzipped['cards.json']
    ? JSON.parse(strFromU8(unzipped['cards.json']))
    : [];

  // IMPORTANT: Parse images correctly - these are stored with compound key [cardId, type]
  const images: Array<{ cardId: string; type: string; data: string }> = unzipped['images.json']
    ? JSON.parse(strFromU8(unzipped['images.json']))
    : [];

  const versions: StoredVersion[] = unzipped['versions.json']
    ? JSON.parse(strFromU8(unzipped['versions.json']))
    : [];

  const assets: StoredAsset[] = unzipped['assets.json']
    ? JSON.parse(strFromU8(unzipped['assets.json']))
    : [];

  // Parse localStorage data
  const localStorageData: Record<string, string> = unzipped['localStorage.json']
    ? JSON.parse(strFromU8(unzipped['localStorage.json']))
    : {};

  console.log('[restore] Parsed data:');
  console.log('[restore]   Cards:', cards.length);
  console.log('[restore]   Images:', images.length);
  console.log('[restore]   Versions:', versions.length);
  console.log('[restore]   Assets:', assets.length);
  console.log('[restore]   LocalStorage keys:', Object.keys(localStorageData).length);

  // Validate images have required fields
  const validImages = images.filter(img => img.cardId && img.type && img.data);
  if (validImages.length !== images.length) {
    console.warn('[restore] Some images were invalid:', images.length - validImages.length, 'skipped');
  }

  // Validate assets have required fields
  const validAssets = assets.filter(asset => asset.id && asset.cardId && asset.data);
  if (validAssets.length !== assets.length) {
    console.warn('[restore] Some assets were invalid:', assets.length - validAssets.length, 'skipped');
  }

  // Clear existing data if replace mode
  if (options.mode === 'replace') {
    console.log('[restore] Replace mode - clearing existing data...');
    await localDB.clearAll();

    // Also clear localStorage settings
    for (const key of LOCALSTORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  }

  // Import IndexedDB data
  console.log('[restore] Importing to IndexedDB...');
  try {
    await localDB.importAll({ cards, images: validImages, versions, assets: validAssets });
    console.log('[restore] IndexedDB import complete');
  } catch (err) {
    console.error('[restore] IndexedDB import failed:', err);
    throw new Error(`Failed to import data to IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Restore localStorage data
  console.log('[restore] Restoring localStorage...');
  for (const [key, value] of Object.entries(localStorageData)) {
    try {
      localStorage.setItem(key, value);
      console.log('[restore]   Restored:', key);
    } catch (err) {
      console.warn('[restore]   Failed to restore:', key, err);
    }
  }

  console.log('[restore] Restore complete');

  return {
    success: true,
    imported: {
      cards: cards.length,
      versions: versions.length,
      assets: validAssets.length,
      images: validImages.length,
    },
    skipped: (images.length - validImages.length) + (assets.length - validAssets.length),
    errors: [],
  };
}

// Validate backup file
export async function validateBackup(file: File): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const buffer = await file.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(buffer));

    const errors: string[] = [];

    if (!unzipped['manifest.json']) {
      errors.push('Missing manifest.json');
    }
    if (!unzipped['cards.json']) {
      errors.push('Missing cards.json');
    }

    if (errors.length === 0) {
      // Try to parse the JSON files
      try {
        JSON.parse(strFromU8(unzipped['manifest.json']));
        JSON.parse(strFromU8(unzipped['cards.json']));
        if (unzipped['images.json']) {
          const images = JSON.parse(strFromU8(unzipped['images.json']));
          if (!Array.isArray(images)) {
            errors.push('images.json is not an array');
          }
        }
        if (unzipped['assets.json']) {
          const assets = JSON.parse(strFromU8(unzipped['assets.json']));
          if (!Array.isArray(assets)) {
            errors.push('assets.json is not an array');
          }
        }
      } catch {
        errors.push('Invalid JSON in backup files');
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (e) {
    return { valid: false, errors: ['Invalid ZIP file'] };
  }
}

// Preview backup contents
export async function previewBackup(file: File): Promise<BackupPreview> {
  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));

  if (!unzipped['manifest.json']) {
    throw new Error('Invalid backup: missing manifest.json');
  }

  const manifest: BackupManifest = JSON.parse(strFromU8(unzipped['manifest.json']));

  let cardNames: string[] = [];
  if (unzipped['cards.json']) {
    const cards: Card[] = JSON.parse(strFromU8(unzipped['cards.json']));
    cardNames = cards.map(c => c.meta.name);
  }

  return {
    manifest,
    cardNames,
    totalSize: file.size,
  };
}
