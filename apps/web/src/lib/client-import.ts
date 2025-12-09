/**
 * Client-side card import
 *
 * Used in light/static deployment modes where there's no server.
 * Parses PNG, CHARX, and Voxta files directly in the browser.
 */

import { isPNG } from '@character-foundry/png';
import { parseCard as parseCardLoader, getContainerFormat, type ExtractedAsset as LoaderAsset } from '@character-foundry/loader';
import { readVoxta as extractVoxtaPackage, voxtaToCCv3 } from '@character-foundry/voxta';
import type { Card, CCv2Data, CCv3Data, CollectionData, CollectionMember } from './types';

// Asset extracted from CHARX/Voxta for storing in IndexedDB
export interface ExtractedAsset {
  name: string;
  type: string;
  ext: string;
  mimetype: string;
  data: string; // data URL
  size: number;
  width?: number;
  height?: number;
  isMain?: boolean;
  actorIndex?: number;
}

export interface ClientImportResult {
  card: Card;
  fullImageDataUrl?: string; // Original PNG for export
  thumbnailDataUrl?: string; // Small WebP for display
  assets?: ExtractedAsset[]; // Additional assets from CHARX/Voxta
  warnings?: string[];
  /** For collection cards only - indicates this is a collection card */
  isCollection?: boolean;
}

/** Result of importing a Voxta package with multiple characters */
export interface VoxtaCollectionImportResult {
  /** The collection card containing package metadata */
  collection: ClientImportResult;
  /** Individual character cards */
  characters: ClientImportResult[];
  /** Original package bytes for delta export */
  originalPackageAsset: ExtractedAsset;
}

/**
 * Read a File as ArrayBuffer
 */
async function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert Uint8Array to data URL (chunk-safe for large buffers)
 */
function uint8ArrayToDataURL(buffer: Uint8Array, mimeType: string): string {
  // Process in chunks to avoid stack overflow
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Create a thumbnail from image data URL
 * Resizes to max 400px and converts to WebP for smaller storage
 */
async function createThumbnail(imageDataUrl: string, maxSize = 400): Promise<string> {
  console.log('[createThumbnail] Starting, input length:', imageDataUrl.length);
  console.log('[createThumbnail] Input starts with:', imageDataUrl.substring(0, 50));

  return new Promise((resolve, reject) => {
    const img = new Image();

    // Set up a timeout in case the image never loads
    const timeout = setTimeout(() => {
      console.error('[createThumbnail] Timeout waiting for image to load');
      reject(new Error('Thumbnail creation timed out'));
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);
      console.log('[createThumbnail] Image loaded:', img.width, 'x', img.height);
      console.log('[createThumbnail] Natural size:', img.naturalWidth, 'x', img.naturalHeight);

      // Calculate new dimensions maintaining aspect ratio
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      console.log('[createThumbnail] Original dimensions:', width, 'x', height);

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

      console.log('[createThumbnail] Target dimensions:', width, 'x', height);

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      try {
        ctx.drawImage(img, 0, 0, width, height);
        console.log('[createThumbnail] Drew image to canvas');
      } catch (drawErr) {
        console.error('[createThumbnail] Draw error:', drawErr);
        reject(new Error(`Canvas draw failed: ${drawErr}`));
        return;
      }

      // Convert to WebP (with fallback to JPEG for older browsers)
      let dataUrl: string;
      try {
        dataUrl = canvas.toDataURL('image/webp', 0.8);
        console.log('[createThumbnail] Output format:', dataUrl.substring(0, 30));
        console.log('[createThumbnail] Output size:', dataUrl.length);

        if (dataUrl.startsWith('data:image/webp')) {
          resolve(dataUrl);
        } else {
          // Fallback to JPEG if WebP not supported
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          console.log('[createThumbnail] JPEG fallback size:', dataUrl.length);
          resolve(dataUrl);
        }
      } catch (encodeErr) {
        console.error('[createThumbnail] Encoding error:', encodeErr);
        reject(new Error(`Canvas encoding failed: ${encodeErr}`));
      }
    };

    img.onerror = (e) => {
      clearTimeout(timeout);
      console.error('[createThumbnail] Image load error:', e);
      reject(new Error('Failed to load image for thumbnail'));
    };

    // For data URLs, we don't need crossOrigin
    img.src = imageDataUrl;
  });
}

/**
 * Create a Card from parsed data
 */
function createCard(
  data: CCv2Data | CCv3Data,
  spec: 'v2' | 'v3',
  options?: { packageId?: string }
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
      packageId: options?.packageId,
    },
    data,
  };
}

