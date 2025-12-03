import { ComponentType, LazyExoticComponent } from 'react';

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
  contexts?: ('card' | 'template' | 'all')[];
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
 * Tab context type
 */
export type TabContext = 'card' | 'template' | 'all';
