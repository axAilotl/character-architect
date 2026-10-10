# Repository Guidelines

## Project Structure & Module Organization
- Monorepo via pnpm workspaces: `apps/api` (Fastify backend), `apps/web` (React + Vite UI), and local packages in `packages/*` (`defaults`, `plugins`, `import-core`).
- Character Foundry functionality comes from the stable `@character-foundry/character-foundry` aggregate package. Use its `/zip` export for ZIP helpers and `/integrations` for direct connection and favorite helpers.
- **Defaults package** (`@card-architect/defaults`): Single source of truth for templates, snippets, presets, and wwwyzzerdd prompts. All shared JSON data lives in `packages/defaults/assets/`.
- Reference docs live in `docs/`; synthetic shared fixtures live in `test-fixtures/`; Docker assets live in `docker/` with the root `docker-compose.yml` for the local stack.

## Deployment Modes
- **Full mode**: All features enabled, self-hosted with API backend
- **Light mode**: Minimal server, most features client-side (cheap VPS). Web Import disabled.
- **Static mode**: No server at all (Cloudflare Worker Static Assets, GitHub Pages). Web Import disabled.

## Build, Test, and Development Commands
- Requires `GITHUB_TOKEN` env var with `read:packages` scope for `@character-foundry/*` packages.
- Use Node 24 and pnpm 11.24.0, pinned by `.node-version` and the root `packageManager` field. Install at the root with `pnpm install --frozen-lockfile`.
- Run both dev servers with `pnpm dev`, or use `pnpm dev:api` / `pnpm dev:web`. Use `pnpm dev:fresh` after dependency/schema edits to rebuild packages first.
- Build with `pnpm build`; deployment-specific web builds are `pnpm build:web:full`, `pnpm build:web:light`, and `pnpm build:web:static`.
- Quality gates are `pnpm lint`, `pnpm type-check`, and `pnpm test`. Use `CF_FIXTURES_DIR="$PWD/test-fixtures"` for the complete shared fixture suite.

## Coding Style & Naming Conventions
- TypeScript + ESM; prefer 2-space indent, single quotes, and named exports.
- ESLint configured in `eslint.config.js` (typescript-eslint recommended). Fix lint before PRs.
- React: components `PascalCase` in `apps/web/src`, hooks start with `use`, stores live in `apps/web/src/store`. Packages use `kebab-case` folders.

## Testing Guidelines
- API tests live in `apps/api/src/__tests__`; browser and package tests stay close to their source. Name files `*.test.ts` or `*.test.tsx`.
- Focus coverage on schema validation, file/asset handling, and API routes. Put cross-workspace synthetic fixtures under `test-fixtures/`; narrowly scoped unit fixtures may live beside their tests.
- Run `pnpm test` for all workspaces, or `pnpm --filter @card-architect/api test` while iterating.

## Commit & Pull Request Guidelines
- Follow the commit style used here (`feat:`, `fix:`, `chore:`, `debug:` + short scope), e.g., `feat: add CHARX checksum guard`.
- PRs should state what changed, how you tested (`pnpm test`, `pnpm lint`, etc.), link issues, and include UI screenshots or clips when visuals shift.
- Keep commits and PRs cohesive; call out migrations or environment changes in the description.

## Security & Configuration Tips
- API reads `.env` from `apps/api` (see `.env.example`); set `DATABASE_PATH` and `STORAGE_PATH` to writable locations before starting.
- Treat `testing/` assets as samples only; avoid storing real user data.
