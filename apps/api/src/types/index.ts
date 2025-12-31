/**
 * Card Doctor API Types
 *
 * App-specific types for Card Doctor. These are NOT character card format types
 * (those come from @character-foundry/*), but rather application-level types for
 * managing cards, assets, LLM providers, templates, etc.
 */

import type { CCv2Data, CCv3Data } from '@character-foundry/character-foundry/schemas';

// Re-export schemas types that we use
export type { CCv2Data, CCv3Data } from '@character-foundry/character-foundry/schemas';

// ============================================================================
// SPEC TYPES
// ============================================================================

/**
 * Card specification version
 */
export type Spec = 'v2' | 'v3' | 'chara_card_v2' | 'chara_card_v3' | 'collection' | 'lorebook';

// ============================================================================
// CARD MANAGEMENT TYPES
// ============================================================================

/**
 * Card metadata for database storage
 */
export interface CardMeta {
  id: string;
  name: string;
  spec: Spec;
  tags: string[];
  creator?: string;
  characterVersion?: string;
  rating?: 'SFW' | 'NSFW';
  createdAt: string;
  updatedAt: string;
  assetCount?: number;
  /** For cards that are part of a collection/package */
  packageId?: string;
  /** For collection cards - number of member cards */
  memberCount?: number;
}

/**
 * Card with metadata and data
 */
export interface Card {
  meta: CardMeta;
  data: CCv2Data | CCv3Data;
}

/**
 * Card update payload - allows partial meta updates
 */
export interface CardUpdate {
  meta?: Partial<CardMeta>;
  data?: CCv2Data | CCv3Data;
}

/**
 * Card version for history tracking
 */
export interface CardVersion {
  id: string;
  cardId: string;
  version: number;
  data: CCv2Data | CCv3Data;
  message?: string;
  createdAt: string;
  createdBy?: string;
}

// ============================================================================
// ASSET TYPES
// ============================================================================

/**
 * Stored asset metadata
 */
export interface Asset {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  createdAt: string;
}

/**
 * Card-asset association
 */
