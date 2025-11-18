# Card Architect

**Card Architect** is a modern, self-hostable character card editor for CCv2 and CCv3 formats. Built as a single-user application with always-saving drafts, version history, and accurate token estimation.

## Features

### Core Features

- ✅ **Full CCv2/CCv3 Support** - Read, edit, validate both specifications with proper wrapped/unwrapped format handling
- ✅ **CHARX Support** - Full support for CHARX v1.0 format (ZIP-based cards with embedded assets)
- ✅ **Real-time Token Counting** - Per-field and global token estimates using Hugging Face tokenizers
- ✅ **Lorebook Editor** - Complete CCv3 character book with all fields (keywords, secondary, priority, selective AND/NOT, probability, constant, insertion order/position)
- ✅ **Always-Saving** - Autosave to IndexedDB with background sync to SQLite
- ✅ **Version History** - Manual snapshots with restore capability
- ✅ **Import/Export** - JSON, PNG (tEXt embed), and CHARX support with automatic format normalization
- ✅ **Multiple Import** - Import multiple cards at once (JSON, PNG, or CHARX)
- ✅ **Bulk Operations** - Select and delete multiple cards with toggle-able selection mode
- ✅ **Smart Sorting** - Sort cards by Added, Newest, Oldest, or Name
- ✅ **Markdown Preview** - Sanitized HTML rendering with extended image sizing syntax
- ✅ **Asset Management** - Upload, crop, resize, and convert images with CHARX packaging
- ✅ **Schema Validation** - JSON schema + semantic linting with format-specific normalization
- ✅ **Dark Mode** - Modern, accessible UI
- ✅ **Self-Hostable** - Docker Compose or standalone container

### AI-Powered Features

- ✅ **LLM Integration** - AI-powered field editing with multiple providers
  - Supports OpenAI (GPT-4, GPT-3.5) and Anthropic (Claude)
  - Streaming responses with live diff viewer
  - Built-in presets: tighten, convert-structured, convert-prose, enforce-style, generate-alts, generate-lore
  - User-defined presets: Create, save, and manage custom AI operations
  - Custom instructions for tailored editing
  - Preset import/export for sharing custom operations
  - Secure API key storage with automatic redaction

- ✅ **RAG System** - Knowledge base integration with semantic search
  - **Vector embeddings** powered by FastEmbed (BAAI/bge-small-en-v1.5)
  - **File uploads**: PDF, JSON, Markdown, HTML, and plain text
  - **Free text entry**: Direct paste of notes, guidelines, documentation
  - **Lorebook import**: Import character lorebooks as searchable knowledge
  - **Semantic search**: Cosine similarity with 384-dimensional embeddings
  - **Intelligent chunking**: 1200 char chunks with 200 char overlap
  - **Multiple knowledge bases**: Tags, descriptions, document management
  - **Context injection**: Automatically provides relevant snippets to AI operations

- ✅ **Prompt Simulator** - Test how cards assemble in different frontends
  - Profiles: Generic CCv3, Strict CCv3, CCv2-compat
  - Token budget tracking with drop policies

- ✅ **Redundancy Detection** - Find duplicate content across fields
  - Detects exact duplicates, semantic overlap, repeated phrases
  - Shows token savings and confidence scores

- ✅ **Lore Trigger Tester** - Test lorebook entry activation
  - Supports AND/NOT logic, regex patterns, case sensitivity
  - Real-time phrase testing with preview

### Editing Tools

- ✅ **Focused Editor** - Distraction-free full-screen editing mode
- ✅ **Template System** - Reusable templates for common card structures
- ✅ **Snippet Management** - Save and reuse text snippets
- ✅ **Card Grid View** - Browse and manage multiple cards with sorting and bulk operations

### Recent Updates

- ✅ **Searchable Model Selector** (v1.2) - Filterable dropdown with model caching and alphabetical sorting
- ✅ **Card Thumbnails** (v1.2) - Efficient 96x96 avatar thumbnails with top-centered cropping
- ✅ **Enhanced UI** (v1.2) - Improved textarea heights, streamlined LLM sidebar, collapsible custom instructions
- ✅ **RAG Vector Embeddings** (v1.1) - Semantic search with FastEmbed
- ✅ **Free Text Entry** (v1.1) - Direct paste into knowledge bases
- ✅ **Lorebook Import** (v1.1) - Import lorebooks as searchable knowledge
- ✅ **User-Defined Presets** (v1.1) - Create custom AI operations

