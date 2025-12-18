/**
 * Block Editor Module Registration
 *
 * Block-based character card editor.
 * Registers the block-editor tab and settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
import type { ModuleDefinition } from '../../lib/registry/types';

/**
 * Module metadata for auto-discovery
 */
export const MODULE_METADATA: ModuleDefinition = {
  id: 'block-editor',
  name: 'Block Editor',
  description: 'Visual block-based character card builder with drag-and-drop editing.',
  defaultEnabled: true,
  badge: 'Editor',
  color: 'orange',
  order: 10,
};

// Lazy-load the components
const BlockEditorPanel = lazy(() =>
  import('./components/BlockEditorPanel').then((m) => ({
    default: m.BlockEditorPanel,
  }))
);

const BlockEditorSettings = lazy(() =>
  import('./components/BlockEditorSettings').then((m) => ({
    default: m.BlockEditorSettings,
  }))
);

/**
 * Register the block editor module
 */
export function registerBlockEditorModule(): void {
  // Register editor tab
  registry.registerTab({
    id: 'block-editor',
    label: 'Blocks',
    component: BlockEditorPanel,
    color: 'orange',
    order: 20, // After Edit (0), Focused (10), before Diff (30)
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.blockEditorEnabled ?? true,
  });

  // Register settings panel
  registry.registerSettingsPanel({
    id: 'blockeditor-settings',
    label: 'Block Editor',
    component: BlockEditorSettings,
    row: 'modules',
    color: 'orange',
    order: 30,
    condition: () => useSettingsStore.getState().features?.blockEditorEnabled ?? true,
  });

  console.log('[block-editor] Module registered (tab + settings)');
}

/**
 * Unregister the block editor module
 */
export function unregisterBlockEditorModule(): void {
  registry.unregisterTab('block-editor');
  registry.unregisterSettingsPanel('blockeditor-settings');
  console.log('[block-editor] Module unregistered');
}
