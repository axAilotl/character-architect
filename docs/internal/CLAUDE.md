# Card Architect - Complete Project Guide

## Project Overview

**Card Architect** (internally called "card_doctor") is a modern, self-hostable character card editor for CCv2 (Character Card v2) and CCv3 (Character Card v3) formats. It's designed as a single-user application with always-saving drafts, version history, and accurate token estimation for AI character cards.

This tool helps creators build, edit, and maintain AI character cards with advanced features for character development, including AI-assisted content generation, templates, lorebooks, and version control.

## Tech Stack

**Backend (apps/api):**
- **Fastify** - Fast, low-overhead web framework
- **SQLite** (better-sqlite3) - Local database for cards storage
- **Sharp** - Image processing (crop, resize, convert)
- **pngjs** - PNG tEXt chunk handling for embedded card metadata
- **Ajv** - JSON schema validation

**Frontend (apps/web):**
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling (custom dark theme)
- **Zustand** - Lightweight state management
- **IndexedDB** (idb) - Local persistence (cards, images, versions, assets)
- **Milkdown** - WYSIWYG markdown editor
- **CodeMirror** - Raw markdown editing
- **marked** - Markdown to HTML rendering
- **DOMPurify** - HTML sanitization for security

**Testing:**
- **Vitest** - Test framework (68 tests passing) - See [CLAUDE_TESTING.md](./CLAUDE_TESTING.md)

## Architecture

### Monorepo Structure

```
card_doctor/
├── apps/
│   ├── api/                 # Fastify backend (Node 20 + SQLite)
│   │   └── src/
│   │       ├── routes/      # API endpoints (18 route files)
│   │       ├── services/    # Business logic
│   │       ├── providers/   # LLM provider integrations
│   │       ├── db/          # Database & repository
│   │       ├── utils/       # Utilities (PNG, prompts, RAG, settings)
│   │       └── __tests__/   # Vitest tests
│   └── web/                 # React frontend (Vite + TypeScript + Tailwind)
│       └── src/
│           ├── features/    # Core features (dashboard, editor)
│           │   └── editor/
│           │       ├── tabs.ts          # Core tab registration
│           │       ├── CardEditor.tsx   # Dynamic tab rendering
│           │       └── components/      # Editor panels
│           ├── modules/     # Optional modules (lazy-loaded)
│           │   ├── block-editor/        # Visual block-based card builder
│           │   ├── wwwyzzerdd/          # AI character wizard
│           │   └── comfyui/             # Image generation with ComfyUI
│           ├── components/  # React components (shared, ui)
│           ├── store/       # Zustand state
│           ├── hooks/       # React hooks
│           ├── lib/         # API client, IndexedDB, registry
│           │   └── registry/            # Plugin registry system
│           │       ├── types.ts         # Type definitions
│           │       ├── index.ts         # Registry singleton
│           │       └── hooks.ts         # React hooks
│           └── styles/      # CSS
├── packages/
│   ├── schemas/             # Shared types & Zod validation (CCv2, CCv3, CHARX, Voxta)
│   ├── utils/               # Binary, base64, ZIP, URI utilities
│   ├── png/                 # PNG tEXt/zTXt chunk reading/writing
│   ├── charx/               # CHARX format (ZIP-based CCv3)
│   ├── voxta/               # Voxta .voxpkg format
│   ├── tokenizers/          # Token counting
│   └── plugins/             # Plugin SDK (stub)
├── docs/                    # Documentation
│   ├── CLAUDE.md            # This file - technical context
│   ├── plugins_plan.md      # Plugin architecture implementation plan
│   └── ROADMAP.md           # Development roadmap
└── testing/                 # Test cards from various platforms
    ├── wyvern/
    ├── chub/
    └── CharacterTavern/
```

### Plugin Architecture

The frontend uses a dynamic plugin-based architecture for editor tabs and settings panels. This allows:
- **Dynamic Registration**: Tabs and settings panels can be registered at runtime
- **Lazy Loading**: Optional modules load on-demand
- **Feature Flags**: Modules conditionally enabled based on settings
- **Consistent API**: Core and plugin tabs/panels use the same registration mechanism

**Key Components:**

| File | Purpose |
|------|---------|
| `lib/registry/types.ts` | Type definitions (EditorTabDefinition, SettingsPanelDefinition) |
| `lib/registry/index.ts` | Registry singleton with CRUD operations |
| `lib/registry/hooks.ts` | React hooks (useEditorTabs, useSettingsPanels) |
| `lib/modules.ts` | Module loader for async initialization |
| `features/editor/tabs.ts` | Core tab registration (focused-settings, diff-settings) |
| `modules/*/index.ts` | Optional module registration (tabs + settings panels) |

**Tab Registration Example:**
```typescript
import { registry } from '@/lib/registry';

registry.registerTab({
  id: 'my-tab',
  label: 'My Tab',
  component: lazy(() => import('./MyComponent')),
  order: 50,
  contexts: ['card'],
  condition: () => settingsStore.getState().features.myFeature,
});
```

