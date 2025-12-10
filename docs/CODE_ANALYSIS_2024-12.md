# Character Architect: Codebase Analysis Report

**Date:** December 2024
**Perspective:** Project Manager & End Users
**Goal:** Reduce complexity, eliminate duplication, accelerate feature development

---

## Executive Summary

The codebase has grown organically with significant technical debt accumulated across 3 main areas:
- **Monolithic route files** (import-export.ts: 1,985 lines)
- **Duplicate code patterns** across client/server (~650 lines reducible)
- **Tight coupling** between services and repositories

**Estimated improvement potential:** 20-30% reduction in code, 40% faster feature development for import/export features.

---

## Project Context & Shared Primitives

### Multi-Platform Architecture

Character Architect shares primitives with:
1. **Hosting Platform** - Character card hosting service
2. **Archive Tool** - Bulk card processing and archival

All three projects should leverage shared packages from `@character-foundry/*`:
- `@character-foundry/core` - ZIP, MIME, buffer utilities
- `@character-foundry/png` - PNG text chunk handling
- `@character-foundry/charx` - CHARX format read/write
- `@character-foundry/voxta` - Voxta format read/write
- `@character-foundry/loader` - Universal card parser
- `@character-foundry/schemas` - CCv2/CCv3 type definitions

### Abstraction Goals

**Key Principle:** Minimize duplicate code between:
- **Web/Hosted mode** - Full server with SQLite database
- **Lite/PWA mode** - Client-only with IndexedDB/localStorage

Functions that exist in both modes should be extracted to:
1. Shared primitives in `@character-foundry/*` packages (format-agnostic)
2. Abstract adapters with mode-specific implementations

---

## Planned Feature Changes

### ComfyUI Integration - TO BE SCRAPPED

**Current:** Full ComfyUI client implementation in `apps/api/src/routes/comfyui.ts` (1,206 lines) and `apps/api/src/services/comfyui-client.ts` (635 lines).

**Planned Replacement:**
- Replace with iframe embedding of local ComfyUI instance
- API endpoint to fetch generated images from ComfyUI output folder
- Remove all workflow management, node configuration, and queue handling code

**Action:** Leave stub routes for backwards compatibility, mark as deprecated:
```typescript
// TODO: ComfyUI integration scrapped - will be replaced with:
// 1. Iframe to embed local ComfyUI UI
// 2. Simple API to fetch images from ComfyUI output directory
// See: docs/CODE_ANALYSIS_2024-12.md
```

---

## 1. CRITICAL: Monolithic Route Files

### The Problem
| File | Lines | Responsibility Count |
|------|-------|---------------------|
| `import-export.ts` | 1,985 | 8+ endpoints, 4 formats, validation, normalization |
| `comfyui.ts` | 1,206 | Full ComfyUI integration (TO BE SCRAPPED) |
| `image-archival.ts` | 663 | URL archival + rewriting |

**Impact on Feature Development:**
- Adding a new import format requires understanding 2,000 lines of code
- Bug fixes risk breaking unrelated functionality
- No clear ownership boundaries

### Recommendation: Format Handler Pattern

```
apps/api/src/
├── routes/
│   └── import-export.ts          # ~200 lines - routing only
├── handlers/
│   ├── format-handler.interface.ts
│   ├── png-handler.ts            # ~150 lines
│   ├── charx-handler.ts          # ~200 lines
│   ├── voxta-handler.ts          # ~200 lines
│   └── json-handler.ts           # ~100 lines
└── utils/
    └── card-normalization.ts     # Extract from route file
```

**Benefit:** Each format is independently testable, ~80% code isolation.

---

## 2. HIGH: Duplicate Code Patterns

### 2.1 Thumbnail Creation (88 lines × 2) - CANDIDATE FOR PRIMITIVE

**Files:**
- `apps/web/src/lib/client-import.ts:100-187`
- `apps/web/src/lib/web-import-handler.ts:49-111`

**Identical logic:** Canvas resizing, WebP/JPEG fallback, timeout handling.

