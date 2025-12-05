/**
 * Client-side card export
 *
 * Used in light/static deployment modes where there's no server.
 * Exports cards as JSON or PNG directly in the browser.
 */

import { embedIntoPNG } from '@card-architect/png';
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

  let pngBuffer: Uint8Array;

  if (imageData) {
    pngBuffer = dataURLToUint8Array(imageData);
  } else {
    // Use placeholder if no image
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
  format: 'json' | 'png'
): Promise<void> {
  const filename = `${card.meta.name || 'character'}.${format}`;

  if (format === 'json') {
    const blob = exportCardAsJSON(card);
    downloadBlob(blob, filename);
  } else if (format === 'png') {
    const blob = await exportCardAsPNG(card);
    downloadBlob(blob, filename);
  }
}
