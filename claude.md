# Card Architect - Claude Guide

## Project Overview

**Card Architect** (internally called "card_doctor") is a modern, self-hostable character card editor for CCv2 (Character Card v2) and CCv3 (Character Card v3) formats. It's designed as a single-user application with always-saving drafts, version history, and accurate token estimation for AI character cards.

## Purpose

This tool helps creators build, edit, and maintain AI character cards with features like:
- Real-time token counting per field
- Lorebook (character book) editing with full CCv3 support
- Version control and snapshot management
- Import/Export in JSON and PNG formats (with embedded metadata)
- Advanced validation and linting
- Prompt simulation for different frontend profiles
- Redundancy detection and elimination
- Lore trigger testing

## Architecture

### Monorepo Structure

```
/apps/api              # Fastify backend (Node 20 + SQLite)
/apps/web              # React frontend (Vite + TypeScript + Tailwind)
/packages/schemas      # Shared TypeScript types + JSON schemas
/packages/tokenizers   # HuggingFace tokenizer adapters
/packages/charx        # CHARX support (stub)
/packages/plugins      # Plugin SDK (stub)
```

### Tech Stack

**Backend (apps/api):**
- **Fastify** - Fast, low-overhead web framework
- **SQLite** (better-sqlite3) - Local database for cards storage
- **Sharp** - Image processing (crop, resize, convert)
- **pngjs** - PNG tEXt chunk handling for embedded card metadata
- **Ajv** - JSON schema validation

**Frontend (apps/web):**
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **IndexedDB** (idb) - Local persistence with background sync
- **marked** - Markdown to HTML rendering
- **DOMPurify** - HTML sanitization for security

### API Architecture

**Base URL (dev):** `http://localhost:3456`

**Key Endpoints:**
```
GET    /cards                     # List all cards
GET    /cards/:id                 # Get single card
POST   /cards                     # Create card
PATCH  /cards/:id                 # Update card
DELETE /cards/:id                 # Delete card
GET    /cards/:id/export          # Export (json|png)

GET    /cards/:id/versions        # List versions
POST   /cards/:id/versions        # Create snapshot
POST   /cards/:id/versions/:ver/restore  # Restore version

GET    /tokenizers                # List available tokenizer models
POST   /tokenize                  # Tokenize fields

POST   /import                    # Import JSON/PNG
POST   /convert                   # Convert v2 ↔ v3

POST   /assets                    # Upload image
GET    /assets/:id                # Get asset
POST   /assets/:id/transform      # Crop/resize/convert

POST   /prompt-simulator/simulate # Simulate prompt assembly
POST   /redundancy/analyze        # Find cross-field redundancy
POST   /lore-trigger/test         # Test lorebook triggers
```

## Key Features & Implementation Status

### ✅ Completed Features

1. **Prompt Simulator** - Test how cards will be assembled by different frontends
   - Backend: `apps/api/src/services/prompt-simulator.ts`
   - Frontend: `apps/web/src/components/PromptSimulatorPanel.tsx`
   - Profiles: Generic CCv3, Strict CCv3, CCv2-compat
   - Token budget tracking with drop policies

2. **Redundancy Killer** - Cross-field duplicate detection
   - Backend: `apps/api/src/services/redundancy-killer.ts`
   - Frontend: `apps/web/src/components/RedundancyPanel.tsx`
   - Detects: exact duplicates, semantic overlap, repeated phrases
   - Shows token savings and confidence scores

3. **Lore Trigger Tester** - Test lorebook entry activation
   - Backend: `apps/api/src/services/lore-trigger-tester.ts`
   - Frontend: `apps/web/src/components/LoreTriggerPanel.tsx`
   - Supports: AND/NOT logic, regex patterns, case sensitivity
   - Real-time phrase testing with preview

4. **Full CCv2/CCv3 Support** - Complete spec compliance
5. **Token Counting** - Accurate per-field and total token counts
6. **Version History** - Manual snapshots with restore capability
7. **Import/Export** - JSON and PNG (with tEXt chunk embedding)
8. **Asset Management** - Image upload, crop, resize, convert
9. **Dark Mode** - Modern, accessible UI

### 🚧 Planned Features

- Style Guard (format enforcement)
- Alt-Greeting Workbench (variant generation)
- Enhanced version timeline with field-aware diff
- PNG export verifier (import works, export needs completion)
- Command Palette (Ctrl/Cmd+K)
- Keyboard-first editing
- Health checks and backup system

