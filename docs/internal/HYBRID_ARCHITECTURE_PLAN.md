# Hybrid Architecture Plan: Client-Side Core + Optional Server

## Overview

Transform Card Architect into a hybrid app where **basic editing works entirely in-browser** without a server, while **power features** remain server-gated.

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER (Always Works)                  │
├─────────────────────────────────────────────────────────────┤
│  • Import PNG/JSON/CHARX files                              │
│  • Edit all card fields                                      │
│  • Export PNG/JSON/CHARX                                     │
│  • Store cards in IndexedDB                                  │
│  • Basic image crop/resize (Canvas API)                      │
│  • Preset management (local)                                 │
│  • Token counting (local tokenizers)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    (optional connection)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Power Features)                   │
├─────────────────────────────────────────────────────────────┤
│  • RAG / Semantic search                                     │
│  • LLM integration (API keys secured)                        │
│  • Web imports (Chub, Risu, etc. - bypasses CORS)           │
│  • ComfyUI integration                                       │
│  • Advanced image optimization (sharp)                       │
│  • Version history & sync                                    │
│  • Batch operations                                          │
│  • SillyTavern push                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Client-Side Card Engine

### New Package: `packages/card-engine`

A browser-compatible package that handles all card operations without Node.js dependencies.

```
packages/card-engine/
├── src/
│   ├── index.ts              # Public API
│   ├── import/
│   │   ├── png.ts            # PNG text chunk extraction
│   │   ├── json.ts           # JSON parsing & normalization
│   │   ├── charx.ts          # CHARX (ZIP) extraction
│   │   └── detect.ts         # Format detection
│   ├── export/
│   │   ├── png.ts            # PNG with embedded data
│   │   ├── json.ts           # JSON serialization
│   │   └── charx.ts          # CHARX packaging
│   ├── storage/
│   │   ├── indexeddb.ts      # IndexedDB adapter
│   │   └── types.ts          # Storage interface
│   ├── image/
│   │   ├── canvas.ts         # Canvas-based transforms
│   │   └── thumbnail.ts      # Generate thumbnails
│   ├── validation/
│   │   └── schema.ts         # Card schema validation
│   └── normalize/
│       ├── v2-to-v3.ts       # Spec conversion
│       └── macros.ts         # Macro format handling
├── package.json
└── tsconfig.json
```

### Key Dependencies (Browser-Compatible)

```json
{
  "dependencies": {
    "fflate": "^0.8.0",           // ZIP read/write (fast, small)
    "idb": "^8.0.0",              // IndexedDB wrapper
    "png-chunk-text": "^1.0.0",   // PNG tEXt chunk handling
    "upng-js": "^2.1.0"           // Pure JS PNG encoder
  }
}
```

### PNG Import (Browser)

```typescript
// packages/card-engine/src/import/png.ts
import { decode } from 'upng-js';

export async function extractCardFromPNG(file: File): Promise<CardData> {
  const buffer = await file.arrayBuffer();
  const chunks = extractPNGChunks(new Uint8Array(buffer));

  // Look for tEXt chunk with 'chara' keyword
  const charaChunk = chunks.find(c => c.keyword === 'chara');
  if (!charaChunk) {
    throw new Error('No character data found in PNG');
  }

  // Base64 decode the value
  const json = atob(charaChunk.value);
  return normalizeCardData(JSON.parse(json));
}

function extractPNGChunks(data: Uint8Array): PNGChunk[] {
  // Parse PNG structure, extract tEXt/iTXt chunks
  // ... implementation
}
```

### PNG Export (Browser)

```typescript
// packages/card-engine/src/export/png.ts
import UPNG from 'upng-js';

export async function createCardPNG(
  card: CardData,
  image: Blob | File
): Promise<Blob> {
  // 1. Load the image onto canvas
  const img = await createImageBitmap(image);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  // 2. Get raw RGBA data
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  // 3. Encode as PNG with custom tEXt chunk
  const cardJson = JSON.stringify(prepareForExport(card));
  const charaB64 = btoa(cardJson);

  const pngData = UPNG.encodeWithChunks(
    imageData.data,
    img.width,
    img.height,
    [{ keyword: 'chara', text: charaB64 }]
  );

  return new Blob([pngData], { type: 'image/png' });
}
```

### CHARX Import (Browser)

