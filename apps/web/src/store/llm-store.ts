/**
 * LLM Settings Store
 * Manages provider configurations and RAG settings
 *
 * In light/static mode, uses client-side LLM via localStorage
 * In full mode, uses server-side API
 */

import { create } from 'zustand';
import type {
  LLMSettings,
  ProviderConfig,
  RagDatabase,
  RagDatabaseDetail,
} from '../lib/types';
import { api } from '../lib/api';
import { getDeploymentConfig } from '../config/deployment';
import {
  loadClientLLMProviders,
  saveClientLLMProviders,
  loadActiveProvider,
  saveActiveProvider,
  testClientLLMConnection,
  fetchClientLLMModels,
  type ClientLLMProvider,
} from '../lib/client-llm';

interface LLMStore {
  settings: LLMSettings;
  isLoading: boolean;
  error: string | null;
  ragDatabases: RagDatabase[];
  ragActiveDatabaseId?: string;
  ragDatabaseDetails: Record<string, RagDatabaseDetail>;
  ragIsLoading: boolean;
  ragError: string | null;
  // Model cache: providerId -> sorted model list
  modelCache: Record<string, string[]>;

  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<LLMSettings>) => Promise<void>;
  addProvider: (provider: ProviderConfig) => Promise<void>;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  testConnection: (providerId: string) => Promise<{ success: boolean; error?: string }>;
  loadRagDatabases: () => Promise<void>;
  loadRagDatabaseDetail: (id: string) => Promise<void>;
  createRagDatabase: (payload: { label: string; description?: string }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  deleteRagDatabase: (id: string) => Promise<{ success: boolean; error?: string }>;
  setActiveRagDatabaseId: (id: string | undefined) => Promise<void>;
  uploadRagDocument: (
    dbId: string,
    file: File,
    options?: { title?: string; tags?: string[] }
  ) => Promise<{ success: boolean; error?: string }>;
  removeRagDocument: (
    dbId: string,
    sourceId: string
  ) => Promise<{ success: boolean; error?: string }>;
  fetchModelsForProvider: (providerId: string) => Promise<{
    success: boolean;
    models?: string[];
    error?: string;
  }>;
  getCachedModels: (providerId: string) => string[];
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
      activeDatabaseId: undefined,
    },
  },
  isLoading: false,
  error: null,
  ragDatabases: [],
  ragActiveDatabaseId: undefined,
  ragDatabaseDetails: {},
  ragIsLoading: false,
  ragError: null,
  modelCache: {},

  // Load settings from API or localStorage
  loadSettings: async () => {
    const config = getDeploymentConfig();

    // Light/static mode: load from localStorage
    if (config.mode === 'light' || config.mode === 'static') {
      const clientProviders = loadClientLLMProviders();
      const activeId = loadActiveProvider();

      // Convert client providers to ProviderConfig format
      // IMPORTANT: Must set both 'name' and 'label' - API schema requires 'name'
      const providers: ProviderConfig[] = clientProviders.map(p => ({
        id: p.id,
        name: p.name,
        label: p.name,
        kind: p.kind === 'openrouter' ? 'openai-compatible' : p.kind,
        baseURL: p.baseURL,
        apiKey: p.apiKey,
        defaultModel: p.defaultModel,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        // Mark as client-side provider (stored in extended fields)
        clientSide: true,
        clientKind: p.kind,
      } as ProviderConfig & { clientSide: boolean; clientKind: string }));

      set({
        settings: {
          ...get().settings,
          providers,
          activeProviderId: activeId || undefined,
        },
        isLoading: false,
        error: null,
      });
      return;
    }

    // Full mode: load from server
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${api.baseURL}/llm/settings`);
      if (!response.ok) throw new Error('Failed to load settings');
      const settings = await response.json();
      set({ settings, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Save settings to API or localStorage
  saveSettings: async (updates) => {
    const config = getDeploymentConfig();
    const { settings } = get();

    const newSettings = {
      ...settings,
      ...updates,
      rag: updates.rag ? { ...settings.rag, ...updates.rag } : settings.rag,
    };

    // Light/static mode: save to localStorage
    if (config.mode === 'light' || config.mode === 'static') {
      // Convert ProviderConfig back to ClientLLMProvider format
      const clientProviders: ClientLLMProvider[] = newSettings.providers.map(p => ({
        id: p.id,
        name: p.label || p.name,
        kind: (p as any).clientKind || (p.kind === 'anthropic' ? 'anthropic' : 'openai-compatible'),
        baseURL: p.baseURL || '',
        apiKey: p.apiKey || '',
        defaultModel: p.defaultModel || '',
        temperature: p.temperature,
        maxTokens: p.maxTokens,
      }));

      saveClientLLMProviders(clientProviders);
      if (newSettings.activeProviderId) {
        saveActiveProvider(newSettings.activeProviderId);
      }

      set({ settings: newSettings, isLoading: false });
      return;
    }

    // Full mode: save to server
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${api.baseURL}/llm/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.details?.fieldErrors
          ? `Validation failed: ${JSON.stringify(errorData.details.fieldErrors)}`
          : errorData.error || 'Failed to save settings';
        console.error('LLM settings save failed:', errorData);
        throw new Error(errorMsg);
      }
      set({ settings: newSettings, isLoading: false });
    } catch (error: any) {
      console.error('LLM settings save error:', error);
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
    const config = getDeploymentConfig();
    const { settings } = get();
    const provider = settings.providers.find(p => p.id === providerId);

    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    // Light/static mode: test directly from browser
    if (config.mode === 'light' || config.mode === 'static') {
      const clientProvider: ClientLLMProvider = {
        id: provider.id,
        name: provider.label || provider.name,
        kind: (provider as any).clientKind || (provider.kind === 'anthropic' ? 'anthropic' : 'openai-compatible'),
        baseURL: provider.baseURL || '',
        apiKey: provider.apiKey || '',
        defaultModel: provider.defaultModel || '',
        temperature: provider.temperature,
        maxTokens: provider.maxTokens,
      };

      return testClientLLMConnection(clientProvider);
    }

    // Full mode: test via server
    try {
      const response = await fetch(`${api.baseURL}/llm/test-connection`, {
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

  // RAG operations
  loadRagDatabases: async () => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      set({ ragIsLoading: false, ragError: null });
      return;
    }

    set({ ragIsLoading: true, ragError: null });
    const { data, error } = await api.listRagDatabases();
    if (error || !data) {
      set({ ragIsLoading: false, ragError: error || 'Failed to load knowledge bases' });
      return;
    }

    set((state) => {
      const nextActive = data.activeDatabaseId ?? state.settings.rag?.activeDatabaseId;
      const filteredDetails: Record<string, RagDatabaseDetail> = {};
      Object.entries(state.ragDatabaseDetails).forEach(([id, detail]) => {
        if (data.databases.some((db) => db.id === id)) {
          filteredDetails[id] = detail;
        }
      });

      return {
        ragIsLoading: false,
        ragError: null,
        ragDatabases: data.databases,
        ragActiveDatabaseId: nextActive ?? undefined,
        ragDatabaseDetails: filteredDetails,
        settings: {
          ...state.settings,
          rag: { ...state.settings.rag, activeDatabaseId: nextActive },
        },
      };
    });
  },

  loadRagDatabaseDetail: async (id) => {
    const { data, error } = await api.getRagDatabase(id);
    if (error || !data) {
      set({ ragError: error || 'Failed to load database' });
      return;
    }

    set((state) => ({
      ragDatabaseDetails: { ...state.ragDatabaseDetails, [id]: data.database },
      ragError: null,
    }));
  },

  createRagDatabase: async ({ label, description }) => {
    const trimmed = label.trim();
    if (!trimmed) {
      return { success: false, error: 'Label is required' };
    }

    const { data, error } = await api.createRagDatabase({ label: trimmed, description });
    if (error || !data) {
      set({ ragError: error || 'Failed to create knowledge base' });
      return { success: false, error: error || 'Failed to create knowledge base' };
    }

    set((state) => {
      const newDatabases = [...state.ragDatabases, data.database];
      const shouldSetActive = !state.ragActiveDatabaseId;
      const nextActive = shouldSetActive
        ? data.database.id
        : state.ragActiveDatabaseId;

      return {
        ragDatabases: newDatabases,
        ragActiveDatabaseId: nextActive,
        ragDatabaseDetails: {
          ...state.ragDatabaseDetails,
          [data.database.id]: data.database,
        },
        ragError: null,
        settings: {
          ...state.settings,
          rag: {
            ...state.settings.rag,
            activeDatabaseId: shouldSetActive
              ? data.database.id
              : state.settings.rag?.activeDatabaseId,
          },
        },
      };
    });

    return { success: true };
  },

  deleteRagDatabase: async (id) => {
    const { error } = await api.deleteRagDatabase(id);
    if (error) {
      set({ ragError: error });
      return { success: false, error };
    }

    set((state) => {
      const remaining = state.ragDatabases.filter((db) => db.id !== id);
      const { [id]: _, ...restDetails } = state.ragDatabaseDetails;
      const clearedActive =
        state.ragActiveDatabaseId === id ? undefined : state.ragActiveDatabaseId;

      return {
        ragDatabases: remaining,
        ragDatabaseDetails: restDetails,
        ragActiveDatabaseId: clearedActive,
        ragError: null,
        settings: {
          ...state.settings,
          rag: {
            ...state.settings.rag,
            activeDatabaseId:
              state.settings.rag?.activeDatabaseId === id
                ? undefined
                : state.settings.rag?.activeDatabaseId,
          },
        },
      };
    });

    return { success: true };
  },

  setActiveRagDatabaseId: async (id) => {
    const { settings } = get();
    await get().saveSettings({ rag: { ...settings.rag, activeDatabaseId: id } });
    set({ ragActiveDatabaseId: id });
  },

  uploadRagDocument: async (dbId, file, options) => {
    if (!file) {
      return { success: false, error: 'No file selected' };
    }

    const { data, error } = await api.uploadRagDocument(dbId, file, options);
    if (error || !data) {
      return { success: false, error: error || 'Upload failed' };
    }

    await get().loadRagDatabaseDetail(dbId);
    await get().loadRagDatabases();
    return { success: true };
  },

  removeRagDocument: async (dbId, sourceId) => {
    const { error } = await api.deleteRagDocument(dbId, sourceId);
    if (error) {
      return { success: false, error };
    }

    await get().loadRagDatabaseDetail(dbId);
    await get().loadRagDatabases();
    return { success: true };
  },

  // Fetch models for a provider and cache them
  fetchModelsForProvider: async (providerId) => {
    const config = getDeploymentConfig();
    const { settings } = get();
    const provider = settings.providers.find((p) => p.id === providerId);

    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    if (!provider.baseURL || !provider.apiKey) {
      return { success: false, error: 'Provider missing baseURL or apiKey' };
    }

    // Light/static mode: fetch directly from browser
    if (config.mode === 'light' || config.mode === 'static') {
      const clientProvider: ClientLLMProvider = {
        id: provider.id,
        name: provider.label || provider.name,
        kind: (provider as any).clientKind || (provider.kind === 'anthropic' ? 'anthropic' : 'openai-compatible'),
        baseURL: provider.baseURL || '',
        apiKey: provider.apiKey || '',
        defaultModel: provider.defaultModel || '',
        temperature: provider.temperature,
        maxTokens: provider.maxTokens,
      };

      const result = await fetchClientLLMModels(clientProvider);

      if (result.success && result.models && result.models.length > 0) {
        // Cache the models
        set((state) => ({
          modelCache: { ...state.modelCache, [providerId]: result.models! },
        }));
      }

      return result;
    }

    // Full mode: fetch via server or directly
    try {
      let headers: Record<string, string> = {};
      let url = `${provider.baseURL.replace(/\/$/, '')}/v1/models`;

      if (provider.kind === 'anthropic') {
        headers = {
          'x-api-key': provider.apiKey,
          'anthropic-version': provider.anthropicVersion || '2023-06-01',
        };
      } else {
        headers = {
          Authorization: `Bearer ${provider.apiKey}`,
        };
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch models (${response.status})`);
      }

      const data = await response.json();
      const models =
        Array.isArray(data.data) && data.data.length > 0
          ? data.data
              .map((m: any) => m.id || m.model || m.name)
              .filter(Boolean)
              .sort((a: string, b: string) => a.localeCompare(b)) // Sort alphabetically
          : [];

      if (models.length === 0) {
        return { success: false, error: 'No models returned by provider' };
      }

      // Cache the sorted models
      set((state) => ({
        modelCache: { ...state.modelCache, [providerId]: models },
      }));

      return { success: true, models };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch models',
      };
    }
  },

  // Get cached models for a provider (returns empty array if not cached)
  getCachedModels: (providerId) => {
    return get().modelCache[providerId] || [];
  },
}));
