import type { ModuleDefinition } from '../../lib/registry/types';

export const MODULE_METADATA: ModuleDefinition = {
  id: 'charx-optimizer',
  name: 'Package Optimizer',
  description: 'Optimize media for CHARX/Voxta export (WebP, WebM, selective assets).',
  defaultEnabled: true,
  badge: 'Export',
  color: 'purple',
  order: 45,
  requiresServer: true, // Uses server-side Sharp for image optimization
};

