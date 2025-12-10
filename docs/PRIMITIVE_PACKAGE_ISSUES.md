# Primitive Package GitHub Issues

**Target Repository:** character-foundry/character-foundry
**Status:** READY TO FILE
**Priority:** Must be filed and merged BEFORE refactoring begins

---

## Overview

These issues request additions to the shared `@character-foundry/*` packages that will benefit:
1. **Character Architect** - Primary card editing application
2. **Hosting Platform** - Character card hosting service
3. **Archive Tool** - Bulk card processing and archival

Filing these issues BEFORE refactoring ensures we:
- Don't duplicate work that will be replaced
- Don't create conflicting abstractions
- Only refactor once

---

## Issue 1: Core Utility Functions

### Title
`feat(core): Add UUID, data URL, and base64 utilities`

### Labels
`enhancement`, `core`, `utilities`

### Body

```markdown
## Summary

Add common utility functions to `@character-foundry/core` that are currently duplicated across multiple projects.

## Motivation

Character Architect has identified several utility functions duplicated in multiple locations:
- UUID generation: 2+ implementations
- Data URL conversion: 3+ implementations
- Base64 encoding: scattered inline code

These utilities would benefit all character-foundry tools.

## Requested API

### 1. UUID Generation

```typescript
/**
 * Generate a UUID v4 that works in both Node.js and browser environments.
 * Falls back gracefully in non-secure contexts (HTTP).
 *
 * @returns A valid UUID v4 string
 *
 * @example
 * const id = generateUUID();
 * // => "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateUUID(): string;
```

**Requirements:**
- Must work in Node.js (use `crypto.randomUUID()`)
- Must work in browsers with HTTPS (use `crypto.randomUUID()`)
- Must work in browsers with HTTP (fallback to Math.random-based implementation)
- Must produce valid UUID v4 format

### 2. Data URL Utilities

```typescript
/**
 * Convert Uint8Array to data URL.
 * Handles large buffers (>1MB) without stack overflow by processing in chunks.
 *
 * @param buffer - The binary data to convert
 * @param mimeType - The MIME type for the data URL
 * @returns A data URL string (e.g., "data:image/png;base64,...")
 *
 * @example
 * const dataUrl = toDataURL(pngBuffer, 'image/png');
 * // => "data:image/png;base64,iVBORw0KGgo..."
 */
export function toDataURL(buffer: Uint8Array, mimeType: string): string;

/**
 * Parse a data URL back to buffer and MIME type.
 *
 * @param dataUrl - A valid data URL string
 * @returns Object containing the decoded buffer and MIME type
 * @throws Error if the data URL is malformed
 *
 * @example
 * const { buffer, mimeType } = fromDataURL('data:image/png;base64,iVBORw0KGgo...');
 * // buffer => Uint8Array
 * // mimeType => "image/png"
 */
export function fromDataURL(dataUrl: string): {
  buffer: Uint8Array;
  mimeType: string;
};
```

**Requirements:**
- `toDataURL` must handle buffers >10MB without stack overflow
- `fromDataURL` must validate the data URL format
- Both must work in Node.js and browsers

### 3. Base64 Utilities

```typescript
/**
 * Encode Uint8Array to base64 string.
 * Processes in chunks to handle large buffers safely.
 *
 * @param buffer - The binary data to encode
 * @returns Base64 encoded string
 *
 * @example
 * const base64 = uint8ArrayToBase64(buffer);
 */
export function uint8ArrayToBase64(buffer: Uint8Array): string;

/**
 * Decode base64 string to Uint8Array.
 *
 * @param base64 - The base64 string to decode
 * @returns Decoded binary data
 * @throws Error if the base64 string is invalid
 *
 * @example
 * const buffer = base64ToUint8Array(base64String);
 */
export function base64ToUint8Array(base64: string): Uint8Array;
```

**Requirements:**
- Chunk-safe for large data (>10MB)
- Proper error handling for invalid input

## Current Duplicates

### UUID Generation
- `character-architect/apps/web/src/lib/client-import.ts:17-27`
- `@character-foundry/voxta/src/writer.ts:13-19`

### Data URL Conversion
- `character-architect/apps/web/src/lib/client-import.ts:84-94`
- Inline in various import handlers

## Acceptance Criteria

- [ ] All functions work in Node.js 18+
- [ ] All functions work in modern browsers (Chrome 90+, Firefox 90+, Safari 14+)
- [ ] Functions handle large buffers (>10MB) without stack overflow
- [ ] Full TypeScript types with no `any`
- [ ] Unit tests with >90% coverage
- [ ] JSDoc documentation for all exports
- [ ] Exports added to package index

## Testing Requirements

```typescript
describe('generateUUID', () => {
  it('should return valid UUID v4 format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique values', () => {
    const uuids = new Set(Array.from({ length: 1000 }, () => generateUUID()));
    expect(uuids.size).toBe(1000);
  });
});