**Recommendation:** Add to `@character-foundry/core` or create `@character-foundry/media`:
```typescript
// @character-foundry/media
export function createThumbnail(
  imageData: Uint8Array | string,  // Buffer or data URL
  options: { maxSize?: number; format?: 'webp' | 'jpeg'; quality?: number }
): Promise<Uint8Array>;
```

**Benefit:** Hosting platform and archive tool can also use this.

### 2.2 Card Normalization (274 lines × 5 usages) - CANDIDATE FOR PRIMITIVE

**Locations where normalization is repeated:**
1. `import-export.ts:36-203` - Main normalization
2. `cards.ts` - Inline normalization calls
3. `web-import/utils.ts` - Partial normalization
4. `web-import/handlers/character-tavern.ts` - Format-specific normalization

**Recommendation:** Add to `@character-foundry/schemas`:
```typescript
// @character-foundry/schemas
export class CardNormalizer {
  static normalize(data: unknown, spec: 'v2' | 'v3'): CCv2Data | CCv3Data;
  static normalizeLorebookEntries(book: CharacterBook): CharacterBook;
  static fixTimestamps(data: CCv3Data): CCv3Data;  // CharacterTavern ms->s fix
}
```

**Benefit:** All tools importing cards get consistent normalization.

### 2.3 Template/Snippet Store Operations (300+ lines)

**File:** `apps/web/src/store/template-store.ts` (552 lines)

Templates and snippets have **identical patterns** for:
- `load()` / `create()` / `update()` / `delete()`
- `export()` / `import()` / `reset()`

**Fix:** Generic entity store factory:
```typescript
const useTemplateStore = createEntityStore<Template>('templates', '/api/templates');
const useSnippetStore = createEntityStore<Snippet>('snippets', '/api/snippets');
```

**Estimated reduction:** 300 lines → 50 lines

### 2.4 Deployment Mode Checks (scattered) - CRITICAL FOR WEB/LITE ABSTRACTION

**Pattern repeated 29 times across stores:**
```typescript
const config = getDeploymentConfig();
if (config.mode === 'light' || config.mode === 'static') {
  // localStorage/IndexedDB
} else {
  // API call
}
```

**Fix:** Persistence adapter abstraction:
```typescript
// apps/web/src/adapters/persistence.ts
interface PersistenceAdapter {
  load<T>(key: string): Promise<T>;
  save<T>(key: string, data: T): Promise<void>;
  delete(key: string): Promise<void>;
}

class ServerPersistenceAdapter implements PersistenceAdapter { /* API calls */ }
class LocalPersistenceAdapter implements PersistenceAdapter { /* IndexedDB */ }

// Auto-selects based on deployment mode
export const persistence = createPersistenceAdapter();
```

**Benefit:** Single code path in stores, mode selection happens once at startup.

### 2.5 UUID Generation (duplicated)

**Locations:**
- `apps/web/src/lib/client-import.ts:17-27`
- `@character-foundry/voxta/writer.ts:13-19`
- Various other locations

**Recommendation:** Add to `@character-foundry/core`:
```typescript
// @character-foundry/core
export function generateUUID(): string;
```

### 2.6 Data URL Conversion - CANDIDATE FOR PRIMITIVE

**Pattern repeated in multiple files:**
```typescript
function uint8ArrayToDataURL(buffer: Uint8Array, mimeType: string): string
function dataURLToUint8Array(dataUrl: string): { buffer: Uint8Array; mimeType: string }
```

**Recommendation:** Add to `@character-foundry/core`:
```typescript
// @character-foundry/core
export function toDataURL(buffer: Uint8Array, mimeType: string): string;
export function fromDataURL(dataUrl: string): { buffer: Uint8Array; mimeType: string };
```

---

## 3. HIGH: Service Layer Tight Coupling

### Current Problem

`CardImportService` and `VoxtaImportService` directly manipulate 3 repositories:

