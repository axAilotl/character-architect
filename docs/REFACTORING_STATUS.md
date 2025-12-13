# Refactoring Status: Modular Architecture Migration

**Date:** December 12, 2025
**Status:** In Progress / Transitional
**Target:** Align `character-architect` with the schema-driven architecture defined in `MODULARITY_BIBLE.md`.

---

## 1. Executive Summary

The project is currently in a transitional state. The foundational `app-framework` package exists but is effectively orphaned. The frontend (`apps/web`) has implemented a *Registry pattern*, but it is a "Level 3" (Component-based) implementation rather than the intended "Level 1" (Schema-driven) implementation.

**The Goal:** Move from manually coded React forms to auto-generated forms derived from Zod schemas.

---

## 2. Current Architecture vs. Target

| Feature | Current State (`apps/web`) | Target State (`MODULARITY_BIBLE.md`) | Gap |
| :--- | :--- | :--- | :--- |
| **Settings Panels** | Manual React Components (`GeneralSettingsPanel.tsx`) | Generated via `<AutoForm schema={ZodSchema} />` | **Critical**: High maintenance, inconsistent UI. |
| **Registry** | Registers `ComponentType` | Registers `ZodSchema` + `UIHints` | **High**: Registry needs to accept schemas. |
| **State Management** | Direct `zustand` store access in components | `ExtensionContext` passed to handlers | **Medium**: Extensions are tightly coupled to core store. |
| **Dependencies** | Does not use `app-framework` | Should depend on `app-framework` | **Critical**: Core logic is duplicated or unused. |

---

## 3. Detailed Refactoring Plan

### Phase 1: Infrastructure Connection (Priority: High)
*Objective: Make the `app-framework` available to the frontend.*

1.  **Add Dependency:** Update `apps/web/package.json` to include `"@character-foundry/app-framework": "workspace:^"`.
2.  **Verify Build:** Ensure `apps/web` can import `AutoForm` and `Registry` from the framework without build errors.

### Phase 2: Registry Evolution (Priority: Critical)
*Objective: Allow the Registry to handle both legacy Components and new Schemas.*

1.  **Update Types:** Modify `apps/web/src/lib/registry/types.ts`.
    *   Add `schema?: z.ZodType` to `SettingsPanelDefinition`.
    *   Add `ui?: Record<string, UIHint>` to `SettingsPanelDefinition`.
    *   Mark `component` as optional if `schema` is provided.
2.  **Update Consumer:** Update `SettingsModal.tsx` (or the rendering logic) to check:
    *   IF `component` exists → Render Component (Legacy support).
    *   ELSE IF `schema` exists → Render `<AutoForm schema={...} />`.

### Phase 3: Panel Migration (Priority: Medium)
*Objective: Convert existing hardcoded panels to Zod Schemas.*

**Target Files in `apps/web/src/features/settings/panels/`:**

| Panel File | Migration Strategy | Complexity |
| :--- | :--- | :--- |
| `GeneralSettingsPanel.tsx` | Convert `linkedImageArchivalEnabled` to Zod Schema. | Low |
| `EditorSettingsPanel.tsx` | Map simple boolean/string toggles to Zod. | Medium |
| `ThemeSettingsPanel.tsx` | Use `ui: { widget: 'color-picker' }` hints. | Medium |
| `ModulesSettingsPanel.tsx` | Keep as Manual Component for now (complex logic). | High |
| `ProvidersSettingsPanel.tsx` | **Prime Candidate** for "Provider Registry" pattern. | High |

### Phase 4: State Bridge (Priority: High)
*Objective: Connect the auto-generated forms to Zustand.*

1.  **AutoForm Binding:** Create a `useAutoFormBinding` hook.
    *   Input: `ZodSchema`, `storeSelector`, `storeSetter`.
    *   Output: `values`, `onChange` handler for AutoForm.
2.  **Store Refactor:** Ensure `settings-store.ts` exposes generic setters or follows a pattern that can be mapped easily (currently specific setters like `setLinkedImageArchivalEnabled`).

---

## 4. Immediate Action Items

1.  [ ] **Install**: Run `pnpm add @character-foundry/app-framework --filter @card-architect/web`.
2.  [ ] **Prototype**: Create a `TestSettingsPanel` in `apps/web` using `AutoForm` to prove the concept.
3.  [ ] **Refactor General**: Port `GeneralSettingsPanel` to a schema-based definition.
    ```typescript
    // Example Target Code
    const GeneralSettingsSchema = z.object({
      linkedImageArchivalEnabled: z.boolean().describe("Archive external images...")
    });
    
    registry.registerSettingsPanel({
      id: 'general',
      schema: GeneralSettingsSchema,
      // ... binding logic
    });
    ```

## 5. Known Blockers / Risks

*   **Custom Widgets:** The `app-framework` widgets directory was observed to be partially empty/basic. We may need to move `apps/web` UI components (like specific toggles or sliders) *into* `app-framework` to support the migration.
*   **Complex logic:** Panels like `RagSettingsPanel` likely have async logic or complex state that `AutoForm` can't handle out-of-the-box yet. These should remain as "Level 3" (Component) overrides for now.
