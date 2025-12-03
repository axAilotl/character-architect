/**
 * File Handlers
 *
 * Wraps buffer-based packages with file path APIs for the API layer.
 * Handles Buffer <-> Uint8Array conversion for Node.js compatibility.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { optimizeMedia } from './image-optimizer.js';

// CHARX package
import {
  extractCharx as extractCharxBuffer,
  extractCharxAsync as extractCharxBufferAsync,
  buildCharx as buildCharxBuffer,
  type CharxExtractionOptions as CharxPackageExtractionOptions,
  type CharxBuildOptions as CharxPackageBuildOptions,
  type CharxWriteAsset,
  type AssetFetcher,
} from '@card-architect/charx';

// Voxta package
import {
  extractVoxtaPackage as extractVoxtaBuffer,
  buildVoxtaPackage as buildVoxtaBuffer,
  voxtaToCCv3,
  ccv3ToVoxta,
  ccv3LorebookToVoxtaBook,
  type VoxtaExtractionOptions,
  type VoxtaBuildOptions as VoxtaPackageBuildOptions,
  type VoxtaData as VoxtaPackageData,
  type ExtractedVoxtaCharacter as PackageVoxtaCharacter,
  type ExtractedVoxtaBook,
  type ExtractedVoxtaScenario as PackageVoxtaScenario,
  type VoxtaWriteAsset,
} from '@card-architect/voxta';

// PNG package
import {
  extractFromPNG as extractFromPNGBuffer,
  createCardPNG as createCardPNGBuffer,
  validatePNGSize as validatePNGSizeBuffer,
} from '@card-architect/png';

// Utils package
import {
  isZipBuffer as isZipBufferUtil,
  findZipStart as findZipStartUtil,
  getMimeTypeFromExt,
  voxtaToStandard,
  standardToVoxta,
} from '@card-architect/utils';

import type { CharxData, CCv3Data, Card } from '@card-architect/schemas';

// Re-export types for consumers (with Buffer-based types where needed)
export interface CharxExtractionOptions extends CharxPackageExtractionOptions {
  fetchRemoteAssets?: boolean; // Whether to download remote (http/https) assets
}
export type { VoxtaExtractionOptions };
export type { ExtractedVoxtaBook };

export interface CharxBuildOptions extends CharxPackageBuildOptions {
  storagePath: string;
  /** Optional media optimization settings */
  optimization?: {
    enabled: boolean;
    convertToWebp: boolean;
    webpQuality: number;
    maxMegapixels: number;
    stripMetadata: boolean;
    convertMp4ToWebm?: boolean;
    webmQuality?: number;
    includedAssetTypes?: string[];
  };
}

export interface CharxBuildResult {
  buffer: Buffer;
  assetCount: number;
  totalSize: number;
}

export interface VoxtaBuildOptions extends VoxtaPackageBuildOptions {
  storagePath: string;
  /** Optional media optimization settings */
  optimization?: {
    enabled: boolean;
    convertToWebp: boolean;
    webpQuality: number;
    maxMegapixels: number;
    stripMetadata: boolean;
    convertMp4ToWebm?: boolean;
    webmQuality?: number;
    includedAssetTypes?: string[];
  };
}

export interface VoxtaBuildResult {
  buffer: Buffer;
  assetCount: number;
  totalSize: number;
  characterId: string;
}

// Buffer-based versions of the package types
export interface ExtractedVoxtaAsset {
  path: string;
  buffer: Buffer;
  characterId?: string;
}

export interface ExtractedVoxtaCharacter {
  id: string;
  data: PackageVoxtaCharacter['data'];
  thumbnail?: Buffer;
  assets: ExtractedVoxtaAsset[];
}

export interface ExtractedVoxtaScenario {
  id: string;
  data: PackageVoxtaScenario['data'];
  thumbnail?: Buffer;
}

export interface VoxtaData {
  package?: VoxtaPackageData['package'];
  characters: ExtractedVoxtaCharacter[];
  scenarios: ExtractedVoxtaScenario[];
  books: ExtractedVoxtaBook[];
}

// Re-export utilities
export {
  getMimeTypeFromExt,
  voxtaToStandard,
  standardToVoxta,
  voxtaToCCv3,
  ccv3ToVoxta,
  ccv3LorebookToVoxtaBook,
};

/**
 * Check if a buffer is a ZIP file
 */
export function isZipBuffer(buffer: Buffer): boolean {
  return isZipBufferUtil(new Uint8Array(buffer));
}

/**
 * Find ZIP start in a buffer (for SFX archives)
 */
export function findZipStart(buffer: Buffer): Buffer {
  const result = findZipStartUtil(new Uint8Array(buffer));
  return Buffer.from(result);
}

/**
 * Default asset fetcher using Node.js fetch
 */
