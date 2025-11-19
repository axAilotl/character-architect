# CharX Asset Management Implementation Status

## Overview
Implementation of CharX v1.0 asset management system for Card Architect, following the blueprint provided. This includes support for WebP (animated), WebM video, and comprehensive asset tagging.

## Completed Phases

### Phase 1: Asset Type System & Database Schema ✅

**1.1 Asset Type Definitions** (`packages/schemas/src/asset-types.ts`)
- ✅ Comprehensive asset type system with 6 core types (icon, background, emotion, user_icon, sound, custom)
- ✅ Asset tag system (portrait-override, actor-N, animated, expression, main-background)
- ✅ Format definitions for all supported media types:
  - Images: PNG, JPEG, WebP (static & animated), GIF, AVIF
  - Video: MP4, WebM
  - Audio: MP3, WAV, OGG
- ✅ Animated asset detection via buffer analysis:
  - GIF: Multi-frame detection
  - APNG: acTL chunk detection
  - WebP: VP8X extended format with animation bit
  - WebM/MP4: Video format detection
- ✅ Helper functions: `hasTag()`, `addTag()`, `removeTag()`, `parseActorIndex()`

**1.2 Database Schema Updates** (`apps/api/src/db/schema.ts`)
- ✅ Added `tags` column to `card_assets` table (JSON array storage)
- ✅ Migration for existing databases
- ✅ Updated repository layer for tag CRUD operations

**1.3 Repository Layer** (`apps/api/src/db/repository.ts`)
- ✅ CardAssetRepository enhanced with tag support
- ✅ JSON serialization/deserialization for tags
- ✅ Tag storage in create/update operations
- ✅ Tag parsing in read operations

### Phase 2: Asset Graph Service ✅

**Implementation** (`apps/api/src/services/asset-graph.service.ts`)
- ✅ `buildGraph()` - Converts database records to in-memory graph
- ✅ `getMainPortrait()` - Returns portrait-override or main icon
- ✅ `listExpressions(actorIndex)` - Lists actor-bound expressions
- ✅ `listPortraits()` - All icon assets
- ✅ `getMainBackground()` - Returns main-background or main background asset
- ✅ `listBackgrounds()` - All background assets
- ✅ `listActors()` - All actor indices referenced
- ✅ `getAssetsByActor(actorIndex)` - Assets for specific actor
- ✅ `listAnimatedAssets()` - Filtered animated assets
- ✅ `validateGraph()` - Comprehensive validation:
  - No duplicate names
  - Only one portrait-override tag
  - Only one main-background tag
  - Continuous actor indices starting from 1
- ✅ `deduplicateNames()` - Auto-fix duplicate names by appending index
- ✅ `setPortraitOverride()` - Exclusive portrait-override management
- ✅ `setMainBackground()` - Exclusive main-background management
- ✅ `bindToActor()` - Set actor-N tag
- ✅ `unbindFromActor()` - Remove actor binding
- ✅ `reorderAssets()` - Update order field
- ✅ `applyChanges()` - Persist graph modifications to database

### Phase 3: Import Enhancement ✅

**CharX Import Service** (`apps/api/src/services/charx-import.service.ts`)
- ✅ `extractTags()` method with intelligent tag detection:
  - Parses tags from CharX descriptor (extended format support)
  - Auto-detects `portrait-override` for main icons
  - Auto-detects `main-background` for main backgrounds
  - Auto-detects `animated` tag via `detectAnimatedAsset()`
- ✅ Tag extraction integrated into asset import workflow
- ✅ Tags stored with card assets during import
- ✅ Detailed logging of extracted tags

### Phase 4: Export Validation ✅