```typescript
// packages/card-engine/src/import/charx.ts
import { unzipSync } from 'fflate';

export async function extractCardFromCHARX(file: File): Promise<{
  card: CardData;
  assets: Map<string, Blob>;
}> {
  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));

  // Read card.json
  const cardJson = new TextDecoder().decode(unzipped['card.json']);
  const card = normalizeCardData(JSON.parse(cardJson));

  // Extract assets
  const assets = new Map<string, Blob>();
  for (const [path, data] of Object.entries(unzipped)) {
    if (path.startsWith('assets/')) {
      const mimeType = getMimeType(path);
      assets.set(path, new Blob([data], { type: mimeType }));
    }
  }

  return { card, assets };
}
```

### CHARX Export (Browser)

```typescript
// packages/card-engine/src/export/charx.ts
import { zipSync } from 'fflate';

export async function createCHARX(
  card: CardData,
  assets: Map<string, Blob>
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};

  // Add card.json
  const cardJson = JSON.stringify(prepareForExport(card), null, 2);
  files['card.json'] = new TextEncoder().encode(cardJson);

  // Add assets
  for (const [path, blob] of assets) {
    const buffer = await blob.arrayBuffer();
    files[path] = new Uint8Array(buffer);
  }

  const zipped = zipSync(files);
  return new Blob([zipped], { type: 'application/zip' });
}
```

---

## Phase 2: IndexedDB Storage Layer

### Database Schema

```typescript
// packages/card-engine/src/storage/indexeddb.ts
import { openDB, IDBPDatabase } from 'idb';

interface CardArchitectDB {
  cards: {
    key: string;           // UUID
    value: StoredCard;
    indexes: {
      'by-name': string;
      'by-updated': number;
    };
  };
  assets: {
    key: string;           // cardId:assetPath
    value: StoredAsset;
    indexes: {
      'by-card': string;
    };
  };
  presets: {
    key: string;
    value: StoredPreset;
  };
  settings: {
    key: string;
    value: unknown;
  };
}

interface StoredCard {
  id: string;
  data: CardData;
  thumbnail?: Blob;       // Cached thumbnail
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;      // Last sync with server (if connected)
}

interface StoredAsset {
  cardId: string;
  path: string;
  blob: Blob;
  metadata: AssetMetadata;
}
```

### Storage Service

```typescript
export class LocalCardStorage {
  private db: IDBPDatabase<CardArchitectDB>;

  async init() {
    this.db = await openDB<CardArchitectDB>('card-architect', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('by-name', 'data.name');
          cardStore.createIndex('by-updated', 'updatedAt');

          const assetStore = db.createObjectStore('assets', { keyPath: ['cardId', 'path'] });
          assetStore.createIndex('by-card', 'cardId');

          db.createObjectStore('presets', { keyPath: 'id' });
          db.createObjectStore('settings');
        }
      }
    });
  }

  async saveCard(card: CardData, assets?: Map<string, Blob>): Promise<string> {
    const id = card.meta?.id || crypto.randomUUID();
    const thumbnail = await this.generateThumbnail(card, assets);

    await this.db.put('cards', {
      id,
      data: card,
      thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (assets) {
      for (const [path, blob] of assets) {
        await this.db.put('assets', { cardId: id, path, blob, metadata: {} });
      }
    }

    return id;
  }

  async getCard(id: string): Promise<StoredCard | undefined> {
    return this.db.get('cards', id);
  }

  async listCards(): Promise<StoredCard[]> {
    return this.db.getAllFromIndex('cards', 'by-updated');
  }

  async getCardAssets(cardId: string): Promise<Map<string, Blob>> {
    const assets = await this.db.getAllFromIndex('assets', 'by-card', cardId);
    return new Map(assets.map(a => [a.path, a.blob]));
  }

  async deleteCard(id: string): Promise<void> {
    await this.db.delete('cards', id);
    // Delete associated assets
    const assets = await this.db.getAllFromIndex('assets', 'by-card', id);
    for (const asset of assets) {
      await this.db.delete('assets', [id, asset.path]);
    }
  }
}
```

---

## Phase 3: Unified API Layer

### Service Abstraction

```typescript
// apps/web/src/lib/card-service.ts

interface CardService {
  // Core operations
  importFile(file: File): Promise<ImportResult>;
  exportCard(cardId: string, format: ExportFormat): Promise<Blob>;
  saveCard(card: CardData, assets?: Map<string, Blob>): Promise<string>;
  getCard(id: string): Promise<CardData | null>;
  listCards(): Promise<CardSummary[]>;
  deleteCard(id: string): Promise<void>;

  // Assets
  getAssets(cardId: string): Promise<Map<string, Blob>>;
  uploadAsset(cardId: string, file: File): Promise<AssetInfo>;

  // Server-only (throws if offline)
  searchRAG(query: string, dbId: string): Promise<RAGResult[]>;
  invokeLLM(prompt: string, options: LLMOptions): Promise<LLMResponse>;
  importFromURL(url: string): Promise<ImportResult>;
  pushToSillyTavern(cardId: string): Promise<void>;
}
```

