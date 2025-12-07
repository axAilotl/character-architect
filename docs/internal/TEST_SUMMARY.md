# Card Architect E2E Test Suite - Implementation Summary

## Overview

Created comprehensive E2E test suite for Card Architect using **real character card files** from the `/testing/` directory. The test suite covers import, export, round-trip validation, and cross-platform comparison across multiple character card formats.

## Files Created

### 1. `/e2e/real-cards-import.spec.ts` (564 lines)
**Purpose**: Test importing various character card formats

**Coverage**:
- CCv2 format (ChubAI) - PNG and JSON variants
- RisuAI v3 PNG cards with assets
- CharX format cards (including Korean filename)
- Voxta package files (.voxpkg)
- CharacterTavern format
- Wyvern format
- Import data integrity validation
- Error handling (invalid files, corrupted PNGs)
- Batch import tests

**Test Count**: 30+ tests across 8 format types

### 2. `/e2e/real-cards-export.spec.ts` (532 lines)
**Purpose**: Test exporting cards to all supported formats

**Coverage**:
- JSON export (CCv2/CCv3 spec validation)
- PNG export with embedded character data
- CharX export (ZIP structure validation)
- Voxta export (full mode only, light mode skipped)
- Data preservation across exports
- Special character handling
- File naming conventions
- Export error handling

**Test Count**: 25+ tests across 4 export formats

### 3. `/e2e/real-cards-roundtrip.spec.ts` (583 lines)
**Purpose**: Test data integrity through complete import→export→re-import cycles

**Coverage**:
- Same format round-trips (PNG→PNG, JSON→JSON, CharX→CharX)
- Cross-format round-trips (PNG→JSON→PNG, CharX→PNG→CharX, etc.)
- Multiple round-trip cycles (3+ iterations)
- Special character preservation (Unicode, Korean)
- Long content preservation
- Asset preservation through conversions
- Metadata preservation (creator, tags)
- Structure validation after each cycle

**Test Count**: 35+ tests covering 20+ round-trip scenarios

### 4. `/e2e/cross-platform.spec.ts` (553 lines)
**Purpose**: Compare behavior between local (full mode) and production (light mode)

**Coverage**:
- Import parity across platforms
- Export parity across platforms
- Feature availability differences (Voxta export detection)
- Data interchange (export from local, import to production)
- UI consistency validation
- Performance comparison (load times, import times)
- Error handling consistency
- HTTPS verification on production
- PWA capabilities detection

**Test Count**: 20+ tests using parallel browser contexts

### 5. `/e2e/README.md`
Comprehensive documentation covering:
- Test suite overview
- Running instructions
- Test data sources
- Environment configuration
- Test patterns and examples
- Debugging guide
- Maintenance procedures
- CI/CD integration notes

### 6. Updated `/package.json`
Added npm scripts:
```json
"test:e2e:import": "playwright test real-cards-import.spec.ts"
"test:e2e:export-real": "playwright test real-cards-export.spec.ts"
"test:e2e:roundtrip": "playwright test real-cards-roundtrip.spec.ts"
"test:e2e:cross-platform": "playwright test cross-platform.spec.ts"
"test:e2e:real-cards": "playwright test real-cards-*.spec.ts"
```

## Test Data

All tests use **real character card files** from `/testing/`:

```
testing/
├── chub/ (40+ files)
│   ├── main_shana-e03c661ffb1d_spec_v2.png
│   ├── main_shana-e03c661ffb1d_spec_v2.json
│   └── ... (various CCv2 cards)
│
├── risu_v3/ (3 files)
│   ├── Character Creator Bot.png
│   ├── Monster Musume Paradise.png
│   └── Absolute Mother (wedding).png
│
├── risu_charx/ (4 files)
│   ├── Ailu Narukami.charx
│   ├── Harper.charx
│   ├── Hogwarts -IF-.charx
│   └── 오가미 이토코 v4.51.charx (Korean)
│
├── voxta/ (7 files)
│   ├── 2B.1.0.0.voxpkg
│   ├── Agent Nyx.1.0.0.voxpkg
│   ├── Vexa.1.0.0.voxpkg
│   └── ... (more .voxpkg files)
│
├── CharacterTavern/ (10+ PNG files)
├── wyvern/ (10+ PNG files)
└── ... (other formats)
```

## Test Execution

### Quick Start
```bash
# Run all real card tests
npm run test:e2e:real-cards

# Run specific test suite
npm run test:e2e:import
npm run test:e2e:export-real
npm run test:e2e:roundtrip
npm run test:e2e:cross-platform

# Interactive UI mode
npm run test:e2e:ui

# View report
npm run test:e2e:report
```

### Test Targets

