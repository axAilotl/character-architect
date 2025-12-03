/**
 * ComfyUI Module Registration
 *
 * Image generation via ComfyUI integration.
 * Registers the ComfyUI tab and settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';

// Lazy-load the components
const ComfyUITab = lazy(() =>
  import('../../features/comfyui/ComfyUITab').then((m) => ({
    default: m.ComfyUITab,
  }))
);

const ComfyUISettings = lazy(() =>
  import('./settings/ComfyUISettings').then((m) => ({
    default: m.ComfyUISettings,
  }))
);

/**
 * Register the ComfyUI module
 */
export function registerComfyuiModule(): void {
  // Register editor tab
  registry.registerTab({
    id: 'comfyui',
    label: 'ComfyUI',
    component: ComfyUITab,
    color: 'green',
    order: 40, // After wwwyzzerdd (30)
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.comfyuiEnabled ?? false,
  });

  // Register settings panel
  registry.registerSettingsPanel({
    id: 'comfyui',
    label: 'ComfyUI',
    component: ComfyUISettings,
    row: 'modules',
    color: 'green',
    order: 50,
    condition: () => useSettingsStore.getState().features?.comfyuiEnabled ?? false,
  });

  console.log('[comfyui] Module registered (tab + settings)');
}

/**
 * Unregister the ComfyUI module
 */
export function unregisterComfyuiModule(): void {
  registry.unregisterTab('comfyui');
  registry.unregisterSettingsPanel('comfyui');
  console.log('[comfyui] Module unregistered');
}
