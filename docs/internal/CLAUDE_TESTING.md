# Card Architect - Testing Guide

Complete guide to automated and manual testing for Card Architect.

## Quick Reference

```bash
# Run all tests
cd apps/api && npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui
```

**Current Status:** 68 tests passing (3 test files)

---

## Test Infrastructure

### Framework
- **Vitest** - Test framework with TypeScript support
- **Fastify Inject** - HTTP endpoint testing without network
- **form-data** - Multipart form testing for file uploads

### Test Files

| File | Tests | Description |
|------|-------|-------------|
| `api-endpoints.test.ts` | 17 | Core API CRUD operations |
| `card-validation.test.ts` | 10 | Schema validation (V2/V3) |
| `format-interoperability.test.ts` | 41 | Format conversion & round-trips |

### Test Data

Test cards are stored in `/testing/` directory:

```
testing/
├── wyvern/           # Wyvern format cards (hybrid V2)
│   ├── Alana.json
│   └── Alana.png
├── chub/             # Chub.ai cards (clean V2)
│   ├── main_kiora-*.json
│   └── main_kiora-*.png
└── CharacterTavern/  # CharacterTavern cards (V3)
    └── tanya_the_cat_maid.png
```

---

## API Endpoints Tests (`api-endpoints.test.ts`)

### Card CRUD Operations (5 tests)
| Test | Description |
|------|-------------|
| `should create a new v2 card` | Create minimal V2 card |
| `should get the created card` | Retrieve card by ID |
| `should list all cards` | List all cards endpoint |
| `should update a card` | Patch card fields |
| `should delete a card` | Delete and verify 404 |

### V3 Card Operations (3 tests)
| Test | Description |
|------|-------------|
| `should create a v3 card with full features` | V3 with lorebook, tags, etc. |
| `should update v3 card lorebook` | Modify lorebook entries |
| `should clean up v3 test card` | Cleanup after V3 tests |

### Import/Export (4 tests)
| Test | Description |
|------|-------------|
| `should import a JSON v2 card` | JSON file import |
| `should export card as JSON` | JSON export |
| `should export card as PNG` | PNG with embedded data |
| `should clean up imported card` | Cleanup |

### Tokenization (2 tests)
| Test | Description |
|------|-------------|
| `should tokenize text` | Single text tokenization |
| `should tokenize card fields` | Multi-field tokenization |

---

## Card Validation Tests (`card-validation.test.ts`)

### V2 Cards (4 tests)
- Minimal V2 card validation
- Complete V2 card with all fields
- V2 spec detection
- Required field validation

### V3 Cards (4 tests)
- Minimal V3 card validation
- Complete V3 card with all features
- V3 spec detection
- Invalid spec rejection

### Lorebook Entries (2 tests)
- V2 lorebook entry validation
- V3 lorebook with extensions

### Alternate Greetings (2 tests)
- V2 alternate greetings validation
- V3 alternate greetings validation

---

## Format Interoperability Tests (`format-interoperability.test.ts`)

The largest test suite (41 tests) covering format conversions and round-trips.

### Platform Import Tests (6 tests)

#### Wyvern Format (2 tests)
| Test | Description |
|------|-------------|
| `should import Wyvern JSON (hybrid V2 with field duplication)` | Handle root-level duplicates |
| `should import Wyvern PNG` | PNG with embedded card data |

#### Chub Format (3 tests)
| Test | Description |
|------|-------------|
| `should import Chub JSON (clean V2 with extensions)` | Standard V2 with `chub` extension |
| `should import Chub PNG with embedded card data` | PNG import preserves lorebook |
| `should preserve Chub extensions during import` | Verify extension preservation |

#### CharacterTavern Format (1 test)
| Test | Description |
|------|-------------|
| `should import CharacterTavern PNG` | V3 with millisecond timestamps |

### JSON Round-Trip Tests (2 tests)
| Test | Description |
|------|-------------|
| `should preserve V2 card data through JSON round-trip` | Import → Export → Re-import |
| `should preserve lorebook through JSON round-trip` | Lorebook entries preserved |

