import type { ModuleDefinition } from '../../lib/registry/types';

export const MODULE_METADATA: ModuleDefinition = {
  id: 'sillytavern',
  name: 'SillyTavern',
  description: 'Push character cards directly to SillyTavern via API.',
  defaultEnabled: false,
  badge: 'Push',
  color: 'pink',
  order: 50,
  requiresServer: true,
};

