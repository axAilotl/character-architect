# Voxta Support Implementation Plan

## Executive Summary
This document outlines the plan to add native **Voxta Package (`.voxpkg`)** support to Card Architect. Voxta packages are multi-character, scenario-driven archives containing rich assets (animated avatars, voice samples) and scripting.

**Status:** ✅ Implementation Complete (2025-11-20)

The goal is to allow users to **import Voxta packages** as Character Cards (V3), preserving as much data as possible, particularly the high-quality asset libraries.

## Phase 1: Type Definitions & Schema (Completed)
**Goal**: Define the shape of Voxta data structures in our codebase.

1.  ✅ **Create `packages/schemas/src/voxta-types.ts`**:
    *   `VoxtaPackage` (root `package.json`)
    *   `VoxtaCharacter` (`character.json`)
    *   `VoxtaScenario` (`scenario.json`)
    *   `VoxtaBook` (`book.json`)
    *   `VoxtaTtsConfig` (Voice configuration)
2.  ✅ **Update `AssetType`**:
    *   Ensure `AssetTag` includes `emotion:*`, `state:*`, `variant:*` patterns.
    *   Ensure `AssetType` includes `sound`.

## Phase 2: Import Infrastructure (Completed)
**Goal**: Backend logic to parse `.voxpkg` files.

1.  ✅ **Create `apps/api/src/utils/voxta-handler.ts`**:
    *   **Purpose**: Counterpart to `charx-handler.ts`.
    *   **Logic**:
        *   Uses `yauzl` to unzip.
        *   Reads `package.json` to identify structure.
        *   Recursively walks `Characters/{uuid}/` folders.
        *   Returns structured object: `{ packageMeta: ..., characters: [{ json: ..., assets: [...] }], scenarios: [...], books: [...] }`.
2.  ✅ **Create `apps/api/src/services/voxta-import.service.ts`**:
    *   **Orchestrator**: Calls `voxta-handler.ts` to get raw data.
    *   **Card Creation**: Iterates through extracted characters.
        *   Transforms Voxta JSON to CCv3 JSON (mapping metadata, profile, etc.).
        *   Injects Voxta-specifics (TTS, Scripts) into `data.extensions.voxta`.
    *   **Asset Ingestion**:
        *   Uses `AssetGraphService` to process the assets found by the handler.
        *   Applies tags: `emotion:{e}`, `state:{s}`, `variant:{v}`.
    *   **Lorebooks**: Imports books and links them to the cards.

## Phase 4: Export Infrastructure (Completed)
**Goal**: Ability to write `.voxpkg` files, preserving structure and assets.

1.  ✅ **Create `apps/api/src/utils/voxta-builder.ts`**:
    *   **Purpose**: Counterpart to `charx-builder.ts`.
    *   **Logic**:
        *   Creates ZIP stream.
        *   **Assets**: Iterates card assets. Uses tags (`emotion`, `state`, `variant`) to reconstruct the path `Assets/Avatars/Default/{Emotion}_{State}_{Variant}.webp`.
        *   **Character**: Converts CCv3 data back to `character.json`. Retrieves preserved data from `data.extensions.voxta`.
        *   **Scenarios**: Writes `Scenarios/{id}/scenario.json`.
        *   **Package Meta**: Generates `package.json`.
2.  ✅ **Create Endpoint: `GET /api/cards/:id/export/voxta`**:
    *   Generates and streams the `.voxpkg` file.

## Phase 5: UI Integration & UI/UX (Completed)
**Goal**: Expose import/export and manage Voxta-specific fields without cluttering the main UI.

1.  ✅ **Create New Endpoint: `POST /api/import-voxta`**:
    *   **Why**: Voxta packages return *multiple* cards.
    *   **Input**: Multipart file upload (`.voxpkg`).
    *   **Output**: JSON array of created card objects.
2.  ✅ **Update Frontend**:
    *   Updated `api.ts` to include `importVoxtaPackage` and `exportVoxtaPackage`.
    *   Updated `Header.tsx` / `CardGrid.tsx` import menus to add "Import Voxta Package".
    *   **Voxta Mode**:
        *   Detects if a card originated from Voxta (check `extensions.voxta`).
        *   If true, shows a "Voxta" section in the editor for Appearance (Description).
        *   Displays specific "Voxta" badges on fields.
    *   **Export**: Added "Export as Voxta Package" to the export menu.

## Phase 6: Data Mapping Strategy (Implemented)

| Voxta Field | Card Architect Target | Notes |
| :--- | :--- | :--- |
| `Name` | `data.name` | Direct map |
| `Description` | `data.extensions.voxta.appearance` | Visual description |
| `Personality` | `data.personality` | Direct map |
| `Profile` | `data.description` | Character profile/backstory |
| `FirstMessage` | `data.first_mes` | Direct map |
| `MessageExamples` | `data.mes_example` | Direct map |
| `TextToSpeech` | `data.extensions.voxta.textToSpeech` | Preserved in metadata |
| `MemoryBooks` | `data.character_book` | Converted to CCv3 structure |
| `Scenario` | `data.scenario` | Initial context |

## Technical Notes
1.  **Multi-Character Handling**: Implemented as separate card imports. Each character in a package becomes a distinct card in Card Architect.
2.  **Scripting**: Scripts are preserved in `data.extensions.voxta.scripts` but are not executable within the editor.
3.  **Assets**: All assets are imported into the Asset Graph and linked to the card with appropriate tags (`emotion`, `state`, `variant`).

## Next Steps
1.  Additional testing with complex Voxta packages.
2.  Refinement of asset tag display in the UI.
3.  Potential support for editing Voxta scripts in the Advanced tab.
