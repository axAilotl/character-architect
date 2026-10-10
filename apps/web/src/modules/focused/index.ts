import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
export { MODULE_METADATA } from './metadata';

const FocusedEditor = lazy(() => import('../../features/editor/components/FocusedEditor').then(m => ({ default: m.FocusedEditor })));
const FocusedSettings = lazy(() => import('../../features/editor/settings/FocusedSettings').then(m => ({ default: m.FocusedSettings })));

export function registerFocusedModule() {
  registry.registerTab({ id: 'focused', label: 'Focused', component: FocusedEditor, order: 10, contexts: ['card'],
    condition: () => useSettingsStore.getState().features.focusedEnabled ?? true });
  registry.registerSettingsPanel({ id: 'focused-settings', label: 'Focused', component: FocusedSettings,
    group: 'editors', moduleId: 'focused', order: 26 });
}
