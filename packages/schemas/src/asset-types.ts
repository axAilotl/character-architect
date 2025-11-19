/**
 * Asset Type System for CharX Asset Management
 * Defines types, tags, and metadata for character card assets
 */

/**
 * Asset types following CharX v1.0 specification
 */
export type AssetType =
  | 'icon'           // Character portrait/avatar
  | 'background'     // Scene background
  | 'emotion'        // Expression/emotion variant
  | 'user_icon'      // User avatar
  | 'sound'          // Audio assets
  | 'custom';        // Other/miscellaneous

/**
 * Asset tags for categorization and special behavior
 */
export type AssetTag =
  | 'portrait-override'  // Main character portrait
  | `actor-${number}`    // Actor binding (actor-1, actor-2, etc.)
  | 'animated'           // Animated asset (GIF, APNG, WebM)
  | 'expression'         // Expression/emotion variant
  | 'main-background';   // Primary background

/**
 * Supported asset formats with animation detection
 */
export interface AssetFormatInfo {
  ext: string;
  mimeType: string;
  canBeAnimated: boolean;
  magicBytes?: number[]; // File signature for detection
}

export const ASSET_FORMATS: Record<string, AssetFormatInfo> = {
  // Images - Static
  png: {
    ext: 'png',
    mimeType: 'image/png',
    canBeAnimated: true, // APNG
    magicBytes: [0x89, 0x50, 0x4E, 0x47],
  },
  jpg: {
    ext: 'jpg',
    mimeType: 'image/jpeg',
    canBeAnimated: false,
    magicBytes: [0xFF, 0xD8, 0xFF],
  },
  jpeg: {
    ext: 'jpeg',
    mimeType: 'image/jpeg',
    canBeAnimated: false,
    magicBytes: [0xFF, 0xD8, 0xFF],
  },
  webp: {
    ext: 'webp',
    mimeType: 'image/webp',
    canBeAnimated: true,
    magicBytes: [0x52, 0x49, 0x46, 0x46], // RIFF header
  },
  gif: {
    ext: 'gif',
    mimeType: 'image/gif',
    canBeAnimated: true,
    magicBytes: [0x47, 0x49, 0x46],
  },
  avif: {
    ext: 'avif',
    mimeType: 'image/avif',
    canBeAnimated: true,
  },

  // Video
  mp4: {
    ext: 'mp4',
    mimeType: 'video/mp4',
    canBeAnimated: true,
    magicBytes: [0x66, 0x74, 0x79, 0x70], // ftyp box
  },
  webm: {
    ext: 'webm',
    mimeType: 'video/webm',
    canBeAnimated: true,
    magicBytes: [0x1A, 0x45, 0xDF, 0xA3], // EBML header
  },

  // Audio
  mp3: {
    ext: 'mp3',
    mimeType: 'audio/mpeg',
    canBeAnimated: false,
    magicBytes: [0x49, 0x44, 0x33], // ID3
  },
  wav: {
    ext: 'wav',
    mimeType: 'audio/wav',
    canBeAnimated: false,
    magicBytes: [0x52, 0x49, 0x46, 0x46],
  },
  ogg: {
    ext: 'ogg',
    mimeType: 'audio/ogg',
    canBeAnimated: false,
    magicBytes: [0x4F, 0x67, 0x67, 0x53],
  },
};

/**
 * Asset metadata attached to each asset
 */
export interface AssetMetadata {
  type: AssetType;
  tags: AssetTag[];
  actorIndex?: number;    // Parsed from actor-N tag
  isAnimated: boolean;    // Auto-detected from format/buffer
  order: number;          // Display/export order
  hash?: string;          // SHA-256 for deduplication
  format?: string;        // File extension
}

/**
 * Asset node in the in-memory asset graph
 */
export interface AssetNode {
  id: string;             // Asset ID
  cardId: string;         // Parent card ID
  assetId: string;        // Reference to asset in assets table
  name: string;           // Asset name
  metadata: AssetMetadata;
  url: string;            // Storage URL
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  isMain: boolean;        // Main asset flag
}

/**
 * Asset validation result
 */
export interface AssetValidationError {
  assetId: string;
  assetName: string;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Detect if a buffer contains an animated asset
 */
export function detectAnimatedAsset(buffer: Buffer, mimeType: string): boolean {
  // GIF - check for multiple frames
  if (mimeType === 'image/gif') {
    // Simple detection: GIF with multiple frames has multiple image descriptors (0x2C)
    let imageDescriptors = 0;
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === 0x2C) {
        imageDescriptors++;
        if (imageDescriptors > 1) return true;
      }
    }
    return false;
  }

  // APNG - check for animation control chunk (acTL)
  if (mimeType === 'image/png') {
    const acTL = Buffer.from('acTL');
    for (let i = 0; i < buffer.length - 4; i++) {
      if (buffer.slice(i, i + 4).equals(acTL)) {
        return true;
      }
    }
    return false;
  }

  // WebP - check for VP8X extended format with animation bit
  if (mimeType === 'image/webp') {
    // WebP structure: RIFF....WEBP followed by chunks
    const vp8x = Buffer.from('VP8X');
    for (let i = 0; i < buffer.length - 10; i++) {
      if (buffer.slice(i, i + 4).equals(vp8x)) {
        // VP8X flags are at offset i+8, animation bit is 0x02
        const flags = buffer[i + 8];
        return (flags & 0x02) !== 0;
      }
    }
    return false;
  }

  // WebM/MP4 - always considered animated (video)
  if (mimeType === 'video/webm' || mimeType === 'video/mp4') {
    return true;
  }

  return false;
}

/**
 * Parse actor index from tags
 */
export function parseActorIndex(tags: AssetTag[]): number | undefined {
  const actorTag = tags.find(t => typeof t === 'string' && t.startsWith('actor-'));
  if (actorTag) {
    const match = actorTag.match(/^actor-(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return undefined;
}

/**
 * Create actor tag from index
 */
export function createActorTag(actorIndex: number): AssetTag {
  return `actor-${actorIndex}` as AssetTag;
}

/**
 * Check if asset has a specific tag
 */
export function hasTag(metadata: AssetMetadata, tag: AssetTag): boolean {
  return metadata.tags.includes(tag);
}

/**
 * Add tag to asset metadata (returns new metadata)
 */
export function addTag(metadata: AssetMetadata, tag: AssetTag): AssetMetadata {
  if (metadata.tags.includes(tag)) {
    return metadata;
  }
  return {
    ...metadata,
    tags: [...metadata.tags, tag],
  };
}

/**
 * Remove tag from asset metadata (returns new metadata)
 */
export function removeTag(metadata: AssetMetadata, tag: AssetTag): AssetMetadata {
  return {
    ...metadata,
    tags: metadata.tags.filter(t => t !== tag),
  };
}
