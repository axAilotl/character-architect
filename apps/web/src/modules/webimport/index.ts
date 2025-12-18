/**
 * Web Import Module Registration
 *
 * Import character cards from web using a browser userscript.
 * Registers the Web Import settings panel when enabled.
 */

import { lazy } from 'react';
import { registry } from '../../lib/registry';
import type { ModuleDefinition } from '../../lib/registry/types';

/**
 * Module metadata for auto-discovery
 */
export const MODULE_METADATA: ModuleDefinition = {
  id: 'webimport',
  name: 'Web Import',
  description: 'One-click import from character sites via browser userscript.',
  defaultEnabled: false,
  badge: 'Import',
  color: 'teal',
  order: 40,
  requiresServer: true,
};

// Lazy-load the settings component
const WebImportSettings = lazy(() =>
  import('./settings/WebImportSettings').then((m) => ({
    default: m.WebImportSettings,
  }))
);

/**
 * Register the Web Import module
 */
export function registerWebimportModule(): void {
  // Register settings panel
  // Note: No condition needed here - the module loader in lib/modules.ts
  // already gates loading by feature flag. Once loaded, we want the panel visible.
  registry.registerSettingsPanel({
    id: 'webimport',
    label: 'Web Import',
    component: WebImportSettings,
    row: 'modules',
    color: 'teal',
    order: 60,
  });

  console.log('[webimport] Module registered (settings panel)');
}

/**
 * Unregister the Web Import module
 */
export function unregisterWebimportModule(): void {
  registry.unregisterSettingsPanel('webimport');
  console.log('[webimport] Module unregistered');
}
