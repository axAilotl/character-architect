# New Features: Deduplicated Image Utils & Feature Derivation

**Date**: 2025-12-15
**Packages**: `@character-foundry/schemas`, `@character-foundry/image-utils`

## Overview

We've created two canonical implementations to eliminate duplicate code across Archive, Federation, and Architect:

1. **Feature Derivation** (`@character-foundry/schemas`) - Unified feature extraction from character cards
2. **Image Utilities** (`@character-foundry/image-utils`) - URL extraction and SSRF protection

These replace 3 separate implementations with production-grade, tested utilities.

## What's New

### 1. Feature Derivation (`@character-foundry/schemas`)

**New Exports:**
- `deriveFeatures(card)` - Extract all features from CCv2/CCv3 cards
- `DerivedFeatures` type - Standardized feature flags interface

**Features Detected:**
- Alternate greetings (count + flag)
- Total greetings (first_mes + alternates)
- Lorebook entries (count + flag)
- Embedded images (data URLs)
- Gallery assets (V3 only)
- Extensions: RisuAI, Depth Prompt, Voxta
- Token counts (placeholder for tokenizers package)

**Usage:**
```typescript
import { deriveFeatures } from '@character-foundry/schemas';

const features = deriveFeatures(card.data);
console.log(`${features.totalGreetingsCount} greetings`);
console.log(`${features.lorebookEntriesCount} lorebook entries`);

if (features.hasEmbeddedImages) {
  console.log(`⚠️ ${features.embeddedImagesCount} embedded images detected`);
}
```

### 2. Image URL Extraction (`@character-foundry/image-utils`)

**New Exports:**
- `extractImageUrls(text, options?)` - Extract all image URLs from text
- `extractRemoteImageUrls(text)` - Filter for HTTP/HTTPS only
- `extractDataUrls(text)` - Filter for base64 only
- `countImages(text)` - Quick count without full extraction
- `ExtractedImage` type - URL + source + context

**Supported Formats:**
- Markdown: `![alt](url)`, `![alt](<url>)`, `![alt](url =WxH)`
- HTML img: `<img src="url">`, `<img src='url'>`, `<img src=url>`
- CSS url(): `url(path)`, `url("path")`, `url('path')`
- Plain URLs: `https://example.com/image.png`
- Base64: `data:image/png;base64,...`

**Usage:**
```typescript
import { extractImageUrls, extractRemoteImageUrls } from '@character-foundry/image-utils';

// Extract all formats
const images = extractImageUrls(card.description);
// [
//   { url: 'avatar.png', source: 'markdown', context: '![avatar](avatar.png)' },
//   { url: 'data:image/png;base64,...', source: 'base64' }
// ]

// Only remote URLs (for archival)
const remoteImages = extractRemoteImageUrls(card.description);
// [{ url: 'https://example.com/banner.jpg', source: 'html' }]
```

### 3. SSRF Protection (`@character-foundry/image-utils`)

**New Exports:**
- `isURLSafe(url, policy?)` - Validate URL against SSRF policy
- `isSafeForFetch(url)` - Quick check with default policy
- `filterSafeUrls(urls, policy?)` - Batch filter
- `SSRFPolicy` type - Security configuration
- `DEFAULT_SSRF_POLICY` - Secure defaults

**Protection Against:**
- Private IPs: 10.x, 172.16-31.x, 192.168.x, 169.254.x (AWS metadata)
- IPv6 private: fc00::/7, fe80::/10
- Localhost: 127.x, ::1, localhost, 0.0.0.0
- Data URLs (configurable)
- Domain allowlist/blocklist with wildcard support

**Usage:**
```typescript
import { isURLSafe, filterSafeUrls } from '@character-foundry/image-utils';

// Simple validation
const check = isURLSafe('http://10.0.0.1/secret');
if (!check.safe) {
  console.error('SSRF risk:', check.reason);
}

// Custom policy
const safe = isURLSafe(url, {
  allowPrivateIPs: true,  // Allow internal network
  blockedDomains: ['*.internal.company.com']
});

// Batch filtering
const safeUrls = filterSafeUrls(extractedUrls);
```