**Settings Panel Registration Example:**
```typescript
import { registry } from '@/lib/registry';

registry.registerSettingsPanel({
  id: 'my-module',
  label: 'My Module',
  component: lazy(() => import('./settings/MyModuleSettings')),
  row: 'modules',     // 'main' for core settings, 'modules' for optional modules
  color: 'purple',    // Tab badge color (purple, pink, teal, amber, etc.)
  order: 50,          // Display order within row
  condition: () => useSettingsStore.getState().features?.myFeatureEnabled ?? false,
});
```

**Settings Modal Structure:**
The Settings Modal renders panels in two rows:
1. **Main Row** (`row: 'main'`): Core settings (General, LLM Providers, RAG, Presets, Templates, Snippets)
2. **Modules Row** (`row: 'modules'`): Optional module settings (dynamically rendered from registry)

**Application Bootstrap:**
```typescript
// main.tsx
async function bootstrap() {
  await initializeModules(); // Registers all tabs and settings panels
  ReactDOM.createRoot(...).render(<App />);
}
```

### Module Settings Structure

Each optional module provides its own self-contained settings component that manages its own state, data loading, and UI rendering.

**Module Settings Components:**

| Module | Settings Component | Color | Order |
|--------|-------------------|-------|-------|
| Block Editor | `modules/block-editor/settings/BlockEditorSettings.tsx` | purple | 10 |
| Focused Mode | `features/editor/settings/FocusedSettings.tsx` | blue | 15 |
| Diff Mode | `features/editor/settings/DiffSettings.tsx` | green | 20 |
| wwwyzzerdd | `modules/wwwyzzerdd/settings/WwwyzzerddSettings.tsx` | amber | 30 |
| ComfyUI | `modules/comfyui/settings/ComfyUISettings.tsx` | orange | 40 |
| Web Import | `modules/webimport/settings/WebImportSettings.tsx` | teal | 60 |
| CHARX Optimizer | `modules/charx-optimizer/settings/CharxOptimizerSettings.tsx` | purple | 65 |
| SillyTavern | `modules/sillytavern/settings/SillyTavernSettings.tsx` | pink | 70 |

**Module Auto-Discovery** (`lib/modules.ts`):

Modules are automatically discovered using Vite's `import.meta.glob`. No manual registration required.

```typescript
// Auto-discover all modules from the modules directory
const moduleLoaders = import.meta.glob('../modules/*/index.ts');

// Convention-based naming:
// - Folder: modules/{module-id}/index.ts
// - Feature flag: {camelCaseId}Enabled (e.g., blockEditorEnabled, comfyuiEnabled)
// - Register function: register{PascalCaseId}Module (e.g., registerBlockEditorModule)
```

**Adding a New Module (Auto-Discovery):**
1. Create `modules/{your-module}/index.ts`
2. Export `MODULE_METADATA` constant with module info (name, description, defaultEnabled, etc.)
3. Export `register{YourModule}Module()` function that calls `registry.registerSettingsPanel()` and/or `registry.registerTab()`
4. That's it! The toggle switch, feature flag, and settings panel are all auto-discovered.

The feature flag naming convention is `{camelCaseModuleId}Enabled` (e.g., `charxOptimizerEnabled` for `charx-optimizer`).

**Module Index File Pattern** (`modules/*/index.ts`):
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

### Deployment Modes

Card Architect supports three deployment modes for different hosting scenarios:

| Mode | Environment Variable | Description |
|------|---------------------|-------------|
| `full` | `VITE_DEPLOYMENT_MODE=full` | All features, full server backend |
| `light` | `VITE_DEPLOYMENT_MODE=light` | Minimal server, client-side features |
| `static` | `VITE_DEPLOYMENT_MODE=static` | No server, static hosting only |

**Auto-Detection**: If not set, auto-detects based on hostname (localhost/`.local` = full, otherwise = light).

**Client-Side Features** (work in all modes):
- **IndexedDB Storage**: Cards, images, versions, assets (50MB limit per asset)
- **Client LLM**: Direct browser calls to OpenRouter/Anthropic
- **SillyTavern Push**: Works for localhost ST instances
- **LLM Presets**: Stored in localStorage
- **wwwyzzerdd Prompts**: Stored in localStorage

**Server-Only Features** (full mode only):
- Server-side RAG with FastEmbed
- ComfyUI integration
- Server-side image optimization (Sharp)

For complete deployment documentation, see **[CLAUDE_PWA.md](./CLAUDE_PWA.md)**.

### Code Metrics

- **Total Lines**: ~63,500 TypeScript
- **File Count**: 463+ TypeScript files
- **API Endpoints**: 100+
- **Route Files**: 18
- **Test Coverage**: 68/68 tests passing

### Related Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE_API.md](./CLAUDE_API.md) | Complete API endpoint reference and database schema |
| [CLAUDE_MODULES.md](./CLAUDE_MODULES.md) | Module-specific documentation (Block Editor, wwwyzzerdd, etc.) |
| [CLAUDE_WEB_IMPORT.md](./CLAUDE_WEB_IMPORT.md) | Web import userscript and site handlers |
| [CLAUDE_PWA.md](./CLAUDE_PWA.md) | PWA features, deployment modes, and client-side storage |
| [CLAUDE_TESTING.md](./CLAUDE_TESTING.md) | Testing guide with 68 tests |
| [ROADMAP.md](./ROADMAP.md) | Development roadmap and changelog |

