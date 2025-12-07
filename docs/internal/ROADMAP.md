# Card Architect - Development Roadmap

## Phase 2: Code Quality & Infrastructure (Completed 2025-11-25)

### 2.1 Asset Storage Restructure
- [x] Move assets from flat storage to `./storage/{card_id}/*` structure
- [x] Update AssetRepository to use card-based paths
- [x] Add migration to move existing assets to new structure
- [x] Update all asset URL generation

### 2.2 Database Migration System
- [x] Create migrations table with version tracking
- [x] Convert existing ALTER TABLE try/catch to proper migrations
- [x] Add migration runner with transaction support
- [x] 5 migrations implemented:
  1. `initial_schema` - Core tables
  2. `add_indexes` - Performance indexes
  3. `add_original_image_column` - Avatar storage
  4. `add_card_assets_tags_column` - Asset tagging
  5. `restructure_asset_storage` - Card-based directories

### 2.3 TypeScript Improvements
- [x] Remove `as any` casts in `cards.ts`
- [x] Add proper type guards and type assertions
- [x] Fixed CardMeta partial type handling

### 2.4 Code Cleanup
- [x] Remove debug console.log statements from `card-store.ts`
- [x] Remove debug console.log statements from `png.ts`
- [x] Remove debug logging from `cards.ts` routes

### 2.5 Frontend Improvements
- [x] Add React Error Boundaries (`ErrorBoundary`, `PageErrorBoundary`)
- [x] Fix Vite dynamic import warnings (converted to static imports)

### 2.6 Test Fixes
- [x] Update test assertions for wrapped V2 format
- [x] Added `getCardName()` helper for format-agnostic name extraction
- [x] All 27 tests passing

---

## Phase 3: Feature Completion & UX (In Progress)

### 3.1 Re-enable Disabled Features
- [ ] Implement and enable RedundancyPanel.tsx
- [ ] Implement and enable LoreTriggerPanel.tsx
- [ ] Add UI toggles to access these panels

### 3.2 Guided Creation Mode (LLM Wizard) - COMPLETED
- [x] wwwyzzerdd AI character creation wizard
- [x] Two-column layout: form + AI chat
- [x] JSON output parsing with "Apply to Card" button
- [x] JED formatting by default
- [x] Card type selection (CC vs Voxta)
- [x] Image gen type selection (booru tags vs natural language)
- [x] Appearance field for image generation
- [x] Personality field marked as deprecated for CC
- [x] Persistent chat across tab switches

### 3.3 LLM Panel UI Improvements
- [x] Stop button for canceling requests
- [x] Restore button in diff comparison view
- [ ] Wider sidebar layout option
- [ ] Collapsible/expandable panel
- [ ] Better preset organization

### 3.4 AI Generation Features - COMPLETED
- [x] AI Tags generation (5-10 single-word slugs)
- [x] AI Tagline generation (up to 500 chars)
- [x] Configurable prompts in Settings > LLM Presets
- [x] ELARA VOSS name replacement tool

### 3.5 Voxta Support Improvements
- [ ] Better emotion/expression mapping
- [ ] Voice sample handling
- [ ] Memory book improvements
- [ ] Multi-character package support

### 3.6 Saving & Snapshots
- [x] Auto-snapshot at configurable intervals (1, 5, 10, 15, 30 min)
- [x] Snapshot deletion with confirmation
- [x] Restore button in diff view
- [ ] Snapshot diff preview (current: full JSON diff)
- [ ] Snapshot branching
- [ ] Export snapshots as separate files

### 3.7 ComfyUI Integration (Scaffolding)
- [x] Feature flag in settings
- [x] Backend routes scaffolding
- [x] Frontend tab scaffolding
- [ ] Actual ComfyUI server connection (future)

### 3.8 Linked Lorebook Support
- [ ] Support for external/linked lorebooks (separate from embedded character_book)
- [ ] Import linked lorebooks from Chub (`extensions.chub.related_lorebooks`)
- [ ] Lorebook library management (CRUD, search, tags)
- [ ] Link/unlink lorebooks to cards
- [ ] Merge linked lorebooks into card on export
- [ ] Lorebook sharing between multiple cards

---

## Ultimate Goal: Universal Format Bridge

**Vision**: Import any format, export to any format with full fidelity

### Supported Conversions
| From / To | JSON V2 | JSON V3 | PNG V2 | PNG V3 | CHARX | Voxta |
|-----------|---------|---------|--------|--------|-------|-------|
| JSON V2   | ✓       | ✓       | ✓      | ✓      | ✓     | ✓     |
| JSON V3   | ✓       | ✓       | ✓      | ✓      | ✓     | ✓     |
| PNG V2    | ✓       | ✓       | ✓      | ✓      | ✓     | ✓     |
| PNG V3    | ✓       | ✓       | ✓      | ✓      | ✓     | ✓     |
| CHARX     | ✓       | ✓       | ✓      | ✓      | ✓     | ✓     |
| Voxta     | ✓       | ✓       | ✓      | ✓      | ✓     | ✓     |

### Key Principles
1. **Lossless where possible** - Preserve all metadata in extensions
2. **Graceful degradation** - When features don't map, store in extensions
3. **Round-trip safety** - Import → Export → Import yields same data
4. **Asset handling** - Properly migrate assets between format conventions

---

## Changelog

### 2025-11-29 - wwwyzzerdd & AI Features
- Implemented wwwyzzerdd AI character creation wizard
  - Two-column layout: editable form + AI chat
  - JSON output parsing with "Apply to Card" button
  - JED formatting by default
  - CC vs Voxta card type selection
  - Booru tags vs natural language for appearance
  - Persistent chat across tab switches (module-level state)
  - Stop button for LLM requests
- Added ELARA VOSS name replacement tool
  - Gender selection (male, female, femboy, futa)
  - Auto-snapshot before replacement
  - Random name generation from JSON database
- Added AI generation buttons for Tags and Tagline
  - Configurable prompts in Settings > LLM Presets
  - Tags: 5-10 single-word slugs
  - Tagline: up to 500 characters
- LLM improvements
  - Stop button in LLMAssistSidebar
  - Restore button in DiffPanel comparison view
  - Fixed provider loading in EditPanel
- ComfyUI scaffolding (feature flagged, not connected)

### 2025-11-25 - Auto-Snapshot & Snapshot Deletion
- Added snapshot deletion (API endpoint + UI button in DiffPanel)
- Implemented auto-snapshot feature:
  - New `settings-store.ts` with Zustand + localStorage persistence
  - Configurable intervals (1, 5, 10, 15, or 30 minutes)
  - New "General" tab in Settings modal
  - `useAutoSnapshot` hook integrated in CardEditor
  - Auto-snapshots labeled with "[Auto]" prefix
- Fixed TypeScript errors in migrations.ts (unused imports)
- Fixed type handling in cards.ts route

### 2025-11-25 - Phase 2 Completed
- Implemented versioned database migration system (5 migrations)
- Restructured asset storage from flat to card-based directories
- Added React Error Boundaries for graceful error handling
- Fixed all TypeScript `any` casts with proper typing
- Removed all debug console.log statements
- Fixed Vite dynamic import warnings
- Fixed 3 failing tests (all 27 tests now pass)
- Build passes with no errors

### 2025-11-25 - Phase 2 Started
- Created roadmap document
- Identified code quality issues
- Planned asset storage restructure