## Migration Guide

### A. Character Federation

**Before:**
```typescript
// character-federation/src/lib/card-metadata.ts
function deriveCardMetadata(card: CCv2Data | CCv3DataInner) {
  const altGreetings = card.alternate_greetings ?? [];
  const greetingsCount = 1 + altGreetings.length;

  const characterBook = card.character_book;
  const lorebookCount = characterBook?.entries.length ?? 0;

  // ... manual feature detection
}

// character-federation/src/lib/image/process.ts
const markdownPattern = /!\[([^\]]*)\]\(<?([^>\s)]+)>?(?:\s*=[^)]+)?\)/g;
const htmlPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
// ... manual extraction

function isURLSafe(url: string) {
  const parsed = new URL(url);
  if (parsed.hostname.startsWith('127.')) return false;
  // ... manual SSRF checks
}
```

**After:**
```typescript
import { deriveFeatures } from '@character-foundry/schemas';
import { extractRemoteImageUrls, isURLSafe } from '@character-foundry/image-utils';

// Feature derivation
const features = deriveFeatures(card.data);
console.log(`${features.totalGreetingsCount} greetings`);
console.log(`${features.lorebookEntriesCount} lorebook entries`);

// Image extraction
const remoteImages = extractRemoteImageUrls(text);

// SSRF validation
const check = isURLSafe(url, {
  allowedDomains: ['*.cdn.example.com', 'images.example.com']
});
```

**Files to Update:**
1. `src/lib/card-metadata.ts` - Replace deriveCardMetadata with deriveFeatures
2. `src/lib/image/process.ts` - Replace extraction logic with extractImageUrls
3. `src/lib/image/process.ts` - Replace isURLSafe with canonical version

**Verification:**
```bash
cd character-federation
pnpm add @character-foundry/image-utils@workspace:^
pnpm test
```

---

### B. Character Architect

**Before:**
```typescript
// character-architect/apps/api/src/routes/image-archival.ts
const imageUrlPattern = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
// Basic markdown extraction only

function validateImageUrl(url: string) {
  if (url.includes('localhost')) return false;
  if (url.startsWith('192.168.')) return false;
  // ... incomplete checks
}
```

**After:**
```typescript
import { extractRemoteImageUrls, filterSafeUrls } from '@character-foundry/image-utils';

// Extract all remote images (markdown, HTML, plain URLs)
const images = extractRemoteImageUrls(cardText);

// Filter with comprehensive SSRF protection
const safeUrls = filterSafeUrls(
  images.map(img => img.url),
  { allowDataUrls: false }
);
```

**Files to Update:**
1. `apps/api/src/routes/image-archival.ts` - Replace extraction and validation
2. `apps/api/src/lib/card-processing.ts` - Use deriveFeatures for metadata

**Verification:**
```bash
cd character-architect
pnpm add @character-foundry/image-utils@workspace:^
pnpm test:api
```

---

### C. Character Archive

**Before:**
```typescript
// character-archive/src/metadata.ts
function extractFeatures(card: any) {
  const hasAltGreetings = (card.data?.alternate_greetings?.length ?? 0) > 0;
  const hasLorebook = (card.data?.character_book?.entries?.length ?? 0) > 0;
  // ... manual checks
}

// character-archive/src/image-scanner.ts
const dataUrlPattern = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;
const count = (text.match(dataUrlPattern) || []).length;
```

**After:**
```typescript
import { deriveFeatures } from '@character-foundry/schemas';
import { extractDataUrls, countImages } from '@character-foundry/image-utils';

// Feature derivation
const features = deriveFeatures(card.data);
// All flags available: hasAlternateGreetings, hasLorebook, hasEmbeddedImages, etc.

// Image counting
const embeddedCount = extractDataUrls(text).length;
// or
const totalImages = countImages(text);  // All formats
```

