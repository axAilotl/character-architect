import type { CharacterBook, LorebookEntry } from '@card-architect/schemas';

/**
 * Test result for a specific input phrase
 */
export interface TriggerTestResult {
  input: string;
  activeEntries: ActiveEntry[];
  injectionPreview: string;
  totalTokens: number;
}

/**
 * An active lorebook entry with match details
 */
export interface ActiveEntry {
  entry: LorebookEntry;
  matchedKeys: string[];
  matchedSecondaryKeys: string[];
  matchType: 'primary' | 'secondary' | 'both';
  position: number;
  injectionDepth: number;
  reason: string;
  selectiveLogic?: {
    type: 'AND' | 'OR';
    primaryMatched: boolean;
    secondaryMatched: boolean;
    shouldActivate: boolean;
  };
}

/**
 * Tokenizer function type
 */
export type TokenCounter = (text: string) => number;

/**
 * Lore Trigger Tester Service
 * Tests which lorebook entries would activate for a given input
 */
export class LoreTriggerTester {
  private tokenCounter: TokenCounter;

  constructor(tokenCounter: TokenCounter) {
    this.tokenCounter = tokenCounter;
  }

  /**
   * Test which entries would fire for a given input
   */
  testInput(
    input: string,
    characterBook: CharacterBook | undefined,
    chatHistory: string[] = []
  ): TriggerTestResult {
    if (!characterBook || !characterBook.entries || characterBook.entries.length === 0) {
      return {
        input,
        activeEntries: [],
        injectionPreview: '',
        totalTokens: 0,
      };
    }

    const activeEntries: ActiveEntry[] = [];

    // Test each entry
    for (const entry of characterBook.entries) {
      // Skip disabled entries
      if (entry.enabled === false) continue;

      const testResult = this.testEntry(entry, input, chatHistory);

      if (testResult.shouldActivate) {
        activeEntries.push({
          entry,
          matchedKeys: testResult.matchedPrimaryKeys,
          matchedSecondaryKeys: testResult.matchedSecondaryKeys,
          matchType: testResult.matchType as 'both' | 'primary' | 'secondary',
          position: typeof entry.position === 'number' ? entry.position : 0,
          injectionDepth: typeof entry.insertion_order === 'number' ? entry.insertion_order : 0,
          reason: testResult.reason,
          selectiveLogic: testResult.selectiveLogic,
        });
      }
    }

    // Sort by priority (higher first), then insertion order
    activeEntries.sort((a, b) => {
      const priorityA = a.entry.priority || 0;
      const priorityB = b.entry.priority || 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }

      return a.injectionDepth - b.injectionDepth; // Lower insertion order first
    });

    // Generate injection preview
    const injectionPreview = this.generateInjectionPreview(activeEntries, input);
    const totalTokens = this.tokenCounter(injectionPreview);

