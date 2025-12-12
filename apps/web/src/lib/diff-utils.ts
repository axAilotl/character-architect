/**
 * Diff Utilities
 *
 * Semantic diffing utilities using jsondiffpatch for character cards and lorebooks.
 * Provides entry-level lorebook diffing with intelligent matching.
 */

import * as jsondiffpatch from 'jsondiffpatch';
import type { Delta } from 'jsondiffpatch';
import type { Card, CCv3LorebookEntry, CCv2Data, CCv3Data } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type DiffViewMode = 'unified' | 'split' | 'lorebook';

export type EntryDiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface FieldChange {
  field: string;
  original: unknown;
  current: unknown;
}

export interface EntryDiffResult {
  entryId: string | number;
  entryName: string;
  status: EntryDiffStatus;
  originalIndex?: number;
  currentIndex?: number;
  originalEntry?: CCv3LorebookEntry;
  currentEntry?: CCv3LorebookEntry;
  fieldChanges?: FieldChange[];
  moved?: boolean;
  movedFrom?: number;
  movedTo?: number;
}

export interface LorebookDiffSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

export interface LorebookDiff {
  settingsChanged: boolean;
  settingsDelta?: Delta;
  entrySummary: LorebookDiffSummary;
  entryDiffs: EntryDiffResult[];
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CCv3LorebookEntry[];
}

export interface CardDiff {
  hasChanges: boolean;
  delta?: Delta;
  lorebookDiff?: LorebookDiff;
}

// ============================================================================
// JSONDIFFPATCH CONFIGURATION
// ============================================================================

/**
 * Create a configured jsondiffpatch instance for character card diffing.
 * Uses intelligent object hashing for lorebook entries.
 */
export function createJsonDiffPatcher(): jsondiffpatch.DiffPatcher {
  return jsondiffpatch.create({
    // Use custom object hash for array items (lorebook entries)
    objectHash: (item: unknown, index?: number): string => {
      const entry = item as CCv3LorebookEntry;

      // Primary: match by numeric id if present
      if (typeof entry?.id === 'number') {
        return `id:${entry.id}`;
      }

      // Secondary: composite key from name + keys + insertion_order
      const name = entry?.name || '';
      const keys = Array.isArray(entry?.keys) ? entry.keys.sort().join(',') : '';
      const order = entry?.insertion_order ?? index ?? 0;

      return `${name}|${keys}|${order}`;
    },
    arrays: {
      detectMove: true,
      includeValueOnMove: false,
    },
  });
}

// Singleton instance
let diffPatcher: jsondiffpatch.DiffPatcher | null = null;

export function getDiffPatcher(): jsondiffpatch.DiffPatcher {
  if (!diffPatcher) {
    diffPatcher = createJsonDiffPatcher();
  }
  return diffPatcher;
}

// ============================================================================
// LOREBOOK EXTRACTION
// ============================================================================

/**
 * Extract character_book from a card, handling both V2 and V3 formats.
 */
export function getLorebookFromCard(card: Card): CharacterBook | null {
  if (!card?.data) return null;

  const data = card.data as CCv2Data | CCv3Data;

  // V3 format: { spec, spec_version, data: { character_book } }
  if ('spec' in data && data.spec === 'chara_card_v3') {
    const v3Data = data as CCv3Data;
    return (v3Data.data as { character_book?: CharacterBook })?.character_book || null;
  }

  // V2 wrapped format: { spec, spec_version, data: { character_book } }
  const dataSpec = (data as { spec?: string }).spec;
  if (dataSpec === 'chara_card_v2' && 'data' in data) {
    const wrapped = data as { data: { character_book?: CharacterBook } };
    return wrapped.data?.character_book || null;
  }

  // V2 unwrapped/legacy format: { character_book }
  const unwrapped = data as { character_book?: CharacterBook };
  return unwrapped?.character_book || null;
}

/**
 * Extract character_book from raw card data.
 */
export function getLorebookFromData(data: CCv2Data | CCv3Data | unknown): CharacterBook | null {
  if (!data) return null;

  const cardData = data as Record<string, unknown>;

  // V3 format
  if (cardData.spec === 'chara_card_v3' && cardData.data) {
    const inner = cardData.data as { character_book?: CharacterBook };
    return inner.character_book || null;
  }

  // V2 wrapped format
  if (cardData.spec === 'chara_card_v2' && cardData.data) {
    const inner = cardData.data as { character_book?: CharacterBook };
    return inner.character_book || null;
  }

  // V2 unwrapped/legacy format
  return (cardData as { character_book?: CharacterBook }).character_book || null;
}

