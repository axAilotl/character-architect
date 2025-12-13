/**
 * Federation Store
 *
 * Zustand store for managing federation state.
 */

import { create } from 'zustand';
import type {
  PlatformId,
  CardSyncState,
  SyncResult,
  PlatformConfig,
  FederationSettings,
  SyncStateStore,
} from './types';
import { SyncEngine } from './sync-engine';
import { createIndexedDBSyncStore } from './idb-sync-store';
import {
  createCardsHubAdapter,
  createArchiveAdapter,
  createSillyTavernAdapter,
  LocalEditorAdapter,
} from './adapters';

const SETTINGS_KEY = 'ca-federation-settings';

const DEFAULT_SETTINGS: FederationSettings = {
  platforms: {
    sillytavern: {
      id: 'sillytavern',
      name: 'SillyTavern',
      baseUrl: 'http://localhost:8000',
      enabled: false,
      connected: false,
    },
    hub: {
      id: 'hub',
      name: 'CardsHub',
      baseUrl: 'https://cardshub.example.com',
      enabled: false,
      connected: false,
    },
    archive: {
      id: 'archive',
      name: 'Character Archive',
      baseUrl: 'https://archive.example.com',
      enabled: false,
      connected: false,
    },
    editor: {
      id: 'editor',
      name: 'Character Architect',
      baseUrl: window.location.origin,
      enabled: true,
      connected: true,
    },
    risu: {
      id: 'risu',
      name: 'RisuAI',
      baseUrl: '',
      enabled: false,
      connected: false,
    },
    chub: {
      id: 'chub',
      name: 'Chub.ai',
      baseUrl: '',
      enabled: false,
      connected: false,
    },
    custom: {
      id: 'custom',
      name: 'Custom Platform',
      baseUrl: '',
      enabled: false,
      connected: false,
    },
  },
  autoSync: false,
  syncIntervalMinutes: 30,
};

interface FederationStore {
  // State
  initialized: boolean;
  syncEngine: SyncEngine | null;
  stateStore: SyncStateStore | null;
  settings: FederationSettings;
  syncStates: CardSyncState[];
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  error: string | null;

  // Initialization
  initialize: () => Promise<void>;

  // Settings
  loadSettings: () => void;
  saveSettings: () => void;
  updatePlatformConfig: (platform: PlatformId, config: Partial<PlatformConfig>) => void;

  // Connection testing
  testConnection: (platform: PlatformId) => Promise<boolean>;
  connectPlatform: (platform: PlatformId) => Promise<boolean>;
  disconnectPlatform: (platform: PlatformId) => void;

  // Sync operations
  pushToST: (localCardId: string) => Promise<SyncResult>;
  pullFromHub: (hubCardId: string) => Promise<SyncResult>;
  pushToArchive: (localCardId: string) => Promise<SyncResult>;
  syncCard: (localCardId: string, targetPlatform: PlatformId) => Promise<SyncResult>;

  // Sync state
  findSyncState: (platform: PlatformId, platformId: string) => Promise<CardSyncState | null>;
  refreshSyncStates: () => Promise<void>;
  clearSyncState: (federatedId: string) => Promise<void>;

  // Manual sync recording (for non-federation pushes like SillyTavernClient)
  recordManualSync: (localCardId: string, platform: PlatformId, platformId?: string) => Promise<void>;

  // Poll a platform to sync actual state (checks what's really there)
  pollPlatformSyncState: (platform: PlatformId) => Promise<void>;
}

