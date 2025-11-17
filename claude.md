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
- **Tailwind CSS** - Utility-first styling (custom dark theme)
- **Zustand** - Lightweight state management
- **IndexedDB** (idb) - Local persistence with background sync
- **Milkdown** - WYSIWYG markdown editor
- **CodeMirror** - Raw markdown editing
- **marked** - Markdown to HTML rendering
- **DOMPurify** - HTML sanitization for security

**Testing:**
- **Vitest** - Test framework

## Architecture

### Monorepo Structure

```
card_doctor/
├── apps/
│   ├── api/                 # Fastify backend (Node 20 + SQLite)
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── providers/   # LLM provider integrations
│   │   │   ├── db/          # Database & repository
│   │   │   ├── utils/       # Utilities (PNG, prompts, RAG, settings)
│   │   │   └── __tests__/   # Vitest tests
│   │   └── package.json
│   └── web/                 # React frontend (Vite + TypeScript + Tailwind)
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── store/       # Zustand state
│       │   ├── lib/         # API client, IndexedDB
│       │   └── styles/      # CSS
│       └── package.json
└── packages/
    ├── schemas/             # Shared types & validation
    ├── tokenizers/          # Token counting
    ├── charx/              # CHARX support (stub)
    └── plugins/            # Plugin SDK (stub)
```

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
- **Built-in Preset Operations** (8 total):
  - Tighten (reduce wordiness)
  - Convert-structured / convert-prose
  - Enforce-style
  - Generate-alts (alternate greetings)
  - Generate-lore (lorebook entries)
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
- **Snapshot button** integrated into editor tabs row (EditorTabs.tsx)

### 8. Import/Export
- **Import**: JSON or PNG character cards
  - Automatic normalization of non-standard spec values
  - Handles legacy numeric position fields
  - Compatible with: CharacterHub, SillyTavern, Agnai, TavernAI
  - PNG tEXt chunk extraction with multiple key support
- **Export**:
  - JSON (spec-specific based on current mode)
  - PNG (embedded metadata in tEXt chunks)
- **Click-based dropdown** (not hover)

### 9. Character Avatar
- **Upload/replace** character images
- **Preview** in Basic Info tab (192x192px)
- **Automatic PNG conversion**
- **Stored** in database as BLOB

### 10. Card Management
- **Grid view** with visual indicators:
  - Purple badge (💬) for alternate greetings
  - Green badge (📚) for lorebook entries
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
- **Redundancy Killer**: Cross-field duplicate detection
  - Detects: exact duplicates, semantic overlap, repeated phrases
  - Shows token savings and confidence scores
  - Status: Implemented but UI disabled (available for future use)
- **Lore Trigger Tester**: Test lorebook entry activation
  - Supports: AND/NOT logic, regex patterns, case sensitivity
  - Real-time phrase testing with preview
  - Status: Implemented but UI disabled (available for future use)

## API Endpoints

**Base URL (dev):** `http://localhost:3456`

### Cards
```
GET    /api/cards                     # List all cards
GET    /api/cards/:id                 # Get single card
POST   /api/cards                     # Create card
PATCH  /api/cards/:id                 # Update card
DELETE /api/cards/:id                 # Delete card
GET    /api/cards/:id/image           # Get card image
POST   /api/cards/:id/image           # Update card image
GET    /api/cards/:id/export          # Export card (json|png)
```

### Versions
```
GET    /api/cards/:id/versions        # List versions
POST   /api/cards/:id/versions        # Create snapshot
POST   /api/cards/:id/versions/:versionId/restore  # Restore version
```

### Import/Export & Tokenization
```
POST   /api/import                    # Import JSON/PNG
POST   /api/convert                   # Convert v2 ↔ v3
GET    /api/tokenizers                # List available tokenizer models
POST   /api/tokenize                  # Tokenize fields
```

### Assets
```
POST   /api/assets                    # Upload image
GET    /api/assets/:id                # Get asset
POST   /api/assets/:id/transform      # Crop/resize/convert
```

### LLM Integration
```
GET    /api/llm/settings              # Get LLM settings (API keys redacted)
POST   /api/llm/settings              # Update LLM settings
POST   /api/llm/test-connection       # Test provider connection
POST   /api/llm/invoke                # Direct LLM invocation (streaming/non-streaming)
POST   /api/llm/assist                # High-level AI assist with presets
```

### Presets
```
GET    /api/presets                   # List all presets (built-in + user)
GET    /api/presets/:id               # Get single preset
POST   /api/presets                   # Create user preset
PATCH  /api/presets/:id               # Update user preset
DELETE /api/presets/:id               # Delete user preset (built-in protected)
GET    /api/presets/export/all        # Export all presets as JSON
POST   /api/presets/import            # Import presets from JSON
```

