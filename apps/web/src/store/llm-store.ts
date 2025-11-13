/**
 * LLM Settings Store
 * Manages provider configurations and RAG settings
 */

import { create } from 'zustand';
import type { LLMSettings, ProviderConfig } from '@card-architect/schemas';
import { api } from '../lib/api';

interface LLMStore {
  settings: LLMSettings;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<LLMSettings>) => Promise<void>;
  addProvider: (provider: ProviderConfig) => Promise<void>;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  testConnection: (providerId: string) => Promise<{ success: boolean; error?: string }>;
}

export const useLLMStore = create<LLMStore>((set, get) => ({
  settings: {
    providers: [],
    activeProviderId: undefined,
    rag: {
      enabled: false,
      topK: 5,
      tokenCap: 1500,
      indexPath: '',
      embedModel: 'sentence-transformers/all-MiniLM-L6-v2',
      sources: [],
    },
  },
  isLoading: false,
  error: null,

  // Load settings from API
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${api.baseURL}/api/llm/settings`);
      if (!response.ok) throw new Error('Failed to load settings');
      const settings = await response.json();
      set({ settings, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Save settings to API
  saveSettings: async (updates) => {
    const { settings } = get();
    const newSettings = {
      ...settings,
      ...updates,
      rag: updates.rag ? { ...settings.rag, ...updates.rag } : settings.rag,
    };

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${api.baseURL}/api/llm/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      set({ settings: newSettings, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Add new provider
  addProvider: async (provider) => {
    const { settings } = get();
    const newProviders = [...settings.providers, provider];
    await get().saveSettings({ providers: newProviders });
  },

  // Update existing provider
  updateProvider: async (id, updates) => {
    const { settings } = get();
    const newProviders = settings.providers.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    await get().saveSettings({ providers: newProviders });
  },

  // Remove provider
  removeProvider: async (id) => {
    const { settings } = get();
    const newProviders = settings.providers.filter((p) => p.id !== id);
    const activeProviderId =
      settings.activeProviderId === id ? undefined : settings.activeProviderId;
    await get().saveSettings({ providers: newProviders, activeProviderId });
  },

  // Set active provider
  setActiveProvider: async (id) => {
    await get().saveSettings({ activeProviderId: id });
  },

  // Test provider connection
  testConnection: async (providerId) => {
    try {
      const response = await fetch(`${api.baseURL}/api/llm/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
}));
