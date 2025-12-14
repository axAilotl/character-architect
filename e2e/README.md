# Character Architect E2E Test Suite

Comprehensive end-to-end tests for Character Architect using **real character card files** from various formats and sources.

## Test Files Overview

### Real Card Tests (Using Actual Card Files)

1. **real-cards-import.spec.ts** - Import tests for all supported formats
   - CCv2 format (ChubAI cards)
   - RisuAI v3 PNG cards
   - CharX format cards
   - Voxta package files
   - CharacterTavern format
   - Wyvern format
   - Import error handling
   - Batch import tests

2. **real-cards-export.spec.ts** - Export tests using real imported cards
   - JSON export (CCv2/CCv3)
   - PNG export with embedded data
   - CharX export (ZIP with assets)
   - Voxta export (full mode only)
   - Export data integrity
   - File naming validation

3. **real-cards-roundtrip.spec.ts** - Round-trip data integrity tests
   - Same format round-trips (PNG→PNG, JSON→JSON, CharX→CharX)
   - Cross-format round-trips (PNG→JSON→PNG, CharX→JSON→CharX)
   - Multiple round-trip cycles
   - Special character preservation
   - Asset preservation
   - Metadata preservation

4. **cross-platform.spec.ts** - Local vs Production comparison
   - Import parity across platforms
   - Export parity across platforms
   - Feature availability differences
   - Data interchange between platforms
   - UI consistency
   - Performance comparison
   - Error handling consistency

### Existing Tests

- **card-export.spec.ts** - Original export tests with synthetic fixtures
- **ui-elements.spec.ts** - UI element validation
- **parity.spec.ts** - Feature parity between full and light modes

## Test Data

All tests use **real character card files** from the `/testing/` directory:

```
testing/
├── chub/              # CCv2 cards from ChubAI
├── risu_v3/           # RisuAI v3 PNG cards
├── risu_charx/        # CharX format cards
├── voxta/             # Voxta package files (.voxpkg)
├── CharacterTavern/   # CharacterTavern format
└── wyvern/            # Wyvern format cards
```

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test Suites
```bash
# Import tests
npm run test:e2e:import

# Export tests (real cards)
npm run test:e2e:export-real

# Round-trip tests
npm run test:e2e:roundtrip

# Cross-platform tests
npm run test:e2e:cross-platform

# All real card tests
npm run test:e2e:real-cards
```

### Run with UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Run Against Specific Project
```bash
# Full mode only
npx playwright test --project=full-mode

# Light mode only
npx playwright test --project=light-mode

# Both modes
npx playwright test --project=full-mode --project=light-mode
```

### View Test Report
```bash
npm run test:e2e:report
```

## Test Targets

### Full Mode (Local Server)
- URL: `http://localhost:5173`
- Features: All features including Voxta export, server-side processing
- Started automatically by Playwright config

### Light Mode (Production Build)
- URL: `http://localhost:4173`
- Features: Client-side only (no Voxta export)
- Started automatically by Playwright config

### Production (Cloudflare)
- URL: `https://ca.axailotl.ai`
- Used in cross-platform tests
- Not started automatically - must be accessible

## Environment Variables

Configure test targets via environment variables:

```bash
# Full mode URL (default: http://localhost:5173)
export FULL_MODE_URL=http://localhost:5173

# Light mode URL (default: http://localhost:4173)
export LIGHT_MODE_URL=http://localhost:4173

# Production URL for cross-platform tests (default: https://ca.axailotl.ai)
export PRODUCTION_URL=https://ca.axailotl.ai
```

## Test Organization

### Import Tests Structure
- **Format-specific test groups**: Each format (CCv2, CharX, Voxta, etc.) has its own `describe` block
- **Data integrity checks**: Verify all card fields are correctly parsed
- **Error handling**: Test invalid files and corrupted data
- **Special cases**: Unicode characters, Korean filenames, large files

### Export Tests Structure
- **Format validation**: Each export format validated against spec
- **Data preservation**: Verify exported data matches imported data
- **Cross-format consistency**: Same card exported to different formats should have matching data
- **Mode-specific features**: Voxta export only tested in full mode

### Round-Trip Tests Structure
- **Same format**: Import → Export (same format) → Re-import
- **Cross format**: Import → Export (different format) → Re-import
- **Multiple cycles**: 3+ round trips to verify no data degradation
- **Asset preservation**: Verify assets survive format conversions

### Cross-Platform Tests Structure
- **Parallel browser contexts**: Separate browsers for local and production
- **Import parity**: Same card should import identically on both platforms
- **Export parity**: Exports should be equivalent (accounting for mode differences)
- **Feature detection**: Identify full-mode vs light-mode features
- **Data interchange**: Export from one platform, import to another

## Key Test Patterns

