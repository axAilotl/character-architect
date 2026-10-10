import type { ModuleDefinition } from '../../lib/registry/types';

export const MODULE_METADATA: ModuleDefinition = {
  id: 'lumiverse', name: 'Lumiverse', category: 'connection', defaultEnabled: false,
  description: 'Send characters and portraits to your self-hosted Lumiverse instance.',
  async migrateEnabled() {
    const { api } = await import('../../lib/api');
    const result = await api.getLumiverseSettings();
    return result.data?.settings.enabled;
  },
  badge: 'Chat', color: 'teal', order: 55, requiresServer: true,
};
