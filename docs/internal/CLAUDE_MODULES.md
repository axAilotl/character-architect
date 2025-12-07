# Card Architect - Modules Documentation

Detailed documentation for optional modules and features.

## Module System Overview

Modules are optional features that can be enabled/disabled in Settings > General. They are auto-discovered using Vite's `import.meta.glob`.

### Available Modules

| Module | Feature Flag | Default | Description |
|--------|--------------|---------|-------------|
| Block Editor | `blockEditorEnabled` | true | Visual block-based card builder |
| wwwyzzerdd | `wwwyzzerddEnabled` | false | AI character creation wizard |
| ComfyUI | `comfyuiEnabled` | false | Image generation with emotion sprites |
| SillyTavern | `sillytavernEnabled` | false | Direct push to SillyTavern |
| Web Import | `webimportEnabled` | false | Browser userscript integration |
| Package Optimizer | `charxOptimizerEnabled` | true | Media optimization for exports |

### Module Settings Panels

| Module | Settings Component | Color | Order |
|--------|-------------------|-------|-------|
| Block Editor | `BlockEditorSettings.tsx` | purple | 10 |
| wwwyzzerdd | `WwwyzzerddSettings.tsx` | amber | 30 |
| ComfyUI | `ComfyUISettings.tsx` | orange | 40 |
| Web Import | `WebImportSettings.tsx` | teal | 60 |
| Package Optimizer | `CharxOptimizerSettings.tsx` | purple | 65 |
| SillyTavern | `SillyTavernSettings.tsx` | pink | 70 |

---

## Block Editor

Visual block-based editor for character card content, inspired by the BeastBox standalone editor.

### Features

- **Hierarchical Blocks**: Unlimited nesting levels with visual indicators
  - Level 1: Blue border
  - Level 2: Purple border
  - Level 3: Pink border
  - Level 4: Amber border
- **Content Babies**: Content blocks within each block
  - **Text Baby**: Free-form text content
  - **Flat List Baby**: Bulleted list items
  - **Flat-Nested List Baby**: Lists with nested sub-lists
- **Drag & Drop**: Reorder blocks and babies via @dnd-kit
- **Field Mapping**: Each block targets a character card field
- **Split Items**: List items can have header/body format with bold toggle
- **Promote/Demote**: Move items between flat and nested lists
- **Templates**: Save and load block structures

### Block Structure

```typescript
interface Block {
  id: string;
  label: string;
  targetField: TargetField;  // description, personality, etc.
  collapsed: boolean;
  babies: Baby[];           // Content blocks
  children: Block[];        // Nested blocks
  level: number;           // Hierarchy depth
}
```

### Toolbar Actions

- **Add Block**: Create new top-level block
- **V2/V3 Toggle**: Switch field options between specs
- **Templates**: Save/load block structures
- **Apply to Card**: Export blocks as markdown to card fields
- **Clear All**: Remove all blocks

### Apply to Card Output

Blocks are converted to markdown when applied:
- Block labels become headings (`#`, `##`, etc. based on depth)
- Text babies become paragraphs
- List items become bullet points (`-`)
- Nested items are indented (`  -`)
- Split items format as `**Header**: Body` when bold

### Implementation

- **Location**: `apps/web/src/modules/block-editor/`
- **Components**:
  - `BlockEditorPanel.tsx` - Main panel with toolbar
  - `BlockComponent.tsx` - Individual block with babies
  - `SortableBaby.tsx` - Sortable baby wrapper
  - `SortableListItem.tsx` - Sortable list item
- **Store**: `store.ts` - Zustand store with full CRUD
- **Types**: `types.ts` - Block, Baby, ListItem definitions

---

## wwwyzzerdd - AI Character Wizard

Two-column layout for AI-assisted character creation.

### Features

