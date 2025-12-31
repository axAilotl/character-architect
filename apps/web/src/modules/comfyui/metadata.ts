import type { ModuleDefinition } from '../../lib/registry/types';

export const MODULE_METADATA: ModuleDefinition = {
  id: 'comfyui',
  name: 'ComfyUI',
  description: 'Image generation integration with ComfyUI server (scaffolding).',
  defaultEnabled: false,
  badge: 'Beta',
  color: 'green',
  order: 30,
  requiresServer: true,
};

