/**
 * Local Persistence Adapter
 *
 * Implements PersistenceAdapter using IndexedDB for cards/assets
 * and localStorage for templates/snippets/settings.
 * Used in 'light' and 'static' deployment modes.
 */

import { generateId } from '@card-architect/import-core';
import type { Card, Template, Snippet } from '../../lib/types';
import { localDB, type StoredAsset, type StoredVersion } from '../../lib/db';
import { defaultTemplates, defaultSnippets } from '../../lib/default-templates';
import type {
  PersistenceAdapter,
  CardListItem,
  AssetSaveOptions,
  AssetUpdateOptions,
  Version,
  ImageType,
} from './types';

const TEMPLATES_STORAGE_KEY = 'ca-templates';
const SNIPPETS_STORAGE_KEY = 'ca-snippets';
const SETTINGS_STORAGE_KEY_PREFIX = 'ca-settings-';

export class LocalPersistenceAdapter implements PersistenceAdapter {
  readonly mode = 'local' as const;

  // Cache for blob URLs to avoid memory leaks
  private blobUrlCache = new Map<string, string>();

  // ============================================
  // Cards
  // ============================================

  async listCards(_query?: string): Promise<CardListItem[]> {
    const cards = await localDB.listCards();

    // Filter by query if provided
    let filtered = cards;
    if (_query) {
      const q = _query.toLowerCase();
      filtered = cards.filter(
        (card) =>
          card.meta.name.toLowerCase().includes(q) ||
          card.meta.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // Map to list items with thumbnail URLs
    const items: CardListItem[] = [];
    for (const card of filtered) {
      const thumbnailData = await localDB.getImage(card.meta.id, 'thumbnail');
      items.push({
        id: card.meta.id,
        name: card.meta.name,
        spec: card.meta.spec,
        tags: card.meta.tags || [],
        thumbnailUrl: thumbnailData || undefined,
        createdAt: card.meta.createdAt,
        updatedAt: card.meta.updatedAt,
      });
    }

    // Sort by updatedAt descending
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getCard(id: string): Promise<Card | null> {
    return localDB.getCard(id);
  }

  async saveCard(card: Card): Promise<Card> {
    // Generate ID if new
    const cardToSave = card.meta.id
      ? card
      : {
          ...card,
          meta: {
            ...card.meta,
            id: generateId(),
          },
        };

    // Update timestamp
    cardToSave.meta.updatedAt = new Date().toISOString();

    await localDB.saveCard(cardToSave);
    return cardToSave;
  }

  async deleteCard(id: string): Promise<void> {
    // Delete all associated data
    await Promise.all([
      localDB.deleteCard(id),
      localDB.deleteCardImages(id),
      localDB.deleteCardAssets(id),
      localDB.deleteCardVersions(id),
    ]);

    // Clean up any cached blob URLs
    this.cleanupBlobUrls(id);
  }

  // ============================================
  // Assets
  // ============================================

  async listAssets(cardId: string): Promise<StoredAsset[]> {
    return localDB.getAssetsByCard(cardId);
  }

  async saveAsset(options: AssetSaveOptions): Promise<StoredAsset> {
    const { cardId, name, type, ext, mimetype, data, size, width, height, isMain, tags, actorIndex } =
      options;

    // Convert data to string (data URL)
    let dataString: string;
    if (typeof data === 'string') {
      dataString = data;
    } else if (data instanceof File) {
      dataString = await this.fileToDataURL(data);
    } else {
      // Uint8Array
      dataString = this.uint8ArrayToDataURL(data, mimetype);
    }

    const now = new Date().toISOString();
    const asset: StoredAsset = {
      id: generateId(),
      cardId,
      name,
      type,
      ext,
      mimetype,
      size: size || dataString.length,
      width,
      height,
      data: dataString,
      isMain: isMain || false,
      tags: tags || [],
      actorIndex,
      createdAt: now,
      updatedAt: now,
    };

    await localDB.saveAsset(asset);
    return asset;
  }

  async updateAsset(_cardId: string, assetId: string, updates: AssetUpdateOptions): Promise<void> {
    await localDB.updateAsset(assetId, updates);
  }

  async deleteAsset(_cardId: string, assetId: string): Promise<void> {
    await localDB.deleteAsset(assetId);
  }

  async setAssetAsMain(cardId: string, assetId: string): Promise<void> {
    const asset = await localDB.getAsset(assetId);
    if (asset) {
      await localDB.setAssetAsMain(cardId, assetId, asset.type);
    }
  }

  // ============================================
  // Templates
  // ============================================

  async listTemplates(): Promise<Template[]> {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (!stored) {
        // Initialize with defaults
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(defaultTemplates));
        return defaultTemplates;
      }

      const parsed = JSON.parse(stored);
      // Filter out stored defaults and merge with latest defaults
      const customTemplates = parsed.filter((t: Template) => !t.isDefault);
      return [...defaultTemplates, ...customTemplates];
    } catch (error) {
      console.error('[LocalAdapter] listTemplates error:', error);
      return defaultTemplates;
    }
  }

  async createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const now = new Date().toISOString();
    const newTemplate: Template = {
      ...template,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const templates = await this.listTemplates();
    templates.push(newTemplate);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));