## Character Card Formats

### Supported Specs

| Spec | Version | Description |
|------|---------|-------------|
| CCv2 | `chara_card_v2` | TavernCardV2 - most common format |
| CCv3 | `chara_card_v3` | Extended spec with assets, timestamps |
| CHARX | ZIP-based | CCv3 + embedded assets in ZIP archive |
| Voxta | `.voxpkg` | Voxta AI companion format |

### PNG Chunk Keys

Cards can be embedded in PNG files using these tEXt chunk keywords:

| Chunk Key | Format | Used By |
|-----------|--------|---------|
| `chara` | Base64 JSON | Universal (V1/V2/V3) |
| `ccv3` | Base64 JSON | CCv3 spec |
| `chara_card_v3` | Base64 JSON | CCv3 alternate |

CharacterTavern exports BOTH `chara` and `ccv3` chunks with identical content.

### URI Schemes

Asset URIs in CCv3 cards support these schemes:

| Scheme | Example | Description |
|--------|---------|-------------|
| `embeded://` | `embeded://assets/icon/0.png` | CHARX embedded asset |
| `ccdefault:` | `ccdefault:` | Use platform default |
| `https://` | `https://example.com/img.png` | Remote URL |
| `data:` | `data:image/png;base64,...` | Inline base64 |
| `__asset:` | `__asset:0` | PNG chunk reference |
| `asset:` | `asset:0` | PNG chunk reference (alt) |

### CCv2 (Character Card v2)

- Basic fields: name, description, personality, scenario, first_mes
- Extensions for lorebooks, alternate greetings
- Spec value: `chara_card_v2`

### CCv3 (Character Card v3)

- All CCv2 fields plus enhanced lorebook
- Better structured character books with priority, position, logic
- Required fields: creator, character_version, tags
- Spec value: `chara_card_v3`

### Lorebook Entry Structure

- **Keywords** - Primary trigger words (comma-separated)
- **Secondary Keywords** - For selective matching
- **Content** - The lorebook entry text
- **Priority** - Insertion priority (higher = inserted first)
- **Insertion Order** - Order among same-priority entries
- **Position** - before_char | after_char
- **Probability** - 0-100% chance of insertion
- **Selective Logic** - AND (all match) or NOT (none match)
- **Constant** - Always insert regardless of triggers
- **Case Sensitive** - Match keywords with exact case
- **Depth** - Scan depth override
- **Extensions** - Custom metadata

## Platform-Specific Formats

### Wyvern (wyvern.chat)

**Structure**: Hybrid V2 with full field duplication

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "name": "...",           // DUPLICATED at root
  "description": "...",    // DUPLICATED at root
  "data": {
    "name": "...",         // Canonical location
    "description": "..."
  }
}
```

**Extensions**:
- `depth_prompt` - SillyTavern Character Note injection
  ```json
  { "prompt": "...", "depth": 4 }
  ```
- `visual_description` - Physical appearance (maps to Voxta appearance)

**Import Handling**: Strip root-level duplicates, use `data` object.

### Chub (chub.ai)

**Structure**: Clean V2, spec-compliant

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "avatar": "https://avatars.charhub.io/...",  // Chub-specific
    "extensions": {
      "chub": {
        "id": 4792687,
        "full_path": "creator/card-slug",
        "related_lorebooks": []
      },
      "depth_prompt": { "role": "system", "depth": 4, "prompt": "..." }
    }
  }
}
```

**Import Handling**: No special handling needed, preserves extensions.

### CharacterTavern

**Structure**: Clean V3

```json
{
  "spec": "chara_card_v3",
  "spec_version": "3.0",
  "data": {
    "creation_date": 1764064064277,     // BUG: milliseconds not seconds
    "modification_date": 1764064064277,
    "group_only_greetings": []
  }
}
```

**Import Handling**: Convert timestamps from milliseconds to seconds if > 10000000000.

### ChubAI Legacy

