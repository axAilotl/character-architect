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
