# CLAUDE.md - AI Assistant Guide for Character Architect

## Project Overview

Character Architect is a self-hostable CCv2/CCv3 character card editor with AI-powered tools. It's a monorepo using pnpm workspaces.

## Quick Commands

```bash
# Development
npm run dev               # Start both API and web dev servers
npm run dev:api           # API only (localhost:3456)
npm run dev:web           # Web only (localhost:5173)

# Building
npm run build             # Build everything
npm run build:api         # Build API only
npm run build:web         # Build web only

# Testing
npm run test              # Workspace tests (API + web)

# Golden fixtures (shared across repos)
export CF_FIXTURES_DIR=/home/vega/ai/character-foundry/fixtures

npm run test:e2e           # Playwright (full-mode + light-mode fixture smoke)
npm run test:e2e:fixtures  # Fixture smoke only
npm run test:e2e:ui        # Playwright UI mode

# Dependencies
npm install
```

## Project Structure

```
/apps/api              # Fastify backend (Node 20 + SQLite)
/apps/web              # React frontend (Vite + TypeScript + Tailwind)
/packages/defaults     # Shared templates, snippets, presets
/packages/plugins      # Plugin SDK (stub)
```

## Key External Dependencies

**Bundled Package (npm):**
- `@character-foundry/character-foundry` - Monorepo bundle with subpath exports:
  - `/schemas` - TypeScript types, CCv2/CCv3 schemas
  - `/loader` - Universal card loader with format auto-detection
  - `/png` - PNG tEXt/zTXt chunk reading/writing
  - `/charx` - CHARX format (ZIP-based cards)
  - `/voxta` - Voxta .voxpkg format
  - `/lorebook` - Lorebook parsing (SillyTavern, Agnai, RisuAI, Wyvern)
  - `/tokenizers` - Token counting
  - `/app-framework` - Settings UI components, AutoForm (web only)
  - `/federation` - Platform sync protocol (web only)
  - `/normalizer` - V2 ↔ V3 conversion
  - `/core` - Binary utilities, base64, ZIP, data URLs

**Bundled Subpath Export:**
- `@character-foundry/character-foundry/image-utils` - SSRF protection and image URL extraction helpers

### Canonical Implementations

**Image URL Extraction** - Use `extractRemoteImageUrls()` from image-utils:
```typescript
import { extractRemoteImageUrls } from '@character-foundry/character-foundry/image-utils';
const images = extractRemoteImageUrls(greeting);
// Detects: markdown, HTML img, CSS url(), plain URLs
```

**SSRF Protection** - Use `isURLSafe()` from image-utils:
```typescript
import { isURLSafe } from '@character-foundry/character-foundry/image-utils';
const check = isURLSafe(url, policy);
if (!check.safe) console.error(check.reason);
```

**Architect Wrapper** - `apps/api/src/utils/ssrf-protection.ts` wraps canonical SSRF with Architect config integration.

## Card Types (Spec)

Cards have a `meta.spec` field:
- `v2` - CCv2 character card
- `v3` - CCv3 character card
- `collection` - Voxta collection (multi-character package, stores original .voxpkg)
- `lorebook` - Standalone lorebook

Collection cards have `memberCount` in meta and store `package-original` asset for delta export.

## Data Structure

```typescript
interface Card {
  meta: {
    id: string;
    name: string;
    spec: 'v2' | 'v3' | 'collection' | 'lorebook';
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  data: CCv2Data | CCv3Data;  // Wrapped format with spec field
}
```

CCv3Data is wrapped: `{ spec: 'chara_card_v3', spec_version: '3.0', data: { ... } }`

## API Endpoints

- `GET /api/cards` - Returns `{ items: Card[], total: number }`
- `POST /api/cards` - Create card
- `PATCH /api/cards/:id` - Update card
- `DELETE /api/cards/:id` - Delete card
- `GET /api/cards/:id/export?format=json|png|charx|voxta` - Export
- `POST /api/unified-import` - Unified import (png|json|charx|voxpkg)

### Route Feature Flags (API)

- `FEDERATION_ENABLED=true` - Enables federation routes under `/api/federation/*` (default: off)
- `WEB_IMPORT_ENABLED=false` - Disables web import routes under `/api/web-import/*` (default: on)

## Database

SQLite via better-sqlite3. Migrations in `apps/api/src/db/migrations.ts`.

Current spec CHECK constraint: `spec IN ('v2', 'v3', 'collection', 'lorebook')`

## Frontend State

