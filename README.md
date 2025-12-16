# Character Architect
![Gemini_Generated_Image_fe3wjzfe3wjzfe3w](https://github.com/user-attachments/assets/89cfe2fe-ca37-4502-a98a-619761839b70)

**Character Architect** is a modern, self-hostable character card editor for CCv2 and CCv3 formats. Built as a single-user application with always-saving drafts, version history, and accurate token estimation.

## Features

### Core Features

- **Full CCv2/CCv3 Support** - Read, edit, validate both specifications with proper wrapped/unwrapped format handling
- **CHARX Support** - Full support for CHARX v1.0 format (ZIP-based cards with embedded assets)
- **Voxta Support** - Import/Export `.voxpkg` files with full asset and metadata preservation
  - Multi-character packages imported as Collections with linked character cards
  - Single-character export or full collection re-export
- **Real-time Token Counting** - Per-field and global token estimates using Hugging Face tokenizers
- **Lorebook Editor** - Complete CCv3 character book with all fields (keywords, secondary, priority, selective AND/NOT, probability, constant, insertion order/position)
- **Standalone Lorebooks** - Create, import, and manage lorebooks independently from character cards
  - Import from SillyTavern, Agnai, RisuAI, and Wyvern formats
  - Filter dashboard by lorebook type
  - Import lorebooks directly into character cards
- **Always-Saving** - Autosave to IndexedDB with background sync to SQLite
- **Version History** - Manual snapshots with restore capability
- **Import/Export** - JSON, PNG (tEXt embed), CHARX, and Voxta support with automatic format normalization
- **SillyTavern Integration** - Direct push to SillyTavern with one click
- **Multiple Import** - Import multiple cards at once (JSON, PNG, CHARX, or Voxta)
- **Bulk Operations** - Select and delete multiple cards with toggle-able selection mode
- **Smart Sorting & Filtering** - Sort by Added/Newest/Oldest/Name, filter by tags/rating
- **Markdown Preview** - Sanitized HTML rendering with extended image sizing syntax
- **Asset Management** - Upload, crop, resize, and convert images with CHARX packaging
- **Schema Validation** - JSON schema + semantic linting with format-specific normalization
- **Theming** - Multiple color themes with custom background images and CSS
- **Self-Hostable** - Docker Compose for easy deployment

### AI-Powered Features

- **LLM Integration** - AI-powered field editing with multiple providers
  - Supports OpenAI, OpenAI-compatible APIs, and Anthropic (Claude)
  - Streaming responses with live diff viewer
  - Built-in presets: tighten, convert-structured, convert-prose, convert-hybrid, enforce-style, format-to-JED, format-to-JED+, generate-alts, generate-lore
  - User-defined presets with show/hide and copy functionality
  - Custom instructions for tailored editing
  - Preset import/export for sharing custom operations

- **RAG System** - Knowledge base integration with semantic search
  - **Vector embeddings** powered by FastEmbed (BAAI/bge-small-en-v1.5)
  - **File uploads**: PDF, JSON, Markdown, HTML, and plain text
  - **Free text entry**: Direct paste of notes, guidelines, documentation
  - **Lorebook import**: Import character lorebooks as searchable knowledge
  - **Semantic search**: Cosine similarity with 384-dimensional embeddings
  - **Multiple knowledge bases**: Tags, descriptions, document management
  - **Context injection**: Automatically provides relevant snippets to AI operations

- **Prompt Simulator** - Test how cards assemble in different frontends
- **Redundancy Detection** - Find duplicate content across fields
- **Lore Trigger Tester** - Test lorebook entry activation with AND/NOT logic

### Editing Tools

- **Focused Editor** - Distraction-free full-screen editing mode
- **Block Editor** - Visual block-based character card editing with drag-and-drop
  - Import existing card content into structured blocks
  - Parse markdown headings, lists, and text automatically
  - Target blocks to specific card fields
  - Save and load block templates
- **Template System** - Reusable templates for common card structures (JED, JED+, Anime Character)
- **Snippet Management** - Save and reuse text snippets with JED format sections
- **ELARA VOSS** - Name replacement tool with customizable name database
  - Replace placeholder character names throughout cards
  - Import/export custom name databases (JSON format)
  - Supports male, female, and neutral gender categories
- **Card Grid View** - Browse and manage multiple cards with sorting and bulk operations
- **Linked Image Archival** - Archive external images as local assets
  - Parses markdown `![](url)` and HTML `<img>` tags
  - Downloads and stores images locally with SillyTavern-compatible paths
  - Preserves original URLs for JSON/PNG export
  - Auto-snapshot backup before modifications

### Optional Modules

- **Web Import** - One-click character imports from browser
  - Browser userscript for Chub.ai, Wyvern, Character Tavern, Risu Realm
  - Automatic asset downloading (expressions, gallery images, voice samples)
  - Configurable image processing (WebP conversion, resizing)
- **wwwyzzerdd** - AI-powered character generation wizard
  - Generate complete characters from simple prompts
  - Customizable prompt sets for different styles
  - Automatic lorebook generation
- **SillyTavern Integration** - Direct push to SillyTavern with one click
- **ComfyUI Integration** - AI image generation for portraits and emotion sprites

## Quick Start

### Windows (Easy Install)

For Windows users who are new to development:

1. Download or clone this repository
2. Right-click `install-windows.bat` and select **"Run as administrator"**
3. Follow the prompts (this will install Node.js, build tools, and dependencies)
4. Once complete, double-click `start-dev.bat` to run Character Architect
5. Open http://localhost:5173 in your browser

The installer will set up:
- NVM for Windows (Node Version Manager)
- Node.js v22
- Visual Studio Build Tools (for native modules like better-sqlite3)
- All project dependencies

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/axAilotl/card-architect.git
cd card-architect

# Start with Docker Compose
docker compose up -d

# Access the application at http://localhost:8765
```

**Docker Architecture:**
- Uses **pnpm** with workspace monorepo structure
- Multi-stage build: builder stage compiles packages + apps, runtime stages copy built artifacts
- **nginx** serves the web app and proxies `/api`, `/storage`, `/user` to the internal API container
- API container runs as non-root `node` user (UID 1000) for security
- Default binding: `127.0.0.1:8765` (localhost only). For LAN access, change to `0.0.0.0:8765:80` in docker-compose.yml
- Persistent volumes: `./data` (SQLite database) and `./storage` (card assets)

To expose the API port directly (for debugging), uncomment the `ports` section in `docker-compose.yml`.

### Local Development

```bash
# Prerequisites: Node.js 20+, pnpm

# Install dependencies
pnpm install

# Start development servers
pnpm run dev

# API will run on http://localhost:3456
# Web UI will run on http://localhost:5173
```

## Deployment Modes

Character Architect supports three deployment modes, set via `VITE_DEPLOYMENT_MODE`:

| Mode | Use Case | Server Required | Best For |
|------|----------|-----------------|----------|
| `full` | Self-hosted | Yes (API + SQLite) | Local dev, home server, full features |
| `light` | Cheap VPS | Minimal | $5/mo VPS, most features client-side |
| `static` | Static hosting | No | Cloudflare Pages, GitHub Pages |

### Full Mode (Default)

All features enabled with full server backend:
- Server-side RAG with FastEmbed
- Server-side LLM proxy
- Web Import via userscript
- ComfyUI integration
- Sharp image optimization

```bash
# Docker or local dev - full mode auto-detected on localhost
docker-compose up -d
```

### Light Mode

Client-side processing with minimal server (just serves static files + SQLite):
- Client-side RAG (Transformers.js + WebGPU)
- Direct LLM calls (OpenRouter, Anthropic)
- Canvas API for image processing
- No ComfyUI, Web Import, or CHARX Optimizer

```bash
# Set mode in your build
VITE_DEPLOYMENT_MODE=light pnpm run build:web
```

### Static Mode

No server at all - pure client-side with IndexedDB:
- All data stored in browser
- No sync between devices
- Works on free static hosting

```bash
# Build for static deployment
VITE_DEPLOYMENT_MODE=static pnpm run build:web
# Deploy dist/ to Cloudflare Pages, GitHub Pages, etc.
```

### Feature Availability by Mode

| Feature | Full | Light | Static |
|---------|------|-------|--------|
| Card editing | ✓ | ✓ | ✓ |
| Token counting | ✓ | ✓ | ✓ |
| Import/Export | ✓ | ✓ | ✓ |
| LLM Assist | Server | Client | Client |
| RAG | Server | Client | Client |
| Web Import | ✓ | ✗ | ✗ |
| ComfyUI | ✓ | ✗ | ✗ |
| CHARX Optimizer | ✓ | ✗ | ✗ |
| SillyTavern Push | ✓ | ✓ | ✓ |
| Data Sync | SQLite | SQLite | IndexedDB only |

## Architecture

Character Architect is a monorepo with:

```
/apps/api              # Fastify backend (Node 20 + SQLite)
/apps/web              # React frontend (Vite + TypeScript + Tailwind)
/packages/defaults     # Shared default templates, snippets, and presets
/packages/plugins      # Plugin SDK (stub)
```

**External Dependencies:**
- `@character-foundry/character-foundry` - Bundled package with subpath imports:
  - `/schemas`, `/loader`, `/png`, `/charx`, `/voxta`, `/lorebook`, `/tokenizers`
  - `/app-framework`, `/federation`, `/normalizer`, `/core`
  - Includes all format handlers, token counting, and UI components
- `@character-foundry/image-utils` - SSRF protection and image URL extraction (local file: reference)
- `fflate` - Fast compression (ZIP/GZIP)
- `zod` - Runtime schema validation
- `gpt-tokenizer` - Token counting for LLMs

### Tech Stack

**Backend:**
- **Fastify** - Fast, low-overhead web framework
- **SQLite** (better-sqlite3) - Local database
- **Sharp** - Image processing
- **Ajv** - JSON schema validation

**Frontend:**
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **IndexedDB** (idb) - Local persistence
- **marked** - Markdown rendering

### Module System

Optional features are loaded as modules with auto-discovery using Vite's `import.meta.glob`:

```
/apps/web/src/modules/
├── block-editor/     # Visual block-based card builder
├── charx-optimizer/  # CHARX image optimization
├── comfyui/          # Image generation with ComfyUI
├── federation/       # Platform sync (SillyTavern, Archive, CardsHub)
├── sillytavern/      # SillyTavern push integration
├── webimport/        # Browser userscript integration
└── wwwyzzerdd/       # AI character wizard
```

**Adding a new module:**
1. Create `modules/{your-module}/index.ts`
2. Export `register{YourModule}Module()` function
3. That's it - auto-discovered on next build/refresh

Feature flags are derived from folder names: `comfyui` → `comfyuiEnabled`

## Usage

### Creating a New Card

1. Click **"New"** in the header
2. Fill in the basic fields (name, description, personality, scenario, first message)
3. Click **"Show"** under Advanced to add system prompts, alternate greetings, etc.
4. Add lorebook entries using the **"Add Entry"** button
5. Click **"Save"** to persist to the database

### Importing Cards

**Single Import:**
1. Click **"Import"** in the header
2. Select a JSON, PNG, CHARX, or VOXPKG file
3. The card will be validated and loaded into the editor
4. Make any edits and click **"Save"**

**Multiple Import:**
1. Click **"Import"** in the header
2. Select multiple files (JSON, PNG, CHARX, or VOXPKG)
3. All cards will be imported at once
4. See import summary showing success/failure count

**Importing Lorebooks:**
1. Click **"Import"** or drag-and-drop a lorebook file
2. Supported formats: SillyTavern World Info, Agnai, RisuAI, Wyvern
3. Lorebooks are imported as standalone cards (spec: `lorebook`)
4. Filter by "Lorebooks" in the dashboard to find them
5. Import a lorebook into a character via the Lorebook Editor's "Import Lorebook" button

### Exporting Cards

**From Editor:**
1. Load a card
2. Click **"Export"** dropdown
3. Choose **JSON**, **PNG**, **CHARX**, or **Voxta**
4. File will download automatically

### Using AI Features

#### Setting Up LLM Providers

1. Click the **Settings** icon in the header
2. Go to the **LLM** tab
3. Click **"Add Provider"**
4. Configure your provider:
   - **Label**: Friendly name (e.g., "My GPT-4")
   - **Type**: `openai`, `openai-compatible`, or `anthropic`
   - **Model**: Model name (e.g., `gpt-4`, `claude-3-5-sonnet-20241022`)
   - **API Key**: Your API key from the provider
   - **Base URL**: Optional custom endpoint for proxies
5. Click **"Test"** to verify the connection

#### Using AI Assist

1. Open any field editor
2. Click the **AI** button to open the LLM Assist sidebar
3. Select a configured provider
4. Choose an operation:
   - **Built-in Presets**: tighten, convert-structured, convert-prose, enforce-style, format-to-JED, etc.
   - **User Presets**: Your custom saved operations
   - **Custom Instruction**: Write your own editing instruction
5. (Optional) Enable **RAG** and select a knowledge base for additional context
6. Click **Run** - See results stream in with live diff viewer
7. **Apply** changes by choosing Replace or Append

#### Managing AI Presets

1. Open **Settings** → **LLM Presets** tab
2. **Copy** any preset (including built-in) to create an editable version
3. **Show/Hide** presets using the checkbox
4. **Import/Export** presets as JSON files

### Templates & Snippets

1. In the Focused Editor, access the **Templates/Snippets** panel
2. **Templates**: Apply multi-field templates (JED, JED+, Anime Character)
3. **Snippets**: Insert reusable text blocks (JED sections, formatting rules)
4. **Import/Export**: Share templates and snippets as JSON files

## Configuration

### Environment Variables (API)

Create `apps/api/.env`:

```env
PORT=3456
HOST=0.0.0.0
DATABASE_PATH=./data/cards.db
STORAGE_PATH=./storage

# Size limits (generous defaults for large Voxta packages)
# MAX_CARD_SIZE_MB=300
# MAX_PNG_SIZE_MB=300
# ZIP_MAX_UNCOMPRESSED_SIZE_MB=500
# ZIP_MAX_FILE_SIZE_MB=50
```

## API Reference

### Cards
```
GET    /api/cards                     # List all cards
GET    /api/cards/:id                 # Get single card
POST   /api/cards                     # Create card
PATCH  /api/cards/:id                 # Update card
DELETE /api/cards/:id                 # Delete card
GET    /api/cards/:id/export?format=  # Export (json|png|charx|voxta)
```

### Versions
```
GET    /api/cards/:id/versions                    # List versions
POST   /api/cards/:id/versions                    # Create snapshot
POST   /api/cards/:id/versions/:ver/restore       # Restore version
DELETE /api/cards/:id/versions/:ver               # Delete version
```

### Templates & Snippets
```
GET    /api/templates                  # List templates
POST   /api/templates                  # Create template
PATCH  /api/templates/:id              # Update template
DELETE /api/templates/:id              # Delete template
GET    /api/templates/export/all       # Export all templates
POST   /api/templates/import           # Import templates
POST   /api/templates/reset            # Reset to defaults

GET    /api/snippets                   # List snippets
POST   /api/snippets                   # Create snippet
PATCH  /api/snippets/:id               # Update snippet
DELETE /api/snippets/:id               # Delete snippet
GET    /api/snippets/export/all        # Export all snippets
POST   /api/snippets/import            # Import snippets
POST   /api/snippets/reset             # Reset to defaults
```

### LLM & Presets
```
POST   /api/llm/invoke                 # Direct LLM invocation
POST   /api/llm/assist                 # AI assist with presets
GET    /api/presets                    # List all presets
POST   /api/presets                    # Create preset
PATCH  /api/presets/:id                # Update preset
DELETE /api/presets/:id                # Delete preset
POST   /api/presets/:id/copy           # Copy preset
POST   /api/presets/:id/toggle-hidden  # Toggle visibility
GET    /api/presets/export/all         # Export presets
POST   /api/presets/import             # Import presets
```

### RAG (Knowledge Bases)
```
GET    /api/rag/databases              # List knowledge bases
POST   /api/rag/databases              # Create database
GET    /api/rag/databases/:id          # Get database details
DELETE /api/rag/databases/:id          # Delete database
POST   /api/rag/databases/:id/documents    # Upload document
POST   /api/rag/databases/:id/text         # Add free text
POST   /api/rag/databases/:id/lorebook     # Import lorebook
GET    /api/rag/search                 # Semantic search
```

### Web Import
```
GET    /api/web-import/sites           # List supported sites
GET    /api/web-import/settings        # Get import settings
PATCH  /api/web-import/settings        # Update import settings
GET    /api/web-import/userscript      # Download userscript
POST   /api/web-import                 # Import card from URL
```

## License

**MIT License**

Copyright (c) 2024 Character Architect Contributors

## Acknowledgments

- **CCv2 Spec:** https://github.com/malfoyslastname/character-card-spec-v2
- **CCv3 Spec:** https://github.com/kwaroran/character-card-spec-v3

## Support

For bug reports, feature requests, or questions, please open an issue on GitHub.

---

**Character Architect** - Professional character card editor with AI-powered tools, self-hosted, open source
