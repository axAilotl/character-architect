export const BACKUP_FORMAT_VERSION = '1.0' as const;

export const BACKUP_COUNT_KEYS = [
  'cards',
  'versions',
  'assets',
  'images',
  'presets',
  'settings',
  'settingsFile',
  'presetFiles',
  'themeImages',
] as const;

export type BackupCountKey = (typeof BACKUP_COUNT_KEYS)[number];
export type BackupSourceMode = 'full' | 'light' | 'static';

export interface BackupManifest {
  version: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
  sourceMode: BackupSourceMode;
  appVersion: string;
  schemaVersion?: number;
  counts: {
    cards: number;
    versions: number;
    assets: number;
    images?: number;
    presets?: number;
    settings?: number;
    settingsFile?: number;
    presetFiles?: number;
    themeImages?: number;
  };
  localStorageKeys?: string[];
}

export interface RestoreResult {
  success: boolean;
  imported: {
    cards: number;
    versions: number;
    assets: number;
    images: number;
    presets: number;
    settings: number;
    files: number;
  };
  skipped: number;
  errors: string[];
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BackupValidationError(`Invalid backup: ${name} must contain an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BackupValidationError(`Invalid backup manifest: ${name} must be a non-empty string`);
  }
  return value;
}

function requireCount(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new BackupValidationError(`Invalid backup manifest: counts.${name} must be a non-negative integer`);
  }
  return value as number;
}

/** Parse and validate the deployment-neutral portion of a backup manifest. */
export function parseBackupManifest(value: unknown): BackupManifest {
  const input = requireRecord(value, 'manifest.json');
  if (input.version !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError(`Unsupported backup version: ${String(input.version)}`);
  }

  const createdAt = requireString(input.createdAt, 'createdAt');
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new BackupValidationError('Invalid backup manifest: createdAt must be an ISO date');
  }

  if (input.sourceMode !== 'full' && input.sourceMode !== 'light' && input.sourceMode !== 'static') {
    throw new BackupValidationError('Invalid backup manifest: sourceMode is not supported');
  }

  const rawCounts = requireRecord(input.counts, 'manifest counts');
  const counts: BackupManifest['counts'] = {
    cards: requireCount(rawCounts.cards, 'cards'),
    versions: requireCount(rawCounts.versions, 'versions'),
    assets: requireCount(rawCounts.assets, 'assets'),
  };
  for (const key of BACKUP_COUNT_KEYS.slice(3)) {
    if (rawCounts[key] !== undefined) counts[key] = requireCount(rawCounts[key], key);
  }

  let schemaVersion: number | undefined;
  if (input.schemaVersion !== undefined) {
    schemaVersion = requireCount(input.schemaVersion, 'schemaVersion');
  }

  let localStorageKeys: string[] | undefined;
  if (input.localStorageKeys !== undefined) {
    if (!Array.isArray(input.localStorageKeys) || input.localStorageKeys.some((key) => typeof key !== 'string')) {
      throw new BackupValidationError('Invalid backup manifest: localStorageKeys must be an array of strings');
    }
    localStorageKeys = [...new Set(input.localStorageKeys as string[])];
    if (localStorageKeys.length !== input.localStorageKeys.length) {
      throw new BackupValidationError('Invalid backup manifest: localStorageKeys contains duplicates');
    }
  }

  return {
    version: BACKUP_FORMAT_VERSION,
    createdAt,
    sourceMode: input.sourceMode,
    appVersion: requireString(input.appVersion, 'appVersion'),
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    counts,
    ...(localStorageKeys === undefined ? {} : { localStorageKeys }),
  };
}

/** Reject archives whose declared counts do not match their parsed payloads. */
export function assertBackupCount(
  manifest: BackupManifest,
  key: BackupCountKey,
  actual: number,
): void {
  const declared = manifest.counts[key];
  if (declared !== undefined && declared !== actual) {
    throw new BackupValidationError(
      `Invalid backup: manifest declares ${declared} ${key}, but archive contains ${actual}`,
    );
  }
}
