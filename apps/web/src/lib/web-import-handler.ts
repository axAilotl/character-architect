/**
 * Web Import Handler
 *
 * Processes pending imports from the userscript.
 * The userscript stores data in localStorage, and this handler
 * picks it up and creates the card in IndexedDB.
 */

import { extractFromPNG, isPNG } from '@card-architect/png';
import type { Card, CCv2Data, CCv3Data } from '@card-architect/schemas';
import { localDB } from './db';

const PENDING_IMPORT_KEY = 'ca-pending-import';

interface PendingImport {
  site: string;
  url: string;
  timestamp: number;
  // For Chub: separate JSON data and avatar
  cardData?: CCv2Data | CCv3Data;
  avatarBase64?: string;
  // For Risu, Character Tavern, Wyvern: PNG with embedded data
  pngBase64?: string;
}

export interface WebImportResult {
  success: boolean;
  cardId?: string;
  name?: string;
  error?: string;
}

/**
 * Convert base64 data URL to Uint8Array
 */
function dataURLToUint8Array(dataURL: string): Uint8Array {
  // Remove data URL prefix if present
  const base64 = dataURL.includes(',') ? dataURL.split(',')[1] : dataURL;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create a thumbnail from image data URL
 * Resizes to max 400px and converts to WebP for smaller storage
 */
async function createThumbnail(imageDataUrl: string, maxSize = 400): Promise<string> {
  console.log('[web-import] createThumbnail starting, input length:', imageDataUrl.length);

  return new Promise((resolve, reject) => {
    const img = new Image();

    const timeout = setTimeout(() => {
      console.error('[web-import] createThumbnail timeout');
      reject(new Error('Thumbnail creation timed out'));
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      console.log('[web-import] Image loaded:', width, 'x', height);

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      console.log('[web-import] Resizing to:', width, 'x', height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      let dataUrl = canvas.toDataURL('image/webp', 0.8);
      console.log('[web-import] Output:', dataUrl.substring(0, 30), 'size:', dataUrl.length);

      if (dataUrl.startsWith('data:image/webp')) {
        resolve(dataUrl);
      } else {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        console.log('[web-import] JPEG fallback size:', dataUrl.length);
        resolve(dataUrl);
      }
    };

    img.onerror = (e) => {
      clearTimeout(timeout);
      console.error('[web-import] Image load error:', e);
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
}

/**
 * Create a Card from parsed data
 */
function createCard(
  data: CCv2Data | CCv3Data,
  spec: 'v2' | 'v3'
): Card {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Extract name from data
  let name = 'Unknown Character';
  if (spec === 'v3') {
    const v3Data = data as CCv3Data;
    name = v3Data.data?.name || 'Unknown Character';
  } else {
    const v2Data = data as CCv2Data;
    // V2 can be wrapped or unwrapped
    if ('data' in v2Data && v2Data.data) {
      name = (v2Data.data as any).name || 'Unknown Character';
    } else {
      name = (v2Data as any).name || 'Unknown Character';
    }
  }

  return {
    meta: {
      id,
      name,
      spec,
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    data,
  };
}

/**
 * Process a pending web import from localStorage
 */
export async function processPendingWebImport(): Promise<WebImportResult> {
  // Get pending import from localStorage
  const pendingJson = localStorage.getItem(PENDING_IMPORT_KEY);
  if (!pendingJson) {
    return { success: false, error: 'No pending import found' };
  }

  // Clear the pending import immediately to prevent duplicate processing
  localStorage.removeItem(PENDING_IMPORT_KEY);

  let pending: PendingImport;
  try {
    pending = JSON.parse(pendingJson);
  } catch (err) {
    return { success: false, error: 'Invalid import data format' };
  }

  // Check if import is stale (more than 5 minutes old)
  if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
    return { success: false, error: 'Import data expired. Please try again.' };
  }

  try {
    let card: Card;
    let fullImageDataUrl: string | undefined;
    let thumbnailDataUrl: string | undefined;

    if (pending.pngBase64) {
      // PNG with embedded character data (Risu, Character Tavern, Wyvern)
      const buffer = dataURLToUint8Array(pending.pngBase64);

      if (!isPNG(buffer)) {
        return { success: false, error: 'Invalid PNG data' };
      }

      const result = extractFromPNG(buffer);
      if (!result) {
        return { success: false, error: 'PNG does not contain character card data' };
      }

      card = createCard(result.data, result.spec);
      // Keep full PNG for export
      fullImageDataUrl = pending.pngBase64;
      // Create smaller WebP thumbnail for display
      try {
        thumbnailDataUrl = await createThumbnail(pending.pngBase64);
      } catch {
        thumbnailDataUrl = pending.pngBase64; // Fallback to full image
      }

    } else if (pending.cardData) {
      // JSON card data with optional separate avatar (Chub)
      const data = pending.cardData;

      // Detect spec version
      const isV3 = (data as any).spec === 'chara_card_v3';
      card = createCard(data, isV3 ? 'v3' : 'v2');

      if (pending.avatarBase64) {
        // Keep full image for export
        fullImageDataUrl = pending.avatarBase64;
        // Create smaller WebP thumbnail for display
        try {
          thumbnailDataUrl = await createThumbnail(pending.avatarBase64);
        } catch {
          thumbnailDataUrl = pending.avatarBase64; // Fallback to full image
        }
      }

    } else {
      return { success: false, error: 'No card data in import' };
    }

    // Save card to IndexedDB
    await localDB.saveCard(card);

    // Save full image for export (icon) and thumbnail for display
    if (fullImageDataUrl) {
      await localDB.saveImage(card.meta.id, 'icon', fullImageDataUrl);
    }
    if (thumbnailDataUrl) {
      await localDB.saveImage(card.meta.id, 'thumbnail', thumbnailDataUrl);
    }

    return {
      success: true,
      cardId: card.meta.id,
      name: card.meta.name,
    };

  } catch (err) {
    console.error('[WebImport] Processing failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Import processing failed',
    };
  }
}

/**
 * Check if there's a pending import
 */
export function hasPendingImport(): boolean {
  return localStorage.getItem(PENDING_IMPORT_KEY) !== null;
}

/**
 * Clear any pending import
 */
export function clearPendingImport(): void {
  localStorage.removeItem(PENDING_IMPORT_KEY);
}
