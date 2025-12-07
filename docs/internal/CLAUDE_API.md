# Card Architect - API Reference

Complete API endpoint reference and database schema documentation.

**Base URL (dev):** `http://localhost:3456`

---

## Cards

```
GET    /api/cards                     # List all cards
GET    /api/cards/:id                 # Get single card
POST   /api/cards                     # Create card
PATCH  /api/cards/:id                 # Update card
DELETE /api/cards/:id                 # Delete card
GET    /api/cards/:id/image           # Get card image
POST   /api/cards/:id/image           # Update card image
GET    /api/cards/:id/thumbnail       # Get 96x96 thumbnail
GET    /api/cards/:id/export          # Export card (json|png|charx|voxta)
GET    /api/cards/:id/assets          # List card assets
PATCH  /api/cards/:id/assets/:assetId/main  # Set main asset
DELETE /api/cards/:id/assets/:assetId       # Delete asset
```

## Versions (Snapshots)

```
GET    /api/cards/:id/versions        # List versions
POST   /api/cards/:id/versions        # Create snapshot
POST   /api/cards/:id/versions/:versionId/restore  # Restore version
DELETE /api/cards/:id/versions/:versionId          # Delete snapshot
```

## Import/Export

```
POST   /api/import                    # Import JSON/PNG/CHARX from file upload
POST   /api/import-url                # Import JSON/PNG/CHARX from URL
POST   /api/import-voxta              # Import Voxta package
POST   /api/import-multiple           # Import multiple files at once
POST   /api/convert                   # Convert v2 <-> v3
GET    /api/tokenizers                # List available tokenizer models
POST   /api/tokenize                  # Tokenize fields
```

## SillyTavern Integration

```
GET    /api/settings/sillytavern              # Get SillyTavern settings
PATCH  /api/settings/sillytavern              # Update SillyTavern settings
POST   /api/cards/:id/push-to-sillytavern     # Push PNG to SillyTavern
```

## Templates & Snippets

```
GET    /api/templates                 # List templates
POST   /api/templates                 # Create template
PATCH  /api/templates/:id             # Update template
DELETE /api/templates/:id             # Delete template
GET    /api/templates/export/all      # Export all templates
POST   /api/templates/import          # Import templates
POST   /api/templates/reset           # Reset to defaults

GET    /api/snippets                  # List snippets
POST   /api/snippets                  # Create snippet
PATCH  /api/snippets/:id              # Update snippet
DELETE /api/snippets/:id              # Delete snippet
GET    /api/snippets/export/all       # Export snippets
POST   /api/snippets/import           # Import snippets
POST   /api/snippets/reset            # Reset snippets
```

## Assets

```
POST   /api/assets                    # Upload image
GET    /api/assets/:id                # Get asset
POST   /api/assets/:id/transform      # Crop/resize/convert
```

## LLM Integration

```
GET    /api/llm/settings              # Get LLM settings (API keys redacted)
POST   /api/llm/settings              # Update LLM settings
POST   /api/llm/test-connection       # Test provider connection
POST   /api/llm/invoke                # Direct LLM invocation (streaming/non-streaming)
POST   /api/llm/assist                # High-level AI assist with presets
```

## Presets

```
GET    /api/presets                   # List all presets (built-in + user)
GET    /api/presets/visible           # List visible presets (filtered)
GET    /api/presets/:id               # Get single preset
POST   /api/presets                   # Create user preset
PATCH  /api/presets/:id               # Update user preset
DELETE /api/presets/:id               # Delete user preset (built-in protected)
POST   /api/presets/:id/copy          # Duplicate preset
POST   /api/presets/:id/toggle-hidden # Toggle visibility
GET    /api/presets/export/all        # Export all presets as JSON
POST   /api/presets/import            # Import presets from JSON
```

## RAG (Knowledge Bases)

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

## Tools & Utilities

```
POST   /api/prompt-simulator/simulate # Simulate prompt assembly
GET    /api/prompt-simulator/profiles # List simulation profiles
POST   /api/redundancy/analyze        # Find cross-field redundancy
POST   /api/lore-trigger/test         # Test lorebook triggers
```

## ComfyUI (Scaffolding)

```
GET    /api/comfyui/prompts           # List prompts
POST   /api/comfyui/prompts           # Create prompt
PATCH  /api/comfyui/prompts/:id       # Update prompt
DELETE /api/comfyui/prompts/:id       # Delete prompt
GET    /api/comfyui/prompts/export/all # Export prompts
POST   /api/comfyui/prompts/import    # Import prompts
GET    /api/comfyui/workflows         # List workflows
POST   /api/comfyui/workflows         # Create workflow
PATCH  /api/comfyui/workflows/:id     # Update workflow
DELETE /api/comfyui/workflows/:id     # Delete workflow
POST   /api/comfyui/reset             # Reset to defaults
```