/**
 * Create a Collection card from Voxta package metadata
 */
function createCollectionCard(
  packageData: {
    id?: string;
    name: string;
    description?: string;
    version?: string;
    creator?: string;
    explicitContent?: boolean;
    dateCreated?: string;
    dateModified?: string;
  },
  members: CollectionMember[]
): Card {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const collectionData: CollectionData = {
    name: packageData.name,
    description: packageData.description,
    version: packageData.version,
    creator: packageData.creator,
    voxtaPackageId: packageData.id,
    members,
    explicitContent: packageData.explicitContent,
    dateCreated: packageData.dateCreated,
    dateModified: packageData.dateModified,
  };

  return {
    meta: {
      id,
      name: packageData.name,
      spec: 'collection',
      tags: ['Collection'],
      createdAt: now,
      updatedAt: now,
      memberCount: members.length,
    },
    data: collectionData,
  };
}

/**
 * Process a character from Voxta package and return import result
 */
async function processVoxtaCharacter(
  charData: {
    id: string;
    data: { Name: string; MemoryBooks?: string[] };
    thumbnail?: Uint8Array | ArrayBuffer;
    assets: Array<{ path: string; buffer?: Uint8Array | ArrayBuffer }>;
  },
  books: Array<{ id: string; data: unknown }>,
  packageId?: string
): Promise<ClientImportResult> {
  // Find books referenced by this character
  const referencedBooks = charData.data.MemoryBooks
    ? books
        .filter(b => charData.data.MemoryBooks?.includes(b.id))
        .map(b => b.data)
    : [];

  // Convert Voxta to CCv3
  const ccv3Data = voxtaToCCv3(charData.data as Parameters<typeof voxtaToCCv3>[0], referencedBooks as Parameters<typeof voxtaToCCv3>[1]);
  const card = createCard(ccv3Data, 'v3', { packageId });

  // Process thumbnail if present
  let fullImageDataUrl: string | undefined;
  let thumbnailDataUrl: string | undefined;

  if (charData.thumbnail) {
    // Detect format from buffer
    let mimeType = 'image/png';
    const bytes = charData.thumbnail instanceof Uint8Array ? charData.thumbnail : new Uint8Array(charData.thumbnail);
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      mimeType = 'image/jpeg';
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49) {
      mimeType = 'image/webp';
    }

    fullImageDataUrl = uint8ArrayToDataURL(bytes, mimeType);

    try {
      thumbnailDataUrl = await createThumbnail(fullImageDataUrl);
    } catch {
      thumbnailDataUrl = fullImageDataUrl;
    }
  }

  // Extract assets from Voxta package
  const extractedAssets: ExtractedAsset[] = [];
  if (charData.assets && charData.assets.length > 0) {
    console.log(`[client-import] Extracting ${charData.assets.length} assets from Voxta character ${charData.data.Name}`);
    for (const asset of charData.assets) {
      if (asset.buffer) {
        // Get extension from path
        const pathParts = asset.path.split('/');
        const filename = pathParts[pathParts.length - 1];
        const extMatch = filename.match(/\.([^.]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'bin';

        // Determine MIME type
        let mimeType = 'application/octet-stream';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
          mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        } else if (['mp3', 'wav', 'ogg', 'webm'].includes(ext)) {
          mimeType = `audio/${ext}`;
        } else if (['mp4'].includes(ext)) {
          mimeType = 'video/mp4';
        } else if (ext === 'json') {
          mimeType = 'application/json';
        }

        // Determine asset type from path
        let assetType = 'custom';
        const pathLower = asset.path.toLowerCase();
        if (pathLower.includes('emotion') || pathLower.includes('expression')) {
          assetType = 'emotion';
        } else if (pathLower.includes('background') || pathLower.includes('bg')) {
          assetType = 'background';
        } else if (pathLower.includes('icon') || pathLower.includes('avatar') || pathLower.includes('portrait')) {
          assetType = 'icon';
        } else if (pathLower.includes('audio') || pathLower.includes('voice') || pathLower.includes('sound')) {
          assetType = 'sound';
        }

        const bytes = asset.buffer instanceof Uint8Array ? asset.buffer : new Uint8Array(asset.buffer);
        extractedAssets.push({
          name: filename.replace(/\.[^.]+$/, '') || 'asset',
          type: assetType,
          ext,
          mimetype: mimeType,
          data: uint8ArrayToDataURL(bytes, mimeType),
          size: bytes.length,
          isMain: false,
        });
      }
    }
    console.log(`[client-import] Extracted ${extractedAssets.length} Voxta assets`);
  }

  return {
    card,
    fullImageDataUrl,
    thumbnailDataUrl,
    assets: extractedAssets.length > 0 ? extractedAssets : undefined,
  };
}

