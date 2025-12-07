# Repository Guidelines

## Project Structure & Module Organization
- Monorepo via npm workspaces: `apps/api` (Fastify backend), `apps/web` (React + Vite UI), local packages in `packages/*` (`defaults`, `plugins`, `utils`).
- External `@character-foundry/*` packages from GitHub Packages registry (`schemas`, `core`, `png`, `charx`, `voxta`, `tokenizers`, `loader`, `federation`).
- Reference docs live in `docs/`; sample cards and assets in `testing/`; Docker assets in `docker/` with the root `docker-compose.yml` for local stack.

## Build, Test, and Development Commands
- Requires `GITHUB_TOKEN` env var with `read:packages` scope for `@character-foundry/*` packages.
- Install once at root: `npm install` (Node >=20, npm >=10).
- Run dev servers: `npm run dev` for both; or `npm run dev:api` / `npm run dev:web`. Use `npm run dev:fresh` after dependency/schema edits to rebuild packages first.
- Build: `npm run build` (packages then apps); scope builds with `npm run build:api` or `npm run build:web`.
- Quality: `npm run lint`, `npm run type-check`, `npm run test` (workspace tests; Vitest lives in `apps/api`).

## Coding Style & Naming Conventions
- TypeScript + ESM; prefer 2-space indent, single quotes, and named exports.
- ESLint configured in `eslint.config.js` (typescript-eslint recommended). Fix lint before PRs.
- React: components `PascalCase` in `apps/web/src`, hooks start with `use`, stores live in `apps/web/src/store`. Packages use `kebab-case` folders.

## Testing Guidelines
- Tests currently in `apps/api/src/__tests__` using Vitest; name files `*.test.ts` and keep close to the code they cover.
- Focus coverage on schema validation, file/asset handling, and API routes. Add fixtures under `apps/api/src/__tests__/__fixtures__` when needed.
- Run `npm run test` for all, or `npm run test --workspace @card-architect/api` while iterating.

## Commit & Pull Request Guidelines
- Follow the commit style used here (`feat:`, `fix:`, `chore:`, `debug:` + short scope), e.g., `feat: add CHARX checksum guard`.
- PRs should state what changed, how you tested (`npm run test`, `npm run lint`, etc.), link issues, and include UI screenshots or clips when visuals shift.
- Keep PRs small and call out migrations or env changes in the description.

## Security & Configuration Tips
- API reads `.env` from `apps/api` (see `.env.example`); set `DATABASE_PATH` and `STORAGE_PATH` to writable locations before starting.
- Treat `testing/` assets as samples only; avoid storing real user data.
