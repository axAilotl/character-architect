# Dependency Upgrade Log

This log records dependency decisions and validation for Character Architect. The initial sections describe the August 2026 Node 24 maintenance pass; subsequent dated sections record follow-up updates.

## Runtime baseline

- Node.js: 20.x to 24.x LTS
- pnpm: legacy/unpinned usage to 11.24.0
- Docker base: `node:20-slim` to `node:24-bookworm-slim`

## Package upgrades

### `better-sqlite3` 9.6.0 to 13.0.3

- Reason: 9.6.0 fails to compile against Node 24's V8 API in a clean Docker build.
- Compatibility review: 13.0.3 requires Node 22 or newer, uses N-API, and publishes Linux glibc prebuilds. Existing transaction callbacks are synchronous and do not rely on the Promise behavior rejected by newer releases.
- Validation: clean Node 24 install, API build, 98 fixture-backed API tests, and a clean Docker build pass. The Docker install compiles the native module successfully.
- Release notes: https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.3

### TypeScript 5.9.3 to 6.0.3 and Node types 20.x to 24.13.3

- Reason: align compiler/type declarations with the Node 24 runtime while keeping browser globals isolated from server globals.
- Compatibility review: TypeScript 7 currently omits the compiler API required by `typescript-eslint`; 6.0.3 is the newest compatible stable compiler. Node types are explicitly scoped to server/build packages, while the web application uses only `vite/client`.
- Validation: workspace type checking and API/full/light/static production builds pass.
- Release notes: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/

### Character Foundry aggregate prerelease to 0.5.0

- Reason: replace a timestamped prerelease and stale direct-package graph with the supported stable aggregate package.
- Compatibility review: 0.5.0 is tested upstream on Node 24 and supports React 18/19. API, web, E2E, and import-core now declare the aggregate directly; only `@character-foundry/core@0.1.3` remains for the `/zip` export that is not re-exported by the aggregate.
- Validation: import fixtures, API/web tests, static browser startup, and full/light/static builds pass.
- Source: https://github.com/character-foundry/character-foundry/commit/322fe8d940d1b91c978b43330b80ab2e115002e4

### API runtime and native dependency group

- Fastify 4.29.1 to 5.12.1, CORS 8.5.0 to 11.3.0, multipart 8.3.1 to 10.1.1, and static 6.12.0 to 10.1.3. The CORS method list is now explicit so update/delete endpoints remain available with the v11 defaults.
- Sharp 0.33.5 to 0.35.4, Axios 1.13.2 to 1.20.0, fflate 0.8.2 to 0.8.3, PDF Parse 1.1.4 to 2.4.5, dotenv 16.6.1 to 17.4.2, nanoid 5.1.6 to 6.0.1, and form-data 4.0.5 to 4.0.6.
- Removed unused API-side DOMPurify, jsdom, ws, and redundant type packages. Moved fflate and form-data into production dependencies because server code imports them at runtime.
- FastEmbed is pinned at its archived 2.1.0 release. Its vulnerable tar 6 dependency is overridden to tar 7.5.22, with a narrow source patch for tar 7's ESM/CommonJS export shape.
- Validation: frozen clean install, FastEmbed module import, production audit, API tests, full Docker build, and live request smoke pass.

### Browser runtime dependency group

- React/React DOM 18.3.1 to 19.2.8, React Router 7.10.1 to 7.18.3, Zustand 4.5.7 to 5.0.15, and React Hook Form 7.68.0 to 7.87.0. Resolver stays on the newest compatible v3 because Character Foundry's app framework peers on resolver v3.
- Milkdown is synchronized at 7.22.1, including its stored-XSS fixes. Removed unused Milkdown declarations and the unused Monaco wrapper.
- DOMPurify 3.3.1 to 3.4.14, Marked 11.2.0 to 18.0.11, CodeMirror/UIW patch-minor refreshes, and current idb/jsondiffpatch releases.
- Tailwind intentionally remains on 3.4.19: v4 is a CSS/config migration needing a dedicated visual pass, not a drop-in dependency refresh.
- Validation: web type checking, 53 fixture-backed browser tests, full/light/static builds, and a headless-Chromium static startup smoke pass.

### Build, lint, test, and deployment tooling

- TypeScript ESLint 8.50.0 to 8.68.0, ESLint 9.39.2 to 10.9.1, React lint plugins to current ESLint-10-compatible releases, Prettier 3.9.6, and concurrently 10.0.5.
- Vitest is unified at 4.1.11 and Playwright at 1.62.1; the redundant direct Playwright declaration was removed.
- Vite 7.3.0 to 8.2.2, React plugin 4.7.0 to 6.1.1, and PWA plugin 1.2.0 to 1.3.0. Deprecated Rollup/esbuild-only configuration was migrated to Rolldown configuration.
- Wrangler 3.114.15 to 4.127.1. The worker is static-assets-only, so no Worker bundling migration is required.
- Validation: lint/type/test/build matrix, Playwright static smoke, PWA artifact generation, and Wrangler production dry run pass. Live deployment is recorded in the release commit/run.

### Transitive production advisory overrides

- Applied compatible secure minimums for AJV 8.18.0, DOMPurify 3.4.14, fast-uri 3.1.5, lodash-es 4.18.1, Sharp 0.35.4, UUID 11.1.1, and ws 8.21.3.
- These paths originate in Fastify, Character Foundry, Milkdown, and comfy-ui-client. Overrides are centralized so stale transitive ranges cannot retain known-vulnerable releases.
- Validation: `pnpm audit --prod --audit-level=low` reports no known vulnerabilities; peer checks, dependency tests, and all deployment-mode builds pass.

## Completed release validation