### Roadmap

- 🔜 **Voxta Export** - Export to Voxta format (v1.2)
- 🔜 **Rate Limiting** - Quota management for LLM usage (v1.2)
- 🔜 **Batch Tools** - Normalize, lint, migrate multiple cards (v1.3)
- 🔜 **Plugin System** - Extensible architecture for custom tools (v2.0)

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/card-architect.git
cd card-architect

# Start with Docker Compose
docker-compose up -d

# Access the application
# Web UI: http://localhost:8765
# API: http://localhost:3456
```

### Standalone Container

```bash
# Build standalone image
docker build -f docker/standalone.Dockerfile -t card-architect .

# Run
docker run -p 3456:3456 -p 8765:8765 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/storage:/app/storage \
  card-architect

# Access at http://localhost:8765
```

### Local Development

```bash
# Prerequisites: Node.js 20+, npm 10+

# Install dependencies
npm install

# Start development servers
npm run dev

# API will run on http://localhost:3456
# Web UI will run on http://localhost:5173
```

## Architecture

Card Architect is a monorepo with:

```
/apps/api              # Fastify backend (Node 20 + SQLite)
/apps/web              # React frontend (Vite + TypeScript + Tailwind)
/packages/schemas      # Shared TypeScript types + JSON schemas
/packages/tokenizers   # HF tokenizer adapters
/packages/charx        # CHARX support (stub)
/packages/plugins      # Plugin SDK (stub)
```

### Tech Stack

**Backend:**
- **Fastify** - Fast, low-overhead web framework
- **SQLite** (better-sqlite3) - Local database
- **Sharp** - Image processing
- **pngjs** - PNG tEXt chunk handling
- **Ajv** - JSON schema validation

**Frontend:**
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **IndexedDB** (idb) - Local persistence
- **marked** - Markdown rendering
- **DOMPurify** - HTML sanitization

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
2. Select a JSON, PNG, or CHARX file
3. The card will be validated and loaded into the editor
4. Make any edits and click **"Save"**

**Multiple Import:**
1. Click **"Import"** in the header
2. Select multiple files (JSON, PNG, or CHARX)
3. All cards will be imported at once
4. See import summary showing success/failure count
5. Failed imports are logged to console with details

### Exporting Cards

**From Editor:**
1. Load a card
2. Click **"Export"** dropdown
3. Choose **JSON** (pretty-printed), **PNG** (embedded in image), or **CHARX** (with assets)
4. File will download automatically

**From Grid:**
1. Click a card to select it
2. Use the export buttons (JSON/PNG) in the card footer
3. For CHARX export, open the card editor first

### Managing Multiple Cards

**Sorting:**
1. In the card grid, use the **"Sort by"** dropdown
2. Options: Added (most recent), Newest, Oldest, Name (A-Z)

**Bulk Operations:**
1. Click **"Select"** to enter selection mode
2. Click cards or use **"Select All"** to select multiple
3. Click **"Delete Selected"** to delete chosen cards
4. Click **"Cancel Selection"** to exit selection mode

### Token Counting

- Token counts appear as blue chips next to each field
- Total token count is displayed in the header
- Uses approximate BPE/SentencePiece tokenizers (GPT-2-like and LLaMA-like presets)
- Real exact tokenizers (tiktoken, llama.cpp) can be added via plugins later

### Version History

1. Go to the **"Diff"** tab
2. Click **"Create Snapshot"** to save a version
3. Add an optional message
4. View all snapshots with timestamps
5. Click **"Restore"** to revert to a previous version

### Lorebook Editing

The lorebook editor supports all CCv3 entry fields:

- **Keywords** - Primary trigger words (comma-separated)
- **Secondary Keywords** - For selective matching
- **Content** - The lorebook entry text
- **Priority** - Insertion priority (higher = inserted first)
- **Insertion Order** - Order among same-priority entries
- **Position** - Before or after character definition
- **Probability** - 0-100% chance of insertion
- **Selective Logic** - AND (all match) or NOT (none match)
- **Constant** - Always insert
- **Case Sensitive** - Match keywords with exact case

### Using AI Features

#### Setting Up LLM Providers

1. Click the **⚙️ Settings** icon in the header
2. Go to the **Providers** tab
3. Click **"Add Provider"**
4. Configure your provider:
   - **Label**: Friendly name (e.g., "My GPT-4")
   - **Type**: `openai` or `anthropic`
   - **Model**: Model name (e.g., `gpt-4`, `claude-3-5-sonnet-20241022`)
   - **API Key**: Your API key from the provider
   - **Base URL**: Optional custom endpoint for proxies
5. Click **"Test"** to verify the connection
6. **Save** - Settings are stored securely in `~/.card-architect/config.json`

**Security Note:** API keys are stored with restricted permissions (600) and never logged or exposed in API responses.

#### Using AI Assist

1. Open any field editor
2. Click the **AI** button to open the LLM Assist sidebar
3. Select a configured provider
4. Choose an operation:
   - **Built-in Presets**: tighten, convert-structured, convert-prose, enforce-style, generate-alts, generate-lore
   - **User Presets**: Your custom saved operations (create via Settings → Presets)
   - **Custom Instruction**: Write your own editing instruction
5. (Optional) Enable **RAG** and select a knowledge base for additional context
6. Click **Run** - See results stream in with live diff viewer
7. **Apply** changes by choosing Replace or Append

#### Managing AI Presets

1. Open **Settings** → **Presets** tab
2. Click **"Add Preset"** to create a custom operation
3. Configure:
   - **Name**: Preset identifier (e.g., "Expand Description")
   - **Description**: What this preset does
   - **Category**: rewrite, format, generate, or custom
   - **Instruction**: The AI instruction to execute
4. **Save** - Preset appears in LLM Assist sidebar
5. **Import/Export**: Share presets as JSON files

**Note:** Built-in presets (8 total) cannot be modified or deleted.

#### Setting Up RAG Knowledge Bases

1. Open **Settings** → **Knowledge** tab
2. Click **"Create Knowledge Base"**
3. Configure:
   - **Label**: Name (e.g., "Character Writing Guide")
   - **Description**: What it contains
   - **Tags**: Searchable tags

4. **Add Content** (three ways):
   - **Upload Documents**: PDF, JSON, Markdown, HTML, or plain text files
   - **Add Free Text**: Paste notes, guidelines, documentation directly
   - **Import Lorebook**: Import the current card's lorebook as searchable knowledge

5. Documents are automatically chunked, embedded with vector embeddings, and indexed
6. Use in AI Assist by selecting the knowledge base - provides semantic search context

**How It Works:**
- Content is split into 1200-character chunks with 200-character overlap
- Each chunk is converted to a 384-dimensional vector embedding
- Search queries use cosine similarity to find semantically similar content
- Most relevant chunks are automatically provided as context to AI operations

**Storage Location:** `~/.card-architect/rag-index/`

### Advanced Tools

#### Prompt Simulator

Test how your card will be assembled by different frontends:

1. Go to the **Tools** tab
2. Open **Prompt Simulator**
3. Select a profile (Generic CCv3, Strict CCv3, CCv2-compat)
4. Set token budget and drop policy
5. See the exact prompt that will be sent to the LLM

#### Redundancy Detection

Find duplicate content across fields to save tokens:

1. Go to the **Tools** tab
2. Open **Redundancy Killer**
3. See detected duplicates with confidence scores
4. Review token savings from removing redundancies

#### Lore Trigger Tester

Test which lorebook entries will activate:

1. Go to the **Tools** tab
2. Open **Lore Trigger Tester**
3. Enter test phrases
4. See which entries trigger and why

## Configuration

### Environment Variables (API)

Create `apps/api/.env`:

```env
PORT=3456
HOST=0.0.0.0
DATABASE_PATH=./data/cards.db
STORAGE_PATH=./storage

