/**
 * Federation Module Registration
 *
 * Enables bi-directional sync between Character Architect and other platforms:
 * - SillyTavern (via CForge plugin)
 * - CardsHub
 * - Character Archive
 *
 * This module requires a server backend (requiresServer: true).
 * It is only available in full deployment mode.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
export { MODULE_METADATA } from './metadata';

// Lazy-load the settings component
const FederationSettings = lazy(() =>
  import('./settings/FederationSettings').then((m) => ({
    default: m.FederationSettings,
  }))
);

/**
 * Register the Federation module
 * Note: In light/static mode, this module is NOT loaded at all (requiresServer: true)
 */
export function registerFederationModule(): void {
  // Register settings panel
  registry.registerSettingsPanel({
    id: 'federation',
    label: 'Federation',
    component: FederationSettings,
    row: 'modules',
    color: 'cyan',
    order: 80,
    condition: () => useSettingsStore.getState().features?.federationEnabled ?? false,
  });

  console.log('[federation] Module registered (settings panel)');
}

/**
 * Unregister the Federation module
 */
export function unregisterFederationModule(): void {
  registry.unregisterSettingsPanel('federation');
  console.log('[federation] Module unregistered');
}

export type { PlatformId, CardSyncState, SyncResult } from './lib/types';