### PNG Round-Trip Tests (1 test)
| Test | Description |
|------|-------------|
| `should preserve card data through PNG round-trip` | PNG embed/extract cycle |

### Cross-Format Conversion (1 test)
| Test | Description |
|------|-------------|
| `should convert JSON to PNG and back` | JSON → PNG → JSON |

### V2/V3 Conversion (2 tests)
| Test | Description |
|------|-------------|
| `should convert V2 card to V3 format` | Upgrade with defaults |
| `should convert V3 card to V2 format` | Downgrade (lossy) |

### CHARX Export Tests (18 tests)

#### Platform to CHARX Conversion (8 tests)
| Test | Description |
|------|-------------|
| `should convert Wyvern JSON to CHARX` | Wyvern → CHARX |
| `should convert Wyvern PNG to CHARX` | PNG → CHARX |
| `should convert Chub JSON to CHARX with lorebook preserved` | Lorebook in CHARX |
| `should convert Chub PNG to CHARX` | Chub PNG → CHARX |
| `should preserve Chub extensions through CHARX round-trip` | Extension preservation |
| `should convert CharacterTavern PNG to CHARX` | V3 → CHARX |
| `should export V3 card to CHARX and preserve all V3 fields` | Full V3 feature set |
| `should re-export an imported CHARX without data loss` | CHARX → CHARX |

#### Data Integrity (3 tests)
| Test | Description |
|------|-------------|
| `should preserve special characters in CHARX round-trip` | Unicode, emoji, escapes |
| `should preserve lorebook entry properties in CHARX` | All lorebook fields |
| `should preserve depth_prompt extension through CHARX conversion` | SillyTavern extension |

#### Deep Field Comparison (4 tests)
| Test | Description |
|------|-------------|
| `should preserve ALL text fields through CHARX conversion (Wyvern)` | All string fields |
| `should preserve ALL lorebook entry fields through CHARX conversion (Chub)` | All lorebook properties |
| `should preserve depth_prompt extension through CHARX conversion` | depth_prompt integrity |
| `should preserve description with markdown/special formatting through CHARX` | Markdown preservation |

### Voxta Tests (11 tests)

