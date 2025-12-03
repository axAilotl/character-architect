/**
 * Core Editor Tabs Registration
 *
 * Registers the built-in editor tabs with the UI registry.
 * These are the default tabs that ship with Card Architect.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';

// Eager-loaded core components (small, always needed)
import { EditPanel } from './components/EditPanel';

// Lazy-loaded components (larger, less frequently used)
const AssetsPanel = lazy(() =>
  import('./components/AssetsPanel').then((m) => ({ default: m.AssetsPanel }))
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
    contexts: ['card', 'template', 'all'],
  });

  // Assets - Image/asset management (order: 10)
  registry.registerTab({
    id: 'assets',
    label: 'Assets',
    component: AssetsPanel,
    order: 10,
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.assetsEnabled ?? true,
  });

  // Focused - Distraction-free editing (order: 20)
  registry.registerTab({
    id: 'focused',
    label: 'Focused',
    component: FocusedEditor,
    order: 20,
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.focusedEnabled ?? true,
  });

  // Preview - Markdown preview (order: 60)
  registry.registerTab({
    id: 'preview',
    label: 'Preview',
    component: PreviewPanel,
    order: 60,
    contexts: ['card'],
  });

  // Diff - Version comparison (order: 70)
  registry.registerTab({
    id: 'diff',
    label: 'Diff',
    component: DiffPanel,
    order: 70,
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.diffEnabled ?? true,
  });

  // ==================== Settings Panels ====================

  // Focused settings panel
  registry.registerSettingsPanel({
    id: 'focused-settings',
    label: 'Focused',
    component: FocusedSettings,
    row: 'modules',
    color: 'cyan',
    order: 10,
    condition: () => useSettingsStore.getState().features?.focusedEnabled ?? true,
  });

  // Diff settings panel
  registry.registerSettingsPanel({
    id: 'diff-settings',
    label: 'Diff',
    component: DiffSettings,
    row: 'modules',
    color: 'amber',
    order: 20,
    condition: () => useSettingsStore.getState().features?.diffEnabled ?? true,
  });

  // Note: Web Import and SillyTavern settings are registered by their own modules

  console.log('[CoreTabs] Registered 5 core editor tabs and 2 settings panels');
}
