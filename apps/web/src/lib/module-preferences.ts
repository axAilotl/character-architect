import { useSettingsStore } from '../store/settings-store';
import type { ModuleDefinition } from './registry/types';

export async function migrateModulePreferences(modules: ModuleDefinition[]): Promise<void> {
  await Promise.all(modules.map(async module => {
    const camelId = module.id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const flag = `${camelId}Enabled`;
    if (!module.migrateEnabled || module.unavailableInCurrentMode || useSettingsStore.getState().features[flag] !== undefined) return;
    try {
      const enabled = await module.migrateEnabled();
      // A user's toggle always wins, including changes made during the request.
      if (enabled !== undefined && useSettingsStore.getState().features[flag] === undefined) {
        useSettingsStore.getState().setModuleEnabled(camelId, enabled);
      }
    } catch {
      // Unavailable servers must not prevent startup; retry on the next page load.
    }
  }));
}
