/**
 * Modules Settings Schema
 *
 * Note: Module settings are dynamic and come from the registry.
 * This file provides type definitions and utilities for the modules panel.
 * AutoForm is not used directly since fields are dynamically generated.
 */

import type { ModuleDefinition } from '../../registry/types';

// Color classes for module toggles
export const moduleToggleColors: Record<string, { ring: string; bg: string; badge: string; text: string }> = {
  blue: { ring: 'peer-focus:ring-blue-500', bg: 'peer-checked:bg-blue-500', badge: 'bg-blue-500/20 text-blue-400', text: 'text-blue-400' },
  purple: { ring: 'peer-focus:ring-purple-500', bg: 'peer-checked:bg-purple-500', badge: 'bg-purple-500/20 text-purple-400', text: 'text-purple-400' },
  green: { ring: 'peer-focus:ring-green-500', bg: 'peer-checked:bg-green-500', badge: 'bg-green-500/20 text-green-400', text: 'text-green-400' },
  orange: { ring: 'peer-focus:ring-orange-500', bg: 'peer-checked:bg-orange-500', badge: 'bg-orange-500/20 text-orange-400', text: 'text-orange-400' },
  red: { ring: 'peer-focus:ring-red-500', bg: 'peer-checked:bg-red-500', badge: 'bg-red-500/20 text-red-400', text: 'text-red-400' },
  pink: { ring: 'peer-focus:ring-pink-500', bg: 'peer-checked:bg-pink-500', badge: 'bg-pink-500/20 text-pink-400', text: 'text-pink-400' },
  cyan: { ring: 'peer-focus:ring-cyan-500', bg: 'peer-checked:bg-cyan-500', badge: 'bg-cyan-500/20 text-cyan-400', text: 'text-cyan-400' },
  amber: { ring: 'peer-focus:ring-amber-500', bg: 'peer-checked:bg-amber-500', badge: 'bg-amber-500/20 text-amber-400', text: 'text-amber-400' },
  teal: { ring: 'peer-focus:ring-teal-500', bg: 'peer-checked:bg-teal-500', badge: 'bg-teal-500/20 text-teal-400', text: 'text-teal-400' },
};

/**
 * Get toggle color classes for a module
 */
export function getModuleToggleColors(color: ModuleDefinition['color']) {
  return moduleToggleColors[color || 'blue'] || moduleToggleColors.blue;
}

/**
 * Convert module ID to feature flag name
 * e.g., 'charx-optimizer' -> 'charxOptimizerEnabled'
 */
export function moduleIdToFlagName(moduleId: string): string {
  const camelId = moduleId.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  return `${camelId}Enabled`;
}
