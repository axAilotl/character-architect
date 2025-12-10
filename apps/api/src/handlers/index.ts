/**
 * Format Handlers - Registry and Exports
 *
 * Provides a unified interface for format detection and handler selection.
 */

import type Database from 'better-sqlite3';
import type { FormatHandler } from './format-handler.js';
import type { FormatType, FormatDetectionResult } from './types.js';

import { pngHandler } from './png-handler.js';
import { jsonHandler } from './json-handler.js';
import { charxHandler } from './charx-handler.js';
import { voxtaHandler } from './voxta-handler.js';

// Re-export types
export * from './types.js';
export * from './format-handler.js';
export { normalizeCardData, normalizeLorebookEntries } from './utils/normalization.js';

// Re-export handlers
export { pngHandler } from './png-handler.js';
export { jsonHandler } from './json-handler.js';
export { charxHandler } from './charx-handler.js';
export { voxtaHandler } from './voxta-handler.js';

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

/**
 * Registry of all format handlers
 */
class FormatHandlerRegistry {
  private handlers: Map<FormatType, FormatHandler> = new Map();
  private initialized = false;

  constructor() {
    // Register handlers (order matters for detection priority)
    this.handlers.set('voxta', voxtaHandler);
    this.handlers.set('charx', charxHandler);
    this.handlers.set('png', pngHandler);
    this.handlers.set('json', jsonHandler);
  }

  /**
   * Initialize handlers that require database connection
   */
  init(db: Database.Database): void {
    if (this.initialized) return;

    charxHandler.init(db);
    voxtaHandler.init(db);
    this.initialized = true;
  }

  /**
   * Get a handler by format type
   */
  get(format: FormatType): FormatHandler | undefined {
    return this.handlers.get(format);
  }

  /**
   * Get all registered handlers
   */
  getAll(): FormatHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Detect format and return the best matching handler
   */
  detect(
    buffer: Buffer,
    filename?: string,
    mimetype?: string
  ): { handler: FormatHandler; detection: FormatDetectionResult } | null {
    let bestHandler: FormatHandler | null = null;
    let bestDetection: FormatDetectionResult | null = null;
    let bestScore = 0;

    const confidenceScore = {
      high: 3,
      medium: 2,
      low: 1,
    };

    for (const handler of this.handlers.values()) {
      const detection = handler.detect(buffer, filename, mimetype);
      if (detection.format !== 'unknown') {
        const score = confidenceScore[detection.confidence];
        if (score > bestScore) {
          bestScore = score;
          bestHandler = handler;
          bestDetection = detection;
        }
      }
    }

    if (bestHandler && bestDetection) {
      return { handler: bestHandler, detection: bestDetection };
    }

    return null;
  }

  /**
   * Find handler by filename extension
   */
  findByExtension(filename: string): FormatHandler | null {
    const lower = filename.toLowerCase();
    for (const handler of this.handlers.values()) {
      for (const ext of handler.extensions) {
        if (lower.endsWith(ext.toLowerCase())) {
          return handler;
        }
      }
    }
    return null;
  }

  /**
   * Find handler by MIME type
   */
  findByMimeType(mimetype: string): FormatHandler | null {
    const lower = mimetype.toLowerCase();
    for (const handler of this.handlers.values()) {
      if (handler.mimeTypes.includes(lower)) {
        return handler;
      }
    }
    return null;
  }
}

// Singleton instance
export const formatHandlers = new FormatHandlerRegistry();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Detect file format from buffer
 */
export function detectFormat(
  buffer: Buffer,
  filename?: string,
  mimetype?: string
): FormatDetectionResult {
  const result = formatHandlers.detect(buffer, filename, mimetype);
  if (result) {
    return result.detection;
  }
  return {
    format: 'unknown',
    confidence: 'low',
  };
}

/**
 * Get handler for format
 */
export function getHandler(format: FormatType): FormatHandler | undefined {
  return formatHandlers.get(format);
}

/**
 * Get handler for file
 */
export function getHandlerForFile(
  buffer: Buffer,
  filename?: string,
  mimetype?: string
): FormatHandler | null {
  const result = formatHandlers.detect(buffer, filename, mimetype);
  return result?.handler ?? null;
}

/**
 * Check if a format is supported for import
 */
export function canImport(format: FormatType): boolean {
  const handler = formatHandlers.get(format);
  return handler?.canImport() ?? false;
}

/**
 * Check if a format is supported for export
 */
export function canExport(format: FormatType): boolean {
  const handler = formatHandlers.get(format);
  return handler?.canExport() ?? false;
}

/**
 * Get supported import formats
 */
export function getSupportedImportFormats(): FormatType[] {
  return formatHandlers
    .getAll()
    .filter((h) => h.canImport())
    .map((h) => h.id);
}

/**
 * Get supported export formats
 */
export function getSupportedExportFormats(): FormatType[] {
  return formatHandlers
    .getAll()
    .filter((h) => h.canExport())
    .map((h) => h.id);
}
