/**
 * Card Extension Type Definitions
 *
 * Typed interfaces for known extension namespaces used in character cards.
 * Extensions allow frontends to store custom data without breaking compatibility.
 */

// ============================================================================
// VOXTA EXTENSIONS
// ============================================================================

/**
 * Voxta-specific extension data
 * Used by Voxta AI companion app
 */
export interface VoxtaExtension {
  /** Character appearance/visual description for Voxta */
  appearance?: string;
  /** Voxta-specific character ID */
  characterId?: string;
  /** Voice settings */
  voice?: {
    provider?: string;
    voiceId?: string;
    speed?: number;
    pitch?: number;
  };
}

// ============================================================================
// SILLYTAVERN EXTENSIONS
// ============================================================================

/**
 * SillyTavern-specific extension data
 */
export interface SillyTavernExtension {
  /** Talkativeness setting (0-1) */
  talkativeness?: string;
  /** Whether character is a favorite */
  fav?: boolean;
  /** World info/lorebook name */
  world?: string;
  /** Chat completion source */
  chat_completion_source?: string;
}

/**
 * Depth prompt extension (SillyTavern character note)
 * Injects text at a specific position in the chat context
 */
export interface DepthPromptExtension {
  /** The prompt text to inject */
  prompt?: string;
  /** Depth in conversation (0 = most recent) */
  depth?: number;
  /** Role for the injected message */
  role?: 'system' | 'user' | 'assistant';
}

// ============================================================================
// RISUAI EXTENSIONS
// ============================================================================

/**
 * RisuAI-specific extension data
 * Preserved as opaque blob for round-trip compatibility
 */
export interface RisuExtension {
  /** Emotion sprites */
  emotions?: Array<{
    name: string;
    data: string;
  }>;
  /** Additional assets */
  additionalAssets?: Array<{
    name: string;
    data: string;
  }>;
  /** Lua scripts */
  scripts?: unknown[];
}

// ============================================================================
// LOREBOOK ENTRY EXTENSIONS
// ============================================================================

/**
 * SillyTavern-specific lorebook entry extensions
 * Used to store additional entry metadata
 */
export interface LorebookEntryExtensions {
  /** Weight for random selection */
  weight?: number;
  /** Display order in UI */
  displayIndex?: number;
  /** Character filter (name or null for all) */
  characterFilter?: string | null;
  /** Whether to use probability */
  useProbability?: boolean;
  /** Exclude from recursive scanning */
  excludeRecursion?: boolean;
  /** Add entry name as memo in content */
  addMemo?: boolean;
  /** Depth override */
  depth?: number;
  /** Probability override */
  probability?: number;
  /** Allow unknown extensions */
  [key: string]: unknown;
}

/**
 * Get typed lorebook entry extensions
 */
export function getLorebookEntryExtensions(
  ext: Record<string, unknown> | undefined
): LorebookEntryExtensions {
  return (ext || {}) as LorebookEntryExtensions;
}

// ============================================================================
// COMBINED EXTENSIONS TYPE
// ============================================================================

/**
 * All known card extensions
 * Uses index signature to allow unknown extensions for forward compatibility
 */
export interface CardExtensions {
  // Voxta
  voxta?: VoxtaExtension;

  // SillyTavern
  depth_prompt?: DepthPromptExtension;
  talkativeness?: string;
  fav?: boolean;
  world?: string;

  // Visual description (common across platforms)
  visual_description?: string;

  // RisuAI (opaque)
  risuai?: RisuExtension;

  // Chub-specific
  chub?: {
    alt_expressions?: Record<string, string>;
    full_path?: string;
  };

  // Allow unknown extensions
  [key: string]: unknown;
}

// ============================================================================
// TYPE-SAFE EXTENSION ACCESSORS
// ============================================================================

/**
 * Get Voxta extension data with type safety
 */
export function getVoxtaExtension(ext: CardExtensions | undefined): VoxtaExtension | undefined {
  return ext?.voxta;
}

/**
 * Get depth prompt (character note) extension with type safety
 */
export function getDepthPrompt(ext: CardExtensions | undefined): DepthPromptExtension | undefined {
  return ext?.depth_prompt;
}

/**
 * Get visual description from extensions (checks multiple locations)
 */
export function getVisualDescription(ext: CardExtensions | undefined): string | undefined {
  if (!ext) return undefined;
  // Check Voxta appearance first, then generic visual_description
  return ext.voxta?.appearance || ext.visual_description;
}

/**
 * Check if extensions have Voxta data
 */
export function hasVoxtaExtension(ext: CardExtensions | undefined): boolean {
  return ext?.voxta !== undefined;
}

/**
 * Check if extensions have depth prompt
 */
export function hasDepthPrompt(ext: CardExtensions | undefined): boolean {
  return ext?.depth_prompt !== undefined && !!ext.depth_prompt.prompt;
}

// ============================================================================
// EXTENSION MERGE UTILITIES
// ============================================================================

/**
 * Merge extension updates into existing extensions
 * Returns a new object, does not mutate
 */
export function mergeExtensions(
  existing: CardExtensions | undefined,
  updates: Partial<CardExtensions>
): CardExtensions {
  return {
    ...existing,
    ...updates,
  };
}

/**
 * Set a specific extension namespace
 * Returns a new object, does not mutate
 */
export function setExtensionNamespace<K extends keyof CardExtensions>(
  existing: CardExtensions | undefined,
  key: K,
  value: CardExtensions[K]
): CardExtensions {
  return {
    ...existing,
    [key]: value,
  };
}

/**
 * Update Voxta extension (merge with existing)
 */
export function updateVoxtaExtension(
  ext: CardExtensions | undefined,
  updates: Partial<VoxtaExtension>
): CardExtensions {
  return {
    ...ext,
    voxta: {
      ...ext?.voxta,
      ...updates,
    },
  };
}

/**
 * Update depth prompt extension (merge with existing)
 */
export function updateDepthPrompt(
  ext: CardExtensions | undefined,
  updates: Partial<DepthPromptExtension>
): CardExtensions {
  return {
    ...ext,
    depth_prompt: {
      ...ext?.depth_prompt,
      ...updates,
    },
  };
}
