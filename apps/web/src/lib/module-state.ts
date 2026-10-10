import type { ModuleDefinition } from './registry/types';
import { getModuleDefault } from '../config/deployment';

export function isModuleEnabled(module: ModuleDefinition, features: Record<string, boolean>): boolean {
  if (module.unavailableInCurrentMode) return false;
  const flag = `${module.id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}Enabled`;
  return features[flag] ?? (getModuleDefault(module.id) && module.defaultEnabled);
}