**Files to Update:**
1. `src/metadata.ts` - Replace feature extraction
2. `src/image-scanner.ts` - Use extractDataUrls/countImages

**Verification:**
```bash
cd character-archive
pnpm add @character-foundry/image-utils@workspace:^
pnpm test
```

---

## Installation

Both packages are private workspace packages, already available in the monorepo:

```bash
# In any workspace package's package.json
{
  "dependencies": {
    "@character-foundry/schemas": "workspace:^",
    "@character-foundry/image-utils": "workspace:^"
  }
}
```

Then:
```bash
pnpm install
```

## Testing

Run all tests to verify the canonical implementations:

```bash
# Test feature derivation (20 tests)
pnpm --filter @character-foundry/schemas test

# Test image utils (67 tests)
pnpm --filter @character-foundry/image-utils test

# Test all
pnpm test
```

## Benefits

### For All Apps

✅ **Production-tested** - Incorporates best practices from Federation and Architect
✅ **Comprehensive** - Handles edge cases from real-world usage
✅ **Type-safe** - Full TypeScript support with strict types
✅ **Well-tested** - 87 total tests across both packages
✅ **Browser-safe** - No Node.js dependencies
✅ **Dual-format** - ESM + CJS for all consumers

### Code Reduction

| App | Feature Detection | Image Extraction | SSRF Protection |
|-----|------------------|------------------|-----------------|
| **Federation** | ✅ Delete ~50 LOC | ✅ Delete ~80 LOC | ✅ Delete ~60 LOC |
| **Architect** | ✅ Delete ~40 LOC | ✅ Delete ~30 LOC | ✅ Delete ~40 LOC |
| **Archive** | ✅ Delete ~45 LOC | ✅ Delete ~25 LOC | ✅ Add protection |

**Total**: ~370 lines of duplicate code eliminated

## Common Pitfalls

### 1. SSRF Policy Too Permissive

❌ **Don't:**
```typescript
isURLSafe(url, { allowPrivateIPs: true, allowLocalhost: true });
```

✅ **Do:**
```typescript
// Use restrictive defaults
isURLSafe(url);

// Or allowlist specific domains
isURLSafe(url, {
  allowedDomains: ['cdn.example.com', '*.imagehost.com']
});
```

### 2. Forgetting Context Field

❌ **Don't:**
```typescript
const urls = extractImageUrls(text).map(img => img.url);
// Lost source information
```

✅ **Do:**
```typescript
const images = extractImageUrls(text);
images.forEach(img => {
  console.log(`Found ${img.source} image: ${img.url}`);
  if (img.context) console.log(`Context: ${img.context}`);
});
```

### 3. Not Handling V2/V3 Differences

❌ **Don't:**
```typescript
// Assuming V3 structure
const assets = card.data.assets; // Error if V2
```

✅ **Do:**
```typescript
const features = deriveFeatures(card.data);
// Works for both V2 and V3
if (features.hasGallery) {
  // Only true for V3 with assets
}
```

## Success Metrics

After migration, verify:

1. **All tests pass** - `pnpm test` shows no regressions
2. **SSRF blocking works** - Try `http://127.0.0.1`, `http://10.0.0.1`, etc.
3. **Image extraction comprehensive** - Check markdown, HTML, CSS, plain, base64
4. **Feature flags accurate** - Compare with manual inspection
5. **Performance acceptable** - No significant slowdown in card processing

## Questions?

- Check tests for usage examples: `packages/{schemas,image-utils}/src/**/*.test.ts`
- Review source docs: Comprehensive JSDoc on all public functions
- Federation implementation: `character-federation/src/lib/image/process.ts` (reference only, migrate away)

---

**Next Steps**: See `1215_claude_deduplication_character-foundry.md` for remaining phases (1.3-2.x)
