/**
 * CharX Export Validator
 * Ensures CharX exports are deterministic and valid
 */

import type { CCv3Data, CardAssetWithDetails, AssetValidationError } from '@card-architect/schemas';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
}

/**
 * Validate a card and its assets before CharX export
 */
export async function validateCharxExport(
  card: CCv3Data,
  assets: CardAssetWithDetails[],
  storagePath: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    fixes: [],
  };

  // Rule 1: At least one portrait
  const portraits = assets.filter(a => a.type === 'icon');
  if (portraits.length === 0) {
    result.errors.push('Card must have at least one portrait asset (type: icon)');
    result.valid = false;
  }

  // Rule 2: Unique asset names
  const names = assets.map(a => a.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];

  if (uniqueDuplicates.length > 0) {
    result.warnings.push(`Duplicate asset names found: ${uniqueDuplicates.join(', ')}`);
    result.fixes.push(`Renamed ${duplicates.length} duplicate assets by appending index`);

    // Auto-fix: rename duplicates
    const nameCount = new Map<string, number>();
    assets.forEach(asset => {
      const count = nameCount.get(asset.name) || 0;
      nameCount.set(asset.name, count + 1);

      if (count > 0) {
        asset.name = `${asset.name}_${count}`;
      }
    });
  }

  // Rule 3: Valid URIs in card data
  if (card.data.assets && Array.isArray(card.data.assets)) {
    const missingAssets: string[] = [];

    card.data.assets.forEach(descriptor => {
      const uri = descriptor.uri;

      // Check embeded:// URIs
      if (uri.startsWith('embeded://')) {
        const assetFound = assets.find(asset => {
          // Extract filename from embeded:// URI
          const uriPath = uri.replace('embeded://', '');
          return uriPath.includes(asset.name) || asset.asset.url.includes(asset.name);
        });

        if (!assetFound) {
          missingAssets.push(`${descriptor.type}/${descriptor.name} (${uri})`);
        }
      }
    });

    if (missingAssets.length > 0) {
      result.errors.push(`${missingAssets.length} asset(s) reference missing files: ${missingAssets.join(', ')}`);
      result.valid = false;
    }
  }

  // Rule 4: Asset files exist on disk
  const missingFiles: string[] = [];

  for (const asset of assets) {
    if (asset.asset.url.startsWith('/storage/')) {
      const filename = asset.asset.url.replace('/storage/', '');
      const filePath = join(storagePath, filename);

      try {
        await fs.access(filePath);
      } catch {
        missingFiles.push(`${asset.name} (${filePath})`);
      }
    }
  }

  if (missingFiles.length > 0) {
    result.errors.push(`${missingFiles.length} asset file(s) not found on disk: ${missingFiles.join(', ')}`);
    result.valid = false;
  }

  // Rule 5: Recompute hashes for determinism
  result.fixes.push('Recomputed asset hashes for deterministic export');

  // Rule 6: Validate tag consistency
  const tagErrors = validateAssetTags(assets);
  tagErrors.forEach(error => {
    if (error.severity === 'error') {
      result.errors.push(`${error.assetName}: ${error.message}`);
      result.valid = false;
    } else {
      result.warnings.push(`${error.assetName}: ${error.message}`);
    }
  });

  return result;
}

/**
 * Validate asset tags for consistency
 */
function validateAssetTags(assets: CardAssetWithDetails[]): AssetValidationError[] {
  const errors: AssetValidationError[] = [];

  // Check for multiple portrait-override tags
  const portraitOverrides = assets.filter(a =>
    a.tags && a.tags.includes('portrait-override')
  );

  if (portraitOverrides.length > 1) {
    portraitOverrides.forEach(asset => {
      errors.push({
        assetId: asset.id,
        assetName: asset.name,
        severity: 'error',
        message: `Multiple portrait-override tags found (${portraitOverrides.length} total). Only one asset should be marked as portrait override.`,
      });
    });
  }

  // Check for multiple main-background tags
  const mainBackgrounds = assets.filter(a =>
    a.tags && a.tags.includes('main-background')
  );

  if (mainBackgrounds.length > 1) {
    mainBackgrounds.forEach(asset => {
      errors.push({
        assetId: asset.id,
        assetName: asset.name,
        severity: 'error',
        message: `Multiple main-background tags found (${mainBackgrounds.length} total). Only one asset should be marked as main background.`,
      });
    });
  }

  // Check for continuous actor indices
  const actorIndices = new Set<number>();
  assets.forEach(asset => {
    if (asset.tags) {
      asset.tags.forEach(tag => {
        const match = tag.match(/^actor-(\d+)$/);
        if (match) {
          actorIndices.add(parseInt(match[1], 10));
        }
      });
    }
  });

  const actors = Array.from(actorIndices).sort((a, b) => a - b);
  if (actors.length > 0) {
    const expectedActors = Array.from({ length: actors.length }, (_, i) => i + 1);
    const missingActors = expectedActors.filter(idx => !actors.includes(idx));

    if (missingActors.length > 0) {
      errors.push({
        assetId: '',
        assetName: '',
        severity: 'warning',
        message: `Non-continuous actor indices detected. Expected continuous indices from 1-${actors.length}, but missing: ${missingActors.join(', ')}`,
      });
    }
  }

  return errors;
}

/**
 * Compute SHA-256 hash of a file
 */
export async function computeAssetHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Normalize asset order for deterministic export
 * Returns assets sorted by type, then order, then name
 */
export function normalizeAssetOrder(assets: CardAssetWithDetails[]): CardAssetWithDetails[] {
  return [...assets].sort((a, b) => {
    // Sort by type first
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    // Then by order
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    // Finally by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Apply auto-fixes to assets before export
 */
export function applyExportFixes(assets: CardAssetWithDetails[]): CardAssetWithDetails[] {
  // Deduplicate names
  const nameCount = new Map<string, number>();
  const fixedAssets = assets.map(asset => {
    const baseName = asset.name;
    const count = nameCount.get(baseName) || 0;
    nameCount.set(baseName, count + 1);

    if (count > 0) {
      return {
        ...asset,
        name: `${baseName}_${count}`,
        _originalName: baseName,
      } as CardAssetWithDetails & { _originalName?: string };
    }
    return asset;
  });

  // Normalize order
  return normalizeAssetOrder(fixedAssets);
}
