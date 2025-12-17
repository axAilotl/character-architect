/**
 * SillyTavern Module Registration
 *
 * Push integration to send character cards directly to SillyTavern.
 * Registers the SillyTavern settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
import type { ModuleDefinition } from '../../lib/registry/types';

/**
 * Module metadata for auto-discovery
 */
export const MODULE_METADATA: ModuleDefinition = {
  id: 'sillytavern',
  name: 'SillyTavern',
  description: 'Push character cards directly to SillyTavern via API.',
  defaultEnabled: false,
  badge: 'Push',
  color: 'pink',
  order: 50,
  requiresServer: true,
};

// Lazy-load the settings component
const SillyTavernSettings = lazy(() =>
  import('./settings/SillyTavernSettings').then((m) => ({
    default: m.SillyTavernSettings,
  }))
);

/**
 * Register the SillyTavern module
 * Note: In light/static mode, this module is NOT loaded at all (requiresServer: true)
 */
export function registerSillytavernModule(): void {
  // Register settings panel
  registry.registerSettingsPanel({
    id: 'sillytavern',
    label: 'SillyTavern',
    component: SillyTavernSettings,
    row: 'modules',
    color: 'pink',
    order: 70,
    condition: () => useSettingsStore.getState().features?.sillytavernEnabled ?? false,
  });

  console.log('[sillytavern] Module registered (settings panel)');
}

/**
 * Unregister the SillyTavern module
 */
export function unregisterSillytavernModule(): void {
  registry.unregisterSettingsPanel('sillytavern');
  console.log('[sillytavern] Module unregistered');
}
