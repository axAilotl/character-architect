# Federation Implementation Plan for Character Architect

**Goal:** Enable bi-directional sync between CardsHub, Character Architect, and SillyTavern.

**Date:** 2024-12-05

---

## Workflow

```
CardsHub → Character Architect → SillyTavern
              ↑        ↓
           (edit)   (sync new/overwrite)
```

### Example Flow
1. User sees a card on CardsHub
2. Sends it to Character Architect (CA)
3. From CA, syncs to SillyTavern
4. Plays the card in ST
5. Edits it in CA
6. Syncs back to ST as new or overwrites existing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Character Architect (Web)                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  card-store  │←→│  SyncEngine  │←→│  IndexedDB SyncStateStore │ │
│  └──────────────┘   └──────────────┘   └──────────────────────────┘ │
│         ↑                  ↑                                         │
│         │                  │                                         │
│  ┌──────────────┐   ┌──────────────────────────────────────────┐   │
│  │ FederationUI │   │            Platform Adapters              │   │
│  │    Panel     │   ├────────────────┬─────────────────────────┤   │
│  └──────────────┘   │ CardsHub HTTP  │  SillyTavern HTTP       │   │
│                     │ Adapter        │  (via CForge plugin)    │   │
│                     └────────────────┴─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓                    ↓
                    ┌─────────────────┐   ┌─────────────────┐
                    │   CardsHub API  │   │ SillyTavern     │
                    │   (Cloudflare)  │   │ /api/plugins/   │
                    └─────────────────┘   │ cforge/*        │
                                          └─────────────────┘
```

---

## Dependencies

The implementation uses `@character-foundry/federation` package which provides:
- `SyncEngine` - Coordinates sync between platforms
- `PlatformAdapter` interface - Each platform implements this
- `SyncStateStore` interface - Tracks sync state per card
- `CardSyncState` - Tracks which platforms have which version

---

## Implementation Files

### 1. IndexedDB Sync State Store

**File:** `apps/web/src/lib/federation/idb-sync-store.ts`

```typescript
import type { SyncStateStore, CardSyncState, PlatformId } from '@character-foundry/federation';

const DB_NAME = 'character-architect-sync';
const STORE_NAME = 'sync-state';

export function createIndexedDBSyncStore(): SyncStateStore {
  let db: IDBDatabase | null = null;

  async function getDb(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'federatedId' });
          store.createIndex('localId', 'localId', { unique: false });
          store.createIndex('platformIds', 'platformIds', { multiEntry: false });
        }
      };

      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  return {
    async get(federatedId: string): Promise<CardSyncState | null> {
      const database = await getDb();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(federatedId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    },

    async set(state: CardSyncState): Promise<void> {
      const database = await getDb();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(state);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async delete(federatedId: string): Promise<void> {
      const database = await getDb();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(federatedId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async list(): Promise<CardSyncState[]> {
      const database = await getDb();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    },

    async findByPlatformId(platform: PlatformId, platformId: string): Promise<CardSyncState | null> {
      const allStates = await this.list();
      return allStates.find(s => s.platformIds[platform] === platformId) || null;
    },
  };
}
```

---

### 2. Platform Adapter Configurations

**File:** `apps/web/src/lib/federation/adapters.ts`

```typescript
import {
  HttpPlatformAdapter,
  SillyTavernAdapter,
  type SillyTavernBridge
} from '@character-foundry/federation';
import type { CCv3Data } from '@character-foundry/schemas';

/**
 * CardsHub adapter
 * Connects to CardsHub API for browsing and importing cards
 */
export function createCardsHubAdapter(baseUrl: string, apiKey?: string): HttpPlatformAdapter {
  return new HttpPlatformAdapter({
    platform: 'hub',
    displayName: 'CardsHub',
    baseUrl,
    endpoints: {
      list: '/api/cards',
      get: '/api/cards',
      create: '/api/cards',
      update: '/api/cards',
      delete: '/api/cards',
      assets: '/api/cards/assets',
      health: '/api/health',
    },
    auth: apiKey ? { type: 'bearer', token: apiKey } : undefined,
    transformers: {
      list: (data: any) => data.cards.map((c: any) => ({
        id: c.id,
        card: c.data,
        updatedAt: c.updatedAt,
      })),
      get: (data: any) => data.data as CCv3Data,
      extractId: (data: any) => data.id,
    },
  });
}