export const useFederationStore = create<FederationStore>((set, get) => ({
  // Initial state
  initialized: false,
  syncEngine: null,
  stateStore: null,
  settings: DEFAULT_SETTINGS,
  syncStates: [],
  isSyncing: false,
  lastSyncResult: null,
  error: null,

  // Initialize the federation system
  initialize: async () => {
    if (get().initialized) return;

    try {
      // Load saved settings
      get().loadSettings();

      // Create sync state store
      const stateStore = createIndexedDBSyncStore();

      // Create sync engine with actorId and security options
      const baseUrl = window.location.origin;
      const secureHashing = localStorage.getItem('ca-federation-secure-hashing') === 'true';
      const engine = new SyncEngine({
        baseUrl,
        actorId: `${baseUrl}/user`,
        stateStore,
        // Use SHA-256 for change detection if secure hashing is enabled
        secureHashing,
      });

      // Always register the local editor adapter
      engine.registerPlatform(new LocalEditorAdapter());

      // Register other platforms based on settings
      const { settings } = get();

      if (settings.platforms.sillytavern?.enabled && settings.platforms.sillytavern.baseUrl) {
        const adapter = createSillyTavernAdapter(settings.platforms.sillytavern.baseUrl);
        engine.registerPlatform(adapter);
      }

      if (settings.platforms.hub?.enabled && settings.platforms.hub.baseUrl) {
        const adapter = createCardsHubAdapter(
          settings.platforms.hub.baseUrl,
          settings.platforms.hub.apiKey
        );
        engine.registerPlatform(adapter);
      }

      if (settings.platforms.archive?.enabled && settings.platforms.archive.baseUrl) {
        const adapter = createArchiveAdapter(
          settings.platforms.archive.baseUrl,
          settings.platforms.archive.apiKey
        );
        engine.registerPlatform(adapter);
      }

      set({ syncEngine: engine, stateStore, initialized: true, error: null });

      // Load sync states
      await get().refreshSyncStates();

      console.log('[Federation] Initialized', secureHashing ? '(secure hashing enabled)' : '');
    } catch (err) {
      console.error('[Federation] Failed to initialize:', err);
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // Load settings from localStorage
  loadSettings: () => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FederationSettings;
        // Merge with defaults to handle new fields
        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed,
            platforms: {
              ...DEFAULT_SETTINGS.platforms,
              ...parsed.platforms,
            },
          },
        });
      }
    } catch (err) {
      console.error('[Federation] Failed to load settings:', err);
    }
  },

  // Save settings to localStorage
  saveSettings: () => {
    try {
      const { settings } = get();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error('[Federation] Failed to save settings:', err);
    }
  },

  // Update a platform's configuration
  updatePlatformConfig: (platform, config) => {
    set((state) => ({
      settings: {
        ...state.settings,
        platforms: {
          ...state.settings.platforms,
          [platform]: {
            ...state.settings.platforms[platform],
            ...config,
          },
        },
      },
    }));
    get().saveSettings();
  },

  // Test connection to a platform
  testConnection: async (platform) => {
    const { syncEngine, settings } = get();

    // Check if platform is configured
    const platformConfig = settings.platforms[platform];
    if (!platformConfig?.baseUrl) {
      return false;
    }

    // For SillyTavern, test via the federation actor endpoint
    if (platform === 'sillytavern') {
      try {
        const response = await fetch(`${platformConfig.baseUrl}/api/plugins/cforge/federation/actor`, {
          method: 'GET',
        });
        const connected = response.ok;
        get().updatePlatformConfig(platform, { connected, lastChecked: new Date().toISOString() });
        return connected;
      } catch {
        get().updatePlatformConfig(platform, { connected: false, lastChecked: new Date().toISOString() });
        return false;
      }
    }

    // For other platforms, get the adapter and check availability
    if (syncEngine) {
      const platforms = syncEngine.getPlatforms();
      if (platforms.includes(platform)) {
        // Platform is registered, try to use adapter directly
        try {
          // Re-create adapter to test
          let connected = false;
          if (platform === 'hub' && platformConfig.baseUrl) {
            const adapter = createCardsHubAdapter(platformConfig.baseUrl, platformConfig.apiKey);
            connected = await adapter.isAvailable();
          } else if (platform === 'archive' && platformConfig.baseUrl) {
            const adapter = createArchiveAdapter(platformConfig.baseUrl, platformConfig.apiKey);
            connected = await adapter.isAvailable();
          }
          get().updatePlatformConfig(platform, { connected, lastChecked: new Date().toISOString() });
          return connected;
        } catch {
          get().updatePlatformConfig(platform, { connected: false, lastChecked: new Date().toISOString() });
          return false;
        }
      }
    }

    return false;
  },

  // Connect a platform (enable and test)
  connectPlatform: async (platform) => {
    const { settings } = get();
    const platformConfig = settings.platforms[platform];

    if (!platformConfig?.baseUrl) {
      set({ error: `No URL configured for ${platform}` });
      return false;
    }

    // Enable the platform
    get().updatePlatformConfig(platform, { enabled: true });

    // Re-initialize to register the new adapter
    set({ initialized: false });
    await get().initialize();

    // Test connection
    const connected = await get().testConnection(platform);

    if (!connected) {
      set({ error: `Failed to connect to ${platform}` });
    }

    return connected;
  },

  // Disconnect a platform
  disconnectPlatform: (platform) => {
    get().updatePlatformConfig(platform, { enabled: false, connected: false });

    // Re-initialize to unregister the adapter
    const { syncEngine } = get();
    if (syncEngine) {
      syncEngine.unregisterPlatform(platform);
    }
  },

  // Push to SillyTavern
  pushToST: async (localCardId) => {
    return get().syncCard(localCardId, 'sillytavern');
  },

  // Pull from CardsHub
  pullFromHub: async (hubCardId) => {
    const { syncEngine } = get();
    if (!syncEngine) {
      throw new Error('Federation not initialized');
    }

    set({ isSyncing: true, error: null });

    try {
      const result = await syncEngine.pullCard('hub', hubCardId, 'editor');
      set({ lastSyncResult: result, isSyncing: false });
      await get().refreshSyncStates();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      set({ error, isSyncing: false });
      throw err;
    }
  },

  // Push to Character Archive
  pushToArchive: async (localCardId) => {
    return get().syncCard(localCardId, 'archive');
  },

  // Generic sync card to platform
  syncCard: async (localCardId, targetPlatform) => {
    const { syncEngine } = get();
    if (!syncEngine) {
      throw new Error('Federation not initialized');
    }

    set({ isSyncing: true, error: null });

    try {
      const result = await syncEngine.pushCard('editor', localCardId, targetPlatform);
      set({ lastSyncResult: result, isSyncing: false });
      await get().refreshSyncStates();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      set({ error, isSyncing: false });
      throw err;
    }
  },

  // Find sync state by platform ID
  findSyncState: async (platform, platformId) => {
    const { stateStore } = get();
    if (!stateStore) return null;
    return stateStore.findByPlatformId(platform, platformId);
  },

  // Refresh all sync states
  refreshSyncStates: async () => {
    const { stateStore } = get();
    if (!stateStore) return;

    try {
      const states = await stateStore.list();
      set({ syncStates: states });
    } catch (err) {
      console.error('[Federation] Failed to refresh sync states:', err);
    }
  },

  // Clear sync state
  clearSyncState: async (federatedId) => {
    const { stateStore } = get();
    if (!stateStore) return;

    await stateStore.delete(federatedId);
    await get().refreshSyncStates();
  },

  // Record a manual sync (for non-federation pushes like SillyTavernClient)
  recordManualSync: async (localCardId, platform, platformId) => {
    const { initialized } = get();

    // Initialize if needed
    if (!initialized) {
      await get().initialize();
    }

    const store = get().stateStore;
    if (!store) {
      console.error('[Federation] Cannot record sync: store not initialized');
      return;
    }

    try {
      // Check if there's an existing sync state for this card
      const allStates = await store.list();
      let existingState = allStates.find((s) => s.localId === localCardId);

      const now = new Date().toISOString();
      const baseUrl = window.location.origin;
      const federatedId = existingState?.federatedId || `${baseUrl}/cards/${localCardId}`;

      const newState: CardSyncState = existingState ?? {
        localId: localCardId,
        federatedId,
        platformIds: {},
        lastSync: {},
        versionHash: '', // No hash for manual sync
        status: 'synced',
      };

      // Record the sync for this platform
      newState.platformIds[platform] = platformId || localCardId;
      newState.lastSync[platform] = now;
      newState.status = 'synced';

      await store.set(newState);
      await get().refreshSyncStates();

      console.log('[Federation] Recorded manual sync:', { localCardId, platform, platformId });
    } catch (err) {
      console.error('[Federation] Failed to record manual sync:', err);
    }
  },

  // Poll a platform to sync actual state (checks what's really there)
  pollPlatformSyncState: async (platform) => {
    const { settings, initialized } = get();

    // Initialize if needed
    if (!initialized) {
      await get().initialize();
    }

    const store = get().stateStore;
    if (!store) {
      console.error('[Federation] Cannot poll: store not initialized');
      return;
    }

    const platformConfig = settings.platforms[platform];
    if (!platformConfig?.enabled || !platformConfig?.baseUrl) {
      console.log('[Federation] Platform not enabled or no URL:', platform);
      return;
    }

    try {
      // Determine the outbox endpoint based on platform
      let outboxUrl: string;
      if (platform === 'sillytavern') {
        outboxUrl = `${platformConfig.baseUrl}/api/plugins/cforge/federation/outbox`;
      } else {
        outboxUrl = `${platformConfig.baseUrl}/api/federation/outbox`;
      }

      console.log('[Federation] Polling', platform, 'at', outboxUrl);

      const response = await fetch(outboxUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('[Federation] Failed to poll', platform, ':', response.status);
        return;
      }

      const data = await response.json();

      // The outbox returns an array of cards with their IDs
      // Format: { cards: [{ id, name, ... }] } or just an array
      const remoteCards: Array<{ id: string; name?: string }> = Array.isArray(data) ? data : (data.cards || data.items || []);

      console.log('[Federation] Found', remoteCards.length, 'cards on', platform);

      // Get current sync states
      const allStates = await store.list();
      const now = new Date().toISOString();

      // Build a set of remote card names for quick lookup
      const remoteCardNames = new Set(remoteCards.map(c => c.name?.toLowerCase()).filter(Boolean));

      // Get local cards to match against
      const { localDB } = await import('../../../lib/db');
      const localCards = await localDB.listCards();

      // For each local card, check if it exists on the remote platform
      for (const localCard of localCards) {
        const cardName = (localCard.data as any)?.data?.name || (localCard.data as any)?.name || '';
        const cardNameLower = cardName.toLowerCase();

        // Check if this card exists on the remote platform (by name match)
        const existsOnRemote = remoteCardNames.has(cardNameLower) ||
          remoteCards.some(rc => rc.name?.toLowerCase() === cardNameLower);

        // Find existing sync state for this card
        const existingState = allStates.find(s => s.localId === localCard.meta.id);

        if (existsOnRemote) {
          // Card exists on remote - ensure sync state reflects this
          const remoteCard = remoteCards.find(rc => rc.name?.toLowerCase() === cardNameLower);

          if (existingState) {
            // Update existing state
            existingState.platformIds[platform] = remoteCard?.id || cardName;
            existingState.lastSync[platform] = now;
            existingState.status = 'synced';
            await store.set(existingState);
          } else {
            // Create new sync state
            const baseUrl = window.location.origin;
            const newState: CardSyncState = {
              localId: localCard.meta.id,
              federatedId: `${baseUrl}/cards/${localCard.meta.id}`,
              platformIds: { [platform]: remoteCard?.id || cardName },
              lastSync: { [platform]: now },
              versionHash: '',
              status: 'synced',
            };
            await store.set(newState);
          }
        } else if (existingState?.platformIds[platform]) {
          // Card was synced but no longer exists on remote - remove that platform from sync state
          delete existingState.platformIds[platform];
          delete existingState.lastSync[platform];

          // If no platforms left, delete the sync state entirely
          if (Object.keys(existingState.platformIds).length === 0) {
            await store.delete(existingState.federatedId);
          } else {
            await store.set(existingState);
          }
        }
      }

      await get().refreshSyncStates();
      console.log('[Federation] Sync state updated from', platform);
    } catch (err) {
      console.error('[Federation] Failed to poll', platform, ':', err);
    }
  },
}));
