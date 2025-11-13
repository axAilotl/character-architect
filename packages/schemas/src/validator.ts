import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ccv2Schema, ccv3Schema } from './schemas.js';
import type { CCv2Data, CCv3Data, ValidationError, ValidationResult } from './types.js';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateCCv2: ValidateFunction = ajv.compile(ccv2Schema);
const validateCCv3: ValidateFunction = ajv.compile(ccv3Schema);

/**
 * Validates a CCv2 card
 */
export function validateV2(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Schema validation
  const valid = validateCCv2(data);
  if (!valid && validateCCv2.errors) {
    for (const err of validateCCv2.errors) {
      errors.push({
        field: err.instancePath || 'root',
        message: err.message || 'Validation error',
        severity: 'error',
      });
    }
  }

  // Semantic validation
  if (valid) {
    const card = data as CCv2Data;
    errors.push(...performSemanticValidation(card));
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
  };
}

/**
 * Validates a CCv3 card
 */
export function validateV3(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Schema validation
  const valid = validateCCv3(data);
  if (!valid && validateCCv3.errors) {
    for (const err of validateCCv3.errors) {
      errors.push({
        field: err.instancePath || 'root',
        message: err.message || 'Validation error',
        severity: 'error',
      });
    }
  }

  // Semantic validation
  if (valid) {
    const card = data as CCv3Data;
    errors.push(...performSemanticValidation(card.data));
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
  };
}

/**
 * Semantic validation rules
 */
function performSemanticValidation(card: CCv2Data | CCv3Data['data']): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for empty required fields
  if (!card.name?.trim()) {
    errors.push({
      field: 'name',
      message: 'Name cannot be empty',
      severity: 'error',
    });
  }

  // Check for placeholder text
  const placeholderPatterns = [
    /\{\{char\}\}/i,
    /\{\{user\}\}/i,
    /\[YOUR NAME\]/i,
    /\[CHARACTER NAME\]/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(card.name)) {
      errors.push({
        field: 'name',
        message: 'Name contains placeholder text',
        severity: 'warning',
        suggestion: 'Replace placeholder with actual character name',
      });
    }
  }

  // Check for redundant information
  if (card.description && card.personality) {
    const descWords = new Set(card.description.toLowerCase().split(/\s+/));
    const persWords = card.personality.toLowerCase().split(/\s+/);
    const overlap = persWords.filter((w) => descWords.has(w)).length;

    if (overlap > persWords.length * 0.5) {
      errors.push({
        field: 'personality',
        message: 'Personality field overlaps significantly with description',
        severity: 'info',
        suggestion: 'Consider consolidating or differentiating these fields',
      });
    }
  }

  // Check character book entries
  if (card.character_book?.entries) {
    for (let i = 0; i < card.character_book.entries.length; i++) {
      const entry = card.character_book.entries[i];

      if (!entry.keys || entry.keys.length === 0) {
        errors.push({
          field: `character_book.entries[${i}].keys`,
          message: 'Lorebook entry has no keywords',
          severity: 'error',
        });
      }

      if (!entry.content?.trim()) {
        errors.push({
          field: `character_book.entries[${i}].content`,
          message: 'Lorebook entry has empty content',
          severity: 'warning',
        });
      }

      if (entry.selective && (!entry.secondary_keys || entry.secondary_keys.length === 0)) {
        errors.push({
          field: `character_book.entries[${i}].secondary_keys`,
          message: 'Selective entry should have secondary keys',
          severity: 'warning',
          suggestion: 'Add secondary keys or disable selective mode',
        });
      }
    }
  }

  return errors;
}

/**
 * Detects which spec version a JSON object uses
 */
export function detectSpec(data: unknown): 'v2' | 'v3' | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // v3 has explicit spec field
  if (obj.spec === 'chara_card_v3') {
    // Accept both 3.0 and other minor versions
    if (typeof obj.spec_version === 'string' && obj.spec_version.startsWith('3.')) {
      return 'v3';
    }
    // Accept numeric version (some tools might export as number)
    if (typeof obj.spec_version === 'number' && obj.spec_version >= 3.0) {
      return 'v3';
    }
    // Some cards might not have spec_version, treat as v3 anyway
    if (!obj.spec_version) {
      return 'v3';
    }
    // If spec is v3 but version doesn't match, still try to validate as v3
    // since the spec field is the primary indicator
    return 'v3';
  }

  // Check for Chub v2 format (wrapped with spec field)
  if (obj.spec === 'chara_card_v2') {
    return 'v2';
  }

  // Check for version field indicating v2
  if (obj.spec_version === '2.0' || obj.spec_version === 2.0) {
    return 'v2';
  }

  // Check if it's a wrapped card (has spec and data fields) but spec detection failed
  if (obj.spec && obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    // If data has a name field, it's likely a wrapped format
    if (dataObj.name && typeof dataObj.name === 'string') {
      // Try to infer from spec field
      if (typeof obj.spec === 'string') {
        if (obj.spec.includes('v3') || obj.spec.includes('3')) {
          return 'v3';
        }
        if (obj.spec.includes('v2') || obj.spec.includes('2')) {
          return 'v2';
        }
      }
      // Default wrapped format to v3 (more common modern format)
      return 'v3';
    }
  }

  // v2 is the default/legacy format (direct fields, not wrapped)
  if (obj.name && typeof obj.name === 'string') {
    // Make sure it has other typical v2 fields
    if ('description' in obj || 'personality' in obj || 'scenario' in obj) {
      return 'v2';
    }
  }

  return null;
}