**CharX Validator** (`apps/api/src/utils/charx-validator.ts`)
- ✅ `validateCharxExport()` - Pre-export validation with 6 rules:
  1. At least one portrait (icon) asset required
  2. Unique asset names (auto-fixes duplicates)
  3. Valid URIs in card data (embeded:// assets must exist)
  4. Asset files exist on disk
  5. Deterministic hash computation
  6. Tag consistency validation
- ✅ `applyExportFixes()` - Auto-fix capabilities:
  - Deduplicate names by appending index
  - Normalize asset order for deterministic export
- ✅ `computeAssetHash()` - SHA-256 hash computation
- ✅ `normalizeAssetOrder()` - Sort by type → order → name
- ✅ Validation result structure with errors, warnings, and fixes

**Export Endpoint Integration** (`apps/api/src/routes/import-export.ts:989-1056`)
- ✅ Pre-export validation before CharX build
- ✅ Returns 400 error with validation details on failure
- ✅ Auto-applies fixes for duplicate names and order
- ✅ Enhanced logging with validation metrics
- ✅ Clear error messages for validation failures

## Testing Coverage

### Automated Validation
- ✅ Type safety across all asset operations (TypeScript compilation passes)
- ✅ Schema migration executes without errors
- ✅ Import/export endpoints build successfully

### Manual Testing Required
- ⚠️ CharX import with tagged assets (requires test file with tags)
- ⚠️ CharX export validation with missing assets
- ⚠️ CharX export with duplicate asset names (auto-fix)
- ⚠️ Animated asset detection (WebP, WebM, GIF, APNG)
- ⚠️ Tag consistency validation (multiple portrait-override, main-background)

## File Changes Summary

### New Files Created
1. `packages/schemas/src/asset-types.ts` (301 lines)
   - Asset type system, tags, format definitions, animated detection
2. `apps/api/src/services/asset-graph.service.ts` (436 lines)
   - In-memory asset graph operations
3. `apps/api/src/utils/charx-validator.ts` (247 lines)
   - Pre-export validation and auto-fixes

### Modified Files
1. `packages/schemas/src/index.ts`
   - Exported asset-types module
2. `packages/schemas/src/types.ts`
   - Added `tags?: string[]` to CardAsset interface
3. `apps/api/src/db/schema.ts`
   - Added `tags` column to `card_assets` table
   - Added migration for existing databases
4. `apps/api/src/db/repository.ts`
   - Updated CardAssetRepository for tag CRUD operations
5. `apps/api/src/services/charx-import.service.ts`
   - Added tag extraction with auto-detection
6. `apps/api/src/routes/import-export.ts`
   - Integrated pre-export validation
7. `apps/api/src/utils/charx-handler.ts`
   - WebP and WebM support in CHARX extraction

## Implementation Highlights

### Animated Asset Detection
The system can detect animated assets across multiple formats:

```typescript
// WebP - check VP8X extended format with animation bit
if (mimeType === 'image/webp') {
  const vp8x = Buffer.from('VP8X');
  for (let i = 0; i < buffer.length - 10; i++) {
    if (buffer.slice(i, i + 4).equals(vp8x)) {
      const flags = buffer[i + 8];
      return (flags & 0x02) !== 0; // Animation bit
    }
  }
}

// WebM/MP4 - always considered animated (video)
if (mimeType === 'video/webm' || mimeType === 'video/mp4') {
  return true;
}
```

### Tag Auto-Detection
Import service automatically detects special tags:

```typescript
// Auto-detect portrait override for main icons
if (descriptor.name === 'main' && descriptor.type === 'icon') {
  if (!tags.includes('portrait-override')) {
    tags.push('portrait-override');
  }
}

// Auto-detect main background
if (descriptor.name === 'main' && descriptor.type === 'background') {
  if (!tags.includes('main-background')) {
    tags.push('main-background');
  }
}

// Detect animated assets from buffer
if (buffer && !tags.includes('animated')) {
  const isAnimated = detectAnimatedAsset(buffer, mimetype);
  if (isAnimated) {
    tags.push('animated');
  }
}
```

### Export Validation
Pre-export validation ensures CharX exports are valid:

```typescript
// Validate CHARX structure before export
const exportValidation = await validateCharxExport(
  card.data as CCv3Data,
  assets,
  config.storagePath
);

// Return error if validation fails
if (exportValidation.errors.length > 0) {
  reply.code(400);
  return {
    error: 'Cannot export CHARX: validation errors',
    errors: exportValidation.errors,
    warnings: exportValidation.warnings,
  };
}

// Apply auto-fixes
if (exportValidation.fixes.length > 0) {
  assets = applyExportFixes(assets);
}
```

## Commits

1. **feat: add asset type system with WebP/WebM support and tags**
   - Asset type definitions, format information, animated detection
   - Database schema migration for tags column
   - Repository layer updates for tag CRUD

2. **feat: add AssetGraphService and enhanced import with tag extraction**
   - Complete asset graph service implementation
   - Tag extraction in import service
   - Auto-detection for portrait-override, main-background, animated

3. **feat: add pre-export validation to CharX export endpoint**
   - CharX validator with 6 validation rules
   - Integration into export endpoint
   - Auto-fix capabilities for duplicate names and order

4. **feat: add comprehensive asset management API endpoints**
   - 8 card-specific asset management endpoints
   - Asset graph query with validation
   - Upload with tag auto-detection
   - Tag management and actor binding
   - Asset reordering via graph operations

### Phase 6: API Enhancement ✅

**Implementation** (`apps/api/src/routes/assets.ts`)
- ✅ `GET /api/cards/:id/asset-graph` - Query asset graph with validation summary
- ✅ `POST /api/cards/:id/assets/upload` - Upload assets with auto-detection
- ✅ `PATCH /api/cards/:id/assets/:assetId` - Update name, tags, order, isMain
- ✅ `POST /api/cards/:id/assets/reorder` - Reorder via graph operations
- ✅ `POST /api/cards/:id/assets/:assetId/set-portrait-override` - Set main portrait
- ✅ `POST /api/cards/:id/assets/:assetId/set-main-background` - Set main background
- ✅ `POST /api/cards/:id/assets/:assetId/bind-actor` - Bind to actor-N
- ✅ `POST /api/cards/:id/assets/:assetId/unbind-actor` - Remove actor binding

**Features**:
- Asset graph returns validation status, main portrait, main background, actors, animated count
- Upload auto-detects animated tag via `detectAnimatedAsset()`
- Tag management ensures exclusive tags (portrait-override, main-background)
- Actor binding with automatic actor-N tag management
- Reordering via asset graph with transactional updates
- Comprehensive error handling and card validation

## Next Steps (Not Yet Implemented)

### Phase 5: UI Integration (Planned)
- Asset upload with drag-and-drop
- Asset preview with type indicators
- Tag management UI (add/remove tags)
- Actor binding interface
- Asset reordering (drag-and-drop)
- Animated asset preview
- Batch operations (delete, retag, reorder)

## Technical Decisions

### Tag Storage
- **Decision**: Store tags as JSON array in SQLite TEXT column
- **Rationale**: SQLite doesn't have native JSON type, but JSON.stringify/parse provides reliable serialization
- **Trade-off**: Cannot use SQL queries to filter by tags, but keeps schema simple

### Animated Detection
- **Decision**: Analyze buffer bytes instead of relying on file extensions
- **Rationale**: More reliable detection of animated content
- **Implementation**: Format-specific magic byte and chunk analysis

### Tag Auto-Detection
- **Decision**: Automatically apply portrait-override and main-background tags during import
- **Rationale**: Reduces manual tagging burden, follows CharX conventions
- **Safety**: Only applies if not already present in descriptor

### Export Validation
- **Decision**: Block invalid exports with clear error messages
- **Rationale**: Prevents creating malformed CharX files
- **User Experience**: Auto-fixes common issues (duplicate names) when possible

## Known Limitations

1. **No UI for tag management**: Tags can only be set during import or via direct database modification
2. **No asset upload endpoint**: Assets can only be added via CharX import
3. **No asset preview in UI**: Cannot view assets without exporting
4. **Manual testing incomplete**: Need test CharX files with tags to verify end-to-end flow

## Branch Information

- **Branch**: `feature/charx-asset-management`
- **Base**: `main`
- **Status**: Implementation complete, testing pending
- **Ready for**: Code review, manual testing, UI integration planning
