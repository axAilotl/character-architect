/**
 * Asset Processor
 *
 * Handles asset processing (dimensions, animated detection, tag extraction)
 * Browser-safe: uses createImageBitmap for dimensions when sharp unavailable
 */

import type { ParsedAsset } from '../types/index.js';

// Lazy-load sharp only in Node.js
let sharpModule: typeof import('sharp') | null = null;
async function getSharp() {
  if (sharpModule === null && typeof window === 'undefined') {
    try {
      sharpModule = (await import('sharp')).default;
    } catch {
      // sharp not available (browser or not installed)
    }
  }
  return sharpModule;
}

/**
 * Get image dimensions (browser-safe)
 */
async function getImageDimensions(buffer: Buffer | Uint8Array, mimetype: string): Promise<{ width?: number; height?: number }> {
  // Try sharp first (Node.js)
  const sharp = await getSharp();
  if (sharp) {
    try {
      const buf = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
      const metadata = await sharp(buf).metadata();
      return { width: metadata.width, height: metadata.height };
    } catch {
      // Fall through to browser method
    }
  }

  // Browser fallback using createImageBitmap
  if (typeof createImageBitmap !== 'undefined') {
    try {
      // Convert to plain Uint8Array for Blob compatibility
      const arr = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const blob = new Blob([arr as BlobPart], { type: mimetype });
      const bitmap = await createImageBitmap(blob);
      const result = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return result;
    } catch {
      // Failed to decode
    }
  }

  return {};
}

/**
 * Process an asset (calculate dimensions, detect animation, etc.)
 */
export async function processAsset(asset: ParsedAsset): Promise<ParsedAsset> {
  // Calculate dimensions if image
  if (asset.mimetype.startsWith('image/') && !asset.width && !asset.height) {
    try {
      const dims = await getImageDimensions(asset.buffer, asset.mimetype);
      asset.width = dims.width;
      asset.height = dims.height;
    } catch (err) {
      console.warn(`[Asset Processor] Failed to get dimensions for ${asset.filename}:`, err);
    }
  }

  // Detect animated assets (WebP, GIF)
  if ((asset.mimetype === 'image/webp' || asset.mimetype === 'image/gif') && !asset.link.tags.includes('animated')) {
    if (await detectAnimated(asset.buffer, asset.mimetype)) {
      asset.link.tags.push('animated');
    }
  }

  return asset;
}

/**
 * Detect if an image is animated (browser-safe)
 */
async function detectAnimated(buffer: Buffer | Uint8Array, mimetype: string): Promise<boolean> {
  try {
    // Convert to Uint8Array for browser compatibility
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    if (mimetype === 'image/webp') {
      // WebP: Check for ANIM chunk - search for 'ANIM' bytes
      const animBytes = [0x41, 0x4E, 0x49, 0x4D]; // 'ANIM'
      return findSequence(bytes, animBytes);
    }

    if (mimetype === 'image/gif') {
      // GIF: Check for NETSCAPE2.0 extension or multiple graphics control extensions
      const netscapeBytes = [0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30]; // 'NETSCAPE2.0'
      if (findSequence(bytes, netscapeBytes)) return true;

      // Count graphics control extension markers (0x21 0xF9 0x04)
      const gceBytes = [0x21, 0xF9, 0x04];
      let count = 0;
      for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] === gceBytes[0] && bytes[i + 1] === gceBytes[1] && bytes[i + 2] === gceBytes[2]) {
          count++;
          if (count > 1) return true;
        }
      }
    }
  } catch (err) {
    console.warn('[Asset Processor] Animation detection failed:', err);
  }

  return false;
}

/**
 * Find byte sequence in buffer
 */
function findSequence(buffer: Uint8Array, sequence: number[]): boolean {
  for (let i = 0; i <= buffer.length - sequence.length; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      if (buffer[i + j] !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) return true;
  }
  return false;
}