```typescript
// card-import.service.ts - 23+ direct repository calls
this.cardRepo.create()
this.assetRepo.create()
this.cardAssetRepo.create()
this.cardAssetRepo.setMain()
```

**Issues:**
1. No transaction boundaries - partial failures leave inconsistent state
2. Cannot test business logic without database
3. Services know too much about database structure

### Recommendation: Unit of Work Pattern

```typescript
class CardImportTransaction {
  private pendingCard?: CardData;
  private pendingAssets: AssetData[] = [];

  setCard(card: CardData): this { ... }
  addAsset(asset: AssetData): this { ... }

  async commit(): Promise<Card> {
    // Single transaction with rollback on failure
  }
}
```

**Benefit:** Atomic imports, testable business logic, clearer responsibilities.

---

## 4. MEDIUM: Repository Pattern Improvements

### Current State

`apps/api/src/db/repository.ts` has 3 separate repository classes (618 lines) with:
- Repeated row-to-entity mapping logic
- No base class for common operations
- Manual SQL construction

### Improvement: Base Repository

```typescript
abstract class BaseRepository<TEntity, TRow> {
  abstract tableName: string;
  abstract rowToEntity(row: TRow): TEntity;
  abstract entityToRow(entity: TEntity): TRow;

  // Common operations
  get(id: string): TEntity | null { ... }
  create(entity: Omit<TEntity, 'id'>): TEntity { ... }
  update(id: string, updates: Partial<TEntity>): TEntity | null { ... }
  delete(id: string): boolean { ... }
}
```

**Benefit:** ~150 lines reduction, consistent patterns, easier new entity types.

---

## 5. MEDIUM: State Management Improvements

### Monolithic Settings Store

**File:** `apps/web/src/store/settings-store.ts` (589 lines)

Contains 8 unrelated domains:
- Theme, Editor, Features, AI Prompts
- ComfyUI (TO BE REMOVED), Wwwyzzerdd, Creator Notes, Auto-snapshot

**Recommendation:** Split into domain stores:
```
store/
├── settings-store.ts      # Core settings only (~150 lines)
├── theme-store.ts         # Theme configuration
└── wwwyzzerdd-store.ts    # Wwwyzzerdd specific
```

Note: ComfyUI settings can be removed when feature is scrapped.

### Cross-Store Coupling

`card-store.ts` directly calls `useTokenStore.getState().updateTokenCounts()` in 8 locations.

**Fix:** React effect hook or store middleware:
```typescript
// useTokenSync.ts hook - handles token counting as side effect
useEffect(() => {
  if (currentCard) tokenStore.updateTokenCounts(currentCard);
}, [currentCard]);
```

---

## 6. LOW: Type Safety Improvements

### Feature Flag String Keys

```typescript
interface FeatureFlags {
  assetsEnabled: boolean;
  focusedEnabled: boolean;
  [key: string]: boolean; // ← Type-unsafe
}
```

**Fix:** Typed module registry:
```typescript
const MODULES = ['assets', 'focused', 'diff'] as const;
type ModuleId = typeof MODULES[number];
type FeatureFlags = Record<`${ModuleId}Enabled`, boolean>;
```

### Duplicate Validation Interfaces

Two separate validation interfaces exist:
- `apps/api/src/utils/validation.ts`
- `apps/api/src/utils/charx-validator.ts`

**Fix:** Single validation module with format-specific extensions.

---

## 7. Primitives to Add to @character-foundry/*

### @character-foundry/core (additions)
```typescript
// UUID generation
export function generateUUID(): string;

// Data URL utilities
export function toDataURL(buffer: Uint8Array, mimeType: string): string;
export function fromDataURL(dataUrl: string): { buffer: Uint8Array; mimeType: string };

// Base64 utilities (chunk-safe for large buffers)
export function uint8ArrayToBase64(buffer: Uint8Array): string;
export function base64ToUint8Array(base64: string): Uint8Array;
```

