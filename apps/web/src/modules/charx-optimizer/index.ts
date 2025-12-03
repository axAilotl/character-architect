/**
 * Package Optimizer Module Registration
 *
 * Media optimization for CHARX and Voxta exports.
 * Supports WebP image conversion, MP4 to WebM video conversion,
 * and selective asset type export.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
import type { ModuleDefinition } from '../../lib/registry/types';

/**
 * Module metadata for auto-discovery
 */
export const MODULE_METADATA: ModuleDefinition = {
  id: 'charx-optimizer',
  name: 'Package Optimizer',
  description: 'Optimize media for CHARX/Voxta export (WebP, WebM, selective assets).',
  defaultEnabled: true,
  badge: 'Export',
  color: 'purple',
  order: 45,
};

// Lazy-load the settings component
const PackageOptimizerSettings = lazy(() =>
  import('./settings/CharxOptimizerSettings').then((m) => ({
    default: m.CharxOptimizerSettings,
  }))
);

/**
 * Register the Package Optimizer module
 */
export function registerCharxOptimizerModule(): void {
  // Register settings panel
  registry.registerSettingsPanel({
    id: 'charx-optimizer',
    label: 'Package Optimizer',
    component: PackageOptimizerSettings,
    row: 'modules',
    color: 'purple',
    order: 65, // After Web Import (60), before SillyTavern (70)
    condition: () => useSettingsStore.getState().features?.charxOptimizerEnabled ?? true,
  });

  console.log('[package-optimizer] Module registered (settings panel)');
}

/**
 * Unregister the Package Optimizer module
 */
export function unregisterCharxOptimizerModule(): void {
  registry.unregisterSettingsPanel('charx-optimizer');
  console.log('[package-optimizer] Module unregistered');
}
