/**
 * Canonical ID Generation for Character Architect
 *
 * STANDARDIZED ON: UUID v4 (crypto.randomUUID)
 *
 * Why UUID:
 * - Federation uses UUIDs for card sync across platforms
 * - Web/light mode already uses UUIDs
 * - More recognizable format for debugging federation URLs
 * - Universal standard, works everywhere
 *
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 chars with dashes)
 *
 * NOTE: Voxta spec UUIDs are separate - handled by @character-foundry/voxta
 * This utility is for Character Architect's INTERNAL IDs only:
 * - card.meta.id
 * - asset.id
 * - version.id
 * - preset.id
 */

/**
 * Generate a unique ID for cards, assets, versions, presets, etc.
 * Returns a UUID v4 string.
 *
 * Works in both Node.js and browser environments.
 * Falls back to Math.random-based UUID for non-secure contexts (HTTP).
 */
export function generateId(): string {
  // Use crypto.randomUUID if available (Node.js, secure browser contexts)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback for non-secure contexts (HTTP localhost, older browsers)
  // Generates a valid UUID v4 format using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
