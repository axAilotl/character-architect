/**
 * Card Data Normalization Utilities
 *
 * Functions to normalize card data before validation and storage.
 * Handles common issues like spec values, missing required fields,
 * and character_book normalization.
 */

/**
 * Normalize card data to fix common issues before validation
 * Handles spec values, missing required fields, and character_book normalization
 */
export function normalizeCardData(cardData: unknown, spec: 'v2' | 'v3'): void {
  if (!cardData || typeof cardData !== 'object') return;

  const obj = cardData as Record<string, unknown>;

  // Handle hybrid v2 formats from various exports
  const cardFields = [
    'name',
    'description',
    'personality',
    'scenario',
    'first_mes',
    'mes_example',
    'creator_notes',
    'system_prompt',
    'post_history_instructions',
    'alternate_greetings',
    'character_book',
    'tags',
    'creator',
    'character_version',
    'extensions',
  ];

  if (spec === 'v2' && 'spec' in obj) {
    // Case 1: Has spec/spec_version AND data object, but also has root fields (duplicated)
    // Just strip the root duplicates and use data object
    if ('data' in obj && typeof obj.data === 'object' && obj.data && 'name' in obj) {
      for (const field of cardFields) {
        if (field in obj) {
          delete obj[field];
        }
      }
    }
    // Case 2: Has spec/spec_version but fields at root (no data object)
    // Common from ChubAI exports: { spec: "chara_card_v2", spec_version: "2.0", name: "...", description: "..." }
    else if ('name' in obj && !('data' in obj)) {
      const dataObj: Record<string, unknown> = {};
      for (const field of cardFields) {
        if (field in obj) {
          dataObj[field] = obj[field];
          delete obj[field];
        }
      }
      obj.data = dataObj;
    }
  }

  // Fix wrapped v2 cards with non-standard spec values
  if (spec === 'v2' && 'spec' in obj && obj.spec !== 'chara_card_v2') {
    obj.spec = 'chara_card_v2';
    if (!obj.spec_version) {
      obj.spec_version = '2.0';
    }
  }

  // Fix wrapped v3 cards with non-standard spec values
  if (spec === 'v3' && 'spec' in obj && obj.spec !== 'chara_card_v3') {
    obj.spec = 'chara_card_v3';
    if (!obj.spec_version || !String(obj.spec_version).startsWith('3')) {
      obj.spec_version = '3.0';
    }
  }

  // Handle character_book and add missing V3 required fields
  if ('data' in obj && obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;

    if (dataObj.character_book === null) {
      delete dataObj.character_book;
    }
    normalizeLorebookEntries(dataObj);

    // Add missing required V3 fields with defaults
    if (spec === 'v3') {
      if (!('group_only_greetings' in dataObj)) {
        dataObj.group_only_greetings = [];
      }
      if (!('creator' in dataObj) || !dataObj.creator) {
        dataObj.creator = '';
      }
      if (!('character_version' in dataObj) || !dataObj.character_version) {
        dataObj.character_version = '1.0';
      }
      if (!('tags' in dataObj) || !Array.isArray(dataObj.tags)) {
        dataObj.tags = [];
      }

      // Fix CharacterTavern timestamp format (milliseconds -> seconds)
      // CCv3 spec requires Unix timestamp in seconds, but CharacterTavern exports milliseconds
      const TIMESTAMP_THRESHOLD = 10000000000; // 10-digit = seconds, 13-digit = milliseconds
      if (
        typeof dataObj.creation_date === 'number' &&
        dataObj.creation_date > TIMESTAMP_THRESHOLD
      ) {
        dataObj.creation_date = Math.floor(dataObj.creation_date / 1000);
      }
      if (
        typeof dataObj.modification_date === 'number' &&
        dataObj.modification_date > TIMESTAMP_THRESHOLD
      ) {
        dataObj.modification_date = Math.floor(dataObj.modification_date / 1000);
      }
    }
  } else if ('character_book' in obj && obj.character_book === null) {
    delete obj.character_book;
  } else if ('character_book' in obj) {
    normalizeLorebookEntries(obj);
  }
}

/**
 * Normalize lorebook entry fields to match schema expectations
 * Handles legacy position values (numeric), V3 fields in V2 cards, and other common issues
 */