### Hybrid Implementation

```typescript
// apps/web/src/lib/services/hybrid-card-service.ts

export class HybridCardService implements CardService {
  private local: LocalCardStorage;
  private remote: ApiClient | null;
  private mode: 'offline' | 'online' | 'sync';

  constructor() {
    this.local = new LocalCardStorage();
    this.remote = null;
    this.mode = 'offline';
  }

  async connect(apiUrl: string): Promise<boolean> {
    try {
      this.remote = new ApiClient(apiUrl);
      await this.remote.healthCheck();
      this.mode = 'online';
      return true;
    } catch {
      this.mode = 'offline';
      return false;
    }
  }

  async importFile(file: File): Promise<ImportResult> {
    // Always works - pure client-side
    const engine = await import('@card-architect/card-engine');
    const format = engine.detectFormat(file);

    let card: CardData;
    let assets: Map<string, Blob> | undefined;

    switch (format) {
      case 'png':
        card = await engine.extractCardFromPNG(file);
        break;
      case 'json':
        card = await engine.parseCardJSON(await file.text());
        break;
      case 'charx':
        const result = await engine.extractCardFromCHARX(file);
        card = result.card;
        assets = result.assets;
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const id = await this.local.saveCard(card, assets);

    // If online, also save to server
    if (this.mode === 'online' && this.remote) {
      await this.remote.importCard(file);
    }

    return { card, id, warnings: [] };
  }

  async exportCard(cardId: string, format: ExportFormat): Promise<Blob> {
    // Always works - pure client-side
    const engine = await import('@card-architect/card-engine');
    const stored = await this.local.getCard(cardId);
    if (!stored) throw new Error('Card not found');

    const assets = await this.local.getCardAssets(cardId);

    switch (format) {
      case 'json':
        return engine.exportAsJSON(stored.data);
      case 'png':
        const mainAsset = this.getMainAsset(assets);
        return engine.createCardPNG(stored.data, mainAsset);
      case 'charx':
        return engine.createCHARX(stored.data, assets);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Server-only features
  async searchRAG(query: string, dbId: string): Promise<RAGResult[]> {
    this.requireOnline('RAG search');
    return this.remote!.searchRAG(query, dbId);
  }

  async invokeLLM(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    this.requireOnline('LLM');
    return this.remote!.invokeLLM(prompt, options);
  }

  async importFromURL(url: string): Promise<ImportResult> {
    this.requireOnline('URL import');
    return this.remote!.importCardFromURL(url);
  }

  private requireOnline(feature: string): void {
    if (this.mode === 'offline') {
      throw new OfflineError(`${feature} requires server connection`);
    }
  }
}
```

---

## Phase 4: UI Integration

### Connection Status Component

```tsx
// apps/web/src/components/ConnectionStatus.tsx

export function ConnectionStatus() {
  const { mode, serverUrl, connect, disconnect } = useCardService();

  return (
    <div className="connection-status">
      {mode === 'offline' ? (
        <>
          <span className="status-dot offline" />
          <span>Offline Mode</span>
          <button onClick={() => setShowConnect(true)}>
            Connect to Server
          </button>
        </>
      ) : (
        <>
          <span className="status-dot online" />
          <span>Connected to {serverUrl}</span>
          <button onClick={disconnect}>Disconnect</button>
        </>
      )}
    </div>
  );
}
```

### Feature Gating

```tsx
// apps/web/src/components/FeatureGate.tsx

interface FeatureGateProps {
  feature: 'rag' | 'llm' | 'webimport' | 'comfyui' | 'sillytavern';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { mode } = useCardService();

  if (mode === 'offline') {
    return fallback ?? (
      <div className="feature-unavailable">
        <LockIcon />
        <p>Connect to server to use {FEATURE_NAMES[feature]}</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Usage in components:
<FeatureGate feature="rag">
  <RAGSearchPanel />
</FeatureGate>
```

### Offline-First Dashboard

