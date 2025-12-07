# Card Architect - Web Import Documentation

One-click character card importing from supported character hosting sites via a browser userscript.

## Overview

Web Import adds a "Send to Card Architect" button to supported character hosting sites. When clicked, the character card (including assets like expressions/sprites) is automatically imported into Card Architect.

## Supported Sites

| Site | Domain | Status | Notes |
|------|--------|--------|-------|
| Chub.ai | `chub.ai`, `venus.chub.ai` | Working | Uses v4 API for fresh card data |
| Character Tavern | `character-tavern.com` | Working | Direct PNG download |
| Risu Realm | `realm.risuai.net` | Working | Supports PNG and CHARX |
| Wyvern | `app.wyvern.chat` | Working | Intercepts download blob |

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Browser + Script  │     │   Card Architect    │     │   Character Site    │
│   (Userscript)      │────▶│   API Server        │────▶│   (Chub, etc.)      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
        │                           │
        │ 1. Click button           │ 2. Fetch card data
        │ 3. Send URL + data        │    + PNG + assets
        │                           │
        ▼                           ▼
   Shows toast with              Imports card,
   success/link                  downloads assets
```

## Installation

1. Install a userscript manager (Tampermonkey, Violentmonkey, Greasemonkey)
2. Navigate to Card Architect Settings > Web Import
3. Click "Download Userscript" button
4. The userscript is dynamically generated with your server's IP and ports
5. Install the script in your userscript manager

## Userscript Features

- **Dynamic Server Detection**: Userscript is generated with correct server IP/port
- **API URL Configuration**: Right-click userscript manager icon → Configure API URL
- **Version Tracking**: Userscript version updated with each change (currently 1.0.9)
- **Site-Specific Button Injection**: Button placed in appropriate location per site
- **Toast Notifications**: Success/error feedback with link to imported card
- **Blob Interception**: For sites that build PNGs client-side (Wyvern)

---

## Site-Specific Implementations

### Chub.ai

**API Flow:**
1. Fetch metadata from `gateway.chub.ai/api/characters/{creator}/{slug}?full=true`
2. Extract project ID from response
3. Fetch actual card.json from `gateway.chub.ai/api/v4/projects/{id}/repository/files/card.json/raw`

**Why Two Requests**: The PNG on Chub pages can be stale; the v4 API always has latest data

**Avatar URL**: Use `node.max_res_url` from metadata (full resolution chara_card_v2.png), fallback to `node.avatar_url` (webp thumbnail)

**Expressions**: Extracted from `extensions.chub.expressions.expressions` object

**Expression Filtering**:
- Skip `lfs.charhub.io/lfs/88` (default placeholder)
- Skip 120x120px images (small placeholders)
- Download other `lfs.charhub.io/lfs/{id}/` URLs

**Gallery**: If `node.hasGallery` is true, fetch from `gateway.chub.ai/api/gallery/project/{projectId}?limit=48`

### Character Tavern

- **Domain**: `character-tavern.com` (with hyphen)
- **Cards Domain**: `cards.character-tavern.com`
- **URL Pattern**: `/character/{creator}/{slug}`
- **Download URL**: `https://cards.character-tavern.com/{creator}/{slug}.png?action=download`
- **Format**: PNG with embedded card data (tEXt chunk)

### Risu Realm

- **Domain**: `realm.risuai.net`
- **URL Pattern**: `/character/{id}`
- **Formats**: Supports both PNG and CHARX
- **Detection**: Checks page for download format hints

### Wyvern

- **Domain**: `app.wyvern.chat`
- **URL Pattern**: `/characters/{id}`
- **Implementation**: Blob interception via `URL.createObjectURL` hook

**How It Works:**
1. Userscript hooks `URL.createObjectURL` before triggering download
2. Finds and clicks Wyvern's download button programmatically
3. Wyvern's export function creates a PNG blob with embedded card data
4. The hook intercepts the blob, reads it as base64
5. Base64 PNG sent to Card Architect server
6. Server extracts card data from PNG tEXt chunk (standard extraction)