/**
 * SillyTavern adapter (via CForge plugin HTTP API)
 * Connects to SillyTavern through the CForge plugin
 */
export function createSillyTavernAdapter(stBaseUrl: string): HttpPlatformAdapter {
  return new HttpPlatformAdapter({
    platform: 'sillytavern',
    displayName: 'SillyTavern',
    baseUrl: stBaseUrl,
    endpoints: {
      list: '/api/plugins/cforge/cards',
      get: '/api/plugins/cforge/cards',  // + /:filename/data
      create: '/api/plugins/cforge/sync/import',
      update: '/api/plugins/cforge/sync/import',
      delete: '/api/plugins/cforge/cards',
      health: '/api/plugins/cforge/probe',
    },
    transformers: {
      list: (data: any) => data.cards.map((c: any) => ({
        id: c.file,
        card: c, // Metadata only, will need full fetch for card data
        updatedAt: c.fileStats?.mtime || new Date().toISOString(),
      })),
      get: (data: any) => data as CCv3Data,
      extractId: (data: any) => data.filename,
      create: (card: CCv3Data) => ({
        cardData: card,
        filename: card.data.name,
        overwrite: false,
      }),
      update: (card: CCv3Data) => ({
        cardData: card,
        filename: card.data.name,
        overwrite: true,
      }),
    },
  });
}

/**
 * Local Editor adapter
 * Wraps the local IndexedDB card storage
 */
export function createEditorAdapter(
  getCard: (id: string) => Promise<CCv3Data | null>,
  listCards: () => Promise<Array<{ id: string; card: CCv3Data; updatedAt: string }>>,
  saveCard: (card: CCv3Data, id?: string) => Promise<string>,
  deleteCard: (id: string) => Promise<boolean>,
): HttpPlatformAdapter {
  // This is a pseudo-adapter that wraps local storage
  // In practice, we'll use direct function calls
  return new HttpPlatformAdapter({
    platform: 'editor',
    displayName: 'Character Architect',
    baseUrl: '',
    endpoints: {
      list: '/local/cards',
      get: '/local/cards',
      create: '/local/cards',
      update: '/local/cards',
      delete: '/local/cards',
    },
  });
}
```

---

### 3. Federation Store (Zustand)

**File:** `apps/web/src/store/federation-store.ts`

```typescript
import { create } from 'zustand';
import {
  SyncEngine,
  type CardSyncState,
  type SyncResult,
  type PlatformId
} from '@character-foundry/federation';
import { createIndexedDBSyncStore } from '../lib/federation/idb-sync-store';
import { createCardsHubAdapter, createSillyTavernAdapter } from '../lib/federation/adapters';

interface PlatformConfig {
  id: PlatformId;
  name: string;
  baseUrl: string;
  apiKey?: string;
  connected: boolean;
}

interface FederationStore {
  // State
  syncEngine: SyncEngine | null;
  platforms: Map<PlatformId, PlatformConfig>;
  syncStates: CardSyncState[];
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;

  // Actions
  initialize: () => Promise<void>;
  configurePlatform: (platform: PlatformId, baseUrl: string, apiKey?: string) => Promise<void>;
  testConnection: (platform: PlatformId) => Promise<boolean>;

  // Sync operations
  pushToST: (localCardId: string, overwrite?: boolean) => Promise<SyncResult>;
  pullFromHub: (hubCardId: string) => Promise<SyncResult>;
  syncCard: (localCardId: string, targetPlatforms: PlatformId[]) => Promise<SyncResult[]>;
  getSyncState: (localCardId: string) => CardSyncState | null;
  refreshSyncStates: () => Promise<void>;
}