- Runtime: Node 24.20.0 and pnpm 11.24.0.
- Tests: 30 import-core, 54 browser, and 103 API tests pass with the repository fixture suite enabled. Four API tests and the separate private Voxta fixture suite remain intentionally skipped when their external fixtures are unavailable.
- Builds: API plus full, light, and static browser builds pass. The PWA generates 228 precache entries.
- Docker: both clean images build; the Nginx and API health checks pass; a real ffmpeg conversion succeeds; 13 cards persist across a full Compose restart; Node 24 and ffmpeg are present in the non-root runtime image.
- Backup: the live Docker endpoint creates a valid staged ZIP with 13 cards that is accepted by both validation and preview. Shared browser/server manifest validation, strict merge tests, missing-asset rejection, failure injection, and settings/file round-trip tests cover the data-loss boundaries.
- Cloudflare: Wrangler 4 accepts the static bundle in production dry-run mode. The final live URL and workflow result are recorded after push.

## October 2026 production audit remediation (#37)

Updates are applied individually, with the full fixture-backed test suite run after each install. The CI audit policy remains unchanged.

### `fast-uri` 3.1.5 to 3.1.8

- Compatibility: Keep the supported v3 line required by the existing schema stack; upstream recommends 3.1.8 for its normalization fixes.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/fastify/fast-uri/releases/tag/v3.1.8

### `brace-expansion` 5.0.9 to 5.0.12

- Compatibility: Preserve older major versions used by other dependency paths. The v5 patches bound pathological parsing while retaining normal expansion behavior.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/juliangruber/brace-expansion/compare/v5.0.9...v5.0.12

### `dompurify` 3.4.14 to 3.4.16

- Compatibility: Patch release fixes IN_PLACE sanitization and declaration exports; application sanitizer options need no migration.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/cure53/DOMPurify/releases/tag/3.4.16

### `fastify` 5.12.1 to 5.12.5

- Compatibility: Stay on Fastify 5; security and request-validation fixes preserve the application route API.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/fastify/fastify/releases/tag/v5.12.5

### `@fastify/busboy` 3.2.0 to 3.2.2

- Compatibility: Compatible v3 security update for the existing multipart plugin; checks cover direct PNG uploads.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/fastify/busboy/releases/tag/v3.2.2

### `source-map-js` 1.2.1 to 1.2.2

- Compatibility: Patch fixes indexed-map resource exhaustion and CSP compatibility without changing the mapping API.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/7rulnik/source-map-js/compare/v1.2.1...v1.2.2

### `vue` 3.5.25 to 3.5.43

- Compatibility: Update Vue and its exact-version renderer/compiler dependencies together for Milkdown. The stable 3.5 line includes the SSR attribute-name fix.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/vuejs/core/blob/v3.5.43/CHANGELOG.md

### `prosemirror-view` 1.41.4 to 1.42.6

- Compatibility: Stable v1 update validates pasted attributes and retains the public editor API. Tagged changelog inspected from the published package.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://www.npmjs.com/package/prosemirror-view/v/1.42.6

### `sharp` 0.35.4 to 0.35.5

- Compatibility: patch updates native image libraries and bounds checks; Node 24 is supported. Existing thumbnail, PNG and import tests exercise the image path.
- Validation: full fixture-backed workspace tests passed after this update.
- Source: https://github.com/lovell/sharp/releases/tag/v0.35.5

### `katex` 0.16.27 to 0.19.0

- Compatibility: private function-definition API, internal CSS classes and strict callbacks changed across 0.17–0.19. Architect/Milkdown uses public rendering APIs, matching package CSS, and default strict behavior. The override updates all rendering and stylesheet consumers together.
- Validation: full fixture-backed workspace tests passed; separate inline/block, micromark, inherited-trust and malformed-math checks cover the actual rendering API.
- Source: https://github.com/KaTeX/KaTeX/blob/v0.19.0/CHANGELOG.md

### ONNX proxy helper: `global-agent` 3.0.0 to 4.1.3

- Compatibility: ONNX 1.21.0 uses only the CommonJS `bootstrap()` export in its installer. The scoped override removes `roarr` and the unpatched `sprintf-js` dependency while retaining the existing inference runtime.
- Patch: 4.1.3 tests `configuration.secureEndpoint`, which native Node HTTPS requests do not supply. Restore protocol detection through `this.protocol === 'https:'` so trusted CA, SNI and certificate verification options reach the TLS connection. This retains the secure certificate-verification default.
- Validation: full fixture-backed workspace tests; actual ONNX installer with CUDA download skipped; FastEmbed module import; local HTTPS CONNECT with a trusted CA and SNI; rejection of an untrusted certificate; and NO_PROXY bypass all pass. The proxy and math checks run in CI through `scripts/dependency-compatibility-smoke.mjs`.
- Sources: https://github.com/gajus/global-agent/blob/v4.1.3/src/classes/Agent.ts and https://github.com/microsoft/onnxruntime/blob/v1.21.0/js/node/script/install.js

### Final audit

`pnpm audit --prod --audit-level=low` reports no known vulnerabilities. No advisories were ignored, and the CI audit threshold is unchanged. The 25 findings recorded in issue #37 are resolved by the dependency updates and removal of the vulnerable formatting dependency.

### ProseMirror model alignment

`prosemirror-view` 1.42.6 selected model 1.25.12 while older Milkdown paths retained 1.25.4, producing incompatible `DOMOutputSpec` types. Pinning `prosemirror-model` 1.25.12 across all paths restores a single model instance without application casts or code changes. Its patch releases improve attribute validation and DOM parsing. The full test suite and type checks pass after alignment.

Source: the published `prosemirror-model@1.25.12` CHANGELOG, https://www.npmjs.com/package/prosemirror-model/v/1.25.12
