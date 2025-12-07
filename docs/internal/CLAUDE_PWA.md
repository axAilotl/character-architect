# Card Architect - PWA & Deployment Modes

## Overview

Card Architect supports multiple deployment modes to accommodate different hosting scenarios:

| Mode | Description | Use Case |
|------|-------------|----------|
| `full` | All features enabled, server backend required | Local/self-hosted with full API |
| `light` | Minimal server, most features client-side | Cheap VPS, limited backend |
| `static` | No server at all, purely client-side | Cloudflare Pages, GitHub Pages |

## Configuration

### Environment Variable

Set the deployment mode via `VITE_DEPLOYMENT_MODE`:

```bash
# Build for light mode
VITE_DEPLOYMENT_MODE=light npm run build:web

# Build for static mode
VITE_DEPLOYMENT_MODE=static npm run build:web

# Full mode (default)
npm run build:web
```

### Auto-Detection

If `VITE_DEPLOYMENT_MODE` is not set, the app auto-detects:

```typescript
// apps/web/src/config/deployment.ts
const hostname = window.location.hostname;
const isLocalDev = hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.endsWith('.local') ||
  hostname.includes('.local.');

mode = isLocalDev ? 'full' : 'light';
```

**Important**: Hostnames containing `.local` (e.g., `myserver.local.domain.com`) are treated as local development.

## Feature Matrix

### Server Features

| Feature | Full | Light | Static | Notes |
|---------|------|-------|--------|-------|
| Web Import (userscript) | Server processes | Client fetches, server processes | No | Userscript still downloadable |
| Server RAG | Yes | No | No | Use client-side Transformers.js |
| Server LLM Proxy | Yes | No | No | Use direct browser calls |
| ComfyUI Integration | Yes | No | No | Requires local ComfyUI server |
| Server Image Optimization | Yes | No | No | Use Canvas API |

### Client Features

| Feature | Full | Light | Static | Notes |
|---------|------|-------|--------|-------|
| SillyTavern Push | Yes | Yes | Yes | Works for localhost ST instances |
| Client RAG | Yes | Yes | Yes | Transformers.js + WebGPU |
| Client LLM | Yes | Yes | Yes | OpenRouter, Anthropic direct |
| Client Image Optimization | Yes | Yes | Yes | Canvas API |
| Assets Management | Yes | Yes | Yes | IndexedDB, 50MB limit |

### Module Defaults

| Module | Full | Light | Static | Notes |
|--------|------|-------|--------|-------|
| Block Editor | Enabled | Enabled | Enabled | |
| wwwyzzerdd | Enabled | Enabled | Disabled | Needs LLM config |
| ComfyUI | Enabled | Disabled | Disabled | Server-only, hidden in light mode |
| SillyTavern | Enabled | Enabled | Enabled | |
| Web Import | Enabled | Enabled | Disabled | No server to process |
| CHARX Optimizer | Enabled | Enabled | Enabled | |

## Client-Side Storage

### IndexedDB Schema

Database: `card-architect` (Version 5)

| Store | Key Path | Indices | Purpose |
|-------|----------|---------|---------|
| `drafts` | `id` | - | Auto-saved card drafts |
| `cards` | `meta.id` | `name`, `updatedAt` | Full card storage |
| `images` | `[cardId, type]` | `cardId` | Thumbnails and icons |
| `versions` | `id` | `cardId`, `[cardId, versionNumber]` | Snapshot history |
| `assets` | `id` | `cardId`, `[cardId, type]` | Card assets (images, audio, etc.) |

### localStorage Keys

| Key | Purpose | Used In |
|-----|---------|---------|
| `ca-llm-presets` | User-defined LLM presets | SettingsModal, LLMAssistSidebar |
| `ca-wwwyzzerdd-prompts` | Custom wwwyzzerdd prompt sets | WwwyzzerddSettings, WwwyzzerddTab |
| `ca-sillytavern-settings` | SillyTavern push configuration | SillyTavernSettings, Header |
| `card-architect-settings` | General app settings | settings-store |

## Asset Management

### File Size Limits

- **Maximum file size**: 50MB per asset
- **Storage**: Base64 data URLs in IndexedDB
- **Supported types**: Images, video, audio, JSON (workflows, lorebooks)

### StoredAsset Interface

```typescript
interface StoredAsset {
  id: string;
  cardId: string;
  name: string;
  type: 'icon' | 'background' | 'emotion' | 'sound' | 'workflow' | 'lorebook' | 'custom';
  ext: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  data: string; // base64 data URL
  isMain: boolean;
  tags: string[];
  actorIndex?: number;
  createdAt: string;
  updatedAt: string;
}
```

### Asset Operations (Light Mode)

All asset operations work identically in light mode, stored in IndexedDB:

- **Upload**: File read as data URL, dimensions extracted for images
- **Delete**: Single or bulk deletion
- **Update**: Name, type, tags, actor binding
- **Set Main**: Portrait override, main background
- **Preview**: Data URLs displayed directly (no thumbnail API)

## Client-Side LLM

### Supported Providers

In light/static mode, LLM calls go directly from browser to provider:

| Provider | Endpoint | Notes |
|----------|----------|-------|
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | Requires API key, supports many models |
| Anthropic | `https://api.anthropic.com/v1/messages` | Requires CORS header from Anthropic |

### Configuration Storage

