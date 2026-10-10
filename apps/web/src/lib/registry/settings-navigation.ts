import type { SettingsPanelDefinition } from './types';

const categories: Record<string, { label: string; order: number }> = {
  general: { label: 'General', order: 10 },
  themes: { label: 'Appearance', order: 20 },
  editors: { label: 'Editors', order: 30 },
  ai: { label: 'AI', order: 40 },
  templates: { label: 'Templates', order: 50 },
  presets: { label: 'LLM Presets', order: 60 },
  federation: { label: 'Federation', order: 70 },
  modules: { label: 'Modules', order: 80 },
  backup: { label: 'Backup & Restore', order: 90 },
};

export interface SettingsCategory {
  id: string;
  label: string;
  order: number;
  panels: SettingsPanelDefinition[];
}

/** Group registered contributions, including legacy and third-party panels. */
export function groupSettingsPanels(panels: SettingsPanelDefinition[]): SettingsCategory[] {
  const groups = new Map<string, SettingsCategory>();
  for (const panel of panels) {
    const id = panel.group ?? (panel.row === 'modules' ? 'modules' : panel.id);
    if (!groups.has(id)) {
      groups.set(id, { id, ...(categories[id] ?? { label: panel.label, order: panel.order ?? 100 }), panels: [] });
    }
    groups.get(id)!.panels.push(panel);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order);
}