## Web Import

```
GET    /api/web-import/sites          # List supported sites with URL patterns
GET    /api/web-import/settings       # Get web import settings (asset processing)
POST   /api/web-import/settings       # Update web import settings
GET    /api/web-import/userscript     # Download dynamically generated userscript
POST   /api/web-import                # Import card from URL
       Body: { url: string, pngData?: string }
```

See [CLAUDE_WEB_IMPORT.md](./CLAUDE_WEB_IMPORT.md) for detailed documentation.

## Linked Image Archival

```
GET    /api/cards/:id/archive-status          # Get external/archived image counts
POST   /api/cards/:id/archive-linked-images   # Download external images as local assets
POST   /api/cards/:id/revert-archived-images  # Restore original external URLs
GET    /user/images/:characterName/:filename  # Serve archived images (root level, ST-compatible)
```

## CHARX Optimizer

```
GET    /api/charx-optimizer/settings          # Get optimizer settings
PATCH  /api/charx-optimizer/settings          # Update optimizer settings
```

## wwwyzzerdd

```
GET    /api/wwwyzzerdd/prompts           # List prompt sets
POST   /api/wwwyzzerdd/prompts           # Create prompt set
PATCH  /api/wwwyzzerdd/prompts/:id       # Update prompt set
DELETE /api/wwwyzzerdd/prompts/:id       # Delete prompt set
GET    /api/wwwyzzerdd/prompts/export/all # Export all prompts
POST   /api/wwwyzzerdd/prompts/import    # Import prompts
POST   /api/wwwyzzerdd/prompts/reset     # Reset to defaults
```

## ELARA VOSS (Name Replacement)

```
GET  /api/elara-voss/names         # Get all names
GET  /api/elara-voss/names/:gender # Get names by gender
POST /api/elara-voss/names/import  # Import names (body: { names: [], merge?: boolean })
GET  /api/elara-voss/names/export  # Export names as JSON file
POST /api/elara-voss/names/reset   # Reset to defaults
GET  /api/elara-voss/stats         # Get name counts by gender/type
```

## Health Check

```
GET    /health                        # Server status
```

---

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

### Card Assets Table

```sql
CREATE TABLE card_assets (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'icon', 'emotion', 'background', 'custom', etc.
  name TEXT NOT NULL,        -- Asset name (e.g., 'main', 'happy', 'sad')
  filename TEXT NOT NULL,    -- Stored filename
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  is_main INTEGER DEFAULT 0, -- Main asset for card header
  tags TEXT,                 -- JSON array of tags
  original_url TEXT,         -- Original URL for archived images
  created_at TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id)
);
```

**Note**: Asset count is included in card list queries via subquery:
```sql
SELECT c.*, (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) as asset_count
FROM cards c
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
  is_hidden INTEGER DEFAULT 0,
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

### Templates Table

```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fields TEXT NOT NULL,        -- JSON object of field content
  is_built_in INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Snippets Table

```sql
CREATE TABLE snippets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  category TEXT,
  is_built_in INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Migrations Table

```sql
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
```

---

## Route Files

| File | Lines | Description |
|------|-------|-------------|
| `cards.ts` | ~400 | Card CRUD, versions, assets |
| `import-export.ts` | ~600 | Import/export with format normalization |
| `llm.ts` | ~350 | LLM provider settings and invocation |
| `rag.ts` | ~300 | RAG knowledge base operations |
| `presets.ts` | ~250 | LLM preset management |
| `templates.ts` | ~200 | Template and snippet management |
| `assets.ts` | ~150 | Asset upload and transformation |
| `web-import.ts` | ~120 | Web import route layer |
| `image-archival.ts` | ~200 | Linked image archival |
| `sillytavern.ts` | ~100 | SillyTavern push integration |
| `wwwyzzerdd.ts` | ~150 | AI wizard prompts |
| `comfyui.ts` | ~200 | ComfyUI workflows (scaffolding) |
| `charx-optimizer.ts` | ~50 | CHARX export settings |
| `prompt-simulator.ts` | ~80 | Prompt assembly simulation |
| `redundancy.ts` | ~50 | Redundancy detection |
| `lore-trigger.ts` | ~50 | Lorebook trigger testing |
| `tokenize.ts` | ~80 | Token counting |
| `settings.ts` | ~50 | General settings |

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main project documentation
- [CLAUDE_WEB_IMPORT.md](./CLAUDE_WEB_IMPORT.md) - Web import details
- [CLAUDE_TESTING.md](./CLAUDE_TESTING.md) - Testing guide