describe('toDataURL / fromDataURL', () => {
  it('should round-trip small buffer', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const dataUrl = toDataURL(original, 'application/octet-stream');
    const { buffer, mimeType } = fromDataURL(dataUrl);
    expect(buffer).toEqual(original);
    expect(mimeType).toBe('application/octet-stream');
  });

  it('should handle 10MB buffer without stack overflow', () => {
    const largeBuffer = new Uint8Array(10 * 1024 * 1024);
    const dataUrl = toDataURL(largeBuffer, 'application/octet-stream');
    expect(dataUrl).toMatch(/^data:application\/octet-stream;base64,/);
  });
});
```
```

---

## Issue 2: CardNormalizer Class

### Title
`feat(schemas): Add CardNormalizer for handling malformed card data`

### Labels
`enhancement`, `schemas`, `validation`

### Body

```markdown
## Summary

Add a `CardNormalizer` class to `@character-foundry/schemas` that handles normalization of malformed card data from various sources.

## Motivation

Card data from various sources (ChubAI, CharacterTavern, RisuAI, SillyTavern, etc.) often has inconsistencies:
- Wrong spec values
- Fields in wrong locations
- Missing required fields
- Non-standard lorebook entries

Currently, Character Architect has this logic duplicated in 5+ locations (~274 lines). Centralizing it would:
- Ensure consistent behavior across all tools
- Fix edge cases in one place for all consumers
- Reduce code duplication significantly

## Requested API

```typescript
/**
 * Normalizes card data to conform to CCv2 or CCv3 schema.
 * Handles common issues from various export sources.
 */
export class CardNormalizer {
  /**
   * Normalize card data to valid schema format.
   *
   * Handles:
   * - Fixing spec/spec_version values
   * - Moving misplaced fields to correct locations
   * - Adding missing required fields with defaults
   * - Handling hybrid formats (fields at root AND in data object)
   *
   * @param data - Raw card data from any source
   * @param spec - Target specification version
   * @returns Normalized card data conforming to schema
   *
   * @example
   * // ChubAI hybrid format (fields at root)
   * const raw = {
   *   spec: 'chara_card_v2',
   *   name: 'Test',  // Wrong: at root
   *   data: { description: 'Desc' }
   * };
   * const normalized = CardNormalizer.normalize(raw, 'v2');
   * // => { spec: 'chara_card_v2', data: { name: 'Test', description: 'Desc' } }
   */
  static normalize(data: unknown, spec: 'v2' | 'v3'): CCv2Data | CCv3Data;

  /**
   * Normalize lorebook/character_book entries.
   *
   * Handles:
   * - Ensuring required fields exist (keys, content, enabled, insertion_order)
   * - Converting numeric position values to string enums
   * - Moving V3-only fields to extensions for V2 compatibility
   * - Removing null character_book (should be undefined)
   *
   * @param book - Character book object to normalize
   * @returns Normalized character book
   */
  static normalizeLorebookEntries(book: CharacterBook): CharacterBook;

  /**
   * Fix CharacterTavern timestamp format.
   * CCv3 spec requires Unix timestamp in seconds, but CharacterTavern exports milliseconds.
   *
   * @param data - CCv3 data with potentially wrong timestamps
   * @returns CCv3 data with corrected timestamps
   */
  static fixTimestamps(data: CCv3Data): CCv3Data;

  /**
   * Normalize a single lorebook entry.
   *
   * @param entry - Raw lorebook entry
   * @returns Normalized entry conforming to schema
   */
  static normalizeEntry(entry: unknown): LorebookEntry;
}
```

## Known Edge Cases to Handle

### 1. ChubAI Hybrid Format
```typescript
// Input: Fields at root level (wrong)
{
  spec: 'chara_card_v2',
  spec_version: '2.0',
  name: 'Test',        // At root
  description: 'Desc', // At root
  data: {}             // Empty data object
}

