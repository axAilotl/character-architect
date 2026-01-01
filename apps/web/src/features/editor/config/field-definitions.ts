/**
 * Schema-Driven Field Definitions for EditPanel
 *
 * This configuration defines all editable fields for character cards,
 * replacing the hardcoded JSX in EditPanel.tsx with a declarative schema.
 *
 * Benefits:
 * - Single source of truth for field metadata
 * - ~80% code reduction in EditPanel
 * - Easy to add new fields or modify existing ones
 * - Type-safe field definitions
 */

import type { CCFieldName } from '../../../lib/types';

// ============================================================================
// FIELD TYPE DEFINITIONS
// ============================================================================

export type FieldType =
  | 'text' // Single line input
  | 'textarea' // Multi-line text
  | 'number' // Numeric input
  | 'tags' // Tag input with autocomplete
  | 'array' // Array of strings (e.g., alternate_greetings)
  | 'map' // Key-value pairs (e.g., creator_notes_multilingual)
  | 'extension' // Field stored in extensions object
  | 'readonly'; // Display-only field

export type SpecMarker = 'v2' | 'v3' | 'v3only' | 'extension' | 'voxta';

export type TabId = 'basic' | 'character' | 'greetings' | 'advanced';

// ============================================================================
// FIELD DEFINITION INTERFACE
// ============================================================================

export interface FieldDefinition {
  /** Unique field identifier (matches CCFieldName or extension path) */
  id: string;
  /** Display label */
  label: string;
  /** Which tab this field appears on */
  tab: TabId;
  /**
   * Path in card data:
   * - 'name' -> cardData.name
   * - 'extensions.depth_prompt.prompt' -> cardData.extensions.depth_prompt.prompt
   */
  path: string;
  /** Field type determines which renderer to use */
  type: FieldType;
  /** Which specs this field applies to ('v2' | 'v3' | 'both') */
  specs: Array<'v2' | 'v3'>;
  /** Order within tab (lower = earlier) */
  order: number;
  /** Whether field is required */
  required?: boolean;
  /** Default value for new cards */
  defaultValue?: unknown;
  /** Placeholder text */
  placeholder?: string;
  /** Help text shown below field */
  helpText?: string;
  /** Number of rows for textarea fields */
  rows?: number;
  /** Max length for text fields */
  maxLength?: number;
  /** Whether to show token count */
  showTokens?: boolean;
  /** Token count key in tokenCounts object */
  tokenKey?: string;
  /** Whether to show LLM assist button */
  llmAssist?: boolean;
  /** Whether to show templates button (for FocusFields) */
  templatesButton?: boolean;
  /** Spec marker badge to show */
  specMarker?: SpecMarker;
  /** Can generate with AI (tags, tagline) */
  aiGenerate?: boolean;
  /** Min value for number fields */
  min?: number;
  /** Max value for number fields */
  max?: number;
  /**
   * Conditional visibility:
   * - 'v3only' - only show when showV3Fields setting is true AND card is v3
   * - 'v3setting' - only show when showV3Fields setting is true
   * - 'hasExtension:voxta' - only show when card has voxta extension
   */
  visibleWhen?: 'v3only' | 'v3setting' | 'always' | string;
  /** CCFieldName for LLM assist context */
  fieldName?: CCFieldName;
  /** For arrays: label for each item */
  itemLabel?: string;
  /** For arrays: add button text */
  addButtonText?: string;
}

// ============================================================================
// BASIC INFO TAB FIELDS
// ============================================================================

const basicFields: FieldDefinition[] = [
  // Note: Avatar is handled separately as a special image upload component
  {
    id: 'name',
    label: 'Name',
    tab: 'basic',
    path: 'name',
    type: 'text',
    specs: ['v2', 'v3'],
    order: 10,
    required: true,
    showTokens: true,
    tokenKey: 'name',
    llmAssist: true,
    fieldName: 'name',
  },
  {
    id: 'nickname',
    label: 'Nickname',
    tab: 'basic',
    path: 'nickname',
    type: 'text',
    specs: ['v2', 'v3'],
    order: 20,
    placeholder: 'Short nickname (used for {{char}} replacement)',
    helpText:
      'If set, {{char}}, <char>, and <bot> will be replaced with this instead of the name',
  },
  {
    id: 'tags',
    label: 'Tags',
    tab: 'basic',
    path: 'tags',
    type: 'tags',
    specs: ['v2', 'v3'],
    order: 30,
    aiGenerate: true,
  },
  {
    id: 'creator',
    label: 'Creator',
    tab: 'basic',
    path: 'creator',
    type: 'text',
    specs: ['v2', 'v3'],
    order: 40,
    placeholder: 'Creator name',
  },
  {
    id: 'character_version',
    label: 'Character Version',
    tab: 'basic',
    path: 'character_version',
    type: 'text',
    specs: ['v2', 'v3'],
    order: 50,
    placeholder: '1.0',
  },
  {
    id: 'tagline',
    label: 'Tagline / Short Description',
    tab: 'basic',
    path: 'extensions.tagline',
    type: 'extension',
    specs: ['v2', 'v3'],
    order: 60,
    maxLength: 500,
    placeholder: 'A brief, catchy description of this character...',
    helpText: 'A short tagline for display on card hosting sites. Max 500 characters.',
    specMarker: 'extension',
    aiGenerate: true,
  },
  {
    id: 'timestamps',
    label: 'Metadata Timestamps',
    tab: 'basic',
    path: '_timestamps',
    type: 'readonly',
    specs: ['v3'],
    order: 70,
    visibleWhen: 'v3setting',
    specMarker: 'v3only',
  },
];