### RAG (Knowledge Bases)
```
GET    /api/rag/databases             # List RAG knowledge bases
POST   /api/rag/databases             # Create RAG database
GET    /api/rag/databases/:dbId       # Get database details
PATCH  /api/rag/databases/:dbId       # Update database metadata
DELETE /api/rag/databases/:dbId       # Delete database
POST   /api/rag/databases/:dbId/documents      # Upload & index document (file)
POST   /api/rag/databases/:dbId/text           # Add free text entry
POST   /api/rag/databases/:dbId/lorebook       # Import lorebook as knowledge
DELETE /api/rag/databases/:dbId/documents/:sourceId  # Remove document
GET    /api/rag/search                # Search RAG database (semantic)
GET    /api/rag/stats                 # Get RAG statistics
```

### Tools & Utilities
```
POST   /api/prompt-simulator/simulate # Simulate prompt assembly
POST   /api/redundancy/analyze        # Find cross-field redundancy
POST   /api/lore-trigger/test         # Test lorebook triggers
```

## Database Schema

### Cards Table
```sql
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spec TEXT NOT NULL,        -- 'v2' or 'v3'
  data TEXT NOT NULL,        -- JSON
  tags TEXT,                 -- JSON array
  original_image BLOB,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Versions Table
```sql
CREATE TABLE card_versions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  data TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id)
);
```

### LLM Presets Table
```sql
CREATE TABLE llm_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  instruction TEXT NOT NULL,
  category TEXT NOT NULL,      -- 'rewrite', 'format', 'generate', 'custom'
  is_built_in INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Built-in Presets** (seeded on first run):
- `tighten` - Rewrite text to be more concise
- `convert-structured` - Convert prose to structured bullet points
- `convert-prose` - Convert structured text to flowing prose
- `enforce-style` - Make text match a specific style guide
- `generate-alts` - Generate alternate greetings
- `generate-lore` - Generate lorebook entries
- `expand` - Expand and elaborate on text
- `simplify` - Simplify complex language

**Protection:** Built-in presets have `is_built_in = 1` and return 403 errors on modification/deletion attempts.

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

## File Locations Reference

### Key Frontend Components (apps/web/src/components/)
- `App.tsx` - Main application container
- `Header.tsx` - Top navigation bar
- `CardGrid.tsx` - Card list view with bulk operations
- `CardEditor.tsx` - Main editor container
- `EditorTabs.tsx` - Tab navigation + snapshot button
- `EditPanel.tsx` - Standard edit mode with V2/V3 switcher
- `FocusedEditor.tsx` - Focused mode with Milkdown + CodeMirror
- `PreviewPanel.tsx` - Markdown preview with extended syntax
- `DiffPanel.tsx` - Version history and diff view
- `DiffViewer.tsx` - Live diff visualization component
- `LorebookEditor.tsx` - Lorebook management (two-column)
- `FieldEditor.tsx` - Reusable field component
- `LLMAssistSidebar.tsx` - AI assistant with streaming
- `TemplateSnippetPanel.tsx` - Templates/snippets management
- `SettingsModal.tsx` - Settings UI (Providers + RAG)
- `PromptSimulatorPanel.tsx` - Prompt simulation UI
- `RedundancyPanel.tsx` - Redundancy detection UI (disabled)
- `LoreTriggerPanel.tsx` - Lore trigger testing UI (disabled)

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
- `prompt-simulator.ts` - Prompt assembly simulation routes
- `redundancy.ts` - Redundancy detection routes
- `lore-trigger.ts` - Lore trigger testing routes

**Services (apps/api/src/services/):**
- `prompt-simulator.ts` - Prompt assembly simulation logic
- `redundancy-killer.ts` - Cross-field duplicate detection
- `lore-trigger-tester.ts` - Lorebook trigger testing

**Utilities (apps/api/src/utils/):**
- `settings.ts` - Secure settings storage and retrieval
- `rag-store.ts` - File-based RAG vector storage
- `llm-prompts.ts` - LLM prompt construction and presets
- `tokenizer.ts` - Token counting utilities
- `diff.ts` - Text diff computation
- `png.ts` - PNG tEXt chunk extraction and embedding

**Database (apps/api/src/db/):**
- `repository.ts` - Database operations (cards, versions, presets)

**Providers (apps/api/src/providers/):**
- `openai.ts` - OpenAI Responses API and Chat Completions API
- `anthropic.ts` - Anthropic Messages API (Claude)

