# Card Architect

**Card Architect** is a modern, self-hostable character card editor for CCv2 and CCv3 formats. Built as a single-user application with always-saving drafts, version history, and accurate token estimation.

## Features

### Core Features

- ✅ **Full CCv2/CCv3 Support** - Read, edit, validate both specifications
- ✅ **Real-time Token Counting** - Per-field and global token estimates using Hugging Face tokenizers
- ✅ **Lorebook Editor** - Complete CCv3 character book with all fields (keywords, secondary, priority, selective AND/NOT, probability, constant, insertion order/position)
- ✅ **Always-Saving** - Autosave to IndexedDB with background sync to SQLite
- ✅ **Version History** - Manual snapshots with restore capability
- ✅ **Import/Export** - JSON and PNG (tEXt embed) support with automatic format normalization
- ✅ **Markdown Preview** - Sanitized HTML rendering with extended image sizing syntax
- ✅ **Asset Management** - Upload, crop, resize, and convert images
- ✅ **Schema Validation** - JSON schema + semantic linting
- ✅ **Dark Mode** - Modern, accessible UI
- ✅ **Self-Hostable** - Docker Compose or standalone container

### AI-Powered Features

- ✅ **LLM Integration** - AI-powered field editing with multiple providers
  - Supports OpenAI (GPT-4, GPT-3.5) and Anthropic (Claude)
  - Streaming responses with live diff viewer
  - Preset operations: tighten, convert-structured, convert-prose, enforce-style, generate-alts, generate-lore
  - Custom instructions for tailored editing
  - Secure API key storage with automatic redaction

- ✅ **RAG System** - Knowledge base integration for AI assistance
  - File-based vector storage for documentation and references
  - Supports PDF, JSON, Markdown, HTML, and plain text
  - Intelligent chunking with semantic search
  - Multiple knowledge bases with tags and descriptions
  - Token-aware snippet retrieval for context injection

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
- ✅ **Card Grid View** - Browse and manage multiple cards

### Roadmap

- 🔜 **CHARX Support** - Pack/unpack CHARX archives (v1.1)
- 🔜 **Voxta Export** - Export to Voxta format (v1.1)
- 🔜 **User-defined LLM Presets** - Save custom AI operations (v1.2)
- 🔜 **Vector Embeddings for RAG** - Semantic search improvements (v1.2)
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

1. Click **"Import"** in the header
2. Select a JSON or PNG file
3. The card will be validated and loaded into the editor
4. Make any edits and click **"Save"**

### Exporting Cards

1. Load a card
2. Click **"Export"** dropdown
3. Choose **JSON** (pretty-printed) or **PNG** (embedded in image)
4. File will download automatically

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
   - **Quick Presets**: tighten, convert-structured, convert-prose, enforce-style, generate-alts, generate-lore
   - **Custom Instruction**: Write your own editing instruction
5. (Optional) Enable **RAG** and select a knowledge base for additional context
6. Click **Run** - See results stream in with live diff viewer
7. **Apply** changes by choosing Replace or Append

#### Setting Up RAG Knowledge Bases

1. Open **Settings** → **Knowledge** tab
2. Click **"Create Knowledge Base"**
3. Configure:
   - **Label**: Name (e.g., "Character Writing Guide")
   - **Description**: What it contains
   - **Tags**: Searchable tags
4. Upload documents (PDF, JSON, Markdown, HTML, or plain text)
5. Documents are automatically chunked and indexed
6. Use in AI Assist by selecting the knowledge base

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
POST   /import                                # Import JSON/PNG
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

### RAG (Knowledge Bases)

```
GET    /rag/databases                         # List RAG knowledge bases
POST   /rag/databases                         # Create RAG database
GET    /rag/databases/:dbId                   # Get database details
PATCH  /rag/databases/:dbId                   # Update database metadata
DELETE /rag/databases/:dbId                   # Delete database
POST   /rag/databases/:dbId/documents         # Upload & index document
DELETE /rag/databases/:dbId/documents/:sourceId  # Remove document
GET    /rag/search                            # Search RAG database
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