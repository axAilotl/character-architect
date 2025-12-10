/**
 * Card Doctor Web Types
 *
 * App-specific types for Card Doctor web app. These are NOT character card format types
 * (those come from @character-foundry/*), but rather application-level types for
 * managing cards, assets, LLM providers, templates, etc.
 */

import type { CCv2Data, CCv3Data } from '@character-foundry/schemas';

// Re-export schemas types that we use
export type { CCv2Data, CCv3Data } from '@character-foundry/schemas';

// ============================================================================
// SPEC TYPES
// ============================================================================

export type Spec = 'v2' | 'v3' | 'chara_card_v2' | 'chara_card_v3' | 'collection';

// Helper to normalize spec to short form
export function normalizeSpec(spec: Spec): 'v2' | 'v3' | 'collection' {
  if (spec === 'chara_card_v2' || spec === 'v2') return 'v2';
  if (spec === 'collection') return 'collection';
  return 'v3';
}

// Check if a spec is a collection
export function isCollectionSpec(spec: Spec): boolean {
  return spec === 'collection';
}

// ============================================================================
// CARD MANAGEMENT TYPES
// ============================================================================

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
  /** Package ID for cards that belong to a Voxta collection */
  packageId?: string;
  /** Number of member cards (for collection cards only) */
  memberCount?: number;
}

export interface Card {
  meta: CardMeta;
  data: CCv2Data | CCv3Data | CollectionData;
}

/** Type alias for character cards (non-collection) */
export type CharacterCard = Card & { data: CCv2Data | CCv3Data };

/** Type alias for collection cards */
export type CollectionCard = Card & { meta: CardMeta & { spec: 'collection' }; data: CollectionData };

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
// COLLECTION TYPES (Voxta multi-character packages)
// ============================================================================

/** Member card info stored in collection */
export interface CollectionMember {
  /** Card ID in our system */
  cardId: string;
  /** Original Voxta character ID */
  voxtaCharacterId?: string;
  /** Character name (cached for display) */
  name: string;
  /** Order in the collection */
  order: number;
  /** When added to collection */
  addedAt: string;
  /** Scenario IDs this character belongs to */
  scenarioIds?: string[];
}

/** Scenario info stored in collection */
export interface CollectionScenario {
  /** Original Voxta scenario ID */
  voxtaScenarioId: string;
  /** Scenario name */
  name: string;
  /** Scenario description */
  description?: string;
  /** Version */
  version?: string;
  /** Creator */
  creator?: string;
  /** Voxta character IDs that are in this scenario (from Roles) */
  characterIds: string[];
  /** Order in the collection */
  order: number;
  /** Whether this scenario has explicit content */
  explicitContent?: boolean;
  /** Has thumbnail */
  hasThumbnail?: boolean;
}

/** Collection-specific data stored in Card.data for collection cards */
export interface CollectionData {
  /** Package name */
  name: string;
  /** Package description */
  description?: string;
  /** Package version */
  version?: string;
  /** Package creator */
  creator?: string;
  /** Original Voxta package ID */
  voxtaPackageId?: string;
  /** Member cards in this collection */
  members: CollectionMember[];
  /** Scenarios in this collection */
  scenarios?: CollectionScenario[];
  /** Shared lorebooks (book IDs) */
  sharedBookIds?: string[];
  /** Whether this package has explicit content */
  explicitContent?: boolean;
  /** Original package creation date */
  dateCreated?: string;
  /** Last modification date */
  dateModified?: string;
}

/** Type guard for collection data */
export function isCollectionData(data: CCv2Data | CCv3Data | CollectionData): data is CollectionData {
  return 'members' in data && Array.isArray((data as CollectionData).members);
}

// ============================================================================
// ASSET TYPES
// ============================================================================

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

export interface CardAssetWithDetails extends CardAsset {
  asset: Asset;
}

export type AssetTag = string;

