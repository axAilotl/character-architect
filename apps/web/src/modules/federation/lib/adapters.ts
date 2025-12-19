/**
 * Platform Adapters
 *
 * Re-export adapters from @character-foundry/federation package
 * and add local editor adapter for Character Architect.
 */

import { generateId } from '@card-architect/import-core';
import type { CCv3Data } from '../../../lib/types';
import type { PlatformId, PlatformAdapter, AdapterCard, AdapterAsset } from './types';
import { localDB } from '../../../lib/db';

// Re-export adapters from federation package (except ones we override)
export {
  BasePlatformAdapter,
  MemoryPlatformAdapter,
  SillyTavernAdapter,
  stCharacterToCCv3,
  ccv3ToSTCharacter,
  createMockSTBridge,
} from '@character-foundry/character-foundry/federation';

// Re-export types
export type {
  AdapterCard,
  AdapterAsset,
  HttpAdapterConfig,
  FetchFn,
  SillyTavernBridge,
  STCharacter,
} from '@character-foundry/character-foundry/federation';

// Import HttpPlatformAdapter for creating SillyTavern federation adapter
import { HttpPlatformAdapter } from '@character-foundry/character-foundry/federation';

/**
 * Create a SillyTavern adapter (via CForge federation plugin)
 * Uses federation endpoints from CForge plugin
 */
export function createSillyTavernFederationAdapter(baseUrl: string): HttpPlatformAdapter {
  return new HttpPlatformAdapter({
    platform: 'sillytavern',
    displayName: 'SillyTavern',
    baseUrl,
    endpoints: {
      list: '/api/plugins/cforge/federation/outbox',
      get: '/api/plugins/cforge/federation/outbox',
      create: '/api/plugins/cforge/federation/inbox',
      update: '/api/plugins/cforge/federation/inbox',
      delete: '/api/plugins/cforge/federation/inbox',
      assets: '/api/plugins/cforge/federation/assets',
      health: '/api/plugins/cforge/federation/actor',
    },
  });
}

// Alias for backwards compatibility
export const createSillyTavernAdapter = createSillyTavernFederationAdapter;

/**
 * Create a Character Archive adapter using federation endpoints
 */
export function createArchiveFederationAdapter(baseUrl: string, apiKey?: string): HttpPlatformAdapter {
  return new HttpPlatformAdapter({
    platform: 'archive',
    displayName: 'Character Archive',
    baseUrl,
    endpoints: {
      list: '/api/federation/outbox',
      get: '/api/federation/outbox',
      create: '/api/federation/inbox',
      update: '/api/federation/inbox',
      delete: '/api/federation/inbox',
      assets: '/api/federation/assets',
      health: '/api/federation/actor',
    },
    auth: apiKey ? { type: 'api-key', token: apiKey } : undefined,
  });
}

// Override the package's createArchiveAdapter with federation version
export { createArchiveFederationAdapter as createArchiveAdapter };

/**
 * Create a CardsHub adapter using federation endpoints
 */
export function createHubFederationAdapter(baseUrl: string, apiKey?: string): HttpPlatformAdapter {
  return new HttpPlatformAdapter({
    platform: 'hub',
    displayName: 'CardsHub',
    baseUrl,
    endpoints: {
      list: '/api/federation/outbox',
      get: '/api/federation/outbox',
      create: '/api/federation/inbox',
      update: '/api/federation/inbox',
      delete: '/api/federation/inbox',
      assets: '/api/federation/assets',
      health: '/api/federation/actor',
    },
    auth: apiKey ? { type: 'bearer', token: apiKey } : undefined,
  });
}

// Override the package's createHubAdapter with federation version
export { createHubFederationAdapter as createCardsHubAdapter };
export { createHubFederationAdapter as createHubAdapter };

/**
 * Local Editor adapter
 * Wraps card storage for the local editor.
 * - In light mode: uses IndexedDB
 * - In full mode: uses server API
 */