1. **Full Mode** (http://localhost:5173)
   - All features including Voxta export
   - Server-side processing
   - Started automatically by Playwright

2. **Light Mode** (http://localhost:4173)
   - Client-side only
   - No Voxta export
   - Production build preview

3. **Production** (https://ca.axailotl.ai)
   - Used in cross-platform tests
   - Must be accessible externally

## Key Features

### 1. Real Card Testing
- No synthetic fixtures - all tests use actual character cards
- Cards from multiple sources: ChubAI, RisuAI, CharacterTavern, Wyvern
- Variety of sizes, complexity, and special characters

### 2. Comprehensive Format Coverage
- **6 import formats**: CCv2 (PNG/JSON), RisuAI v3, CharX, Voxta, CharacterTavern, Wyvern
- **4 export formats**: JSON, PNG, CharX, Voxta
- Full round-trip validation for all format combinations

### 3. Cross-Platform Validation
- Parallel browser testing (local + production)
- Import/export parity verification
- Feature availability detection
- Data interchange validation

### 4. Robust Error Handling
- Invalid file detection
- Corrupted PNG handling
- Network timeout handling
- Mode-specific feature detection

### 5. Data Integrity
- Field-by-field comparison
- Special character preservation
- Asset preservation
- Metadata preservation
- Multi-cycle round-trip validation

## Test Statistics

- **Total Lines of Code**: 2,232 lines (test files only)
- **Total Test Cases**: 110+ individual tests
- **Formats Covered**: 8 character card formats
- **Real Card Files Used**: 70+ actual cards
- **Round-Trip Scenarios**: 20+ format combinations
- **Cross-Platform Tests**: 20+ comparison tests

## Integration with Existing Tests

The new test suite complements existing tests:

| Test File | Purpose | Status |
|-----------|---------|--------|
| card-export.spec.ts | Synthetic fixture export tests | Existing |
| ui-elements.spec.ts | UI validation | Existing |
| parity.spec.ts | Full/light mode parity | Existing |
| **real-cards-import.spec.ts** | **Real card import tests** | **New** |
| **real-cards-export.spec.ts** | **Real card export tests** | **New** |
| **real-cards-roundtrip.spec.ts** | **Round-trip validation** | **New** |
| **cross-platform.spec.ts** | **Local vs production** | **New** |

## Test Configuration

Uses existing Playwright configuration (`playwright.config.ts`):
- 2 retries in CI
- Screenshots on failure
- Video on first retry
- Trace on first retry
- Multiple reporters (HTML, JSON, list)
- Both full-mode and light-mode projects

## Known Limitations & Edge Cases

### Light Mode Exclusions
- Voxta export tests skipped (server-side only feature)
- CharX optimization may be slower (no API server)

### Cross-Platform Requirements
- Production site must be accessible
- Network latency affects performance tests
- Temporary files created in `/tmp`

### Special Cases Tested
- ✅ Unicode characters (Korean filenames, Japanese text)
- ✅ Long descriptions (2000+ characters)
- ✅ Empty fields
- ✅ Cards with no avatars
- ✅ Cards with multiple assets
- ✅ Corrupted files
- ✅ Invalid file types

## Validation Functions

Located in `/e2e/utils/test-helpers.ts`:

```typescript
validateJsonCard(data)      // CCv2/CCv3 spec validation
validatePngCard(filePath)   // PNG signature + embedded data
validateCharxFile(filePath) // ZIP structure + card.json
```

## Next Steps & Recommendations

### Immediate
1. Run full test suite: `npm run test:e2e:real-cards`
2. Review test report: `npm run test:e2e:report`
3. Fix any failing tests specific to your environment

### Short-term
1. Add more test cards for edge cases
2. Implement visual regression testing
3. Add performance benchmarks
4. Test on mobile browsers (Safari, Chrome Mobile)

### Long-term
1. Integrate with CI/CD pipeline
2. Add mutation testing
3. Create test data generator
4. Add accessibility testing

## Running on Different Environments

### Local Development
```bash
npm run test:e2e:real-cards
```

### CI/CD
```bash
CI=1 npm run test:e2e:real-cards
```

### Specific Platform
```bash
# Full mode only
npx playwright test real-cards-*.spec.ts --project=full-mode

# Light mode only
npx playwright test real-cards-*.spec.ts --project=light-mode

# Production comparison
npx playwright test cross-platform.spec.ts
```

### With Custom URLs
```bash
FULL_MODE_URL=http://localhost:3000 \
PRODUCTION_URL=https://staging.example.com \
npm run test:e2e:cross-platform
```

## Maintenance

### Adding New Format
1. Add test card to `/testing/[format-name]/`
2. Update `real-cards-import.spec.ts` (new describe block)
3. Update `real-cards-export.spec.ts` (if export supported)
4. Update `real-cards-roundtrip.spec.ts` (add round-trip tests)
5. Update README.md documentation

### Updating Test Cards
- Keep original filenames
- Document card source
- Keep file sizes reasonable (< 5MB)
- Include variety: simple, complex, special chars

## Success Criteria

✅ **All 110+ tests pass on both full and light modes**
✅ **All real card formats import successfully**
✅ **All export formats produce valid outputs**
✅ **Round-trip tests preserve data integrity**
✅ **Cross-platform tests show consistent behavior**
✅ **Error handling tests catch invalid inputs**
✅ **No console errors during test execution**

## Documentation

- `/e2e/README.md` - Complete test suite documentation
- This file - Implementation summary
- Test files - Inline comments and JSDoc

## Tools & Dependencies

- Playwright 1.57.0
- TypeScript 5.3.3
- Node.js 20+
- Real character cards from community sources

---

**Test Suite Author**: Claude (Playwright Expert Mode)
**Created**: December 2025
**Total Development Time**: ~2 hours
**Test Coverage**: Comprehensive (import, export, round-trip, cross-platform)
