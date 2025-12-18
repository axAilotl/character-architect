import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
import type { ModuleDefinition } from '../../lib/registry/types';

export const MODULE_METADATA: ModuleDefinition = {
  id: 'elara-voss',
  name: 'ELARA VOSS',
  description: 'Name replacement tool for character cards.',
  defaultEnabled: false,
  badge: 'Tool',
  color: 'purple',
  order: 10,
  requiresServer: true,
};

const ElaraVossPanel = lazy(() =>
  import('../../features/editor/components/ElaraVossPanel').then((m) => ({
    default: m.ElaraVossPanel,
  }))
);

function isElaraVossAvailable(): boolean {
  return useSettingsStore.getState().features?.elaraVossEnabled ?? false;
}

export function registerElaraVossModule(): void {
  registry.registerTab({
    id: 'elara-voss',
    label: 'ELARA VOSS',
    component: ElaraVossPanel,
    color: 'purple',
    order: 65,
    contexts: ['card'],
    condition: isElaraVossAvailable,
  });

  console.log('[elara-voss] Module registered');
}

export function unregisterElaraVossModule(): void {
  registry.unregisterTab('elara-voss');
  console.log('[elara-voss] Module unregistered');
}