    return {
      input,
      activeEntries,
      injectionPreview,
      totalTokens,
    };
  }

  /**
   * Test a single entry against input
   */
  private testEntry(
    entry: LorebookEntry,
    input: string,
    chatHistory: string[]
  ): {
    shouldActivate: boolean;
    matchedPrimaryKeys: string[];
    matchedSecondaryKeys: string[];
    matchType: 'primary' | 'secondary' | 'both' | 'none';
    reason: string;
    selectiveLogic?: {
      type: 'AND' | 'OR';
      primaryMatched: boolean;
      secondaryMatched: boolean;
      shouldActivate: boolean;
    };
  } {
    const primaryKeys = Array.isArray(entry.keys) ? entry.keys : [];
    const secondaryKeys = Array.isArray(entry.secondary_keys) ? entry.secondary_keys : [];

    // Determine what to search (based on scan depth or just input)
    // Note: scan_depth is a V2 field, not in CCv3LorebookEntry
    const scanDepth = (entry as any).scan_depth || 0;
    let searchText = input;

    if (scanDepth > 0 && chatHistory.length > 0) {
      // Include recent chat history
      const recentMessages = chatHistory.slice(-scanDepth);
      searchText = [...recentMessages, input].join('\n');
    }

    const searchTextLower = searchText.toLowerCase();

    // Check primary keys
    const matchedPrimaryKeys: string[] = [];
    for (const key of primaryKeys) {
      if (this.matchesKey(searchTextLower, key, entry.case_sensitive || false)) {
        matchedPrimaryKeys.push(key);
      }
    }

    // Check secondary keys
    const matchedSecondaryKeys: string[] = [];
    for (const key of secondaryKeys) {
      if (this.matchesKey(searchTextLower, key, entry.case_sensitive || false)) {
        matchedSecondaryKeys.push(key);
      }
    }

    const primaryMatched = matchedPrimaryKeys.length > 0;
    const secondaryMatched = matchedSecondaryKeys.length > 0;

    // Handle selective logic (AND/NOT)
    if (secondaryKeys.length > 0 && entry.selective) {
      const selectiveLogic = typeof entry.selective_logic === 'number' ? entry.selective_logic : 0;
      const isAND = selectiveLogic === 0; // 0 = AND, 1 = NOT

      let shouldActivate = false;
      let reason = '';

      if (isAND) {
        // AND logic: Both primary AND secondary must match
        shouldActivate = primaryMatched && secondaryMatched;
        reason = shouldActivate
          ? `Primary keys [${matchedPrimaryKeys.join(', ')}] AND secondary keys [${matchedSecondaryKeys.join(', ')}] matched`
          : primaryMatched
          ? `Primary matched but secondary keys did not match (AND logic)`
          : `Primary keys did not match`;
      } else {
        // NOT logic: Primary must match AND secondary must NOT match
        shouldActivate = primaryMatched && !secondaryMatched;
        reason = shouldActivate
          ? `Primary keys [${matchedPrimaryKeys.join(', ')}] matched and secondary keys did NOT match (NOT logic)`
          : primaryMatched
          ? `Primary matched but secondary keys also matched (NOT logic failed)`
          : `Primary keys did not match`;
      }

      return {
        shouldActivate,
        matchedPrimaryKeys,
        matchedSecondaryKeys,
        matchType: primaryMatched && secondaryMatched ? 'both' : primaryMatched ? 'primary' : 'none',
        reason,
        selectiveLogic: {
          type: isAND ? 'AND' : 'OR',
          primaryMatched,
          secondaryMatched,
          shouldActivate,
        },
      };
    }

    // Standard logic: Just primary keys need to match
    if (primaryMatched) {
      return {
        shouldActivate: true,
        matchedPrimaryKeys,
        matchedSecondaryKeys,
        matchType: secondaryMatched ? 'both' : 'primary',
        reason: `Primary keys [${matchedPrimaryKeys.join(', ')}] matched`,
      };
    }

    return {
      shouldActivate: false,
      matchedPrimaryKeys: [],
      matchedSecondaryKeys: [],
      matchType: 'none',
      reason: 'No keys matched',
    };
  }

  /**
   * Check if a key matches the search text
   */
  private matchesKey(searchText: string, key: string, caseSensitive: boolean): boolean {
    const searchIn = caseSensitive ? searchText : searchText.toLowerCase();
    const searchFor = caseSensitive ? key : key.toLowerCase();

    // Support regex patterns (enclosed in /.../)
    if (searchFor.startsWith('/') && searchFor.endsWith('/')) {
      try {
        const pattern = searchFor.slice(1, -1);
        const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
        return regex.test(searchText);
      } catch {
        // Invalid regex, fall back to literal match
        return searchIn.includes(searchFor);
      }
    }

    // Exact word match (if surrounded by word boundaries)
    if (searchFor.includes(' ')) {
      return searchIn.includes(searchFor);
    }

    // Word boundary match
    const wordRegex = new RegExp(`\\b${this.escapeRegex(searchFor)}\\b`, caseSensitive ? '' : 'i');
    return wordRegex.test(searchText);
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate injection preview showing how entries would be injected
   */
  private generateInjectionPreview(activeEntries: ActiveEntry[], input: string): string {
    if (activeEntries.length === 0) {
      return input;
    }

    // Group by injection position
    const beforePrompt: string[] = [];
    const afterPrompt: string[] = [];

    for (const active of activeEntries) {
      const position = typeof active.entry.position === 'number' ? active.entry.position : 0;

      if (position === 0) {
        // Before prompt (depth determines order within this section)
        beforePrompt.push(active.entry.content);
      } else if (position === 1) {
        // After prompt
        afterPrompt.push(active.entry.content);
      } else {
        // Custom positions (treat as after for now)
        afterPrompt.push(active.entry.content);
      }
    }

    // Assemble the preview
    const parts: string[] = [];

    if (beforePrompt.length > 0) {
      parts.push('--- Lorebook Entries (Before) ---');
      parts.push(beforePrompt.join('\n\n'));
      parts.push('');
    }

    parts.push('--- User Input ---');
    parts.push(input);

    if (afterPrompt.length > 0) {
      parts.push('');
      parts.push('--- Lorebook Entries (After) ---');
      parts.push(afterPrompt.join('\n\n'));
    }

    return parts.join('\n');
  }

  /**
   * Get statistics about lorebook entries
   */
  getEntryStats(characterBook: CharacterBook | undefined): {
    total: number;
    enabled: number;
    disabled: number;
    withSecondaryKeys: number;
    withSelectiveLogic: number;
  } {
    if (!characterBook || !characterBook.entries) {
      return {
        total: 0,
        enabled: 0,
        disabled: 0,
        withSecondaryKeys: 0,
        withSelectiveLogic: 0,
      };
    }

    const entries = characterBook.entries;

    return {
      total: entries.length,
      enabled: entries.filter((e) => e.enabled !== false).length,
      disabled: entries.filter((e) => e.enabled === false).length,
      withSecondaryKeys: entries.filter((e) => e.secondary_keys && e.secondary_keys.length > 0)
        .length,
      withSelectiveLogic: entries.filter((e) => e.selective).length,
    };
  }
}
