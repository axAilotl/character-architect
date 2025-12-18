/**
 * wwwyzzerdd Module Registration
 *
 * AI-assisted character creation wizard.
 * Registers the wwwyzzerdd tab and settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
import { getModuleDefault } from '../../config/deployment';
export { MODULE_METADATA } from './metadata';

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
  const featureFlag = useSettingsStore.getState().features?.wwwyzzerddEnabled;
  // If user has explicitly set the flag, use that; otherwise use deployment default
  if (featureFlag !== undefined) {
    return featureFlag;
  }
  return getModuleDefault('wwwyzzerdd');
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
    order: 70, // After Preview (60)
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
