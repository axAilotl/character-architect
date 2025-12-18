import type { ModuleDefinition } from '../../lib/registry/types';

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