**Why This Approach**: Wyvern builds the PNG client-side using their own export logic:
```javascript
// Wyvern's export flow (deobfuscated):
async function exportCard(character) {
  const cardJson = await prepareCardData(character);
  const base64Card = btoa(JSON.stringify(cardJson));
  const avatar = await fetchAvatar(character.avatar);
  const chunks = decodePNG(avatar);
  chunks = chunks.filter(c => c.name !== 'tEXt'); // Remove old
  chunks.push(encodeTEXT('chara', base64Card));   // Add new
  return new Blob([encodePNG(chunks)], {type: 'image/png'});
}
```

**Sprites**: Fetched from public API `https://api.wyvern.chat/characters/{id}`

**Userscript Code:**
```javascript
function fetchWyvernPng() {
  return new Promise((resolve, reject) => {
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    let captured = false;

    // Hook to intercept PNG blob
    URL.createObjectURL = function(blob) {
      const url = originalCreateObjectURL(blob);
      if (!captured && blob instanceof Blob && blob.type === 'image/png') {
        captured = true;
        URL.createObjectURL = originalCreateObjectURL; // Restore
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }
      return url;
    };

    // Find and click download button
    const btn = document.querySelector('button[aria-label*="download" i]');
    if (btn) btn.click();
  });
}
```

---

## Asset Importing

Assets (icons, expressions/emotions) are automatically downloaded and stored.

### Asset Processing

1. **Download**: Fetch from source URL with proper User-Agent
2. **Size Check**: Skip 120x120px images (placeholders)
3. **Conversion**: Convert to WebP format for storage efficiency
4. **Resize**: Emotions resized to 256x256px max
5. **Storage**: Saved to `{storagePath}/cards/{cardId}/assets/`

### Asset Types

| Type | Description | Stored As |
|------|-------------|-----------|
| `icon` | Character avatar/main image | `{cardId}/{name}.webp` |
| `emotion` | Expression sprites | `{cardId}/emotions/{emotion}.webp` |
| `background` | Background images (Wyvern gallery) | `{cardId}/backgrounds/{name}.webp` |
| `custom` | Other gallery images | `{cardId}/custom/{name}.webp` |
| `sound` | Voice samples (Chub) | `{cardId}/audio/{voice}_{id}_{model}.wav` |
| `workflow` | ComfyUI workflow JSON files | `{cardId}/workflows/{name}.json` |
| `lorebook` | Linked lorebooks (not embedded) | `{cardId}/lorebooks/{name}.json` |

### Asset Settings (Settings > Web Import)

```typescript
interface WebImportSettings {
  icons: {
    convertToWebp: boolean; // Convert to WebP format
    webpQuality: number;    // WebP quality (default: 80)
    maxMegapixels: number;  // Max megapixels (default: 2)
  };
  emotions: {
    convertToWebp: boolean;
    webpQuality: number;    // Default: 80
    maxMegapixels: number;  // Default: 1
  };
  skipDefaultEmoji: boolean; // Skip 120x120 placeholder expressions
  audio: {
    enabled: boolean;           // Default: false - Download Chub voice samples
    downloadAllModels: boolean; // Download e2, f5, z model variants (not just example)
  };
  wyvernGallery: {
    enabled: boolean;           // Default: true - Download Wyvern gallery images
    includeAvatar: boolean;     // Download avatar type images
    includeBackground: boolean; // Download background type images
    includeOther: boolean;      // Download other type images
    convertToWebp: boolean;     // Default: false - Keep full PNG quality
    webpQuality: number;        // Default: 85
  };
  chubGallery: {
    enabled: boolean;           // Default: true - Download Chub gallery images
    convertToWebp: boolean;     // Default: false - Keep full PNG quality
    webpQuality: number;        // Default: 85
  };
  relatedLorebooks: {
    enabled: boolean;           // Default: true - Fetch related lorebooks from Chub
    mergeIntoCard: boolean;     // Default: true - Merge entries into character_book
    saveAsAsset: boolean;       // Default: false - Save lorebooks as JSON assets
  };
}
```

---

## Chub Audio Archival

- **Voice Samples**: Downloads voice samples from Chub cards with voice data
- **Default Voices**: 17 default Chub voices are cached globally in `{storagePath}/cache/chub-voices/{uuid}/`
- **TTS Models**: `example`, `e2_example`, `f5_example`, `z_example`, `sample`
- **Naming**: `{voiceName}_{voiceId8}_{model}.wav` (e.g., `Alathea_Bezn_9126c3e6_example.wav`)
- **Deduplication**: Same voice ID only downloads once per card

## Chub Gallery Images