export interface CardAsset {
  id: string;
  cardId: string;
  assetId: string;
  type: string;
  name: string;
  ext: string;
  order: number;
  isMain: boolean;
  tags?: string[];
  originalUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Card asset with full asset details
 */
export interface CardAssetWithDetails extends CardAsset {
  asset: Asset;
}

/**
 * Asset tag (simple string)
 */
export type AssetTag = string;

/**
 * Asset transformation options
 */
export interface AssetTransformOptions {
  width?: number;
  height?: number;
  format?: 'webp' | 'png' | 'jpeg' | 'jpg';
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Asset validation error
 */
export interface AssetValidationError {
  field?: string;
  message: string;
  severity: 'error' | 'warning';
  assetId?: string;
  assetName?: string;
}

// ============================================================================
// LLM TYPES
// ============================================================================

/**
 * LLM provider configuration
 */
export interface LLMProvider {
  id: string;
  name: string;
  kind: 'openai' | 'anthropic' | 'openai-compatible';
  baseURL: string;
  apiKey: string;
  organization?: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  mode?: 'chat' | 'responses';
  anthropicVersion?: string;
}

/**
 * RAG settings
 */
export interface RagSettings {
  enabled?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  indexPath: string;
  activeDatabaseId?: string;
  tokenCap?: number;
  embedModel?: string;
  sources?: RagSource[];
}

/**
 * LLM settings
 */
export interface LLMSettings {
  providers: LLMProvider[];
  activeProviderId?: string;
  rag: RagSettings;
  charxExport?: CharxExportSettings;
}

/**
 * LLM message
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM invoke request
 */
export interface LLMInvokeRequest {
  providerId: string;
  model?: string;
  mode?: 'chat' | 'responses';
  messages: LLMMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * LLM assist context
 */
export interface LLMAssistContext {
  field: string;
  currentValue: string;
  spec?: 'v2' | 'v3';
  cardName?: string;
  cardData?: Record<string, unknown>;
}

/**
 * LLM assist request
 */
export interface LLMAssistRequest {
  providerId: string;
  model?: string;
  instruction: string;
  context: LLMAssistContext;
  preset?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * LLM usage stats
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}

/**
 * LLM response
 */
export interface LLMResponse {
  content: string;
  model: string;
  usage: LLMUsage;
  finishReason?: string;
}

/**
 * LLM stream chunk
 */
export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: LLMUsage;
}

// ============================================================================
// TEMPLATE & SNIPPET TYPES
// ============================================================================

/**
 * Template content structure
 */
export interface TemplateContent {
  description?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  [key: string]: string | undefined;
}

/**
 * Template definition
 */
export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  targetFields: string | string[];
  content: TemplateContent;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

/**
 * Snippet definition
 */
export interface Snippet {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

// ============================================================================
// PRESET TYPES
// ============================================================================

/**
 * User-defined or built-in LLM preset
 */
export interface UserPreset {
  id: string;
  name: string;
  description?: string;
  instruction: string;
  category?: string;
  isBuiltIn: boolean;
  isHidden?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create preset request
 */
export interface CreatePresetRequest {
  name: string;
  description?: string;
  instruction: string;
  category?: string;
}

/**
 * Update preset request
 */
export interface UpdatePresetRequest {
  id: string;
  name?: string;
  description?: string;
  instruction?: string;
  category?: string;
}

// ============================================================================
// TOKENIZE TYPES
// ============================================================================

/**
 * Tokenize request
 */
export interface TokenizeRequest {
  model: string;
  payload: Record<string, string>;
}

/**
 * Tokenize response
 */
export interface TokenizeResponse {
  model: string;
  fields: Record<string, number>;
  total: number;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * CHARX export settings (flat structure for settings panel)
 */
export interface CharxExportSettings {
  convertToWebp: boolean;
  webpQuality: number;
  maxMegapixels: number;
  stripMetadata: boolean;
  convertMp4ToWebm?: boolean;
  webmQuality?: number;
  includedAssetTypes?: string[];
}

// ============================================================================
// RAG TYPES
// ============================================================================

/**
 * RAG database entry
 */
export interface RagDocument {
  id: string;
  cardId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * RAG database (used as summary in lists)
 */
export interface RagDatabase {
  id: string;
  name?: string;
  label?: string;
  description?: string;
  tags?: string[];
  documents?: RagDocument[];
  settings?: RagSettings;
  sourceCount?: number;
  chunkCount?: number;
  tokenCount?: number;
  createdAt?: string;
  updatedAt: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

// ============================================================================
// DIFF TYPES
// ============================================================================

/**
 * Diff operation type
 */
export type DiffOperationType = 'equal' | 'insert' | 'delete' | 'replace' | 'add' | 'remove' | 'unchanged';

/**
 * Diff operation
 */
export interface DiffOperation {
  type: DiffOperationType;
  value: string;
  text?: string;
  oldText?: string;
  lineNumber?: number;
}

// ============================================================================
// LLM PROMPT TYPES
// ============================================================================

/**
 * RAG snippet for context
 */
export interface RagContextSnippet {
  sourceTitle?: string;
  content: string;
}

/**
 * Field context for LLM operations
 */
export interface FieldContext {
  fieldName: string;
  currentValue: string;
  selection?: string;
  spec?: 'v2' | 'v3' | 'collection' | 'lorebook';
  cardName?: string;
  cardData?: Record<string, unknown>;
  otherFields?: Record<string, string>;
  loreEntries?: string[];
  ragSnippets?: RagContextSnippet[];
}

/**
 * Preset configuration for LLM operations
 */
export interface PresetConfig {
  id: string;
  name: string;
  instruction: string;
  operation?: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// RAG DATABASE TYPES
// ============================================================================

/**
 * RAG document type
 */
export type RagDocumentType = 'text' | 'pdf' | 'markdown' | 'code' | 'freetext' | 'lorebook' | 'json' | 'html';

/**
 * RAG source metadata
 */
export interface RagSource {
  id: string;
  name: string;
  title?: string;
  filename?: string;
  type: RagDocumentType;
  path: string;
  size: number;
  createdAt: string;
  databaseId?: string;
  chunkCount?: number;
  tokenCount?: number;
  indexed?: boolean;
  indexedAt?: string;
  tags?: string[];
}

/**
 * RAG snippet (search result)
 */
export interface RagSnippet {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceTitle?: string;
  content: string;
  score: number;
  databaseId?: string;
  tokenCount?: number;
}

/**
 * RAG database detail
 */
export interface RagDatabaseDetail {
  id: string;
  name: string;
  label?: string;
  description?: string;
  sources: RagSource[];
  sourceCount?: number;
  chunkCount: number;
  tokenCount?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TOKENIZER TYPES
// ============================================================================

/**
 * Tokenizer adapter interface
 * Re-exported from @character-foundry/tokenizers
 */
export type { TokenizerAdapter } from '@character-foundry/character-foundry/tokenizers';

// ============================================================================
// ASSET TYPES (EXTENDED)
// ============================================================================

/**
 * Asset type
 */
export type AssetType = 'icon' | 'background' | 'emotion' | 'avatar' | 'gallery' | 'audio' | 'video' | 'sound' | 'custom' | 'other' | 'package-original';

/**
 * Asset metadata
 */
export interface AssetMetadata {
  type: AssetType;
  tags: AssetTag[];
  actorIndex?: number;
  isAnimated?: boolean;
  order: number;
  format: string;
}

/**
 * Asset node for graph representation
 */
export interface AssetNode {
  id: string;
  cardId: string;
  assetId: string;
  name: string;
  metadata: AssetMetadata;
  asset?: Asset;
  url?: string;
  isMain?: boolean;
  mimetype?: string;
  size?: number;
  width?: number;
  height?: number;
}

// ============================================================================
// ASSET UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse actor index from tags (e.g., "actor:1" -> 1)
 */
export function parseActorIndex(tags: AssetTag[]): number | undefined {
  for (const tag of tags) {
    if (typeof tag === 'string' && tag.startsWith('actor:')) {
      const index = parseInt(tag.slice(6), 10);
      if (!isNaN(index)) return index;
    }
  }
  return undefined;
}

/**
 * Check if tag exists
 */
export function hasTag(tags: AssetTag[], tag: AssetTag): boolean {
  return tags.includes(tag);
}

/**
 * Add tag to tags array (returns new array)
 */
export function addTag(tags: AssetTag[], tag: AssetTag): AssetTag[] {
  if (tags.includes(tag)) return tags;
  return [...tags, tag];
}

/**
 * Remove tag from tags array (returns new array)
 */
export function removeTag(tags: AssetTag[], tag: AssetTag): AssetTag[] {
  return tags.filter(t => t !== tag);
}
