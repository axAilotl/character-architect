/**
 * Web Import Service - Type Definitions
 *
 * This file contains all shared types for the web import system.
 * When adding a new site handler, you may need to extend AssetToImport
 * with site-specific fields (see isChubGallery as example).
 */

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Settings for icon and emotion asset processing
 */
export interface WebImportAssetSettings {
  /** Convert images to WebP format */
  convertToWebp: boolean;
  /** WebP quality (0-100) */
  webpQuality: number;
  /** Maximum megapixels before downscaling */
  maxMegapixels: number;
}

/**
 * Settings for audio file archival (Chub voices)
 */
export interface WebImportAudioSettings {
  /** Enable audio archival */
  enabled: boolean;
  /** Download all TTS model variants (e2, f5, z), not just example */
  downloadAllModels: boolean;
}

/**
 * Settings for Wyvern gallery image archival
 */
export interface WyvernGallerySettings {
  /** Enable Wyvern gallery archival */
  enabled: boolean;
  /** Include avatar-type images */
  includeAvatar: boolean;
  /** Include background-type images */
  includeBackground: boolean;
  /** Include other-type images */
  includeOther: boolean;
  /** Convert to WebP format */
  convertToWebp: boolean;
  /** WebP quality (0-100) */
  webpQuality: number;
}

/**
 * Settings for Chub gallery image archival
 */
export interface ChubGallerySettings {
  /** Enable Chub gallery archival */
  enabled: boolean;
  /** Convert to WebP format */
  convertToWebp: boolean;
  /** WebP quality (0-100) */
  webpQuality: number;
}

/**
 * Complete web import settings object
 */
export interface WebImportSettings {
  icons: WebImportAssetSettings;
  emotions: WebImportAssetSettings;
  skipDefaultEmoji: boolean;
  audio: WebImportAudioSettings;
  wyvernGallery: WyvernGallerySettings;
  chubGallery: ChubGallerySettings;
}

// ============================================================================
// Site Handler Types
// ============================================================================

/**
 * Result returned by a site handler's fetchCard method
 */
export interface FetchedCard {
  /** Parsed card JSON data */
  cardData?: unknown;
  /** Detected spec version */
  spec?: 'v2' | 'v3';
  /** PNG image buffer (for cards with embedded image) */
  pngBuffer?: Buffer;
  /** CHARX ZIP buffer (for Risu Realm) */
  charxBuffer?: Buffer;
  /** Avatar URL for display */
  avatarUrl?: string;
  /** Assets to import (icons, emotions, sounds, etc.) */
  assets: AssetToImport[];
  /** Non-fatal warnings during fetch */
  warnings: string[];
  /** Site-specific metadata */
  meta: Record<string, unknown>;
}

/**
 * Asset to be imported from a site
 *
 * When adding a new site with special asset handling:
 * 1. Add a boolean flag like isChubGallery for your site
 * 2. Check this flag in the asset import loop in WebImportService
 * 3. Apply site-specific settings based on the flag
 */
export interface AssetToImport {
  /** Asset type determines storage location and processing */
  type: 'icon' | 'emotion' | 'sound' | 'background' | 'custom';
  /** Display name / emotion name */
  name: string;
  /** Source URL to download from */
  url: string;
  /** Whether this is the main card icon */
  isMain?: boolean;

  // Audio-specific fields (Chub voices)
  /** Voice UUID for caching */
  voiceId?: string;
  /** Whether this is a default Chub voice (for global caching) */
  isDefaultVoice?: boolean;

  // Base64 data (for client-side fetched images like Wyvern gallery)
  /** Base64-encoded image data (when URL fetch not possible) */
  base64Data?: string;

  // Source tracking flags (add new flags here for new sites)
  /** Asset is from Chub gallery */
  isChubGallery?: boolean;
}

/**
 * Site handler interface - implement this to add a new site
 *
 * Example implementation:
 * ```typescript
 * const myHandler: SiteHandler = {
 *   id: 'mysite',
 *   name: 'My Site',
 *   patterns: [/^https?:\/\/(www\.)?mysite\.com\/characters\/([^\/]+)/],
 *   fetchCard: async (url, match, pngData, clientData) => {
 *     // Extract character ID from match[2]
 *     // Fetch card data from API
 *     // Return FetchedCard
 *   },
 * };
 * ```
 */
export interface SiteHandler {
  /** Unique identifier (used in tags, logging) */
  id: string;
  /** Display name for UI */
  name: string;
  /** URL patterns to match (order matters - first match wins) */
  patterns: RegExp[];
  /**
   * Fetch card data from the site
   * @param url - Full URL of the character page
   * @param match - RegExp match result from pattern
   * @param clientPngData - Base64 PNG data from userscript (optional)
   * @param clientData - Additional data from userscript (optional)
   */
  fetchCard: (
    url: string,
    match: RegExpMatchArray,
    clientPngData?: string,
    clientData?: unknown
  ) => Promise<FetchedCard>;
}

// ============================================================================
// Import Result Types
// ============================================================================

/**
 * Successful import result
 */
export interface WebImportResult {
  success: true;
  cardId: string;
  name: string;
  card: unknown;
  assetsImported: number;
  warnings: string[];
  source: string;
}

/**
 * Failed import result
 */
export interface WebImportError {
  success: false;
  error: string;
}

export type WebImportResponse = WebImportResult | WebImportError;

// ============================================================================
// Processed Asset Types
// ============================================================================

/**
 * Result of processing an image asset
 */
export interface ProcessedImage {
  buffer: Buffer;
  mimetype: string;
  ext: string;
}

/**
 * Result of processing an audio asset
 */
export interface ProcessedAudio {
  buffer: Buffer;
  mimetype: string;
  ext: string;
  filename: string;
}
