/**
 * Media Optimization Utilities
 *
 * Provides image and video optimization for CHARX/Voxta exports and web import.
 * Supports WebP conversion, MP4 to WebM conversion, resizing, and metadata stripping.
 */

import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { CharxExportSettings } from '@card-architect/schemas';

const execAsync = promisify(exec);

export interface OptimizedMedia {
  buffer: Buffer;
  mimetype: string;
  ext: string;
  width?: number;
  height?: number;
  originalSize: number;
  optimizedSize: number;
}

// Alias for backwards compatibility
export type OptimizedImage = OptimizedMedia;

/**
 * Default optimization settings
 */
export const DEFAULT_OPTIMIZATION_SETTINGS: CharxExportSettings = {
  convertToWebp: true,
  webpQuality: 85,
  maxMegapixels: 4,
  stripMetadata: true,
  convertMp4ToWebm: false,
  webmQuality: 30,
  includedAssetTypes: [],
};

/**
 * Optimize an image buffer based on settings
 *
 * @param buffer - The input image buffer
 * @param settings - Optimization settings
 * @param originalExt - Original file extension (for format detection)
 */
export async function optimizeImage(
  buffer: Buffer,
  settings: CharxExportSettings,
  originalExt?: string
): Promise<OptimizedImage> {
  const originalSize = buffer.length;

  // Get metadata
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const megapixels = (width * height) / 1_000_000;

  // Start building the pipeline
  let pipeline = sharp(buffer);

  // Resize if over max megapixels
  if (settings.maxMegapixels > 0 && megapixels > settings.maxMegapixels) {
    const scale = Math.sqrt(settings.maxMegapixels / megapixels);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);
    pipeline = pipeline.resize(newWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Strip metadata if requested
  if (settings.stripMetadata) {
    pipeline = pipeline.rotate(); // Auto-rotates based on EXIF, then strips EXIF
  }

  // Determine output format
  const isPng = originalExt?.toLowerCase() === 'png' || metadata.format === 'png';
  const isGif = originalExt?.toLowerCase() === 'gif' || metadata.format === 'gif';

  // Don't convert GIFs (animated content)
  if (isGif) {
    const outputBuffer = await pipeline.toBuffer();
    return {
      buffer: outputBuffer,
      mimetype: 'image/gif',
      ext: 'gif',
      width: metadata.width,
      height: metadata.height,
      originalSize,
      optimizedSize: outputBuffer.length,
    };
  }

  // Convert PNG to WebP if enabled
  if (settings.convertToWebp && isPng) {
    const outputBuffer = await pipeline
      .webp({ quality: settings.webpQuality })
      .toBuffer();

    return {
      buffer: outputBuffer,
      mimetype: 'image/webp',
      ext: 'webp',
      width: metadata.width,
      height: metadata.height,
      originalSize,
      optimizedSize: outputBuffer.length,
    };
  }

  // For JPEGs or when WebP conversion is disabled, optimize in original format
  if (metadata.format === 'jpeg' || !isPng) {
    const outputBuffer = await pipeline
      .jpeg({ quality: settings.webpQuality, mozjpeg: true })
      .toBuffer();

    return {
      buffer: outputBuffer,
      mimetype: 'image/jpeg',
      ext: 'jpg',
      width: metadata.width,
      height: metadata.height,
      originalSize,
      optimizedSize: outputBuffer.length,
    };
  }

  // Keep as PNG but optimize
  const outputBuffer = await pipeline
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    buffer: outputBuffer,
    mimetype: 'image/png',
    ext: 'png',
    width: metadata.width,
    height: metadata.height,
    originalSize,
    optimizedSize: outputBuffer.length,
  };
}

/**
 * Calculate potential savings from optimization
 */
export function calculateSavings(originalSize: number, optimizedSize: number): {
  savedBytes: number;
  savedPercent: number;
} {
  const savedBytes = originalSize - optimizedSize;
  const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0;
  return { savedBytes, savedPercent };
}

/**
 * Format bytes as human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Check if ffmpeg is available on the system
 */
let ffmpegAvailable: boolean | null = null;

async function checkFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;

  try {
    await execAsync('ffmpeg -version');
    ffmpegAvailable = true;
    console.log('[Media Optimizer] ffmpeg is available for video conversion');
  } catch {
    ffmpegAvailable = false;
    console.log('[Media Optimizer] ffmpeg not found, video conversion will be skipped');
  }
  return ffmpegAvailable;
}

/**
 * Convert MP4 video to WebM format using ffmpeg
 *
 * @param buffer - The input MP4 buffer
 * @param quality - CRF quality value (0-63, lower is better quality, default 30)
 */
export async function convertMp4ToWebm(
  buffer: Buffer,
  quality: number = 30
): Promise<OptimizedMedia> {
  const originalSize = buffer.length;

  // Check if ffmpeg is available
  const hasFfmpeg = await checkFfmpeg();
  if (!hasFfmpeg) {
    // Return original if ffmpeg is not available
    return {
      buffer,
      mimetype: 'video/mp4',
      ext: 'mp4',
      originalSize,
      optimizedSize: buffer.length,
    };
  }

  // Create temp files
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = join(tmpdir(), `input-${tempId}.mp4`);
  const outputPath = join(tmpdir(), `output-${tempId}.webm`);

  try {
    // Write input file
    await fs.writeFile(inputPath, buffer);

    // Convert using ffmpeg
    // -crf: Quality (0-63, lower is better)
    // -b:v 0: Use constant quality mode
    // -c:v libvpx-vp9: Use VP9 codec for WebM
    // -c:a libopus: Use Opus for audio
    const cmd = `ffmpeg -i "${inputPath}" -c:v libvpx-vp9 -crf ${quality} -b:v 0 -c:a libopus -y "${outputPath}"`;

    await execAsync(cmd, { timeout: 120000 }); // 2 minute timeout

    // Read output file
    const outputBuffer = await fs.readFile(outputPath);

    console.log(`[Media Optimizer] MP4->WebM: ${formatBytes(originalSize)} -> ${formatBytes(outputBuffer.length)} (${((1 - outputBuffer.length / originalSize) * 100).toFixed(1)}% reduction)`);

    return {
      buffer: outputBuffer,
      mimetype: 'video/webm',
      ext: 'webm',
      originalSize,
      optimizedSize: outputBuffer.length,
    };
  } catch (err) {
    console.error('[Media Optimizer] MP4->WebM conversion failed:', err);
    // Return original on failure
    return {
      buffer,
      mimetype: 'video/mp4',
      ext: 'mp4',
      originalSize,
      optimizedSize: buffer.length,
    };
  } finally {
    // Clean up temp files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

/**
 * Optimize any media file (image or video)
 */
export async function optimizeMedia(
  buffer: Buffer,
  settings: CharxExportSettings,
  originalExt?: string
): Promise<OptimizedMedia> {
  const ext = originalExt?.toLowerCase();

  // Handle MP4 video conversion
  if (ext === 'mp4' && settings.convertMp4ToWebm) {
    return convertMp4ToWebm(buffer, settings.webmQuality);
  }

  // Handle images
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];
  if (ext && imageExts.includes(ext)) {
    return optimizeImage(buffer, settings, ext);
  }

  // Return unchanged for unsupported formats
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    json: 'application/json',
  };

  return {
    buffer,
    mimetype: mimeMap[ext || ''] || 'application/octet-stream',
    ext: ext || 'bin',
    originalSize: buffer.length,
    optimizedSize: buffer.length,
  };
}