See [Voxta Format Testing](#voxta-format-testing) section below.

---

## Voxta Format Testing

### Overview

Voxta is a different character format with its own conventions. Our tests verify:
1. Core field preservation (name, description, personality, scenario, first_mes)
2. Known limitations are documented
3. Conversions work without errors

### Voxta Test Suite (11 tests)

#### JSON to Voxta (2 tests)
| Test | Description |
|------|-------------|
| `should convert Wyvern JSON to Voxta package` | Full conversion with field verification |
| `should convert Chub JSON to Voxta (core fields only)` | Core fields preserved |

#### PNG to Voxta (2 tests)
| Test | Description |
|------|-------------|
| `should convert Wyvern PNG to Voxta package` | PNG → Voxta with field verification |
| `should convert Chub PNG to Voxta (core fields only)` | PNG → Voxta core fields |

#### CHARX to Voxta (2 tests)
| Test | Description |
|------|-------------|
| `should convert CHARX to Voxta package` | CHARX → Voxta conversion |
| `should convert CHARX to Voxta (core fields only)` | Core fields in conversion |

#### Voxta to CHARX (3 tests)
| Test | Description |
|------|-------------|
| `should convert Voxta package to CHARX` | Voxta → CHARX |
| `should preserve all fields through Voxta to CHARX conversion` | Deep field comparison |
| `should convert card through Voxta → CHARX (core fields only)` | Core fields preserved |

#### Voxta Round-Trip (1 test)
| Test | Description |
|------|-------------|
| `should re-export an imported Voxta package without data loss` | Voxta → Card → Voxta |

#### Deep Field Comparison (1 test)
| Test | Description |
|------|-------------|
| Voxta deep field comparison | All text fields preserved |

### Known Voxta Limitations

These limitations are documented in tests and handled appropriately:

#### 1. Alternate Greetings
- **Issue**: `alternate_greetings` array is empty after Voxta round-trip
- **Cause**: Current import code hardcodes `alternate_greetings: []` at `voxta-import.service.ts:171`
- **Note**: Voxta v114+ DOES support alternate greetings - this is a bug to fix
- **Test Handling**: Tests skip alternate_greetings assertions for Voxta

#### 2. Lorebook/Character Book
- **Issue**: CCv3 `character_book` entries may not survive Voxta conversion
- **Cause**: Voxta uses "memory books" with different structure
- **Location**: `voxta-import.service.ts:126-152`
- **Test Handling**: Tests skip lorebook assertions for Voxta

#### 3. Macro Format Changes
- **Issue**: Voxta converts `{{char}}` → `{{ char }}` (adds spaces)
- **Impact**: Cosmetic difference in string comparison
- **Test Handling**: Tests use `normalizeMacros()` helper:
  ```typescript
  function normalizeMacros(text: string | undefined): string {
    if (!text) return '';
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, '{{$1}}');
  }
  ```

#### 4. CHARX Export Requirements
- **Issue**: CHARX export requires at least one icon asset
- **Impact**: Voxta-imported cards may not have icon asset
- **Test Handling**: Tests upload test image before CHARX export

### Voxta Asset Folder Mapping

| CHARX/CCv3 Asset Type | Voxta Folder |
|-----------------------|--------------|
| Basic emotes/emotions | `Default/` |
| `other`, `custom`, `x-risu` | `other/` |
| `background` | `background/` |
| Additional avatars | `avatars/` |
| Audio (wav/mp3) | `VoiceSamples/` |
| Main icon | Root or `avatars/` |

---

## Manual Testing Plans

### GitHub Issue #8: Voxta Format Interoperability

**Goal**: Verify Voxta format limitations and potential improvements

#### Test Cases
- [ ] Import a Voxta package with memory books - verify lorebook conversion
- [ ] Export a card with 5+ alternate greetings to Voxta, re-import - confirm current behavior
- [ ] Test Voxta → CHARX conversion with real .voxpkg files from Voxta app
- [ ] Verify macro conversion is bidirectional and consistent
- [ ] Check if Voxta v114+ fields could map to alternate_greetings

#### Files to Check
- `apps/api/src/services/voxta-import.service.ts` - Import logic
- `packages/voxta/` - Voxta package handling

---

### GitHub Issue #9: Voxta ↔ CHARX Emote Renaming

**Goal**: Implement bidirectional emote/asset renaming between formats

#### Test Cases
- [ ] Document Voxta's supported emotes and naming conventions
- [ ] Test CHARX → Voxta with various emotion names
- [ ] Test Voxta → CHARX with Voxta-specific emotion names
- [ ] Verify folder structure is correct in exported Voxta packages
- [ ] Handle edge cases (unknown emotes, duplicates)

#### Implementation Tasks
- [ ] Create emote name mapping table (bidirectional)
- [ ] Update `packages/voxta/` to handle folder structure on export
- [ ] Update `voxta-import.service.ts` for import mapping
- [ ] Add automated tests for emote renaming

---

### GitHub Issue #10: Asset Cache for creator_notes

**Goal**: Extend linked image archival to `creator_notes` field

#### Test Cases
- [ ] Create card with external images in creator_notes
- [ ] Run archive operation - verify images downloaded
- [ ] Verify URLs updated to local paths
- [ ] Test revert functionality restores original URLs
- [ ] Verify archive status shows correct counts

#### Files to Modify
- `apps/api/src/routes/image-archival.ts`
- `apps/web/src/features/editor/components/AssetsPanel.tsx`

---

## Test Helpers

The format interoperability tests include several helper functions:

### Card Data Extraction

```typescript
// Get card name from wrapped or unwrapped format
function getCardName(cardData: unknown): string | undefined

// Get description from card data
function getCardDescription(cardData: unknown): string | undefined

// Get lorebook entry count
function getLorebookEntryCount(cardData: unknown): number

// Get alternate greetings count
function getAltGreetingsCount(cardData: unknown): number

// Get unwrapped inner data
function getInnerData(cardData: unknown): Record<string, unknown>

// Get all alternate greetings
function getAltGreetings(cardData: unknown): string[]

// Get lorebook entries
function getLorebookEntries(cardData: unknown): Array<Record<string, unknown>>

// Get extensions object
function getExtensions(cardData: unknown): Record<string, unknown>
```

### Voxta-Specific Helpers

```typescript
// Normalize macro spacing for comparison
function normalizeMacros(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, '{{$1}}');
}
```

### Test Image Creation

```typescript
// Create minimal valid PNG for testing
async function createTestImage(): Promise<Buffer> {
  // Returns 1x1 PNG buffer for upload testing
}
```

---

## Adding New Tests

### 1. New Platform Format

```typescript
describe('NewPlatform Format Import', () => {
  it('should import NewPlatform JSON', async () => {
    const filePath = join(TESTING_DIR, 'newplatform/card.json');
    const fileContent = await fs.readFile(filePath);

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fileContent, {
      filename: 'card.json',
      contentType: 'application/json',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/import',
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.card).toBeDefined();
    expect(getCardName(body.card.data)).toBe('Expected Name');
    createdCardIds.push(body.card.meta.id);
  });
});
```

### 2. New Conversion Test

```typescript
it('should convert SourceFormat to TargetFormat', async () => {
  // 1. Import source card
  const importResponse = await importCard('source.json');
  const cardId = importResponse.card.meta.id;
  createdCardIds.push(cardId);

  // 2. Export to target format
  const exportResponse = await app.inject({
    method: 'GET',
    url: `/api/cards/${cardId}/export?format=targetformat`,
  });
  expect(exportResponse.statusCode).toBe(200);

  // 3. Re-import and verify
  const reImportResponse = await importBuffer(
    exportResponse.rawPayload,
    'card.target',
    'application/x-target'
  );

  // 4. Compare fields
  expect(getCardName(reImportResponse.card.data)).toBe('Expected Name');
});
```

### 3. Round-Trip Test Pattern

```typescript
it('should preserve data through Format round-trip', async () => {
  // Import original
  const original = await importCard('original.json');
  createdCardIds.push(original.card.meta.id);

  // Get original values
  const originalName = getCardName(original.card.data);
  const originalDesc = getCardDescription(original.card.data);

  // Export to format
  const exported = await exportCard(original.card.meta.id, 'format');

  // Re-import
  const reimported = await importBuffer(exported, 'card.fmt', 'application/format');
  createdCardIds.push(reimported.card.meta.id);

  // Compare - should match
  expect(getCardName(reimported.card.data)).toBe(originalName);
  expect(getCardDescription(reimported.card.data)).toBe(originalDesc);
});
```

---

## Troubleshooting

### Tests Timing Out

```bash
# Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds
  },
});
```

### Cleanup Failures

Tests track created cards in `createdCardIds[]` for cleanup. If tests fail mid-run:

```bash
# Clean database manually
rm apps/api/data/cards.db
```

### Debug Logging

```typescript
// Add to test for debugging
console.log('Card data:', JSON.stringify(body.card, null, 2));
```

### Running Single Test

```bash
# Run specific test file
npx vitest run format-interoperability.test.ts

# Run specific test by name
npx vitest run -t "should import Wyvern JSON"
```

---

## Test Coverage Goals

### Currently Covered
- [x] All platform imports (Wyvern, Chub, CharacterTavern)
- [x] JSON/PNG round-trips
- [x] V2 ↔ V3 conversion
- [x] CHARX export from all formats
- [x] CHARX round-trip
- [x] Voxta conversions (with known limitations)
- [x] Extension preservation
- [x] Lorebook preservation
- [x] Special character handling

### Planned Coverage
- [ ] Voxta v114 alternate_greetings support
- [ ] Voxta emote name mapping
- [ ] Voxta folder structure validation
- [ ] Web import handler tests
- [ ] RAG document indexing tests
- [ ] LLM preset operation tests

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main project documentation
- [ROADMAP.md](./ROADMAP.md) - Development roadmap
- [GitHub Issues](https://github.com/axAilotl/card-architect/issues) - Bug reports and feature requests