```tsx
// Modify apps/web/src/features/dashboard/CardGrid.tsx

export function CardGrid() {
  const { listCards, mode } = useCardService();
  const [cards, setCards] = useState<CardSummary[]>([]);

  useEffect(() => {
    // Always loads from local storage first
    listCards().then(setCards);
  }, []);

  return (
    <div className="card-grid">
      {mode === 'offline' && (
        <Banner variant="info">
          Working offline. Your cards are saved locally.
        </Banner>
      )}

      {cards.map(card => (
        <CardTile key={card.id} card={card} />
      ))}

      <ImportButton />

      {mode === 'online' && <WebImportButton />}
    </div>
  );
}
```

---

## Phase 5: Migration Path

### For Existing Users

1. **First Load Detection**
   - Check if server is reachable
   - If yes, offer to sync existing cards to local storage
   - If no, start in offline mode

2. **Sync Strategy**
   ```typescript
   async function initialSync() {
     const serverCards = await remote.listCards();
     const localCards = await local.listCards();

     // Merge by ID, prefer newer updatedAt
     for (const serverCard of serverCards) {
       const localCard = localCards.find(c => c.id === serverCard.id);
       if (!localCard || serverCard.updatedAt > localCard.updatedAt) {
         await local.saveCard(serverCard);
       }
     }
   }
   ```

3. **Conflict Resolution**
   - Show diff when same card edited in both places
   - Let user choose which version to keep

---

## Implementation Order

### GOOD NEWS: Existing Packages Are Browser-Ready!

The following packages already work in the browser with no changes:

| Package | Status | Key Dependencies |
|---------|--------|------------------|
| `@card-architect/charx` | ✅ Ready | `fflate` (browser-native ZIP) |
| `@card-architect/utils` | ✅ Ready | Pure JS (`Uint8Array`, `TextEncoder`) |
| `@card-architect/schemas` | ✅ Ready | `ajv` (browser-native validation) |

**What's actually needed:**

### Stage 1: PNG Support Package
- [ ] Create `packages/png` for PNG tEXt chunk read/write
- [ ] Use `png-chunks-extract` + `png-chunks-encode` (browser-compatible)
- [ ] Export functions: `extractCardFromPNG`, `embedCardInPNG`

### Stage 2: IndexedDB Storage
- [ ] Create `packages/storage` with `idb` wrapper
- [ ] Card CRUD with IndexedDB
- [ ] Asset blob storage
- [ ] Local preset storage

### Stage 3: Hybrid Service Layer
- [ ] Create `HybridCardService` in web app
- [ ] Detect server availability on load
- [ ] Route operations: local vs remote
- [ ] Feature detection for power features

### Stage 4: UI Integration
- [ ] Add `ConnectionStatus` header component
- [ ] Create `FeatureGate` wrapper component
- [ ] Update import flow to use local processing
- [ ] Update export flow to use local processing
- [ ] Show offline/online indicators

### Stage 5: Polish
- [ ] Sync strategy when server becomes available
- [ ] PWA manifest for installability
- [ ] Service worker for offline caching

---

## File Changes Summary

### New Packages
```
packages/png/                    # NEW - PNG tEXt chunk handling
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── extract.ts              # Read tEXt/iTXt chunks from PNG
    └── embed.ts                # Write tEXt chunk to PNG

packages/storage/               # NEW - Browser storage abstraction
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── indexeddb.ts            # IndexedDB implementation
    └── types.ts                # Storage interface
```

### New Web App Files
```
apps/web/src/
├── lib/services/
│   ├── hybrid-card-service.ts  # Routes local vs remote operations
│   └── card-engine.ts          # Client-side card processing
├── components/shared/
│   ├── ConnectionStatus.tsx    # Server connection indicator
│   └── FeatureGate.tsx         # Wraps server-only features
└── hooks/
    └── useCardService.ts       # React hook for hybrid service
```

### Modified Files
```
apps/web/src/
├── lib/api.ts              # Make server optional
├── lib/db.ts               # Expand from drafts-only to full storage
├── store/card-store.ts     # Use HybridCardService
├── features/dashboard/     # Load from local storage
└── main.tsx                # Initialize hybrid service
```

### Existing Packages (No Changes Needed)
```
packages/charx/             # ✅ Already browser-compatible
packages/utils/             # ✅ Already browser-compatible
packages/schemas/           # ✅ Already browser-compatible
```

---

## Open Questions

1. **Sync frequency**: Real-time vs manual sync when online?
2. **Storage limits**: IndexedDB has ~50MB default, prompt for more?
3. **Asset deduplication**: Hash-based dedup for shared assets?
4. **Encryption**: Encrypt local storage for sensitive cards?
5. **Export queue**: Queue exports when offline, process when online?