**Structure**: Hybrid V2 (spec at root, fields at root, no data wrapper)

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "name": "...",
  "description": "..."
  // No "data" object!
}
```

**Import Handling**: Wrap fields into `data` object.

## Known Extensions

### Standard Extensions (preserve during import/export)

| Extension | Description | Platforms |
|-----------|-------------|-----------|
| `depth_prompt` | Character Note injection | SillyTavern, Wyvern, Chub |
| `visual_description` | Physical appearance | Wyvern |
| `chub` | Platform metadata | Chub |
| `risuai` | RisuAI metadata | RisuAI |
| `voxta` | Voxta character settings | Voxta exports |
| `tagline` | Short character tagline | Card Architect |

### depth_prompt Structure
```json
{
  "depth_prompt": {
    "prompt": "Character note content",
    "depth": 4,
    "role": "system"  // Optional, Chub adds this
  }
}
```

### visual_description
```json
{
  "visual_description": "Physical description text"
}
```

Maps bidirectionally with Voxta `Description` (appearance) field.

### voxta Extension
```json
{
  "voxta": {
    "id": "uuid",
    "packageId": "uuid",
    "appearance": "Physical description",
    "textToSpeech": [...],
    "chatSettings": {
      "chatStyle": 0,
      "enableThinkingSpeech": false,
      "maxTokens": 200
    },
    "scripts": [...]
  }
}
```

## Import Normalization

The `normalizeCardData()` function in `apps/api/src/routes/import-export.ts` handles:

1. **Wyvern duplication**: Strips root-level duplicate fields
2. **ChubAI hybrid**: Wraps root fields into `data` object
3. **CharacterTavern timestamps**: Converts milliseconds to seconds
4. **Missing V3 fields**: Adds defaults for `group_only_greetings`, `creator`, etc.
5. **character_book cleanup**: Removes null values, normalizes entries
6. **Spec normalization**: `spec: "v2"` → `spec: "chara_card_v2"`
7. **Position fields**: Numeric → string (`0` → `'before_char'`, `1+` → `'after_char'`)

## Key Features

### 1. Dual Format Support (V2/V3)
- **V2/V3 Mode Switcher**: Toggle between character card formats (EditPanel.tsx:151-172)
- **Show V3 Fields**: Optional visibility control for V3-specific fields
- **Field Spec Markers**: Visual badges indicating field compatibility:
  - "Both" - Works in V2 and V3
  - "V2" - V2 format only
  - "V3" - V3 format (required in V3)
  - "V3 Only" - Only available in V3 spec
- **Auto-conversion**: Seamlessly converts data between formats (card-store.ts:336-381)
- **V3-specific fields**:
  - Creator (required)
  - Character Version (required)
  - Tags (required, array)
  - Group Only Greetings (array)

### 2. Editor Modes
- **Edit Mode**: Standard tabbed editing interface
  - Basic Info: Name, description, personality, scenario, avatar
  - Greetings: First message, alternate greetings, group greetings
  - Advanced: System prompt, post-history, examples, creator notes
  - Lorebook: Two-column layout with entry management
- **Focused Mode**: Distraction-free WYSIWYG + raw markdown editing
  - Field selector for all major fields
  - Side-by-side WYSIWYG (Milkdown) and raw markdown (CodeMirror) views
  - Template & snippet support
  - AI assistant integration
- **Preview Mode**: Live markdown rendering with extended syntax
  - Supports: `![alt](url =widthxheight)` sizing syntax
  - Examples: `=100%x100%`, `=400x300`, `=50%`
  - DOMPurify HTML sanitization for XSS protection
- **Diff Mode**: Version comparison and snapshot management

### 3. AI Assistant Integration (LLM)
- **Providers**: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude)
- **Features**:
  - Streaming responses with live diff viewer
  - Token delta tracking
  - Custom instructions
  - Connection testing
  - Stop button for canceling requests
- **Built-in Preset Operations** (8 total):
  - Tighten (reduce wordiness)
  - Convert-structured / convert-prose
  - Enforce-style
  - Generate-alts (alternate greetings)
  - Generate-lore (lorebook entries)
  - Expand / Simplify
- **User-Defined Presets**:
  - Create custom AI operations with name, description, instruction
  - Organized by category: rewrite, format, generate, custom
  - Import/export for sharing
  - Built-in presets are read-only (protected from modification/deletion)
- **Available in**: Edit mode (all text fields), Focused mode
- **Actions**: Replace, Append, Insert
- **Security**: API keys stored in `~/.card-architect/config.json` with 600 permissions, redacted in all responses

### 4. RAG System (Knowledge Bases)
- **Vector embeddings**: Semantic search powered by FastEmbed (BAAI/bge-small-en-v1.5)
- **File-based vector storage**: `~/.card-architect/rag-index/`
- **Document types**:
  - **File uploads**: PDF, JSON, Markdown, HTML, plain text
  - **Free text entry**: Direct text input for notes and documentation
  - **Lorebook import**: Import character lorebooks as searchable knowledge
- **Intelligent chunking**: 1200 char chunks, 200 char overlap
- **Semantic search**: Cosine similarity with 384-dimensional embeddings
- **Multiple knowledge bases**: Tags, descriptions, document management
- **Integration**: Automatically provides context to LLM operations

### 5. Templates & Snippets
- **Templates**: Full field content or multi-field templates
  - Apply modes: Replace, Append, Prepend
  - Field-specific or apply to all fields
- **Snippets**: Small reusable text fragments
  - Quick insertion into any field
- **Supported Fields**:
  - Description, Personality, Scenario
  - First Message, Example Messages
  - System Prompt, Post History Instructions
  - Creator Notes

### 6. Lorebook Editor
- **Two-column layout**:
  - Left: Entry list (300px sidebar)
  - Right: Entry form (selected entry)
- **Settings** (top section):
  - Scan Depth, Token Budget, Recursive Scanning
  - Name, Description
- **Entry Management**:
  - Keys (trigger words)
  - Content (lore text)
  - Position (before_char/after_char), Priority, Insertion Order
  - Probability (0-100%), Depth, Case Sensitivity
  - Selective mode with secondary keys (AND/NOT logic)
  - Constant (always insert)
  - Extensions support

### 7. Version Control (Snapshots)
- **Create snapshots** with optional messages
- **Compare versions** in Diff mode
- **Restore** from any previous version
- **Delete snapshots** with confirmation dialog
- **Snapshot button** integrated into editor tabs row (EditorTabs.tsx)
- **Auto-Snapshot**:
  - Configurable automatic snapshots at intervals (1, 5, 10, 15, or 30 minutes)
  - Settings in General tab of Settings modal
  - Only creates snapshots when card has unsaved changes
  - Auto-snapshots labeled with "[Auto]" prefix
  - Persisted settings via Zustand + localStorage

### 8. Import/Export
- **Import**: JSON, PNG, or CHARX character cards
  - **From File**: Upload from local filesystem (JSON, PNG, CHARX)
  - **From URL**: Import directly from web URLs (PNG, JSON, CHARX)
    - Supports HTTP/HTTPS URLs
    - Auto-detects file type from Content-Type header or file extension
    - Works with direct file links from hosting services
  - **Web Import (Userscript)**: One-click import from character sites (see Web Import section below)
  - Automatic normalization of non-standard spec values
  - Handles legacy numeric position fields
  - Compatible with: CharacterHub, SillyTavern, Agnai, TavernAI, Wyvern, Chub
  - PNG tEXt chunk extraction with multiple key support
- **Export**:
  - JSON (spec-specific based on current mode)
  - PNG (embedded metadata in tEXt chunks)
    - **Critical PNG Fix**: Removes old tEXt chunks before embedding new data
    - Prevents duplicate/stale data when re-exporting edited cards
    - Ensures exports always contain latest edits
  - CHARX (with assets)
  - Voxta (.voxpkg)
- **SillyTavern Push Integration**:
  - Push button in header to send PNG directly to SillyTavern
  - Settings modal for configuring SillyTavern URL and session cookie
  - Auto-save before push to ensure latest edits included
  - Generates PNG on-the-fly (no manual export needed)
- **Click-based dropdown menus** (not hover)

### 9. Character Avatar
- **Upload/replace** character images
- **Preview** in Basic Info tab (192x192px)
- **Automatic PNG conversion**
- **Stored** in database as BLOB

### 10. Card Management
- **Grid view** with visual indicators:
  - Purple badge for alternate greetings
  - Green badge for lorebook entries
- **Bulk operations**: Bulk select and delete (toggle button)
- **CRUD operations**: Create, read, update, delete
- **Auto-save** with debouncing (500ms)
- **Draft recovery** via IndexedDB

### 11. Additional Tools
- **Tokenization**: Real-time token counting per field
  - Approximate BPE/SentencePiece tokenizers
  - Per-field token counts (blue chips)
  - Total token count in header
- **Prompt Simulator**: Test how cards will be assembled by different frontends
  - Profiles: Generic CCv3, Strict CCv3, CCv2-compat
  - Token budget tracking with drop policies
- **Redundancy Killer**: Cross-field duplicate detection (UI disabled, backend available)
- **Lore Trigger Tester**: Test lorebook entry activation (UI disabled, backend available)

## Feature Flags

Optional features that can be enabled in Settings > General:

| Feature | Description |
|---------|-------------|
| Block Editor | Visual block-based character card builder (enabled by default) |
| wwwyzzerdd Mode | AI-assisted character creation wizard |
| ComfyUI Integration | Image generation with emotion sprite batching |
| Web Import | Browser userscript for one-click imports from character sites |
| CHARX Optimizer | Optimize images during CHARX/Voxta export with WebP conversion (enabled by default) |
| Linked Image Archival | Archive external images from greetings as local assets (destructive) |

## Web Import

One-click character card importing from supported sites via browser userscript.

**Supported Sites:** Chub.ai, Character Tavern, Risu Realm, Wyvern

For complete Web Import documentation including site handlers, asset importing, and userscript details, see **[CLAUDE_WEB_IMPORT.md](./CLAUDE_WEB_IMPORT.md)**.

## Optional Modules

For detailed documentation on optional modules, see **[CLAUDE_MODULES.md](./CLAUDE_MODULES.md)**:

- **Block Editor** - Visual block-based card builder with drag & drop
- **wwwyzzerdd** - AI character creation wizard with two-column layout
- **ELARA VOSS** - Name replacement tool with custom name database
- **Linked Image Archival** - Archive external images as local assets
- **Assets Panel** - Grid view with bulk operations
- **CHARX Optimizer** - WebP conversion for exports
- **ComfyUI** - Image generation with emotion sprite batching
- **SillyTavern** - Direct push integration
- **AI Generation Buttons** - Quick tags and tagline generation

## API Endpoints & Database

For complete API endpoint reference and database schema documentation, see **[CLAUDE_API.md](./CLAUDE_API.md)**.

**Base URL (dev):** `http://localhost:3456`