- **Left Column**: Editable character form (Name, Description, Scenario, First Message, Appearance, Personality)
- **Right Column**: AI chat with JSON output parsing
- **JED Formatting**: Default description format with structured sections
- **Card Type Selection**: CC (personality in description) vs Voxta (personality field used)
- **Image Gen Selection**: Booru tags vs natural language for Appearance field
- **Apply to Card**: Parse JSON from AI responses and populate fields
- **Persistent Chat**: Chat state maintained across tab switches

### Field Notes

- **Personality**: Deprecated for CC cards, only used for Voxta
- **Appearance**: Stored in `extensions.voxta.appearance` or `extensions.visual_description`

### Configuration

Settings > wwwyzzerdd tab:
- Prompt set management (character prompt, lore prompt, personality)
- Import/export prompt sets

### API Endpoints

```
GET    /api/wwwyzzerdd/prompts           # List prompt sets
POST   /api/wwwyzzerdd/prompts           # Create prompt set
PATCH  /api/wwwyzzerdd/prompts/:id       # Update prompt set
DELETE /api/wwwyzzerdd/prompts/:id       # Delete prompt set
GET    /api/wwwyzzerdd/prompts/export/all # Export all prompts
POST   /api/wwwyzzerdd/prompts/import    # Import prompts
POST   /api/wwwyzzerdd/prompts/reset     # Reset to defaults
```

### Implementation

- **Location**: `apps/web/src/modules/wwwyzzerdd/`
- **Tab**: `WwwyzzerddTab.tsx` - Main two-column interface
- **Settings**: `settings/WwwyzzerddSettings.tsx` - Prompt management

---

## ELARA VOSS - Name Replacement

Tool for replacing placeholder character names throughout a card.

### Usage

1. Enter the "offending" first/last name to replace
2. Select gender (male, female, femboy, futa)
3. Click "WHO IS ELARA VOSS?" to generate a random name
4. Click "REPLACE" to auto-snapshot and replace all occurrences

### Fields Replaced

- name, description, personality, scenario, first_mes, mes_example
- system_prompt, post_history_instructions, creator_notes
- alternate_greetings array
- character_book entries (content and keys)

### Name Database Management

The name database can be managed in **Settings > Templates > ELARA VOSS** tab:

- **Import Names**: Upload a custom JSON file with names
- **Export Names**: Download current name database
- **Reset to Defaults**: Restore the built-in name database

### JSON File Format

```json
[
  { "gender": "male", "type": "first", "name": "Ace" },
  { "gender": "female", "type": "first", "name": "Nova" },
  { "gender": "neutral", "type": "last", "name": "Vega" }
]
```

- **gender**: "male" | "female" | "neutral"
- **type**: "first" | "last"
- **name**: The actual name string

Note: Names with `gender: "neutral"` and `type: "last"` are used as surnames for all genders.

### API Endpoints

```
GET  /api/elara-voss/names         # Get all names
GET  /api/elara-voss/names/:gender # Get names by gender
POST /api/elara-voss/names/import  # Import names (body: { names: [], merge?: boolean })
GET  /api/elara-voss/names/export  # Export names as JSON file
POST /api/elara-voss/names/reset   # Reset to defaults
GET  /api/elara-voss/stats         # Get name counts by gender/type
```

### Implementation

- **Panel**: `apps/web/src/features/editor/components/ElaraVossPanel.tsx`
- **Settings UI**: `apps/web/src/features/editor/components/TemplateSnippetPanel.tsx` (ELARA VOSS tab)
- **Name database**: `apps/api/data/settings/presets/elara_voss.json` (~300 names)

---

## Linked Image Archival

Archive external images embedded in `first_mes` and `alternate_greetings` as local assets.

### Overview

Character cards often contain external image links (markdown `![](url)` or HTML `<img src="url">`) that may become unavailable over time. This feature downloads these images and stores them locally, updating the card content to reference the local paths.

### Features

