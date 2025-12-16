/**
 * Import Core Types
 * Shared types for unified import service
 */

// ============================================================================
// SPEC TYPES
// ============================================================================

/**
 * Card specification version
 */
export type Spec = 'v2' | 'v3' | 'collection' | 'lorebook';

// ============================================================================
// ASSET TYPES
// ============================================================================

/**
 * Asset type
 */
export type AssetType =
  | 'icon'
  | 'background'
  | 'emotion'
  | 'avatar'
  | 'gallery'
  | 'audio'
  | 'video'
  | 'sound'
  | 'custom'
  | 'other'
  | 'package-original';

/**
 * Asset tag (simple string)
 */
export type AssetTag = string;

/**
 * Asset data for storage
 */
export interface AssetData {
  buffer: Buffer | Uint8Array;
  filename: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
}

/**
 * Asset link metadata for card-asset association
 */
export interface AssetLink {
  type: AssetType;
  name: string;
  ext: string;
  order: number;
  isMain: boolean;
  tags: string[];
}

// ============================================================================
// CARD TYPES
// ============================================================================

/**
 * Card metadata
 */
export interface CardMeta {
  name: string;
  spec: Spec;
  tags: string[];
  creator?: string;
  characterVersion?: string;
  memberCount?: number;
  packageId?: string;
}

/**
 * Card data for storage
 */
export interface CardData {
  meta: CardMeta;
  data: any; // CCv2Data | CCv3Data | CollectionData
}

// ============================================================================
// PARSER TYPES
// ============================================================================

/**
 * Detected file format
 */
export type FileFormat = 'png' | 'charx' | 'voxta' | 'json';

/**
 * Character data from parser
 */
export interface ParsedCharacter {
  card: CardData;
  thumbnail?: Buffer | Uint8Array;
  assets: ParsedAsset[];
}

/**
 * Asset data from parser
 */
export interface ParsedAsset {
  buffer: Buffer | Uint8Array;
  filename: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  link: AssetLink;
}

/**
 * Collection metadata from parser
 */
export interface ParsedCollection {
  card: CardData;
  thumbnail?: Buffer | Uint8Array;
  members: ParsedCollectionMember[]; // Fixed from memberRefs
  scenarios?: ParsedScenario[];
  originalPackage?: Buffer | Uint8Array;
}

/**
 * Collection member reference
 */
export interface ParsedCollectionMember {
  voxtaCharacterId?: string;
  name: string;
  order: number;
  scenarioIds?: string[];
}

/**
 * Scenario metadata
 */
export interface ParsedScenario {
  voxtaScenarioId: string;
  name: string;
  description?: string;
  version?: string;
  creator?: string;
  characterIds: string[];
  order: number;
  explicitContent?: boolean;
  hasThumbnail?: boolean;
}

/**
 * Parser output
 */
export interface ParsedData {
  characters: ParsedCharacter[];
  collection?: ParsedCollection;
  isCollection: boolean;
}

// ============================================================================
// PROCESSOR TYPES
// ============================================================================

/**
 * Processed character ready for storage
 */
export interface ProcessedCharacter {
  card: CardData;
  thumbnail?: Buffer | Uint8Array;
  assets: ParsedAsset[];
}

/**
 * Processed collection ready for storage
 */
export interface ProcessedCollection {
  card: CardData;
  thumbnail?: Buffer | Uint8Array;
  members: ParsedCollectionMember[]; // Aligned with ParsedCollection
  scenarios?: ParsedScenario[];
  originalPackage?: Buffer | Uint8Array;
}

/**
 * Processor output
 */
export interface ProcessedImport {
  characters: ProcessedCharacter[];
  collection?: ProcessedCollection;
  isCollection: boolean;
}
