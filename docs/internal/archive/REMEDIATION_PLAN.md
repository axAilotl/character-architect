# Architecture Remediation Plan

**Date:** November 20, 2025
**Status:** Draft
**Reviewer:** Gemini
**Project:** Card Doctor

## Executive Summary

Based on the "Migration Candidate Checklist" assessment, a full migration to a meta-framework (e.g., Next.js, Remix) or an opinionated backend framework (e.g., NestJS) is **NOT recommended** at this time. The project's single-user, self-hosted nature does not require the complexity of SSR or multi-tenancy support.

However, significant "Codebase Pain" was identified in the frontend architecture, specifically regarding manual routing and monolithic state management. This plan outlines a "Refactor in Place" strategy to address these issues, improve maintainability, and simplify future feature development.

---

## Phase 1: Frontend Routing & Navigation

**Problem:** The application currently uses manual conditional rendering (`view === 'grid' ? ... : ...`) in `App.tsx` to manage screens.
**Impact:**
- No deep linking (refreshing the page resets the view).
- Browser history (back button) is not supported.
- Adding new views (e.g., Settings, About, Batch Editor) increases complexity linearly in the root component.

### Action Items

1.  **Install React Router:**
    - Add `react-router-dom` to `apps/web/package.json`.
2.  **Implement Routes:**
    - Replace the conditional rendering in `App.tsx` with a `RouterProvider`.
    - Define routes:
        - `/` -> `CardGrid` (Home)
        - `/cards/:id` -> `CardEditor` (Edit View)
        - `/settings` -> `SettingsModal` (or dedicated page)
3.  **Update Navigation Logic:**
    - Replace `handleCardClick` props with `<Link to="/cards/${id}">`.
    - Replace "Back" buttons with `useNavigate()`.
4.  **URL Synchronization:**
    - Ensure the `CardEditor` reads the ID from the URL parameter (`useParams`) instead of relying on global store state (`currentCard`). This makes the editor robust to page reloads.

---

## Phase 2: State Management Decomposition

**Problem:** `card-store.ts` has become a "God Object." It handles:
- API communication (`saveCard`, `loadCard`).
- Local persistence (IndexedDB).
- UI state (`activeTab`, `showAdvanced`).
- Business logic (`updateCardData`, `createSnapshot`).
- Domain logic (`tokenCounts`).

**Impact:**
- High coupling: Changing UI state logic risks breaking data saving logic.
- "Prop drilling" of store actions.
- Hard to test isolated behaviors.

### Action Items

1.  **Split by Domain (Zustand Slices or Separate Stores):**
    - **`useUIStore`:** Manage ephemeral UI state (`activeTab`, `showAdvanced`, `isSidebarOpen`).
    - **`useTokenizerStore`:** Manage token counting logic and tokenizer model selection.
    - **`useCardData` (Data Layer):** Keep the core CRUD operations here, but strip out the UI flags.
2.  **Adopt React Query (Optional but Recommended):**
    - Replace manual `api.get(...) .then(set(...))` logic with **TanStack Query**.
    - *Why:* It automatically handles loading states (`isLoading`), error states, and re-fetching/caching, removing the need for manual flags like `isSaving` or `isDirty` tracking in the global store for *fetching* (dirty checking for *editing* remains relevant).
3.  **Refactor "Dirty" Checking:**
    - Move dirty checking logic closer to the form/editor components or a dedicated `useFormState` hook rather than global store state, if possible.

---

## Phase 3: Feature Isolation & File Structure

**Problem:** Adding a feature touches 5+ files across disparate directories.
**Impact:** High cognitive load for new contributors.

### Action Items

1.  **Colocation:**
    - Move components related to a specific feature into a folder with that feature's logic.
    - *Current:* `components/CardEditor.tsx`, `store/card-store.ts`, `lib/api.ts`
    - *Target:* `features/editor/CardEditor.tsx`, `features/editor/editor-store.ts`, `features/editor/hooks.ts`
2.  **Standardize Hook Pattern:**
    - Create custom hooks for complex logic instead of embedding it in components or the global store.
    - Example: `useCardAutosave(cardId, data)` instead of burying `setTimeout` logic inside `card-store.ts`.

---

## Phase 4: Backend (Maintenance & Hardening)

**Status:** The Fastify + Repository pattern is working well. No major architectural changes are needed.

### Action Items

1.  **Type Sharing:**
    - Ensure `@card-architect/schemas` is strictly used as the source of truth for both frontend API calls and backend route validation.
2.  **Validation Middleware:**
    - Continue using the schema validators in route handlers. Ensure validation errors return structured, consistent responses to the frontend to help with form error display.
