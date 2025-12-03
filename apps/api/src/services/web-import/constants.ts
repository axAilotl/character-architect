/**
 * Web Import Service - Constants
 *
 * Default settings and static data for web import.
 */

import type { WebImportSettings } from './types.js';

// ============================================================================
// Default Settings
// ============================================================================

/**
 * Default web import settings
 * These are used when no settings have been saved yet
 */
export const DEFAULT_WEB_IMPORT_SETTINGS: WebImportSettings = {
  icons: {
    convertToWebp: true,
    webpQuality: 80,
    maxMegapixels: 2,
  },
  emotions: {
    convertToWebp: true,
    webpQuality: 80,
    maxMegapixels: 1,
  },
  skipDefaultEmoji: true,
  audio: {
    enabled: false,
    downloadAllModels: false, // Only download 'example' by default
  },
  wyvernGallery: {
    enabled: true,
    includeAvatar: true,
    includeBackground: true,
    includeOther: true,
    convertToWebp: false, // Keep full PNG by default
    webpQuality: 85,
  },
  chubGallery: {
    enabled: true,
    convertToWebp: false, // Keep full PNG by default
    webpQuality: 85,
  },
};

// ============================================================================
// Chub Voice Data
// ============================================================================

/**
 * Default Chub voice UUIDs
 *
 * These are the 17 built-in voices that Chub provides.
 * When a card uses one of these, we cache the audio globally
 * to avoid re-downloading for every card.
 *
 * Cache location: {storagePath}/cache/chub-voices/{uuid}/
 */
export const DEFAULT_CHUB_VOICE_UUIDS = new Set([
  // HQ (High Quality) voices
  '03a438b7-ebfa-4f72-9061-f086d8f1fca6', // HQ Female Lowrange
  '057d53b3-bb28-47f1-9c19-a85a79851863', // HQ Female Midrange
  'd6e05564-eea9-4181-aee9-fa0d7315f67d', // HQ Male Lowrange
  'dc42cdc0-3f05-43a9-b843-7920e2e041aa', // HQ Male Highrange
  'e6b74abb-f4b2-4a84-b9ef-c390512f2f47', // HQ Male Midrange

  // LQ (Low Quality / Fast) voices
  'a2533977-83cb-4c10-9955-0277e047538f', // LQ Female Midrange
  '6e6619ba-4880-4cf3-a5df-d0697ba46656', // LQ Female Highrange
  'a8274abb-33d3-409f-95e7-2e46ae811776', // LQ Female Lowrange

  // Fast voices (newer format)
  'bright_female_20s',      // Fast Bright Female
  'resonant_male_40s',      // Fast Resonant Male
  'gentle_female_30s',      // Fast Gentle Female
  'whispery_female_40s',    // Fast Whispery Female
  'formal_female_30s',      // Fast Formal Female
  'professional_female_30s', // Fast Professional Female
  'calm_female_20s',        // Fast Calm Female
  'light_male_20s',         // Fast Light Male
  'animated_male_20s',      // Fast Animated Male
]);

// ============================================================================
// Common User Agents
// ============================================================================

/**
 * Browser-like User-Agent for sites that block bots
 */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Simple User-Agent for APIs that accept anything
 */
export const APP_USER_AGENT = 'Card-Architect/1.0';

// ============================================================================
// Timestamp Handling
// ============================================================================

/**
 * Threshold for detecting millisecond timestamps
 * Values above this are assumed to be milliseconds (13 digits)
 * Values below are assumed to be seconds (10 digits)
 */
export const TIMESTAMP_THRESHOLD = 10000000000;