// Output: Fields in data object (correct)
{
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: 'Test',
    description: 'Desc'
  }
}
```

### 2. CharacterTavern Timestamps
```typescript
// Input: Milliseconds (wrong)
{
  spec: 'chara_card_v3',
  data: {
    creation_date: 1702123456789,     // 13 digits = milliseconds
    modification_date: 1702123456789
  }
}

// Output: Seconds (correct per CCv3 spec)
{
  spec: 'chara_card_v3',
  data: {
    creation_date: 1702123456,        // 10 digits = seconds
    modification_date: 1702123456
  }
}
```

### 3. Numeric Position Values
```typescript
// Input: Numeric position (non-standard)
{
  character_book: {
    entries: [{
      keys: ['trigger'],
      content: 'Content',
      position: 0  // Numeric (wrong)
    }]
  }
}

// Output: String enum (correct)
{
  character_book: {
    entries: [{
      keys: ['trigger'],
      content: 'Content',
      position: 'before_char'  // String enum (correct)
    }]
  }
}
```

### 4. V3 Fields in V2 Cards
```typescript
// Input: V3 fields in V2 card
{
  spec: 'chara_card_v2',
  data: {
    character_book: {
      entries: [{
        keys: ['trigger'],
        content: 'Content',
        probability: 100,    // V3-only field
        depth: 4,            // V3-only field
        role: 'system'       // V3-only field
      }]
    }
  }
}

// Output: V3 fields moved to extensions
{
  spec: 'chara_card_v2',
  data: {
    character_book: {
      entries: [{
        keys: ['trigger'],
        content: 'Content',
        extensions: {
          probability: 100,
          depth: 4,
          role: 'system'
        }
      }]
    }
  }
}
```

### 5. Null Character Book
```typescript
// Input: Null character_book
{
  spec: 'chara_card_v2',
  data: {
    name: 'Test',
    character_book: null  // Should be undefined, not null
  }
}

// Output: No character_book property
{
  spec: 'chara_card_v2',
  data: {
    name: 'Test'
    // character_book removed
  }
}
```

### 6. Missing Required Fields (V3)
```typescript
// Input: Missing V3 required fields
{
  spec: 'chara_card_v3',
  data: {
    name: 'Test',
    description: 'Desc'
    // Missing: group_only_greetings, creator, character_version, tags
  }
}

// Output: Defaults added
{
  spec: 'chara_card_v3',
  data: {
    name: 'Test',
    description: 'Desc',
    group_only_greetings: [],
    creator: '',
    character_version: '1.0',
    tags: []
  }
}
```

## Current Duplicates in Character Architect

1. `apps/api/src/routes/import-export.ts:36-203` (main implementation, 167 lines)
2. `apps/api/src/routes/cards.ts` (inline normalization calls)
3. `apps/api/src/services/web-import/utils.ts` (partial normalization)
4. `apps/api/src/services/web-import/handlers/character-tavern.ts` (format-specific)
5. Various client-side normalizations

## Acceptance Criteria

- [ ] Handles all edge cases listed above
- [ ] Pure functions (no side effects, no mutations to input)
- [ ] Full TypeScript types (no `any`)
- [ ] Does not throw on malformed input (returns best-effort result)
- [ ] Unit tests covering each edge case
- [ ] JSDoc documentation
- [ ] Exports added to package index

## Testing Requirements

```typescript
describe('CardNormalizer', () => {
  describe('normalize', () => {
    it('should fix ChubAI hybrid format', () => {
      const input = {
        spec: 'chara_card_v2',
        name: 'Test',
        data: { description: 'Desc' }
      };
      const result = CardNormalizer.normalize(input, 'v2');
      expect(result.data.name).toBe('Test');
      expect((result as any).name).toBeUndefined();
    });

    it('should add missing V3 required fields', () => {
      const input = {
        spec: 'chara_card_v3',
        data: { name: 'Test', description: 'Desc' }
      };
      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;
      expect(result.data.group_only_greetings).toEqual([]);
      expect(result.data.creator).toBe('');
      expect(result.data.character_version).toBe('1.0');
      expect(result.data.tags).toEqual([]);
    });
  });

  describe('normalizeLorebookEntries', () => {
    it('should convert numeric position to string enum', () => {
      const book = {
        entries: [{ keys: ['test'], content: 'Test', position: 0 }]
      };
      const result = CardNormalizer.normalizeLorebookEntries(book);
      expect(result.entries[0].position).toBe('before_char');
    });

    it('should move V3 fields to extensions', () => {
      const book = {
        entries: [{ keys: ['test'], content: 'Test', probability: 100 }]
      };
      const result = CardNormalizer.normalizeLorebookEntries(book);
      expect(result.entries[0].extensions?.probability).toBe(100);
      expect((result.entries[0] as any).probability).toBeUndefined();
    });
  });

  describe('fixTimestamps', () => {
    it('should convert milliseconds to seconds', () => {
      const data = {
        spec: 'chara_card_v3',
        data: { creation_date: 1702123456789 }
      } as CCv3Data;
      const result = CardNormalizer.fixTimestamps(data);
      expect(result.data.creation_date).toBe(1702123456);
    });

    it('should not modify already-correct timestamps', () => {
      const data = {
        spec: 'chara_card_v3',
        data: { creation_date: 1702123456 }
      } as CCv3Data;
      const result = CardNormalizer.fixTimestamps(data);
      expect(result.data.creation_date).toBe(1702123456);
    });
  });
});
```
```