### 1. Import a Card
```typescript
const importButton = page.locator('button:has-text("Import")');
await importButton.click();
await page.waitForTimeout(300);

const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles(cardFilePath);

await page.waitForURL(/\/cards\//, { timeout: 15000 });
await waitForAppLoad(page);
```

### 2. Export a Card
```typescript
const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

const exportButton = page.locator('button:has-text("Export")');
await exportButton.click();

const formatButton = page.locator('button:has-text("JSON")');
await formatButton.click();

const download = await downloadPromise;
const downloadPath = await download.path();
```

### 3. Verify Card Data
```typescript
const nameInput = page.getByRole('textbox').first();
await expect(nameInput).toHaveValue(/ExpectedName/i, { timeout: 5000 });

const textareas = page.locator('textarea');
const description = await textareas.nth(0).inputValue();
```

### 4. Validate Exported Files
```typescript
// JSON validation
const jsonData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
const validation = validateJsonCard(jsonData);
expect(validation.valid).toBe(true);

// PNG validation
const pngValidation = await validatePngCard(exportPath);
expect(pngValidation.valid).toBe(true);

// CharX validation
const charxValidation = await validateCharxFile(exportPath);
expect(charxValidation.valid).toBe(true);
```

## Test Coverage

### Supported Formats
- ✅ CCv2 JSON
- ✅ CCv2 PNG (embedded)
- ✅ CCv3 JSON (via existing fixtures)
- ✅ RisuAI v3 PNG
- ✅ CharX (ZIP archive)
- ✅ Voxta packages (.voxpkg)
- ✅ CharacterTavern PNG
- ✅ Wyvern PNG

### Test Scenarios
- ✅ Import all formats
- ✅ Export to JSON, PNG, CharX
- ✅ Export to Voxta (full mode only)
- ✅ Round-trip same format
- ✅ Round-trip cross format
- ✅ Multiple round-trip cycles
- ✅ Special characters (Unicode, Korean)
- ✅ Large files with assets
- ✅ Invalid file handling
- ✅ Corrupted file handling
- ✅ Cross-platform data interchange
- ✅ Feature parity detection

## Known Limitations

### Light Mode (Production)
- ❌ No Voxta export (server-side only)
- ❌ No CharX optimization API (may be slower)
- ✅ All other features work identically

### Cross-Platform Tests
- Requires production site to be accessible
- Network latency may affect performance tests
- Some tests create temporary files in `/tmp`

## Debugging Tests

### Run Single Test
```bash
npx playwright test -g "should import CCv2 PNG card"
```

### Run with Debug UI
```bash
npx playwright test --debug
```

### Run with Headed Browser
```bash
npx playwright test --headed
```

### Run with Trace
```bash
npx playwright test --trace on
```

### Inspect Trace
```bash
npx playwright show-trace trace.zip
```

## Test Maintenance

### Adding New Format Support
1. Add test card files to `/testing/[format-name]/`
2. Add import tests to `real-cards-import.spec.ts`
3. Add export tests to `real-cards-export.spec.ts`
4. Add round-trip tests to `real-cards-roundtrip.spec.ts`
5. Update this README

### Updating Test Cards
- Keep original filenames for traceability
- Document source (e.g., ChubAI, RisuAI, etc.)
- Include variety: simple cards, complex cards, special characters
- Test cards should be small (< 5MB) for fast tests

### Test Helper Functions
Located in `/e2e/utils/test-helpers.ts`:
- `importCardFile()` - Import a card
- `waitForAppLoad()` - Wait for app to load
- `validateJsonCard()` - Validate JSON structure
- `validatePngCard()` - Validate PNG and embedded data
- `validateCharxFile()` - Validate CharX ZIP structure

## CI/CD Integration

Tests are configured to run in CI with:
- 2 retries on failure
- Single worker (sequential execution)
- HTML, JSON, and list reporters
- Screenshots on failure
- Video on first retry
- Trace on first retry

## Troubleshooting

### Tests Timeout
- Increase timeout in test or config
- Check if server is starting properly
- Verify network connectivity for cross-platform tests

### Import Fails
- Verify test card file exists
- Check file format is supported
- Look for console errors in trace

### Export Fails
- Ensure card is fully loaded before export
- Check if format is available in current mode
- Verify download directory is writable

### Cross-Platform Tests Fail
- Verify production URL is accessible
- Check for CORS issues
- Ensure both platforms use same version

## Contributing

When adding tests:
1. Use real card files from `/testing/` directory
2. Follow existing test patterns
3. Add descriptive test names
4. Include error handling tests
5. Update this README
6. Verify tests pass in both full and light modes

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Character Architect Documentation](../README.md)
- [Character Card Specs](https://github.com/malfoyslastname/character-card-spec-v2)
- [CharX Format Spec](https://github.com/SillyTavern/SillyTavern-CharX-Spec)
