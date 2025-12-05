/**
 * ComfyUI Module Registration
 *
 * Image generation via ComfyUI integration.
 * Registers the ComfyUI tab and settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
import { getDeploymentConfig } from '../../config/deployment';
import type { ModuleDefinition } from '../../lib/registry/types';

/**
 * Module metadata for auto-discovery
 */
export const MODULE_METADATA: ModuleDefinition = {
  id: 'comfyui',
  name: 'ComfyUI',
  description: 'Image generation integration with ComfyUI server (scaffolding).',
  defaultEnabled: false,
  badge: 'Beta',
  color: 'green',
  order: 30,
};

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
 * Must be enabled AND not in light/static mode (requires local ComfyUI server)
 */
function isComfyUIAvailable(): boolean {
  const config = getDeploymentConfig();
  if (config.mode === 'light' || config.mode === 'static') {
    return false; // ComfyUI requires local server
  }
  return useSettingsStore.getState().features?.comfyuiEnabled ?? false;
}

/**
 * Register the ComfyUI module
 * Note: In light/static mode, this module is NOT registered at all
 */
export function registerComfyuiModule(): void {
  // Don't register in light/static mode - ComfyUI requires local server
  const config = getDeploymentConfig();
  if (config.mode === 'light' || config.mode === 'static') {
    console.log('[comfyui] Skipping registration in light mode');
    return;
  }

  // Register editor tab
  registry.registerTab({
    id: 'comfyui',
    label: 'ComfyUI',
    component: ComfyUITab,
    color: 'green',
    order: 40, // After wwwyzzerdd (30)
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