// ============================================================================
// CHARACTER TAB FIELDS
// ============================================================================

const characterFields: FieldDefinition[] = [
  {
    id: 'description',
    label: 'Description',
    tab: 'character',
    path: 'description',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 10,
    rows: 16,
    showTokens: true,
    tokenKey: 'description',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'description',
  },
  {
    id: 'scenario',
    label: 'Scenario',
    tab: 'character',
    path: 'scenario',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 20,
    rows: 10,
    showTokens: true,
    tokenKey: 'scenario',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'scenario',
  },
  {
    id: 'personality',
    label: 'Personality',
    tab: 'character',
    path: 'personality',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 30,
    rows: 10,
    showTokens: true,
    tokenKey: 'personality',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'personality',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    tab: 'character',
    path: 'extensions.visual_description',
    type: 'extension',
    specs: ['v2', 'v3'],
    order: 40,
    rows: 8,
    showTokens: true,
    tokenKey: 'appearance',
    llmAssist: true,
    templatesButton: true,
    specMarker: 'extension',
    helpText:
      'Physical description used by Voxta and Wyvern as a prompt for Image Diffusion models. Stored in extensions.',
    placeholder: "Character's physical appearance...",
  },
];

// ============================================================================
// GREETINGS TAB FIELDS
// ============================================================================

const greetingsFields: FieldDefinition[] = [
  {
    id: 'first_mes',
    label: 'First Message',
    tab: 'greetings',
    path: 'first_mes',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 10,
    rows: 12,
    showTokens: true,
    tokenKey: 'first_mes',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'first_mes',
  },
  {
    id: 'alternate_greetings',
    label: 'Alternate Greetings',
    tab: 'greetings',
    path: 'alternate_greetings',
    type: 'array',
    specs: ['v2', 'v3'],
    order: 20,
    rows: 5,
    showTokens: true,
    llmAssist: true,
    templatesButton: true,
    helpText:
      'Each greeting opens like the First Message. Modify existing ones or add new ones individually.',
    itemLabel: 'Greeting',
    addButtonText: '+ Add Alternate Greeting',
  },
  {
    id: 'group_only_greetings',
    label: 'Group Only Greetings',
    tab: 'greetings',
    path: 'group_only_greetings',
    type: 'array',
    specs: ['v3'],
    order: 30,
    rows: 3,
    visibleWhen: 'v3setting',
    specMarker: 'v3only',
    helpText: 'Greetings that are only used in group chats. These will not be shown in solo conversations.',
    itemLabel: 'Group Greeting',
    addButtonText: '+ Add Group Greeting',
  },
];

// ============================================================================
// ADVANCED TAB FIELDS
// ============================================================================