### @character-foundry/schemas (additions)
```typescript
// Card normalization
export class CardNormalizer {
  static normalize(data: unknown, spec: 'v2' | 'v3'): CCv2Data | CCv3Data;
  static normalizeLorebookEntries(book: CharacterBook): CharacterBook;
  static fixTimestamps(data: CCv3Data): CCv3Data;
}

// Spec detection (may already exist)
export function detectSpec(data: unknown): 'v2' | 'v3' | null;
```

### @character-foundry/media (new package - optional)
```typescript
// Thumbnail creation (works in browser and Node.js)
export function createThumbnail(
  imageData: Uint8Array | string,
  options?: ThumbnailOptions
): Promise<Uint8Array>;

// Image dimension detection
export function getImageDimensions(buffer: Uint8Array): { width: number; height: number } | null;
```

---

## 8. Action Plan (Prioritized)

### Phase 1: Quick Wins (1-2 days each)
1. Extract `createThumbnail` to shared location (or primitive)
2. Extract `normalizeCardData` to `@character-foundry/schemas`
3. Create persistence adapter abstraction for Web/Lite modes
4. Add UUID and data URL utilities to `@character-foundry/core`

### Phase 2: Store Refactoring (3-5 days)
1. Create generic entity store factory for templates/snippets
2. Split settings store (remove ComfyUI during this)
3. Extract token counting to effect hook

### Phase 3: ComfyUI Replacement (1 week)
1. Stub out existing ComfyUI routes with deprecation notice
2. Implement iframe-based ComfyUI embedding
3. Add simple image fetch API for ComfyUI output
4. Remove ComfyUI store state

### Phase 4: Service Layer (1 week)
1. Implement Unit of Work pattern for imports
2. Create base repository class
3. Add transaction support

### Phase 5: Route Modularization (1-2 weeks)
1. Extract format handlers from `import-export.ts`
2. Create handler interface and registry
3. Delete ComfyUI route file after migration complete

---

## Impact Summary

| Change | Lines Reduced | Dev Time Saved | Platforms Benefited |
|--------|--------------|----------------|---------------------|
| Thumbnail primitive | 88 | 2hr/feature | All 3 |
| Normalization primitive | 200+ | 4hr/bug fix | All 3 |
| Persistence adapter | 150+ | 1 day/mode | Architect |
| Store factory pattern | 300 | 1 day/store | Architect |
| Format handler pattern | 400 | 2 days/format | Architect |
| ComfyUI removal | 1,840 | Ongoing maintenance | Architect |
| Repository base class | 150 | 1 day/entity | Architect |
| **Total** | **~3,100 lines** | **40-50%** | - |

---

## End User Impact

From a user perspective, these changes enable:

1. **Faster bug fixes** - Isolated code means faster turnaround on issues
2. **More reliable imports** - Transaction support prevents partial imports
3. **Consistent behavior** - Centralized normalization means all formats work the same
4. **Easier feature requests** - New format support becomes 200-line task instead of 500-line task
5. **Better PWA experience** - Proper Web/Lite abstraction means feature parity

---

## Files to Reference

### Largest Files (candidates for refactoring)
- `apps/api/src/routes/import-export.ts` (1,985 lines)
- `apps/api/src/routes/comfyui.ts` (1,206 lines) - TO BE SCRAPPED
- `apps/api/src/routes/image-archival.ts` (663 lines)
- `apps/web/src/store/card-store.ts` (642 lines)
- `apps/api/src/services/card-import.service.ts` (636 lines)
- `apps/api/src/services/comfyui-client.ts` (635 lines) - TO BE SCRAPPED
- `apps/web/src/store/settings-store.ts` (589 lines)
- `apps/web/src/store/template-store.ts` (552 lines)

### Duplicate Code Locations
- Thumbnail: `client-import.ts:100-187`, `web-import-handler.ts:49-111`
- Normalization: `import-export.ts:36-203`, `cards.ts`, `web-import/utils.ts`
- UUID: `client-import.ts:17-27`, `@character-foundry/voxta/writer.ts:13-19`
- Deployment checks: 29 occurrences across store files
