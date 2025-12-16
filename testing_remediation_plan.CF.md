# Character Architect — Testing Remediation Plan (Character Foundry Golden Fixtures)

**Last updated:** 2025-12-16  
**Scope:** This repo (`card-architect`) across `apps/api` (Fastify) + `apps/web` (React/Vite) + `e2e` (Playwright).

## 0) Why this exists

We want tests to catch *real* regressions in import/export/validation and security handling without becoming flaky, slow, or “green by accident”.

This plan standardizes on:
- a single shared **golden fixtures** dataset (external to the repo),
- **explicit** skipping (no silent PASS),
- **tiered** test execution (`basic` always; `extended` on-demand; `large` manual/scheduled),
- **real parsers/schemas** (same code paths prod uses).

## 1) Fixtures contract (non-negotiable)

### 1.1 Fixture root
Tests must read the fixture root from:
- `CF_FIXTURES_DIR` (preferred)

Local default (this machine):
- `/home/vega/ai/character-foundry/fixtures`

### 1.2 Missing fixtures policy
- CI: **missing fixtures should fail**
- Local dev: allow skipping *only* with explicit opt-in:
  - `CF_ALLOW_MISSING_FIXTURES=1`

## 2) What’s already wired in this repo

### 2.1 Tier 1 (basic) fixture parsing test
File: `apps/api/src/__tests__/golden-fixtures.basic.test.ts`

Behavior:
- Reads `MANIFEST.md` from `CF_FIXTURES_DIR` (or the local default path)
- Extracts the **Tier 1: Basic** table entries
- Parses each fixture with `@character-foundry/character-foundry/loader` using `{ extractAssets: true }`
- Asserts container format + normalized spec and that asset containers yield a main icon asset

Note:
- “v1 unwrapped JSON” is normalized by the loader to `spec = v2`; the test reflects that.

### 2.2 Import/export parity (API)
File: `apps/api/src/__tests__/golden-fixtures.test.ts`

Behavior:
- Imports each fixture via Fastify `inject()` (no network), then exports JSON/PNG/CHARX and compares normalized card data.

### 2.3 Import/export parity (Web client)
File: `apps/web/src/__tests__/golden-json-fixtures.test.ts`

Behavior:
- Runs `importCardClientSide()` then `exportCardAsJSON()` and compares normalized card data for JSON fixtures.

### 2.4 Import/export parity (E2E)
File: `e2e/golden-fixtures.spec.ts`

Behavior:
- Uses the UI to import a small fixture set and validates exported bytes parse back to equivalent normalized data.

## 3) Next steps (remediation roadmap)

### 3.1 L0 — Data-driven parsing/normalization tests (fast)
Goal: prove that **every `basic/` fixture** parses + schema-validates + normalizes consistently.

Add:
- A small “canonicalization” helper (deterministic sorting, timestamp normalization)
- Canonical expected outputs (preferably in the fixtures repo) so tests can do:
  - `parse -> normalize -> canonicalize -> deepEqual(expected)`

### 3.2 L1 — API integration (no network, hermetic DB/storage)
Goal: ensure upload/import endpoints persist correct metadata and never trust client fields.

Requirements:
- Temp SQLite DB path per test run
- Temp storage directory per test run
- Prefer Fastify `inject()` (no listening server)

Target endpoints:
- `apps/api/src/routes/import-export.ts`
- `apps/api/src/routes/cards.ts`

### 3.3 L2 — Web unit/component tests (import UX + token display)
Goal: prevent regressions in client parsing flows and UI rendering without full E2E.

Targets:
- `src/lib/client/card-parser.ts` (imports all `basic/` fixtures)
- upload UI token display + warnings rendering

### 3.4 L3 — E2E (Playwright, small but brutal)
Goal: catch “works locally, breaks deployed” and real-user flows.

Keep it small:
- Import 2–4 `basic/` fixtures (png v3, charx v3, voxta single/multi)
- Assert critical fields render, exports parse back, and no console errors

### 3.5 Tiering controls
Implement a single env switch for fixture tiers, e.g.:
- `CF_TEST_TIER=basic|extended|large` (default `basic`)

Default:
- `basic` for `npm test`

## 4) How to run

Run unit tests with fixtures:
```bash
CF_FIXTURES_DIR=/home/vega/ai/character-foundry/fixtures npm test
```

Skip fixtures locally (not for CI):
```bash
CF_ALLOW_MISSING_FIXTURES=1 npm test
```