### Shared Packages
- `packages/schemas/src/types.ts` - TypeScript types
- `packages/schemas/src/schemas.ts` - JSON schemas (CCv2/CCv3)
- `packages/schemas/src/validator.ts` - Validation logic
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

## Recent Implementation Details

### V2/V3 Mode Switcher
- Location: `apps/web/src/components/EditPanel.tsx:151-172`
- State: `apps/web/src/store/card-store.ts:25-26, 336-381`
- Features:
  - Toggle buttons in editor tab header
  - Automatic data conversion on switch
  - Field visibility control
  - Spec markers on all fields

### Bulk Selection (Card Grid)
- Added: Bulk select and delete functionality
- UI: Toggle button to show/hide bulk selection interface
- Prevents UI clutter when not in use

### Snapshot Button Repositioning
- Moved from floating (`App.tsx`) to tabs row (`EditorTabs.tsx`)
- Right-aligned in tab navigation
- Popup positioned below button
- No longer blocks other UI elements

### Export Dropdown Fix
- Changed from hover-based to click-based
- State management for menu visibility
- Click-outside-to-close functionality
- Auto-close on option selection

### Template Button Additions
- Added to: system_prompt, post_history_instructions, creator_notes
- Updated FocusField type in schemas
- Template panel supports all major text fields

### New Card Button Fix
- Made `createNewCard()` async
- Immediately saves to API to get real ID
- Prevents navigation to cards with empty IDs

### PNG Import Normalization
- Automatic normalization of non-standard spec values
- Handles legacy numeric position fields in lorebook entries
- Missing extensions fields auto-added
- Null character_book values handled
- Location: `apps/api/src/routes/import-export.ts`

### Enhanced Markdown Preview
- Custom marked extension for image sizing
- Supports: `![alt](url =widthxheight)`
- Examples: `=100%x100%`, `=400x300`, `=50%`
- Also supports angled brackets: `![alt](<url> =100%x100%)`
- Location: `apps/web/src/components/PreviewPanel.tsx`

### PNG Export SillyTavern Compatibility (2025-11-17)
- **Fixed metadata encoding**: PNG exports now use base64 encoding for JSON data (SillyTavern standard)
- **Fixed tEXt chunk key**: Uses 'chara' key for both V2 and V3 cards (universal compatibility)
- **Previous issue**: Was using plain JSON and 'ccv3' key, causing import failures in SillyTavern
- **Location**: `apps/api/src/utils/png.ts:308-318` (embedIntoPNG function)

### Card Grid Creator Display (2025-11-17)
- **Feature**: Creator name now displays under card title in grid view
- **Format**: "by {creator name}" in muted text
- **Implementation**: Uses `extractCardData()` helper to read creator from card data structure
  - V3 cards: `data.data.creator`
  - V2 cards: `data.creator`
- **Location**: `apps/web/src/components/CardGrid.tsx:214-217, 484-488`

### Tag Import/Export Support (2025-11-17)
- **Import**: Tags now properly extracted from card data during import
  - V3 format: `data.data.tags`
  - Wrapped V2: `data.data.tags`
  - Unwrapped V2: `tags` (top-level)
- **Export**: Card name sync - `data.name` automatically syncs to `meta.name` on updates
- **Locations**:
  - Import: `apps/api/src/routes/import-export.ts:364-385, 564-580`
  - Export: `apps/api/src/routes/cards.ts:144-168`
  - UI: `apps/web/src/components/EditPanel.tsx:101-121`

### Multiple File Import Fix (2025-11-17)
- **Issue**: Multiple file import was hanging/stuck pending
- **Root cause**: Two-pass processing (collect files, then process) caused Fastify multipart async iterator deadlock
- **Fix**: Changed to single-pass processing - files consumed during iteration with `for await (const file of request.files())`
- **Location**: `apps/api/src/routes/import-export.ts:518-595`

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

**Test Coverage:**
- Card CRUD operations
- V2 and V3 validation
- Import/Export (JSON, PNG)
- Tokenization
- Lorebook validation
- Alternate greetings

**Test Files:**
- `apps/api/src/__tests__/api-endpoints.test.ts` - API integration tests
- `apps/api/src/__tests__/card-validation.test.ts` - Schema validation tests

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

### Documentation
- `README.md` - User-facing documentation
- `IMPLEMENTATION_STATUS.md` - Feature status and roadmap (DELETED in current branch)
- `LLM_ASSIST_V2_DOCUMENTATION.md` - LLM integration docs (DELETED in current branch)
- `CCV3.md` - CCv3 specification notes (DELETED in current branch)
- `CHARX_CARDS.md` - CHARX format notes (DELETED in current branch)
- `CCv3_ASSETS_CHARX_IMPLEMENTATION_PLAN.md` - Implementation plan (DELETED in current branch)
- `CONTRIBUTING.md` - Contribution guidelines

