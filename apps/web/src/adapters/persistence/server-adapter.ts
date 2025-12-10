/**
 * Server Persistence Adapter
 *
 * Implements PersistenceAdapter using server API calls.
 * Used in 'full' deployment mode.
 */

import type { Card, Template, Snippet, CardAssetWithDetails } from '../../lib/types';
import { api } from '../../lib/api';
import { defaultTemplates, defaultSnippets } from '../../lib/default-templates';
import type {
  PersistenceAdapter,
  CardListItem,
  AssetSaveOptions,
  AssetUpdateOptions,
  Version,
  ImageType,
} from './types';

const API_BASE = '/api';

export class ServerPersistenceAdapter implements PersistenceAdapter {
  readonly mode = 'server' as const;

  // ============================================
  // Cards
  // ============================================

  async listCards(query?: string): Promise<CardListItem[]> {
    const { data, error } = await api.listCards(query);
    if (error || !data) {
      console.error('[ServerAdapter] listCards error:', error);
      return [];
    }
    return data.map((card) => ({
      id: card.meta.id,
      name: card.meta.name,
      spec: card.meta.spec,
      tags: card.meta.tags || [],
      thumbnailUrl: api.getCardImageUrl(card.meta.id),
      createdAt: card.meta.createdAt,
      updatedAt: card.meta.updatedAt,
    }));
  }

  async getCard(id: string): Promise<Card | null> {
    const { data, error } = await api.getCard(id);
    if (error || !data) {
      console.error('[ServerAdapter] getCard error:', error);
      return null;
    }
    return data;
  }

  async saveCard(card: Card): Promise<Card> {
    if (card.meta.id) {
      // Update existing
      const { data, error } = await api.updateCard(card.meta.id, card);
      if (error) throw new Error(error);
      return data || card;
    } else {
      // Create new
      const { data, error } = await api.createCard(card);
      if (error) throw new Error(error);
      if (!data) throw new Error('No card returned from server');
      return data;
    }
  }

  async deleteCard(id: string): Promise<void> {
    const { error } = await api.deleteCard(id);
    if (error) throw new Error(error);
  }

  // ============================================
  // Assets
  // ============================================

  async listAssets(cardId: string): Promise<CardAssetWithDetails[]> {
    const { data, error } = await api.getCardAssets(cardId);
    if (error || !data) {
      console.error('[ServerAdapter] listAssets error:', error);
      return [];
    }
    return data;
  }

  async saveAsset(options: AssetSaveOptions): Promise<CardAssetWithDetails> {
    const { cardId, name, type, data, isMain = false, tags = [] } = options;

    // Convert data to File if needed
    let file: File;
    if (data instanceof File) {
      file = data;
    } else if (typeof data === 'string') {
      // Data URL - convert to blob
      const response = await fetch(data);
      const blob = await response.blob();
      file = new File([blob], `${name}.${options.ext}`, { type: options.mimetype });
    } else {
      // Uint8Array - copy to new ArrayBuffer to ensure correct type
      const blob = new Blob([new Uint8Array(data)], { type: options.mimetype });
      file = new File([blob], `${name}.${options.ext}`, { type: options.mimetype });
    }

    const result = await api.uploadAsset(cardId, file, type, name, isMain, tags);
    return result.asset;
  }

  async updateAsset(cardId: string, assetId: string, updates: AssetUpdateOptions): Promise<void> {
    await api.updateAsset(cardId, assetId, updates);
  }

  async deleteAsset(cardId: string, assetId: string): Promise<void> {
    await api.deleteAsset(cardId, assetId);
  }

  async setAssetAsMain(cardId: string, assetId: string): Promise<void> {
    await api.setAssetAsMain(cardId, assetId);
  }

  // ============================================
  // Templates
  // ============================================

  async listTemplates(): Promise<Template[]> {
    const response = await fetch(`${API_BASE}/templates`);
    if (!response.ok) {
      console.error('[ServerAdapter] listTemplates error:', response.status);
      return defaultTemplates;
    }
    const data = await response.json();
    return data.templates || [];
  }

  async createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const response = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!response.ok) throw new Error('Failed to create template');
    const data = await response.json();
    return data.template;
  }

  async updateTemplate(
    id: string,
    updates: Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Template> {
    const response = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update template');
    const data = await response.json();
    return data.template;
  }

  async deleteTemplate(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete template');
  }

  async resetTemplates(): Promise<Template[]> {
    const response = await fetch(`${API_BASE}/templates/reset`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to reset templates');
    const data = await response.json();
    return data.templates || defaultTemplates;
  }

  // ============================================
  // Snippets
  // ============================================

  async listSnippets(): Promise<Snippet[]> {
    const response = await fetch(`${API_BASE}/snippets`);
    if (!response.ok) {
      console.error('[ServerAdapter] listSnippets error:', response.status);
      return defaultSnippets;
    }
    const data = await response.json();
    return data.snippets || [];
  }

  async createSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet> {
    const response = await fetch(`${API_BASE}/snippets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snippet),
    });
    if (!response.ok) throw new Error('Failed to create snippet');
    const data = await response.json();
    return data.snippet;
  }

  async updateSnippet(
    id: string,
    updates: Partial<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Snippet> {
    const response = await fetch(`${API_BASE}/snippets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update snippet');
    const data = await response.json();
    return data.snippet;
  }

  async deleteSnippet(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/snippets/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete snippet');
  }

  async resetSnippets(): Promise<Snippet[]> {
    const response = await fetch(`${API_BASE}/snippets/reset`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to reset snippets');
    const data = await response.json();
    return data.snippets || defaultSnippets;
  }

  // ============================================
  // Versions
  // ============================================

  async listVersions(cardId: string): Promise<Version[]> {
    const { data, error } = await api.listVersions(cardId);
    if (error || !data) {
      console.error('[ServerAdapter] listVersions error:', error);
      return [];
    }
    return data as Version[];
  }

  async createVersion(cardId: string, _data: Card['data'], message?: string): Promise<Version> {
    const { data: result, error } = await api.createVersion(cardId, message);
    if (error) throw new Error(error);
    return result as Version;
  }

  async deleteVersion(cardId: string, versionId: string): Promise<void> {
    const { error } = await api.deleteVersion(cardId, versionId);
    if (error) throw new Error(error);
  }

  // ============================================
  // Images
  // ============================================

  async saveImage(_cardId: string, _type: ImageType, _data: string): Promise<void> {
    // Server manages images through the card/asset endpoints
    // This is primarily used by LocalAdapter; server handles this automatically
    console.warn('[ServerAdapter] saveImage called - server handles images automatically');
  }

  async getImage(cardId: string, type: ImageType): Promise<string | null> {
    // Return the URL for server-side images
    if (type === 'thumbnail' || type === 'icon') {
      return api.getCardImageUrl(cardId);
    }
    return null;
  }

  getCardImageUrl(cardId: string): string {
    return api.getCardImageUrl(cardId);
  }

  // ============================================
  // Settings
  // ============================================

  async getSetting<T>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`${API_BASE}/settings/${key}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.value ?? null;
    } catch {
      return null;
    }
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    const response = await fetch(`${API_BASE}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      console.error('[ServerAdapter] saveSetting error:', response.status);
    }
  }
}
