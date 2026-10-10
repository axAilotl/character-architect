import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
export { MODULE_METADATA } from './metadata';

const LumiverseSettings = lazy(() => import('./settings/LumiverseSettings').then(m => ({ default: m.LumiverseSettingsPanel })));

export function registerLumiverseModule() {
  registry.registerSettingsPanel({ id: 'lumiverse', label: 'Lumiverse', component: LumiverseSettings,
    group: 'federation', moduleId: 'lumiverse', order: 75,
    condition: () => useSettingsStore.getState().features.lumiverseEnabled ?? false });
}