## Character Card Formats

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

## Common Tasks

### Adding a New API Endpoint
1. Create service in `apps/api/src/services/` (if needed)
2. Create route in `apps/api/src/routes/`
3. Register route in `apps/api/src/index.ts`
4. Update TypeScript types in `packages/schemas/` if needed

### Adding a New Frontend Component
1. Create component in `apps/web/src/components/`
2. Import and use in parent component
3. Connect to Zustand store if state is needed
4. Add API calls using fetch with proper error handling

### Adding a New Validation Rule
1. Update schema in `packages/schemas/src/schemas.ts`
2. Add validation logic in `apps/api/src/services/validation.service.ts`
3. Update frontend to display new validation messages

### Adding a New Built-in LLM Preset
1. Add to seed data in `apps/api/src/db/repository.ts` (`seedBuiltInPresets()`)
2. Add prompt template in `apps/api/src/utils/llm-prompts.ts` (`buildPrompt()`)
3. Update `PresetsTab.tsx` if UI changes needed
4. Update documentation

### Creating a User-Defined Preset (via UI)
1. Open Settings → Presets tab
2. Click "Add Preset"
3. Fill in name, description, instruction, category
4. Save - preset is stored in database and immediately available
5. Export/import via JSON for sharing

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

**Location:** `apps/web/src/components/PreviewPanel.tsx` (imageSizeExtension)

### Card Format Compatibility

The system is compatible with cards exported from:
- **CharacterHub**: Wrapped v2/v3 formats with various spec values
- **SillyTavern**: Legacy formats with numeric position fields
- **Agnai**: Standard wrapped formats
- **TavernAI**: Legacy unwrapped v2 format
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

## Known Limitations

### Features Disabled in UI
- **Redundancy Detection**: Backend implemented, UI disabled (available for future use)
- **Lore Trigger Tester**: Backend implemented, UI disabled (available for future use)

### Technical Limitations
- **No Rate Limiting**: LLM usage not tracked; could burn through API credits
- **Streaming Error Recovery**: Broken SSE streams not gracefully handled
- **Settings Validation**: No JSON schema validation on settings deserialization
- **No Multi-user Support**: Single-user application design
- **No Cloud Sync**: Local IndexedDB and SQLite only

## Future Considerations

### Planned Features
- User-defined LLM presets (save custom operations) - IN PROGRESS
- Rate limiting and quota management for LLM usage
- Style Guard (format enforcement)
- Alt-Greeting Workbench (variant generation)
- Enhanced version timeline with field-aware diff
- PNG export verifier (import works, export needs completion)
- Command Palette (Ctrl/Cmd+K)
- Keyboard-first editing
- Health checks and backup system

### UI Improvements
- Re-enable redundancy detection panel
- Re-enable lore trigger tester panel
- Mobile responsive improvements
- Batch operations on multiple cards
- Collaboration features
- Cloud storage integration

## Useful Context

### Character Card Use Case
Character cards are JSON documents that define AI chatbot personalities. They're used in applications like:
- SillyTavern
- Kobold AI
- Text Generation WebUI
- Oobabooga

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

## Recent Implementation: User-Defined LLM Presets (2025-11-16)

### Overview
Implemented a database-backed system for user-defined LLM presets, allowing users to create, save, and manage custom AI operations alongside the 8 built-in presets.

**Database Schema:**
- New table: `llm_presets` with fields for name, description, instruction, category, is_built_in flag
- Auto-seeding of 8 built-in presets on first database initialization
- Unique constraint on preset names

**Backend Implementation:**
- **Repository Layer** (`apps/api/src/db/repository.ts`):
  - `PresetRepository` class with full CRUD operations
  - `seedBuiltInPresets()` for automatic initialization
  - Protection methods to prevent modification of built-in presets

- **API Routes** (`apps/api/src/routes/presets.ts`):
  - `GET /api/presets` - List all presets (built-in + user)
  - `GET /api/presets/:id` - Get single preset
  - `POST /api/presets` - Create user preset
  - `PATCH /api/presets/:id` - Update user preset (403 if built-in)
  - `DELETE /api/presets/:id` - Delete user preset (403 if built-in)
  - `GET /api/presets/export/all` - Export all presets as JSON
  - `POST /api/presets/import` - Import presets with validation

- **Types** (`packages/schemas/src/types.ts`):
  - `UserPreset` - Preset data structure
  - `CreatePresetRequest` - Validation for preset creation
  - `PresetCategory` - Type-safe categories (rewrite, format, generate, custom)

