# CLAUDE.md - AI Assistant Guide for Card Architect

## Project Overview

Card Architect is a self-hostable CCv2/CCv3 character card editor with AI-powered tools. It's a monorepo using pnpm workspaces.

## Quick Commands

```bash
# Development
pnpm run dev              # Start both API and web dev servers
pnpm run dev:api          # API only (localhost:3456)
pnpm run dev:web          # Web only (localhost:5173)

# Building
pnpm run build            # Build everything
pnpm run build:api        # Build API only
pnpm run build:web        # Build web only

# Testing
pnpm run test:e2e         # Run Playwright tests
pnpm run test:e2e:ui      # Playwright UI mode

# Dependencies (requires GITHUB_TOKEN for @character-foundry packages)
GITHUB_TOKEN=<token> pnpm install
```

## Project Structure

```
/apps/api              # Fastify backend (Node 20 + SQLite)
/apps/web              # React frontend (Vite + TypeScript + Tailwind)
/packages/defaults     # Shared templates, snippets, presets
/packages/plugins      # Plugin SDK (stub)
/packages/utils        # Card-architect specific utilities
```

## Key External Dependencies

From `@character-foundry/*` (GitHub Packages):
- `core` - Binary utilities, base64, ZIP, data URLs
- `schemas` - TypeScript types, CCv2/CCv3 schemas
- `loader` - Universal card loader with format auto-detection
- `png` - PNG tEXt/zTXt chunk reading/writing
- `charx` - CHARX format (ZIP-based cards)
- `voxta` - Voxta .voxpkg format
- `lorebook` - Lorebook parsing (SillyTavern, Agnai, RisuAI, Wyvern)
- `federation` - Federation protocol
- `tokenizers` - Token counting

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