- **Image Detection**: Parses markdown `![alt](url)` and HTML `<img src="url">` formats
- **Automatic Download**: Fetches images from external URLs with proper User-Agent
- **Local Storage**: Saves images as card assets with type `custom`
- **SillyTavern Compatible Paths**: Uses `/user/images/{character-name}/{filename}` format
- **Original URL Preservation**: Stores original URLs in database for reverting
- **Auto-Snapshot**: Creates backup snapshot before any modifications (destructive operation)
- **Export Behavior**:
  - JSON/PNG exports: Restores original external URLs
  - CHARX/Voxta exports: Keeps local embedded paths

### Usage

1. Enable "Linked Image Archival" in Settings → General (disabled by default)
2. Open a card with external images in first_mes or alternate_greetings
3. Navigate to the Assets panel
4. View archive status showing external vs archived image counts
5. Click "Archive" to download and embed images locally
6. Click "Revert" to restore original external URLs

### API Endpoints

```
GET  /api/cards/:id/archive-status         # Get counts of external/archived images
POST /api/cards/:id/archive-linked-images  # Download and archive external images
POST /api/cards/:id/revert-archived-images # Restore original URLs
GET  /user/images/:characterName/:filename # Serve archived images (ST-compatible)
```

### Image Path Format

Archived images use absolute paths for browser compatibility:
- Format: `/user/images/{slugified-character-name}/{nanoid}.{ext}`
- Example: `/user/images/zina/TzqQ5tpeavznFBMssO7GC.png`

The character name is slugified (lowercase, alphanumeric, hyphens) for filesystem safety.

### Implementation Files

| File | Purpose |
|------|---------|
| `apps/api/src/routes/image-archival.ts` | Archive/revert endpoints and image serving |
| `apps/api/src/db/migrations.ts` | Migration 6: Add original_url column |
| `apps/web/src/features/editor/components/AssetsPanel.tsx` | Archive/Revert UI buttons |
| `apps/web/src/store/settings-store.ts` | `linkedImageArchivalEnabled` feature flag |

### Vite Proxy Configuration

The `/user` path is proxied to the API server in development:

```typescript
// vite.config.ts
proxy: {
  '/user': {
    target: 'http://localhost:3456',
    changeOrigin: true,
  },
}
```

---

## Assets Panel - Grid View & Bulk Operations

The Assets Panel provides two view modes for managing card assets with bulk editing capabilities.

### View Modes

| Mode | Description |
|------|-------------|
| **List View** | Traditional list with details and inline editing |
| **Grid View** | Responsive thumbnail grid with selection checkboxes |

### Grid View Features

- **Responsive Layout**: 4-6 columns based on screen width (grid-cols-4, xl:5, 2xl:6)
- **Thumbnail Preview**: Image thumbnails with type badge overlay
- **Checkbox Selection**: Click checkboxes to select multiple assets
- **Sidebar Preview**: Selected asset shows full preview in left column
- **Sort Controls**: Sort by name, type, format, or date (ascending/descending)

### Bulk Operations

When assets are selected, a bulk action bar appears:

| Action | Description |
|--------|-------------|
| **Select All** | Toggle selection of all assets |
| **Change Type** | Set asset type for all selected items (dropdown + Apply) |
| **Delete Selected** | Remove all selected assets with confirmation |

### Asset Types

| Type | Color | Description |
|------|-------|-------------|
| `icon` | Blue | Character portrait/avatar |
| `background` | Green | Scene backgrounds |
| `emotion` | Purple | Expression/emotion variants |
| `user_icon` | Cyan | User avatar |
| `sound` | Yellow | Audio assets |
| `workflow` | Orange | ComfyUI workflow JSON |
| `lorebook` | Teal | Linked lorebook JSON |
| `custom` | Gray | Other/miscellaneous |

### Implementation