**Frontend Implementation:**
- **API Client** (`apps/web/src/lib/api.ts`):
  - Methods for all preset CRUD operations
  - Import/export helpers with blob handling

- **Settings UI** (`apps/web/src/components/SettingsModal.tsx`):
  - New "Presets" tab for preset management
  - Create, edit, delete presets with form validation
  - Import/export functionality with file handling
  - Protection UI: built-in presets show as read-only

- **LLM Assist Sidebar** (`apps/web/src/components/LLMAssistSidebar.tsx`):
  - Dynamic preset loading from database
  - Presets grouped by category
  - User presets appear alongside built-in presets

**Built-in Presets:**
1. tighten (rewrite) - Reduce wordiness
2. convert-structured (format) - Prose to bullet points
3. convert-prose (format) - Structured to prose
4. enforce-style (rewrite) - Apply style guide
5. generate-alts (generate) - Create alternate greetings
6. generate-lore (generate) - Create lorebook entries
7. expand (rewrite) - Elaborate on content
8. simplify (rewrite) - Simplify language

**Protection Pattern:**
- Built-in presets have `is_built_in = 1` flag
- Modification attempts return 403 Forbidden
- Deletion attempts return 403 Forbidden
- Frontend UI disables edit/delete buttons for built-in presets

**Import/Export:**
- Export format: JSON array of `CreatePresetRequest` objects
- Import validates all presets before creating any
- Returns detailed success/failure report with error messages
- Filename format: `card-architect-presets-YYYY-MM-DD.json`

## Recent Implementation: RAG System Enhancement (2025-11-17)

### Vector Embeddings with FastEmbed
Upgraded RAG system from keyword matching to semantic search using vector embeddings:

**Technology:**
- **FastEmbed**: Lightweight embedding library for Node.js
- **Model**: BAAI/bge-small-en-v1.5 (384-dimensional embeddings)
- **Performance**: Quantized weights, ONNX Runtime, outperforms OpenAI Ada-002
- **Search**: Cosine similarity-based semantic search

**New Capabilities:**
1. **Free Text Entry** (`POST /api/rag/databases/:dbId/text`)
   - Direct text input without file upload
   - Perfect for notes, documentation snippets, guidelines
   - Auto-chunked and embedded

2. **Lorebook Import** (`POST /api/rag/databases/:dbId/lorebook`)
   - Import character lorebooks as searchable knowledge
   - Structured extraction: keywords + content
   - Enables cross-character lore search

**Implementation Files:**
- `apps/api/src/utils/embedding.ts` - FastEmbed wrapper
- `apps/api/src/utils/rag-store.ts` - Enhanced with embeddings
- `apps/api/src/routes/rag.ts` - New endpoints
- `packages/schemas/src/types.ts` - Updated types ('freetext', 'lorebook')

**Search Improvements:**
- Semantic understanding vs. exact keyword matching
- Better context retrieval for LLM operations
- More relevant results even with different phrasing

## Recent Code Review Findings (2025-11-16)

### Build Status
✅ **All TypeScript compilation errors fixed** - Build passes successfully across all workspaces

### Issues Fixed
1. **Missing `group_only_greetings` property** - Added to V3 test fixtures and import handlers
2. **Type casting issues** - Fixed unsafe casts in import-export.ts using proper type guards
3. **Unused variables** - Cleaned up 18+ unused parameter warnings across the codebase
4. **Type mismatches in lore-trigger-tester.ts** - Fixed scan_depth V2-only field access and type assertions
5. **Unused imports in frontend** - Removed unused type imports from 5+ React components
6. **FocusedEditor type issues** - Created LocalFocusField type to handle alternate_greetings properly

### Codebase Health
- **Total TypeScript files**: 7,962 files
- **All routes registered**: cards, tokenize, import-export, assets, llm, rag, prompt-simulator, redundancy, lore-trigger
- **All components present**: 23 React components verified
- **All services present**: 4 backend services verified
- **All providers present**: OpenAI, Anthropic

### Documentation Status
- ✅ **claude.md** - Complete unified documentation (merged from @claude.md)
- ✅ **README.md** - User-facing documentation (up to date)
- ✅ **CONTRIBUTING.md** - Contribution guidelines
- ⚠️ **DELETED FILES** (on feature/ccv3-assets-charx branch):
  - IMPLEMENTATION_STATUS.md
  - LLM_ASSIST_V2_DOCUMENTATION.md
  - CCV3.md
  - CHARX_CARDS.md
  - CCv3_ASSETS_CHARX_IMPLEMENTATION_PLAN.md

## License

MIT License - See README.md for full text
