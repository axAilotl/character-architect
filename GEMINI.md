# Card Architect (Project Context)

## Project Overview
Card Architect (also referred to as Card Doctor) is a modern, self-hostable character card editor and format converter for AI roleplay platforms. It supports **CCv2**, **CCv3**, **CHARX**, and **Voxta** formats. It features a monorepo structure containing a Fastify backend and a React frontend.

## Architecture & File Structure
The project is a **monorepo** managed with npm workspaces.

### Core Directories
- **`apps/api/`**: Fastify backend (Node.js 20+).
  - `src/routes/`: API route definitions.
  - `src/db/`: SQLite database interaction.
  - `data/`: Local database storage (`cards.db`).
  - `storage/`: Asset storage.
- **`apps/web/`**: React frontend (Vite + Tailwind).
  - `src/components/`: UI components.
  - `src/features/`: Feature-specific logic (e.g., `editor`, `wwwyzzerdd`).
  - `src/store/`: State management (Zustand).
- **`packages/`**: Shared libraries.
  - `schemas/`: Zod schemas and TypeScript types (CRITICAL for validation).
  - `charx/`: Handling for CHARX (ZIP) format.
  - `png/`: PNG tEXt/zTXt chunk manipulation.
  - `utils/`: Binary, ZIP, and URI utilities.
  - `voxta/`: Voxta format handling.
- **`testing/`**: Test assets (cards from various platforms like Chub, Wyvern).
- **`docs/`**: Documentation, including `CLAUDE.md` (high-value context).

## Technology Stack
- **Language**: TypeScript (Strict mode).
- **Backend**: Fastify, SQLite (`better-sqlite3`), Ajv (validation), Sharp (images).
- **Frontend**: React 18, Vite, Tailwind CSS, Zustand, IndexedDB.
- **AI/LLM**: OpenAI/Anthropic integration, RAG via FastEmbed.
- **Testing**: Vitest (inferred from `vitest.config.ts` in api).

## Development Workflow

### Commands
| Action | Command | Notes |
| :--- | :--- | :--- |
| **Start Dev** | `npm run dev` | Starts API (:3456) and Web (:5173) concurrently. |
| **Build All** | `npm run build` | Builds all workspaces. |
| **Build API** | `npm run build:api` | Builds only the backend. |
| **Build Web** | `npm run build:web` | Builds only the frontend. |
| **Lint** | `npm run lint` | Runs ESLint. |
| **Type Check** | `npm run type-check` | Runs `tsc --noEmit`. |
| **Clean** | `npm run clean` | Removes `node_modules` and `dist`. |

### Key Conventions
- **Types**: strictly defined in `@card-architect/schemas`. **ALWAYS** check schemas when modifying data structures.
- **Validation**: Uses Zod schemas for runtime validation.
- **Imports**: Use workspace imports (e.g., `@card-architect/utils`) where applicable.
- **Formatting**: Prettier is configured.
- **Environment**: `apps/api/.env` configures the backend (Port, DB Path).

## Domain Context (Character Formats)
- **CCv2**: standard `chara_card_v2` JSON.
- **CCv3**: `chara_card_v3` with embedded assets and richer metadata.
- **CHARX**: ZIP archive containing CCv3 data + raw assets.
- **Voxta**: `.voxpkg` format for Voxta AI.
- **Import Normalization**: The API handles normalizing various platform idiosyncrasies (Wyvern duplication, Chub hybrids) in `apps/api/src/routes/import-export.ts`.

## Important Files
- `apps/api/src/app.ts`: Backend entry point.
- `apps/web/src/App.tsx`: Frontend root.
- `packages/schemas/src/index.ts`: Central type definitions.
- `docs/CLAUDE.md`: Detailed technical reference for formats and extensions.