export interface AssetTransformOptions {
  width?: number;
  height?: number;
  format?: 'webp' | 'png' | 'jpeg' | 'jpg';
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

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

export type ProviderKind = 'openai' | 'anthropic' | 'openai-compatible';
export type OpenAIMode = 'chat' | 'responses';

export interface LLMProvider {
  id: string;
  name: string;
  label?: string;
  kind: ProviderKind;
  baseURL: string;
  apiKey: string;
  organization?: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  mode?: OpenAIMode;
  anthropicVersion?: string;
  streamDefault?: boolean;
}

// Alias for compatibility
export type ProviderConfig = LLMProvider;

export interface RagSettings {
  enabled?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  indexPath?: string;
  activeDatabaseId?: string;
  tokenCap?: number;
  embedModel?: string;
  sources?: RagSource[];
}

export interface LLMSettings {
  providers: LLMProvider[];
  activeProviderId?: string;
  rag?: RagSettings;
  charxExport?: CharxExportSettings;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMInvokeRequest {
  providerId: string;
  model?: string;
  mode?: OpenAIMode;
  messages: LLMMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMAssistContext {
  field: string;
  currentValue: string;
  spec?: 'v2' | 'v3';
  cardName?: string;
  cardData?: Record<string, unknown>;
}

export interface LLMAssistRequest {
  providerId: string;
  model?: string;
  instruction: string;
  context: FieldContext;
  preset?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}

export interface TokenDelta {
  before: number;
  after: number;
  delta: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: LLMUsage;
  finishReason?: string;
  original?: string;
  revised?: string;
  tokenDelta?: TokenDelta;
  diff?: DiffOperation[];
  metadata?: Record<string, string | number | boolean>;
}

// Alias for compatibility
export type LLMAssistResponse = LLMResponse;

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: LLMUsage;
}

// ============================================================================
// TEMPLATE & SNIPPET TYPES
// ============================================================================

export interface TemplateContent {
  description?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  [key: string]: string | undefined;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  targetFields: 'all' | CCFieldName[] | string | string[];
  content: TemplateContent;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

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

export interface CreatePresetRequest {
  name: string;
  description?: string;
  instruction: string;
  category?: string;
}

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

export interface TokenizeRequest {
  model: string;
  payload: Record<string, string>;
}

export interface TokenizeResponse {
  model: string;
  fields: Record<string, number>;
  total: number;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

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

export type RagDocumentType = 'text' | 'pdf' | 'markdown' | 'code' | 'freetext' | 'lorebook' | 'json' | 'html';

export interface RagDocument {
  id: string;
  cardId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

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
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

// ============================================================================
// DIFF TYPES
// ============================================================================

export type DiffOperationType = 'equal' | 'insert' | 'delete' | 'replace' | 'add' | 'remove' | 'unchanged';

export interface DiffOperation {
  type: DiffOperationType;
  value: string;
  text?: string;
  oldText?: string;
  lineNumber?: number;
}

// ============================================================================
// EDITOR FIELD TYPES
// ============================================================================

export type CCFieldName =
  | 'name'
  | 'description'
  | 'personality'
  | 'scenario'
  | 'first_mes'
  | 'mes_example'
  | 'creator'
  | 'creator_notes'
  | 'character_version'
  | 'system_prompt'
  | 'post_history_instructions'
  | 'tags'
  | 'alternate_greetings'
  | 'group_only_greetings';

// FocusField is a string field name used for editor focus
export type FocusField = CCFieldName;

export interface FocusFieldConfig {
  field: CCFieldName;
  label: string;
  multiline: boolean;
  placeholder?: string;
}

// ============================================================================
// ASSET EXTENDED TYPES
// ============================================================================

export type AssetType = 'icon' | 'background' | 'emotion' | 'avatar' | 'gallery' | 'audio' | 'video' | 'sound' | 'custom' | 'other' | 'package-original';

export interface AssetMetadata {
  type: AssetType;
  tags: AssetTag[];
  actorIndex?: number;
  isAnimated?: boolean;
  order: number;
  format: string;
}

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
// FIELD CONTEXT TYPES (for LLM assist)
// ============================================================================

export interface RagContextSnippet {
  id: string;
  sourceId: string;
  sourceName: string;
  content: string;
  score: number;
}

export interface FieldContext {
  fieldName?: string;
  field?: string;
  currentValue?: string;
  spec?: 'v2' | 'v3' | 'collection';
  cardName?: string;
  cardData?: Record<string, unknown>;
  selection?: string;
  otherFields?: Record<string, string>;
  loreEntries?: string[];
  ragSnippets?: RagContextSnippet[];
}

// ============================================================================
// LOREBOOK TYPES
// ============================================================================

export interface CCv3LorebookEntry {
  keys: string[];
  content: string;
  extensions?: Record<string, unknown>;
  enabled?: boolean;
  insertion_order?: number;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
  depth?: number;
  probability?: number;
}

// ============================================================================
// SNIPPET & TEMPLATE CATEGORY TYPES
// ============================================================================

export type SnippetCategory = 'general' | 'personality' | 'scenario' | 'dialogue' | 'custom' | string;

export type TemplateCategory = 'general' | 'fantasy' | 'modern' | 'sci-fi' | 'custom' | string;