### Key Endpoint Groups
- **Cards**: CRUD, versions, assets, export (json/png/charx/voxta)
- **Import/Export**: File upload, URL import, Voxta packages, format conversion
- **LLM**: Provider settings, direct invocation, AI assist with presets
- **RAG**: Knowledge base management, document indexing, semantic search
- **Templates & Snippets**: Reusable content management
- **Web Import**: Userscript-based card importing from supported sites

### Core Tables
- `cards` - Character card data with spec (v2/v3)
- `card_versions` - Snapshot history
- `card_assets` - Associated images/files
- `llm_presets` - Built-in and user AI presets

## State Management (Zustand)

### CardStore (apps/web/src/store/card-store.ts)
- **currentCard**: Active card being edited
- **isDirty**: Unsaved changes flag
- **isSaving**: Save operation in progress
- **activeTab**: Current editor tab
- **specMode**: 'v2' | 'v3' - Current spec for editing/export
- **showV3Fields**: Toggle V3-specific field visibility
- **tokenCounts**: Per-field token counts
- **Actions**:
  - setCurrentCard, updateCardData, updateCardMeta
  - saveCard, loadCard, createNewCard
  - importCard, exportCard
  - createSnapshot, updateTokenCounts
  - setSpecMode, toggleV3Fields

### LLM Store (apps/web/src/store/llm-store.ts)
- **provider**: Selected LLM provider
- **model**: Selected model
- **temperature**, **maxTokens**: Generation parameters
- **ragDatabases**: Available RAG knowledge bases
- **Actions**: setProvider, setModel, updateSettings, loadRAGDatabases