const advancedFields: FieldDefinition[] = [
  {
    id: 'system_prompt',
    label: 'System Prompt',
    tab: 'advanced',
    path: 'system_prompt',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 10,
    rows: 8,
    showTokens: true,
    tokenKey: 'system_prompt',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'system_prompt',
  },
  {
    id: 'post_history_instructions',
    label: 'Post History Instructions',
    tab: 'advanced',
    path: 'post_history_instructions',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 20,
    rows: 8,
    showTokens: true,
    tokenKey: 'post_history_instructions',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'post_history_instructions',
  },
  {
    id: 'mes_example',
    label: 'Example Messages',
    tab: 'advanced',
    path: 'mes_example',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 30,
    rows: 10,
    showTokens: true,
    tokenKey: 'mes_example',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'mes_example',
  },
  {
    id: 'creator_notes',
    label: 'Creator Notes',
    tab: 'advanced',
    path: 'creator_notes',
    type: 'textarea',
    specs: ['v2', 'v3'],
    order: 40,
    rows: 8,
    showTokens: true,
    tokenKey: 'creator_notes',
    llmAssist: true,
    templatesButton: true,
    fieldName: 'creator_notes',
    helpText: 'Not rendered in preview. Used for notes to other users/creators.',
  },
  {
    id: 'character_note',
    label: 'Character Note',
    tab: 'advanced',
    path: 'extensions.depth_prompt.prompt',
    type: 'extension',
    specs: ['v2', 'v3'],
    order: 50,
    rows: 6,
    showTokens: true,
    tokenKey: 'character_note',
    llmAssist: true,
    templatesButton: true,
    specMarker: 'extension',
    helpText: 'SillyTavern Character Note. Injected at the specified depth in conversation.',
    placeholder: 'Character note content...',
  },
  {
    id: 'character_note_depth',
    label: 'Character Note Depth',
    tab: 'advanced',
    path: 'extensions.depth_prompt.depth',
    type: 'number',
    specs: ['v2', 'v3'],
    order: 51, // Right after character_note
    defaultValue: 4,
    min: 0,
    max: 100,
  },
  {
    id: 'source',
    label: 'Source URLs',
    tab: 'advanced',
    path: 'source',
    type: 'array',
    specs: ['v3'],
    order: 60,
    visibleWhen: 'v3setting',
    specMarker: 'v3only',
    helpText: 'URLs or IDs pointing to the source of this character card.',
    itemLabel: 'Source URL',
    addButtonText: '+ Add Source URL',
    placeholder: 'https://...',
  },
  {
    id: 'creator_notes_multilingual',
    label: 'Multilingual Creator Notes',
    tab: 'advanced',
    path: 'creator_notes_multilingual',
    type: 'map',
    specs: ['v3'],
    order: 70,
    visibleWhen: 'v3setting',
    specMarker: 'v3only',
    helpText: 'Creator notes in multiple languages (ISO 639-1 language codes).',
    rows: 3,
    addButtonText: '+ Add Language',
    placeholder: 'en',
  },
];

// ============================================================================
// COMBINED FIELD REGISTRY
// ============================================================================

export const fieldDefinitions: FieldDefinition[] = [
  ...basicFields,
  ...characterFields,
  ...greetingsFields,
  ...advancedFields,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all fields for a specific tab
 */
export function getFieldsForTab(tab: TabId): FieldDefinition[] {
  return fieldDefinitions.filter((f) => f.tab === tab).sort((a, b) => a.order - b.order);
}

/**
 * Get a field by its ID
 */
export function getFieldById(id: string): FieldDefinition | undefined {
  return fieldDefinitions.find((f) => f.id === id);
}

/**
 * Filter fields by spec
 */
export function filterFieldsBySpec(fields: FieldDefinition[], spec: 'v2' | 'v3'): FieldDefinition[] {
  return fields.filter((f) => f.specs.includes(spec));
}

/**
 * Check if a field should be visible based on visibility condition
 */
export function isFieldVisible(
  field: FieldDefinition,
  options: {
    spec: 'v2' | 'v3';
    showV3Fields: boolean;
    hasVoxtaExtension?: boolean;
  }
): boolean {
  // First check if spec matches
  if (!field.specs.includes(options.spec)) {
    return false;
  }

  // Then check visibility conditions
  switch (field.visibleWhen) {
    case 'v3only':
      return options.showV3Fields && options.spec === 'v3';
    case 'v3setting':
      return options.showV3Fields;
    case 'always':
    case undefined:
      return true;
    default:
      // Handle custom visibility conditions like 'hasExtension:voxta'
      if (field.visibleWhen?.startsWith('hasExtension:')) {
        const extName = field.visibleWhen.split(':')[1];
        if (extName === 'voxta') return !!options.hasVoxtaExtension;
      }
      return true;
  }
}

/**
 * Get the value from card data using dot notation path
 */
export function getValueByPath(data: Record<string, unknown>, path: string): unknown {
  if (!path || path.startsWith('_')) return undefined;

  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in card data using dot notation path
 * Returns a new object with the value set (immutable)
 */
export function setValueByPath(
  data: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  if (!path || path.startsWith('_')) return data;

  const parts = path.split('.');
  const result = { ...data };

  if (parts.length === 1) {
    result[parts[0]] = value;
    return result;
  }

  // For nested paths, recursively build the structure
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    } else {
      current[part] = { ...(current[part] as Record<string, unknown>) };
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

// ============================================================================
// TAB DEFINITIONS (for tab rendering)
// ============================================================================

export interface TabDefinition {
  id: TabId;
  label: string;
  order: number;
  /** Tab is hidden in light mode */
  serverOnly?: boolean;
  /** Settings key that controls visibility */
  visibleWhen?: string;
}

export const tabDefinitions: TabDefinition[] = [
  { id: 'basic', label: 'Basic Info', order: 1 },
  { id: 'character', label: 'Character', order: 2 },
  { id: 'greetings', label: 'Greetings', order: 3 },
  { id: 'advanced', label: 'Advanced', order: 4 },
  // Note: 'lorebook', 'elara-voss', 'extensions' tabs are handled separately
];