---

## Issue 3: Enhanced Spec Detection

### Title
`feat(schemas): Enhance detectSpec with detailed detection info`

### Labels
`enhancement`, `schemas`

### Body

```markdown
## Summary

Enhance the `detectSpec` function to provide more robust detection and optional detailed diagnostics.

## Motivation

Robust spec detection is critical for the normalization pipeline. The current implementation may not handle all edge cases, and debugging why a card was detected as a certain spec can be difficult.

## Requested API

```typescript
/**
 * Detect card specification version from raw data.
 *
 * @param data - Raw card data
 * @returns Detected spec version, or null if not a valid card
 *
 * @example
 * detectSpec({ spec: 'chara_card_v3', data: { name: 'Test' } });
 * // => 'v3'
 *
 * detectSpec({ name: 'Test', description: 'Desc' });
 * // => 'v1' (flat format)
 *
 * detectSpec({ foo: 'bar' });
 * // => null (not a card)
 */
export function detectSpec(data: unknown): 'v1' | 'v2' | 'v3' | null;

/**
 * Detailed spec detection with confidence and reasoning.
 * Useful for debugging and logging.
 *
 * @param data - Raw card data
 * @returns Detection result with confidence and indicators
 *
 * @example
 * detectSpecDetailed({ spec: 'chara_card_v3', data: { name: 'Test' } });
 * // => {
 * //   spec: 'v3',
 * //   confidence: 'high',
 * //   indicators: ['spec field is "chara_card_v3"', 'has data wrapper'],
 * //   warnings: []
 * // }
 */
export function detectSpecDetailed(data: unknown): {
  /** Detected spec version */
  spec: 'v1' | 'v2' | 'v3' | null;
  /** Confidence level of detection */
  confidence: 'high' | 'medium' | 'low';
  /** What fields/values indicated this spec */
  indicators: string[];
  /** Anomalies or inconsistencies detected */
  warnings: string[];
};
```

## Detection Criteria

### V3 Indicators (high → low confidence)
1. `spec === 'chara_card_v3'` (high)
2. `spec_version` starts with '3' (high)
3. Has V3-only fields: `group_only_greetings`, `creation_date`, `modification_date` (medium)
4. Has `data.assets` array (medium)

### V2 Indicators (high → low confidence)
1. `spec === 'chara_card_v2'` (high)
2. `spec_version` starts with '2' (high)
3. Has wrapped format with `data` object but no V3 markers (medium)

### V1 Indicators (high → low confidence)
1. No `spec` field AND has card fields at root (high)
2. Flat structure with `name`, `description`, `personality` (medium)
3. No `data` wrapper (medium)

### Not a Card
- Returns `null` if none of the above criteria are met
- Does not throw errors

## Acceptance Criteria

- [ ] Correctly identifies spec from all known sources
- [ ] Returns `null` for non-card data (does not throw)
- [ ] Detailed function provides useful debugging info
- [ ] Unit tests for each source format
- [ ] No `any` types

## Testing Requirements

```typescript
describe('detectSpec', () => {
  it('should detect V3 from spec field', () => {
    expect(detectSpec({ spec: 'chara_card_v3', data: {} })).toBe('v3');
  });

  it('should detect V2 from spec field', () => {
    expect(detectSpec({ spec: 'chara_card_v2', data: {} })).toBe('v2');
  });

  it('should detect V1 from flat structure', () => {
    expect(detectSpec({ name: 'Test', description: 'Desc' })).toBe('v1');
  });

  it('should return null for non-card data', () => {
    expect(detectSpec({ foo: 'bar' })).toBeNull();
    expect(detectSpec(null)).toBeNull();
    expect(detectSpec('string')).toBeNull();
  });
});

