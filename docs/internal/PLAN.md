# Asset Archival Features Implementation Plan

## Overview

Three new features for archiving additional assets from character cards:

1. **Chub Audio Archival** - Download voice samples from Chub cards
2. **Wyvern Gallery Image Archival** - Download avatar, background, and other images from Wyvern gallery
3. **Embedded Image Archival** - Parse and archive images embedded in first_mes and alternate_greetings

---

## Feature 1: Chub Audio Archival

### Requirements
- Disabled by default
- Save audio files (.wav, .mp3) to `assets/{cardId}/audio/` directory
- Deduplicate by UUID (if same voice_id, only download once)
- Cache default Chub voices globally (not per-card)
- Name files: `{name}_{voiceId}_{type}.ext` (e.g., `Alathea_9126c3e6_example.wav`)
- Types: `example`, `e2_example`, `f5_example`, `z_example`, `sample`

### Voice Data Structure (from Chub metadata)
```json
{
  "voice_id": "9126c3e6-cf59-4cd0-a844-2628de5c2d7f",
  "voice": {
    "uuid": "9126c3e6-cf59-4cd0-a844-2628de5c2d7f",
    "name": "Alathea_Bezn",
    "sample": "https://lfs.charhub.io/lfs/voice/clone/samples/....wav",
    "example": "https://media.chub.ai/.../....wav",
    "e2_example": "https://media.chub.ai/.../....wav",
    "f5_example": "https://media.chub.ai/.../....wav",
    "z_example": "https://media.chub.ai/.../....wav"
  }
}
```

### Default Voice Cache
- Location: `{storagePath}/cache/chub-voices/{uuid}/`
- Check if voice UUID is in `chub_voice.json` (default voices have user_id: -22358)
- If default: symlink/copy from cache, don't download per-card

### Settings Addition
```typescript
interface WebImportSettings {
  // ... existing ...
  audio: {
    enabled: boolean;           // Default: false
    downloadAllModels: boolean; // Download all model variants (e2, f5, z)
  };
}
```

### Implementation
1. Add `audio` to AssetToImport type
2. In Chub handler, check for `voice_id` and `voice` in metadata
3. Add voice assets to `fetched.assets` with type `'sound'`
4. Create `downloadAndProcessAudio()` function
5. Update settings types and defaults

---

## Feature 2: Wyvern Gallery Image Archival

### Requirements
- Download avatar, background, and other images from gallery
- Use Wyvern image proxy to get full-size PNGs
- Save as CCv3 types: `icon` (avatar), `background`, `other`
- Optional WebP conversion (off by default for full quality)

### Gallery Data Structure
```json
{
  "gallery": [
    {
      "id": "gallery_img_xxx",
      "imageURL": "https://imagedelivery.net/.../public",
      "type": "avatar" | "background" | "other",
      "title": "Full Avatar",
      "description": ""
    }
  ]
}
```

### Type Mapping
- Wyvern `avatar` -> CCv3 `icon`
- Wyvern `background` -> CCv3 `background`
- Wyvern `other` -> CCv3 `custom`

### Image Proxy
- Route through `https://app.wyvern.chat/api/image-proxy?url={url}`
- Response: `{ "image": "data:image/png;base64,..." }`
- Must be done client-side (userscript) since proxy needs cookies

### Settings Addition
```typescript
interface WebImportSettings {
  // ... existing ...
  wyvernGallery: {
    enabled: boolean;        // Default: true
    includeAvatar: boolean;  // Default: true
    includeBackground: boolean; // Default: true
    includeOther: boolean;   // Default: true
    convertToWebp: boolean;  // Default: false (preserve full PNG)
    webpQuality: number;     // Default: 85
  };
}
```

### Implementation
1. Update Wyvern userscript to fetch gallery images via proxy
2. Send gallery images as array in request body
3. Update Wyvern handler to accept gallery data
4. Add gallery assets to import queue

---

## Feature 3: Embedded Image Archival

### Requirements
- **DESTRUCTIVE** - Auto-creates snapshot backup before running
- Parse first_mes, alternate_greetings, mes_example for embedded image URLs
- Download and save as `other` type assets
- Update card data with local paths
- Save original URLs to DB for revert capability
- Export format considerations:
  - CCv2 JSON/PNG: Keep original URLs
  - CCv3 JSON/PNG: Keep original URLs
  - CHARX: Use `user/images/{character-name}/` path (SillyTavern compatible)
  - Voxta: Use `characters/{uuid}/assets/other/`

### URL Detection Patterns
- Markdown images: `![alt](url)`
- HTML images: `<img src="url">`
- Raw URLs: `https://....(jpg|jpeg|png|gif|webp)`

### Settings
- OFF by default
- Can only be triggered from card editor (Assets view)
- Not automatic during import

### Database Schema Addition
```sql
ALTER TABLE cards ADD COLUMN original_image_urls TEXT; -- JSON map of field -> original URLs
```

### API Endpoints
```
POST /api/cards/:id/archive-embedded-images
  - Creates snapshot
  - Parses fields for images
  - Downloads and saves assets
  - Updates card data
  - Returns { success, imagesArchived, warnings }

GET /api/images/{character-name}/{filename}
  - Serves images using SillyTavern-compatible path
```

### UI Addition
In Assets panel (AssetsPanel.tsx):
- Add "Archive Linked Images" button above upload
- Shows modal with:
  - List of detected image URLs
  - Preview thumbnails
  - Checkbox to select which to archive
  - Warning about modification
  - Confirm/Cancel buttons

---

## Implementation Order

1. **Phase 1: Settings & Types**
   - Update `WebImportSettings` type
   - Update `AssetToImport` type to include `'sound'`, `'background'`, `'custom'`
   - Add audio and wyvernGallery defaults
   - Update settings UI

2. **Phase 2: Chub Audio**
   - Add voice extraction to Chub handler
   - Implement audio download/save
   - Add default voice cache
   - Update userscript version

3. **Phase 3: Wyvern Gallery**
   - Update userscript to fetch gallery via proxy
   - Update Wyvern handler to accept gallery
   - Process gallery images

4. **Phase 4: Embedded Image Archival**
   - Add DB column for original URLs
   - Create URL parsing utility
   - Implement archive endpoint
   - Add UI button and modal
   - Create SillyTavern-compatible serve route

---

## Files to Modify

### Backend
- `apps/api/src/routes/web-import.ts` - Main implementation
- `apps/api/src/db/schema.ts` - Add original_image_urls column
- `apps/api/src/db/repository.ts` - Handle new column
- `apps/api/src/routes/assets.ts` - Add embedded image archive endpoint
- `apps/api/src/utils/settings.ts` - Settings types

### Frontend
- `apps/web/src/modules/webimport/settings/WebImportSettings.tsx` - New settings UI
- `apps/web/src/features/editor/components/AssetsPanel.tsx` - Archive button
- `apps/web/src/features/editor/components/ArchiveImagesModal.tsx` - New modal

### Userscript
- Update version to 1.0.9
- Add Wyvern gallery fetch
- Send gallery images in request

### Documentation
- `docs/CLAUDE.md` - Document new features
