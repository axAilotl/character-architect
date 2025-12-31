import type { ModuleDefinition } from '../../lib/registry/types';

export const MODULE_METADATA: ModuleDefinition = {
  id: 'federation',
  name: 'Federation',
  description: 'Sync character cards across SillyTavern, CardsHub, and Character Archive.',
  defaultEnabled: false,
  badge: 'Sync',
  color: 'cyan',
  order: 60,
  requiresServer: true,
};