- **Detection**: Checks `metaData.node.hasGallery` to determine if gallery exists
- **API Endpoint**: `https://gateway.chub.ai/api/gallery/project/{projectId}?limit=48`
- **Storage**: Saved as `custom` type assets in `{cardId}/custom/` directory
- **Full Quality**: WebP conversion disabled by default to preserve full PNG quality

## Related Lorebooks (Chub)

- **Detection**: Checks `metaData.node.definition.extensions.chub.related_lorebooks` array
- **API Endpoint**: `https://gateway.chub.ai/api/v4/projects/{lorebookId}/repository/files/raw%252Fsillytavern_raw.json/raw`
- **Merge Behavior**: When `mergeIntoCard` is enabled:
  - Creates `character_book` if it doesn't exist
  - Assigns unique IDs to avoid conflicts with existing entries
  - Adds `extensions.source_lorebook` tracking to each merged entry with:
    - `id`: Original Chub lorebook project ID
    - `name`: Lorebook name
    - `path`: Lorebook path/slug
- **Save as Asset**: When `saveAsAsset` is enabled:
  - Saves complete lorebook JSON as card asset
  - Stored in `{cardId}/lorebooks/{sanitized_name}.json`
  - Tagged with `lorebook`, `related-lorebook`, `source:{id}`
- **Parallel Fetching**: Multiple related lorebooks fetched concurrently

## Wyvern Gallery Images

- **Image Proxy**: Gallery images fetched client-side via `https://app.wyvern.chat/api/image-proxy?url={url}`
- **Type Mapping**: Wyvern `avatar` → CCv3 `icon`, `background` → `background`, `other` → `custom`
- **Full Quality**: WebP conversion disabled by default to preserve full PNG quality

---

## API Endpoints

```
GET  /api/web-import/sites              # List supported sites with patterns
GET  /api/web-import/settings           # Get web import settings
POST /api/web-import/settings           # Update settings
GET  /api/web-import/userscript         # Download dynamically generated userscript
POST /api/web-import                    # Import card from URL
     Body: { url: string, pngData?: string, clientData?: object }
     - pngData: Base64 PNG for sites requiring client-side fetch (Wyvern)
     - clientData: Optional data from client (Wyvern gallery images)
       { galleryImages: [{ type: string, title: string, base64: string }] }
```

## Response Format

```typescript
// Success
{
  success: true,
  cardId: string,
  name: string,           // Character name for toast
  card: Card,             // Full card object
  assetsImported: number, // Count of imported assets
  warnings: string[],     // Any non-fatal issues
  source: string          // Handler ID (chub, wyvern, etc.)
}

// Error
{
  success: false,
  error: string
}
```

---

## Service Architecture

The web import functionality follows a modular architecture for easy maintenance and extensibility:

```
apps/api/src/
├── routes/
│   └── web-import.ts           # Thin route layer (118 lines)
└── services/
    └── web-import/
        ├── index.ts            # WebImportService class (orchestration)
        ├── types.ts            # Shared TypeScript interfaces
        ├── constants.ts        # Default settings, voice UUIDs
        ├── utils.ts            # Asset processing utilities
        ├── userscript.ts       # Userscript generator
        └── handlers/
            ├── index.ts        # Handler registry
            ├── chub.ts         # Chub.ai handler
            ├── wyvern.ts       # Wyvern handler
            ├── character-tavern.ts  # Character Tavern handler
            └── risu-realm.ts   # Risu Realm handler
```

### Service File Details

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | ~220 | `WebImportSettings`, `SiteHandler`, `FetchedCard`, `AssetToImport` interfaces |
| `constants.ts` | ~110 | `DEFAULT_WEB_IMPORT_SETTINGS`, `DEFAULT_CHUB_VOICE_UUIDS`, `BROWSER_USER_AGENT` |
| `utils.ts` | ~390 | `downloadAndProcessImage`, `downloadAndProcessAudio`, `saveAssetToStorage`, `normalizeCardData` |
| `userscript.ts` | ~560 | `generateUserscript()` - Dynamically generates userscript with server IP/port |
| `index.ts` | ~450 | `WebImportService` class with `importCard()`, `getSettings()`, `updateSettings()` |

### Handler File Details

