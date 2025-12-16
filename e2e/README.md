# Character Architect — E2E (Playwright)

This repo’s E2E suite is fixture-driven and **compares real imports/exports to the shared golden fixture set**.

## Test files

- `e2e/golden-fixtures.spec.ts` — Smoke: import → export (JSON/PNG/CHARX/Voxta) must preserve normalized card data.
- `e2e/ui-elements.spec.ts` — Extended UI sweep (runs only in `CF_TEST_TIER=extended|large`).
- `e2e/parity.spec.ts` — Extended deployment parity checks (runs only in `CF_TEST_TIER=extended|large`).
- `e2e/cross-platform.spec.ts` — Optional deployed smoke (runs only when `PRODUCTION_URL` is set).
- `e2e/debug-app-load.debug.ts` — Debug helper (not part of normal runs).

## Shared golden fixtures

E2E tests use the shared fixture repository (single source of truth):

- `CF_FIXTURES_DIR` (required): path to the fixtures root (e.g. `/home/vega/ai/character-foundry/fixtures`)
- Tiers:
  - `CF_TEST_TIER=basic|extended|large` (default: `basic`)
  - `CF_RUN_LARGE_TESTS=1` (equivalent to `CF_TEST_TIER=large`)
  - `CF_ALLOW_MISSING_FIXTURES=1` (explicitly skip fixture-driven suites instead of failing)

## Running locally (hermetic)

Playwright starts two local targets by default:
- Full mode dev server: `http://localhost:5173` (`npm run dev`)
- Light mode preview: `http://localhost:4173` (`VITE_DEPLOYMENT_MODE=light ... preview`)

```bash
export CF_FIXTURES_DIR=/home/vega/ai/character-foundry/fixtures
npm run test:e2e
```

Run only the fixture smoke suite:

```bash
export CF_FIXTURES_DIR=/home/vega/ai/character-foundry/fixtures
npm run test:e2e:fixtures
```

Run extended suites:

```bash
export CF_FIXTURES_DIR=/home/vega/ai/character-foundry/fixtures
export CF_TEST_TIER=extended
npm run test:e2e
```

## Running against a deployed UI

Disable local web servers and point a project at a deployed URL:

```bash
export CF_FIXTURES_DIR=/home/vega/ai/character-foundry/fixtures
export PW_SKIP_WEB_SERVER=1
export LIGHT_MODE_URL=https://your-deployed-ui.example
npx playwright test --project=light-mode
```

## Optional: local vs production smoke

```bash
export CF_FIXTURES_DIR=/home/vega/ai/character-foundry/fixtures
export PRODUCTION_URL=https://your-production-url.example
npm run test:e2e:cross-platform
```

## Useful Playwright env vars

- `PW_SKIP_WEB_SERVER=1` — don’t start local servers (for deployed/staging runs)
- `PW_REUSE_SERVER=1` — reuse already-running local servers (not hermetic)
- `PW_WORKERS=1` — set worker count (defaults to `1` for determinism)

