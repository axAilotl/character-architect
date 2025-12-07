# Data Integrity Test Plan

## Overview

This document outlines comprehensive API-level testing to ensure data integrity across all character card format conversions and import/export operations.

## Current Test Coverage

### Existing Tests (`apps/api/src/__tests__/`)

| Test File | Coverage |
|-----------|----------|
| `format-interoperability.test.ts` | Wyvern, Chub, CharacterTavern imports; JSON/PNG round-trip; V2↔V3 conversion |
| `charx-asset-integrity.test.ts` | Default icon handling, explicit icon preference |
| `api-endpoints.test.ts` | CRUD operations |
| `card-validation.test.ts` | Validation logic |

### Gaps Identified

1. **CHARX full round-trip** - No test for: import CHARX → modify → export → verify all data preserved
2. **Voxta round-trip** - No test for .voxpkg import/export cycle
3. **Voxta ↔ CCv3 translation** - No measurement of field mapping fidelity
4. **Multi-asset packages** - No test with 5+ assets of mixed types
5. **Extension data preservation** - No deep testing of custom extensions through conversions
6. **Real fixture testing** - Complex real-world cards not used in API tests
7. **Random mutation testing** - No fuzzing/mutation verification
8. **CCv3-specific round-trip** - Only V2 round-trip tested

---

## Proposed Test Suite: `data-integrity.test.ts`

### Test Categories

#### 1. Round-Trip Integrity Tests

Tests that verify: Import → Edit with random data → Export → Re-import → Compare

```
describe('Round-Trip Data Integrity')
├── describe('CCv2 JSON Round-Trip')
│   ├── should preserve all top-level fields
│   ├── should preserve extensions object
│   └── should handle random field mutations
│
├── describe('CCv3 JSON Round-Trip')
│   ├── should preserve all CCv3 fields including assets array
│   ├── should preserve creator_notes and system_prompt
│   └── should handle random field mutations
│
├── describe('CHARX Package Round-Trip')
│   ├── should preserve card.json data exactly
│   ├── should preserve all asset files (icons, backgrounds, custom)
│   ├── should preserve asset metadata (type, name, ext, tags)
│   └── should preserve embedded thumbnail
│
└── describe('Voxta Package Round-Trip')
    ├── should preserve character data
    ├── should preserve TTS configuration
    ├── should preserve chat/speech settings
    ├── should preserve emotion images mapping
    └── should preserve scripts (with known limitations)
```

#### 2. Cross-Format Conversion Tests

Tests that verify field mapping between formats

```
describe('Cross-Format Conversion Fidelity')
├── describe('CCv2 → CCv3 Conversion')
│   ├── should map all standard fields
│   ├── should convert character_book to lorebook format
│   └── should preserve extensions in CCv3 extensions object
│
├── describe('CCv3 → CCv2 Conversion')
│   ├── should map back to v2 fields
│   ├── should convert lorebook to character_book
│   └── should preserve extensions where possible
│
├── describe('CCv3 → Voxta Conversion')
│   ├── should map name, description, personality
│   ├── should convert first_mes to firstMessages array
│   ├── should convert lorebook to voxtaBook format
│   ├── should preserve creator metadata in voxtaExtension
│   └── should document fields that cannot be mapped (loss report)
│
└── describe('Voxta → CCv3 Conversion')
    ├── should map character fields correctly
    ├── should convert voxtaBook to lorebook entries
    ├── should preserve TTS/chat config in extensions.voxta
    └── should document scripts/service-specific data loss
```

#### 3. Multi-Asset Package Tests

Tests for packages with multiple asset types

```
describe('Multi-Asset Integrity')
├── describe('CHARX with multiple asset types')
│   ├── should preserve multiple icons (main + alternates)
│   ├── should preserve background images
│   ├── should preserve custom assets
│   ├── should preserve sound files
│   └── should maintain correct asset→character mapping
│
└── describe('Voxta with emotion images')
    ├── should preserve all emotion states
    ├── should preserve actor images (portrait-override, actor-N)
    └── should maintain emotion→image mappings
```

#### 4. Extension Data Preservation Tests

Tests for custom/vendor extension data

```
describe('Extension Data Preservation')
├── describe('Chub extensions')
│   ├── should preserve chub.alt_expressions
│   ├── should preserve chub.full_path
│   └── should survive CCv2 → CCv3 → CCv2 cycle
│
├── describe('Depth prompt extension')
│   ├── should preserve depth prompt configs
│   └── should survive format conversions
│
├── describe('Voxta extension')
│   ├── should preserve TTS provider config
│   ├── should preserve voice settings
│   └── should preserve chat parameters
│
└── describe('Custom unknown extensions')
    ├── should preserve arbitrary extension objects
    └── should not strip unknown vendor data
```

