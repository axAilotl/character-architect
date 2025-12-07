# Card Architect Deployment Modes

## Overview

Card Architect can run in multiple deployment modes, from fully self-hosted with all features to a lightweight static demo that runs entirely in the browser.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT SPECTRUM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FULL LOCAL              LIGHT SERVER              STATIC DEMO             │
│   ────────────            ────────────              ───────────             │
│   All features            Thin proxy only           Browser-only            │
│   Self-hosted             Cheap VPS ($5/mo)         GitHub Pages / CDN      │
│   Max privacy             Minimal bandwidth         Zero server cost        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mode 1: Full Local (Self-Hosted)

**Target**: Power users running locally or on their own server

```json
{
  "mode": "full",
  "features": {
    "import": true,
    "export": true,
    "webImport": true,
    "rag": true,
    "llm": true,
    "comfyui": true,
    "sillyTavern": true,
    "imageOptimization": true
  }
}
```

**What runs where**:
| Feature | Runs On |
|---------|---------|
| Card editing | Browser |
| Import/Export PNG/JSON/CHARX | Browser |
| RAG embeddings | Browser (WebGPU) or Server |
| LLM integration | Browser (OpenRouter/Anthropic) or Server |
| Web imports (Chub, etc) | Server (CORS proxy) |
| ComfyUI | Server (WebSocket bridge) |
| SillyTavern push | Browser (direct to local ST) |
| Image optimization | Server (sharp) or Browser (Canvas) |

---

## Mode 2: Light Server (Hosted Demo)

**Target**: Hosted instance on cheap VPS for public demo/testing

```json
{
  "mode": "light",
  "features": {
    "import": true,
    "export": true,
    "webImport": false,      // Disabled - bandwidth hog
    "rag": "client",         // Browser-only with WebGPU
    "llm": "client",         // Browser direct to OpenRouter/Anthropic (BYOK)
    "comfyui": false,        // Disabled - no ComfyUI on VPS
    "sillyTavern": true,     // Works - browser talks to user's local ST
    "imageOptimization": "client"  // Browser Canvas API
  }
}
```

**Server responsibilities** (minimal):
- Serve static files (web app)
- Health check endpoint
- Analytics (optional)

**Everything else runs in browser**:
- Card import/export (PNG, JSON, CHARX)
- RAG with Transformers.js + WebGPU
- Storage in IndexedDB
- SillyTavern push (direct from browser)

**Cost**: ~$5/mo VPS or free (Cloudflare Pages, Vercel, GitHub Pages)

---

## Mode 3: Static Demo (Zero Server)

**Target**: GitHub Pages, CDN-hosted demo, offline PWA

```json
{
  "mode": "static",
  "features": {
    "import": true,
    "export": true,
    "webImport": false,
    "rag": "client",
    "llm": false,
    "comfyui": false,
    "sillyTavern": true,
    "imageOptimization": "client"
  }
}
```

**100% browser**:
- Single HTML + JS bundle
- All processing client-side
- IndexedDB for persistence
- PWA for offline use

---

## Feature Breakdown: What Needs a Server?

| Feature | Client-Side? | Notes |
|---------|-------------|-------|
| **PNG Import** | ✅ Yes | `png-chunks-extract` in browser |
| **PNG Export** | ✅ Yes | Canvas API + tEXt chunks |
| **JSON Import/Export** | ✅ Yes | Native JSON |
| **CHARX Import/Export** | ✅ Yes | `fflate` already browser-ready |
| **Card Editing** | ✅ Yes | React, already client-side |
| **IndexedDB Storage** | ✅ Yes | Browser native |
| **RAG Embeddings** | ✅ Yes | Transformers.js + WebGPU (2025: ~90% browser support) |
| **Vector Search** | ✅ Yes | Cosine similarity in JS |
| **SillyTavern Push** | ✅ Yes | Direct HTTP to localhost (no CORS issue) |
| **Token Counting** | ✅ Yes | Already have tokenizers package |
| **LLM (OpenRouter)** | ✅ Yes | CORS enabled, BYOK in localStorage |
| **LLM (Anthropic)** | ✅ Yes | `anthropic-dangerous-direct-browser-access: true` header |
| **LLM (OpenAI direct)** | ❌ No | CORS blocked - use OpenRouter instead |
| **Web Import (Chub)** | ⚠️ Partial | Userscript extracts URL, browser downloads file |
| **ComfyUI** | ⚠️ Partial | Works if user's ComfyUI allows CORS or same origin |
| **Sharp Optimization** | ❌ No | But Canvas API works for basics |

### LLM Provider CORS Status (2025)

| Provider | Browser Direct? | Method |
|----------|----------------|--------|
| **OpenRouter** | ✅ Yes | Full CORS support, unified API |
| **Anthropic** | ✅ Yes | Header: `anthropic-dangerous-direct-browser-access: true` |
| **xAI (Grok)** | ✅ Yes | CORS enabled |
| **OpenAI** | ❌ No | CORS blocked intentionally |
| **Google** | ❌ No | CORS blocked |

**Recommendation**: Use OpenRouter as default for client-side. It proxies all providers (OpenAI, Anthropic, Google, etc.) with CORS enabled.

### Web Import: Hybrid Approach