- **Location**: `apps/web/src/features/editor/components/AssetsPanel.tsx`
- **State Management**:
  - `viewMode`: 'list' | 'grid'
  - `sortField`: 'name' | 'type' | 'format' | 'date'
  - `sortOrder`: 'asc' | 'desc'
  - `selectedAssets`: Set<string> for tracking selections
- **Sorting**: Uses `useMemo` for efficient sorted asset computation

---

## Package Optimizer

Optimize media during CHARX and Voxta package exports with WebP/WebM conversion and selective asset export.

### Features

- **Image Optimization**:
  - Convert PNG/JPEG to WebP (typically 25-35% smaller)
  - Configurable WebP quality (50-100%)
  - Maximum resolution control (1-16 megapixels)
  - Strip EXIF metadata
- **Video Optimization**:
  - Convert MP4 to WebM using VP9 codec (requires ffmpeg)
  - Configurable CRF quality (10-50)
- **Selective Asset Export**:
  - Choose which asset types to include in export
  - Main icon always included regardless of selection
  - Available types: icon, background, emotion, user_icon, sound, workflow, lorebook, custom

### Settings Schema

```typescript
interface PackageExportSettings {
  convertToWebp: boolean;      // Convert PNG/JPEG to WebP
  webpQuality: number;         // 50-100 (default: 85)
  maxMegapixels: number;       // 1-16 (default: 4)
  stripMetadata: boolean;      // Remove EXIF data
  convertMp4ToWebm: boolean;   // Convert MP4 videos
  webmQuality: number;         // CRF 10-50 (default: 30, lower = better)
  includedAssetTypes: string[]; // Empty = all types
}
```

### API Endpoints

```
GET  /api/package-optimizer/settings   # Get current settings
PATCH /api/package-optimizer/settings  # Update settings

# Legacy aliases (backwards compatible):
GET  /api/charx-optimizer/settings
PATCH /api/charx-optimizer/settings
```

### Implementation

| File | Purpose |
|------|---------|
| `apps/web/src/modules/charx-optimizer/index.ts` | Module registration |
| `apps/web/src/modules/charx-optimizer/settings/CharxOptimizerSettings.tsx` | Settings UI |
| `apps/api/src/routes/charx-optimizer.ts` | API routes and defaults |
| `apps/api/src/utils/image-optimizer.ts` | Image and video optimization |
| `apps/api/src/utils/file-handlers.ts` | CHARX/Voxta build with filtering |

### Video Conversion Requirements

MP4 to WebM conversion requires **ffmpeg** installed on the server:

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

If ffmpeg is not available, MP4 files are included unchanged.

---

## Main Icon Conventions

Different formats use different conventions for the main character icon:

| Format | Main Icon Convention | On Import | On Export |
|--------|---------------------|-----------|-----------|
| **Voxta** | `thumbnail.png` | Set `isMain: true` | Rename to `thumbnail.png` |
| **CHARX** | `main.png` (or `name: "main"`) | Set `isMain: true` | Rename to `main.png` |
| **PNG** | The PNG file itself | Saved as `original_image` | Embedded in PNG |
| **JSON** | N/A (no image) | N/A | N/A |

### Implementation Details

**Voxta Import** (`services/voxta-import.service.ts`):
- `thumbnail.png` is extracted and saved as both:
  - The card's `original_image` (for PNG export)
  - A card asset with `isMain: true` and `name: "main"` (for CHARX export)

**Voxta Export** (`packages/voxta/src/writer.ts`):
- Looks for asset with `isMain: true` or `name: "main"`
- Falls back to first `type: "icon"` asset
- Writes as `Characters/{id}/thumbnail.png`

**CHARX Import** (`services/card-import.service.ts`):
- Assets with `name: "main"` get `isMain: true`

**CHARX Export** (`packages/charx/src/writer.ts`):
- Assets with `isMain: true` are renamed to `main.png`
- Written to `assets/icon/images/main.{ext}`

**PNG Export** (`routes/import-export.ts`):
- Uses `original_image` from database
- Falls back to main icon asset if no original image

