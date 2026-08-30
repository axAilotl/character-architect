# Character Architect Maintenance and Modernization Plan

**Created:** August 30, 2026<br>
**Status:** Implemented and validated locally; release deployment in progress<br>
**Repository:** `character-architect`<br>
**Primary targets:** Docker full deployment, Cloudflare static deployment, browser-local light deployment<br>
**Planning basis:** Repository audit, current GitHub issue review, local build/test results, deployment-mode inspection, and dependency/toolchain review

---

## Table of contents

1. [Executive decision](#1-executive-decision)
2. [Outcome](#2-outcome)
3. [Goals](#3-goals)
4. [Current repository state](#4-current-repository-state)
5. [Deployment contracts](#5-deployment-contracts)
6. [Architectural decisions](#6-architectural-decisions)
7. [Delivery graph](#7-delivery-graph)
8. [Milestone 0 — Preserve and record the baseline](#8-milestone-0--preserve-and-record-the-baseline)
9. [Milestone 1 — Repair Node, pnpm, and Docker](#9-milestone-1--repair-node-pnpm-and-docker)
10. [Milestone 2 — Define and validate the backup contract](#10-milestone-2--define-and-validate-the-backup-contract)
11. [Milestone 3 — Make restore lossless in every supported mode](#11-milestone-3--make-restore-lossless-in-every-supported-mode)
12. [Milestone 4 — Make quality gates truthful](#12-milestone-4--make-quality-gates-truthful)
13. [Milestone 5 — Update dependencies without churn](#13-milestone-5--update-dependencies-without-churn)
14. [Milestone 6 — Fix application-owned security defects](#14-milestone-6--fix-application-owned-security-defects)
15. [Milestone 7 — Validate and release](#15-milestone-7--validate-and-release)
16. [GitHub issue disposition](#16-github-issue-disposition)
17. [Test matrix](#17-test-matrix)
18. [Operational limits and configuration](#18-operational-limits-and-configuration)
19. [Observability and error behavior](#19-observability-and-error-behavior)
20. [Rollback strategy](#20-rollback-strategy)
21. [Documentation deliverables](#21-documentation-deliverables)
22. [Implementation sequence](#22-implementation-sequence)
23. [Definition of done by milestone](#23-definition-of-done-by-milestone)
24. [Review record](#24-review-record)
25. [Tracker conversion status](#25-tracker-conversion-status)
26. [First implementation handoff](#26-first-implementation-handoff)
27. [Grounding references](#27-grounding-references)

---

## 1. Executive decision

Character Architect does not need a rewrite or a speculative feature cycle.

It needs a bounded maintenance program that restores confidence in the two ways it is actually used:

1. a full local deployment in Docker, backed by Fastify, SQLite, and filesystem storage;
2. a static browser deployment on Cloudflare, backed by IndexedDB and local browser settings.

The maintenance work will be delivered in small, reversible batches.

The first implementation batch fixes the Docker toolchain and build context.

The second implementation batch makes replace-mode backup restoration lossless on both persistence paths.

The remaining batches repair quality gates, update dependencies in controlled groups, and address the few security defects found in the audit.

Character Foundry format packages are explicitly not being redesigned as part of this effort.

Those formats are stable.

The application should consume stable Character Foundry releases and exercise their existing behavior with real fixtures.

If a defect is proven to live inside a Character Foundry package, it will be fixed and released in that repository as a separate unit of work.

This prevents a routine application refresh from becoming an accidental format migration.

---

## 2. Outcome

The maintenance program is complete when all of the following are true:

- A populated developer checkout can run `docker compose build` without sending runtime databases, uploaded assets, generated output, or large internal documentation into the Docker build context.
- The Docker build uses the same supported Node and pnpm versions as CI and local development.
- Both Docker images build from a clean clone with a frozen lockfile.
- `docker compose up` starts a healthy API and a healthy web frontend on `127.0.0.1:8765`.
- Restarting the Docker stack preserves SQLite data and stored assets.
- Cloudflare's static build is produced explicitly with `VITE_DEPLOYMENT_MODE=static`.
- Static startup does not attempt any server API request.
- Static editing, import, export, settings, and browser-local backup/restore continue to work.
- Full-mode editing, import, export, server modules, and server backup/restore continue to work.
- Invalid or partially corrupt replace-mode backups leave all pre-existing user data untouched.
- Any injected failure during replace-mode restoration leaves all pre-existing user data untouched.
- Successful replace-mode restoration replaces the intended dataset exactly once.
- Large server backups are streamed or staged rather than assembled entirely in memory.
- Browser backups retain explicit limits appropriate for browser memory.
- CI fails when fixture-dependent tests are skipped because fixtures could not be located.
- CI runs type checking, scoped linting, API tests, web tests, static-build smoke tests, full-build smoke tests, and Docker builds.
- Production dependency vulnerabilities are either removed, upgraded, or documented with a narrow and justified exception.
- No Character Foundry format behavior changes without a corresponding package test and package release.
- GitHub issues are updated only after their behavior is independently verified.

---

## 3. Goals

### 3.1 Primary goals

- Restore a reliable Docker build for personal full-mode use.
- Move the project to a supported LTS Node runtime.
- Pin one package manager version across developers, CI, and Docker.
- Prevent replace-mode backup restoration from deleting good data before bad input is discovered.
- Preserve static/browser operation while server behavior is repaired.
- Make CI results truthful.
- Update dependencies without mixing unrelated framework migrations into one change.
- Resolve application-owned security defects found during the audit.
- Keep the result easy to deploy and easy to roll back.

### 3.2 Secondary goals

- Reduce Docker build context size and accidental data exposure.
- Give backup validation one shared behavioral contract.
- Make deployment-mode assumptions directly testable.
- Replace shell command construction with argument-based process execution.
- Make web-import network validation survive redirects and DNS resolution.
- Clarify the boundary between this application and Character Foundry packages.
- Leave the repository with a short, actionable issue queue rather than a broad backlog.

### 3.3 Non-goals

- Rewriting the UI.
- Replacing React, Vite, Fastify, SQLite, IndexedDB, Nginx, or Cloudflare.
- Adding new character-card formats without a separate product need.
- Redesigning CCv2, CCv3, CHARX, Voxta, or lorebook schemas.
- Implementing GitHub issue #34, the SillyTavern push request, in this maintenance cycle.
- Implementing GitHub issue #33's manual UI-framework workaround in this maintenance cycle.
- Implementing GitHub issue #24's wishlist feature in this maintenance cycle.
- Publishing Docker images to a registry unless requested later.
- Exposing the local Docker service to the LAN by default.
- Adding authentication to localhost-only Docker in the first batch.
- Requiring full-server backup import into a browser-only deployment in the first safety fix. The implementation ultimately supports this conversion because the existing formats could be mapped without changing Character Foundry behavior.
- Designing an encrypted backup container in the first safety fix; generated backups must instead be treated and labeled as sensitive files.
- Doing work only to make dependency dashboards show zero available upgrades.

---

## 4. Current repository state

### 4.1 Working-tree constraints

The implementation must begin by preserving the current working tree.

At planning time the repository is on `main`, one commit ahead of `origin/main`.

The working tree already contains user-owned changes:

- deleted `.beads/issues.jsonl`;
- untracked `apps/web/src/features/editor/components/BulkAssetUpload.tsx`;
- untracked `dev-full.sh`.

These files are not part of this maintenance plan unless the user explicitly adds them later.

No implementation task may delete, overwrite, stage, or silently incorporate them.

The sibling Character Foundry repository also has an existing dirty working tree.

Any future Character Foundry change must preserve that state and use a separate branch or worktree chosen deliberately for that repository.

### 4.2 Verified baseline

The following observations were verified during the audit:

- The ordinary monorepo build succeeds on local Node `22.22.2`.
- The ordinary test invocation reports 118 passing tests and 70 skipped tests.
- With `CF_FIXTURES_DIR` pointed at the expected repository fixture directory, 23 tests fail because required synthetic fixtures are missing.
- Root type checking fails because API tests import shared testkit code outside the API TypeScript `rootDir`.
- Root linting reports approximately 740 findings, much of it caused by lint scope/configuration and generated output.
- A normal Docker build attempted to transfer more than 16 GB of context.
- A clean source-only Docker context was approximately 3.51 MB.
- The clean Docker build then failed because Node 20 and an unpinned `pnpm@latest` resolved to incompatible runtime requirements, including `node:sqlite` use.
- Runtime state exists below `apps/api/data` and `apps/api/storage`, while the current `.dockerignore` only protects root-level `data/` and `storage/`.
- `apps/api/data` is large enough that build-context leakage is operationally significant.
- The Docker service binds to `127.0.0.1:8765` by default.
- Docker does not currently install `ffmpeg`, so video conversion is unavailable there even though the UI describes it as conditional.
- Cloudflare deployment is a static-assets Worker, not a Node server deployment.
- The static build is selected with `VITE_DEPLOYMENT_MODE=static`.
- Light and static modes use `LocalPersistenceAdapter`.
- Full mode uses `ServerPersistenceAdapter`.
- Browser backup/restore is implemented in `apps/web/src/lib/backup.ts` and `apps/web/src/lib/db.ts`.
- Server backup/restore is implemented in `apps/api/src/services/backup.service.ts` and `apps/api/src/routes/backup.ts`.
- Both restore paths currently unzip whole archives synchronously.
- Both replace paths clear existing records before all replacement records have been accepted.
- The API validation endpoint does not provide a strong guarantee that the restore endpoint uses the same validation.
- API backup creation reads and compresses the whole archive into memory.
- The API restore route reads the entire upload into memory with `toBuffer()`.
- Character Foundry already exposes ZIP-size preflight logic used by other import paths.
- The Charx optimizer accepts settings that reach an interpolated shell command.
- SSRF validation checks the initial URL but not every redirect target.
- The public userscript uses permissive `postMessage` behavior.
- The current GitHub Actions fixture path is relative to the wrong working directory for filtered package commands.
- The Docker job depends on the deploy job and therefore does not run on pull requests when deployment is skipped.
- Several full-mode settings, preset, and theme routes resolve mutable files below the compiled application directory rather than the configured Docker data/storage mounts.
- `apps/api/data/settings.json` and preset JSON files are tracked even though that directory also contains a runtime database; the settings file contains machine-specific local configuration.

### 4.3 Toolchain decision

Use Node 24 LTS for the refreshed baseline.

Node 24 is preferred over Node 22 because this plan is being made in August 2026 and Node 24 provides the longer remaining LTS runway.

Use pnpm 11.24.0 for the refreshed baseline.

Pin it exactly through Corepack and the root `packageManager` field.

Do not adopt pnpm 12 in the first maintenance batch.

pnpm 12 was only just released at planning time, while the repository already needs unrelated Docker and build-system repairs.

Separating that migration removes unnecessary uncertainty.

The root `engines.node` value should become `>=24.0.0`.

CI should test Node 24 as the supported version.

Local documentation should call Node 24 the supported baseline.

This does not make the Cloudflare static application execute on Node 24.

Node is used to install dependencies and run the Vite/Wrangler build; Cloudflare serves the resulting static assets using its own Workers runtime.

### 4.4 Package-manager decision

The repository contains a pnpm lockfile and pnpm workspace definition.

pnpm is therefore the canonical package manager.

Root scripts that recursively invoke npm should be converted to pnpm workspace commands.

The goal is not cosmetic consistency.

Using one package manager avoids two different workspace-resolution models and ensures that local scripts exercise the same lockfile as CI and Docker.

The non-registry settings in `.npmrc` should move to `pnpm-workspace.yaml` before pnpm 11 is pinned.

`ignore-scripts=false` is the default and should be removed rather than carried forward.

Native build permissions must remain explicit for at least:

- `better-sqlite3`;
- `esbuild`;
- `sharp`.

A clean install will reveal whether additional packages require permission.

Do not broaden permission to every dependency merely to make installation pass.

### 4.5 Character Foundry boundary

Character Architect owns application behavior, deployment behavior, persistence behavior, and application-level integration tests.

Character Foundry owns shared format parsing, normalization, serialization, schema behavior, and cross-application format primitives.

The first maintenance batches must not edit the sibling Character Foundry repository.

Character Architect may update its consumer dependency versions after the relevant published versions and release notes are verified.

If a failing fixture proves an application mapping defect, fix it here.

If it proves a package format defect, create a separate Character Foundry change, test it there, publish a release, and then update this application.

The existing AlternativeFirstMessages behavior for GitHub issue #8 should be re-tested before any code is changed.

The existing shared asset-mapping request in issue #9 remains a Character Foundry concern and is not a Docker blocker.

---

## 5. Deployment contracts

### 5.1 Mode matrix

| Contract | Full | Light | Static |
|---|---:|---:|---:|
| Build artifact | Nginx web + Fastify API | Vite web, optional minimal host | Vite web served by Cloudflare assets |
| Persistence | SQLite + filesystem | IndexedDB + localStorage | IndexedDB + localStorage |
| Backup implementation | Server service | Browser library | Browser library |
| Web import | Server-backed | Disabled | Disabled |
| Server RAG | Enabled | Disabled | Disabled |
| Server LLM proxy | Enabled | Disabled | Disabled |
| ComfyUI server integration | Enabled | Disabled | Disabled |
| Server image optimization | Enabled | Disabled | Disabled |
| Client image processing | Available | Required fallback | Required fallback |
| Server-only modules visible | Yes | No | No |
| Expected API requests at startup | Yes | No | No |
| Docker required | Yes | No | No |

### 5.2 Full-mode contract

Full mode must run with the Nginx frontend and Fastify API from `docker compose`.

Nginx proxies `/api` and storage requests to the API service.

The API must be healthy before full-mode smoke tests begin.

SQLite state must live below the bind-mounted `/app/data` path.

Uploaded and generated assets must live below the bind-mounted `/app/storage` path.

Container replacement must not replace those host directories.

The default host binding remains localhost-only.

If LAN access is added later, authentication and origin configuration must be considered together.

### 5.3 Static-mode contract

Static mode must build with `VITE_DEPLOYMENT_MODE=static`.

It must not infer full mode from a private hostname during production deployment.

It must not require the API bundle, native modules, SQLite, Sharp, FastEmbed, or server-only Character Foundry code at runtime.

It must load as a single-page application through Cloudflare's static-assets fallback.

Browser-local data must survive application reload and an ordinary static redeploy.

The service worker must update without trapping users permanently on stale application chunks.

### 5.4 Light-mode contract

Light mode shares browser persistence and browser backup semantics with static mode.

It remains a supported build contract even if it is not the immediate deployment target.

Tests may share most static-mode coverage, but at least one explicit light-mode build must ensure its configuration does not drift.

### 5.5 Backup compatibility contract

The first safety release must support these directions:

| Backup source | Restore target | Requirement |
|---|---|---|
| Full current version | Full current version | Required |
| Full legacy version 1.0 | Full current version | Required when valid |
| Light/static current version | Light/static current version | Required |
| Light/static legacy version 1.0 | Light/static current version | Required when valid |
| Light/static current version | Full current version | Preserve existing support and test it |
| Full current version | Light/static current version | Supported through deterministic embedded-asset conversion |

Full-to-browser restoration is supported because server archives already embed every referenced asset. The browser converter normalizes server versions, card images, and card-asset links before the single IndexedDB transaction begins.

Server-only capabilities do not become available in a static deployment, but the portable character data remains usable there.

### 5.6 Backup content contract

A backup advertised as full must include all non-reproducible user-owned state for its source mode.

Full-mode backups include:

- cards and original card images;
- versions;
- asset metadata, card-asset relationships, and physical asset files;
- user-created LLM presets;
- mutable application/module settings, including the intended `app_settings` rows;
- user-modified templates, snippets, wizard prompts, and other mutable preset state;
- user-uploaded theme images;
- enough manifest metadata to restore those categories deterministically.

Browser-mode backups include:

- cards;
- browser-stored images;
- versions;
- browser-stored assets;
- the allowlisted localStorage settings already owned by the application.

Backups exclude reproducible or disposable state:

- built-in defaults that are shipped by the application and have not been customized;
- downloaded embedding models;
- regenerable RAG indexes unless a later explicit option includes them;
- caches;
- logs;
- temporary files;
- Docker images and build output.

The manifest must identify included optional categories.

Replace mode replaces every included mutable category according to its source/target compatibility contract.

Merge mode applies documented category-specific conflict rules.

Backups can contain provider keys, session material, private card text, and images.

The creation and restore UI must label the archive as sensitive and recommend storing it like any other private credential-bearing file.

---

## 6. Architectural decisions

### 6.1 Shared validation, separate persistence

Create a browser-safe workspace package named `@card-architect/backup-core` under `packages/backup-core`.

It owns:

- backup manifest types;
- manifest schema validation;
- archive entry naming rules;
- JSON payload schemas;
- count and relationship checks;
- duplicate identifier checks;
- archive path safety rules;
- source-mode detection;
- normalized validation errors;
- a normalized preview result;
- a normalized restore-result type.

It does not own:

- Fastify routes;
- SQLite queries;
- filesystem mutation;
- IndexedDB mutation;
- localStorage mutation;
- React UI;
- Node streams;
- Node filesystem APIs.

This seam gives the two runtime paths the same definition of a valid backup without leaking Node-only code into the static bundle.

The package must avoid `sharp`, `better-sqlite3`, `node:*` modules, and any Character Foundry aggregate import that transitively pulls native code into the browser.

### 6.2 Two-phase restoration

Every restore follows two phases:

1. inspect, bound, parse, normalize, and validate without mutating live state;
2. commit the already validated restore through the target persistence adapter.

No code path may clear live state during phase one.

No validation endpoint may implement weaker rules than the restore endpoint.

The restore endpoint should call the same inspection function as validation and then pass the returned validated object to the commit function.

This makes validation meaningful and removes time-of-check/time-of-use divergence inside the application.

### 6.3 Atomic browser replacement

Add a `replaceAll()` operation to `LocalDB`.

`replaceAll()` opens one read-write IndexedDB transaction covering:

- cards;
- images;
- versions;
- assets;
- drafts.

It clears those stores and inserts the fully validated replacement records inside that single transaction.

Any failure aborts the transaction.

The existing sequence of `clearAll()` followed by `importAll()` must no longer be used for replace mode.

Merge mode may keep records but should still perform its planned writes in one transaction after conflicts are computed.

Browser settings stored in localStorage cannot participate in the IndexedDB transaction.

Before applying restored settings, capture the relevant current keys.

If settings application fails, restore those keys and return a settings-specific warning without pretending the database transaction failed.

Card data integrity takes priority over non-transactional UI settings.

### 6.4 Atomic server replacement

Server restoration stages all filesystem content before the database changes.

Every staged path must be created on the same filesystem as its corresponding live path so each rename remains atomic.

Because the SQLite database itself lives below the data root, do not swap the entire data root.

Stage and swap only the mutable settings files/subdirectories beside the live database, while SQLite rows remain protected by the database transaction.

The commit sequence is:

1. acquire a restore mutex;
2. confirm the validated restore is still the object being committed;
3. prepare and fully verify a complete filesystem swap set for storage, theme files, and mutable settings/preset files included by the backup;
4. enter one `better-sqlite3` transaction callback;
5. retain every corresponding existing live path as a rollback path;
6. move every staged path into its live location;
7. run a bounded final filesystem check while the database transaction can still abort;
8. execute all destructive deletes and inserts;
9. return from and commit the database transaction only after the final check and inserts succeed;
10. remove the rollback paths only after successful commit;
11. release the mutex.

If any database operation throws, the database transaction rolls back.

The outer error handler must then move failed new paths aside and restore every previous live path already swapped.

If filesystem rollback itself fails, retain all old and new paths, log their exact paths, stop further restores, and return a recovery-specific error.

Do not silently clean a rollback directory that may contain the only good copy of user assets.

### 6.5 Staged and streamed server archives

The server route must not call `toBuffer()` for arbitrarily large restore uploads.

Stream the multipart upload to a uniquely named temporary file while enforcing the compressed-byte limit.

Then inspect the staged archive with bounded streaming decompression.

The existing `fflate` dependency supports streaming ZIP compression and decompression, so use its `Zip`/`AsyncZipDeflate` and `Unzip`/`AsyncUnzipInflate` APIs unless implementation testing proves a concrete missing capability.

Do not add a second ZIP library preemptively.

The server backup response should be a Node readable stream fed by the streaming compressor.

Asset files should be read one at a time or streamed through the compressor.

JSON metadata may be serialized per logical file, but the entire archive must not be collected into one output buffer.

### 6.6 Bounded browser archives

The browser path may continue to use buffer-oriented ZIP APIs because a browser download ultimately creates a Blob and IndexedDB data is already materialized for export.

It must nevertheless enforce:

- maximum compressed archive bytes;
- maximum total declared uncompressed bytes;
- maximum individual entry bytes;
- maximum entry count;
- maximum JSON file bytes;
- maximum decoded image/asset bytes where applicable.

The limits should be constants exported by browser backup code and displayed in validation errors.

They should be conservative enough to avoid tab crashes and generous enough for ordinary personal libraries.

Do not reuse the server's larger limits merely for consistency.

### 6.7 Archive path and relationship safety

Before any entry is written or extracted, reject:

- absolute paths;
- Windows drive paths;
- `..` traversal segments;
- NUL bytes;
- empty normalized names;
- duplicate normalized names;
- unexpected symlink-like metadata if exposed by the ZIP API;
- entries outside the documented backup layout.

Manifest counts must match parsed payload counts.

Every version must refer to an existing card or be rejected according to the documented legacy rule.

Every card-asset relation must refer to an existing card and asset.

Every referenced filesystem entry must exist exactly once.

Every staged asset path must remain below the staging root after resolution.

Validation errors must identify the logical file and record index without logging private card contents.

### 6.8 Backup format evolution

Keep the existing backup format version accepted by the application.

New backups may add an optional source-mode discriminator and generator metadata without invalidating legacy version 1.0 backups.

Suggested additive manifest fields are:

```json
{
  "formatVersion": "1.0",
  "sourceMode": "full",
  "generator": {
    "name": "character-architect",
    "version": "0.1.0"
  }
}
```

If the current manifest uses a different version key, retain its existing name rather than introducing a duplicate.

Legacy source-mode detection must be deterministic and tested.

Do not bump the major backup version merely to add metadata.

### 6.9 Deployment-mode injection

Tests should not depend on `window.location.hostname` to choose a mode.

Refactor configuration just enough that a deployment mode can be passed to a pure `createDeploymentConfig(mode)` function.

Production `getDeploymentConfig()` may continue reading `import.meta.env` and falling back to hostname inference for local development.

This enables direct unit tests for every mode without mocking global browser state repeatedly.

### 6.10 Process execution

Replace interpolated `exec()` calls for ffmpeg with `execFile()` or `spawn()` and a fixed argument array.

Validate optimizer settings with Zod at the HTTP boundary.

Enforce integer ranges there and again at the utility boundary.

Do not rely on TypeScript types to validate JSON received from the network.

This fix is full-mode-only at runtime, but its UI and shared settings types still need static builds to compile.

### 6.11 Network import safety

Safe web import must validate every request target, including redirects.

Resolve the hostname and reject any private, loopback, link-local, multicast, unspecified, or metadata-address result.

Disable automatic redirects and follow a small fixed number manually.

Validate each `Location` target before the next request.

Apply a response-size limit and timeout while streaming the response.

This work remains full-mode-only because web import is disabled in light and static modes.

### 6.12 Cloudflare compatibility policy

Upgrade the Wrangler dependency in its own dependency batch.

Do not change `compatibility_date` merely because the calendar advanced.

The current deployment serves static assets and does not need Node compatibility flags.

If the compatibility date is changed, deploy to the dev Worker first and test both a fresh browser profile and an existing PWA installation before production.

---

## 7. Delivery graph

### 7.1 Milestone graph

```text
M0 Baseline preservation
 |
 +--> M1 Node/pnpm/Docker repair ------------------+
 |                                                |
 +--> M2 Backup contract and fixtures ------------+--> M3 Lossless restore
 |                                                |        |
 +--> M4 Truthful quality gates ------------------+        +--> M7 Release validation
 |                                                         |
 +--> M5 Controlled dependencies --------------------------+
 |                                                         |
 +--> M6 Application security fixes -----------------------+
```

### 7.2 Critical path

The shortest path to a useful local result is:

```text
M0 -> T1.1 -> T1.2 -> T1.8 -> T1.3 -> T1.4 -> T1.5 -> Docker usable
```

The shortest path to a data-safe release is:

```text
M0 -> T2.1 -> T2.2 -> T2.3 -> T3.1/T3.2 -> T3.3 -> T7.1
```

Dependency updates that alter persistence libraries, Fastify, Vite, or React must wait until the relevant backup and mode tests exist.

Security fixes that are independent of backup work may be implemented after the Node/Docker baseline but should land in separate commits.

### 7.3 Commit policy

Each task below is intended to produce one focused commit unless the task explicitly names multiple commits.

Do not mix generated lockfile changes with unrelated source refactors.

Every dependency commit must state the exact package group updated and the tests run.

Every restore commit must include a regression test that fails against the pre-fix behavior.

Every Docker commit must include either a clean build result or a narrowly documented reason it cannot run in the current environment.

---

## 8. Milestone 0 — Preserve and record the baseline

### T0.1 — Record the implementation baseline

**Purpose:** Ensure every later regression comparison starts from a known repository and tool state.

**Blocked by:** Nothing.<br>
**Unblocks:** Every implementation task.<br>
**Risk:** Low.<br>
**Primary files:** No source changes required; implementation notes or PR description.

#### Work

1. Run `git status --short --branch`.
2. Record `git rev-parse HEAD`.
3. Record Node, Corepack, pnpm, Docker, Docker Compose, and operating-system versions.
4. Record the existing dirty paths without staging them.
5. Confirm `.beads/issues.jsonl`, `BulkAssetUpload.tsx`, and `dev-full.sh` retain their starting status.
6. Record the current GitHub issue list and issue states.
7. Record the current published Character Foundry dependency versions from the configured registry.
8. Record which package registry credentials are required for a clean install without printing any secret.

#### Why

The repository is already ahead of its remote and contains user-owned untracked/deleted files.

A baseline record prevents later maintenance work from claiming or erasing unrelated state.

#### Acceptance

- The implementation log identifies the starting commit.
- Existing dirty files are unchanged.
- No credential value appears in output or documentation.
- Every later commit can be compared to the recorded starting point.

#### Rollback

No rollback is needed because this task is read-only.

### T0.2 — Establish generated-artifact and runtime-data boundaries

**Purpose:** Distinguish source inputs from runtime state before Docker and lint rules are changed.

**Blocked by:** T0.1.<br>
**Unblocks:** T1.3, T1.8, T4.3.<br>
**Risk:** Low.<br>
**Primary files:** `.gitignore`, `.dockerignore`, ESLint configuration, documentation only if changes are necessary.

#### Work

1. List tracked directories named `data`, `storage`, `dist`, `build`, `coverage`, and `fixtures`.
2. List untracked directories with those names.
3. Confirm `packages/defaults/assets` is source input and must remain in Docker builds.
4. Confirm `e2e/fixtures` is test input but not production Docker input.
5. Confirm `test-fixtures` is test input but not production Docker input.
6. Confirm the database and user-owned files below `apps/api/data` are runtime state.
7. Inventory the tracked `apps/api/data/settings.json` and `apps/api/data/settings/presets/*.json` files before ignoring the directory because this path currently mixes mutable user state with source-like default seeds.
8. Confirm `apps/api/storage` is runtime state and must be ignored.
9. Confirm root `data` and `storage` are Docker Compose bind-mount targets and must be ignored.
10. Identify generated application `dist` directories and generated Playwright/Vitest output.
11. Update boundaries narrowly; do not ignore or remove a tracked seed until T1.8 gives it a durable source location and migration path.

#### Why

An overbroad ignore pattern can make the build fast by silently omitting required source data.

An underbroad pattern can leak private runtime data and make builds unusable.

This explicit inventory supports a safe `.dockerignore` change.

#### Acceptance

- Every ignored runtime path is named and justified.
- `packages/defaults/assets` remains in the build context.
- Every tracked preset seed currently under `apps/api/data` is either retained deliberately or moved to a source-owned defaults package before the runtime directory is ignored.
- The current local `apps/api/data/settings.json` is preserved outside any path removed from version control before cleanup.
- Production builds do not require any ignored test fixture.
- The boundaries work from both a clean clone and a populated checkout.

---

## 9. Milestone 1 — Repair Node, pnpm, and Docker

### T1.1 — Pin Node 24 and pnpm 11.24.0

**Purpose:** Give local development, CI, and Docker one supported toolchain.

**Blocked by:** T0.1.<br>
**Unblocks:** T1.2, T1.4, T4.1, T5.1.<br>
**Risk:** Medium because native packages must rebuild.<br>
**Primary files:** `package.json`, lockfile metadata if changed, version-manager files if present, setup documentation.

#### Work

1. Add `"packageManager": "pnpm@11.24.0"` to the root package manifest.
2. Change the Node engine to `>=24.0.0`.
3. Remove or replace the npm engine because npm is not the supported workspace package manager.
4. Add or update `.nvmrc`, `.node-version`, or the repository's existing version hint to Node 24; do not add multiple redundant managers without need.
5. Update `@types/node` to the Node 24 line in root and API manifests.
6. Enable Corepack and activate exactly pnpm 11.24.0 in Docker.
7. Configure GitHub Actions to use Node 24 and pnpm 11.24.0.
8. Update developer setup scripts that check for Node 20.
9. Run a clean frozen install on Node 24.
10. Rebuild `better-sqlite3`, Sharp, and other native dependencies from that clean install.

#### Why

The current Docker failure is caused by an unsupported combination: Node 20 plus an unpinned latest pnpm.

Pinning both sides removes time-dependent resolution and aligns all environments.

Node 24 gives a longer LTS maintenance window than Node 22.

#### Acceptance

- `node --version` reports a Node 24 release in the supported workflow.
- `pnpm --version` reports exactly `11.24.0`.
- `corepack pnpm install --frozen-lockfile` succeeds in a clean checkout.
- Native module smoke imports succeed.
- Package scripts do not require npm workspace behavior.
- The lockfile is stable on a second frozen install.

#### Failure handling

If a native dependency does not support Node 24, identify that exact dependency and first attempt its latest compatible non-major or documented compatible version.

Do not fall back to Node 20.

If Node 24 support requires a high-risk framework major, isolate that dependency update and add its tests before proceeding.

### T1.2 — Normalize pnpm workspace configuration and scripts

**Purpose:** Make package resolution and recursive scripts deterministic.

**Blocked by:** T1.1.<br>
**Unblocks:** T1.4, T1.8, T4.1, T4.2.<br>
**Risk:** Medium.<br>
**Primary files:** `pnpm-workspace.yaml`, `.npmrc`, `package.json`, workspace manifests.

#### Work

1. Move `shamefullyHoist` from `.npmrc` into `pnpm-workspace.yaml` using pnpm 11 syntax.
2. Preserve explicit build permissions for known native modules using pnpm 11's supported build-policy setting.
3. Remove `ignore-scripts=false` because it is the default.
4. Keep `.npmrc` only for registry and authentication configuration if needed.
5. Convert root scripts from nested `npm run --workspace` commands to pnpm filters or `pnpm --recursive` commands.
6. Preserve the existing build order: shared packages before applications.
7. Preserve optional behavior for the plugins package where currently intended.
8. Replace the destructive shell-only `clean` implementation only if cross-platform cleanup is an actual supported requirement; otherwise document its platform assumption.
9. Run every root script used by CI or Docker.
10. Confirm package-local scripts still work when invoked directly.

#### Why

pnpm 11 no longer treats arbitrary non-registry `.npmrc` settings as the canonical workspace configuration.

Keeping configuration in its supported location avoids a build that works only because an old pnpm happened to read legacy settings.

Removing nested npm calls ensures every workspace operation uses the pnpm lockfile model.

#### Acceptance

- Root `build`, `build:packages`, `build:api`, `build:web`, `test`, and `type-check` scripts invoke pnpm consistently.
- A frozen install performs only the explicitly allowed native build scripts.
- Docker and CI no longer need a separate hidden package-manager behavior.
- `.npmrc` contains no obsolete non-registry settings.

### T1.3 — Make the Docker build context source-only

**Purpose:** Stop runtime data and generated artifacts from entering Docker builds.

**Blocked by:** T0.2, T1.8.<br>
**Unblocks:** T1.4, T1.5.<br>
**Risk:** Medium because an incorrect ignore can omit build inputs.<br>
**Primary files:** `.dockerignore`.

#### Required ignores

Add patterns that cover at least:

- all workspace `node_modules` directories;
- all workspace `dist` and `build` output directories;
- root and nested runtime `data` directories, with a verified exception if any tracked source data exists;
- root and nested runtime `storage` directories;
- coverage output;
- Playwright reports;
- test-results output;
- local environment files;
- SQLite databases and sidecar files;
- `.git`;
- `.beads` runtime state;
- large internal audit/research artifacts not used by the build;
- temporary editor and operating-system files.

Do not exclude:

- root package manifests;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `tsconfig.json`;
- application source;
- workspace package source;
- `packages/defaults/assets`;
- `docker/entrypoint.sh`;
- `docker/nginx.conf`.

#### Work

1. Update `.dockerignore` with comments for non-obvious nested runtime paths.
2. Build from the populated checkout.
3. Build from a clean Git archive or clean worktree.
4. Compare the set of copied sources.
5. Verify no database filename, card content, or stored asset from the populated checkout appears in the BuildKit context or image layers.
6. Verify the context remains small enough to transfer promptly.

#### Why

The current build attempted to transfer more than 16 GB even though the source-only context is only a few megabytes.

This is both a performance failure and a potential private-data disclosure into local image layers or remote builders.

#### Acceptance

- A populated checkout transfers no runtime database or uploaded storage.
- The context is within a documented threshold selected from the measured source tree; use 50 MB as an initial guard unless tracked source growth justifies another value.
- `packages/defaults/assets` is present in the builder.
- Both Docker targets still build.
- The ignore rules are covered by a small script or CI assertion if a stable assertion can be made without Docker-in-Docker complexity.

### T1.4 — Repair and harden the multi-stage Dockerfile

**Purpose:** Produce working full-mode API and web images with the pinned toolchain.

**Blocked by:** T1.1, T1.2, T1.3.<br>
**Unblocks:** T1.5, T1.6, T7.1.<br>
**Risk:** High because it affects the primary full deployment.<br>
**Primary files:** `Dockerfile`, `docker/entrypoint.sh`, possibly package manifests.

#### Work

1. Change the Node base to `node:24-bookworm-slim` for explicit distro stability.
2. Enable Corepack and activate pnpm 11.24.0 exactly.
3. Keep native build tooling confined to the builder stage.
4. Copy workspace manifests before source to preserve install caching.
5. Include the new `packages/backup-core/package.json` copy once that package exists; until then keep the manifest list synchronized with actual workspaces.
6. Run `pnpm install --frozen-lockfile`.
7. Build shared packages before API and web applications.
8. Build the web target explicitly in full mode for Docker rather than relying on hostname inference.
9. Confirm compiled native modules match the final image's libc and architecture.
10. Keep `gosu` or an equivalent minimal privilege-drop mechanism only if the entrypoint demonstrably uses it.
11. Ensure the API process runs as the configured non-root UID after bind-mounted directory ownership is prepared.
12. Ensure PID 1 receives termination signals correctly.
13. Add OCI labels only if useful; do not block the repair on image metadata.
14. Leave Nginx on its current line unless a vulnerability or build incompatibility requires an explicit update.
15. Do not add ffmpeg silently; decide its product behavior in T1.7.

#### Why

Pinning the Debian variant prevents an unannounced base-distribution change behind a floating `slim` alias.

Building web explicitly in full mode makes the Docker artifact deterministic and prevents mode selection from depending on runtime hostname.

Keeping build tools out of the final API image reduces size and attack surface.

#### Acceptance

- `docker build --target api .` succeeds from a clean source tree.
- `docker build --target web .` succeeds from a clean source tree.
- The API image imports `better-sqlite3`, Sharp, and FastEmbed successfully or clearly lazy-loads optional FastEmbed behavior.
- The API starts as non-root after entrypoint initialization.
- The web image serves the SPA and proxies expected full-mode routes under Compose.
- Image build logs identify Node 24 and pnpm 11.24.0.
- No runtime database or storage content exists in either image.

#### Rollback

The prior images remain usable by image ID or old tag.

No Compose data directory is modified by building new images.

### T1.5 — Add a repeatable Docker Compose smoke test

**Purpose:** Prove the images work together and preserve data.

**Blocked by:** T1.4.<br>
**Unblocks:** T1.6, T7.1.<br>
**Risk:** Medium.<br>
**Primary files:** `docker-compose.yml`, `scripts/` or `e2e/`, CI workflow.

#### Work

1. Start Compose with unique temporary host directories for data and storage.
2. Wait for both declared health checks.
3. Request the web root through `127.0.0.1:8765`.
4. Request the API health endpoint through the Nginx proxy if that route is intentionally exposed.
5. Create or import a minimal character through the public API or UI.
6. Store one asset.
7. Record the character and asset identifiers.
8. Stop and recreate the containers without deleting the host directories.
9. Confirm the character and asset remain available.
10. Change one mutable template/preset or module setting through the public API.
11. Upload one theme background if that feature is part of the full-mode contract.
12. Recreate the containers and confirm those settings/theme assets remain available from bind-mounted roots.
13. Confirm the API cannot be reached on a public host port by default.
14. Tear down containers and the task-specific temporary directories.

#### Why

An image build only proves compilation.

The user needs the assembled local product, including proxying, health checks, mounts, and restart persistence.

#### Acceptance

- Both services become healthy within a documented timeout.
- The browser root returns 200 and expected application HTML.
- API health returns 200 through the intended route.
- Data and one asset survive container recreation.
- Mutable settings, presets, and theme assets resolve below configured bind-mounted roots and survive container recreation.
- Default network exposure remains localhost-only.
- The test uses only its own explicit temporary directories.

### T1.6 — Make Docker CI independent of deployment

**Purpose:** Ensure pull requests test Docker even when Cloudflare deployment is skipped.

**Blocked by:** T1.4, T1.5, T4.4.<br>
**Unblocks:** T7.1.<br>
**Risk:** Low.<br>
**Primary files:** `.github/workflows/ci.yml`.

#### Work

1. Remove `docker-build`'s dependency on `deploy-cloudflare`.
2. Make it depend on the quality job or on the minimum build prerequisite job.
3. Run Docker builds on pull requests and pushes that affect Docker/runtime source.
4. Keep deployment restricted to pushes and environments.
5. Update Docker actions to current supported major versions only after checking their migration notes.
6. Cache API and web targets without allowing one target's cache export to clobber the other.
7. Run the Compose smoke test when runner resources permit.
8. If the full persistence smoke test is too expensive for every pull request, run it on main/dev pushes and retain target builds on pull requests.

#### Why

The current dependency makes the Docker job skip exactly where it is most useful: pull-request validation.

Build validation and deployment are separate concerns.

#### Acceptance

- A pull request runs both Docker target builds.
- A failed Docker target blocks merge according to branch policy.
- A skipped deploy job does not skip Docker.
- Production deployment still requires the complete quality gate.

### T1.7 — Decide and document ffmpeg behavior in Docker

**Purpose:** Make the optimizer UI truthful in full Docker mode.

**Blocked by:** T1.4, T6.1.<br>
**Unblocks:** T7.1.<br>
**Risk:** Medium because ffmpeg materially increases image size.<br>
**Primary files:** `Dockerfile`, optimizer capability endpoint/settings UI, deployment docs.

#### Decision

For the personal full-spec Docker deployment requested for this release, install Debian's distribution `ffmpeg` package in the default API image. Keep capability detection so native and custom deployments still report the truth when ffmpeg is absent.

#### Work

1. Make the server report whether ffmpeg is available.
2. Disable or annotate WebM conversion controls when unavailable.
3. Keep non-video image optimization functional through Sharp.
4. Install ffmpeg from the pinned Debian base distribution rather than downloading an unverified binary.
5. Test both capability states.

#### Why

The current UI implies a feature that the default image cannot perform.

The image-size tradeoff is accepted in favor of a full-spec personal container.

#### Acceptance

- The UI never promises video conversion when the server reports no ffmpeg.
- The default Docker image behavior is documented.
- Its smoke test verifies ffmpeg availability and conversion without invoking a shell.

### T1.8 — Normalize mutable data roots and default seeding

**Purpose:** Make every full-mode mutable file persist in Docker and stop mixing user state with tracked source defaults.

**Blocked by:** T0.2, T1.2.<br>
**Unblocks:** T1.3, T1.5, T3.3, T7.1.<br>
**Risk:** High because the current tracked settings file contains local user configuration.<br>
**Primary files:** `apps/api/src/config.ts`, settings/template/wwwyzzerdd/SillyTavern routes, defaults package assets/exports, `.gitignore`, `.dockerignore`, Compose, migration tests.

#### Verified defect

Several API routes currently resolve mutable files relative to compiled route code:

- `../../data/settings.json`;
- `../../data/settings/presets`;
- `../../themes/images`.

In the final API image those resolve below `/app/apps/api`, while Compose mounts durable state at `/app/data` and `/app/storage`.

The final image also does not copy `apps/api/data`.

Therefore a successful image build does not prove those settings, presets, and theme images exist or survive container recreation.

The source tree additionally tracks `apps/api/data/settings.json` and several preset JSON files, so that directory currently mixes user state and source seeds.

#### Target layout

Use configured roots rather than `__dirname` for mutable files:

```text
DATA_PATH or dirname(DATABASE_PATH)
├── cards.db
└── settings/
    ├── modules.json (or the existing compatible settings filename)
    └── presets/
        └── user-modified preset files

STORAGE_PATH
├── card assets
└── themes/
    └── images/
```

The exact settings filename may retain the current name for compatibility.

Source defaults live in `@card-architect/defaults`, not in a mutable runtime directory.

#### Work

1. Add a validated `dataPath` to API configuration, defaulting to the directory containing the configured database path unless `DATA_PATH` is explicit.
2. Add derived configured paths for module settings and mutable preset storage.
3. Derive theme-image storage from `storagePath`.
4. Pass these paths into services/routes or expose them through typed configuration; remove `__dirname`-relative mutable paths.
5. Inventory tracked preset JSON under `apps/api/data/settings/presets`.
6. Compare templates/snippets with the existing `@card-architect/defaults` exports.
7. Move any remaining source-owned default data, such as ComfyUI/emotion/wizard/name seeds, into the defaults package or typed source modules.
8. Seed a missing mutable preset file from the defaults package on first use.
9. Never overwrite an existing user-modified preset during startup or image upgrade.
10. Before untracking or removing the legacy settings path, make and verify a recoverable local copy of the current user settings under the new ignored data root.
11. Add a one-time native-development migration that copies legacy settings/presets only when the target does not exist.
12. Do not ship the planning machine's local SillyTavern base URL or cookie as a product default.
13. Add root/nested runtime ignore rules only after source defaults and the local copy are safe.
14. Set `DATA_PATH=/app/data` explicitly in Compose for clarity, even when it can be derived from `DATABASE_PATH`.
15. Ensure backup creation/restoration includes the intended mutable settings and theme metadata/files, or explicitly documents exclusions in T2/T3.
16. Test empty first run, legacy native path migration, existing target preservation, and container restart.

#### Why

Docker persistence is incomplete if cards survive but templates, module settings, or theme uploads disappear with the container.

Separating immutable defaults from mutable user files also lets `.dockerignore` protect private runtime data without deleting required product seeds.

The copy-before-untrack rule protects the current local configuration while cleaning up the repository boundary.

#### Acceptance

- No mutable route path is derived from compiled `__dirname`.
- All mutable full-mode files reside below configured data or storage roots.
- A clean first run seeds documented defaults.
- An upgrade never overwrites an existing user preset.
- The current local settings are preserved before any tracked legacy file is removed.
- The product defaults contain no machine-specific SillyTavern URL or session material.
- Settings, custom presets, and theme images survive container recreation.
- Source defaults remain present when the Docker context excludes all runtime data paths.

---

## 10. Milestone 2 — Define and validate the backup contract

### T2.1 — Capture legacy and current backup fixtures

**Purpose:** Freeze the inputs that must remain restorable before implementation changes.

**Blocked by:** T0.1.<br>
**Unblocks:** T2.2, T2.3, T3.1, T3.2.<br>
**Risk:** Low, with privacy sensitivity.<br>
**Primary files:** new test-fixture directory under the relevant tests; fixture generator scripts.

#### Work

1. Generate a minimal full-mode backup with one card, one version, one user preset, one app setting, one customized mutable preset/template, one theme image, one asset, and one card-asset relationship.
2. Generate a minimal browser-mode backup with one card, one image, one version, one stored asset, and representative allowlisted localStorage settings.
3. Generate a browser backup that the server currently accepts to preserve browser-to-full compatibility.
4. Generate legacy version 1.0 fixtures from the current pre-change implementation.
5. Use synthetic card names, text, and image bytes.
6. Do not copy any personal runtime database or stored asset into the repository.
7. Make fixture generation deterministic except for fields intentionally normalized during assertions.
8. Store either small binary ZIP fixtures or a deterministic fixture builder; prefer the builder where timestamps make byte-for-byte ZIP stability awkward.
9. Document each fixture's source mode and expected compatibility.
10. Create malformed variants programmatically rather than hand-editing opaque binaries.

#### Required fixture cases

- valid minimal full backup;
- valid minimal browser backup;
- valid legacy full backup;
- valid legacy browser backup;
- browser backup accepted by full restore;
- valid full backup converted by browser restore;
- missing manifest;
- malformed manifest JSON;
- unsupported format version;
- missing required JSON file;
- malformed record JSON;
- wrong top-level JSON type;
- duplicate card identifier;
- duplicate normalized archive path;
- missing referenced card;
- missing referenced asset;
- mismatched manifest count;
- absolute archive path;
- `../` traversal path;
- Windows drive path;
- oversized declared entry;
- too many entries;
- high compression-ratio archive;
- truncated ZIP;
- corrupt compressed stream;
- missing or malformed settings payload;
- missing included theme file;
- backup containing a secret-shaped setting to verify logs and previews do not disclose its value.

#### Why

Backup changes are dangerous when the only test input is produced by the new code itself.

Legacy fixtures prevent a format change from being disguised as a safety refactor.

Synthetic data avoids committing personal character content.

#### Acceptance

- Every required compatibility direction has a fixture or deterministic generator.
- No fixture contains real user content.
- Fixtures can be regenerated from documented commands.
- At least one fixture was produced by the pre-change implementation and retained as a compatibility oracle.

### T2.2 — Create `@card-architect/backup-core`

**Purpose:** Centralize browser-safe backup schemas and validation results.

**Blocked by:** T1.2, T2.1.<br>
**Unblocks:** T2.3, T2.4, T3.1, T3.2, T3.3.<br>
**Risk:** Medium.<br>
**Primary files:** `packages/backup-core/package.json`, `packages/backup-core/tsconfig.json`, `packages/backup-core/src/*`, root scripts, Docker workspace manifest copies.

#### Public API

Keep the package interface small.

The intended public concepts are:

```ts
type BackupSourceMode = 'full' | 'browser';

interface BackupLimits {
  maxArchiveBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalUncompressedBytes: number;
  maxJsonBytes: number;
  maxCompressionRatio: number;
}

interface ArchiveEntryDescriptor {
  name: string;
  compressedSize?: number;
  uncompressedSize?: number;
}

interface BackupInspection {
  sourceMode: BackupSourceMode;
  manifest: BackupManifest;
  preview: BackupPreview;
  payload: ValidatedBackupPayload;
  warnings: BackupWarning[];
}

type BackupValidationResult =
  | { valid: true; inspection: BackupInspection }
  | { valid: false; errors: BackupValidationError[] };
```

The exact names may change to fit existing conventions, but the semantic separation must remain.

#### Work

1. Define strict Zod schemas for manifest and logical JSON files.
2. Keep schemas tolerant only where a documented legacy backup requires it.
3. Convert accepted legacy shapes into one normalized internal payload.
4. Define structured error codes rather than UI-ready prose only.
5. Include entry name, logical file, and record index where safe.
6. Validate identifiers as non-empty strings with documented maximum lengths.
7. Validate timestamps without rewriting them during inspection.
8. Validate counts as non-negative safe integers.
9. Validate record relationships after all logical files are parsed.
10. Detect duplicate identifiers within every collection where identifiers are keys.
11. Detect duplicate normalized archive names before extraction.
12. Detect unsupported source/target combinations through a separate compatibility function.
13. Expose pure preview construction from validated payloads.
14. Expose normalized result-count types used by API and UI.
15. Export no persistence adapter and no archive decompressor implementation.
16. Build the package for ESM in the same style as existing workspace packages.
17. Add unit tests for every required fixture case.
18. Add a browser-bundle check that fails if a `node:` import appears.

#### Why

The existing server and browser implementations duplicate archive interpretation and can drift into different safety rules.

A pure package centralizes the contract without pretending SQLite and IndexedDB can share commit mechanics.

Structured errors make API responses, browser messages, tests, and logs consistent without coupling the core to React or Fastify.

#### Acceptance

- Both API and web workspaces can import the package.
- A Vite static build does not externalize a Node built-in because of this package.
- Every malformed fixture fails before a persistence method is called.
- Valid legacy fixtures normalize to the expected payload.
- The package contains no I/O.
- Public exports are documented in its entry point.

### T2.3 — Implement archive entry preflight and bounded parsing

**Purpose:** Reject unsafe ZIPs before unbounded allocation or extraction.

**Blocked by:** T2.2.<br>
**Unblocks:** T2.4, T3.1, T3.2.<br>
**Risk:** High.<br>
**Primary files:** backup-core archive validation, API backup archive adapter, web backup archive adapter.

#### Work

1. In the browser adapter, reuse Character Foundry's existing `preflightZipSizes` behavior where it exposes the required metadata.
2. Wrap it in application-owned limits rather than exposing package-specific errors directly.
3. Do not read a staged server archive completely into memory merely to reuse a buffer-oriented preflight helper.
4. In the server adapter, consume central-directory/local-header descriptors through bounded file reads or the streaming ZIP parser and enforce actual emitted-byte limits during extraction to staging.
5. Add application-level path validation because Character Foundry format paths and Character Architect backup paths are different contracts.
6. Count entries before starting decompression when central-directory metadata permits it.
7. Sum declared uncompressed sizes with safe-integer overflow checks.
8. Enforce per-entry and total limits.
9. Enforce a compression-ratio limit only when both compressed and uncompressed sizes are known.
10. Continue enforcing actual emitted-byte limits during streaming because ZIP metadata may lie or be absent.
11. Reject encrypted entries because no encryption workflow is supported.
12. Reject unsupported compression methods with a stable error.
13. Decode JSON only after its actual emitted bytes remain under the JSON cap.
14. Parse JSON with error location context when available.
15. Never log whole JSON contents on failure.
16. Ensure validate and restore call exactly the same parser.

#### Why

ZIP central-directory checks reduce obvious archive bombs but are not sufficient by themselves.

Actual streaming byte counters are still needed because an attacker can provide false or missing metadata.

Using the existing Character Foundry primitive avoids duplicating known-safe size inspection while keeping backup-specific layout checks in the application.

#### Acceptance

- Oversized metadata is rejected without decompressing entry bodies.
- Lying metadata is caught by actual emitted-byte counters.
- Path traversal fixtures never create a file.
- Validate and restore return the same validation errors for the same input.
- Browser and server adapters produce the same normalized inspection for the same browser backup.

### T2.4 — Unify backup preview and restore result contracts

**Purpose:** Remove mode-specific result ambiguity from the UI and API client.

**Blocked by:** T2.2, T2.3.<br>
**Unblocks:** T3.3, T3.4.<br>
**Risk:** Low.<br>
**Primary files:** backup-core types, `apps/web/src/lib/api.ts`, `apps/web/src/lib/backup.ts`, `BackupRestorePanel.tsx`, API route/service result types.

#### Work

1. Define one count object with explicit keys for cards, images, versions, assets, relationships, presets, and settings where applicable.
2. Use zero for a supported category with no records.
3. Omit or mark unsupported categories through capabilities rather than letting the UI assume a property exists.
4. Define warning and error arrays separately.
5. Distinguish validation failure, compatibility failure, conflict failure, commit failure, and recovery-required failure.
6. Make preview identify source mode and target compatibility.
7. Make the UI render only categories returned by the contract.
8. Preserve backwards compatibility at the HTTP boundary if an external client could consume the current result; otherwise document the internal API change.
9. Add type-level tests or compilation assertions for both browser and API clients.

#### Why

The current UI and server result shapes can disagree about categories such as images.

An explicit shared result eliminates fragile optional-property assumptions and makes cross-mode rejection understandable.

#### Acceptance

- The settings panel compiles against one shared result type.
- Full and browser previews show accurate counts.
- Full-to-browser conversion is validated before the destructive confirmation step.
- Errors never imply success because some earlier records were imported.

---

## 11. Milestone 3 — Make restore lossless in every supported mode

### T3.1 — Make browser replace and merge transactional

**Purpose:** Prevent IndexedDB replacement from leaving an empty or partial library.

**Blocked by:** T2.1, T2.2, T2.3.<br>
**Unblocks:** T3.3, T3.5, T7.1.<br>
**Risk:** High because it mutates browser-local user data.<br>
**Primary files:** `apps/web/src/lib/db.ts`, `apps/web/src/lib/backup.ts`, tests using fake IndexedDB.

#### Work

1. Introduce a typed `LocalBackupDataset` normalized by backup-core.
2. Add `replaceAll(dataset)` to `LocalDB`.
3. Open one read-write transaction covering cards, images, versions, assets, and drafts.
4. Clear every replace-owned store in that transaction.
5. Insert every normalized record in deterministic order.
6. Await transaction completion exactly once.
7. Abort on the first insertion error.
8. Remove replace-mode use of separate `clearAll()` and `importAll()` calls.
9. Keep `clearAll()` only if another explicit UI function needs it; otherwise remove it after call-site review.
10. Add `mergeAll(dataset, conflictPolicy)` using one transaction.
11. Compute conflicts before opening the mutation transaction.
12. Define `skipConflicts=true` as preserving the existing record and recording a skipped count.
13. Define `skipConflicts=false` as rejecting the whole merge before mutation when any conflict exists.
14. Capture relevant localStorage settings before applying restored settings.
15. Validate settings with their existing Zod schemas.
16. Restore the localStorage snapshot if settings application fails.
17. Keep card restoration successful if only optional settings fail, but return a prominent warning.
18. Refresh application stores only after the IndexedDB transaction commits.

#### Failure-injection tests

- validation fails before `replaceAll` is called;
- clearing the second store throws;
- inserting the first card throws;
- inserting a later version throws;
- inserting an asset throws;
- transaction completion rejects;
- localStorage write throws;
- app-store refresh throws after commit.

#### Why

IndexedDB already supplies the atomic transaction needed for this fix.

The data-loss bug exists because clearing and importing are split across two transactions, not because IndexedDB lacks durability.

Precomputing merge conflicts also prevents a merge policy from changing midway through a transaction.

#### Acceptance

- Invalid replace input leaves a sentinel dataset byte-for-byte equivalent at the logical-record level.
- Any injected transaction failure leaves the sentinel dataset intact.
- Successful replace contains exactly the restored records and no stale drafts.
- Merge with strict conflicts performs no writes.
- Merge with skipped conflicts preserves existing records and reports exact counts.
- Static and light builds pass the same restore tests.

### T3.2 — Stage server restore uploads and archive contents

**Purpose:** Bound memory use and prepare filesystem changes without touching live state.

**Blocked by:** T1.4, T2.1, T2.2, T2.3.<br>
**Unblocks:** T3.3, T3.4, T3.5.<br>
**Risk:** High.<br>
**Primary files:** `apps/api/src/routes/backup.ts`, `apps/api/src/services/backup.service.ts`, new server archive/staging helpers, config.

#### Work

1. Add explicit compressed-upload, uncompressed-total, entry, and entry-count limits to API configuration.
2. Accept multipart input as a stream.
3. Write it to a unique file under an application-owned temporary restore directory.
4. Count compressed bytes while writing and abort above the configured limit.
5. Set restrictive permissions on temporary directories and files.
6. Fsync the completed upload when platform support and performance make it reasonable; at minimum await stream closure.
7. Inspect the staged ZIP through the bounded archive adapter.
8. Write asset entry output into a unique staging storage directory on the same filesystem as live storage.
9. Stage included theme files below that storage tree.
10. Stage mutable settings/preset files as same-filesystem siblings of their live data-root targets without touching the database file.
11. Keep JSON payloads within their individual limits.
12. Return one validated, normalized restore plan and filesystem swap set.
13. Delete the staged upload after success or ordinary validation failure.
14. Delete every disposable staged tree/file after validation failure.
15. Retain recovery paths after a commit/rollback failure.
16. Clean abandoned ordinary temporary files at process start only when they are unambiguously marked as disposable.
17. Never clean paths marked as recovery-required automatically.

#### Why

The route's current `toBuffer()` call and service's `unzipSync()` call multiply memory use before validation finishes.

Staging to disk matches the full deployment's large-library use case and gives filesystem assets a safe pre-commit location.

#### Acceptance

- The restore route does not buffer the complete archive in memory.
- Compressed-byte overflow stops the upload.
- Uncompressed-byte overflow stops extraction.
- Validation failure leaves database and live storage unchanged.
- Temporary files are removed after ordinary failures.
- Recovery data is retained after rollback failure.

### T3.3 — Commit full-mode replacement atomically

**Purpose:** Ensure SQLite and filesystem storage are replaced together or restored together.

**Blocked by:** T2.4, T3.2.<br>
**Unblocks:** T3.5, T7.1.<br>
**Risk:** Critical.<br>
**Primary files:** `apps/api/src/services/backup.service.ts`, database repositories/helpers, path utility, tests.

#### Restore mutex

Only one restore may prepare for commit at a time per API process.

The simplest acceptable implementation is an in-process async mutex because the default deployment runs one API process against one SQLite database.

Document that multi-process deployment is unsupported until a database/file lock is added.

Ordinary card writes during the short commit window should either wait behind the same write gate or be prevented by the SQLite transaction and restore maintenance state.

#### Database transaction

1. Precompile or prepare all insert statements.
2. Remove per-record try/catch blocks that convert insertion failures into partial success.
3. Execute deletes and inserts inside one `better-sqlite3` transaction function.
4. Delete tables in foreign-key-safe order.
5. Insert parent records before dependent records.
6. Restore only non-built-in presets where that is the current semantic contract.
7. Reset or recompute any sequence state that depends on restored integer IDs.
8. Preserve schema migrations and built-in defaults.
9. Return counts only after commit.

#### Filesystem swap

1. Resolve and validate every live path in the swap set: storage, theme files, and included mutable settings/preset files or subdirectories.
2. Never include the SQLite database file itself in that filesystem swap set.
3. Create unique sibling names for each staging and rollback path.
4. Ensure each staged/rollback path is on the same device as its corresponding live path.
5. Fully verify the staged swap set before entering the commit transaction.
6. Inside the database transaction callback, move each live path to its rollback path.
7. Move each staged path to its live location.
8. Perform a bounded final check of expected live paths before destructive SQL or before the transaction callback returns.
9. Run the destructive deletes and inserts, including included `app_settings` rows and user-owned presets.
10. Allow the database transaction to commit only after the filesystem check and SQL both succeed.
11. Remove rollback paths after the transaction commits.
12. On any pre-commit failure, move failed live paths aside and restore every rollback path while the SQL transaction rolls back.
13. If rollback succeeds, remove failed new paths after diagnostic logging.
14. If rollback fails, preserve all old/new paths and return `RECOVERY_REQUIRED` with paths in server logs but not sensitive host paths in the client message.

#### Cross-platform considerations

- Test Linux because it is the Docker runtime.
- Account for Windows rename behavior in native development.
- Close file descriptors before renaming directories.
- Ensure Nginx/Fastify static serving does not retain a directory handle that prevents the swap.
- Avoid copying large trees as the normal commit operation.

#### Why

SQLite transactions cannot roll back filesystem mutation automatically.

Staging plus same-filesystem renames supplies a recoverable coordination protocol without introducing a second database or object store.

Retaining rollback directories on exceptional recovery failure is safer than aggressive cleanup.

#### Acceptance

- A corrupt archive changes nothing.
- An insert failure after destructive deletes rolls the database back.
- An insert failure after filesystem swaps restores the old storage, themes, and mutable settings/preset files.
- A filesystem swap failure occurs before destructive database changes.
- A successful replace leaves exactly the restored logical database and staged filesystem state.
- Result counts are produced only after commit.
- A concurrent second restore is rejected or waits deterministically.
- Recovery-required errors preserve recoverable data and give actionable logs.

### T3.4 — Stream full-mode backup creation

**Purpose:** Make backups practical for large Docker libraries.

**Blocked by:** T1.4, T2.2, T2.3, T3.2.<br>
**Unblocks:** T3.5, T7.1.<br>
**Risk:** High.<br>
**Primary files:** `apps/api/src/routes/backup.ts`, `apps/api/src/services/backup.service.ts`, archive streaming helper.

#### Work

1. Replace the `Promise<Buffer>` service contract with a stream-producing contract.
2. Emit the manifest and JSON logical files through fflate streaming ZIP APIs.
3. Include intended `app_settings` rows, user presets, customized mutable presets/templates, and other state named in section 5.6.
4. Enumerate asset and theme files without reading all file contents at once.
5. Read and compress one bounded stream at a time or use controlled concurrency.
6. Respect backpressure between fflate output and the HTTP response.
7. Abort source streams when the client disconnects.
8. Abort all compression work on the first source read error.
9. Omit `Content-Length` when the stream size is unknown and use chunked transfer.
10. Set `Content-Type` and a sanitized `Content-Disposition` filename before streaming.
11. Log counts and final bytes, not card or secret setting contents.
12. Make backup creation and restore commit mutually compatible through the restore/write gate so a backup cannot observe half a restore.
13. Decide whether ordinary writes are allowed during backup; prefer a consistent SQLite read transaction or snapshot.
14. Document the consistency model for asset, theme, and mutable settings files that change during backup.

#### Consistency policy

The database portion must reflect one SQLite read snapshot.

Asset enumeration should derive from that snapshot's metadata.

If an expected file disappears or changes while it is read, fail the backup rather than silently produce a manifest whose relationships do not match its files.

Do not hold a global write lock for the entire compression of a multi-gigabyte asset library unless measurement shows it is acceptable.

#### Why

The current runtime data is much larger than a safe in-memory archive.

Streaming output bounds peak memory and lets the HTTP client begin receiving bytes immediately.

Failing on asset inconsistency is preferable to generating a backup that validates but cannot fully restore.

#### Acceptance

- The route never assembles the complete ZIP in one Buffer.
- Peak memory does not scale with total asset bytes in the generated integration test.
- Client cancellation closes file descriptors and stops compression.
- A missing asset causes a failed download and clear server log.
- The resulting ZIP passes the same backup-core validation used for restore.

### T3.5 — Add end-to-end restore safety tests

**Purpose:** Prove the data-loss fix at the system boundary.

**Blocked by:** T3.1, T3.3, T3.4.<br>
**Unblocks:** T4.4, T5.2, T7.1.<br>
**Risk:** Medium.<br>
**Primary files:** API integration tests, web Vitest tests, Playwright tests, Docker smoke scripts.

#### Browser scenarios

1. Seed sentinel IndexedDB records in every owned store.
2. Attempt invalid replace and compare every store afterward.
3. Inject a late insertion failure and compare every store afterward.
4. Restore a valid backup and verify exact replacement.
5. Merge without conflicts and verify additions.
6. Merge with conflicts under skip policy and verify preservation.
7. Merge with conflicts under strict policy and verify no writes.
8. Reload the page and verify restored records remain.
9. Restore a legacy browser backup.
10. Reject a full backup with a compatibility message.
11. Verify allowlisted localStorage settings restore and a secret-shaped value never appears in logs or preview text.

#### Server scenarios

1. Seed sentinel database records, `app_settings`, user presets, mutable settings/preset files, a theme file, and real sentinel storage files.
2. Attempt invalid replace and compare both database and storage.
3. Inject failure on an early insert.
4. Inject failure on a late dependent insert.
5. Inject failure after storage swap.
6. Inject failure during storage swap.
7. Restore a valid full backup and verify exact replacement of every category in section 5.6.
8. Restore a valid browser backup and verify supported normalization.
9. Restore a legacy full backup.
10. Start two concurrent restores and verify serialized behavior.
11. Restart the API and verify the committed data remains.

#### Resource scenarios

1. Upload an archive above the compressed limit.
2. Upload an archive above the uncompressed limit.
3. Upload a high-ratio archive.
4. Cancel a backup download.
5. Cancel a restore upload.
6. Generate a large synthetic asset backup outside the ordinary fast test suite.
7. Record peak RSS and verify it remains within a measured bound rather than scaling linearly with total archive size.

#### Why

Unit tests can prove schema validation or transaction helpers, but only boundary tests prove the route, archive staging, persistence, and cleanup work together.

The sentinel comparison is the direct regression test for the reported data-loss risk.

#### Acceptance

- Every failure scenario demonstrates unchanged pre-existing data or an explicit retained recovery state.
- Tests fail against the old clear-before-import implementations.
- No test relies on personal runtime data.
- Resource-intensive tests are tagged and run on a documented schedule if too heavy for every pull request.

### T3.6 — Make restore UI reflect safety and compatibility

**Purpose:** Give the user accurate information before replacement.

**Blocked by:** T2.4, T3.1, T3.3.<br>
**Unblocks:** T7.1.<br>
**Risk:** Low.<br>
**Primary files:** `apps/web/src/features/settings/panels/BackupRestorePanel.tsx`, client backup/API libraries.

#### Work

1. Validate and preview immediately after a file is selected.
2. Show source mode, generated date, generator version, and logical counts when available.
3. Show legacy status when source-mode metadata is inferred.
4. Disable the restore button for invalid or incompatible backups.
5. Keep merge selected by default.
6. For replace mode, state that current cards, versions, assets, drafts, and eligible settings will be replaced.
7. Require one clear confirmation immediately before replace commit.
8. Do not ask the user to confirm an archive that has not passed validation.
9. Display structured validation errors without exposing server paths.
10. Distinguish warnings from errors.
11. Show exact imported, skipped, and warning counts after success.
12. On recovery-required server failure, tell the user to stop retrying and inspect server logs.
13. Warn on create and restore that backups can contain private cards, provider credentials, and session material.
14. Preserve keyboard and screen-reader accessibility for the confirmation and error summary.

#### Why

Atomic implementation prevents loss, while accurate preview prevents avoidable mistakes.

The interface should not imply that every backup can move in every direction.

#### Acceptance

- Replace cannot begin before successful validation.
- Full-to-browser backups are normalized and validated before confirmation.
- Error focus moves to the summary for keyboard and assistive-technology users.
- Successful result counts match persistence assertions.
- Preview and logs identify sensitive categories without displaying their values.

---

## 12. Milestone 4 — Make quality gates truthful

### T4.1 — Repair fixture discovery and generation

**Purpose:** Stop fixture-dependent tests from passing by skipping themselves.

**Blocked by:** T1.1, T1.2, T2.1.<br>
**Unblocks:** T4.4, T5.1, T5.2.<br>
**Risk:** Medium because real failures will become visible.<br>
**Primary files:** test setup/config, fixture helper package or script, `.github/workflows/ci.yml`.

#### Work

1. Define the canonical fixture root relative to repository root.
2. Resolve it once in a shared test helper.
3. In CI, pass an absolute path derived from `GITHUB_WORKSPACE`.
4. Make required-fixture suites fail with a clear setup error when the root is absent.
5. Reserve skips for explicitly optional external/private fixture sets.
6. Generate required synthetic fixtures during test setup or commit their small deterministic outputs.
7. Record fixture provenance and expected hashes where useful.
8. Remove duplicated per-package path guessing.
9. Run API, web, and import-core fixture suites from repository root and package subdirectories.
10. Restore coverage for AlternativeFirstMessages and other currently skipped mappings.

#### Why

The current relative environment variable is interpreted from filtered workspace directories, allowing CI to appear green without exercising the intended integration tests.

Failing fast turns missing tests into visible infrastructure failures.

#### Acceptance

- CI logs the canonical fixture root without logging fixture contents.
- Required fixture count is asserted.
- The previously skipped required suites execute.
- The same command works locally and in CI.
- GitHub issue #8's mapping is covered by a passing regression test or a proven failing test that identifies its true owner.

### T4.2 — Repair TypeScript project boundaries

**Purpose:** Make root type checking a reliable gate.

**Blocked by:** T1.2.<br>
**Unblocks:** T4.4, T5.1.<br>
**Risk:** Medium.<br>
**Primary files:** API TypeScript configs, test configs, shared testkit placement, package references if needed.

#### Work

1. Keep the API production build rooted in `apps/api/src` or its intended source root.
2. Do not broaden the production `rootDir` to the repository merely to silence test imports.
3. Move cross-workspace test helpers into a small test-only workspace or configure a test-specific TypeScript project.
4. Exclude tests from production build config if that is already the intent.
5. Include tests in a separate no-emit type-check config.
6. Ensure workspace package declarations are built or referenced before app checks.
7. Remove obsolete Node 20 ambient assumptions.
8. Run the root type-check command from a clean build state.

#### Why

Production compilation and test compilation have different boundaries.

Expanding `rootDir` would hide the design mistake and can change output paths.

A test-specific project keeps both guarantees explicit.

#### Acceptance

- Root type checking exits zero.
- API production output paths are unchanged unless intentionally documented.
- Test helpers have one declared owner.
- Static web type checking cannot import Node-only backup code.

### T4.3 — Scope linting to authored source and fix the baseline

**Purpose:** Turn a noisy 740-finding lint command into a useful gate.

**Blocked by:** T0.2, T1.2.<br>
**Unblocks:** T4.4, T5.1.<br>
**Risk:** Medium.<br>
**Primary files:** ESLint config, package scripts, authored source findings.

#### Work

1. Exclude generated `dist`, coverage, reports, runtime data, vendored assets, and fixture output.
2. Keep authored scripts and configuration in scope where the parser supports them.
3. Give API and browser code appropriate environments/globals.
4. Separate test-file rule overrides from production rules.
5. Review every remaining error category before bulk edits.
6. Fix correctness-relevant issues first.
7. Disable a rule only with a repository-level rationale.
8. Avoid mass formatting unrelated source in the same commit.
9. Set `--max-warnings 0` only after the intentional warning baseline is zero.
10. Add package-level lint scripts where they improve local feedback.

#### Why

Lint cannot protect the code when its output is dominated by generated artifacts and environment mismatches.

Narrowing to authored source is not lowering standards; it defines the actual code owners can fix.

#### Acceptance

- Root lint exits zero on a clean checkout.
- Generated output cannot reintroduce findings.
- No broad rule disable hides unsafe `any`, promise, or process-execution behavior in the files changed by this plan.
- CI runs the same command.

### T4.4 — Build a deployment-aware CI graph

**Purpose:** Test the contracts that are actually deployed.

**Blocked by:** T4.1, T4.2, T4.3, T3.5 for final enforcement.<br>
**Unblocks:** T1.6, T5.1, T5.2, T6.1, T7.1.<br>
**Risk:** Medium.<br>
**Primary files:** `.github/workflows/ci.yml`, package scripts, Playwright configuration.

#### CI jobs

1. **install-and-shared-build**
   - Node 24;
   - pnpm 11.24.0;
   - frozen install;
   - shared package build;
   - reusable cache/artifacts only where they remain trustworthy.
2. **typecheck-and-lint**
   - root type check;
   - root lint;
   - no generated output lint.
3. **unit-and-integration-tests**
   - API tests;
   - web tests;
   - workspace package tests;
   - absolute fixture root;
   - required fixture count assertion.
4. **web-build-matrix**
   - `full` build;
   - `light` build;
   - `static` build;
   - artifact naming by mode.
5. **static-smoke**
   - serve static build;
   - open app;
   - fail any startup `/api` request;
   - create/reload a browser-local card;
   - exercise browser backup preview.
6. **docker-build**
   - API target;
   - web target;
   - no dependency on deployment.
7. **docker-compose-smoke**
   - health;
   - proxy;
   - persistence restart;
   - scheduled or push-only if resource cost demands.
8. **deploy-cloudflare**
   - push only;
   - needs all required static quality jobs;
   - explicit static artifact;
   - environment protection as configured.

#### Workflow rules

- Documentation-only changes may skip heavy jobs only if they cannot affect build configuration.
- Changes to Docker, package manifests, lockfile, workflows, Wrangler, or deployment config must run relevant builds.
- A deploy job must never rebuild a materially different artifact from the one tested.
- Prefer uploading the tested static artifact and deploying it, or repeat the exact pinned build if artifact flow is impractical.
- Secrets are available only to deployment steps that need them.
- Pull-request jobs from forks must not require private registry credentials unless packages can be installed read-only without them.

#### Why

One generic web build does not prove static behavior, and the current Docker dependency skips pull-request builds.

Mode-specific jobs make the application's deliberate feature differences visible rather than accidental.

#### Acceptance

- All three web modes compile.
- Static smoke observes zero server requests at startup.
- Docker builds run on pull requests.
- Deploy runs only after tested static output succeeds.
- A missing fixture fails CI.
- Type and lint failures block deployment.

### T4.5 — Add deployment-mode contract tests

**Purpose:** Prevent server-only functionality from leaking into browser-only modes.

**Blocked by:** T4.2, deployment config seam from 6.9.<br>
**Unblocks:** T4.4, T5.2, T7.1.<br>
**Risk:** Low.<br>
**Primary files:** `apps/web/src/config/deployment.ts`, new tests, module registry tests, persistence adapter tests.

#### Work

1. Test `createDeploymentConfig('full')` exhaustively.
2. Test `createDeploymentConfig('light')` exhaustively.
3. Test `createDeploymentConfig('static')` exhaustively.
4. Test the persistence adapter selected for each mode.
5. Test server-only modules are hidden in light/static.
6. Test browser client features remain available where documented.
7. Test explicit environment mode overrides hostname inference.
8. Test hostname inference only as a local-development fallback.
9. Test unknown explicit mode fails safely rather than silently enabling full mode.
10. Add a static-bundle check for forbidden Node built-ins where practical.

#### Why

Deployment configuration is a product contract.

Pure tests are faster and more precise than discovering a wrong mode only after deployment.

#### Acceptance

- Every matrix row in section 5 has a direct test or a named end-to-end test.
- Unknown modes do not enable server behavior.
- Full Docker and static Cloudflare builds select their mode explicitly.

---

## 13. Milestone 5 — Update dependencies without churn

### T5.1 — Produce a dependency change ledger

**Purpose:** Turn the outdated-package list into reviewable groups with explicit risk.

**Blocked by:** T1.1, T4.1, T4.2, T4.3, T4.4.<br>
**Unblocks:** T5.2, T5.3, T5.4, T5.5, T5.6.<br>
**Risk:** Low.<br>
**Primary files:** planning/PR notes; package manifests only in later tasks.

#### Work

For every direct dependency, record:

- current declared range;
- current locked version;
- latest stable version;
- update class: patch, minor, or major;
- runtime owner: root tooling, shared package, API, web, or test-only;
- deployment exposure: full, light, static, build-only, or multiple;
- known migration notes;
- security advisory relationship;
- native build implications;
- proposed update batch;
- required focused tests;
- defer rationale when not updating.

Also record production transitive advisories by dependency path rather than raw advisory count.

#### Grouping policy

Use these groups:

1. Node/pnpm and Node types;
2. low-risk patch/minor tooling;
3. low-risk patch/minor browser runtime;
4. low-risk patch/minor API runtime;
5. Character Foundry consumers;
6. Cloudflare/Wrangler;
7. Vite/PWA/build chain majors;
8. React/router/state/UI majors;
9. Fastify/plugin majors;
10. native/storage/search packages;
11. security-driven transitive remediation.

#### Why

The audit found many outdated packages, but version distance alone is not a defect.

Grouping by runtime and risk makes regressions attributable and lets stable format packages remain untouched when there is no benefit.

#### Acceptance

- Every direct dependency is assigned to a batch or explicitly deferred.
- Every critical/high production advisory has a dependency path and disposition.
- No batch combines unrelated frontend and backend framework majors.
- The ledger identifies which deployment mode each update can affect.

### T5.2 — Apply low-risk patch and minor updates

**Purpose:** Pick up compatible fixes before major migrations.

**Blocked by:** T5.1, T3.5, T4.4.<br>
**Unblocks:** T5.3, T5.4, T5.5, T5.6, T7.1.<br>
**Risk:** Medium.<br>
**Primary files:** relevant package manifests and `pnpm-lock.yaml`.

#### Work

1. Update one runtime group at a time.
2. Keep root tooling separate from application runtime dependencies.
3. Keep API runtime separate from web runtime.
4. Use the latest stable version allowed by the existing major unless an advisory requires a targeted major.
5. Review release notes for every package with native bindings, build plugins, storage, routing, or serialization behavior.
6. Run a frozen reinstall after the lockfile update.
7. Run the complete relevant package tests.
8. Run all three web builds after web dependency changes.
9. Run Docker target builds after API/native changes.
10. Run backup fixtures after fflate, Zod, idb, better-sqlite3, or Fastify multipart changes.
11. Re-run production audit and update the ledger.

#### Commit boundaries

Suggested commits are:

- root test/lint/build tooling patch/minors;
- web runtime patch/minors;
- API runtime patch/minors;
- native dependency patch/minors;
- lockfile-only deduplication if needed and explainable.

#### Why

Small compatible updates reduce advisory and bug backlog while keeping a narrow rollback surface.

Separating runtime groups prevents a single failing build from requiring a large dependency bisect.

#### Acceptance

- Each commit has a concise package list.
- Full, light, and static checks pass after web updates.
- Docker checks pass after API updates.
- No package is upgraded only because it is old.
- Audit results improve or remaining paths are documented.

### T5.3 — Update Character Foundry consumers only where justified

**Purpose:** Consume stable owned-package releases without changing format behavior casually.

**Blocked by:** T4.1, T5.1, T5.2.<br>
**Unblocks:** issue #8 disposition, T7.1.<br>
**Risk:** High because import/export regressions can lose format data.<br>
**Primary files:** root, API, web, and import-core package manifests; lockfile; fixture tests.

#### Work

1. Query the configured registry for every `@character-foundry/*` package used directly.
2. Compare registry versions with the sibling source repository's package versions and tags.
3. Resolve the observed mismatch between the app's prerelease aggregate dependency, the sibling source aggregate version, and any newer published registry version before editing ranges.
4. Read release notes and relevant source diffs for every proposed version jump.
5. Prefer stable releases over timestamped development builds.
6. Keep individual package versions mutually compatible.
7. Avoid adding the aggregate package to browser runtime code if individual packages keep the bundle smaller and clearer.
8. Run deterministic CCv2, CCv3, PNG, JSON, CHARX, Voxta, lorebook, and asset fixtures.
9. Run cross-format round trips and compare semantic content, not archive timestamps.
10. Verify AlternativeFirstMessages maps to and from `alternate_greetings` as expected.
11. Verify assets, main icons, and relationships remain intact.
12. Verify the Vite build does not pull Sharp or another Node-only module into static runtime.
13. If a defect is in Character Foundry, stop the app update for that package and open/implement a separate package fix.
14. Publish the package fix before changing the app lockfile to consume it.

#### Why

The packages are owned but still form a release boundary.

Fixing package source and application integration in one unversioned step would make it impossible to know what other consumers receive.

Stable formats benefit more from strong fixtures than from routine version churn.

#### Acceptance

- No Character Foundry consumer remains on a prerelease without a written reason.
- Every updated package has a passing format-focused regression suite.
- Static builds remain browser-safe.
- No new format behavior is introduced implicitly.
- Issue #8 is either closed with test evidence or reassigned with a precise failing case.

### T5.4 — Upgrade Wrangler and validate static deployment

**Purpose:** Bring Cloudflare tooling onto a supported major while preserving the static-assets deployment.

**Blocked by:** T4.4, T5.1, T5.2.<br>
**Unblocks:** T7.2.<br>
**Risk:** Medium.<br>
**Primary files:** root package manifest, lockfile, `wrangler.toml`, CI deployment steps.

#### Work

1. Read the official Wrangler major migration guide for every crossed major.
2. Update Wrangler in a dedicated commit.
3. Keep `[assets] directory = "./apps/web/dist"` and SPA fallback semantics.
4. Run Wrangler configuration validation.
5. Run a dry-run deployment or artifact-generation command supported by the selected version.
6. Confirm the static build artifact is the same artifact selected for deployment.
7. Deploy to the dev Worker.
8. Test direct navigation to a nested SPA route.
9. Test static assets, service worker, manifest, and userscript paths.
10. Test a clean browser profile.
11. Test an existing profile with the prior PWA installed.
12. Leave `compatibility_date` unchanged in the tool-only commit.
13. If a date update is desired, make it a second commit and repeat dev validation.

#### Why

Wrangler v4 changes CLI/tooling behavior, while the runtime deployment remains a static-assets Worker.

Separating the compatibility date prevents build-tool migration from also opting into new runtime semantics.

#### Acceptance

- Current Wrangler validates the configuration.
- Dev deployment serves the SPA and nested routes.
- Existing PWA users receive the update.
- No API or Node compatibility flag is added without a runtime need.
- Production deploy remains gated on explicit approval or the existing protected environment.

### T5.5 — Evaluate frontend framework majors separately

**Purpose:** Decide whether React, router, Zustand, Milkdown, CodeMirror, Vite, or PWA majors are worth their migration cost.

**Blocked by:** T5.1, T5.2, T4.4, T4.5.<br>
**Unblocks:** Optional future work; not required for the first maintenance release.<br>
**Risk:** High.<br>
**Primary files:** web package manifest and affected application code only if approved.

#### Decision policy

Update a frontend major only when at least one is true:

- the current major is unsupported;
- a security fix is unavailable on the current major;
- a confirmed application bug is fixed only in the new major;
- the migration removes a concrete compatibility blocker;
- the maintenance cost of staying is greater than the measured migration cost.

Do not update merely to make `outdated` empty.

#### Work for any approved major

1. Read official migration notes.
2. Create a dedicated branch/commit series.
3. Add focused regression tests before the version change.
4. Update one tightly coupled family together when required.
5. Run component tests.
6. Run all deployment-mode builds.
7. Run static and full Playwright smoke tests.
8. Compare production bundle size.
9. Inspect PWA registration/update behavior.
10. Confirm editor state, routing, modal focus, and persistence hydration.

#### Why

The web application already works and has several large editor dependencies.

Framework-major churn has a much larger regression surface than routine maintenance and should not block Docker or data safety.

#### Acceptance

- Each approved major has a written benefit and migration note.
- Deferred majors have a written reason and review date, not an open-ended promise.
- No frontend-major migration shares a commit with backup or Docker repair.

### T5.6 — Evaluate Fastify and native/storage majors separately

**Purpose:** Modernize server infrastructure only with complete route and persistence evidence.

**Blocked by:** T5.1, T5.2, T3.5, T4.4.<br>
**Unblocks:** Optional future work; security remediation where required.<br>
**Risk:** Critical.<br>
**Primary files:** API package manifest, Fastify plugins/routes, SQLite/storage/search utilities.

#### Package families

- Fastify and official Fastify plugins;
- better-sqlite3;
- Sharp;
- FastEmbed and its model/download chain;
- multipart handling;
- WebSocket support;
- fflate if a major appears;
- pdf parsing.

#### Work for any approved major

1. Read official migration and compatibility tables.
2. Verify plugin versions match the selected Fastify major.
3. Add route schema tests for changed validation/serialization behavior.
4. Test multipart stream limits and abort behavior.
5. Test proxy trust and rate-limit identity.
6. Test SQLite migrations against a copied synthetic old database.
7. Test backup restore failure injection.
8. Test native module loading in Docker.
9. Test fresh and existing data directories.
10. Test FastEmbed lazily so a model download is not required for unrelated API startup.

#### Why

These packages touch request parsing, durable data, native ABI compatibility, or large downloads.

They should not ride along with ordinary dependency cleanup.

#### Acceptance

- Every major has a focused migration commit.
- Docker startup and restore safety pass after every native/storage change.
- Existing synthetic databases migrate successfully.
- No model download is required for health checks or ordinary card editing.

### T5.7 — Remediate production advisories by path

**Purpose:** Remove real exposure rather than chase aggregate counts.

**Blocked by:** T5.1; may proceed alongside T5.2.<br>
**Unblocks:** T7.1.<br>
**Risk:** Varies by dependency path.<br>
**Primary files:** package manifests, lockfile, optional feature boundaries.

#### Work

1. Re-run a production-only audit with the pinned toolchain.
2. Export every critical and high advisory with its full dependency path.
3. Determine whether the vulnerable code is bundled, imported, invoked, or optional.
4. Upgrade the nearest direct dependency when a compatible fix exists.
5. Use a pnpm override only when upstream ranges prevent a safe fixed transitive version and compatibility tests prove it works.
6. Link each override to its upstream issue/advisory and add a removal condition.
7. For the critical `tar` path through FastEmbed, verify the fixed path and whether FastEmbed is needed in the default API install.
8. If no fixed FastEmbed path exists, consider isolating RAG/FastEmbed as an optional install or runtime feature rather than accepting a critical archive vulnerability silently.
9. Do not suppress advisories globally.
10. Document residual advisories with exploitability and compensating controls.

#### Why

Advisory counts include duplicates and packages that may never execute.

The critical archive path still deserves direct action because model/package extraction can be a real server-side input path.

#### Acceptance

- No unexplained critical production advisory remains.
- Every remaining high advisory has a dependency path and owner.
- Overrides are tested and temporary.
- Full Docker startup does not require an optional vulnerable feature.

---

## 14. Milestone 6 — Fix application-owned security defects

### T6.1 — Remove ffmpeg command injection

**Purpose:** Prevent optimizer settings from becoming shell syntax.

**Blocked by:** T1.1; CI enforcement by T4.4.<br>
**Unblocks:** T1.7, T7.1.<br>
**Risk:** High in native/full deployments with ffmpeg installed.<br>
**Primary files:** `apps/api/src/routes/charx-optimizer.ts`, `apps/api/src/utils/image-optimizer.ts`, schemas, tests.

#### Work

1. Define a Zod request schema for every optimizer setting.
2. Enforce integer ranges for `webmQuality` and other numeric settings.
3. Reject unknown fields unless forwards compatibility explicitly requires stripping them.
4. Store only validated settings.
5. Replace `execAsync('ffmpeg -version')` with `execFile` or `spawn` using a fixed executable and argument array.
6. Replace the conversion command string with `execFile` or `spawn` arguments.
7. Pass input and output paths as individual arguments.
8. Use a fixed codec and option allowlist.
9. Keep temporary filenames application-generated.
10. Add a timeout and output-size bounds for the child process.
11. Kill the process tree on timeout/cancellation where supported.
12. Return a stable capability/unavailable error when ffmpeg is absent.

#### Malicious-input tests

Test values containing:

- semicolons;
- command substitution syntax;
- quotes;
- whitespace and newlines;
- negative numbers;
- decimals;
- extremely large integers;
- arrays and objects in place of numbers.

#### Why

TypeScript annotations do not validate JSON at runtime.

Argument-based execution removes shell interpretation even if a validation layer regresses later.

Defense in depth is warranted because the utility may be reused outside the HTTP route.

#### Acceptance

- No ffmpeg invocation passes through a shell.
- Invalid settings return 400 and are not persisted.
- Valid conversion behavior is unchanged when ffmpeg is present.
- The Docker/static builds compile when ffmpeg is absent.

### T6.2 — Validate web-import redirects and resolved addresses

**Purpose:** Close redirect-based SSRF and reduce DNS-based bypasses.

**Blocked by:** T4.4.<br>
**Unblocks:** T7.1.<br>
**Risk:** High for any full deployment exposed beyond localhost.<br>
**Primary files:** `apps/api/src/utils/ssrf-protection.ts`, web-import request utility/handlers, tests.

#### Work

1. Parse only HTTP and HTTPS URLs.
2. Reject embedded credentials.
3. Normalize hostname casing and trailing dots.
4. Resolve all A and AAAA addresses before connecting.
5. Reject private, loopback, link-local, multicast, unspecified, and metadata ranges for IPv4 and IPv6.
6. Handle IPv4-mapped IPv6 addresses.
7. Use a request mechanism that can bind validation to the resolved connection address where feasible.
8. Disable automatic redirects.
9. Follow at most a small fixed number, such as five.
10. Resolve and validate every redirect target.
11. Reject scheme downgrades or unexpected schemes according to policy.
12. Enforce connection, headers, body, and total timeouts.
13. Enforce a streamed response-size cap.
14. Validate response content type before expensive parsing where possible.
15. Log target host and rejection category, not full query strings containing tokens.

#### Test server cases

- public URL to public content;
- direct loopback URL;
- decimal/hex/octal IPv4 representations if the URL parser accepts them;
- IPv6 loopback;
- IPv4-mapped IPv6 loopback;
- public URL redirecting to loopback;
- redirect chain exceeding limit;
- DNS result with one public and one private address;
- slow headers;
- oversized body;
- unsupported protocol.

#### Why

Validating only the first URL is ineffective when the fetch client automatically follows an unchecked redirect.

Literal host checks also miss hostnames that resolve to private addresses.

#### Acceptance

- Every connected target has passed address validation.
- Redirects cannot reach a private target.
- Response bytes and time are bounded.
- Static/light behavior is unchanged because web import remains disabled there.

### T6.3 — Harden userscript and opener `postMessage` flow

**Purpose:** Prevent unrelated windows from injecting or receiving import payloads.

**Blocked by:** T4.5.<br>
**Unblocks:** T7.2.<br>
**Risk:** Medium.<br>
**Primary files:** `apps/web/public/userscript.js`, `apps/web/src/lib/web-import-handler.ts`, tests/docs.

#### Work

1. Generate a high-entropy nonce when opening the Character Architect window.
2. Include the expected Character Architect origin in the launch flow.
3. Send requests with an exact `targetOrigin` rather than `*`.
4. In the receiving window, verify `event.origin`.
5. Verify `event.source` equals the expected opener/window reference.
6. Verify the nonce on every request and response.
7. Accept only documented message types.
8. Validate payload structure and size before processing.
9. Remove the listener after success, cancellation, or timeout.
10. Provide a clear error when browser isolation rules prevent the flow.
11. Preserve the userscript's supported target sites without granting them a wildcard receiver.
12. Document that web import is unavailable in static/light if that remains the product policy.

#### Why

Origin/source/nonce validation forms one handshake.

Checking only message type allows another page with a window reference to spoof the protocol.

#### Acceptance

- Wildcard `targetOrigin` is absent from import data transfer.
- Wrong-origin, wrong-source, wrong-nonce, oversized, and unknown-type messages are rejected.
- The valid userscript flow still works in its supported deployment mode.
- Listeners do not accumulate across repeated attempts.

### T6.4 — Review local network exposure and trust proxy settings

**Purpose:** Keep personal Docker safe by default and make opt-in LAN use explicit.

**Blocked by:** T1.5, T6.1, T6.2.<br>
**Unblocks:** T7.1.<br>
**Risk:** Medium.<br>
**Primary files:** `docker-compose.yml`, API config/docs, Nginx config.

#### Work

1. Keep the default web port bound to `127.0.0.1`.
2. Keep the API unexposed as a host port by default.
3. Verify Nginx forwards the intended client IP headers.
4. Verify `TRUST_PROXY=1` matches exactly one trusted proxy hop in Compose.
5. Verify rate limiting keys on the actual client identity and cannot be spoofed through arbitrary forwarded headers.
6. Document the security implications of changing the bind address to `0.0.0.0`.
7. Require explicit CORS origins for non-local access.
8. Recommend an authenticated reverse proxy or private network for LAN exposure.
9. Do not add a default password that users may leave unchanged.

#### Why

The application has powerful import, file, LLM, and optional local-service integrations.

Localhost-only is a good default for a personal tool with no built-in authentication.

#### Acceptance

- A default Compose start exposes only the web port on loopback.
- Spoofed forwarded headers do not bypass per-client rate limiting.
- LAN instructions contain an explicit authentication warning.

---

## 15. Milestone 7 — Validate and release

### T7.1 — Produce the full-mode maintenance release candidate

**Purpose:** Validate Docker and server-backed behavior before any push to production branches.

**Blocked by:** T1.5, T1.6, T3.5, T3.6, T4.4, T5.2, T5.3, T5.7, T6.1, T6.2, T6.4.<br>
**Unblocks:** T7.2, T7.3.<br>
**Risk:** High.<br>
**Primary files:** no new architecture; release notes and test evidence.

#### Clean-room build

1. Create a clean worktree or clone at the candidate commit.
2. Use Node 24 and pnpm 11.24.0.
3. Install with the frozen lockfile.
4. Run type checking and linting.
5. Run all unit and integration tests with required fixtures.
6. Build all workspace packages.
7. Build full, light, and static web artifacts.
8. Build both Docker targets.
9. Run Compose with empty temporary data/storage directories.
10. Complete the full-mode smoke workflow.

#### Upgrade test with copied synthetic state

1. Start the previous Docker image with synthetic state.
2. Stop it cleanly.
3. Copy the synthetic bind-mounted directories as a rollback snapshot.
4. Start the candidate images against the original synthetic directories.
5. Verify migrations, cards, images, versions, assets, presets, and settings.
6. Create a streamed backup.
7. Validate it.
8. Test merge restoration into another candidate instance.
9. Test replace restoration into another candidate instance.
10. Roll the test stack back to the old image and copied state to prove the rollback instructions.

#### User workflows

- create a CCv2 and CCv3 card;
- edit and reload each card;
- import JSON, PNG, CHARX, and Voxta fixtures;
- export those formats;
- preserve alternate greetings;
- preserve main and auxiliary assets;
- create a version/snapshot;
- use templates and presets;
- verify optional modules reflect capabilities;
- create and restore a full backup;
- restart containers and verify persistence.

#### Why

The release changes the toolchain, container build, dependencies, and destructive restore path.

A clean-room test catches hidden local state, while an upgrade test protects the actual personal-use scenario.

#### Acceptance

- Every clean-room step passes.
- The candidate works with empty and existing synthetic state.
- Rollback instructions are proven.
- No personal production data is used for destructive testing.
- Remaining advisories and deferred work are documented.

### T7.2 — Validate and deploy the static Cloudflare candidate

**Purpose:** Preserve browser-only behavior after shared and dependency changes.

**Blocked by:** T4.4, T4.5, T5.3, T5.4, T6.3, T7.1.<br>
**Unblocks:** T7.3.<br>
**Risk:** High because a static redeploy reaches existing browser-local users and PWA caches.

#### Work

1. Build with explicit static mode.
2. Verify no server environment variable or secret is embedded in output.
3. Run the static Playwright smoke suite.
4. Seed IndexedDB and localStorage under the prior deployed build.
5. Deploy the candidate to the dev Worker.
6. Reload an existing-profile browser into the new version.
7. Verify data persists.
8. Verify service-worker update completes.
9. Verify editor, client imports, client exports, local backup, and local restore.
10. Verify server modules remain hidden.
11. Verify no API startup request occurs.
12. Verify direct nested-route navigation.
13. Verify the public userscript behavior according to its supported mode.
14. Promote the exact tested commit/artifact to production.
15. Monitor initial production requests and client-visible errors if telemetry exists.

#### Why

Cloudflare persistence lives in the user's browser, not in the deployed static artifact.

The major risks are mode leakage, service-worker staleness, and accidental IndexedDB incompatibility.

#### Acceptance

- Existing browser-local data survives the deployment.
- Static mode makes no server call at startup.
- Local backup/restore passes the lossless tests.
- SPA routes and PWA update work.
- Production receives the same tested source/artifact.

### T7.3 — Update GitHub and hand off operations

**Purpose:** Leave code, issues, and operational instructions aligned.

**Blocked by:** T7.1, T7.2.<br>
**Unblocks:** Normal maintenance.<br>
**Risk:** Low.<br>
**Primary files:** README/deployment docs, release notes, GitHub issues.

#### Work

1. Document Node 24 and pnpm 11.24.0 setup.
2. Document Docker build and startup.
3. Document bind-mounted data and storage locations.
4. Document backup creation and safe restore modes.
5. Document full-to-browser conversion and its server-feature limitation.
6. Document static/Cloudflare deployment command and explicit mode.
7. Document default localhost-only exposure.
8. Document ffmpeg behavior in the default full-spec image.
9. Document recovery-directory handling if a server restore reports recovery-required.
10. Summarize dependency groups updated and deferred.
11. Update GitHub issues with test evidence.
12. Close only independently verified resolved issues.
13. Push commits only after reviewing the final diff and CI state.
14. Tag or release according to the repository's existing convention.

#### Why

Maintenance is not complete if the next start depends on remembering undocumented tool versions or restore caveats.

Issue updates should reflect observed behavior rather than optimistic implementation status.

#### Acceptance

- A new checkout can follow the docs without package-manager guesswork.
- Docker and Cloudflare instructions name their deployment modes.
- Issues link to tests or commits.
- Deferred issues retain clear rationale.

---

## 16. GitHub issue disposition

### Issue #8 — Alternative first messages

**Disposition:** Verify during fixture repair; likely close narrowly if the current Character Foundry mapping passes.

The present integration appears to support `AlternativeFirstMessages` and `alternate_greetings`.

The missing confidence comes from skipped or unavailable fixtures.

Do not change format code until the fixture executes.

Close only when:

- import mapping passes;
- export mapping passes;
- a round trip preserves ordering and content;
- both API and browser integration paths pass where applicable.

If the package fails, move the fix to Character Foundry and reference the published release in the application issue.

### Issue #9 — Shared asset mapping

**Disposition:** Keep open or track in Character Foundry; not a maintenance blocker.

This is shared core behavior.

The application should consume the eventual package release rather than fork the mapping locally.

The backup work may reuse existing archive preflight helpers but does not justify changing character-format mapping.

### Issue #24 — Wishlist feature

**Disposition:** Defer.

It does not affect Docker startup, data safety, supported format behavior, or current deployment health.

### Issue #33 — Manual UI framework workaround

**Disposition:** Defer unless dependency upgrades prove it is still necessary.

Re-test after the controlled frontend/tooling updates.

Do not preserve a workaround solely because the issue is old.

### Issue #34 — SillyTavern push

**Disposition:** Explicitly defer at the user's request.

The static configuration currently describes client-side SillyTavern push capability separately from the default module visibility.

Do not alter that product decision in this maintenance cycle.

### Pull request #29

**Disposition:** Re-evaluate against current code; likely close as stale if its change is superseded or no longer applies.

Do not merge stale code merely to clear the queue.

Record the current equivalent behavior or the reason it is no longer desired.

### New tracking items from the audit

Create or retain separate tracking items for:

1. Docker build context and Node/pnpm repair;
2. lossless replace-mode backup restore;
3. server streaming backup/restore;
4. truthful fixture/CI execution;
5. ffmpeg command injection;
6. redirect/DNS-aware SSRF protection;
7. userscript `postMessage` hardening;
8. dependency batches and advisory remediation;
9. full-to-browser backup conversion (implemented in this maintenance release);
10. optional authenticated LAN deployment profile.

The first eight belong to the maintenance program.

The authenticated LAN profile remains follow-up product/operations work. Full-to-browser conversion was pulled into this release after the existing archive proved to contain enough data for a deterministic conversion.

---

## 17. Test matrix

### 17.1 Required checks by change area

| Change area | Unit | Integration | Static build | Light build | Full build | Docker | Cloudflare dev |
|---|---:|---:|---:|---:|---:|---:|---:|
| Node/pnpm config | — | clean install | Yes | Yes | Yes | Yes | Dry run |
| Dockerignore | — | context inspection | — | — | — | Yes | — |
| Dockerfile | native import | Compose | — | — | Yes | Yes | — |
| backup-core | Yes | fixture parity | Yes | Yes | Yes | Yes | — |
| browser restore | Yes | fake IndexedDB | Yes | Yes | Compile | — | Dev smoke |
| server restore | Yes | DB/filesystem | Compile | Compile | Yes | Yes | — |
| streaming backup | stream helper | HTTP/cancel | — | — | Yes | Yes | — |
| Character Foundry update | format tests | round trips | Yes | Yes | Yes | Yes | Dev smoke |
| Wrangler update | config | dry run | Yes | Yes | Compile | — | Yes |
| ffmpeg security | Yes | optional conversion | Compile | Compile | Yes | Optional target | — |
| SSRF protection | Yes | local test server | Compile | Compile | Yes | Yes | — |
| postMessage hardening | Yes | browser flow | Yes | Yes | Yes | Optional | Dev smoke |

### 17.2 Format fixtures

The format regression suite must include:

- CCv2 JSON import and export;
- CCv3 JSON import and export;
- PNG embedded-card import and export;
- CHARX import and export;
- Voxta import and export;
- lorebook entries;
- alternate greetings;
- creator notes and extensions;
- primary icon selection;
- auxiliary asset identity and order;
- missing optional fields;
- Unicode text;
- semantic round trip across at least two different formats.

Binary output need not be byte-identical when ZIP timestamps or image metadata differ.

Semantic assertions must compare the normalized character and asset graph.

### 17.3 Backup invariants

Every backup test should assert these invariants where applicable:

- validation precedes mutation;
- every limit is enforced before or during output allocation;
- paths stay below the staging root;
- counts match payloads;
- identifiers are unique;
- relationships resolve;
- strict conflict mode writes nothing;
- replace failure preserves old data;
- replace success removes old data;
- rollback directories are removed only after commit;
- recovery-required directories are retained;
- result counts equal committed records;
- legacy accepted input normalizes deterministically;
- unsupported cross-mode input is rejected before mutation.

### 17.4 Browser smoke workflow

1. Load the static artifact.
2. Confirm the selected mode is static.
3. Confirm no server-only module is visible.
4. Create a character.
5. Add an alternate greeting.
6. Add a browser-stored image/asset.
7. Reload and confirm persistence.
8. Export a browser backup.
9. Validate and preview it.
10. Modify the library.
11. Restore in merge mode.
12. Restore in replace mode after seeding a disposable sentinel.
13. Reload and verify the replacement.
14. Attempt a malformed backup and verify no change.
15. Attempt a full backup and verify compatibility rejection.

### 17.5 Docker smoke workflow

1. Build API and web targets from the populated checkout.
2. Confirm source-only context size.
3. Start Compose with task-specific temporary bind directories.
4. Wait for health.
5. Load the frontend through Nginx.
6. Confirm explicit full mode.
7. Import a small format fixture.
8. Add an asset.
9. Create a version.
10. Create a streamed backup.
11. Validate the backup.
12. Restart containers and verify persistence.
13. Restore into a separate disposable stack.
14. Attempt a malformed replacement and verify sentinels.
15. Tear down only the task-specific stack and directories.

---

## 18. Operational limits and configuration

### 18.1 Limit principles

Limits must be configurable on the server and fixed/documented in the browser.

The plan intentionally does not invent final numeric values without measuring representative backups.

Implementation should begin with the application's current upload limits as an upper bound, then measure:

- ordinary browser backup size;
- ordinary full backup metadata size;
- largest individual stored asset intended for backup;
- total personal full-library size;
- peak browser memory during restore;
- peak API memory during streamed backup and restore.

Select numbers from those measurements with documented headroom.

### 18.2 Required server settings

Use the existing configuration pattern to add names equivalent to:

- backup compressed upload maximum;
- backup total uncompressed maximum;
- backup individual entry maximum;
- backup JSON entry maximum;
- backup entry-count maximum;
- backup compression-ratio maximum;
- restore temporary directory;
- restore stale-temporary age;
- backup/restore operation timeout where appropriate.

Reject invalid environment values at startup.

Log effective limits once without exposing secrets.

### 18.3 Disk-space handling

Before staging a full restore, estimate required free space from validated uncompressed sizes.

Account for:

- compressed upload file;
- staged new storage;
- retained old storage during commit;
- SQLite WAL/journal growth;
- a safety margin.

If reliable free-space information is unavailable, continue only with conservative checks and a clear disk-full error path.

A disk-full error before commit must leave live data untouched.

### 18.4 Temporary-file ownership

Temporary restore paths must:

- be created under an application-owned root;
- use unpredictable unique names;
- not follow symlinks;
- have restrictive permissions;
- be on the same filesystem as live storage for the final staged tree;
- carry an explicit marker distinguishing disposable staging from retained recovery data.

Startup cleanup may remove only disposable staging older than the configured age.

It must never remove a recovery-marked directory automatically.

---

## 19. Observability and error behavior

### 19.1 Operation identifiers

Assign a unique operation identifier to each backup and restore.

Include it in:

- server logs;
- validation failure logs;
- commit/rollback logs;
- recovery-required client responses;
- final success logs.

Do not include private character data in the identifier or log context.

### 19.2 Restore state machine

Log transitions equivalent to:

```text
received
-> uploading
-> uploaded
-> inspecting
-> validated
-> staging
-> ready-to-commit
-> committing-files
-> committing-database
-> verifying
-> complete
```

Failure transitions include:

```text
validation-failed
upload-aborted
staging-failed
commit-failed
rollback-complete
recovery-required
```

The state machine is for logs and tests, not a reason to create a distributed workflow engine.

### 19.3 Client errors

Client-visible errors should be stable and actionable.

Examples include:

- backup is not a ZIP;
- manifest is missing;
- backup version is unsupported;
- backup exceeds this deployment's size limit;
- backup contains an unsafe path;
- backup contains inconsistent records;
- backup is valid but cannot be restored into browser mode;
- merge conflicts were found and strict mode made no changes;
- restore failed and existing data was preserved;
- server recovery is required; stop retrying and inspect logs.

Do not send stack traces, SQL, or host filesystem paths to the browser.

### 19.4 Success metrics

Log or return:

- compressed bytes received/sent;
- total validated uncompressed bytes;
- entry count;
- logical record counts;
- skipped conflict counts;
- elapsed time by coarse phase;
- final success/failure category.

Do not add a telemetry vendor as part of this plan.

Local structured logs are sufficient for personal Docker operation.

---

## 20. Rollback strategy

### 20.1 Code and image rollback

Keep the previous known-good commit and Docker image IDs/tags until the candidate passes upgrade tests.

Rolling back code must not automatically roll back database migrations unless the migration is proven reversible.

Prefer additive schema migrations during this maintenance cycle.

### 20.2 Data rollback

Before testing the candidate against important state:

1. stop the old API cleanly;
2. copy the SQLite database, WAL/SHM sidecars if present, and storage directory;
3. verify the copy exists and has expected size/count;
4. start the candidate;
5. retain the copy until after a successful backup-and-restore drill.

Do not use the newly changed backup code as the only rollback copy for its own first deployment.

### 20.3 Cloudflare rollback

Record the prior successful deployment version.

If the static candidate fails:

- roll back the Worker/static asset version through the supported Wrangler/Cloudflare mechanism;
- do not clear users' IndexedDB;
- investigate service-worker caching separately from deployed asset rollback;
- preserve the failing build artifact for comparison.

### 20.4 Dependency rollback

Because dependency groups land separately, revert the affected group commit and regenerate no unrelated lockfile changes.

Do not edit the lockfile by hand.

Run a frozen install after the revert.

---

## 21. Documentation deliverables

The maintenance release should leave concise operational documentation for:

1. supported Node and pnpm versions;
2. clean install;
3. local full development;
4. Docker build and startup;
5. Docker data locations;
6. localhost versus LAN exposure;
7. Cloudflare static build and deploy;
8. deployment mode feature matrix;
9. browser backup/restore;
10. server backup/restore;
11. merge versus replace semantics;
12. backup compatibility directions;
13. restore limits;
14. recovery-required server procedure;
15. default full-container ffmpeg capability and native capability detection;
16. fixture generation;
17. dependency update policy;
18. Character Foundry package boundary.

Do not duplicate the same commands in multiple documents unless one is generated from the other.

Prefer one deployment section in the README that links to detailed Docker and Cloudflare guides if those guides already exist.

---

## 22. Implementation sequence

### Batch A — Docker works again

Implement:

- T0.1;
- T0.2;
- T1.1;
- T1.2;
- T1.8;
- T1.3;
- T1.4;
- T1.5.

Exit criteria:

- clean frozen install on Node 24/pnpm 11.24.0;
- small Docker context from populated checkout;
- both Docker targets build;
- Compose starts healthy;
- cards, assets, settings, presets, and theme storage survive restart.

This is the first recommended implementation batch.

### Batch B — Replace mode cannot lose good data

Implement:

- T2.1;
- T2.2;
- T2.3;
- T2.4;
- T3.1;
- T3.2;
- T3.3;
- T3.5;
- T3.6.

T3.4 may land in the same batch or immediately after the atomic commit, but the server release is not considered full-spec for the current large library until streaming backup creation is complete.

Exit criteria:

- invalid replace changes nothing in IndexedDB, SQLite, or storage;
- injected failure changes nothing or retains an explicit recovery state;
- success replaces exactly;
- legacy supported backups remain accepted;
- browser-to-full remains accepted;
- full-to-browser conversion is validated and transactional.

### Batch C — CI tells the truth

Implement:

- T4.1;
- T4.2;
- T4.3;
- T4.4;
- T4.5;
- T1.6.

Exit criteria:

- required fixture suites execute;
- type check and lint pass;
- all deployment modes build;
- static and Docker smoke jobs run at the correct events;
- Docker no longer depends on deploy.

### Batch D — Safe dependency refresh

Implement:

- T5.1;
- T5.2;
- T5.3;
- T5.4;
- T5.7.

Evaluate but do not automatically implement:

- T5.5;
- T5.6.

Exit criteria:

- compatible updates land in isolated groups;
- Character Foundry behavior remains fixture-proven;
- Wrangler dev deploy passes;
- no unexplained critical advisory remains.

### Batch E — Application security cleanup

Implement:

- T6.1;
- T6.2;
- T6.3;
- T6.4;
- T1.7 capability behavior.

Exit criteria:

- ffmpeg never uses a shell;
- redirect/DNS SSRF cases fail;
- userscript messages verify origin/source/nonce;
- localhost-only default remains intact.

### Batch F — Release and issue cleanup

Implement:

- T7.1;
- T7.2;
- T7.3.

Exit criteria:

- clean-room and upgrade candidates pass;
- Docker full deployment is usable;
- Cloudflare static deployment is usable;
- rollback is proven;
- issues reflect evidence.

---

## 23. Definition of done by milestone

### Milestone 1 done

- [ ] Node 24 is canonical.
- [ ] pnpm 11.24.0 is pinned.
- [ ] Root scripts use pnpm.
- [ ] pnpm workspace settings are in supported configuration.
- [ ] Docker context excludes nested runtime state.
- [ ] API image builds.
- [ ] Web image builds in explicit full mode.
- [ ] Mutable file paths use configured data/storage roots.
- [ ] Source defaults are separated from runtime settings.
- [ ] Existing local settings are preserved through migration.
- [ ] Compose becomes healthy.
- [ ] Cards, assets, settings, presets, and themes persist across restart.
- [ ] Localhost-only binding remains default.

### Milestone 2 done

- [ ] Legacy and current backup fixtures exist.
- [ ] backup-core is browser-safe.
- [ ] Manifest and payload schemas are strict.
- [ ] Path and ZIP limits are enforced.
- [ ] Source mode is detected deterministically.
- [ ] Preview and result types are shared.
- [ ] Unsupported compatibility is explicit.

### Milestone 3 done

- [ ] Browser replace uses one IndexedDB transaction.
- [ ] Browser merge has explicit conflict semantics.
- [ ] Server upload is staged and bounded.
- [ ] Server storage is staged on the live filesystem.
- [ ] Server database replacement uses one transaction.
- [ ] Filesystem rollback is implemented.
- [ ] Recovery-required state is retained.
- [ ] Server backup output is streamed.
- [ ] Failure-injection tests pass.
- [ ] Restore UI is accurate and accessible.

### Milestone 4 done

- [ ] Missing required fixtures fail.
- [ ] Root type check passes.
- [ ] Root lint passes on authored source.
- [ ] API tests pass.
- [ ] Web tests pass.
- [ ] Shared-package tests pass.
- [ ] Full build passes.
- [ ] Light build passes.
- [ ] Static build passes.
- [ ] Static startup makes no API request.
- [ ] Docker builds run on pull requests.
- [ ] Deploy requires quality success.

### Milestone 5 done

- [ ] Dependency ledger is complete.
- [ ] Low-risk updates are grouped.
- [ ] Character Foundry versions are verified and tested.
- [ ] Wrangler dev deployment passes.
- [ ] Framework majors are justified or deferred.
- [ ] Native/storage majors are justified or deferred.
- [ ] Critical advisories are resolved or narrowly isolated.

### Milestone 6 done

- [ ] Optimizer settings have runtime validation.
- [ ] ffmpeg calls are argument-based.
- [ ] SSRF checks every redirect and resolved address.
- [ ] Web-import responses are bounded.
- [ ] `postMessage` validates origin/source/nonce.
- [ ] Proxy trust and rate limiting are verified.

### Milestone 7 done

- [ ] Clean-room candidate passes.
- [ ] Existing-state upgrade test passes.
- [ ] Data rollback copy is proven.
- [ ] Full user workflows pass.
- [ ] Static existing-profile test passes.
- [ ] Cloudflare dev then production passes.
- [ ] Documentation is current.
- [ ] GitHub issue states are evidence-based.

---

## 24. Review record

This plan was reviewed in five explicit rounds.

### Review round 1 — Repository and ownership accuracy

Questions:

- Are the named files and deployment paths real?
- Does the plan preserve the dirty working tree?
- Does it keep application fixes separate from Character Foundry package fixes?
- Does it accidentally assume one persistence backend?

Revisions integrated:

- made full, light, and static first-class contracts;
- separated shared backup validation from persistence-specific commits;
- named existing dirty files that must be preserved;
- added T1.8 after verifying that mutable settings/preset/theme paths do not point at Docker's mounted data/storage roots;
- required source defaults to move out of the mixed tracked/runtime `apps/api/data` path before broad ignores are applied;
- kept Character Foundry format changes outside the first batches;
- added explicit browser-to-full and full-to-browser compatibility decisions.

### Review round 2 — Data-loss and recovery analysis

Questions:

- Can validation or staging mutate live data?
- Does a database transaction cover filesystem assets?
- What happens if rollback itself fails?
- What happens in IndexedDB and localStorage separately?
- Can two restores overlap?

Revisions integrated:

- required two-phase inspect/commit behavior;
- required one IndexedDB transaction for clear plus import;
- required same-filesystem staging and rollback for storage, themes, and mutable settings/preset paths;
- defined the user-owned state that a full backup must actually contain;
- retained recovery directories on rollback failure;
- added a restore mutex and documented the single-process assumption;
- separated localStorage warnings from durable card transaction success;
- added failure-injection scenarios at early and late commit points.

### Review round 3 — Scale and deployment-mode analysis

Questions:

- Does an atomic server restore still exhaust memory?
- Does shared code pull Node dependencies into static builds?
- Does Node selection affect Cloudflare runtime semantics?
- Does the plan test the actual PWA upgrade path?

Revisions integrated:

- replaced complete server buffering with staged uploads and streamed ZIP processing;
- required backup-core to contain no I/O or Node imports;
- kept bounded buffer behavior only in the browser path;
- explained Node 24 as build tooling for Cloudflare static output;
- kept Wrangler compatibility-date changes separate;
- added existing-profile PWA validation;
- added explicit light-mode compilation.

### Review round 4 — Dependency graph and operational rollout

Questions:

- Can each task start with its stated blockers satisfied?
- Are there cycles?
- Are major dependency migrations blocking urgent fixes unnecessarily?
- Can a failed release be rolled back without trusting the new backup code?
- Are GitHub issue dispositions tied to evidence?

Revisions integrated:

- placed Docker repair before broad dependency updates;
- placed backup fixtures before restore implementation;
- placed quality gates before framework-major decisions;
- made frontend and backend majors optional, separate evaluations;
- required an out-of-band filesystem/database copy for first upgrade rollback;
- made Docker CI independent of Cloudflare deployment;
- tied issue #8 closure to executed fixtures;
- explicitly deferred issues #24, #33, and #34.

### Review round 5 — Self-containment and steady state

Questions:

- Does every task reference an existing task identifier?
- Is the dependency graph acyclic?
- Can the least obvious task be implemented without recovering audit context from chat?
- Are load-bearing tool/platform decisions grounded in current primary documentation?
- Did the last pass require another architectural change?

Checks and revisions:

- verified all 39 task headings are unique;
- verified every `Tn.n` reference resolves to a task heading;
- topologically sorted every `Blocked by` edge without a cycle;
- reviewed T1.8 and T3.3 as standalone handoffs and retained their explicit migration, rollback, and acceptance details;
- added current official Node, pnpm, Cloudflare, and fflate references;
- added the table of contents and minor wording corrections without changing the stable architecture.

### Steady-state result

The fifth review produced navigation, source-grounding, and wording refinements rather than a new architecture.

The plan's stable architecture is:

- Node 24 and pinned pnpm 11;
- explicit build modes;
- small Docker context;
- shared pure backup validation;
- transactional browser commits;
- staged transactional server commits;
- streamed large server archives;
- controlled dependency groups;
- separate Character Foundry package ownership.

---

## 25. Tracker conversion status

The repository's beads database cannot currently accept this dependency graph safely.

At planning time:

- the database reports a schema gap from version 32 to version 53;
- the project is configured for a remote-backed Dolt database;
- automatic migration is refused because a designated migrator or bootstrap is required;
- ordinary listing fails because an expected dependency column is absent;
- `.beads/issues.jsonl` is already deleted in the user's working tree.

Therefore this plan has not been converted into beads.

That is intentional preservation, not an invitation to rewrite or bootstrap the tracker automatically.

Before conversion:

1. decide which machine/repository clone is the designated remote-backed beads migrator;
2. back up the current beads/Dolt state;
3. migrate or bootstrap using the tracker tool's supported procedure;
4. verify existing issues and dependency edges;
5. convert each `Tn.n` task into one issue with the `Blocked by` and `Unblocks` edges intact;
6. compare the resulting ready queue with the batch order in section 22.

Until then, this Markdown file is the canonical implementation graph.

Do not recreate `.beads/issues.jsonl` or migrate `.beads` as a side effect of Docker or backup implementation.

---

## 26. First implementation handoff

The first implementation session should take Batch A only.

Start with T0.1 and T0.2.

Then make these commits in order:

1. pin Node 24 and pnpm 11.24.0;
2. normalize pnpm configuration and root scripts;
3. normalize mutable settings/preset/theme paths and default seeding;
4. fix `.dockerignore` for nested runtime state;
5. repair the Node 24 multi-stage Dockerfile;
6. add/run the Compose health and persistence smoke test.

Do not update the broad dependency set in that session.

Do not change backup behavior in the Docker commit.

Do not touch Character Foundry source.

Do not touch the existing untracked/deleted user files.

The session is complete only when:

- both Docker targets build from the populated checkout;
- the context no longer contains runtime state;
- Compose is healthy at `127.0.0.1:8765`;
- a synthetic card, asset, setting, preset, and theme upload survive container recreation;
- the final working tree diff contains only intended Batch A files.

After Batch A is reviewed, proceed to Batch B's fixture-first backup work.

---

## 27. Grounding references

These references were checked while making the load-bearing tool and platform decisions in this plan.

### Node

- Node.js release status and LTS guidance: <https://nodejs.org/en/about/previous-releases>

At planning time Node 24 is LTS, Node 26 is Current, and Node 20 is end-of-life.

Production applications are directed to use an Active or Maintenance LTS line.

### pnpm

- pnpm installation and Node compatibility: <https://pnpm.io/installation>
- pnpm workspace settings: <https://pnpm.io/settings>
- pnpm package manifest settings: <https://pnpm.io/package_json>

At planning time pnpm's official documentation states that the normal pnpm installation requires at least Node 22, that Node 24 supports pnpm 11, and that pnpm 12 only became stable on August 26, 2026.

The official settings reference also states that non-authentication settings such as `shamefullyHoist` belong in `pnpm-workspace.yaml`, while `.npmrc` is for authentication and registry settings.

### Cloudflare

- Install and update Wrangler: <https://developers.cloudflare.com/workers/wrangler/install-and-update/>
- Wrangler v3 to v4 migration: <https://developers.cloudflare.com/workers/wrangler/migration/update-v3-to-v4/>
- Wrangler static-assets configuration: <https://developers.cloudflare.com/workers/wrangler/configuration/>

Cloudflare documents Wrangler as a Node-based project CLI while Worker code executes in `workerd`.

That distinction supports using Node 24 for the build without treating the static deployment as a Node server.

The Wrangler v4 migration changes bundling and removes deprecated behavior, so it remains a separate dependency task even though the current project already uses Workers Static Assets.

### ZIP streaming

- fflate project documentation and streaming examples: <https://github.com/101arrowz/fflate>

The currently installed fflate documentation exposes streaming `Zip`, `AsyncZipDeflate`, `Unzip`, and `AsyncUnzipInflate` APIs.

The implementation must still prove backpressure, cancellation, limits, and file-descriptor cleanup in this application; the library capability alone is not an acceptance test.