| File | Lines | Handler ID | Notes |
|------|-------|------------|-------|
| `handlers/index.ts` | ~75 | - | `findSiteHandler()`, `getSiteList()`, `SITE_HANDLERS` registry |
| `handlers/chub.ts` | ~215 | `chub` | v4 API, expressions, gallery, audio samples |
| `handlers/wyvern.ts` | ~135 | `wyvern` | Client-side PNG, gallery via clientData |
| `handlers/character-tavern.ts` | ~65 | `character-tavern` | Direct PNG download from cards subdomain |
| `handlers/risu-realm.ts` | ~90 | `risu` | CHARX preferred, PNG fallback |

---

## Adding a New Site Handler

To add support for a new character card site:

1. **Create handler file** (`services/web-import/handlers/mysite.ts`):
```typescript
import type { SiteHandler, FetchedCard, AssetToImport } from '../types.js';
import { BROWSER_USER_AGENT } from '../constants.js';

export const mySiteHandler: SiteHandler = {
  id: 'mysite',
  name: 'My Site',
  patterns: [/^https?:\/\/(www\.)?mysite\.com\/characters\/([^\/]+)/],
  fetchCard: async (url, match, clientPngData, clientData) => {
    const characterId = match[2];
    const warnings: string[] = [];
    const assets: AssetToImport[] = [];

    // Fetch card data from site API
    const response = await fetch(`https://api.mysite.com/cards/${characterId}`);
    const cardData = await response.json();

    return {
      cardData,
      spec: 'v2',
      assets,
      warnings,
      meta: { characterId, source: 'mysite' },
    };
  },
};
```

2. **Register handler** in `handlers/index.ts`:
```typescript
import { mySiteHandler } from './mysite.js';

export const SITE_HANDLERS: SiteHandler[] = [
  // ... existing handlers
  mySiteHandler,
];
```

3. **Add @match pattern** in `userscript.ts`:
```javascript
// @match        https://mysite.com/characters/*
```

4. **Add site detection** in userscript's `detectSite()`:
```javascript
if (host === 'mysite.com' && path.startsWith('/characters/')) {
  return { site: 'mysite', id: path.split('/characters/')[1] };
}
```

5. **Add button injection** in userscript's `siteInjectors`:
```javascript
mysite: () => {
  // Add button to page
}
```

6. **Update documentation** in `docs/CLAUDE_WEB_IMPORT.md`

---

## Userscript Header (Generated)

```javascript
// ==UserScript==
// @name         Card Architect - Web Import
// @namespace    https://card-architect.local
// @version      1.0.9
// @match        https://chub.ai/characters/*
// @match        https://www.chub.ai/characters/*
// @match        https://venus.chub.ai/characters/*
// @match        https://app.wyvern.chat/characters/*
// @match        https://character-tavern.com/character/*
// @match        https://realm.risuai.net/character/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      {server-ip}
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==
```

---

## Configuration

```typescript
// config.ts
{
  port: 3456,        // API server port
  webPort: 5173,     // Web frontend port (for success links)
  bodyLimit: 50MB,   // Increased for base64 PNG uploads
}
```

## Known Issues & Limitations

1. **Large Cards**: Body limit increased to 50MB for base64 PNG uploads
2. **Asset Count**: Card grid now shows `meta.assetCount` from database query
3. **Cloudflare**: Some sites may block server-side requests; uses browser User-Agent
4. **Wyvern Download Button**: If button selector fails, userscript retries with fallback selectors

## Debugging

- Console logs in userscript (prefix `[CA]`) show fetch progress
- Error stack traces included in API error responses
- Wyvern: Hook intercept logged to browser console

---

## Data Normalization

Web imports go through normalization to ensure compatibility:

1. **Creator Field**: If object (Wyvern user data), extract `displayName` or `name`
2. **Tags**: Filter to only string values
3. **Extensions**: Preserved as-is (important for SillyTavern compatibility)
4. **Lorebook Entries**: Extensions data inside entries preserved without validation
5. **Timestamps**: CharacterTavern milliseconds converted to seconds

## Settings Store Integration

```typescript
// settings-store.ts
interface FeatureFlags {
  webimportEnabled: boolean; // Default: false (needs userscript)
}
```

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main project documentation
- [CLAUDE_API.md](./CLAUDE_API.md) - API endpoint reference
- [CLAUDE_TESTING.md](./CLAUDE_TESTING.md) - Testing guide