# Size limits
MAX_CARD_SIZE_MB=5
MAX_PNG_SIZE_MB=4
WARN_PNG_SIZE_MB=2
WARN_CARD_SIZE_MB=2
```

### Docker Environment

Edit `docker-compose.yml` to customize limits and paths.

## API Reference

### Cards

```
GET    /cards                     # List all cards
GET    /cards/:id                 # Get single card
POST   /cards                     # Create card
PATCH  /cards/:id                 # Update card
DELETE /cards/:id                 # Delete card
GET    /cards/:id/export?format=  # Export (json|png)
```

### Versions

```
GET    /cards/:id/versions                    # List versions
POST   /cards/:id/versions                    # Create snapshot
POST   /cards/:id/versions/:ver/restore       # Restore version
```

### Tokenization

```
GET    /tokenizers                            # List available models
POST   /tokenize                              # Tokenize fields
```

### Import/Export

```
POST   /import                                # Import single JSON/PNG/CHARX
POST   /import-multiple                       # Import multiple cards at once
POST   /convert                               # Convert v2 ↔ v3
```

### Assets

```
POST   /assets                                # Upload image
GET    /assets/:id                            # Get asset
POST   /assets/:id/transform                  # Crop/resize/convert
```

### LLM Integration

```
GET    /llm/settings                          # Get LLM settings (API keys redacted)
POST   /llm/settings                          # Update LLM settings
POST   /llm/test-connection                   # Test provider connection
POST   /llm/invoke                            # Direct LLM invocation (streaming/non-streaming)
POST   /llm/assist                            # High-level AI assist with presets
```

### Presets

```
GET    /presets                               # List all presets (built-in + user)
GET    /presets/:id                           # Get single preset
POST   /presets                               # Create user preset
PATCH  /presets/:id                           # Update user preset
DELETE /presets/:id                           # Delete user preset (built-in protected)
GET    /presets/export/all                    # Export all presets as JSON
POST   /presets/import                        # Import presets from JSON
```

### RAG (Knowledge Bases)

```
GET    /rag/databases                         # List RAG knowledge bases
POST   /rag/databases                         # Create RAG database
GET    /rag/databases/:dbId                   # Get database details
PATCH  /rag/databases/:dbId                   # Update database metadata
DELETE /rag/databases/:dbId                   # Delete database
POST   /rag/databases/:dbId/documents         # Upload & index document (file)
POST   /rag/databases/:dbId/text              # Add free text entry
POST   /rag/databases/:dbId/lorebook          # Import lorebook as knowledge
DELETE /rag/databases/:dbId/documents/:sourceId  # Remove document
GET    /rag/search                            # Search RAG database (semantic)
GET    /rag/stats                             # Get RAG statistics
```

### Analysis Tools

```
POST   /prompt-simulator/simulate             # Simulate prompt assembly
POST   /redundancy/analyze                    # Find cross-field redundancy
POST   /lore-trigger/test                     # Test lorebook triggers
```

## Validation

Card Architect performs:

1. **Schema Validation** - Ensures required fields and types match CCv2/CCv3 specs
2. **Semantic Validation** - Checks for:
   - Empty required fields
   - Placeholder text (`{{char}}`, `{{user}}`, etc.)
   - Redundant information across fields
   - Invalid lorebook entries (missing keywords, empty content)
   - Size warnings (2MB JSON, 2-4MB PNG)

Validation errors appear as inline messages with severity levels (error, warning, info).

## Development

### Building

```bash
# Build all packages
npm run build

# Build specific workspace
npm run build:api
npm run build:web
```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run type-check
```

## License

**MIT License**

Copyright (c) 2024 Card Architect Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Documentation

- **README.md** - This file - Quick start and feature overview
- **claude.md** - Comprehensive developer guide with architecture details
- **CCV3.md** - CCv3 specification documentation
- **CHARX_CARDS.md** - CHARX format documentation
- **CCv3_ASSETS_CHARX_IMPLEMENTATION_PLAN.md** - Implementation roadmap
- **IMPLEMENTATION_STATUS.md** - Detailed feature status and roadmap
- **LLM_ASSIST_V2_DOCUMENTATION.md** - LLM integration documentation
- **CONTRIBUTING.md** - Contribution guidelines

## Acknowledgments

- **CCv2 Spec:** https://github.com/malfoyslastname/character-card-spec-v2
- **CCv3 Spec:** https://github.com/kwaroran/character-card-spec-v3

## Support

For bug reports, feature requests, or questions, please open an issue on GitHub.

---

**Card Architect** - Professional character card editor with AI-powered tools, self-hosted, open source