const defaultAssetFetcher: AssetFetcher = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[CHARX] Failed to fetch ${url}: ${response.status}`);
      return undefined;
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.warn(`[CHARX] Failed to fetch ${url}: ${err}`);
    return undefined;
  }
};

/**
 * Extract CHARX from a file path
 */
export async function extractCharx(
  filePath: string,
  options?: CharxExtractionOptions
): Promise<CharxData> {
  const buffer = await fs.readFile(filePath);

  // Use async extraction if remote fetching is enabled
  const data = options?.fetchRemoteAssets
    ? await extractCharxBufferAsync(new Uint8Array(buffer), {
        ...options,
        fetchRemoteAssets: true,
        assetFetcher: defaultAssetFetcher,
      })
    : extractCharxBuffer(new Uint8Array(buffer), options);

  // Convert Uint8Array buffers back to Buffer for API compatibility
  return {
    ...data,
    assets: data.assets.map((asset) => ({
      ...asset,
      buffer: asset.buffer ? Buffer.from(asset.buffer) : undefined,
    })),
    moduleRisum: data.moduleRisum ? Buffer.from(data.moduleRisum) : undefined,
  };
}

/**
 * Build CHARX and return Buffer
 */
export async function buildCharx(
  card: CCv3Data,
  assets: Array<{ type: string; name: string; ext: string; asset: { url: string; mimetype: string }; isMain?: boolean }>,
  options: CharxBuildOptions
): Promise<CharxBuildResult> {
  // Load asset buffers from storage
  const assetData: CharxWriteAsset[] = [];
  let totalSaved = 0;

  // Filter assets by included types (empty array = include all)
  const includedTypes = options.optimization?.includedAssetTypes || [];
  const filteredAssets = includedTypes.length > 0
    ? assets.filter(a => {
        // Always include main icon regardless of filter
        if (a.type === 'icon' && a.isMain) return true;
        return includedTypes.includes(a.type);
      })
    : assets;

  if (includedTypes.length > 0) {
    console.log(`[CHARX Build] Filtering assets: including types [${includedTypes.join(', ')}], ${filteredAssets.length}/${assets.length} assets`);
  }

  for (const asset of filteredAssets) {
    // Parse storage URL to get file path
    const url = asset.asset.url;
    let filePath: string;

    if (url.startsWith('/storage/')) {
      // Format: /storage/{cardId}/{filename} or /storage/{filename}
      const relativePath = url.replace('/storage/', '');
      filePath = join(options.storagePath, relativePath);
    } else {
      // Skip non-storage URLs (remote assets, ccdefault, etc)
      continue;
    }

    try {
      let buffer: Buffer = await fs.readFile(filePath);
      let ext = asset.ext;

      // Apply optimization if enabled
      if (options.optimization?.enabled) {
        const optimized = await optimizeMedia(buffer, {
          convertToWebp: options.optimization.convertToWebp,
          webpQuality: options.optimization.webpQuality,
          maxMegapixels: options.optimization.maxMegapixels,
          stripMetadata: options.optimization.stripMetadata,
          convertMp4ToWebm: options.optimization.convertMp4ToWebm ?? false,
          webmQuality: options.optimization.webmQuality ?? 30,
          includedAssetTypes: [],
        }, ext);

        buffer = Buffer.from(optimized.buffer);
        ext = optimized.ext;
        totalSaved += optimized.originalSize - optimized.optimizedSize;
      }

      assetData.push({
        type: asset.type,
        name: asset.name,
        ext,
        data: new Uint8Array(buffer),
        isMain: asset.isMain,
      });
    } catch (err) {
      console.warn(`[CHARX Build] Failed to read asset ${asset.name}: ${err}`);
    }
  }

  if (totalSaved > 0) {
    console.log(`[CHARX Build] Media optimization saved ${(totalSaved / 1024).toFixed(1)} KB`);
  }

  const result = buildCharxBuffer(card, assetData, options);

  return {
    buffer: Buffer.from(result.buffer),
    assetCount: result.assetCount,
    totalSize: result.totalSize,
  };
}

/**
 * Extract Voxta package from a file path
 */
export async function extractVoxtaPackage(
  filePath: string,
  options?: VoxtaExtractionOptions
): Promise<VoxtaData> {
  const buffer = await fs.readFile(filePath);
  const data = extractVoxtaBuffer(new Uint8Array(buffer), options);

  // Convert Uint8Array buffers back to Buffer for API compatibility
  return {
    ...data,
    characters: data.characters.map((char) => ({
      ...char,
      thumbnail: char.thumbnail ? Buffer.from(char.thumbnail) : undefined,
      assets: char.assets.map((asset) => ({
        ...asset,
        buffer: Buffer.from(asset.buffer),
      })),
    })),
    scenarios: data.scenarios.map((scenario) => ({
      ...scenario,
      thumbnail: scenario.thumbnail ? Buffer.from(scenario.thumbnail) : undefined,
    })),
  };
}

/**
 * Build Voxta package and return Buffer
 */
export async function buildVoxtaPackage(
  card: CCv3Data,
  assets: Array<{ type: string; name: string; ext: string; asset: { url: string }; tags?: string[]; isMain?: boolean }>,
  options: VoxtaBuildOptions
): Promise<VoxtaBuildResult> {
  // Load asset buffers from storage
  const assetData: VoxtaWriteAsset[] = [];
  let totalSaved = 0;

  // Filter assets by included types (empty array = include all)
  const includedTypes = options.optimization?.includedAssetTypes || [];
  const filteredAssets = includedTypes.length > 0
    ? assets.filter(a => {
        // Always include main icon regardless of filter
        if (a.type === 'icon' && (a.isMain || a.name === 'main')) return true;
        return includedTypes.includes(a.type);
      })
    : assets;

  if (includedTypes.length > 0) {
    console.log(`[Voxta Build] Filtering assets: including types [${includedTypes.join(', ')}], ${filteredAssets.length}/${assets.length} assets`);
  }

  for (const asset of filteredAssets) {
    const url = asset.asset.url;
    let filePath: string;

    if (url.startsWith('/storage/')) {
      const relativePath = url.replace('/storage/', '');
      filePath = join(options.storagePath, relativePath);
    } else {
      continue;
    }

    try {
      let buffer: Buffer = await fs.readFile(filePath);
      let ext = asset.ext;

      // Apply optimization if enabled
      if (options.optimization?.enabled) {
        const optimized = await optimizeMedia(buffer, {
          convertToWebp: options.optimization.convertToWebp,
          webpQuality: options.optimization.webpQuality,
          maxMegapixels: options.optimization.maxMegapixels,
          stripMetadata: options.optimization.stripMetadata,
          convertMp4ToWebm: options.optimization.convertMp4ToWebm ?? false,
          webmQuality: options.optimization.webmQuality ?? 30,
          includedAssetTypes: [],
        }, ext);

        buffer = Buffer.from(optimized.buffer);
        ext = optimized.ext;
        totalSaved += optimized.originalSize - optimized.optimizedSize;
      }

      assetData.push({
        type: asset.type,
        name: asset.name,
        ext,
        data: new Uint8Array(buffer),
        tags: asset.tags,
        isMain: asset.isMain || asset.name === 'main',
      });
    } catch (err) {
      console.warn(`[Voxta Build] Failed to read asset ${asset.name}: ${err}`);
    }
  }

  if (totalSaved > 0) {
    console.log(`[Voxta Build] Media optimization saved ${(totalSaved / 1024).toFixed(1)} KB`);
  }

  const result = buildVoxtaBuffer(card, assetData, options);

  return {
    buffer: Buffer.from(result.buffer),
    assetCount: result.assetCount,
    totalSize: result.totalSize,
    characterId: result.characterId,
  };
}

/**
 * PNG text chunk extraction result (with Buffer)
 */
export interface PNGExtractResult {
  data: unknown;
  spec: 'v2' | 'v3';
  extraChunks?: Array<{ keyword: string; text: string }>;
}

/**
 * Extract card data from PNG buffer
 */
export async function extractFromPNG(buffer: Buffer): Promise<PNGExtractResult | null> {
  const result = extractFromPNGBuffer(new Uint8Array(buffer));
  if (!result) return null;

  return {
    data: result.data,
    spec: result.spec,
    extraChunks: result.extraChunks.length > 0 ? result.extraChunks : undefined,
  };
}

/**
 * Validate PNG size
 */
export function validatePNGSize(
  buffer: Buffer,
  options: { max: number; warn: number }
): { valid: boolean; warnings: string[] } {
  return validatePNGSizeBuffer(new Uint8Array(buffer), options);
}

/**
 * Create PNG with embedded card data
 */
export async function createCardPNG(
  imageBuffer: Buffer,
  card: Card
): Promise<Buffer> {
  const result = createCardPNGBuffer(new Uint8Array(imageBuffer), card);
  return Buffer.from(result);
}

/**
 * Quick validation of CHARX structure before export
 */
export function validateCharxBuild(
  card: CCv3Data,
  assets: Array<{ type: string; isMain?: boolean }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for CCv3 spec
  if (card.spec !== 'chara_card_v3') {
    errors.push('Card must be CCv3 format for CHARX export');
  }

  // Check for at least one asset
  if (assets.length === 0) {
    errors.push('CHARX files should contain at least one asset');
  }

  // Check for main icon
  const hasMainIcon = assets.some((a) => a.type === 'icon' && a.isMain);
  if (!hasMainIcon) {
    errors.push('CHARX files should have a main icon asset');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if card data is from Voxta (has voxta extension)
 */
export function isVoxtaCard(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Check for voxta extension in CCv3 data
  if ('data' in obj && typeof obj.data === 'object' && obj.data !== null) {
    const dataObj = obj.data as Record<string, unknown>;
    if ('extensions' in dataObj && typeof dataObj.extensions === 'object' && dataObj.extensions !== null) {
      const ext = dataObj.extensions as Record<string, unknown>;
      return 'voxta' in ext;
    }
  }

  return false;
}

/**
 * Convert macros in card data recursively
 */
export function convertCardMacros(
  data: Record<string, unknown>,
  converter: (text: string) => string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result[key] = converter(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === 'string') {
          return converter(item);
        } else if (typeof item === 'object' && item !== null) {
          return convertCardMacros(item as Record<string, unknown>, converter);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = convertCardMacros(value as Record<string, unknown>, converter);
    } else {
      result[key] = value;
    }
  }

  return result;
}
