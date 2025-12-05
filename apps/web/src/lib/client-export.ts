/**
 * Client-side card export
 *
 * Used in light/static deployment modes where there's no server.
 * Exports cards as JSON, PNG, or CHARX directly in the browser.
 */

import { embedIntoPNG } from '@card-architect/png';
import { buildCharx, type CharxWriteAsset } from '@card-architect/charx';
import type { Card, CCv2Data, CCv3Data } from '@card-architect/schemas';
import { localDB } from './db';

/**
 * Export card as JSON
 */
export function exportCardAsJSON(card: Card): Blob {
  const json = JSON.stringify(card.data, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Convert data URL to Uint8Array
 */
function dataURLToUint8Array(dataURL: string): Uint8Array {
  const base64 = dataURL.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create a simple 1x1 transparent PNG as fallback
 */
function createPlaceholderPNG(): Uint8Array {
  // Minimal 1x1 transparent PNG (68 bytes)
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, // 8bit RGBA, CRC
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk length + type
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, // compressed data
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, // CRC
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
    0xae, 0x42, 0x60, 0x82, // IEND CRC
  ]);
}

/**
 * Export card as PNG with embedded character data
 */
export async function exportCardAsPNG(card: Card): Promise<Blob> {
  // Get the full original image (icon) for export - NOT the thumbnail
  let imageData = await localDB.getImage(card.meta.id, 'icon');
  console.log('[client-export] Got icon image:', imageData ? `${imageData.length} chars` : 'null');

  // Fallback to thumbnail if icon not available (cards imported before fix)
  if (!imageData) {
    imageData = await localDB.getImage(card.meta.id, 'thumbnail');
    console.log('[client-export] Fallback to thumbnail:', imageData ? `${imageData.length} chars` : 'null');
  }

  let pngBuffer: Uint8Array;

  if (imageData) {
    pngBuffer = dataURLToUint8Array(imageData);
    console.log('[client-export] PNG buffer size:', pngBuffer.length);
  } else {
    // Use placeholder if no image
    console.log('[client-export] Using placeholder PNG');
    pngBuffer = createPlaceholderPNG();
  }

  // Embed character data into PNG
  const cardData = card.data as CCv2Data | CCv3Data;
  const resultBuffer = embedIntoPNG(pngBuffer, cardData);

  // Convert to standard ArrayBuffer-backed Uint8Array for Blob compatibility
  const arrayBuffer = new ArrayBuffer(resultBuffer.length);
  const uint8Result = new Uint8Array(arrayBuffer);
  uint8Result.set(resultBuffer as unknown as ArrayLike<number>);

  return new Blob([uint8Result], { type: 'image/png' });
}

/**
 * Export card as CHARX (ZIP-based format with assets)
 */
export async function exportCardAsCHARX(card: Card): Promise<Blob> {
  // Get card data - convert to V3 if needed
  let v3Data: CCv3Data;
  if (card.meta.spec === 'v3') {
    v3Data = card.data as CCv3Data;
  } else {
    // Convert V2 to V3 for CHARX
    const v2Data = card.data as CCv2Data;
    v3Data = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        ...v2Data,
        creator: v2Data.creator || '',
        character_version: v2Data.character_version || '1.0',
        tags: v2Data.tags || [],
      },
    } as CCv3Data;
  }

  // Collect assets
  const assets: CharxWriteAsset[] = [];

  // Get the main icon image
  let imageData = await localDB.getImage(card.meta.id, 'icon');
  if (!imageData) {
    imageData = await localDB.getImage(card.meta.id, 'thumbnail');
  }

  if (imageData) {
    const buffer = dataURLToUint8Array(imageData);
    // Detect format from data URL
    let ext = 'png';
    if (imageData.startsWith('data:image/webp')) ext = 'webp';
    else if (imageData.startsWith('data:image/jpeg')) ext = 'jpg';

    assets.push({
      type: 'icon',
      name: 'main',
      ext,
      data: buffer,
      isMain: true,
    });
  }

  // Build CHARX
  const result = buildCharx(v3Data, assets);

  // Convert to Blob
  const arrayBuffer = new ArrayBuffer(result.buffer.length);
  const uint8Result = new Uint8Array(arrayBuffer);
  uint8Result.set(result.buffer as unknown as ArrayLike<number>);

  return new Blob([uint8Result], { type: 'application/zip' });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export card in specified format and trigger download
 */
export async function exportCard(
  card: Card,
  format: 'json' | 'png' | 'charx'
): Promise<void> {
  const filename = `${card.meta.name || 'character'}.${format}`;

  if (format === 'json') {
    const blob = exportCardAsJSON(card);
    downloadBlob(blob, filename);
  } else if (format === 'png') {
    const blob = await exportCardAsPNG(card);
    downloadBlob(blob, filename);
  } else if (format === 'charx') {
    const blob = await exportCardAsCHARX(card);
    downloadBlob(blob, filename);
  }
}