---

## ComfyUI Integration

Full image generation integration with ComfyUI for character portraits and emotion sprites.

### Features

- **Connection Management**: Test and monitor ComfyUI server connectivity
- **Workflow Management**: Upload, save, and load ComfyUI workflow JSON files
- **Checkpoint Selection**: Browse and select models from connected ComfyUI server
- **Prompt Generation**:
  - Build prompts from card appearance/description fields
  - LLM-powered prompt generation with configurable context
  - Quick presets for full body, portrait, scene, background
- **Image Generation**:
  - Real-time generation with progress display
  - Base64 image streaming for instant preview
  - History with regeneration from saved settings
  - Save generated images as card assets

### Emotion Images Sub-Tab

Batch generation of emotion sprites for SillyTavern and Voxta formats.

**Supported Formats:**
| Format | Items | Naming Convention |
|--------|-------|-------------------|
| SillyTavern | 84 | `emotion-variant-#` (28 emotions × 3 variants) |
| Voxta | 186 | `Emotion_State_##` (11 emotions × 17 states) |

**Features:**
- **Source Image Upload**: Upload or use card icon as base image
- **Workflow Integration**: Injects prompts, filenames, counts into workflow nodes
- **Settings Persistence**: All settings saved to localStorage
- **Results Grid**: Visual grid with selection, save, and delete actions
- **Batch Operations**: Select All, Save as Emotions, Delete selected

**Workflow Node Mapping** (Voxta Avatar Generator):
| Node ID | Purpose |
|---------|---------|
| 166 | LoadImage (source image input) |
| 227 | Filename list |
| 255 | Total count |
| 261 | Output path |
| 266 | Prompt list |

### API Endpoints

```
POST   /api/comfyui/connect              # Test server connection
POST   /api/comfyui/models               # List checkpoints from server
GET    /api/comfyui/workflows            # List saved workflows
POST   /api/comfyui/workflows            # Save new workflow
PATCH  /api/comfyui/workflows/:id        # Update workflow
DELETE /api/comfyui/workflows/:id        # Delete workflow
POST   /api/comfyui/generate             # Generate image
GET    /api/comfyui/image                # Proxy image from ComfyUI
POST   /api/comfyui/history              # Get generation history
GET    /api/comfyui/emotions             # Get emotion presets
PATCH  /api/comfyui/emotions             # Update emotion presets
POST   /api/comfyui/generate-emotions    # Batch emotion generation
POST   /api/comfyui/upload-image         # Upload image to ComfyUI
```

### Settings

Settings > ComfyUI:
- **Server URL**: ComfyUI server address (e.g., `http://localhost:8188`)
- **Auto-Select Asset Type**: Skip save dialog for generated images
- **Positive/Negative Prompts**: Default prompts for generation

### Workflow Injection

Workflows support injection maps that define which nodes receive dynamic values:

```json
{
  "injectionMap": {
    "positive_prompt": "6",
    "negative_prompt": "7",
    "seed": "3",
    "checkpoint": "4"
  },
  "emotionInjectionMap": {
    "filename_list": "227",
    "prompt_list": "266",
    "total_count": "255",
    "source_image": "166",
    "output_path": "261"
  }
}
```

### Implementation

| File | Purpose |
|------|---------|
| `apps/web/src/modules/comfyui/index.ts` | Module registration |
| `apps/web/src/features/comfyui/ComfyUITab.tsx` | Main tab with General and Emotion sub-tabs |
| `apps/web/src/modules/comfyui/settings/ComfyUISettings.tsx` | Server and workflow settings |
| `apps/api/src/routes/comfyui.ts` | API endpoints |
| `apps/api/src/services/comfyui-client.ts` | ComfyUI API client and injection logic |
| `apps/api/data/settings/presets/comfyui.json` | Workflow storage |
| `apps/api/data/settings/presets/emotions.json` | Emotion preset data |