export function normalizeLorebookEntries(dataObj: Record<string, unknown>): void {
  if (!dataObj.character_book || typeof dataObj.character_book !== 'object') {
    return;
  }

  const characterBook = dataObj.character_book as Record<string, unknown>;
  if (!Array.isArray(characterBook.entries)) {
    return;
  }

  for (const entry of characterBook.entries) {
    if (!entry || typeof entry !== 'object') continue;

    // Ensure all required V2 fields exist with defaults
    // V2 schema requires: keys, content, enabled, insertion_order, extensions
    if (!('keys' in entry) || !Array.isArray(entry.keys)) {
      entry.keys = [];
    }
    if (!('content' in entry) || typeof entry.content !== 'string') {
      entry.content = '';
    }
    if (!('enabled' in entry) || typeof entry.enabled !== 'boolean') {
      entry.enabled = true; // Default to enabled
    }
    if (!('insertion_order' in entry) || typeof entry.insertion_order !== 'number') {
      entry.insertion_order = 100; // Default order
    }
    if (
      !('extensions' in entry) ||
      typeof entry.extensions !== 'object' ||
      entry.extensions === null
    ) {
      entry.extensions = {};
    }

    // Normalize position field
    // Some tools use numeric values (0, 1, 2) instead of string enums
    if ('position' in entry) {
      const position = entry.position;

      // Convert numeric position to string enum
      if (typeof position === 'number') {
        // 0 = before_char, 1+ = after_char (common convention)
        entry.position = position === 0 ? 'before_char' : 'after_char';
      }
      // Handle string values that don't match the enum
      else if (typeof position === 'string') {
        const pos = position.toLowerCase();
        if (pos.includes('before') || pos === '0' || pos === 'before') {
          entry.position = 'before_char';
        } else if (pos.includes('after') || pos === '1' || pos === 'after') {
          entry.position = 'after_char';
        } else if (pos !== 'before_char' && pos !== 'after_char') {
          // Invalid value, default to after_char
          entry.position = 'after_char';
        }
      }
      // Handle null/undefined/other types
      else if (position === null || position === undefined) {
        delete entry.position; // Optional field, can be omitted
      }
    }

    // Move V3-specific fields to extensions for V2 compatibility
    // Some cards (like Lilia) have V3 fields in V2 format which can cause issues
    const v3Fields = [
      'probability',
      'depth',
      'use_regex',
      'scan_frequency',
      'role',
      'group',
      'automation_id',
      'selective_logic',
      'selectiveLogic',
    ];

    // Move V3 fields into extensions to preserve them
    const extensions = entry.extensions as Record<string, unknown>;
    for (const field of v3Fields) {
      if (field in entry && field !== 'extensions') {
        extensions[field] = entry[field];
        delete entry[field];
      }
    }
  }
}

/**
 * Extract name from card data based on spec
 */
export function extractCardName(
  cardData: unknown,
  spec: 'v2' | 'v3'
): string {
  if (!cardData || typeof cardData !== 'object') return 'Untitled';

  const obj = cardData as Record<string, unknown>;

  // V3: Always wrapped
  if (spec === 'v3' && 'data' in obj && typeof obj.data === 'object' && obj.data) {
    const data = obj.data as Record<string, unknown>;
    return (data.name as string) || 'Untitled';
  }

  // V2: Can be wrapped or unwrapped
  if (spec === 'v2') {
    // Wrapped format
    if ('data' in obj && typeof obj.data === 'object' && obj.data) {
      const data = obj.data as Record<string, unknown>;
      return (data.name as string) || 'Untitled';
    }
    // Unwrapped format
    if ('name' in obj && typeof obj.name === 'string') {
      return obj.name;
    }
  }

  return 'Untitled';
}

/**
 * Extract tags from card data based on spec
 */
export function extractCardTags(
  cardData: unknown,
  spec: 'v2' | 'v3'
): string[] {
  if (!cardData || typeof cardData !== 'object') return [];

  const obj = cardData as Record<string, unknown>;

  // V3: Always wrapped
  if (spec === 'v3' && 'data' in obj && typeof obj.data === 'object' && obj.data) {
    const data = obj.data as Record<string, unknown>;
    const tags = data.tags;
    return Array.isArray(tags) ? tags : [];
  }

  // V2: Can be wrapped or unwrapped
  if (spec === 'v2') {
    // Wrapped format
    if ('data' in obj && typeof obj.data === 'object' && obj.data) {
      const data = obj.data as Record<string, unknown>;
      const tags = data.tags;
      return Array.isArray(tags) ? tags : [];
    }
    // Unwrapped format
    if ('tags' in obj) {
      const tags = obj.tags;
      return Array.isArray(tags) ? tags : [];
    }
  }

  return [];
}

/**
 * Prepare card data for storage (wrap if needed)
 */
export function prepareStorageData(
  cardData: unknown,
  spec: 'v2' | 'v3'
): Record<string, unknown> {
  if (!cardData || typeof cardData !== 'object') {
    return cardData as Record<string, unknown>;
  }

  const obj = cardData as Record<string, unknown>;

  // V3: Already wrapped
  if (spec === 'v3') {
    return obj;
  }

  // V2: Wrap if not already wrapped
  if (spec === 'v2') {
    // Already wrapped
    if ('spec' in obj && obj.spec === 'chara_card_v2' && 'data' in obj) {
      return obj;
    }
    // Needs wrapping (legacy format)
    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: obj,
    };
  }

  return obj;
}
