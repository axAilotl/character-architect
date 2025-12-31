import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
export { MODULE_METADATA } from './metadata';

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
