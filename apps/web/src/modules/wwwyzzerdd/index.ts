/**
 * wwwyzzerdd Module Registration
 *
 * AI-assisted character creation wizard.
 * Registers the wwwyzzerdd tab and settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
import type { ModuleDefinition } from '../../lib/registry/types';

/**
 * Module metadata for auto-discovery
 */
export const MODULE_METADATA: ModuleDefinition = {
  id: 'wwwyzzerdd',
  name: 'wwwyzzerdd',
  description: 'AI-assisted character creation wizard with two-column editing layout.',
  defaultEnabled: false,
  badge: 'AI',
  color: 'purple',
  order: 20,
};

// Lazy-load the components
const WwwyzzerddTab = lazy(() =>
  import('../../features/wwwyzzerdd/WwwyzzerddTab').then((m) => ({
    default: m.WwwyzzerddTab,
  }))
);

const WwwyzzerddSettings = lazy(() =>
  import('./settings/WwwyzzerddSettings').then((m) => ({
    default: m.WwwyzzerddSettings,
  }))
);

/**
 * Check if wwwyzzerdd should be visible
 * Works in all modes - uses client-side LLM in light/static mode
 */
function isWwwyzzerddAvailable(): boolean {
  return useSettingsStore.getState().features?.wwwyzzerddEnabled ?? false;
}

/**
 * Register the wwwyzzerdd module
 */
export function registerWwwyzzerddModule(): void {
  // Register editor tab
  registry.registerTab({
    id: 'wwwyzzerdd',
    label: 'wwwyzzerdd',
    component: WwwyzzerddTab,
    color: 'purple',
    order: 30, // After Edit (0), Assets (10), Focused (20)
    contexts: ['card'],
    condition: isWwwyzzerddAvailable,
  });

  // Register settings panel
  registry.registerSettingsPanel({
    id: 'wwwyzzerdd',
    label: 'wwwyzzerdd',
    component: WwwyzzerddSettings,
    row: 'modules',
    color: 'purple',
    order: 40,
    condition: isWwwyzzerddAvailable,
  });

  console.log('[wwwyzzerdd] Module registered (tab + settings)');
}

/**
 * Unregister the wwwyzzerdd module
 */
export function unregisterWwwyzzerddModule(): void {
  registry.unregisterTab('wwwyzzerdd');
  registry.unregisterSettingsPanel('wwwyzzerdd');
  console.log('[wwwyzzerdd] Module unregistered');
}
