/**
 * CHARX Format Writer
 *
 * Creates .charx (ZIP-based character card) files.
 * Uses fflate for browser/Node.js compatibility.
 */

import { zipSync, type Zippable } from 'fflate';
import type { CCv3Data, AssetDescriptor } from '@card-architect/schemas';
import { type BinaryData, fromString, getMimeTypeFromExt } from '@card-architect/utils';

/**
 * Asset to include in CHARX
 */
export interface CharxWriteAsset {
  /** Asset type (icon, background, emotion, etc.) */
  type: string;
  /** Asset name (without extension) */
  name: string;
  /** File extension */
  ext: string;
  /** Binary data of the asset */
  data: BinaryData;
  /** Whether this is the main asset of its type */
  isMain?: boolean;
}

/**
 * Options for building CHARX
 */
/** Valid compression levels for fflate */
export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface CharxBuildOptions {
  /** Compression level (0-9, default: 6) */
  compressionLevel?: CompressionLevel;
  /** Include x_meta directory */
  includeMetadata?: boolean;
}

/**
 * Result of building a CHARX file
 */
export interface CharxBuildResult {
  /** The CHARX ZIP buffer */
  buffer: BinaryData;
  /** Number of assets included */
  assetCount: number;
  /** Total size of the CHARX */
  totalSize: number;
}

/**
 * Get CHARX category from MIME type
 */
function getCharxCategory(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'other';
}

/**
 * Sanitize a name for use in file paths
 */
function sanitizeName(name: string, ext: string): string {
  let safeName = name;

  // Strip extension if present
  if (safeName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    safeName = safeName.substring(0, safeName.length - (ext.length + 1));
  }

  // Replace dots and underscores with hyphens, remove special chars, collapse dashes
  safeName = safeName
    .replace(/[._]/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!safeName) safeName = 'asset';

  return safeName;
}

/**
 * Build a CHARX ZIP from card data and assets
 */
export function buildCharx(
  card: CCv3Data,
  assets: CharxWriteAsset[],
  options: CharxBuildOptions = {}
): CharxBuildResult {
  const { compressionLevel = 6 } = options;

  // Transform card to use embeded:// URIs
  const transformedCard = transformAssetUris(card, assets);

  // Create ZIP entries
  const zipEntries: Zippable = {};

  // Add card.json
  const cardJson = JSON.stringify(transformedCard, null, 2);
  zipEntries['card.json'] = [fromString(cardJson), { level: compressionLevel }];

  // Add assets
  let assetCount = 0;

  for (const asset of assets) {
    const mimetype = getMimeTypeFromExt(asset.ext);
    const category = getCharxCategory(mimetype);
    let safeName = sanitizeName(asset.name, asset.ext);

    // Force main icon to be named 'main' for interoperability
    if (asset.isMain && asset.type === 'icon') {
      safeName = 'main';
    }

    const assetPath = `assets/${asset.type}/${category}/${safeName}.${asset.ext}`;

    zipEntries[assetPath] = [asset.data, { level: compressionLevel }];
    assetCount++;
  }

  // Create ZIP
  const buffer = zipSync(zipEntries);

  return {
    buffer,
    assetCount,
    totalSize: buffer.length,
  };
}

/**
 * Transform asset URIs in card to use embeded:// format
 */
function transformAssetUris(card: CCv3Data, assets: CharxWriteAsset[]): CCv3Data {
  // Clone the card to avoid mutations
  const transformed: CCv3Data = JSON.parse(JSON.stringify(card));

  // Generate assets array from provided assets
  transformed.data.assets = assets.map((asset): AssetDescriptor => {
    const mimetype = getMimeTypeFromExt(asset.ext);
    const category = getCharxCategory(mimetype);
    let safeName = sanitizeName(asset.name, asset.ext);

    // Force main icon to be named 'main' for interoperability
    if (asset.isMain && asset.type === 'icon') {
      safeName = 'main';
    }

    return {
      type: asset.type as AssetDescriptor['type'],
      uri: `embeded://assets/${asset.type}/${category}/${safeName}.${asset.ext}`,
      name: safeName,
      ext: asset.ext,
    };
  });

  return transformed;
}

/**
 * Async version of buildCharx (could use Web Worker in future)
 */
export async function buildCharxAsync(
  card: CCv3Data,
  assets: CharxWriteAsset[],
  options: CharxBuildOptions = {}
): Promise<CharxBuildResult> {
  // For now, just wrap sync version
  return buildCharx(card, assets, options);
}
