/**
 * ComfyUI Module Registration
 *
 * Image generation via ComfyUI integration.
 * Registers the ComfyUI tab and settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
export { MODULE_METADATA } from './metadata';

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
 * Check if ComfyUI should be visible
 * The module loader already handles deployment mode filtering via requiresServer.
 * This just checks if the user has enabled the module.
 */
function isComfyUIAvailable(): boolean {
  return useSettingsStore.getState().features?.comfyuiEnabled ?? false;
}

/**
 * Register the ComfyUI module
 * Note: In light/static mode, this module is NOT loaded at all (requiresServer: true)
 */
export function registerComfyuiModule(): void {
  // Register editor tab
  registry.registerTab({
    id: 'comfyui',
    label: 'ComfyUI',
    component: ComfyUITab,
    color: 'green',
    order: 80, // After wwwyzzerdd (70)
    contexts: ['card'],
    condition: isComfyUIAvailable,
  });

  // Register settings panel
  registry.registerSettingsPanel({
    id: 'comfyui',
    label: 'ComfyUI',
    component: ComfyUISettings,
    row: 'modules',
    color: 'green',
    order: 50,
    condition: isComfyUIAvailable,
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
