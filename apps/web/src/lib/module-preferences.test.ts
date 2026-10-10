import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isModuleEnabled } from './module-state';
import { migrateModulePreferences } from './module-preferences';
import { useSettingsStore } from '../store/settings-store';
import type { ModuleDefinition } from './registry/types';

const integration: ModuleDefinition = { id: 'test-chat', name: 'Test Chat', description: '', defaultEnabled: false };

describe('module preferences', () => {
  beforeEach(() => useSettingsStore.setState({ features: { assetsEnabled: true, focusedEnabled: true, diffEnabled: true, linkedImageArchivalEnabled: false }, setModuleEnabled: vi.fn() }));

  it('honors defaults, explicit choices, and deployment availability', () => {
    expect(isModuleEnabled(integration, {})).toBe(false);
    expect(isModuleEnabled(integration, { testChatEnabled: true })).toBe(true);
    expect(isModuleEnabled({ ...integration, defaultEnabled: true }, { testChatEnabled: false })).toBe(false);
    expect(isModuleEnabled({ ...integration, unavailableInCurrentMode: true }, { testChatEnabled: true })).toBe(false);
  });

  it('preserves a previously configured integration when introducing its module', async () => {
    await migrateModulePreferences([{ ...integration, migrateEnabled: async () => true }]);
    expect(useSettingsStore.getState().setModuleEnabled).toHaveBeenCalledWith('testChat', true);
  });

  it('never overwrites an explicit disabled choice', async () => {
    useSettingsStore.setState(state => ({ features: { ...state.features, testChatEnabled: false } }));
    const migrateEnabled = vi.fn(async () => true);
    await migrateModulePreferences([{ ...integration, migrateEnabled }]);
    expect(migrateEnabled).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().setModuleEnabled).not.toHaveBeenCalled();
  });

  it('preserves a toggle made while migration is in flight', async () => {
    await migrateModulePreferences([{ ...integration, migrateEnabled: async () => {
      useSettingsStore.setState(state => ({ features: { ...state.features, testChatEnabled: false } }));
      return true;
    } }]);
    expect(useSettingsStore.getState().setModuleEnabled).not.toHaveBeenCalled();
  });

  it('skips unsupported deployments and tolerates unavailable servers', async () => {
    const migrateEnabled = vi.fn(async () => true);
    await migrateModulePreferences([{ ...integration, unavailableInCurrentMode: true, migrateEnabled }]);
    expect(migrateEnabled).not.toHaveBeenCalled();
    await expect(migrateModulePreferences([{ ...integration, migrateEnabled: async () => { throw new Error('offline'); } }])).resolves.toBeUndefined();
    expect(useSettingsStore.getState().setModuleEnabled).not.toHaveBeenCalled();
  });
});
