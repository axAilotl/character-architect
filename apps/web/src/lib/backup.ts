// Client-side backup service
// Handles backup/restore for both full mode (via API) and lite/static mode (client-side)

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { localDB } from './db';
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
  };
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
  imported: { cards: number; versions: number; assets: number };
  skipped: number;
  errors: string[];
}

export interface BackupPreview {
  manifest: BackupManifest;
  cardNames: string[];
  totalSize: number;
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
  const exported = await localDB.exportAll();
  const config = getDeploymentConfig();

  const manifest: BackupManifest = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    sourceMode: config.mode,
    appVersion: '1.0.0', // TODO: get from package.json
    counts: {
      cards: exported.cards.length,
      versions: exported.versions.length,
      assets: exported.assets.length,
    },
  };

  const zipData: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'cards.json': strToU8(JSON.stringify(exported.cards, null, 2)),
    'images.json': strToU8(JSON.stringify(exported.images, null, 2)),
  };

  if (options.includeVersions !== false) {
    zipData['versions.json'] = strToU8(JSON.stringify(exported.versions, null, 2));
  }

  // Assets are stored as base64 in IndexedDB, include them in the backup
  zipData['assets.json'] = strToU8(JSON.stringify(exported.assets, null, 2));

  const zipped = zipSync(zipData, { level: 6 });

  // Convert to proper ArrayBuffer for Blob compatibility
  const arrayBuffer = new ArrayBuffer(zipped.byteLength);
  const uint8Result = new Uint8Array(arrayBuffer);
  uint8Result.set(zipped);

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
  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));

  // Parse manifest
  if (!unzipped['manifest.json']) {
    throw new Error('Invalid backup: missing manifest.json');
  }

  // Parse data files
  const cards: Card[] = unzipped['cards.json']
    ? JSON.parse(strFromU8(unzipped['cards.json']))
    : [];
  const images = unzipped['images.json']
    ? JSON.parse(strFromU8(unzipped['images.json']))
    : [];
  const versions = unzipped['versions.json']
    ? JSON.parse(strFromU8(unzipped['versions.json']))
    : [];
  const assets = unzipped['assets.json']
    ? JSON.parse(strFromU8(unzipped['assets.json']))
    : [];

  // Clear existing data if replace mode
  if (options.mode === 'replace') {
    await localDB.clearAll();
  }

  // Import data
  await localDB.importAll({ cards, images, versions, assets });

  return {
    success: true,
    imported: {
      cards: cards.length,
      versions: versions.length,
      assets: assets.length,
    },
    skipped: 0,
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