The userscript already runs in the user's browser on character sites. It can:
1. Extract the direct download URL for the card file
2. Send just the URL to Card Architect (not the file contents)
3. Card Architect browser fetches the file directly

For sites with CORS-friendly APIs (like Chub's API), browser can call directly:
```typescript
// Chub API has CORS headers
const res = await fetch(`https://api.chub.ai/api/characters/${fullPath}/main`);
const blob = await res.blob();
```

Only truly CORS-blocked downloads need a proxy.

---

## SillyTavern Push: Client-Side Implementation

Current server implementation can be moved to browser:

```typescript
// Browser-side ST push
async function pushToSillyTavern(card: CardData, imageBlob: Blob) {
  const stUrl = settings.sillyTavern.baseUrl; // e.g., http://localhost:8000

  // 1. Get CSRF token (browser fetch, same-origin not an issue for localhost)
  const csrfRes = await fetch(`${stUrl}/csrf-token`, {
    credentials: 'include'
  });
  const { token } = await csrfRes.json();

  // 2. Generate PNG with embedded card data (client-side)
  const pngBlob = await createCardPNG(card, imageBlob);

  // 3. Upload to ST
  const form = new FormData();
  form.append('avatar', pngBlob, `${card.data.name}.png`);
  form.append('file_type', 'png');

  const res = await fetch(`${stUrl}/api/characters/import`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: { 'X-CSRF-Token': token }
  });

  return res.json();
}
```

**Why this works**: SillyTavern runs on `localhost`, so there's no CORS issue. The browser can talk directly to it.

---

## RAG: Client-Side Implementation

```typescript
import { pipeline } from '@xenova/transformers';

class ClientRAG {
  private embedder: any;
  private db: IDBDatabase;

  async init() {
    // Load small, fast embedding model (~30MB, cached)
    this.embedder = await pipeline(
      'feature-extraction',
      'mixedbread-ai/mxbai-embed-xsmall-v1',
      { device: 'webgpu' }  // Falls back to WASM
    );
  }

  async addDocument(id: string, text: string) {
    const embedding = await this.embed(text);
    await this.storeEmbedding(id, text, embedding);
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    const queryEmbed = await this.embed(query);
    const allDocs = await this.getAllEmbeddings();

    // Cosine similarity search
    const scored = allDocs.map(doc => ({
      ...doc,
      score: cosineSimilarity(queryEmbed, doc.embedding)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async embed(text: string): Promise<Float32Array> {
    const result = await this.embedder(text, {
      pooling: 'mean',
      normalize: true
    });
    return result.data;
  }
}
```

**Performance** (2025 WebGPU):
- Model load: ~2-3s (cached after first load)
- Embedding: ~10-30ms per chunk
- Search 1000 vectors: ~5ms

---

## Configuration File

`config/deployment.json`:

```json
{
  "$schema": "./deployment.schema.json",

  "mode": "full",

  "modules": {
    "webImport": {
      "enabled": true,
      "allowedSites": ["chub.ai", "characterhub.org", "risu.pages.dev"]
    },
    "rag": {
      "enabled": true,
      "backend": "auto",
      "clientModel": "mixedbread-ai/mxbai-embed-xsmall-v1"
    },
    "llm": {
      "enabled": true,
      "providers": ["openai", "anthropic", "openrouter"]
    },
    "comfyui": {
      "enabled": true,
      "requiresLocalServer": true
    },
    "sillyTavern": {
      "enabled": true,
      "clientSide": true
    },
    "imageOptimization": {
      "backend": "auto",
      "maxDimension": 2048
    }
  },

  "storage": {
    "primary": "server",
    "fallback": "indexeddb",
    "syncEnabled": true
  },

  "ui": {
    "showDisabledFeatures": true,
    "showServerStatus": true
  }
}
```

---

## Presets

### `deployment.full.json` (Local/Self-Hosted)
All features enabled, server handles heavy lifting.

### `deployment.light.json` (Cheap VPS)
```json
{
  "mode": "light",
  "modules": {
    "webImport": { "enabled": false },
    "rag": { "enabled": true, "backend": "client" },
    "llm": { "enabled": false },
    "comfyui": { "enabled": false },
    "sillyTavern": { "enabled": true, "clientSide": true },
    "imageOptimization": { "backend": "client" }
  },
  "storage": {
    "primary": "indexeddb",
    "fallback": null,
    "syncEnabled": false
  }
}
```

### `deployment.static.json` (GitHub Pages)
```json
{
  "mode": "static",
  "modules": {
    "webImport": { "enabled": false },
    "rag": { "enabled": true, "backend": "client" },
    "llm": { "enabled": false },
    "comfyui": { "enabled": false },
    "sillyTavern": { "enabled": true, "clientSide": true },
    "imageOptimization": { "backend": "client" }
  },
  "storage": {
    "primary": "indexeddb"
  }
}
```

---

## Build Commands

```bash
# Full build (includes API server)
npm run build

# Static build (web app only, no server)
npm run build:static

# Light server build (minimal API)
npm run build:light
```

---

## Migration Path

1. **Phase 1**: Add deployment config loading to web app
2. **Phase 2**: Move SillyTavern push to client-side
3. **Phase 3**: Add client-side RAG with Transformers.js
4. **Phase 4**: Create static build pipeline
5. **Phase 5**: PWA manifest + service worker for offline