### Settings Store (apps/web/src/store/settings-store.ts)
- **autoSnapshot.enabled**: Auto-snapshot toggle
- **autoSnapshot.intervalMinutes**: Interval (1, 5, 10, 15, 30)
- **features**: Module feature flags with dynamic key support
  - Known flags: `blockEditorEnabled`, `wwwyzzerddEnabled`, `comfyuiEnabled`, `sillytavernEnabled`, `webimportEnabled`, etc.
  - Dynamic flags: `[key: string]: boolean` for auto-discovered modules
- **setModuleEnabled(moduleId, enabled)**: Generic setter for any module flag
- Persisted to localStorage as `card-architect-settings`

### UI Store (apps/web/src/store/ui-store.ts)
- **activeTab**: Current editor tab
- **modals**: Modal visibility states
- Ephemeral UI state management

## File Locations Reference

### Key Frontend Components (apps/web/src/)

**Features:**
- `features/dashboard/CardGrid.tsx` - Card list view with bulk operations
- `features/editor/CardEditor.tsx` - Main editor container
- `features/editor/components/` - Editor sub-components:
  - `EditPanel.tsx`, `FocusedEditor.tsx`
  - `PreviewPanel.tsx`, `DiffPanel.tsx`
  - `LorebookEditor.tsx`, `AssetsPanel.tsx`
  - `EditorTabs.tsx`, `FieldEditor.tsx`
  - `LLMAssistSidebar.tsx`, `TemplateSnippetPanel.tsx`
  - `ElaraVossPanel.tsx`, `TagInput.tsx`
  - `TemplateEditor.tsx`, `SnippetEditor.tsx`
**Modules (apps/web/src/modules/):**
- `block-editor/` - Visual block-based card builder
  - `index.ts` - Module registration
  - `settings/BlockEditorSettings.tsx` - Settings panel component
- `wwwyzzerdd/` - AI character wizard
  - `index.ts` - Module registration
  - `WwwyzzerddTab.tsx` - Main editor tab
  - `settings/WwwyzzerddSettings.tsx` - Prompt set management
- `comfyui/` - ComfyUI integration
  - `index.ts` - Module registration
  - `settings/ComfyUISettings.tsx` - Server config and workflow settings
- **Note**: Main ComfyUI tab is in `features/comfyui/ComfyUITab.tsx` (General + Emotions sub-tabs)
- `sillytavern/` - SillyTavern push integration
  - `index.ts` - Module registration
  - `settings/SillyTavernSettings.tsx` - Push config and session settings
- `webimport/` - Browser userscript integration
  - `index.ts` - Module registration
  - `settings/WebImportSettings.tsx` - Asset processing settings

**Shared Components:**
- `components/shared/Header.tsx` - Top navigation bar
- `components/shared/SettingsModal.tsx` - Settings UI with two-row layout:
  - Main row: General, LLM Providers, RAG, Presets, Templates, Snippets (hardcoded)
  - Modules row: Dynamic panels from registry via `useSettingsPanels('modules')`
- `components/shared/Sidebar.tsx` - Navigation sidebar
- `components/ui/` - Reusable UI elements:
  - `SearchableSelect.tsx`, `SnapshotButton.tsx`
  - `DiffViewer.tsx`, `SideBySideDiffViewer.tsx`
  - `ErrorBoundary.tsx`, `JsonPanel.tsx`

**Hooks:**
- `hooks/useAutoSnapshot.ts` - Auto-snapshot timer hook

**Stores:**
- `store/card-store.ts` - Card data and CRUD operations
- `store/ui-store.ts` - UI state (tabs, visibility)
- `store/settings-store.ts` - App settings (auto-snapshot, feature flags)
- `store/llm-store.ts` - LLM provider settings
- `store/token-store.ts` - Token counting
- `store/template-store.ts` - Templates and snippets

**Core:**
- `App.tsx` - Main application container with Routes
- `lib/api.ts` - API client
- `lib/db.ts` - IndexedDB schema and operations (cards, images, versions, assets)
- `lib/client-llm.ts` - Client-side LLM invocation for light/static modes
- `config/deployment.ts` - Deployment mode configuration and feature flags
- `vite-env.d.ts` - Vite client type definitions (enables `import.meta.glob`)

