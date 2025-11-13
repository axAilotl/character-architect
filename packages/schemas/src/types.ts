/**
 * Common types used across CCv2 and CCv3
 */
export type ISO8601 = string;
export type UUID = string;
export type Spec = 'v2' | 'v3';

/**
 * Character Card v2 Types
 * Based on: https://github.com/malfoyslastname/character-card-spec-v2
 */
export interface CCv2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  // Optional fields
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CCv2CharacterBook;
  tags?: string[];
  creator?: string;
  character_version?: string;
  extensions?: Record<string, unknown>;
}

export interface CCv2CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CCv2LorebookEntry[];
}

export interface CCv2LorebookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  // Optional fields
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
}

/**
 * Character Card v3 Types
 * Based on: https://github.com/kwaroran/character-card-spec-v3
 */
export interface CCv3Data {
  spec: 'chara_card_v3';
  spec_version: '3.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    // Required metadata
    creator: string;
    character_version: string;
    tags: string[];
    // Optional fields
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    character_book?: CCv3CharacterBook;
    extensions?: Record<string, unknown>;
    group_only_greetings?: string[];
  };
}

export interface CCv3CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CCv3LorebookEntry[];
}

export interface CCv3LorebookEntry {
  keys: string[];
  content: string;
  enabled: boolean;
  insertion_order: number;
  // Optional fields
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
  extensions?: Record<string, unknown>;
  // v3 specific
  automation_id?: string;
  role?: 'system' | 'user' | 'assistant';
  group?: string;
  scan_frequency?: number;
  probability?: number;
  use_regex?: boolean;
  depth?: number;
  selective_logic?: 'AND' | 'NOT';
}

/**
 * Unified card metadata for internal use
 */
export interface CardMeta {
  id: UUID;
  name: string;
  spec: Spec;
  createdAt: ISO8601;
  updatedAt: ISO8601;
  tags: string[];
  creator?: string;
  characterVersion?: string;
  rating?: 'SFW' | 'NSFW';
}

/**
 * Normalized internal representation
 */
export interface Card {
  meta: CardMeta;
  data: CCv2Data | CCv3Data;
}

/**
 * Version/Snapshot tracking
 */
export interface CardVersion {
  id: UUID;
  cardId: UUID;
  version: number;
  data: CCv2Data | CCv3Data;
  message?: string;
  createdAt: ISO8601;
  createdBy?: string;
}

/**
 * Import/Export formats
 */
export type ExportFormat = 'json' | 'png' | 'charx' | 'voxta';
export type ImportSource = 'json' | 'png';

export interface ImportResult {
  card: Card;
  spec: Spec;
  warnings?: string[];
}

export interface ExportOptions {
  format: ExportFormat;
  minify?: boolean;
  includeMetadata?: boolean;
}

/**
 * Tokenization
 */
export interface TokenizerModel {
  id: string;
  name: string;
  description: string;
  type: 'bpe' | 'sentencepiece' | 'wordpiece';
}

export interface TokenizeRequest {
  model: string;
  payload: Record<string, string>;
}

export interface TokenizeResponse {
  model: string;
  fields: Record<string, number>;
  total: number;
}

/**
 * Validation
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Asset management
 */
export interface Asset {
  id: UUID;
  filename: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  createdAt: ISO8601;
}

export interface AssetTransformOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpg' | 'webp';
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Plugin system
 */
export type PluginCapability = 'import' | 'export' | 'analyze' | 'generate' | 'archive' | 'vcs';

export interface Plugin {
  name: string;
  version: string;
  capabilities: PluginCapability[];
  run(input: unknown, ctx: PluginContext): Promise<unknown>;
}

export interface PluginContext {
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  config: Record<string, unknown>;
}

/**
 * Tokenizer Adapter
 */
export interface TokenizerAdapter {
  id: string;
  estimate(text: string): number;
  estimateMany(texts: string[]): number[];
}

/**
 * Archive Adapter
 */
export interface ArchiveAdapter {
  list(query?: string): Promise<CardMeta[]>;
  read(id: string): Promise<Card>;
  write(card: Card): Promise<void>;
  snapshot?(cardId: string, message?: string): Promise<void>;
}

