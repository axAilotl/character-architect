/**
 * Asset Processor
 *
 * Handles asset processing (dimensions, animated detection, tag extraction)
 */

import sharp from 'sharp';
import type { ParsedAsset } from '../types/index.js';

/**
 * Process an asset (calculate dimensions, detect animation, etc.)
 */
export async function processAsset(asset: ParsedAsset): Promise<ParsedAsset> {
  // Calculate dimensions if image
  if (asset.mimetype.startsWith('image/') && !asset.width && !asset.height) {
    try {
      const buffer = asset.buffer instanceof Buffer ? asset.buffer : Buffer.from(asset.buffer);
      const metadata = await sharp(buffer).metadata();
      asset.width = metadata.width;
      asset.height = metadata.height;
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
 * Detect if an image is animated
 */
async function detectAnimated(buffer: Buffer | Uint8Array, mimetype: string): Promise<boolean> {
  try {
    const buf = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

    if (mimetype === 'image/webp') {
      // WebP: Check for ANIM chunk
      const str = buf.toString('binary');
      return str.includes('ANIM');
    }

    if (mimetype === 'image/gif') {
      // GIF: Check for NETSCAPE2.0 extension (looping) or multiple frames
      const str = buf.toString('binary');
      return str.includes('NETSCAPE2.0') || (str.match(/\x21\xF9\x04/g) || []).length > 1;
    }
  } catch (err) {
    console.warn('[Asset Processor] Animation detection failed:', err);
  }

  return false;
}