### Key Backend Files (apps/api/src/)

**Core:**
- `app.ts` - Fastify app builder
- `index.ts` - Server entry point

**Routes (apps/api/src/routes/):**
- `cards.ts` - Card CRUD operations
- `import-export.ts` - Card import/export with format normalization
- `tokenize.ts` - Token counting endpoints
- `llm.ts` - LLM provider invocation and settings management
- `presets.ts` - User preset CRUD operations with built-in protection
- `rag.ts` - RAG knowledge base and document operations
- `templates.ts` - Template and snippet management
- `wwwyzzerdd.ts` - AI character wizard prompts
- `comfyui.ts` - ComfyUI workflows, generation, and emotion endpoints
- `prompt-simulator.ts` - Prompt assembly simulation routes
- `redundancy.ts` - Redundancy detection routes
- `lore-trigger.ts` - Lore trigger testing routes
- `sillytavern.ts` - SillyTavern push integration
- `settings.ts` - Settings persistence
- `assets.ts` - Asset management
- `web-import.ts` - Web import route layer (~120 lines, delegates to service)
- `image-archival.ts` - Linked image archival and ST-compatible serving

**Services (apps/api/src/services/):**
- `prompt-simulator.ts` - Prompt assembly simulation logic
- `redundancy-killer.ts` - Cross-field duplicate detection
- `lore-trigger-tester.ts` - Lorebook trigger testing
- `card-import.service.ts` - Card import orchestration (CHARX, PNG, JSON)
- `web-import/` - Modular web import service (see Web Import Service Architecture)

**Utilities (apps/api/src/utils/):**
- `settings.ts` - Secure settings storage and retrieval
- `rag-store.ts` - File-based RAG vector storage
- `llm-prompts.ts` - LLM prompt construction and presets
- `tokenizer.ts` - Token counting utilities
- `diff.ts` - Text diff computation
- `png.ts` - PNG tEXt chunk extraction and embedding

**Database (apps/api/src/db/):**
- `repository.ts` - Database operations (cards, versions, presets, assets)
- `schema.ts` - SQLite table definitions
- `migrations.ts` - Versioned database migrations

**Providers (apps/api/src/providers/):**
- `openai.ts` - OpenAI Responses API and Chat Completions API
- `anthropic.ts` - Anthropic Messages API (Claude)

### Shared Packages
- `packages/schemas/src/` - TypeScript types and Zod validation
- `packages/utils/src/` - Binary, base64, ZIP utilities
- `packages/png/src/` - PNG chunk operations
- `packages/charx/src/` - CHARX format handler
- `packages/voxta/src/` - Voxta format handler
- `packages/tokenizers/` - Tokenizer adapters (GPT-2-like, LLaMA-like)

## Design System

### Colors (Tailwind)
- `dark-bg`: #0f172a (slate-900)
- `dark-surface`: #1e293b (slate-800)
- `dark-border`: #334155 (slate-700)
- `dark-text`: #f1f5f9 (slate-100)
- `dark-muted`: #94a3b8 (slate-400)

### Component Classes
- `.btn-primary` - Primary action button
- `.btn-secondary` - Secondary action button
- `.input-group` - Form field container
- `.label` - Form label
- `.chip` - Small badge/tag
- `.card` - Card container

## Development Workflow

### Local Development Setup

```bash
# Prerequisites: Node.js 20+, npm 10+

# Install dependencies
npm install

# Start both API and web servers concurrently
npm run dev

# Or run separately:
npm run dev:api    # API on http://localhost:3456
npm run dev:web    # Web UI on http://localhost:5173
```

### Build Commands

```bash
# Build all workspaces
npm run build

# Build specific workspace
npm run build:api
npm run build:web
npm run build:schemas

# Build packages individually
npm run build -w packages/schemas
npm run build -w packages/utils
npm run build -w packages/png
npm run build -w packages/charx
npm run build -w packages/voxta

# Lint all code
npm run lint

# Type check
npm run type-check

# Clean all build artifacts and dependencies
npm run clean
```

### Testing

```bash
cd apps/api

# Run tests
npm test           # Run once
npm run test:watch # Watch mode
npm run test:ui    # UI mode
```

**Test Suite:** 68 tests across 3 files
- `api-endpoints.test.ts` - API CRUD operations (17 tests)
- `card-validation.test.ts` - Schema validation (10 tests)
- `format-interoperability.test.ts` - Format conversions & round-trips (41 tests)

For comprehensive testing documentation including format interoperability, Voxta limitations, and manual testing plans, see **[CLAUDE_TESTING.md](./CLAUDE_TESTING.md)**.

### Docker Deployment

```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Access:
# Web UI: http://localhost:8765
# API: http://localhost:3456

# Standalone container
docker build -f docker/standalone.Dockerfile -t card-architect .
docker run -p 3456:3456 -p 8765:8765 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/storage:/app/storage \
  card-architect
```

## Configuration Files

### Configuration
- `package.json` - Root workspace configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration
- `docker-compose.yml` - Docker service definitions
- `apps/api/.env` - API environment variables (create if needed)
- `~/.card-architect/config.json` - LLM settings and provider configs (600 permissions)
- `~/.card-architect/rag-index/` - RAG knowledge base storage directory
- `apps/api/data/settings/presets/wwwyzzerdd.json` - Default wwwyzzerdd prompt sets