// ============================================================================
// LOREBOOK DIFFING
// ============================================================================

/**
 * Compute a semantic diff between two lorebooks with entry-level granularity.
 */
export function computeLorebookDiff(
  original: CharacterBook | null,
  current: CharacterBook | null
): LorebookDiff {
  const patcher = getDiffPatcher();

  // Handle null cases
  if (!original && !current) {
    return {
      settingsChanged: false,
      entrySummary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      entryDiffs: [],
    };
  }

  if (!original && current) {
    // Everything was added
    return {
      settingsChanged: true,
      entrySummary: {
        added: current.entries?.length || 0,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
      entryDiffs: (current.entries || []).map((entry, index) => ({
        entryId: entry.id ?? index,
        entryName: entry.name || `Entry ${index + 1}`,
        status: 'added' as EntryDiffStatus,
        currentIndex: index,
        currentEntry: entry,
      })),
    };
  }

  if (original && !current) {
    // Everything was removed
    return {
      settingsChanged: true,
      entrySummary: {
        added: 0,
        removed: original.entries?.length || 0,
        modified: 0,
        unchanged: 0,
      },
      entryDiffs: (original.entries || []).map((entry, index) => ({
        entryId: entry.id ?? index,
        entryName: entry.name || `Entry ${index + 1}`,
        status: 'removed' as EntryDiffStatus,
        originalIndex: index,
        originalEntry: entry,
      })),
    };
  }

  // Both exist - compute semantic diff
  const originalEntries = original!.entries || [];
  const currentEntries = current!.entries || [];

  // Check settings changes (excluding entries)
  const originalSettings = { ...original, entries: undefined };
  const currentSettings = { ...current, entries: undefined };
  const settingsDelta = patcher.diff(originalSettings, currentSettings);
  const settingsChanged = settingsDelta !== undefined;

  // Build entry maps for matching
  const originalMap = new Map<string, { entry: CCv3LorebookEntry; index: number }>();
  const currentMap = new Map<string, { entry: CCv3LorebookEntry; index: number }>();

  originalEntries.forEach((entry, index) => {
    const key = getEntryKey(entry, index);
    originalMap.set(key, { entry, index });
  });

  currentEntries.forEach((entry, index) => {
    const key = getEntryKey(entry, index);
    currentMap.set(key, { entry, index });
  });

  const entryDiffs: EntryDiffResult[] = [];
  const processedOriginalKeys = new Set<string>();

  // Process current entries
  for (const [key, { entry: currentEntry, index: currentIndex }] of currentMap) {
    const originalData = originalMap.get(key);

    if (!originalData) {
      // New entry
      entryDiffs.push({
        entryId: currentEntry.id ?? currentIndex,
        entryName: currentEntry.name || `Entry ${currentIndex + 1}`,
        status: 'added',
        currentIndex,
        currentEntry,
      });
    } else {
      processedOriginalKeys.add(key);
      const { entry: originalEntry, index: originalIndex } = originalData;

      // Check if modified
      const entryDelta = patcher.diff(originalEntry, currentEntry);
      const moved = originalIndex !== currentIndex;

      if (entryDelta !== undefined) {
        const fieldChanges = extractFieldChanges(originalEntry, currentEntry);
        entryDiffs.push({
          entryId: currentEntry.id ?? originalEntry.id ?? currentIndex,
          entryName: currentEntry.name || originalEntry.name || `Entry ${currentIndex + 1}`,
          status: 'modified',
          originalIndex,
          currentIndex,
          originalEntry,
          currentEntry,
          fieldChanges,
          moved,
          movedFrom: moved ? originalIndex : undefined,
          movedTo: moved ? currentIndex : undefined,
        });
      } else if (moved) {
        // Only moved, not modified
        entryDiffs.push({
          entryId: currentEntry.id ?? originalEntry.id ?? currentIndex,
          entryName: currentEntry.name || originalEntry.name || `Entry ${currentIndex + 1}`,
          status: 'unchanged',
          originalIndex,
          currentIndex,
          originalEntry,
          currentEntry,
          moved: true,
          movedFrom: originalIndex,
          movedTo: currentIndex,
        });
      } else {
        // Unchanged
        entryDiffs.push({
          entryId: currentEntry.id ?? originalEntry.id ?? currentIndex,
          entryName: currentEntry.name || originalEntry.name || `Entry ${currentIndex + 1}`,
          status: 'unchanged',
          originalIndex,
          currentIndex,
          originalEntry,
          currentEntry,
        });
      }
    }
  }

  // Find removed entries
  for (const [key, { entry: originalEntry, index: originalIndex }] of originalMap) {
    if (!processedOriginalKeys.has(key)) {
      entryDiffs.push({
        entryId: originalEntry.id ?? originalIndex,
        entryName: originalEntry.name || `Entry ${originalIndex + 1}`,
        status: 'removed',
        originalIndex,
        originalEntry,
      });
    }
  }

  // Sort by current index (or original for removed)
  entryDiffs.sort((a, b) => {
    const aIndex = a.currentIndex ?? a.originalIndex ?? 0;
    const bIndex = b.currentIndex ?? b.originalIndex ?? 0;
    return aIndex - bIndex;
  });

  // Compute summary
  const entrySummary: LorebookDiffSummary = {
    added: entryDiffs.filter(d => d.status === 'added').length,
    removed: entryDiffs.filter(d => d.status === 'removed').length,
    modified: entryDiffs.filter(d => d.status === 'modified').length,
    unchanged: entryDiffs.filter(d => d.status === 'unchanged').length,
  };

  return {
    settingsChanged,
    settingsDelta,
    entrySummary,
    entryDiffs,
  };
}

/**
 * Generate a unique key for a lorebook entry for matching.
 */
function getEntryKey(entry: CCv3LorebookEntry, index: number): string {
  // Primary: numeric id
  if (typeof entry.id === 'number') {
    return `id:${entry.id}`;
  }

  // Secondary: composite key
  const name = entry.name || '';
  const keys = Array.isArray(entry.keys) ? entry.keys.sort().join(',') : '';
  const order = entry.insertion_order ?? index;

  return `${name}|${keys}|${order}`;
}

/**
 * Extract field-level changes between two entries.
 */
function extractFieldChanges(
  original: CCv3LorebookEntry,
  current: CCv3LorebookEntry
): FieldChange[] {
  const changes: FieldChange[] = [];
  const originalObj = original as unknown as Record<string, unknown>;
  const currentObj = current as unknown as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(originalObj), ...Object.keys(currentObj)]);

  for (const key of allKeys) {
    const origValue = originalObj[key];
    const currValue = currentObj[key];

    if (JSON.stringify(origValue) !== JSON.stringify(currValue)) {
      changes.push({
        field: key,
        original: origValue,
        current: currValue,
      });
    }
  }

  return changes;
}

