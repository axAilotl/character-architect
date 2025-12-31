/**
 * Settings management for LLM providers and RAG configuration
 * Stores settings in ~/.card-architect/config.json with 600 permissions
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { LLMSettings } from '../types/index.js';

const CONFIG_DIR = join(homedir(), '.card-architect');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

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
 * Ensure config directory exists with proper permissions
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    // Directory may already exist
  }
}

/**
 * Load settings from disk
 */
export async function getSettings(): Promise<LLMSettings> {
  await ensureConfigDir();

  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const settings = JSON.parse(data) as LLMSettings;

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
    if (error.code === 'ENOENT') {
      // File doesn't exist, return defaults
      return DEFAULT_SETTINGS;
    }
    throw error;
  }
}

/**
 * Save settings to disk with secure permissions
 */
export async function saveSettings(settings: LLMSettings): Promise<void> {
  await ensureConfigDir();

  const data = JSON.stringify(settings, null, 2);
  await fs.writeFile(CONFIG_FILE, data, { mode: 0o600 });
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
