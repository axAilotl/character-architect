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
  if (spec === 'v2' && 'spec' in obj) {
    if (obj.spec !== 'chara_card_v2') {
      obj.spec = 'chara_card_v2';
    }
    if (!obj.spec_version || typeof obj.spec_version !== 'string' || !obj.spec_version.startsWith('2')) {
      obj.spec_version = '2.0';
    }
  }

  // Fix wrapped v3 cards with non-standard spec values
  if (spec === 'v3' && 'spec' in obj) {
    if (obj.spec !== 'chara_card_v3') {
      obj.spec = 'chara_card_v3';
    }
    if (!obj.spec_version || typeof obj.spec_version !== 'string' || !obj.spec_version.startsWith('3')) {
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
      const nullableOptionalFields = [
        'assets',
        'creator_notes_multilingual',
        'source',
        'creation_date',
        'modification_date',
      ];

      for (const field of nullableOptionalFields) {
        if (dataObj[field] === null) {
          delete dataObj[field];
        }
      }

      const TIMESTAMP_THRESHOLD = 10000000000; // 10-digit = seconds, 13-digit = milliseconds
      const normalizeTimestamp = (field: 'creation_date' | 'modification_date') => {
        const value = dataObj[field];

        if (typeof value === 'number') {
          if (!Number.isFinite(value)) {
            delete dataObj[field];
            return;
          }

          // CharacterTavern exports milliseconds
          if (value > TIMESTAMP_THRESHOLD) {
            dataObj[field] = Math.floor(value / 1000);
          }
          return;
        }

        if (typeof value === 'string') {
          const raw = value.trim();
          if (!raw) {
            delete dataObj[field];
            return;
          }

          // Numeric string timestamps (seconds or milliseconds)
          if (/^\\d+$/.test(raw)) {
            const num = Number.parseInt(raw, 10);
            if (!Number.isFinite(num)) {
              delete dataObj[field];
              return;
            }
            dataObj[field] = num > TIMESTAMP_THRESHOLD ? Math.floor(num / 1000) : num;
            return;
          }

          // ISO date strings
          const ms = Date.parse(raw);
          if (Number.isNaN(ms)) {
            delete dataObj[field];
            return;
          }
          dataObj[field] = Math.floor(ms / 1000);
          return;
        }

        // Unsupported type for schema (must be number); drop to preserve compatibility.
        if (value !== undefined) {
          delete dataObj[field];
        }
      };

      // Optional string fields that are commonly null in the wild
      const optionalStrings = ['creator_notes', 'system_prompt', 'post_history_instructions', 'nickname'];
      for (const field of optionalStrings) {
        if (dataObj[field] === null) {
          delete dataObj[field];
        }
      }

      const requiredStrings = [
        'name',
        'description',
        'personality',
        'scenario',
        'first_mes',
        'mes_example',
        'creator',
        'character_version',
      ];

      for (const field of requiredStrings) {
        if (!(field in dataObj) || dataObj[field] === null || dataObj[field] === undefined) {
          dataObj[field] = '';
        } else if (typeof dataObj[field] !== 'string') {
          // Coerce invalid types to keep schema validation lenient.
          dataObj[field] = '';
        }
      }

      // Arrays must be arrays of strings for schema validation.
      if (Array.isArray(dataObj.tags)) {
        dataObj.tags = dataObj.tags.filter((t) => typeof t === 'string');
      } else {
        dataObj.tags = [];
      }
      if (Array.isArray(dataObj.group_only_greetings)) {
        dataObj.group_only_greetings = dataObj.group_only_greetings.filter((t) => typeof t === 'string');
      } else {
        dataObj.group_only_greetings = [];
      }
      if (!('alternate_greetings' in dataObj) || !Array.isArray(dataObj.alternate_greetings)) {
        dataObj.alternate_greetings = [];
      } else {
        dataObj.alternate_greetings = dataObj.alternate_greetings.filter((t) => typeof t === 'string');
      }

      // `source` should be an array of strings when present.
      if (typeof dataObj.source === 'string') {
        dataObj.source = [dataObj.source];
      } else if (Array.isArray(dataObj.source)) {
        dataObj.source = dataObj.source.filter((s) => typeof s === 'string');
      } else if (dataObj.source !== undefined) {
        delete dataObj.source;
      }

      // `assets` should be an array of typed descriptors. Drop invalid entries/types.
      const allowedAssetTypes = new Set([
        'icon',
        'background',
        'emotion',
        'user_icon',
        'sound',
        'video',
        'custom',
        'x-risu-asset',
      ]);
      if (Array.isArray(dataObj.assets)) {
        dataObj.assets = dataObj.assets.filter((a) => {
          if (!a || typeof a !== 'object') return false;
          const asset = a as Record<string, unknown>;
          const type = asset.type;
          return (
            typeof type === 'string' &&
            allowedAssetTypes.has(type) &&
            typeof asset.uri === 'string' &&
            typeof asset.name === 'string' &&
            typeof asset.ext === 'string'
          );
        });
        if ((dataObj.assets as unknown[]).length === 0) delete dataObj.assets;
      } else if (dataObj.assets !== undefined) {
        delete dataObj.assets;
      }

      normalizeTimestamp('creation_date');
      normalizeTimestamp('modification_date');
    }
  } else if ('character_book' in obj && obj.character_book === null) {
    delete obj.character_book;
  } else if ('character_book' in obj) {
    normalizeLorebookEntries(obj);
  }

  // Add missing required V2 fields (both wrapped/unwrapped) with defaults
  if (spec === 'v2') {
    const target = ('data' in obj && obj.data && typeof obj.data === 'object')
      ? (obj.data as Record<string, unknown>)
      : obj;

    const requiredStrings = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'];
    for (const field of requiredStrings) {
      if (!(field in target) || target[field] === null || target[field] === undefined) {
        target[field] = '';
      }
    }

    if ('alternate_greetings' in target && target.alternate_greetings !== undefined && !Array.isArray(target.alternate_greetings)) {
      target.alternate_greetings = [];
    }
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

  // Coerce common metadata fields to schema-compatible types.
  const coerceInt = (value: unknown): number | undefined => {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : undefined;
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return undefined;
      if (/^\\d+$/.test(raw)) return Number.parseInt(raw, 10);
      const num = Number(raw);
      return Number.isFinite(num) ? Math.trunc(num) : undefined;
    }
    return undefined;
  };

  const scanDepth = coerceInt(characterBook.scan_depth);
  if (scanDepth !== undefined) characterBook.scan_depth = scanDepth;
  else if (characterBook.scan_depth !== undefined) delete characterBook.scan_depth;

  const tokenBudget = coerceInt(characterBook.token_budget);
  if (tokenBudget !== undefined) characterBook.token_budget = tokenBudget;
  else if (characterBook.token_budget !== undefined) delete characterBook.token_budget;

  if (typeof characterBook.recursive_scanning === 'string') {
    const raw = characterBook.recursive_scanning.trim().toLowerCase();
    if (raw === 'true') characterBook.recursive_scanning = true;
    else if (raw === 'false') characterBook.recursive_scanning = false;
    else delete characterBook.recursive_scanning;
  } else if (
    characterBook.recursive_scanning !== undefined &&
    typeof characterBook.recursive_scanning !== 'boolean'
  ) {
    delete characterBook.recursive_scanning;
  }

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