// ============================================================================
// CARD DIFFING
// ============================================================================

/**
 * Compute a semantic diff between two card data objects.
 */
export function computeCardDiff(
  original: CCv2Data | CCv3Data | unknown,
  current: CCv2Data | CCv3Data | unknown
): CardDiff {
  const patcher = getDiffPatcher();

  // Compute overall delta
  const delta = patcher.diff(original, current);
  const hasChanges = delta !== undefined;

  // Extract and diff lorebooks
  const originalLorebook = getLorebookFromData(original);
  const currentLorebook = getLorebookFromData(current);

  let lorebookDiff: LorebookDiff | undefined;
  if (originalLorebook || currentLorebook) {
    lorebookDiff = computeLorebookDiff(originalLorebook, currentLorebook);
  }

  return {
    hasChanges,
    delta,
    lorebookDiff,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a card has a lorebook (character_book).
 */
export function cardHasLorebook(card: Card): boolean {
  return getLorebookFromCard(card) !== null;
}

/**
 * Format entry status for display.
 */
export function formatEntryStatus(status: EntryDiffStatus): string {
  switch (status) {
    case 'added': return 'Added';
    case 'removed': return 'Removed';
    case 'modified': return 'Modified';
    case 'unchanged': return 'Unchanged';
  }
}

/**
 * Get CSS class for entry status.
 */
export function getStatusColorClass(status: EntryDiffStatus): string {
  switch (status) {
    case 'added': return 'text-green-400 bg-green-900/30';
    case 'removed': return 'text-red-400 bg-red-900/30';
    case 'modified': return 'text-yellow-400 bg-yellow-900/30';
    case 'unchanged': return 'text-dark-muted';
  }
}

/**
 * Get badge class for entry status.
 */
export function getStatusBadgeClass(status: EntryDiffStatus): string {
  switch (status) {
    case 'added': return 'bg-green-600';
    case 'removed': return 'bg-red-600';
    case 'modified': return 'bg-yellow-600';
    case 'unchanged': return 'bg-dark-muted';
  }
}
