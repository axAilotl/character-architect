/**
 * Client-side card export
 *
 * Used in light/static deployment modes where there's no server.
 * Exports cards as JSON, PNG, or CHARX directly in the browser.
 */

import { embedIntoPNG } from '@character-foundry/character-foundry/png';
import { writeCharX as buildCharx, type CharxWriteAsset } from '@character-foundry/character-foundry/charx';
import { writeVoxta as buildVoxtaPackage, type VoxtaWriteAsset } from '@character-foundry/character-foundry/voxta';
import type { Card, CCv2Data, CCv3Data, CollectionData } from './types';
import { isCollectionData } from './types';
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
 * Detect image format from buffer magic bytes
 */
function detectImageFormat(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | 'gif' | 'unknown' {
  if (bytes.length < 4) return 'unknown';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes.length >= 12) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  return 'unknown';
}

/**
 * Load an image from a URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Convert non-PNG image bytes to PNG using Canvas API
 */
async function convertToPNG(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  // Create ArrayBuffer-backed Uint8Array for Blob compatibility
  const arrayBuffer = new ArrayBuffer(bytes.length);
  const blobBytes = new Uint8Array(arrayBuffer);
  blobBytes.set(bytes);

  const blob = new Blob([blobBytes], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(img, 0, 0);

    const pngBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Failed to convert to PNG')), 'image/png')
    );
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Export card as PNG with embedded character data
 * Converts non-PNG images (WebP, JPEG, GIF) to PNG before embedding
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
    let imageBytes = dataURLToUint8Array(imageData);
    const format = detectImageFormat(imageBytes);
    console.log('[client-export] Detected image format:', format, 'buffer size:', imageBytes.length);

    // Convert non-PNG images to PNG
    if (format !== 'png') {
      const mimeType = format === 'jpeg' ? 'image/jpeg'
                     : format === 'webp' ? 'image/webp'
                     : format === 'gif' ? 'image/gif'
                     : 'application/octet-stream';
      console.log('[client-export] Converting', format, 'to PNG');
      imageBytes = await convertToPNG(imageBytes, mimeType);
      console.log('[client-export] Converted PNG buffer size:', imageBytes.length);
    }

    pngBuffer = imageBytes;
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

  // Collect assets from IndexedDB
  const assets: CharxWriteAsset[] = [];
  const storedAssets = await localDB.getAssetsByCard(card.meta.id);
  console.log(`[client-export] Found ${storedAssets.length} assets for CHARX export`);

  // Add all stored assets
  for (const asset of storedAssets) {
    if (asset.data) {
      assets.push({
        type: asset.type as CharxWriteAsset['type'],
        name: asset.name,
        ext: asset.ext,
        data: dataURLToUint8Array(asset.data),
        isMain: asset.isMain,
      });
    }
  }

  // If no icon asset, fallback to wrapper image
  const hasIcon = storedAssets.some(a => a.type === 'icon' || a.isMain);
  if (!hasIcon) {
    // Get the wrapper icon image as fallback
    let imageData = await localDB.getImage(card.meta.id, 'icon');
    if (!imageData) {
      imageData = await localDB.getImage(card.meta.id, 'thumbnail');
    }

    if (imageData) {
      const buffer = dataURLToUint8Array(imageData);
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
      console.log('[client-export] Added wrapper image as fallback icon');
    }
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
 * Export card as Voxta package (.voxpkg)
 *
 * IMPORTANT: Voxta packages should NOT include a main icon in the Assets folder.
 * Voxta handles thumbnails separately at the character root level (thumbnail.xxx).
 * Main icon is only for CHARX/PNG exports.
 */
export async function exportCardAsVoxta(card: Card): Promise<Blob> {
  // Get card data - convert to V3 if needed
  let v3Data: CCv3Data;
  if (card.meta.spec === 'v3') {
    v3Data = card.data as CCv3Data;
  } else {
    // Convert V2 to V3 for Voxta
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

  // Collect assets from IndexedDB
  // Include main icon - the voxta writer will use it as thumbnail only, not add to Assets folder
  const assets: VoxtaWriteAsset[] = [];
  const storedAssets = await localDB.getAssetsByCard(card.meta.id);
  console.log(`[client-export] Found ${storedAssets.length} assets for Voxta export`);

  // Add all stored assets including main icon (writer handles thumbnail vs Assets placement)
  for (const asset of storedAssets) {
    if (asset.data) {
      assets.push({
        type: asset.type as VoxtaWriteAsset['type'],
        name: asset.name,
        ext: asset.ext,
        data: dataURLToUint8Array(asset.data),
        isMain: asset.isMain,
      });
    }
  }

  // If no icon asset exists, try to use the wrapper image as main icon for thumbnail
  const hasIcon = storedAssets.some(a => a.type === 'icon');
  if (!hasIcon) {
    let imageData = await localDB.getImage(card.meta.id, 'icon');
    if (!imageData) {
      imageData = await localDB.getImage(card.meta.id, 'thumbnail');
    }

    if (imageData) {
      const buffer = dataURLToUint8Array(imageData);
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
      console.log('[client-export] Added wrapper image as main icon for Voxta thumbnail');
    }
  }

  console.log(`[client-export] Exporting ${assets.length} assets to Voxta`);

  // Build Voxta package (takes CCv3Data directly, converts internally)
  const result = buildVoxtaPackage(v3Data, assets);

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
 * Export a collection card as Voxta package
 * Uses the original .voxpkg bytes stored as an asset if available.
 * Falls back to exporting first member card if no original is stored.
 */
export async function exportCollectionAsVoxta(card: Card): Promise<Blob> {
  if (!isCollectionData(card.data)) {
    throw new Error('Not a collection card');
  }

  const collectionData = card.data as CollectionData;

  // Try to find the original package asset
  const assets = await localDB.getAssetsByCard(card.meta.id);
  const originalPackageAsset = assets.find(a => a.type === 'package-original');

  if (originalPackageAsset && originalPackageAsset.data) {
    // Return the original package bytes
    console.log('[client-export] Using original .voxpkg for collection export');
    const packageBytes = dataURLToUint8Array(originalPackageAsset.data);
    // Create a new ArrayBuffer from the Uint8Array for Blob constructor
    const arrayBuffer = new ArrayBuffer(packageBytes.length);
    new Uint8Array(arrayBuffer).set(packageBytes);
    return new Blob([arrayBuffer], { type: 'application/zip' });
  }

  // Fallback: Export first member as a single-character package
  if (collectionData.members.length > 0) {
    const firstMemberCard = await localDB.getCard(collectionData.members[0].cardId);
    if (firstMemberCard) {
      console.log('[client-export] No original package found, exporting first member');
      return exportCardAsVoxta(firstMemberCard);
    }
  }

  throw new Error('Collection has no members to export');
}

/**
 * Export card in specified format and trigger download
 */
export async function exportCard(
  card: Card,
  format: 'json' | 'png' | 'charx' | 'voxta'
): Promise<void> {
  let filename = `${card.meta.name || 'character'}.${format}`;
  if (format === 'voxta') {
    filename = `${card.meta.name || 'character'}.voxpkg`;
  }

  // Handle collection cards
  if (card.meta.spec === 'collection') {
    if (format === 'voxta') {
      const blob = await exportCollectionAsVoxta(card);
      downloadBlob(blob, filename);
      return;
    }
    // Other formats not supported for collections
    throw new Error(`Collection cards can only be exported as Voxta packages`);
  }

  if (format === 'json') {
    const blob = exportCardAsJSON(card);
    downloadBlob(blob, filename);
  } else if (format === 'png') {
    const blob = await exportCardAsPNG(card);
    downloadBlob(blob, filename);
  } else if (format === 'charx') {
    const blob = await exportCardAsCHARX(card);
    downloadBlob(blob, filename);
  } else if (format === 'voxta') {
    const blob = await exportCardAsVoxta(card);
    downloadBlob(blob, filename);
  }
}
