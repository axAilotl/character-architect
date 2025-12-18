import { ComponentType, LazyExoticComponent } from 'react';

/**
 * Tab context type - determines which tabs are available
 */
export type TabContext = 'card' | 'template' | 'lorebook' | 'collection' | 'all';

/**
 * Base definition for all plugin contributions
 */
export interface PluginContribution {
  id: string;
  order?: number; // Lower = earlier. Core: 0-99, Plugins: 100+
  condition?: () => boolean; // Return false to hide
}

/**
 * Editor tab definition
 */
export interface EditorTabDefinition extends PluginContribution {
  label: string;
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red';
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType | LazyExoticComponent<ComponentType<unknown>>;
  // Which editor contexts this tab appears in
  contexts?: TabContext[];
}

/**
 * Settings panel definition
 */
export interface SettingsPanelDefinition extends PluginContribution {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType | LazyExoticComponent<ComponentType<unknown>>;
  /** Which row to display in: 'main' for top row, 'modules' for module settings row */
  row?: 'main' | 'modules';
  /** Color for tab highlight when active */
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink' | 'cyan' | 'amber' | 'teal';
}

/**
 * Sidebar section definition
 */
export interface SidebarSectionDefinition extends PluginContribution {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType | LazyExoticComponent<ComponentType<unknown>>;
  position: 'top' | 'bottom';
}

/**
 * Header action button definition
 */
export interface HeaderActionDefinition extends PluginContribution {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * Plugin manifest - what a plugin exports
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;

  // Contributions
  tabs?: EditorTabDefinition[];
  settingsPanels?: SettingsPanelDefinition[];
  sidebarSections?: SidebarSectionDefinition[];
  headerActions?: HeaderActionDefinition[];

  // Lifecycle hooks
  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}

/**
 * Module definition - metadata for optional modules
 * Used to auto-generate enable/disable toggles in Settings
 */
export interface ModuleDefinition {
  /** Unique module ID (kebab-case, e.g., 'charx-optimizer') */
  id: string;
  /** Display name for the toggle */
  name: string;
  /** Short description of what the module does */
  description: string;
  /** Whether the module is enabled by default */
  defaultEnabled: boolean;
  /** Badge text (e.g., 'Export', 'Import', 'Beta') */
  badge?: string;
  /** Badge/toggle color */
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink' | 'cyan' | 'amber' | 'teal';
  /** Display order in the modules list (lower = earlier) */
  order?: number;
  /**
   * Whether this module requires a server backend to function.
   * If true, the module will NOT appear in light/static deployment modes.
   * Examples: ComfyUI (needs local server), Web Import (needs API processing)
   */
  requiresServer?: boolean;
  /** Runtime flag: true if module can't work in current deployment mode */
  unavailableInCurrentMode?: boolean;
}
