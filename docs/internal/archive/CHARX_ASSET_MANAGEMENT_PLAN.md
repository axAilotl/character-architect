# CharX Asset Management Plan

## Executive Summary

This document outlines the plan for implementing robust CharX asset management in Card Architect, following the CharX v1.0 specification and best practices. The implementation focuses on **asset lifecycle management** rather than full CharX creation workflow automation.

## Current State Analysis

### ✅ Already Implemented

**Import Pipeline (Complete)**
- `charx-handler.ts` - ZIP extraction with yauzl
- `charx-import.service.ts` - Database integration
- Asset extraction with size limits and validation
- Asset linking to cards via `card_assets` junction table
- Original image detection and storage

**Export Pipeline (Complete)**
- `charx-builder.ts` - ZIP creation with yazl
- Asset URI transformation (internal → embeded://)
- Proper directory structure (assets/{type}/{subtype}/{index}.{ext})
- CHARX export from editor

**Asset Storage**
- Asset repository with CRUD operations
- CardAsset junction table with type/order metadata
- File storage in `/storage` directory
- Main asset flag support

**UI**
- Asset upload in Advanced tab (EditPanel.tsx:756-780)
- Asset grid display with previews (EditPanel.tsx:793-871)
- Set main / delete actions
- Asset preview modal

### ⚠️ Current Limitations

1. **No asset type categorization** - All uploads go to generic asset pool
2. **No portrait/expression management** - No helpers for main portrait, expression sheets
3. **No background management** - No dedicated background handling
4. **No animated asset detection** - GIF/APNG not identified
5. **No actor binding** - No tags like `actor-2`, `portrait-override`
6. **No asset validation** - Missing uniqueness checks, name deduplication
7. **No asset graph** - Assets not represented as an in-memory domain model
8. **Limited UI** - No portrait picker, expression organizer, or background selector

## Implementation Plan

### Phase 1: Asset Domain Model (Foundation)

**Goal**: Create an in-memory asset graph with proper type categorization

#### 1.1 Asset Type System
```typescript
// packages/schemas/src/asset-types.ts
export type AssetType =
  | 'icon'           // Character portrait
  | 'background'     // Scene background
  | 'emotion'        // Expression/emotion variant
  | 'user_icon'      // User avatar
  | 'sound'          // Audio assets
  | 'custom';        // Other

export type AssetTag =
  | 'portrait-override'  // Main portrait
  | `actor-${number}`    // Actor binding (actor-1, actor-2, ...)
  | 'animated'           // GIF/APNG
  | 'expression'         // Expression variant
  | 'main-background';   // Primary background

export interface AssetMetadata {
  type: AssetType;
  tags: AssetTag[];
  actorIndex?: number;    // Parsed from actor-N tag
  isAnimated: boolean;    // Auto-detected from MIME
  order: number;          // Display/export order
  hash?: string;          // SHA-256 for deduplication
}
```

#### 1.2 Asset Graph Service
```typescript
// apps/api/src/services/asset-graph.service.ts
export class AssetGraphService {
  // Build in-memory graph from database
  async buildGraph(cardId: string): Promise<AssetNode[]>;

  // Helpers per blueprint
  getMainPortrait(graph: AssetNode[]): AssetNode | null;
  listExpressions(graph: AssetNode[], actorIndex: number): AssetNode[];
  getMainBackground(graph: AssetNode[]): AssetNode | null;

  // Validation
  validateUniqueness(graph: AssetNode[]): ValidationError[];
  deduplicateNames(graph: AssetNode[]): AssetNode[];

  // Tag management
  setPortraitOverride(graph: AssetNode[], assetId: string): AssetNode[];
  bindToActor(graph: AssetNode[], assetId: string, actorIndex: number): AssetNode[];
}
```

**Files to Create:**
- `packages/schemas/src/asset-types.ts` - Type definitions
- `apps/api/src/services/asset-graph.service.ts` - Graph operations
- `apps/api/src/services/asset-validator.service.ts` - Validation rules

**Files to Modify:**
- `apps/api/src/db/schema.ts` - Add `tags` column to `card_assets` table
- `apps/api/src/db/repository.ts` - Update CardAssetRepository for tags

### Phase 2: Enhanced Import Pipeline

**Goal**: Proper asset categorization and tag extraction during import

#### 2.1 Import Enhancements
```typescript
// apps/api/src/services/charx-import.service.ts

// Extract tags from asset descriptor
private extractTags(descriptor: AssetDescriptor): AssetTag[] {
  const tags: AssetTag[] = [];

  // Extract actor binding
  if (descriptor.tags?.some(t => t.startsWith('actor-'))) {
    tags.push(...descriptor.tags.filter(t => t.startsWith('actor-')));
  }

  // Detect portrait override
  if (descriptor.name === 'main' && descriptor.type === 'icon') {
    tags.push('portrait-override');
  }

  // Detect animations
  if (descriptor.ext && ['gif', 'apng'].includes(descriptor.ext)) {
    tags.push('animated');
  }

  return tags;
}

// Auto-detect asset metadata
private async detectMetadata(buffer: Buffer, descriptor: AssetDescriptor): Promise<AssetMetadata> {
  const metadata: AssetMetadata = {
    type: descriptor.type || 'custom',
    tags: this.extractTags(descriptor),
    order: 0,
    isAnimated: false,
  };

  // Detect animation from buffer
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    metadata.isAnimated = true;
    if (!metadata.tags.includes('animated')) {
      metadata.tags.push('animated');
    }
  }

  // Parse actor index from tags
  const actorTag = metadata.tags.find(t => t.startsWith('actor-'));
  if (actorTag) {
    metadata.actorIndex = parseInt(actorTag.split('-')[1], 10);
  }

  return metadata;
}
```

**Files to Modify:**
- `apps/api/src/services/charx-import.service.ts` - Add metadata extraction
- `apps/api/src/utils/charx-handler.ts` - Parse tags from descriptor

### Phase 3: Asset Management UI

**Goal**: User-friendly asset organization tools

#### 3.1 Portrait Manager Component
```typescript
// apps/web/src/components/PortraitManager.tsx
export function PortraitManager({ cardId }: { cardId: string }) {
  const [portraits, setPortraits] = useState<AssetNode[]>([]);
  const [mainPortrait, setMainPortrait] = useState<AssetNode | null>(null);

  // Display main portrait prominently
  // Grid of expressions below
  // Upload button with auto-categorization
  // Set as main action
  // Actor binding dropdown
}
```

#### 3.2 Background Manager Component
```typescript
// apps/web/src/components/BackgroundManager.tsx
export function BackgroundManager({ cardId }: { cardId: string }) {
  const [backgrounds, setBackgrounds] = useState<AssetNode[]>([]);
  const [mainBackground, setMainBackground] = useState<AssetNode | null>(null);

  // Replace background action
  // Upload with auto-main flag
  // Preview in card context
}
```

#### 3.3 Enhanced Asset Grid
Update `EditPanel.tsx` asset section:
- **Categorized tabs**: Portraits | Backgrounds | Audio | Other
- **Type-specific actions**: "Set as Main Portrait", "Bind to Actor 2", etc.
- **Auto-tagging on upload**: Prompt for asset type and purpose
- **Animated asset indicator**: Badge for GIF/APNG

**Files to Create:**
- `apps/web/src/components/PortraitManager.tsx`
- `apps/web/src/components/BackgroundManager.tsx`
- `apps/web/src/components/AssetTagEditor.tsx`

**Files to Modify:**
- `apps/web/src/components/EditPanel.tsx` - Replace asset section with tabs

### Phase 4: Export Validation & Consistency

**Goal**: Ensure exports are deterministic and valid

#### 4.1 Pre-Export Validator
```typescript
// apps/api/src/utils/charx-validator.ts
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[]; // Applied auto-fixes
}

export async function validateCharxExport(
  card: CCv3Data,
  assets: CardAssetWithDetails[]
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    fixes: [],
  };

  // Rule: At least one portrait
  const portraits = assets.filter(a => a.type === 'icon');
  if (portraits.length === 0) {
    result.errors.push('Card must have at least one portrait asset');
    result.valid = false;
  }

  // Rule: Unique asset names
  const names = assets.map(a => a.name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    result.warnings.push(`Duplicate asset names: ${duplicates.join(', ')}`);
    // Auto-fix: append index
    result.fixes.push('Renamed duplicate assets');
  }

  // Rule: Valid URIs
  const invalidUris = card.data.assets?.filter(a => {
    const uri = a.uri;
    return uri.startsWith('embeded://') && !assets.find(asset =>
      uri.includes(asset.name)
    );
  });
  if (invalidUris && invalidUris.length > 0) {
    result.errors.push(`${invalidUris.length} assets reference missing files`);
    result.valid = false;
  }

  // Rule: Recompute hashes
  for (const asset of assets) {
    // Compute SHA-256 of asset bytes
    // Update descriptor hash
  }
  result.fixes.push('Recomputed asset hashes');

  return result;
}
```

#### 4.2 Export API Enhancement
```typescript
// apps/api/src/routes/import-export.ts
fastify.get<{ Params: { id: string } }>('/cards/:id/export', async (request, reply) => {
  // ... existing code ...

  if (format === 'charx') {
    // NEW: Validate before export
    const validation = await validateCharxExport(card.data as CCv3Data, cardAssets);

    if (!validation.valid) {
      reply.code(400);
      return {
        error: 'Card validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // Log auto-fixes
    if (validation.fixes.length > 0) {
      fastify.log.info({ fixes: validation.fixes }, 'Applied CharX export fixes');
    }

    // Continue with export...
  }
});
```

**Files to Create:**
- `apps/api/src/utils/charx-validator.ts` - Validation rules

**Files to Modify:**
- `apps/api/src/routes/import-export.ts` - Add pre-export validation
- `apps/api/src/utils/charx-builder.ts` - Apply fixes before build

### Phase 5: Asset Utilities & Helpers

**Goal**: Developer experience and maintenance tools

#### 5.1 Asset Diagnostic Endpoint
```typescript
// apps/api/src/routes/assets.ts
fastify.get<{ Params: { id: string } }>('/cards/:id/assets/diagnostics', async (request, reply) => {
  const cardAssets = cardAssetRepo.listByCardWithDetails(request.params.id);
  const graph = await assetGraphService.buildGraph(request.params.id);

  return {
    summary: {
      total: cardAssets.length,
      byType: countByType(cardAssets),
      animated: cardAssets.filter(a => a.tags?.includes('animated')).length,
    },
    issues: {
      duplicateNames: findDuplicates(cardAssets),
      missingFiles: findMissingFiles(cardAssets),
      orphanedAssets: findOrphaned(cardAssets, card.data.assets),
    },
    helpers: {
      mainPortrait: assetGraphService.getMainPortrait(graph),
      mainBackground: assetGraphService.getMainBackground(graph),
      actors: listActors(graph),
    },
  };
});
```

#### 5.2 Bulk Asset Operations
```typescript
// apps/api/src/routes/assets.ts

// Reorder assets
fastify.patch<{ Params: { id: string } }>('/cards/:id/assets/reorder', async (request, reply) => {
  const { assetIds } = request.body as { assetIds: string[] };
  // Update order field for each asset
});

// Retag assets
fastify.patch<{ Params: { id: string }; Body: { assetId: string; tags: AssetTag[] } }>(
  '/cards/:id/assets/:assetId/tags',
  async (request, reply) => {
    // Update asset tags
  }
);

// Generate thumbnail from animated asset
fastify.post<{ Params: { id: string; assetId: string } }>(
  '/cards/:id/assets/:assetId/thumbnail',
  async (request, reply) => {
    // Use Sharp to extract first frame
  }
);
```

**Files to Create:**
- None (extend existing routes)

**Files to Modify:**
- `apps/api/src/routes/assets.ts` - Add diagnostic and bulk operation endpoints

## Implementation Priority

### 🚀 High Priority (Core Functionality)
1. **Phase 1.1** - Asset type system and tags (1-2 days)
2. **Phase 2.1** - Import metadata extraction (1 day)
3. **Phase 4.1** - Export validation (1 day)

### 🎯 Medium Priority (UX Improvements)
4. **Phase 1.2** - Asset graph service (2 days)
5. **Phase 3.1** - Portrait manager UI (2 days)
6. **Phase 3.3** - Enhanced asset grid (1-2 days)

### 💡 Low Priority (Polish)
7. **Phase 3.2** - Background manager (1 day)
8. **Phase 5.1** - Diagnostics endpoint (1 day)
9. **Phase 5.2** - Bulk operations (1 day)

**Total Estimated Effort**: 10-13 days

## Database Schema Changes

### Migration 1: Add Tags to card_assets
```sql
-- Add tags column (JSON array)
ALTER TABLE card_assets ADD COLUMN tags TEXT;

-- Update existing assets with empty array
UPDATE card_assets SET tags = '[]' WHERE tags IS NULL;
```

### Migration 2: Add Hash Column
```sql
-- Add hash column for deduplication
ALTER TABLE card_assets ADD COLUMN hash TEXT;
```

## API Changes

### New Endpoints
```
GET    /cards/:id/assets/diagnostics       # Asset health check
PATCH  /cards/:id/assets/reorder           # Bulk reorder
PATCH  /cards/:id/assets/:assetId/tags     # Update tags
POST   /cards/:id/assets/:assetId/thumbnail # Generate thumbnail from animated
```

### Modified Endpoints
```
GET    /cards/:id/assets                   # Include tags in response
POST   /assets                             # Accept type/tags in upload
GET    /cards/:id/export                   # Add validation step for CharX
```

## Testing Strategy

### Unit Tests
- Asset graph service (getMainPortrait, listExpressions, etc.)
- Asset validator (uniqueness, missing files, hash computation)
- Tag extraction (actor-N, animated, portrait-override)

### Integration Tests
- Import CharX with multiple actors and expressions
- Export validation (reject cards with no portrait)
- Round-trip (import → edit → export → import)

### Test Fixtures
- `test-fixtures/multi-actor.charx` - 2 actors with 5 expressions each
- `test-fixtures/animated-portrait.charx` - GIF portrait
- `test-fixtures/missing-assets.charx` - Invalid URIs (should fail validation)

## Success Criteria

✅ **Import**
- Tags extracted from CharX descriptors
- Animated assets auto-detected
- Actor bindings preserved

✅ **Management**
- UI can set main portrait
- UI can bind assets to actors
- UI categorizes by type (portraits, backgrounds, etc.)

✅ **Export**
- Validator catches missing assets
- Validator deduplicates names
- Hashes recomputed for deterministic exports

✅ **Diagnostics**
- Diagnostics endpoint shows asset health
- Lists orphaned assets
- Identifies missing main portrait/background

## Out of Scope (Future Enhancements)

- ❌ Automated background generation from portraits
- ❌ Asset transformation tools (crop, resize) in UI
- ❌ Expression sheet slicing (auto-detect grid)
- ❌ Asset preview in prompt simulator
- ❌ Asset usage analytics (which expressions used most in chats)
- ❌ Asset CDN/remote hosting

## References

- CharX v1.0 Specification: `/CHARX_CARDS.md`
- Tavern v3 Schema: `packages/schemas/src/ccv3-schema.ts`
- Existing Implementation:
  - Import: `apps/api/src/services/charx-import.service.ts`
  - Export: `apps/api/src/utils/charx-builder.ts`
  - Handler: `apps/api/src/utils/charx-handler.ts`

---

**Document Version**: 1.0
**Date**: 2025-11-18
**Status**: Planning Phase