/**
 * Import a Voxta package (.voxpkg) client-side
 * For multi-character packages, creates a Collection card plus individual character cards.
 * For single-character packages, returns just the character card.
 */
export async function importVoxtaPackageClientSide(buffer: Uint8Array): Promise<ClientImportResult[]> {
  try {
    console.log('[client-import] Starting Voxta package import, buffer size:', buffer.length);
    console.log('[client-import] @character-foundry/voxta readVoxta function:', typeof extractVoxtaPackage);
    const voxtaData = extractVoxtaPackage(buffer);
    console.log('[client-import] Raw voxtaData.characters[0]:', voxtaData.characters[0] ? {
      id: voxtaData.characters[0].id,
      name: voxtaData.characters[0].data?.Name,
      hasAssets: !!voxtaData.characters[0].assets,
      assetsLength: voxtaData.characters[0].assets?.length,
      assetSample: voxtaData.characters[0].assets?.[0] ? {
        path: voxtaData.characters[0].assets[0].path,
        hasBuffer: !!voxtaData.characters[0].assets[0].buffer,
        bufferType: voxtaData.characters[0].assets[0].buffer?.constructor?.name,
      } : null,
    } : 'no characters');
    console.log('[client-import] Voxta data extracted:', {
      characterCount: voxtaData.characters.length,
      bookCount: voxtaData.books.length,
      scenarioCount: voxtaData.scenarios.length,
      hasPackage: !!voxtaData.package,
      packageName: voxtaData.package?.Name,
    });

    if (voxtaData.characters.length === 0) {
      throw new Error('Voxta package contains no characters');
    }

    const now = new Date().toISOString();
    const results: ClientImportResult[] = [];

    // Determine if this should be a collection (multi-character or has package metadata)
    const isCollection = voxtaData.characters.length > 1 || voxtaData.package !== undefined;
    console.log('[client-import] isCollection:', isCollection, '(chars > 1:', voxtaData.characters.length > 1, ', hasPackage:', !!voxtaData.package, ')');

    if (isCollection) {
      // Process all characters first WITHOUT packageId
      const characterResults: ClientImportResult[] = [];
      const members: CollectionMember[] = [];

      for (let i = 0; i < voxtaData.characters.length; i++) {
        const charData = voxtaData.characters[i];
        console.log(`[client-import] Character ${i}: ${charData.data.Name}, assets count: ${charData.assets?.length || 0}`);
        if (charData.assets && charData.assets.length > 0) {
          console.log(`[client-import] Character ${charData.data.Name} asset paths:`, charData.assets.map(a => a.path));
        }
        const result = await processVoxtaCharacter(
          charData as Parameters<typeof processVoxtaCharacter>[0],
          voxtaData.books as Parameters<typeof processVoxtaCharacter>[1]
        );
        console.log(`[client-import] Character ${charData.data.Name} processed, extracted assets: ${result.assets?.length || 0}`);
        characterResults.push(result);

        // Build member info for collection using actual card IDs
        members.push({
          cardId: result.card.meta.id,
          voxtaCharacterId: charData.id,
          name: result.card.meta.name,
          order: i,
          addedAt: now,
        });
      }

      // Create the collection card with actual member card IDs
      const packageInfo = voxtaData.package;
      const fallbackName = `${voxtaData.characters[0].data.Name} Collection`;
      const fallbackDesc = `Collection of ${voxtaData.characters.length} characters`;

      const collectionCard = createCollectionCard(
        {
          id: packageInfo?.Id,
          name: packageInfo?.Name || fallbackName,
          description: packageInfo?.Description || fallbackDesc,
          version: packageInfo?.Version,
          creator: packageInfo?.Creator,
          explicitContent: packageInfo?.ExplicitContent,
          dateCreated: packageInfo?.DateCreated,
          dateModified: packageInfo?.DateModified,
        },
        members
      );

      // Now update all character cards with the collection's actual ID
      for (const result of characterResults) {
        result.card.meta.packageId = collectionCard.meta.id;
      }

      // Store the original .voxpkg as an asset on the collection
      const originalPackageAsset: ExtractedAsset = {
        name: 'original-package',
        type: 'package-original',
        ext: 'voxpkg',
        mimetype: 'application/octet-stream',
        data: uint8ArrayToDataURL(buffer, 'application/octet-stream'),
        size: buffer.length,
        isMain: false,
      };

      // Get collection thumbnail from package's ThumbnailResource
      let collectionThumb: string | undefined;
      const thumbResource = packageInfo?.ThumbnailResource;
      if (thumbResource?.Kind === 3) {
        // Scenario thumbnail
        const scenario = voxtaData.scenarios.find(s => s.id === thumbResource.Id);
        if (scenario?.thumbnail) {
          collectionThumb = uint8ArrayToDataURL(scenario.thumbnail, 'image/png');
        }
      } else if (thumbResource?.Kind === 1) {
        // Character thumbnail
        const char = voxtaData.characters.find(c => c.id === thumbResource.Id);
        if (char?.thumbnail) {
          collectionThumb = uint8ArrayToDataURL(char.thumbnail, 'image/png');
        }
      }
      // Fallback to first character's thumbnail
      if (!collectionThumb) {
        const firstCharWithThumb = characterResults.find(r => r.thumbnailDataUrl);
        collectionThumb = firstCharWithThumb?.thumbnailDataUrl;
      }

      // Return collection first, then all characters
      results.push({
        card: collectionCard,
        fullImageDataUrl: collectionThumb,
        thumbnailDataUrl: collectionThumb,
        assets: [originalPackageAsset],
        isCollection: true,
      });

      results.push(...characterResults);

      console.log(`[client-import] Created collection "${collectionCard.meta.name}" with ${members.length} characters`);
    } else {
      // Single character - import without collection
      console.log('[client-import] Single character import (no collection)');
      const result = await processVoxtaCharacter(
        voxtaData.characters[0] as Parameters<typeof processVoxtaCharacter>[0],
        voxtaData.books as Parameters<typeof processVoxtaCharacter>[1]
      );
      results.push(result);
    }

    console.log('[client-import] Returning', results.length, 'results, isCollection in first:', results[0]?.isCollection);
    return results;
  } catch (err) {
    throw new Error(`Failed to parse Voxta package: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Convert loader asset to our ExtractedAsset format
 */
function convertLoaderAsset(asset: LoaderAsset): ExtractedAsset {
  const ext = asset.ext || 'bin';
  let mimetype = 'application/octet-stream';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    mimetype = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  } else if (['mp3', 'wav', 'ogg', 'webm'].includes(ext)) {
    mimetype = `audio/${ext}`;
  } else if (['mp4'].includes(ext)) {
    mimetype = 'video/mp4';
  } else if (ext === 'json') {
    mimetype = 'application/json';
  }

  const bytes = asset.data instanceof Uint8Array ? asset.data : new Uint8Array(asset.data);

  return {
    name: asset.name || 'asset',
    type: asset.type === 'data' || asset.type === 'unknown' ? 'custom' : asset.type,
    ext,
    mimetype,
    data: uint8ArrayToDataURL(bytes, mimetype),
    size: bytes.length,
    isMain: asset.isMain ?? (asset.type === 'icon'),
  };
}

/**
 * Import a card file (PNG, CHARX, JSON, or Voxta) client-side
 */
export async function importCardClientSide(file: File): Promise<ClientImportResult> {
  const warnings: string[] = [];
  const buffer = await readFileAsArrayBuffer(file);
  const fileName = file.name.toLowerCase();

  // Use the unified loader for CHARX and PNG files
  const containerFormat = getContainerFormat(buffer);

  if (containerFormat === 'charx' || (containerFormat === 'png' && isPNG(buffer))) {
    try {
      console.log(`[client-import] Using unified loader for ${containerFormat} file`);
      const result = parseCardLoader(buffer, { extractAssets: true });

      // Create card from parsed data
      const card = createCard(result.card, 'v3');
      console.log(`[client-import] Parsed card: ${card.meta.name}, spec: ${result.spec}, source: ${result.sourceFormat}`);

      // Process images - use the isMain icon asset (loader strips tEXt chunks for PNG containers)
      let fullImageDataUrl: string | undefined;
      let thumbnailDataUrl: string | undefined;

      // Find the main icon asset - loader now provides clean PNG without metadata
      const iconAsset = result.assets.find(a => a.type === 'icon' || a.isMain);
      if (iconAsset) {
        const ext = iconAsset.ext || 'png';
        const mimeType = ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        const bytes = iconAsset.data instanceof Uint8Array ? iconAsset.data : new Uint8Array(iconAsset.data);
        fullImageDataUrl = uint8ArrayToDataURL(bytes, mimeType);
        console.log(`[client-import] Using isMain icon asset (${ext}), size: ${fullImageDataUrl.length}`);
        try {
          thumbnailDataUrl = await createThumbnail(fullImageDataUrl);
          console.log('[client-import] Thumbnail size:', thumbnailDataUrl.length);
        } catch (err) {
          console.error('[client-import] Thumbnail creation failed:', err);
          thumbnailDataUrl = fullImageDataUrl;
        }
      }

      // Convert all assets
      const extractedAssets: ExtractedAsset[] = result.assets.map(convertLoaderAsset);
      console.log(`[client-import] Extracted ${extractedAssets.length} assets from ${containerFormat.toUpperCase()}`);

      return {
        card,
        fullImageDataUrl,
        thumbnailDataUrl,
        assets: extractedAssets.length > 0 ? extractedAssets : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err) {
      throw new Error(`Failed to parse ${containerFormat.toUpperCase()}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (fileName.endsWith('.json')) {
    // JSON file
    try {
      const text = new TextDecoder().decode(buffer);
      const json = JSON.parse(text);

      // Detect spec version
      if (json.spec === 'chara_card_v3') {
        const card = createCard(json as CCv3Data, 'v3');
        return { card };
      } else if (json.spec === 'chara_card_v2' || json.name) {
        // V2 or legacy format
        const card = createCard(json as CCv2Data, 'v2');
        return { card };
      } else {
        throw new Error('JSON does not appear to be a character card');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('Invalid JSON file');
      }
      throw err;
    }
  }

  if (fileName.endsWith('.voxpkg')) {
    // Voxta package - this returns the first character only for single import
    // Use importVoxtaPackageClientSide for full multi-character support
    const results = await importVoxtaPackageClientSide(buffer);
    if (results.length === 0) {
      throw new Error('Voxta package contains no characters');
    }
    const first = results[0];
    if (results.length > 1) {
      const additionalWarnings = first.warnings || [];
      additionalWarnings.push(`Package contains ${results.length} characters. Only "${first.card.meta.name}" was imported.`);
      return { ...first, warnings: additionalWarnings };
    }
    return first;
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}

/**
 * Import multiple card files
 */
export async function importCardsClientSide(files: File[]): Promise<{
  cards: Card[];
  errors: Array<{ file: string; error: string }>;
}> {
  const cards: Card[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    try {
      const result = await importCardClientSide(file);
      cards.push(result.card);
    } catch (err) {
      errors.push({
        file: file.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { cards, errors };
}

/**
 * Import a card from URL client-side
 * Fetches the file and processes it like a local file import.
 * Note: CORS restrictions may prevent fetching from some sites.
 */
export async function importCardFromURLClientSide(url: string): Promise<ClientImportResult> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  // Fetch the file
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Failed to fetch URL (CORS may be blocking): ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  // Get the file data
  const arrayBuffer = await response.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Determine file type from URL or content-type
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  const pathname = parsedUrl.pathname.toLowerCase();

  // Determine filename for type detection
  let filename = pathname.split('/').pop() || 'file';

  // Ensure filename has extension based on content type if missing
  if (!filename.includes('.')) {
    if (contentType.includes('png') || isPNG(buffer)) {
      filename += '.png';
    } else if (contentType.includes('json')) {
      filename += '.json';
    } else if (contentType.includes('zip') || pathname.includes('.charx')) {
      filename += '.charx';
    }
  }

  // Create a File object for the existing import function
  const file = new File([buffer], filename, { type: contentType || 'application/octet-stream' });

  return importCardClientSide(file);
}
