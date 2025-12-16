/**
 * Client-side card import types
 *
 * NOTE: Import logic has been moved to UnifiedImportService in @card-architect/import-core
 * This file now only contains legacy type definitions for backwards compatibility.
 */

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
  card: any;
  fullImageDataUrl?: string;
  thumbnailDataUrl?: string;
  assets?: ExtractedAsset[];
  warnings?: string[];
}

export interface VoxtaCollectionImportResult {
  collectionCard: any;
  memberCards: any[];
  fullImageDataUrl?: string;
  thumbnailDataUrl?: string;
  assets?: ExtractedAsset[];
}