describe('detectSpecDetailed', () => {
  it('should provide high confidence for explicit spec', () => {
    const result = detectSpecDetailed({ spec: 'chara_card_v3', data: {} });
    expect(result.spec).toBe('v3');
    expect(result.confidence).toBe('high');
    expect(result.indicators).toContain('spec field is "chara_card_v3"');
  });

  it('should warn about inconsistencies', () => {
    // V2 spec but has V3 fields
    const result = detectSpecDetailed({
      spec: 'chara_card_v2',
      data: { group_only_greetings: [] }
    });
    expect(result.spec).toBe('v2');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```
```

---

## Issue 4: Media Package (New)

### Title
`feat: Create @character-foundry/media package for image utilities`

### Labels
`enhancement`, `new-package`

### Body

```markdown
## Summary

Create a new `@character-foundry/media` package for image processing utilities that work in both Node.js and browser environments.

## Motivation

Image processing utilities are duplicated across Character Architect:
- `apps/web/src/lib/client-import.ts:100-187` (88 lines)
- `apps/web/src/lib/web-import-handler.ts:49-111` (62 lines)

These utilities would benefit:
- Character Architect (primary)
- Hosting Platform (thumbnail generation)
- Archive Tool (bulk thumbnail processing)

## Requested API

```typescript
// @character-foundry/media

/**
 * Options for thumbnail creation
 */
export interface ThumbnailOptions {
  /** Maximum dimension (width or height). Default: 400 */
  maxSize?: number;
  /** Output format. Default: 'webp' */
  format?: 'webp' | 'jpeg' | 'png';
  /** Quality (0-1). Default: 0.8 */
  quality?: number;
  /** Fallback format if primary unsupported. Default: 'jpeg' */
  fallbackFormat?: 'jpeg' | 'png';
  /** Timeout in ms. Default: 10000 */
  timeout?: number;
}

/**
 * Create a thumbnail from image data.
 * Works in both Node.js (sharp) and browser (canvas) environments.
 *
 * @param imageData - Source image as Uint8Array
 * @param options - Thumbnail options
 * @returns Thumbnail image as Uint8Array
 * @throws Error if image cannot be processed or timeout exceeded
 *
 * @example
 * const thumbnail = await createThumbnail(pngBuffer, {
 *   maxSize: 200,
 *   format: 'webp',
 *   quality: 0.85
 * });
 */
export function createThumbnail(
  imageData: Uint8Array,
  options?: ThumbnailOptions
): Promise<Uint8Array>;

/**
 * Result of dimension detection
 */
export interface ImageDimensions {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp' | 'gif' | 'avif';
}

/**
 * Get image dimensions without fully decoding the image.
 * Reads only the header bytes needed to determine dimensions.
 *
 * @param buffer - Image data
 * @returns Dimensions and format, or null if not a recognized image
 *
 * @example
 * const dims = getImageDimensions(buffer);
 * if (dims) {
 *   console.log(`${dims.width}x${dims.height} ${dims.format}`);
 * }
 */
export function getImageDimensions(
  buffer: Uint8Array
): ImageDimensions | null;

/**
 * Detect image format from magic bytes.
 *
 * @param buffer - Image data (only first 12 bytes needed)
 * @returns Detected format or null
 *
 * @example
 * detectImageFormat(buffer);
 * // => 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | null
 */
export function detectImageFormat(
  buffer: Uint8Array
): 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | null;
```

## Implementation Notes

### Browser Implementation
- Use Canvas API for resizing
- `canvas.toDataURL('image/webp', quality)` for WebP
- Fallback to JPEG if WebP not supported (Safari <14)
- Timeout protection with AbortController or Promise.race

### Node.js Implementation
- Use `sharp` library (already a dependency in several packages)
- `sharp(buffer).resize(maxSize, maxSize, { fit: 'inside' }).webp({ quality }).toBuffer()`

### Environment Detection
```typescript
const isNode = typeof window === 'undefined';
if (isNode) {
  // Use sharp
} else {
  // Use canvas
}
```

### Magic Bytes Reference
```typescript
const MAGIC_BYTES = {
  png: [0x89, 0x50, 0x4E, 0x47],
  jpeg: [0xFF, 0xD8, 0xFF],
  webp: [0x52, 0x49, 0x46, 0x46], // + 'WEBP' at offset 8
  gif: [0x47, 0x49, 0x46, 0x38],
  avif: [0x00, 0x00, 0x00], // + 'ftyp' at offset 4
};
```

## Package Structure

```
packages/media/
├── src/
│   ├── index.ts           # Public exports
│   ├── thumbnail.ts       # createThumbnail
│   ├── dimensions.ts      # getImageDimensions
│   ├── format.ts          # detectImageFormat
│   ├── browser.ts         # Browser-specific implementations
│   └── node.ts            # Node-specific implementations
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Dependencies

```json
{
  "dependencies": {},
  "optionalDependencies": {
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

Note: `sharp` is optional - only used in Node.js environment.

## Acceptance Criteria

- [ ] Works in Node.js 18+
- [ ] Works in modern browsers (Chrome 90+, Firefox 90+, Safari 14+)
- [ ] Handles images up to 50MB
- [ ] Graceful WebP fallback in browsers
- [ ] Timeout protection (default 10s)
- [ ] No `any` types
- [ ] Unit tests with real image fixtures
- [ ] JSDoc documentation

## Testing Requirements

```typescript
describe('createThumbnail', () => {
  it('should resize large image to maxSize', async () => {
    const largeImage = await loadFixture('large-2000x1500.png');
    const thumbnail = await createThumbnail(largeImage, { maxSize: 400 });
    const dims = getImageDimensions(thumbnail);
    expect(dims?.width).toBeLessThanOrEqual(400);
    expect(dims?.height).toBeLessThanOrEqual(400);
  });

  it('should preserve aspect ratio', async () => {
    const wideImage = await loadFixture('wide-1000x500.png');
    const thumbnail = await createThumbnail(wideImage, { maxSize: 200 });
    const dims = getImageDimensions(thumbnail);
    expect(dims?.width).toBe(200);
    expect(dims?.height).toBe(100);
  });

  it('should timeout on slow processing', async () => {
    const hugeImage = await loadFixture('huge-10000x10000.png');
    await expect(
      createThumbnail(hugeImage, { timeout: 100 })
    ).rejects.toThrow(/timeout/i);
  });
});

describe('getImageDimensions', () => {
  it('should detect PNG dimensions', async () => {
    const png = await loadFixture('test-100x50.png');
    const dims = getImageDimensions(png);
    expect(dims).toEqual({ width: 100, height: 50, format: 'png' });
  });

  it('should detect JPEG dimensions', async () => {
    const jpeg = await loadFixture('test-200x100.jpg');
    const dims = getImageDimensions(jpeg);
    expect(dims).toEqual({ width: 200, height: 100, format: 'jpeg' });
  });

  it('should return null for non-image', () => {
    const text = new TextEncoder().encode('not an image');
    expect(getImageDimensions(text)).toBeNull();
  });
});

describe('detectImageFormat', () => {
  it('should detect PNG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(detectImageFormat(png)).toBe('png');
  });

  it('should detect JPEG', () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    expect(detectImageFormat(jpeg)).toBe('jpeg');
  });
});
```
```

---

## Filing Instructions

### Order of Filing
1. **Issue 1** (Core utilities) - No dependencies, quickest win
2. **Issue 2** (CardNormalizer) - Depends on Issue 3 for detectSpec
3. **Issue 3** (Enhanced detectSpec) - Can be filed with Issue 2
4. **Issue 4** (Media package) - Independent, can be filed anytime

### After Filing
1. Link issues in this document with issue numbers
2. Track status in REFACTORING_PLAN.md Phase 0 checklist
3. Do not begin refactoring until issues are merged or explicitly deferred

### If Issues Are Declined
If the maintainer declines any issue:
1. Document the decision
2. Create local implementation in `apps/api/src/utils/` or `apps/web/src/lib/`
3. Mark as "candidate for future extraction" in code comments
4. Proceed with refactoring using local implementation

---

## Tracking

| Issue | Title | Filed | Issue # | PR # | Merged |
|-------|-------|-------|---------|------|--------|
| 1 | Core utilities | YES | [#6](https://github.com/character-foundry/character-foundry/issues/6) | - | - |
| 2 | CardNormalizer | YES | [#7](https://github.com/character-foundry/character-foundry/issues/7) | - | - |
| 3 | Enhanced detectSpec | YES | [#8](https://github.com/character-foundry/character-foundry/issues/8) | - | - |
| 4 | Media package | YES | [#9](https://github.com/character-foundry/character-foundry/issues/9) | - | - |

**All issues filed on:** December 9, 2024
**Requesting project:** Character Architect (character-foundry/character-architect)
