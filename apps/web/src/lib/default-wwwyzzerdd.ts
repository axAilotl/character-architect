/**
 * Default wwwyzzerdd prompt sets
 * Shared between WwwyzzerddTab and WwwyzzerddSettings for parity
 */

import { DEFAULT_WWWYZZERDD_PROMPTS, type WwwyzzerddPromptSet } from '@card-architect/defaults';

// Re-export type for consumers
export type { WwwyzzerddPromptSet };

export const defaultWwwyzzerddPrompts = DEFAULT_WWWYZZERDD_PROMPTS;

export const WWWYZZERDD_STORAGE_KEY = 'ca-wwwyzzerdd-prompts';

/**
 * Initialize wwwyzzerdd prompts in localStorage if not present
 */
export function initializeWwwyzzerddPrompts(): WwwyzzerddPromptSet[] {
  const stored = localStorage.getItem(WWWYZZERDD_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fall through to initialize
    }
  }

  // Initialize with defaults
  localStorage.setItem(WWWYZZERDD_STORAGE_KEY, JSON.stringify(defaultWwwyzzerddPrompts));
  return defaultWwwyzzerddPrompts;
}
