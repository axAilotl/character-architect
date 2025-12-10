/**
 * Format Handler Interface
 *
 * Base interface for format-specific import/export handlers.
 * Each handler encapsulates the logic for a specific format (PNG, CHARX, Voxta, JSON).
 */

import type {
  FormatType,
  FormatDetectionResult,
  ImportContext,
  ImportResult,
  ImportOptions,
  ExportContext,
  ExportResult,
  ExportOptions,
} from './types.js';

// ============================================================================
// FORMAT HANDLER INTERFACE
// ============================================================================

export interface FormatHandler {
  /** Unique handler identifier */
  readonly id: FormatType;

  /** Human-readable name */
  readonly name: string;

  /** Supported file extensions (e.g., ['.png', '.PNG']) */
  readonly extensions: string[];

  /** Supported MIME types */
  readonly mimeTypes: string[];

  /**
   * Detect if this handler can process the given content
   * @param buffer - File buffer to analyze
   * @param filename - Original filename (optional)
   * @param mimetype - MIME type (optional)
   * @returns Detection result with confidence level
   */
  detect(
    buffer: Buffer,
    filename?: string,
    mimetype?: string
  ): FormatDetectionResult;

  /**
   * Check if this handler supports import
   */
  canImport(): boolean;

  /**
   * Check if this handler supports export
   */
  canExport(): boolean;

  /**
   * Import a file using this handler
   * @param context - Import context with buffer, filename, etc.
   * @param options - Import options
   * @returns Import result with card IDs and warnings
   */
  import(context: ImportContext, options: ImportOptions): Promise<ImportResult>;

  /**
   * Export a card using this handler
   * @param context - Export context with card data, assets, etc.
   * @param options - Export options
   * @returns Export result with buffer and metadata
   */
  export(context: ExportContext, options: ExportOptions): Promise<ExportResult>;
}

// ============================================================================
// BASE HANDLER CLASS
// ============================================================================

/**
 * Abstract base class with common functionality for handlers
 */
export abstract class BaseFormatHandler implements FormatHandler {
  abstract readonly id: FormatType;
  abstract readonly name: string;
  abstract readonly extensions: string[];
  abstract readonly mimeTypes: string[];

  /**
   * Check file extension match
   */
  protected hasMatchingExtension(filename?: string): boolean {
    if (!filename) return false;
    const lower = filename.toLowerCase();
    return this.extensions.some((ext) => lower.endsWith(ext.toLowerCase()));
  }

  /**
   * Check MIME type match
   */
  protected hasMatchingMimeType(mimetype?: string): boolean {
    if (!mimetype) return false;
    return this.mimeTypes.includes(mimetype.toLowerCase());
  }

  /**
   * Create a failure result for import
   */
  protected importFailure(error: string, warnings: string[] = []): ImportResult {
    return {
      success: false,
      cardIds: [],
      assetsImported: 0,
      warnings,
      error,
    };
  }

  /**
   * Create a success result for import
   */
  protected importSuccess(
    cardIds: string[],
    assetsImported: number = 0,
    warnings: string[] = []
  ): ImportResult {
    return {
      success: true,
      cardIds,
      assetsImported,
      warnings,
    };
  }

  /**
   * Create a failure result for export
   */
  protected exportFailure(error: string, warnings: string[] = []): ExportResult {
    return {
      success: false,
      buffer: Buffer.alloc(0),
      mimetype: 'application/octet-stream',
      filename: 'error',
      warnings,
      error,
    };
  }

  /**
   * Create a success result for export
   */
  protected exportSuccess(
    buffer: Buffer,
    mimetype: string,
    filename: string,
    options: { assetCount?: number; totalSize?: number; warnings?: string[] } = {}
  ): ExportResult {
    return {
      success: true,
      buffer,
      mimetype,
      filename,
      assetCount: options.assetCount,
      totalSize: options.totalSize ?? buffer.length,
      warnings: options.warnings ?? [],
    };
  }

  // Abstract methods to be implemented by subclasses
  abstract detect(
    buffer: Buffer,
    filename?: string,
    mimetype?: string
  ): FormatDetectionResult;

  abstract canImport(): boolean;
  abstract canExport(): boolean;

  abstract import(
    context: ImportContext,
    options: ImportOptions
  ): Promise<ImportResult>;

  abstract export(
    context: ExportContext,
    options: ExportOptions
  ): Promise<ExportResult>;
}