See `IMPLEMENTATION_STATUS.md` for detailed status.

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

# Lint all code
npm run lint

# Type check
npm run type-check

# Clean all build artifacts and dependencies
npm run clean
```

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

## Important Files & Directories

### Configuration
- `package.json` - Root workspace configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration
- `docker-compose.yml` - Docker service definitions
- `apps/api/.env` - API environment variables (create if needed)

### Documentation
- `README.md` - User-facing documentation
- `IMPLEMENTATION_STATUS.md` - Feature status and roadmap
- `LLM_ASSIST_V2_DOCUMENTATION.md` - LLM integration docs
- `CONTRIBUTING.md` - Contribution guidelines

### Backend Services (apps/api/src/services/)
- `prompt-simulator.ts` - Prompt assembly simulation
- `redundancy-killer.ts` - Cross-field duplicate detection
- `lore-trigger-tester.ts` - Lorebook trigger testing
- `card.service.ts` - Card CRUD operations
- `tokenizer.service.ts` - Token counting

### Frontend Components (apps/web/src/components/)
- `CardEditor.tsx` - Main card editing interface
- `LorebookEditor.tsx` - Lorebook entry management
- `PromptSimulatorPanel.tsx` - Prompt simulation UI
- `RedundancyPanel.tsx` - Redundancy detection UI
- `LoreTriggerPanel.tsx` - Lore trigger testing UI
- `DiffPanel.tsx` - Version history and diff view

### Shared Packages
- `packages/schemas/` - TypeScript types and JSON schemas for CCv2/CCv3
- `packages/tokenizers/` - Tokenizer adapters (GPT-2-like, LLaMA-like)

## Working with Character Cards

### Card Formats

**CCv2** - Character Card v2 specification
- Basic fields: name, description, personality, scenario, first_mes
- Extensions for lorebooks, alternate greetings

**CCv3** - Character Card v3 specification (superset of v2)
- All CCv2 fields plus enhanced lorebook
- Better structured character books with priority, position, logic

### Token Counting
- Uses approximate BPE/SentencePiece tokenizers
- Per-field token counts displayed as blue chips
- Total token count in header
- Useful for staying within model context limits

### Lorebook Structure
Each lorebook entry supports:
- **Keywords** - Primary trigger words (comma-separated)
- **Secondary Keywords** - For selective matching
- **Content** - The lorebook entry text
- **Priority** - Insertion priority (higher = inserted first)
- **Insertion Order** - Order among same-priority entries
- **Position** - Before or after character definition
- **Probability** - 0-100% chance of insertion
- **Selective Logic** - AND (all match) or NOT (none match)
- **Constant** - Always insert regardless of triggers
- **Case Sensitive** - Match keywords with exact case

## Validation System

The system performs two types of validation:

1. **Schema Validation** - Ensures structure matches CCv2/CCv3 specs
2. **Semantic Validation** - Checks for:
   - Empty required fields
   - Placeholder text ({{char}}, {{user}})
   - Redundant information across fields
   - Invalid lorebook entries
   - Size warnings (2MB JSON, 2-4MB PNG)

Validation errors appear inline with severity levels (error, warning, info).

## Common Tasks

### Adding a New API Endpoint
1. Create service in `apps/api/src/services/`
2. Create route in `apps/api/src/routes/`
3. Register route in `apps/api/src/index.ts`
4. Update TypeScript types if needed

### Adding a New Frontend Component
1. Create component in `apps/web/src/components/`
2. Import and use in parent component
3. Connect to Zustand store if state is needed
4. Add API calls using fetch with proper error handling

### Adding a New Validation Rule
1. Update schema in `packages/schemas/`
2. Add validation logic in `apps/api/src/services/validation.service.ts`
3. Update frontend to display new validation messages

## Performance Considerations

- Frontend panels use debounced API calls (500ms) to reduce server load
- Token counting uses approximate tokenizers for speed
- Large cards (>10k tokens) may need optimization
- Consider caching redundancy analysis results for repeated scans

## Security Notes

- No user authentication currently implemented (single-user app)
- HTML sanitization via DOMPurify for markdown preview
- Validate all user inputs on backend before processing
- Consider adding rate limiting before production deployment

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

## License

MIT License - See README.md for full text