/**
 * VCS Adapter
 */
export interface VcsAdapter {
  status(): Promise<{ dirty: boolean }>;
  commit(message: string): Promise<void>;
  log(limit?: number): Promise<Array<{ id: string; msg: string; when: ISO8601 }>>;
}

/**
 * LLM Assist System Types
 */

// Provider configuration
export type ProviderKind = 'openai' | 'openai-compatible' | 'anthropic';
export type OpenAIMode = 'responses' | 'chat';

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  label: string;
  baseURL: string;
  apiKey: string;
  organization?: string; // OpenAI org/project
  defaultModel: string;
  mode?: OpenAIMode; // For OpenAI/compatible providers
  streamDefault?: boolean;
  anthropicVersion?: string; // For Anthropic (e.g., "2023-06-01")
  temperature?: number;
  maxTokens?: number;
}

// RAG (Retrieval-Augmented Generation) configuration
export interface RagConfig {
  enabled: boolean;
  topK: number;
  tokenCap: number;
  indexPath: string;
  embedModel: string;
  sources: RagSource[];
}

export interface RagSource {
  id: string;
  path: string;
  title: string;
  type: 'markdown' | 'html' | 'pdf' | 'text';
  indexed: boolean;
  indexedAt?: ISO8601;
}

// LLM settings
export interface LLMSettings {
  providers: ProviderConfig[];
  activeProviderId?: string;
  rag: RagConfig;
}

// LLM message types
export type MessageRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: MessageRole;
  content: string;
}

// LLM invocation request
export interface LLMInvokeRequest {
  providerId: string;
  model: string;
  mode?: OpenAIMode;
  messages: LLMMessage[];
  system?: string; // System message (Anthropic top-level)
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// LLM streaming response
export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// LLM non-streaming response
export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: 'stop' | 'length' | 'content_filter';
}

// Field context for LLM operations
export type CCFieldName =
  | 'description'
  | 'personality'
  | 'scenario'
  | 'first_mes'
  | 'mes_example'
  | 'alternate_greetings'
  | 'system_prompt'
  | 'post_history_instructions'
  | 'creator_notes'
  | 'lore_entry';

export interface FieldContext {
  fieldName: CCFieldName;
  currentValue: string;
  selection?: string;
  otherFields?: Partial<Record<CCFieldName, string>>;
  loreEntries?: string[];
  ragSnippets?: RagSnippet[];
  spec: Spec;
}

// RAG snippet
export interface RagSnippet {
  content: string;
  source: string;
  score: number;
}

// Preset operations
export type PresetOperation =
  | 'tighten'
  | 'convert-structured'
  | 'convert-prose'
  | 'convert-hybrid'
  | 'enforce-style'
  | 'generate-alts'
  | 'generate-lore'
  | 'custom';

export interface PresetConfig {
  operation: PresetOperation;
  params?: Record<string, unknown>;
}

// LLM assist request (from UI)
export interface LLMAssistRequest {
  providerId: string;
  model: string;
  instruction: string;
  context: FieldContext;
  preset?: PresetConfig;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// LLM assist response
export interface LLMAssistResponse {
  original: string;
  revised: string;
  diff?: DiffOperation[];
  tokenDelta: {
    before: number;
    after: number;
    delta: number;
  };
  metadata: {
    provider: string;
    model: string;
    temperature: number;
    promptTokens: number;
    completionTokens: number;
  };
}

// Diff operations for preview
export type DiffOperationType = 'add' | 'remove' | 'unchanged';

export interface DiffOperation {
  type: DiffOperationType;
  value: string;
  lineNumber?: number;
}

// Apply action
export type ApplyAction =
  | 'replace'
  | 'insert-alt-greeting'
  | 'append-example'
  | 'create-lore-entry';

export interface ApplyRequest {
  cardId: UUID;
  fieldName: CCFieldName;
  action: ApplyAction;
  content: string;
  snapshot?: boolean; // Create version snapshot
  snapshotMessage?: string;
}
