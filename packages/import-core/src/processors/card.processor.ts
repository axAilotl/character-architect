/**
 * Card Processor
 *
 * Handles card validation and normalization
 */

import type { ParsedCharacter, ProcessedCharacter } from '../types/index.js';

/**
 * Process a parsed character (validation, normalization)
 */
export function processCard(character: ParsedCharacter): ProcessedCharacter {
  // For now, pass through - validation will be added incrementally
  // Future enhancements:
  // - Schema validation
  // - Field normalization
  // - Data sanitization
  // - Missing field defaults

  return {
    card: character.card,
    thumbnail: character.thumbnail,
    assets: character.assets
  };
}
