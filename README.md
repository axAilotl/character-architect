# Card Architect

**Card Architect** is a modern, self-hostable character card editor for CCv2 and CCv3 formats. Built as a single-user application with always-saving drafts, version history, and accurate token estimation.

## Features

### MVP (Current Release)

- ✅ **Full CCv2/CCv3 Support** - Read, edit, validate both specifications
- ✅ **Real-time Token Counting** - Per-field and global token estimates using Hugging Face tokenizers
- ✅ **Lorebook Editor** - Complete CCv3 character book with all fields (keywords, secondary, priority, selective AND/NOT, probability, constant, insertion order/position)
- ✅ **Always-Saving** - Autosave to IndexedDB with background sync to SQLite
- ✅ **Version History** - Manual snapshots with restore capability
- ✅ **Import/Export** - JSON and PNG (tEXt embed) support
- ✅ **Markdown Preview** - Sanitized HTML rendering
- ✅ **Asset Management** - Upload, crop, resize, and convert images
- ✅ **Schema Validation** - JSON schema + semantic linting
- ✅ **Dark Mode** - Modern, accessible UI
- ✅ **Self-Hostable** - Docker Compose or standalone container

### Roadmap

- 🔜 **CHARX Support** - Pack/unpack CHARX archives (v1.1)
- 🔜 **Voxta Export** - Export to Voxta format (v1.1)
- 🔜 **Plugin System** - LLM integration, image generation, analyzers (v1.2)
- 🔜 **Batch Tools** - Normalize, lint, migrate multiple cards (v1.2)

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

## Configuration

### Environment Variables (API)

Create `apps/api/.env`:

```env
PORT=3456
HOST=127.0.0.1
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

## Acknowledgments

- **CCv2 Spec:** https://github.com/malfoyslastname/character-card-spec-v2
- **CCv3 Spec:** https://github.com/kwaroran/character-card-spec-v3

---

**Card Architect** - Professional character card editor, self-hosted, open source