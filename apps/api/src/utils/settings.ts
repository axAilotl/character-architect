/**
 * Settings management for LLM providers and RAG configuration
 * Stores settings in the SQLite database (app_settings table)
 */

import { join } from 'path';
import { homedir } from 'os';
import type { LLMSettings } from '../types/index.js';
import { getDatabase } from '../db/index.js';

const CONFIG_DIR = join(homedir(), '.card-architect');

/**
 * Default settings
 */
const DEFAULT_SETTINGS: LLMSettings = {
  providers: [],
  activeProviderId: undefined,
  rag: {
    enabled: false,
    topK: 5,
    tokenCap: 1500,
    indexPath: join(CONFIG_DIR, 'rag-index'),
    embedModel: 'sentence-transformers/all-MiniLM-L6-v2',
    sources: [],
    activeDatabaseId: undefined,
  },
};

/**
 * Load settings from database
 */
export async function getSettings(): Promise<LLMSettings> {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('llm_settings') as { value: string } | undefined;

    if (!row) {
      return DEFAULT_SETTINGS;
    }

    const settings = JSON.parse(row.value) as LLMSettings;

    // Merge with defaults to handle new fields
    const merged = {
      ...DEFAULT_SETTINGS,
      ...settings,
      rag: { ...DEFAULT_SETTINGS.rag, ...settings.rag },
    };

    // Ensure indexPath is never empty
    if (!merged.rag.indexPath) {
      merged.rag.indexPath = DEFAULT_SETTINGS.rag.indexPath;
    }

    return merged;
  } catch (error: any) {
    console.error('Failed to load settings from database:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to database
 */
export async function saveSettings(settings: LLMSettings): Promise<void> {
  const db = getDatabase();
  const value = JSON.stringify(settings);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run('llm_settings', value, now);
}

/**
 * Add or update a provider
 */
export async function upsertProvider(
  provider: LLMSettings['providers'][0]
): Promise<void> {
  const settings = await getSettings();
  const index = settings.providers.findIndex((p) => p.id === provider.id);

  if (index >= 0) {
    settings.providers[index] = provider;
  } else {
    settings.providers.push(provider);
  }

  await saveSettings(settings);
}

/**
 * Remove a provider
 */
export async function removeProvider(providerId: string): Promise<void> {
  const settings = await getSettings();
  settings.providers = settings.providers.filter((p) => p.id !== providerId);

  // Clear active provider if it was removed
  if (settings.activeProviderId === providerId) {
    settings.activeProviderId = undefined;
  }

  await saveSettings(settings);
}