---

## SillyTavern Integration

Direct push of character cards to SillyTavern.

### Features

- **One-Click Push**: Send PNG directly to SillyTavern
- **Session Cookie**: Configure authentication cookie
- **Auto-Save**: Saves card before push to ensure latest edits

### Settings

Settings > SillyTavern:
- **SillyTavern URL**: Base URL of your SillyTavern instance
- **Session Cookie**: Authentication cookie value

### Usage

1. Configure SillyTavern URL and session cookie in settings
2. Open a card in the editor
3. Click "Push to ST" button in header
4. Card is uploaded as PNG with embedded data

### Implementation

- **Location**: `apps/web/src/modules/sillytavern/`
- **Settings**: `settings/SillyTavernSettings.tsx`
- **Route**: `apps/api/src/routes/sillytavern.ts`

---

## AI Generation Buttons

Quick AI generation for Tags and Tagline fields in Edit > Basic Info.

### Tags

- Generates 5-10 single-word slugs from description
- Hyphens for compound words (e.g., "sci-fi")
- Merges with existing tags (no duplicates)

### Tagline

- Generates catchy text up to 500 characters
- Stored in `extensions.tagline`

### Configuration

Settings > LLM Presets tab:
- Tags Generation prompt
- Tagline Generation prompt

---

## Creating a New Module

### Auto-Discovery

Modules are automatically discovered using Vite's `import.meta.glob`. No manual registration required.

```typescript
// Auto-discover all modules from the modules directory
const moduleLoaders = import.meta.glob('../modules/*/index.ts');

// Convention-based naming:
// - Folder: modules/{module-id}/index.ts
// - Feature flag: {camelCaseId}Enabled (e.g., blockEditorEnabled, comfyuiEnabled)
// - Register function: register{PascalCaseId}Module (e.g., registerBlockEditorModule)
```

### Steps

1. Create `modules/{your-module}/index.ts`
2. Export `MODULE_METADATA` constant with module info
3. Export `register{YourModule}Module()` function
4. That's it! The toggle switch, feature flag, and settings panel are all auto-discovered.

### Module Index File Pattern

```typescript
import { lazy } from 'react';
import { registry } from '@/lib/registry';
import { useSettingsStore } from '@/store/settings-store';
import type { ModuleDefinition } from '@/lib/registry/types';

// Module metadata - required for auto-discovery
export const MODULE_METADATA: ModuleDefinition = {
  id: 'my-module',           // kebab-case, matches folder name
  name: 'My Module',         // Display name
  description: 'What this module does.',
  defaultEnabled: false,     // Initial state for new users
  badge: 'Beta',             // Optional badge text
  color: 'purple',           // Toggle/badge color
  order: 50,                 // Display order in settings
};

const MyModuleTab = lazy(() => import('./MyModuleTab'));
const MyModuleSettings = lazy(() =>
  import('./settings/MyModuleSettings').then((m) => ({
    default: m.MyModuleSettings,
  }))
);

export function registerMyModuleModule(): void {
  // Register editor tab (optional)
  registry.registerTab({
    id: 'my-module',
    label: 'My Module',
    component: MyModuleTab,
    order: 50,
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.myModuleEnabled ?? false,
  });

  // Register settings panel
  registry.registerSettingsPanel({
    id: 'my-module',
    label: 'My Module',
    component: MyModuleSettings,
    row: 'modules',
    color: 'purple',
    order: 50,
    condition: () => useSettingsStore.getState().features?.myModuleEnabled ?? false,
  });
}
```

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main project documentation
- [CLAUDE_API.md](./CLAUDE_API.md) - API endpoint reference
- [CLAUDE_WEB_IMPORT.md](./CLAUDE_WEB_IMPORT.md) - Web import details
- [CLAUDE_TESTING.md](./CLAUDE_TESTING.md) - Testing guide