- **Zustand** for state management (`apps/web/src/store/`)
- **IndexedDB** for local persistence with background sync to API
- **card-store.ts** - Main card state and operations

## Important Files

- `apps/web/src/lib/client-import.ts` - Client-side card import logic
- `apps/web/src/lib/client-export.ts` - Client-side card export logic
- `apps/web/src/lib/card-utils.ts` - Card data extraction utilities
- `apps/web/src/features/editor/` - Editor components
- `apps/api/src/services/card.service.ts` - Card validation/processing
- `apps/api/src/db/repository.ts` - Database operations

## Package Version Management

Use pnpm overrides in root `package.json` to force transitive dependency versions:

```json
{
  "pnpm": {
    "overrides": {
      "@character-foundry/core": "0.1.0",
      "@character-foundry/loader": "0.1.8",
      "@character-foundry/voxta": "0.1.9"
    }
  }
}
```

## Common Tasks

### Adding a new card spec type
1. Update `apps/web/src/lib/types.ts` - Add to `Spec` type
2. Update `apps/api/src/types/index.ts` - Add to `Spec` type
3. Add migration in `apps/api/src/db/migrations.ts` to update CHECK constraint
4. Update `apps/api/src/services/card.service.ts` validation logic

### Import format support
- JSON detection in `apps/web/src/lib/client-import.ts`
- Order: spec check → lorebook detection → legacy v2 → fallback

### API return type
All list endpoints return `{ items: T[], total: number }`, not raw arrays.

## Type Safety Helpers

Use these utilities instead of `as any` casts:

- `apps/web/src/lib/card-type-guards.ts` - `getCardFields()`, `getExtensions()`, `isV3Card()`, etc.
- `apps/web/src/lib/extension-types.ts` - `CardExtensions`, `getLorebookEntryExtensions()`
- `apps/web/src/store/card-store.ts` - `updateCardFields()`, `updateExtensions()`, `updateCharacterBook()`

## Module System

Optional features are implemented as modules in `apps/web/src/modules/`. The module system handles:
- Auto-discovery via Vite glob imports
- Registration of tabs, settings panels, and other UI contributions
- Deployment mode filtering (full vs light vs static)

### Key Files

- `apps/web/src/lib/modules.ts` - Module loader and initialization
- `apps/web/src/lib/registry/` - UI registry for tabs, panels, etc.
- `apps/web/src/lib/registry/types.ts` - `ModuleDefinition` type
- `apps/web/src/config/deployment.ts` - Deployment mode config

### Module Metadata

Each module exports `MODULE_METADATA` of type `ModuleDefinition`:

```typescript
export const MODULE_METADATA: ModuleDefinition = {
  id: 'my-module',           // kebab-case, must match folder name
  name: 'My Module',         // Display name
  description: 'What it does',
  defaultEnabled: false,     // Whether enabled by default
  badge: 'Beta',             // Optional badge text
  color: 'purple',           // Toggle/badge color
  order: 50,                 // Sort order in modules list
  requiresServer: true,      // If true, hidden in light/static modes
};
```

### Server-Only Modules (requiresServer)

Modules that require backend functionality MUST set `requiresServer: true`. These are:
- `comfyui` - Requires local ComfyUI server
- `webimport` - Requires API server for processing
- `charx-optimizer` - Uses server-side Sharp for image optimization
- `sillytavern` - Requires API for SillyTavern integration
- `federation` - Requires API for platform sync

**NEVER hardcode module IDs for filtering.** Always use the `requiresServer` metadata property.

### Deployment Modes

- `full` - Self-hosted with API server. All modules available.
- `light` - Cheap VPS, minimal server. Server-only modules hidden.
- `static` - No server (Cloudflare Pages). Server-only modules hidden.

Auto-detection: localhost/LAN → full, otherwise → light.

### Adding a New Module

1. Create folder: `apps/web/src/modules/{module-id}/`
2. Add `metadata.ts` exporting `MODULE_METADATA` (no side effects)
3. Add `index.ts` exporting `register{PascalCaseId}Module()` and re-exporting `MODULE_METADATA`
4. If module needs server backend, set `requiresServer: true`
5. Keep any initialization inside the register function (module code must not run unless enabled)
6. Register tabs/panels in the register function:

```typescript
export function registerMyModuleModule(): void {
  registry.registerSettingsPanel({
    id: 'my-module',
    label: 'My Module',
    component: MyModuleSettings,
    row: 'modules',
    color: 'purple',
    order: 80,
    condition: () => useSettingsStore.getState().features?.myModuleEnabled ?? false,
  });
}
```
