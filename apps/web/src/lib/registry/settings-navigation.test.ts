import { describe, expect, it } from 'vitest';
import { groupSettingsPanels } from './settings-navigation';
import type { SettingsPanelDefinition } from './types';

const component = () => null;
const panel = (id: string, group?: string, moduleId?: string): SettingsPanelDefinition => ({ id, label: id, component, group, moduleId });

describe('settings navigation', () => {
  it('keeps editor, AI, and connection contributions in their own contextual tabs', () => {
    const groups = groupSettingsPanels([
      panel('standard', 'editors'), panel('providers', 'ai'), panel('rag', 'ai'),
      panel('blocks-settings', 'editors', 'block-editor'), panel('lumiverse', 'federation', 'lumiverse'),
      panel('focused-settings', 'editors', 'focused'), panel('overview', 'modules'),
      { ...panel('optimizer'), row: 'modules' },
    ]);
    expect(groups.map(group => group.label)).toEqual(['Editors', 'AI', 'Federation', 'Modules']);
    expect(groups.map(group => group.panels.map(item => item.id))).toEqual([
      ['standard', 'blocks-settings', 'focused-settings'], ['providers', 'rag'], ['lumiverse'], ['overview', 'optimizer'],
    ]);
    expect(groups[0].panels[1].moduleId).toBe('block-editor');
  });

  it('keeps ungrouped plugin settings accessible as their own category', () => {
    expect(groupSettingsPanels([panel('custom-plugin')])[0]).toMatchObject({ id: 'custom-plugin', label: 'custom-plugin' });
  });
});
