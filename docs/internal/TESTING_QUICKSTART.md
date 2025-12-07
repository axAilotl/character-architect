# Quick Start: Running Card Architect E2E Tests

## Prerequisites

1. Node.js 20+ installed
2. Dependencies installed: `npm install`
3. Playwright browsers installed: `npx playwright install`

## Running Tests

### Option 1: Run All Real Card Tests (Recommended)
```bash
npm run test:e2e:real-cards
```
This runs all tests using real character card files (import, export, round-trip).

### Option 2: Run Specific Test Suite
```bash
# Import tests (all formats)
npm run test:e2e:import

# Export tests (all formats)
npm run test:e2e:export-real

# Round-trip tests (data integrity)
npm run test:e2e:roundtrip

# Cross-platform tests (local vs production)
npm run test:e2e:cross-platform
```

### Option 3: Interactive UI Mode
```bash
npm run test:e2e:ui
```
Opens Playwright UI where you can:
- Run individual tests
- Debug step-by-step
- Inspect DOM
- View traces

### Option 4: Run Everything
```bash
npm run test:e2e
```
Runs all E2E tests including existing ones.

## What Each Test Suite Does

### Import Tests (`test:e2e:import`)
Tests importing character cards from all supported formats:
- CCv2 PNG and JSON (ChubAI format)
- RisuAI v3 PNG cards
- CharX files (.charx)
- Voxta packages (.voxpkg)
- CharacterTavern PNG
- Wyvern PNG

**Expected Duration**: ~3-5 minutes

### Export Tests (`test:e2e:export-real`)
Tests exporting cards to all formats:
- JSON export with spec validation
- PNG export with embedded data
- CharX export (ZIP with assets)
- Voxta export (full mode only)

**Expected Duration**: ~4-6 minutes

### Round-Trip Tests (`test:e2e:roundtrip`)
Tests data integrity through import→export→re-import cycles:
- Same format round-trips
- Cross-format conversions
- Multiple cycles (3+ iterations)
- Special character preservation

**Expected Duration**: ~5-7 minutes

### Cross-Platform Tests (`test:e2e:cross-platform`)
Compares local server vs production:
- Import parity
- Export parity
- Feature differences
- Performance comparison

**Expected Duration**: ~4-6 minutes
**Note**: Requires production site to be accessible

## Viewing Results

### After Tests Complete
```bash
npm run test:e2e:report
```
Opens an HTML report showing:
- Pass/fail status for each test
- Screenshots of failures
- Test duration
- Detailed error messages

### Test Output Location
- HTML Report: `playwright-report/index.html`
- JSON Results: `test-results/results.json`
- Screenshots: `test-results/`
- Videos: `test-results/` (on retry)
- Traces: `test-results/` (on retry)

## Troubleshooting

### Tests Fail to Start
```bash
# Ensure servers are not already running
killall node
npm run test:e2e
```

### "Cannot find test card file"
```bash
# Verify test cards exist
ls -la testing/chub/main_shana-e03c661ffb1d_spec_v2.png
```

### Cross-Platform Tests Fail
```bash
# Run only local tests
npm run test:e2e:import
npm run test:e2e:export-real
npm run test:e2e:roundtrip

# Skip cross-platform tests if production is down
```

### Timeout Errors
```bash
# Run with increased timeout
npx playwright test --timeout=120000
```

### Want to Debug a Specific Test
```bash
# Run with headed browser
npx playwright test --headed

# Run with debugger
npx playwright test --debug

# Run specific test by name
npx playwright test -g "should import CCv2 PNG card"
```

## Test Modes

### Full Mode (Default)
- Runs against local server: `http://localhost:5173`
- All features available (including Voxta export)
- Automatic server startup

### Light Mode
- Runs against production build: `http://localhost:4173`
- Client-side only (no Voxta export)
- Tests skip server-dependent features

### Run Specific Mode
```bash
# Full mode only
npx playwright test --project=full-mode

# Light mode only
npx playwright test --project=light-mode
```

## Common Commands

```bash
# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific file
npx playwright test real-cards-import.spec.ts

# Run specific test
npx playwright test -g "CCv2 PNG"

# Show report
npm run test:e2e:report

# List all tests
npx playwright test --list

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug
```

## Expected Test Results

### Passing Tests
When all tests pass, you should see:
```
✓ real-cards-import.spec.ts (30 tests)
✓ real-cards-export.spec.ts (25 tests)
✓ real-cards-roundtrip.spec.ts (35 tests)
✓ cross-platform.spec.ts (20 tests)

110 passed (15m)
```

### Known Skips
Some tests are intentionally skipped:
- Voxta export tests skip in light-mode (expected)
- Cross-platform tests may skip if production unavailable (expected)

### Test Artifacts
After running tests, check:
```bash
# View downloads from export tests
ls -la e2e/test-downloads/

# View test results
ls -la test-results/

# View HTML report
open playwright-report/index.html
```

## Environment Variables (Optional)

```bash
# Customize test URLs
export FULL_MODE_URL=http://localhost:5173
export LIGHT_MODE_URL=http://localhost:4173
export PRODUCTION_URL=https://ca.axailotl.ai

# Run tests
npm run test:e2e:cross-platform
```

## CI/CD Mode

```bash
# Run in CI mode (2 retries, single worker)
CI=1 npm run test:e2e:real-cards
```

## Performance

### Typical Test Times
- Import tests: ~3-5 minutes
- Export tests: ~4-6 minutes
- Round-trip tests: ~5-7 minutes
- Cross-platform tests: ~4-6 minutes
- **Total (all real card tests)**: ~15-20 minutes

### Optimization
```bash
# Run tests in parallel (faster but uses more resources)
npx playwright test --workers=4

# Run only fast tests
npx playwright test --grep-invert "slow|timeout"
```

## Getting Help

1. Check `/e2e/README.md` for detailed documentation
2. View test file comments for specific test explanations
3. Run with `--debug` flag to inspect failures
4. Check `playwright-report/` for detailed error messages
5. Look at test-results/ for screenshots and videos

## Next Steps

After tests pass:
1. Review HTML report for any warnings
2. Check test coverage in `TEST_SUMMARY.md`
3. Add new test cards to `/testing/` directory
4. Extend tests for new features
5. Integrate with CI/CD pipeline

---

**Quick Reference Card**

```bash
# Most common commands
npm run test:e2e:real-cards    # Run all real card tests
npm run test:e2e:ui            # Interactive UI mode
npm run test:e2e:report        # View results

# Debug failing test
npx playwright test --debug -g "test name"

# Re-run failed tests only
npx playwright test --last-failed
```
