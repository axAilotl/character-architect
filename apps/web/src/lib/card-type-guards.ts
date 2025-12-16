/**
 * Card Type Guards and Safe Accessors
 *
 * Provides type-safe access to card data regardless of format (v2/v3, wrapped/unwrapped).
 * Leverages utilities from @character-foundry/schemas where possible.
 */

import type { Card, CollectionCard, CollectionData, CardMeta } from './types';
import type {
  CCv2Data,
  CCv3Data,
  CCv3DataInner,
  CCv2Wrapped,
  CharacterBook,
} from '@character-foundry/character-foundry/schemas';
import {
  isV3Card as isV3CardData,
  isV2CardData,
  isWrappedV2 as isWrappedV2Data,
  getV2Data,
  getV3Data,
} from '@character-foundry/character-foundry/schemas';
import type { CardExtensions } from './extension-types';

// ============================================================================
// CARD-LEVEL TYPE GUARDS
// These check the Card wrapper (meta.spec) not just the data
// ============================================================================

/**
 * Check if card is a v3 character card
 */
export function isV3Card(card: Card): card is Card & { meta: CardMeta & { spec: 'v3' | 'chara_card_v3' }; data: CCv3Data } {
  const spec = card.meta.spec;
  return (spec === 'v3' || spec === 'chara_card_v3') && isV3CardData(card.data);
}

/**
 * Check if card is a v2 character card (wrapped or unwrapped)
 */
export function isV2Card(card: Card): card is Card & { meta: CardMeta & { spec: 'v2' | 'chara_card_v2' }; data: CCv2Data | CCv2Wrapped } {
  const spec = card.meta.spec;
  return (spec === 'v2' || spec === 'chara_card_v2') && isV2CardData(card.data);
}

/**
 * Check if card is a collection (Voxta multi-character package)
 */
export function isCollectionCard(card: Card): card is CollectionCard {
  return card.meta.spec === 'collection' && isCollectionData(card.data);
}

/**
 * Check if card is a standalone lorebook
 */
export function isLorebookCard(card: Card): card is Card & { meta: CardMeta & { spec: 'lorebook' } } {
  return card.meta.spec === 'lorebook';
}

/**
 * Check if card is a character card (v2 or v3, not collection or lorebook)
 */
export function isCharacterCard(card: Card): card is Card & { data: CCv2Data | CCv2Wrapped | CCv3Data } {
  return isV2Card(card) || isV3Card(card);
}

// ============================================================================
// DATA-LEVEL TYPE GUARDS
// Re-export with clearer names for internal use
// ============================================================================

/**
 * Check if data is wrapped v2 format { spec: 'chara_card_v2', data: {...} }
 */
export function isWrappedV2(data: unknown): data is CCv2Wrapped {
  return isWrappedV2Data(data);
}

/**
 * Check if data is unwrapped v2 format (direct fields, no wrapper)
 */
export function isUnwrappedV2(data: CCv2Data | CCv2Wrapped): data is CCv2Data {
  return !isWrappedV2Data(data);
}

/**
 * Check if data is collection data
 */
export function isCollectionData(data: unknown): data is CollectionData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'members' in data &&
    Array.isArray((data as CollectionData).members)
  );
}

// ============================================================================
// SAFE ACCESSORS
// Get normalized data regardless of format
// ============================================================================

/**
 * Normalized card fields type - the "unwrapped" shape you actually work with
 */
export interface CardFields {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator?: string;
  creator_notes?: string;
  character_version?: string;
  tags?: string[];
  alternate_greetings?: string[];
  group_only_greetings?: string[];
  system_prompt?: string;
  post_history_instructions?: string;
  extensions?: CardExtensions;
  character_book?: CharacterBook;
}

/**
 * Get normalized card fields from any character card format.
 * Returns the unwrapped data regardless of v2/v3 or wrapped/unwrapped.
 */
export function getCardFields(card: Card): CardFields {
  if (isCollectionCard(card)) {
    // Collections don't have character fields
    return {
      name: card.data.name,
      description: card.data.description || '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator: card.data.creator,
    };
  }

  if (isV3Card(card)) {
    const inner = getV3Data(card.data);
    return {
      name: inner.name,
      description: inner.description,
      personality: inner.personality ?? '',
      scenario: inner.scenario,
      first_mes: inner.first_mes,
      mes_example: inner.mes_example ?? '',
      creator: inner.creator,
      creator_notes: inner.creator_notes,
      character_version: inner.character_version,
      tags: inner.tags,
      alternate_greetings: inner.alternate_greetings,
      group_only_greetings: inner.group_only_greetings,
      system_prompt: inner.system_prompt,
      post_history_instructions: inner.post_history_instructions,
      extensions: inner.extensions as CardExtensions | undefined,
      character_book: inner.character_book ?? undefined,
    };
  }

  if (isV2Card(card)) {
    const v2 = getV2Data(card.data as CCv2Data | CCv2Wrapped);
    return {
      name: v2.name,
      description: v2.description,
      personality: v2.personality ?? '',
      scenario: v2.scenario,
      first_mes: v2.first_mes,
      mes_example: v2.mes_example ?? '',
      creator: v2.creator,
      creator_notes: v2.creator_notes,
      character_version: v2.character_version,
      tags: v2.tags,
      alternate_greetings: v2.alternate_greetings,
      system_prompt: v2.system_prompt,
      post_history_instructions: v2.post_history_instructions,
      extensions: v2.extensions as CardExtensions | undefined,
      character_book: v2.character_book as CharacterBook | undefined,
    };
  }

  // Fallback for unknown format - try to extract what we can
  const data = card.data as Record<string, unknown>;
  const inner = (data.data as Record<string, unknown>) || data;
  return {
    name: (inner.name as string) || '',
    description: (inner.description as string) || '',
    personality: (inner.personality as string) || '',
    scenario: (inner.scenario as string) || '',
    first_mes: (inner.first_mes as string) || '',
    mes_example: (inner.mes_example as string) || '',
    creator: inner.creator as string | undefined,
    extensions: inner.extensions as CardExtensions | undefined,
    character_book: inner.character_book as CharacterBook | undefined,
  };
}

/**
 * Get extensions from a card, handling v2/v3 wrapping
 */
export function getExtensions(card: Card): CardExtensions {
  const fields = getCardFields(card);
  return fields.extensions || {};
}

/**
 * Get character book from a card, handling v2/v3 wrapping
 */
export function getCharacterBook(card: Card): CharacterBook | undefined {
  const fields = getCardFields(card);
  return fields.character_book;
}

/**
 * Get the raw inner data object for direct mutation.
 * For v3: returns the data.data object
 * For wrapped v2: returns the data.data object
 * For unwrapped v2: returns the data object itself
 *
 * WARNING: This returns a reference to the actual data, not a copy.
 * Use for read access or when you know what you're doing.
 */
export function getInnerData(card: Card): CCv3DataInner | CCv2Data {
  if (isV3Card(card)) {
    return card.data.data;
  }

  if (isV2Card(card)) {
    if (isWrappedV2(card.data)) {
      return card.data.data;
    }
    return card.data;
  }

  // Fallback - try to unwrap
  const data = card.data as { data?: unknown };
  if (data.data && typeof data.data === 'object') {
    return data.data as CCv2Data;
  }
  return card.data as CCv2Data;
}

/**
 * Check if a card's data is in wrapped format (v3 or wrapped v2)
 */
export function isWrappedFormat(card: Card): boolean {
  if (isV3Card(card)) return true;
  if (isV2Card(card)) return isWrappedV2(card.data);
  return false;
}