### Documentation
- `docs/CLAUDE.md` - This file - technical context
- `docs/ROADMAP.md` - Development roadmap
- `README.md` - User-facing documentation
- `CONTRIBUTING.md` - Contribution guidelines

## Troubleshooting & Common Issues

### PNG Import Failures

**Problem:** Cards imported from other tools fail validation with errors like:
- "must be equal to one of the allowed values" for position fields
- "must have required property" errors for wrapped formats

**Solution:** The import system now automatically normalizes:
- Non-standard spec values (`spec: "v2"` → `spec: "chara_card_v2"`)
- Numeric position fields in lorebook entries (0 → 'before_char', 1+ → 'after_char')
- Missing `extensions` fields in lorebook entries
- Null character_book values
- Platform-specific duplicates (Wyvern, ChubAI)
- Timestamp formats (CharacterTavern milliseconds)

**Location:** `apps/api/src/routes/import-export.ts` (normalizeLorebookEntries function)

### Markdown Images Not Displaying

**Problem:** Extended markdown syntax like `![alt](url =100%x100%)` doesn't render images

**Solution:** The preview panel now includes a custom marked extension supporting:
- Standard syntax: `![alt](url)`
- Sized syntax: `![alt](url =widthxheight)`
- Examples: `=100%x100%`, `=400x300`, `=50%`
- Also supports angled brackets: `![alt](<url> =100%x100%)`

**Alternative:** Use direct HTML in markdown fields:
```html
<img src="url" width="100%" height="100%">
```

**Location:** `apps/web/src/features/editor/components/PreviewPanel.tsx` (imageSizeExtension)

### Card Format Compatibility

The system is compatible with cards exported from:
- **CharacterHub**: Wrapped v2/v3 formats with various spec values
- **SillyTavern**: Legacy formats with numeric position fields
- **Agnai**: Standard wrapped formats
- **TavernAI**: Legacy unwrapped v2 format
- **Wyvern**: Hybrid format with field duplication
- **Chub.ai**: Standard V2 with platform extensions
- **CharacterTavern**: V3 with millisecond timestamps
- **Custom tools**: Most non-standard implementations

All formats are normalized during import to match CCv2/CCv3 specifications.

## Security Notes

### Current Implementation

- **API Key Security**: Stored with 600 permissions (owner read/write only) in `~/.card-architect/config.json`
- **Key Redaction**: API keys redacted as `***REDACTED***` in all API responses
- **No Logging**: API keys never logged to console or files
- **Smart Merging**: Settings updates preserve existing secrets when redacted values sent
- **HTML Sanitization**: DOMPurify for markdown preview (XSS protection)
- **Input Validation**: Backend validates all user inputs before processing

### Recommendations for Production

- Implement HTTPS enforcement
- Add CSRF token validation
- Rate limiting per IP address (especially for LLM endpoints)
- Audit logging for provider/settings changes
- Add session timeouts
- Consider API key rotation mechanism
- Add Content Security Policy headers
- Add request/response size limits
- Implement token usage tracking and quota management

## Performance Considerations

- Frontend panels use debounced API calls (500ms) to reduce server load
- Token counting uses approximate tokenizers for speed
- Large cards (>10k tokens) may need optimization
- Consider caching redundancy analysis results for repeated scans
- IndexedDB for local draft storage reduces API calls
- Thumbnail endpoint (96x96) for efficient avatar display in grid view

## Known Limitations

### Features Disabled in UI
- **Redundancy Detection**: Backend implemented, UI disabled (available for future use)
- **Lore Trigger Tester**: Backend implemented, UI disabled (available for future use)

### Incomplete Features
- **ComfyUI Emotion Generation**: Batch generation works but progress tracking is minimal

### Technical Limitations
- **No Rate Limiting**: LLM usage not tracked; could burn through API credits
- **Streaming Error Recovery**: Broken SSE streams not gracefully handled
- **Settings Validation**: No JSON schema validation on settings deserialization
- **No Multi-user Support**: Single-user application design
- **No Cloud Sync**: Local IndexedDB and SQLite only
- **Asset Size Limit**: Client-side assets capped at 50MB per file (IndexedDB constraint)

## Useful Context

### Character Card Use Case
Character cards are JSON documents that define AI chatbot personalities. They're used in applications like:
- SillyTavern
- Kobold AI
- Text Generation WebUI
- Oobabooga
- Voxta

Cards can be embedded in PNG images as metadata (tEXt chunks), making them shareable as images while carrying the full character definition.

### Why This Tool Exists
- Most character card editors are basic text editors
- Token counting is often inaccurate or missing
- No tools for detecting redundancy across fields
- Limited validation and linting
- No version control for iterative development
- Difficult to test how cards will behave in different frontends

Card Architect solves these problems with professional tooling for character card creation.

## References

- CCv2 Spec: https://github.com/malfoyslastname/character-card-spec-v2
- CCv3 Spec: https://github.com/kwaroran/character-card-spec-v3

## License

MIT License - See README.md for full text