export class LocalEditorAdapter implements PlatformAdapter {
  readonly platform: PlatformId = 'editor';
  readonly displayName = 'Character Architect';

  private isLightMode(): boolean {
    // Check deployment mode - import dynamically to avoid circular deps
    const mode = (window as any).__DEPLOYMENT_MODE__ ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ca-deployment-mode')) ||
      'full';
    return mode === 'light' || mode === 'static';
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available locally
  }

  async getCard(localId: string): Promise<CCv3Data | null> {
    try {
      if (this.isLightMode()) {
        // Light mode: use IndexedDB
        const card = await localDB.getCard(localId);
        if (!card) return null;
        return card.data as CCv3Data;
      } else {
        // Full mode: fetch from server API
        const response = await fetch(`/api/cards/${localId}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`HTTP ${response.status}`);
        }
        const card = await response.json();
        // Server returns { meta, data } - data is the CCv3Data
        return card.data as CCv3Data;
      }
    } catch (err) {
      console.error('[editor] Failed to get card:', err);
      return null;
    }
  }

  async listCards(options?: { limit?: number; offset?: number; since?: string }): Promise<AdapterCard[]> {
    try {
      if (this.isLightMode()) {
        // Light mode: use IndexedDB
        const cards = await localDB.listCards();

        let result = cards.map((c) => ({
          id: c.meta.id,
          card: c.data as CCv3Data,
          updatedAt: c.meta.updatedAt,
        }));

        if (options?.since) {
          const sinceDate = new Date(options.since);
          result = result.filter((c) => new Date(c.updatedAt) > sinceDate);
        }

        const offset = options?.offset || 0;
        const limit = options?.limit || result.length;
        result = result.slice(offset, offset + limit);

        return result;
      } else {
        // Full mode: fetch from server API
        const response = await fetch('/api/cards');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const cards = await response.json();

        return cards.map((c: any) => ({
          id: c.meta.id,
          card: c.data as CCv3Data,
          updatedAt: c.meta.updatedAt,
        }));
      }
    } catch (err) {
      console.error('[editor] Failed to list cards:', err);
      return [];
    }
  }

  async saveCard(card: CCv3Data, localId?: string): Promise<string> {
    const id = localId || generateId();

    if (this.isLightMode()) {
      // Light mode: save to IndexedDB
      await localDB.saveCard({
        meta: {
          id,
          name: card.data.name,
          spec: 'v3',
          tags: card.data.tags || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        data: card,
      });
    } else {
      // Full mode: save via server API
      const response = await fetch(`/api/cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: card }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }

    return id;
  }

  async deleteCard(localId: string): Promise<boolean> {
    try {
      if (this.isLightMode()) {
        await localDB.deleteCard(localId);
      } else {
        const response = await fetch(`/api/cards/${localId}`, { method: 'DELETE' });
        if (!response.ok) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async getAssets(localId: string): Promise<AdapterAsset[]> {
    try {
      if (this.isLightMode()) {
        const assets = await localDB.getAssetsByCard(localId);
        return assets.map((a: { name: string; type: string; data: string; mimetype: string }) => ({
          name: a.name,
          type: a.type,
          data: new TextEncoder().encode(a.data),
          mimeType: a.mimetype,
        }));
      } else {
        const response = await fetch(`/api/cards/${localId}/assets`);
        if (!response.ok) return [];
        const assets = await response.json();
        return assets.map((a: any) => ({
          name: a.name,
          type: a.type,
          data: new TextEncoder().encode(a.data || ''),
          mimeType: a.mimetype,
        }));
      }
    } catch {
      return [];
    }
  }

  async getLastModified(localId: string): Promise<string | null> {
    if (this.isLightMode()) {
      const card = await localDB.getCard(localId);
      return card?.meta.updatedAt || null;
    } else {
      try {
        const response = await fetch(`/api/cards/${localId}`, { method: 'HEAD' });
        return response.headers.get('Last-Modified');
      } catch {
        return null;
      }
    }
  }
}
