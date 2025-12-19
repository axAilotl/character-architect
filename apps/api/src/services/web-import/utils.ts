/**
 * Web Import Service - Utility Functions
 *
 * Shared utilities for downloading and processing assets.
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

import type {
  WebImportSettings,
  AssetToImport,
  ProcessedImage,
  ProcessedAudio,
  WebImportAssetSettings,
  WyvernGallerySettings,
} from './types.js';
import {
  DEFAULT_CHUB_VOICE_UUIDS,
  APP_USER_AGENT,
} from './constants.js';
import { validateURL } from '../../utils/ssrf-protection.js';

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Download and process an icon or emotion asset from URL
 *
 * @param assetUrl - URL to download from
 * @param type - Asset type (determines processing settings)
 * @param settings - Web import settings
 * @returns Processed image or null if placeholder detected
 */
export async function downloadAndProcessAsset(
  assetUrl: string,
  type: 'icon' | 'emotion',
  settings: WebImportSettings
): Promise<ProcessedImage | null> {
  const config = type === 'icon' ? settings.icons : settings.emotions;

  // SSRF protection: validate URL before fetching
  const urlValidation = validateURL(assetUrl);
  if (!urlValidation.valid) {
    throw new Error(`Asset URL blocked: ${urlValidation.error}`);
  }

  // Download asset
  const response = await fetch(assetUrl, {
    headers: { 'User-Agent': APP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Asset download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Get metadata
  const metadata = await sharp(buffer).metadata();

  // Skip 120x120 emoji placeholders
  if (settings.skipDefaultEmoji && metadata.width === 120 && metadata.height === 120) {
    return null;
  }

  let pipeline = sharp(buffer);

  // Resize if exceeds max megapixels
  if (metadata.width && metadata.height) {
    const megapixels = (metadata.width * metadata.height) / 1_000_000;
    if (megapixels > config.maxMegapixels) {
      const scale = Math.sqrt(config.maxMegapixels / megapixels);
      const newWidth = Math.round(metadata.width * scale);
      pipeline = pipeline.resize(newWidth);
    }
  }

  // Convert to WebP if enabled
  if (config.convertToWebp) {
    return {
      buffer: await pipeline.webp({ quality: config.webpQuality }).toBuffer(),
      mimetype: 'image/webp',
      ext: 'webp',
    };
  }

  // Keep original format
  const format = metadata.format || 'png';
  return {
    buffer: await pipeline.toBuffer(),
    mimetype: `image/${format}`,
    ext: format,
  };
}

/**
 * Download and process image asset with extended type support
 * Handles both URL-based and base64-encoded images
 *
 * @param asset - Asset to process
 * @param settings - Web import settings
 * @returns Processed image or null if placeholder
 */
export async function downloadAndProcessImage(
  asset: AssetToImport,
  settings: WebImportSettings
): Promise<ProcessedImage | null> {
  // Handle base64 data (Wyvern gallery images fetched client-side)
  if (asset.base64Data) {
    const base64Part = asset.base64Data.includes(',')
      ? asset.base64Data.split(',')[1]
      : asset.base64Data;
    const buffer = Buffer.from(base64Part, 'base64');
    const metadata = await sharp(buffer).metadata();

    // Determine config based on type
    const configMap: Record<string, WebImportAssetSettings | WyvernGallerySettings> = {
      icon: settings.icons,
      emotion: settings.emotions,
      background: settings.wyvernGallery,
      custom: settings.wyvernGallery,
    };
    const config = configMap[asset.type] || settings.icons;

    let pipeline = sharp(buffer);

    // Only resize for icons/emotions, not gallery images
    if ((asset.type === 'icon' || asset.type === 'emotion') && 'maxMegapixels' in config) {
      if (metadata.width && metadata.height) {
        const megapixels = (metadata.width * metadata.height) / 1_000_000;
        if (megapixels > config.maxMegapixels) {
          const scale = Math.sqrt(config.maxMegapixels / megapixels);
          const newWidth = Math.round(metadata.width * scale);
          pipeline = pipeline.resize(newWidth);
        }
      }
    }

    // Convert to WebP if enabled
    if (config.convertToWebp) {
      return {
        buffer: await pipeline.webp({ quality: config.webpQuality }).toBuffer(),
        mimetype: 'image/webp',
        ext: 'webp',
      };
    }

    const format = metadata.format || 'png';
    return {
      buffer: await pipeline.toBuffer(),
      mimetype: `image/${format}`,
      ext: format,
    };
  }

  // Fall through to URL-based download for icons/emotions
  if (asset.type === 'icon' || asset.type === 'emotion') {
    return downloadAndProcessAsset(asset.url, asset.type, settings);
  }

  // Download from URL for other types (background, custom)
  // SSRF protection: validate URL before fetching
  const bgUrlValidation = validateURL(asset.url);
  if (!bgUrlValidation.valid) {
    throw new Error(`Asset URL blocked: ${bgUrlValidation.error}`);
  }

  const response = await fetch(asset.url, {
    headers: { 'User-Agent': APP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Asset download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const format = metadata.format || 'png';

  return {
    buffer,
    mimetype: `image/${format}`,
    ext: format,
  };
}

// ============================================================================
// Audio Processing
// ============================================================================

/**
 * Download and process audio asset (wav, mp3)
 * For default Chub voices, checks cache first and caches after download
 *
 * @param assetUrl - URL to download from
 * @param voiceId - Voice UUID for caching
 * @param voiceName - Display name for filename
 * @param modelType - TTS model type (example, e2_example, f5_example, z_example, sample)
 * @param storagePath - Base storage path for caching
 * @returns Processed audio or null if download failed
 */
export async function downloadAndProcessAudio(
  assetUrl: string,
  voiceId: string,
  voiceName: string,
  modelType: string,
  storagePath: string
): Promise<ProcessedAudio | null> {
  if (!assetUrl) return null;

  // Determine extension from URL
  const urlLower = assetUrl.toLowerCase();
  let ext = 'wav';
  let mimetype = 'audio/wav';
  if (urlLower.includes('.mp3')) {
    ext = 'mp3';
    mimetype = 'audio/mpeg';
  }

  const isDefaultVoice = DEFAULT_CHUB_VOICE_UUIDS.has(voiceId);

  // Check cache for default voices
  if (isDefaultVoice) {
    const cacheDir = join(storagePath, 'cache', 'chub-voices', voiceId);
    const cachedFilename = `${modelType}.${ext}`;
    const cachedPath = join(cacheDir, cachedFilename);

    try {
      const cached = await fs.readFile(cachedPath);
      console.log(`[Audio] Using cached default voice: ${voiceId}/${modelType}`);
      return {
        buffer: cached,
        mimetype,
        ext,
        filename: `${voiceName}_${voiceId.slice(0, 8)}_${modelType}.${ext}`,
      };
    } catch {
      // Not cached yet, will download and cache
    }
  }

  // Download the audio
  // SSRF protection: validate URL before fetching
  const audioUrlValidation = validateURL(assetUrl);
  if (!audioUrlValidation.valid) {
    throw new Error(`Audio URL blocked: ${audioUrlValidation.error}`);
  }

  console.log(`[Audio] Downloading: ${assetUrl}`);
  const response = await fetch(assetUrl, {
    headers: { 'User-Agent': APP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Audio download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Cache default voices
  if (isDefaultVoice) {
    const cacheDir = join(storagePath, 'cache', 'chub-voices', voiceId);
    const cachedFilename = `${modelType}.${ext}`;
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(join(cacheDir, cachedFilename), buffer);
    console.log(`[Audio] Cached default voice: ${voiceId}/${modelType}`);
  }

  // Sanitize voice name for filename
  const safeName = voiceName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const filename = `${safeName}_${voiceId.slice(0, 8)}_${modelType}.${ext}`;

  return { buffer, mimetype, ext, filename };
}

// ============================================================================
// Storage
// ============================================================================

/**
 * Save asset buffer to storage
 *
 * @param cardId - Card ID for directory
 * @param buffer - Asset data
 * @param ext - File extension
 * @param storagePath - Base storage path
 * @param subdir - Optional subdirectory (e.g., 'audio', 'emotions')
 * @returns URL path to the stored asset
 */
export async function saveAssetToStorage(
  cardId: string,
  buffer: Buffer,
  ext: string,
  storagePath: string,
  subdir?: string
): Promise<string> {
  const assetId = nanoid();
  const filename = `${assetId}.${ext}`;
  const cardDir = subdir
    ? join(storagePath, cardId, subdir)
    : join(storagePath, cardId);

  await fs.mkdir(cardDir, { recursive: true });
  await fs.writeFile(join(cardDir, filename), buffer);

  return subdir
    ? `/storage/${cardId}/${subdir}/${filename}`
    : `/storage/${cardId}/${filename}`;
}

// ============================================================================
// Card Data Normalization
// ============================================================================

export { normalizeCardData } from '../../handlers/utils/normalization.js';