export const useFederationStore = create<FederationStore>((set, get) => ({
  syncEngine: null,
  platforms: new Map(),
  syncStates: [],
  isSyncing: false,
  lastSyncResult: null,

  initialize: async () => {
    const stateStore = createIndexedDBSyncStore();

    const engine = new SyncEngine({
      baseUrl: window.location.origin,
      actorId: `${window.location.origin}/user`,
      stateStore,
      autoSyncInterval: 0, // Manual sync only
    });

    // Load saved platform configs from localStorage
    const savedConfigs = JSON.parse(localStorage.getItem('federation-platforms') || '{}');

    if (savedConfigs.hub) {
      const hubAdapter = createCardsHubAdapter(savedConfigs.hub.baseUrl, savedConfigs.hub.apiKey);
      engine.registerPlatform(hubAdapter);
    }

    if (savedConfigs.sillytavern) {
      const stAdapter = createSillyTavernAdapter(savedConfigs.sillytavern.baseUrl);
      engine.registerPlatform(stAdapter);
    }

    set({ syncEngine: engine });
    await get().refreshSyncStates();
  },

  configurePlatform: async (platform, baseUrl, apiKey) => {
    const { syncEngine } = get();
    if (!syncEngine) return;

    // Save to localStorage
    const saved = JSON.parse(localStorage.getItem('federation-platforms') || '{}');
    saved[platform] = { baseUrl, apiKey };
    localStorage.setItem('federation-platforms', JSON.stringify(saved));

    // Register adapter
    if (platform === 'hub') {
      const adapter = createCardsHubAdapter(baseUrl, apiKey);
      syncEngine.registerPlatform(adapter);
    } else if (platform === 'sillytavern') {
      const adapter = createSillyTavernAdapter(baseUrl);
      syncEngine.registerPlatform(adapter);
    }

    // Test connection
    const connected = await get().testConnection(platform);

    set(state => ({
      platforms: new Map(state.platforms).set(platform, {
        id: platform,
        name: platform === 'hub' ? 'CardsHub' : 'SillyTavern',
        baseUrl,
        apiKey,
        connected,
      })
    }));
  },

  testConnection: async (platform) => {
    const { syncEngine } = get();
    if (!syncEngine) return false;

    const platforms = syncEngine.getPlatforms();
    if (!platforms.includes(platform)) return false;

    try {
      // TODO: Add proper health check via adapter.isAvailable()
      return true;
    } catch {
      return false;
    }
  },

  pushToST: async (localCardId, overwrite = false) => {
    const { syncEngine } = get();
    if (!syncEngine) throw new Error('Federation not initialized');

    set({ isSyncing: true });

    try {
      // Push from editor to SillyTavern
      const result = await syncEngine.pushCard('editor', localCardId, 'sillytavern');

      set({ lastSyncResult: result });
      await get().refreshSyncStates();

      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  pullFromHub: async (hubCardId) => {
    const { syncEngine } = get();
    if (!syncEngine) throw new Error('Federation not initialized');

    set({ isSyncing: true });

    try {
      // Pull from CardsHub to editor (local)
      const result = await syncEngine.pullCard('hub', hubCardId, 'editor');

      set({ lastSyncResult: result });
      await get().refreshSyncStates();

      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  syncCard: async (localCardId, targetPlatforms) => {
    const { syncEngine } = get();
    if (!syncEngine) throw new Error('Federation not initialized');

    set({ isSyncing: true });

    try {
      const results: SyncResult[] = [];

      for (const platform of targetPlatforms) {
        const result = await syncEngine.pushCard('editor', localCardId, platform);
        results.push(result);
      }

      await get().refreshSyncStates();
      return results;
    } finally {
      set({ isSyncing: false });
    }
  },

  getSyncState: (localCardId) => {
    const { syncStates } = get();
    return syncStates.find(s => s.localId === localCardId) || null;
  },

  refreshSyncStates: async () => {
    const { syncEngine } = get();
    if (!syncEngine) return;

    const store = createIndexedDBSyncStore();
    const states = await store.list();
    set({ syncStates: states });
  },
}));
```

---

### 4. Federation UI Panel (React)

**File:** `apps/web/src/features/editor/components/FederationPanel.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useFederationStore } from '../../../store/federation-store';
import { useCardStore } from '../../../store/card-store';

export function FederationPanel() {
  const { currentCard } = useCardStore();
  const {
    platforms,
    syncStates,
    isSyncing,
    initialize,
    configurePlatform,
    pushToST,
    getSyncState,
  } = useFederationStore();

  const [stUrl, setStUrl] = useState('http://localhost:8000');
  const [hubUrl, setHubUrl] = useState('https://cardshub.example.com');
  const [hubApiKey, setHubApiKey] = useState('');

  useEffect(() => {
    initialize();
  }, []);

  const cardSyncState = currentCard?.meta.id
    ? getSyncState(currentCard.meta.id)
    : null;

  const handleSyncToST = async (overwrite: boolean) => {
    if (!currentCard?.meta.id) return;

    try {
      const result = await pushToST(currentCard.meta.id, overwrite);
      if (result.success) {
        alert(`Card synced to SillyTavern!`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  };

  return (
    <div className="federation-panel p-4 space-y-6">
      <h2 className="text-lg font-bold">Federation Sync</h2>

      {/* Platform Configuration */}
      <div className="space-y-4">
        <h3 className="font-semibold">Platforms</h3>

        {/* SillyTavern Config */}
        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">SillyTavern</span>
            <span className={`px-2 py-1 rounded text-sm ${
              platforms.get('sillytavern')?.connected
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {platforms.get('sillytavern')?.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <input
            type="text"
            value={stUrl}
            onChange={(e) => setStUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="w-full px-3 py-2 border rounded mb-2"
          />
          <button
            onClick={() => configurePlatform('sillytavern', stUrl)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect
          </button>
        </div>

        {/* CardsHub Config */}
        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">CardsHub</span>
            <span className={`px-2 py-1 rounded text-sm ${
              platforms.get('hub')?.connected
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {platforms.get('hub')?.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <input
            type="text"
            value={hubUrl}
            onChange={(e) => setHubUrl(e.target.value)}
            placeholder="https://cardshub.example.com"
            className="w-full px-3 py-2 border rounded mb-2"
          />
          <input
            type="password"
            value={hubApiKey}
            onChange={(e) => setHubApiKey(e.target.value)}
            placeholder="API Key (optional)"
            className="w-full px-3 py-2 border rounded mb-2"
          />
          <button
            onClick={() => configurePlatform('hub', hubUrl, hubApiKey)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect
          </button>
        </div>
      </div>

      {/* Current Card Sync Status */}
      {currentCard && (
        <div className="space-y-4">
          <h3 className="font-semibold">Current Card: {currentCard.meta.name}</h3>

          {cardSyncState ? (
            <div className="border rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${
                  cardSyncState.status === 'synced' ? 'bg-green-500' :
                  cardSyncState.status === 'pending' ? 'bg-yellow-500' :
                  cardSyncState.status === 'conflict' ? 'bg-red-500' :
                  'bg-gray-500'
                }`} />
                <span className="capitalize">{cardSyncState.status}</span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                {Object.entries(cardSyncState.platformIds).map(([platform, id]) => (
                  <div key={platform}>
                    <strong>{platform}:</strong> {id}
                    {cardSyncState.lastSync[platform as keyof typeof cardSyncState.lastSync] && (
                      <span className="ml-2 text-gray-400">
                        (synced: {new Date(cardSyncState.lastSync[platform as keyof typeof cardSyncState.lastSync]!).toLocaleString()})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Card not synced to any platform</p>
          )}

          {/* Sync Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleSyncToST(false)}
              disabled={isSyncing || !platforms.get('sillytavern')?.connected}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync as New to ST'}
            </button>

            {cardSyncState?.platformIds.sillytavern && (
              <button
                onClick={() => handleSyncToST(true)}
                disabled={isSyncing || !platforms.get('sillytavern')?.connected}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
              >
                {isSyncing ? 'Syncing...' : 'Overwrite in ST'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync History */}
      {syncStates.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">All Synced Cards ({syncStates.length})</h3>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {syncStates.map(state => (
              <div key={state.federatedId} className="text-sm p-2 bg-gray-50 rounded">
                <span className="font-medium">{state.localId}</span>
                <span className={`ml-2 px-1 rounded text-xs ${
                  state.status === 'synced' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {state.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Required CForge Plugin Updates

The SillyTavern-CForge plugin needs an additional endpoint for importing cards from Character Architect:

**Add to:** `/mnt/samesung/ai/SillyTavern/plugins/SillyTavern-CForge/src/index.ts`

```typescript
// POST /sync/import - Create/update a card from Character Architect
router.post('/sync/import', jsonParser, async (req: Request, res: Response) => {
    try {
        const { cardData, filename, image, overwrite } = req.body;
        const handle = normalizeHandle(req.body.user);

        if (!cardData || !filename) {
            return res.status(400).json({ error: 'cardData and filename are required' });
        }

        const directories = getUserDirectories(handle);

        // Sanitize filename
        let safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (!safeFilename.endsWith('.png')) {
            safeFilename += '.png';
        }

        let finalPath = path.join(directories.characters, safeFilename);

        // Check if exists when not overwriting
        if (!overwrite) {
            try {
                await fs.access(finalPath);
                // File exists, append timestamp
                const base = path.parse(safeFilename).name;
                safeFilename = `${base}_${Date.now()}.png`;
                finalPath = path.join(directories.characters, safeFilename);
            } catch {
                // Doesn't exist, use original name
            }
        }

        // Write the PNG with embedded card data
        if (image) {
            // image is base64 encoded PNG
            const imageBuffer = Buffer.from(image, 'base64');
            await writeCharacterCard(finalPath, JSON.stringify(cardData), imageBuffer);
        } else {
            // No image provided - create with placeholder or just card data
            // writeCharacterCard should handle this
            await writeCharacterCard(finalPath, JSON.stringify(cardData));
        }

        // Clear cache to reflect new card
        cache.delete(handle);

        console.log(chalk.green(MODULE_NAME), `Imported ${safeFilename} from CA`);

        return res.json({
            success: true,
            filename: safeFilename,
            path: finalPath,
            overwritten: overwrite,
        });
    } catch (error) {
        console.error(chalk.red(MODULE_NAME), 'Import failed:', error);
        return res.status(500).json({ error: 'Import failed', details: String(error) });
    }
});
```

---

## Complete Workflow Example

```typescript
// 1. User sees card on CardsHub, imports to CA
const hubCard = await fetch('https://cardshub.example.com/api/cards/abc123');
const imported = await cardStore.importCardFromURL(hubCard.downloadUrl);

// 2. CA automatically tracks origin via federation
await federationStore.pullFromHub('abc123');
// Creates sync state: { localId: 'xxx', platformIds: { hub: 'abc123', editor: 'xxx' } }

// 3. User edits card in CA...
cardStore.updateCardData({ description: 'Updated description' });
cardStore.saveCard();

// 4. User syncs to SillyTavern (as new)
const result = await federationStore.pushToST(imported.id, false);
// result.newState.platformIds = {
//   hub: 'abc123',
//   editor: 'local-id',
//   sillytavern: 'Character_Name.png'
// }

// 5. Later, user makes more edits...
cardStore.updateCardData({ personality: 'Even more personality' });

// 6. User chooses to overwrite existing in ST
await federationStore.pushToST(imported.id, true);
// Overwrites 'Character_Name.png' with new data
```

---

## Conflict Resolution

When both CA and ST have changes, the SyncEngine detects conflicts:

```typescript
// Conflict detected
syncState.status = 'conflict';
syncState.conflict = {
  localVersion: 'hash1',      // CA version
  remoteVersion: 'hash2',     // ST version
  remotePlatform: 'sillytavern',
};

// Resolve by choosing a version
await syncEngine.resolveConflict(federatedId, 'local');   // Keep CA version
await syncEngine.resolveConflict(federatedId, 'remote');  // Keep ST version
await syncEngine.resolveConflict(federatedId, 'merge', mergedCard); // Custom merge
```

---

## Environment Variables

### Character Architect
```env
# Optional: Pre-configure platforms
VITE_CARDSHUB_URL=https://cardshub.example.com
VITE_SILLYTAVERN_URL=http://localhost:8000
```

### SillyTavern CForge Plugin
```env
CFORGE_BASE_URL=http://localhost:3000  # Character Architect API (if using server mode)
CFORGE_API_KEY=xxx
CFORGE_EVAL_ENDPOINT=http://localhost:8001
```

---

## TODO / Future Enhancements

1. **Automatic Sync Detection** - Watch for file changes in ST and prompt user
2. **Bulk Sync** - Sync multiple cards at once
3. **Sync History** - Track all sync operations with timestamps
4. **Conflict UI** - Visual diff viewer for resolving conflicts
5. **CardsHub Browser** - Browse and import cards directly from CA
6. **Webhook Support** - Real-time notifications when cards change
7. **ActivityPub Full Integration** - Enable true federation with other hubs

---

## Related Files

- `@character-foundry/federation` - Core federation package
  - `/home/vega/ai/card-ecosystem/character-foundry/packages/federation/src/`
- SillyTavern CForge Plugin
  - `/mnt/samesung/ai/SillyTavern/plugins/SillyTavern-CForge/`
- Character Architect
  - `/mnt/samesung/ai/card_doctor/`
- Federation Plan (CardsHub)
  - `/home/vega/ai/card-ecosystem/character-foundry/Federation-plan.md`