#### 5. Lorebook/Character Book Deep Tests

Tests for lorebook entry preservation

```
describe('Lorebook Data Integrity')
├── should preserve all entry fields
│   ├── keys (array of triggers)
│   ├── content (the actual lore)
│   ├── enabled flag
│   ├── insertion_order
│   ├── case_sensitive
│   ├── priority
│   ├── position (before_char, after_char, etc.)
│   ├── extensions
│   └── secondary_keys
│
├── should preserve scan_depth and token_budget
├── should preserve recursive_scanning flag
├── should handle 50+ entries without data loss
└── should preserve entries through Voxta↔CCv3 conversion
```

#### 6. Real-World Fixture Tests

Tests using actual complex character cards

```
describe('Real-World Card Integrity')
├── describe('CCv2 Complex Cards')
│   ├── test-ccv2-amanda.json (34KB with extensions)
│   └── test-ccv2-lira.json (66KB with full lorebook)
│
├── describe('CCv3 Complex Cards')
│   ├── test-ccv3-beepboop.json (105KB with assets)
│   ├── test-ccv3-jem.json (11KB simple)
│   └── test-ccv3-westia.json (95KB complex)
│
└── each card should:
    ├── import successfully
    ├── survive round-trip to all supported formats
    ├── maintain character identity (name, core personality)
    └── preserve lorebook entry count and content
```

---

## Implementation Approach

### Test Helpers Needed

```typescript
// Deep comparison helper that reports differences
function deepCompare(original: any, roundTripped: any, path = ''): DiffReport

// Random field mutation helper
function mutateRandomFields(card: CCv3Data, mutations: number): { card: CCv3Data, changes: Change[] }

// Field-by-field comparison with tolerance for expected losses
function compareWithTolerance(a: any, b: any, toleratedLosses: string[]): ComparisonResult

// Asset content comparison (binary)
function compareAssets(original: Asset[], imported: Asset[]): AssetComparisonResult
```

### Known Acceptable Losses

Document expected data loss for each conversion:

| Conversion | Acceptable Loss |
|------------|-----------------|
| CCv3 → Voxta | `system_prompt` (no direct mapping), `post_history_instructions`, some extension data |
| Voxta → CCv3 | Script content (service-specific), some TTS provider configs |
| CCv3 → CCv2 | `creator_notes`, `system_prompt` (uses extensions fallback), asset array |
| Any → PNG | Asset files beyond embedded image |

### Test Data Generation

For mutation testing:
1. Load real fixture
2. Generate random string for text fields
3. Generate random values for numeric fields
4. Add/remove lorebook entries
5. Modify extension objects
6. Export, re-import, verify mutations persisted

---

## File Structure

```
apps/api/src/__tests__/
├── format-interoperability.test.ts  (existing)
├── charx-asset-integrity.test.ts    (existing)
├── api-endpoints.test.ts            (existing)
├── card-validation.test.ts          (existing)
└── data-integrity.test.ts           (NEW - comprehensive suite)

e2e/fixtures/
├── test-card.json           (simple CCv3)
├── test-ccv2-amanda.json    (complex CCv2)
├── test-ccv2-lira.json      (CCv2 with lorebook)
├── test-ccv3-beepboop.json  (CCv3 with assets)
├── test-ccv3-jem.json       (simple CCv3)
├── test-ccv3-westia.json    (complex CCv3)
├── test-avatar.png          (test image)
├── test-charx-multi.charx   (NEW - multi-asset CHARX)
└── test-voxta.voxpkg        (NEW - Voxta package)
```

---

## Execution

```bash
# Run all data integrity tests
npm test -- --grep "Data Integrity"

# Run specific category
npm test -- --grep "Round-Trip"
npm test -- --grep "Cross-Format"
npm test -- --grep "Multi-Asset"
```

---

## Success Criteria

1. **Zero unexpected data loss** - All fields not in "Acceptable Loss" list must survive
2. **Asset binary integrity** - Exported assets byte-identical to imported (or documented optimization)
3. **Lorebook completeness** - Entry count and content preserved
4. **Extension preservation** - All vendor extensions survive their format's round-trip
5. **Real-world compatibility** - All test fixtures pass full round-trip

---

## Priority Order

1. **High**: CHARX round-trip (most complex format)
2. **High**: Voxta round-trip (user-requested)
3. **High**: Lorebook deep testing (critical for RP)
4. **Medium**: Real fixture testing
5. **Medium**: Cross-format fidelity measurement
6. **Low**: Random mutation fuzzing
