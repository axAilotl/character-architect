/**
 * Core Editor Tabs Registration
 *
 * Registers the built-in editor tabs with the UI registry.
 * These are the default tabs that ship with Character Architect.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';

// Eager-loaded core components (small, always needed)
// Note: EditPanelV2 is the new schema-driven version for testing
// import { EditPanel } from './components/EditPanel';
import { EditPanelV2 as EditPanel } from './components/EditPanelV2';

// Lazy-loaded components (larger, less frequently used)
const AssetsPanel = lazy(() =>
  import('./components/AssetsPanel').then((m) => ({ default: m.AssetsPanel }))
);
const LorebookEditor = lazy(() =>
  import('./components/LorebookEditor').then((m) => ({ default: m.LorebookEditor }))
);
const FocusedEditor = lazy(() =>
  import('./components/FocusedEditor').then((m) => ({ default: m.FocusedEditor }))
);
const PreviewPanel = lazy(() =>
  import('./components/PreviewPanel').then((m) => ({ default: m.PreviewPanel }))
);
const DiffPanel = lazy(() =>
  import('./components/DiffPanel').then((m) => ({ default: m.DiffPanel }))
);

// Lazy-loaded settings panels
const FocusedSettings = lazy(() =>
  import('./settings/FocusedSettings').then((m) => ({ default: m.FocusedSettings }))
);
const DiffSettings = lazy(() =>
  import('./settings/DiffSettings').then((m) => ({ default: m.DiffSettings }))
);

/**
 * Register all core editor tabs
 */
export function registerCoreTabs(): void {
  // Edit - Primary editing interface (order: 0)
  registry.registerTab({
    id: 'edit',
    label: 'Edit',
    component: EditPanel,
    order: 0,
    contexts: ['card', 'template', 'lorebook', 'collection', 'all'],
  });

  // Lorebook - Character book / world info editor (order: 40)
  // Available for cards, lorebooks, and collections
  registry.registerTab({
    id: 'lorebook',
    label: 'Lorebook',
    component: LorebookEditor,
    order: 40,
    color: 'green',
    contexts: ['card', 'lorebook', 'collection'],
  });

  // Assets - Image/asset management (order: 50)
  // Available for cards and collections, not for standalone lorebooks
  registry.registerTab({
    id: 'assets',
    label: 'Assets',
    component: AssetsPanel,
    order: 50,
    contexts: ['card', 'collection'],
    condition: () => useSettingsStore.getState().features?.assetsEnabled ?? true,
  });

  // Focused - Distraction-free editing (order: 10)
  // Only for character cards, not lorebooks or collections
  registry.registerTab({
    id: 'focused',
    label: 'Focused',
    component: FocusedEditor,
    order: 10,
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.focusedEnabled ?? true,
  });

  // Preview - Markdown preview (order: 60)
  // Available for cards, lorebooks, and collections
  registry.registerTab({
    id: 'preview',
    label: 'Preview',
    component: PreviewPanel,
    order: 60,
    contexts: ['card', 'lorebook', 'collection'],
  });

  // Diff - Version comparison (order: 30)
  // Available for cards, lorebooks, and collections
  registry.registerTab({
    id: 'diff',
    label: 'Diff',
    component: DiffPanel,
    order: 30,
    contexts: ['card', 'lorebook', 'collection'],
    condition: () => useSettingsStore.getState().features?.diffEnabled ?? true,
  });

  // ==================== Settings Panels ====================

  // Focused settings panel
  registry.registerSettingsPanel({
    id: 'focused-settings',
    label: 'Focused',
    component: FocusedSettings,
    row: 'main',
    color: 'cyan',
    order: 30,
    condition: () => useSettingsStore.getState().features?.focusedEnabled ?? true,
  });

  // Diff settings panel
  registry.registerSettingsPanel({
    id: 'diff-settings',
    label: 'Diff',
    component: DiffSettings,
    row: 'main',
    color: 'amber',
    order: 35,
    condition: () => useSettingsStore.getState().features?.diffEnabled ?? true,
  });

  // Note: Web Import and SillyTavern settings are registered by their own modules

  console.log('[CoreTabs] Registered 6 core editor tabs and 2 settings panels');
}
