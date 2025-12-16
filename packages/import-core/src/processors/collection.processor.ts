/**
 * Collection Processor
 *
 * Handles collection metadata and linking
 */

import type { ParsedCollection, ProcessedCollection } from '../types/index.js';

/**
 * Process a parsed collection
 */
export function processCollection(collection: ParsedCollection): ProcessedCollection {
  // For now, pass through
  // Future enhancements:
  // - Validate member references
  // - Validate scenario data
  // - Enrich metadata

  return {
    card: collection.card,
    thumbnail: collection.thumbnail,
    members: collection.members,
    scenarios: collection.scenarios,
    originalPackage: collection.originalPackage
  };
}