LLM presets stored in `localStorage['ca-llm-presets']`:

```typescript
interface UserPreset {
  id: string;
  name: string;
  instruction: string;
  category: 'rewrite' | 'format' | 'generate' | 'custom';
  description?: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Client LLM Invocation

```typescript
// apps/web/src/lib/client-llm.ts
import { invokeClientLLM } from '../lib/client-llm';

const response = await invokeClientLLM(prompt, systemPrompt);
```

## SillyTavern Push

### How It Works

1. User configures SillyTavern URL in settings
2. Settings stored in localStorage (`ca-sillytavern-settings`)
3. Push button in header triggers:
   - Card saved to ensure latest changes
   - PNG generated with embedded metadata
   - POST to SillyTavern `/api/characters/import`

### Settings Structure

```typescript
interface SillyTavernSettings {
  enabled: boolean;
  baseUrl: string; // e.g., "http://localhost:8000"
  importEndpoint: string; // default: "/api/characters/import"
  sessionCookie?: string; // optional auth cookie
}
```

### CORS Considerations

SillyTavern must be running on localhost for browser CORS to work. Remote ST instances require server proxy (full mode only).

## wwwyzzerdd (AI Character Wizard)

### Prompt Set Storage

Custom prompt sets stored in `localStorage['ca-wwwyzzerdd-prompts']`:

```typescript
interface PromptSet {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  prompts: {
    [fieldId: string]: string;
  };
}
```

### Field IDs

- `description`, `personality`, `scenario`
- `first_mes`, `mes_example`
- `system_prompt`, `post_history_instructions`
- `creator_notes`

## Web Import Userscript

### Light Mode Behavior

In light mode, the userscript is still downloadable from `/userscript.js` but:
- Client fetches all data (card JSON, images, assets)
- Server only processes the fetched data
- No server-side URL fetching

### Userscript Download

```typescript
// Light mode: download from static file
window.location.href = '/userscript.js';

// Full mode: download from API
window.location.href = '/api/web-import/userscript';
```

## Module Visibility

### Server-Only Modules

Some modules are hidden entirely in light/static mode:

```typescript
// apps/web/src/lib/modules.ts
const SERVER_ONLY_MODULES = ['comfyui'];

// During registration, skip server-only modules in light mode
if (isLightMode && SERVER_ONLY_MODULES.includes(metadata.id)) {
  continue;
}
```

## API Compatibility

### Graceful Degradation

Components check deployment mode before API calls:

```typescript
const config = getDeploymentConfig();
const isLightMode = config.mode === 'light' || config.mode === 'static';

if (isLightMode) {
  // Use localStorage/IndexedDB
  const data = localStorage.getItem('ca-key');
} else {
  // Use server API
  const data = await api.getData();
}
```

### Common Pattern

```typescript
// Load
useEffect(() => {
  if (isLightMode) {
    // Load from localStorage
    const stored = localStorage.getItem('ca-my-data');
    if (stored) setData(JSON.parse(stored));
  } else {
    // Load from API
    api.getMyData().then(setData);
  }
}, [isLightMode]);

// Save
const handleSave = async () => {
  if (isLightMode) {
    localStorage.setItem('ca-my-data', JSON.stringify(data));
  } else {
    await api.saveMyData(data);
  }
};
```

## Build Outputs

### Full Mode Build

Standard Vite build with all features:
```bash
npm run build:web
```

### Light Mode Build

Optimized build with client-side defaults:
```bash
VITE_DEPLOYMENT_MODE=light npm run build:web
```

### Static Mode Build

Minimal build for static hosting:
```bash
VITE_DEPLOYMENT_MODE=static npm run build:web
```

## PWA Features

### Service Worker

Card Architect includes PWA support via `vite-plugin-pwa`:

- **Offline support**: Cached assets for offline use
- **Install prompt**: Can be installed as standalone app
- **Auto-update**: Service worker updates on new deployments

### Manifest

```json
{
  "name": "Card Architect",
  "short_name": "CardArch",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "display": "standalone"
}
```

## File Locations

| File | Purpose |
|------|---------|
| `apps/web/src/config/deployment.ts` | Deployment mode configuration |
| `apps/web/src/lib/db.ts` | IndexedDB schema and operations |
| `apps/web/src/lib/client-llm.ts` | Client-side LLM invocation |
| `apps/web/src/lib/modules.ts` | Module registration with mode filtering |
| `apps/web/src/store/settings-store.ts` | Persisted settings |

## Troubleshooting

### "Assets Not Available" (Fixed)

Previously shown in light mode. Now assets work client-side with 50MB limit.

### Hostname Detection Issues

If your local dev server shows light mode features:
- Check hostname contains `localhost`, `127.0.0.1`, or `.local`
- Set `VITE_DEPLOYMENT_MODE=full` explicitly

### LLM Not Working in Light Mode

- Ensure provider API key is configured in settings
- OpenRouter works best (broad CORS support)
- Anthropic requires special CORS configuration

### Large Files Rejected

Assets over 50MB are rejected with an alert. Consider:
- Compressing images before upload
- Using external hosting for very large files
- Splitting lorebooks into smaller chunks

## Future Enhancements

- [ ] Client-side RAG with Transformers.js
- [ ] WebGPU acceleration for embeddings
- [ ] Sync between devices via export/import
- [ ] Cloud storage integration (optional)