    return newTemplate;
  }

  async updateTemplate(
    id: string,
    updates: Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Template> {
    const templates = await this.listTemplates();
    const index = templates.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Template not found');

    const updated: Template = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    templates[index] = updated;
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));

    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    const templates = await this.listTemplates();
    const filtered = templates.filter((t) => t.id !== id);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
  }

  async resetTemplates(): Promise<Template[]> {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(defaultTemplates));
    return defaultTemplates;
  }

  // ============================================
  // Snippets
  // ============================================

  async listSnippets(): Promise<Snippet[]> {
    try {
      const stored = localStorage.getItem(SNIPPETS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(defaultSnippets));
        return defaultSnippets;
      }

      const parsed = JSON.parse(stored);
      const customSnippets = parsed.filter((s: Snippet) => !s.isDefault);
      return [...defaultSnippets, ...customSnippets];
    } catch (error) {
      console.error('[LocalAdapter] listSnippets error:', error);
      return defaultSnippets;
    }
  }

  async createSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet> {
    const now = new Date().toISOString();
    const newSnippet: Snippet = {
      ...snippet,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const snippets = await this.listSnippets();
    snippets.push(newSnippet);
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));

    return newSnippet;
  }

  async updateSnippet(
    id: string,
    updates: Partial<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Snippet> {
    const snippets = await this.listSnippets();
    const index = snippets.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Snippet not found');

    const updated: Snippet = {
      ...snippets[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    snippets[index] = updated;
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));

    return updated;
  }

  async deleteSnippet(id: string): Promise<void> {
    const snippets = await this.listSnippets();
    const filtered = snippets.filter((s) => s.id !== id);
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(filtered));
  }

  async resetSnippets(): Promise<Snippet[]> {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(defaultSnippets));
    return defaultSnippets;
  }

  // ============================================
  // Versions
  // ============================================

  async listVersions(cardId: string): Promise<Version[]> {
    const versions = await localDB.getVersionsByCard(cardId);
    return versions.map((v) => ({
      id: v.id,
      cardId: v.cardId,
      versionNumber: v.versionNumber,
      message: v.message,
      data: v.data,
      createdAt: v.createdAt,
    }));
  }

  async createVersion(cardId: string, data: Card['data'], message?: string): Promise<Version> {
    const versionNumber = await localDB.getNextVersionNumber(cardId);
    const version: StoredVersion = {
      id: generateId(),
      cardId,
      versionNumber,
      message,
      data,
      createdAt: new Date().toISOString(),
    };

    await localDB.saveVersion(version);

    return {
      id: version.id,
      cardId: version.cardId,
      versionNumber: version.versionNumber,
      message: version.message,
      data: version.data,
      createdAt: version.createdAt,
    };
  }

  async deleteVersion(_cardId: string, versionId: string): Promise<void> {
    await localDB.deleteVersion(versionId);
  }

  // ============================================
  // Images
  // ============================================

  async saveImage(cardId: string, type: ImageType, data: string): Promise<void> {
    await localDB.saveImage(cardId, type, data);
  }

  async getImage(cardId: string, type: ImageType): Promise<string | null> {
    return localDB.getImage(cardId, type);
  }

  getCardImageUrl(cardId: string): string {
    // Return a placeholder - actual image needs to be loaded async
    // Components should use getImage() for local mode
    const cached = this.blobUrlCache.get(`${cardId}-thumbnail`);
    if (cached) return cached;

    // Return empty placeholder - caller should use getImage() async
    return '';
  }

  // ============================================
  // Settings
  // ============================================

  async getSetting<T>(key: string): Promise<T | null> {
    try {
      const stored = localStorage.getItem(`${SETTINGS_STORAGE_KEY_PREFIX}${key}`);
      if (!stored) return null;
      return JSON.parse(stored) as T;
    } catch {
      return null;
    }
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(`${SETTINGS_STORAGE_KEY_PREFIX}${key}`, JSON.stringify(value));
  }

  // ============================================
  // Helpers
  // ============================================

  private async fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private uint8ArrayToDataURL(buffer: Uint8Array, mimeType: string): string {
    // Chunk-safe base64 encoding for large buffers
    const CHUNK_SIZE = 0x8000;
    let binary = '';
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.subarray(i, Math.min(i + CHUNK_SIZE, buffer.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
  }

  private cleanupBlobUrls(cardId: string): void {
    for (const [key, url] of this.blobUrlCache) {
      if (key.startsWith(cardId)) {
        URL.revokeObjectURL(url);
        this.blobUrlCache.delete(key);
      }
    }
  }
}
