/**
 * Format Handler Types
 *
 * Common types for format handlers (PNG, CHARX, Voxta, JSON)
 */

import type { CCv2Data, CCv3Data } from '@character-foundry/schemas';
import type { FastifyBaseLogger } from 'fastify';
import type { CardAssetWithDetails } from '../types/index.js';

// ============================================================================
// FORMAT DETECTION
// ============================================================================

export type FormatType = 'png' | 'charx' | 'voxta' | 'json' | 'unknown';

export interface FormatDetectionResult {
  format: FormatType;
  confidence: 'high' | 'medium' | 'low';
  spec?: 'v2' | 'v3';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// IMPORT TYPES
// ============================================================================

export interface ImportContext {
  /** Original filename */
  filename: string;
  /** MIME type if known */
  mimetype?: string;
  /** File buffer */
  buffer: Buffer;
  /** Source URL if importing from URL */
  sourceUrl?: string;
  /** Logger instance */
  logger: FastifyBaseLogger;
}

export interface ImportResult {
  success: boolean;
  /** Card IDs created (can be multiple for Voxta packages) */
  cardIds: string[];
  /** Number of assets imported */
  assetsImported: number;
  /** Warning messages */
  warnings: string[];
  /** Error message if failed */
  error?: string;
}

export interface ImportOptions {
  /** Storage path for assets */
  storagePath: string;
  /** Preserve original timestamps */
  preserveTimestamps?: boolean;
  /** Use original image as main icon */
  setAsOriginalImage?: boolean;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface ExportContext {
  /** Card ID to export */
  cardId: string;
  /** Card data */
  cardData: CCv2Data | CCv3Data;
  /** Card metadata */
  cardMeta: {
    id: string;
    name: string;
    spec: 'v2' | 'v3';
  };
  /** Original image buffer (if available) */
  originalImage?: Buffer;
  /** Card assets */
  assets: CardAssetWithDetails[];
  /** Logger instance */
  logger: FastifyBaseLogger;
}

export interface ExportResult {
  success: boolean;
  /** Exported file buffer */
  buffer: Buffer;
  /** MIME type for response */
  mimetype: string;
  /** Suggested filename */
  filename: string;
  /** Number of assets included */
  assetCount?: number;
  /** Total size in bytes */
  totalSize?: number;
  /** Warning messages */
  warnings: string[];
  /** Error message if failed */
  error?: string;
}

export interface ExportOptions {
  /** Storage path for assets */
  storagePath: string;
  /** Optimization settings */
  optimization?: {
    enabled: boolean;
    convertToWebp: boolean;
    webpQuality: number;
    maxMegapixels: number;
    stripMetadata: boolean;
    convertMp4ToWebm?: boolean;
    webmQuality?: number;
    includedAssetTypes?: string[];
  };
}

// ============================================================================
// ASSET TYPES (re-exported from types/index.ts)
// ============================================================================

// CardAssetWithDetails is imported at top and re-exported
export type { CardAssetWithDetails };

// ============================================================================
// NORMALIZATION TYPES
// ============================================================================

export interface NormalizationResult {
  data: CCv2Data | CCv3Data;
  spec: 'v2' | 'v3';
  warnings: string[];
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
