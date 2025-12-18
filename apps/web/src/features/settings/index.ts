import { registry } from '../../lib/registry';
import { GeneralSettingsPanel } from './panels/GeneralSettingsPanel';
import { ModulesSettingsPanel } from './panels/ModulesSettingsPanel';
import { EditorSettingsPanel } from './panels/EditorSettingsPanel';
import { ThemeSettingsPanel } from './panels/ThemeSettingsPanel';
import { ProvidersSettingsPanel } from './panels/ProvidersSettingsPanel';
import { RagSettingsPanel } from './panels/RagSettingsPanel';
import { PresetsSettingsPanel } from './panels/PresetsSettingsPanel';
import { BackupRestorePanel } from './panels/BackupRestorePanel';
import { TemplatesSettingsPanel } from './panels/TemplatesSettingsPanel';

export function registerCoreSettingsPanels() {
  registry.registerSettingsPanel({
    id: 'general',
    label: 'General',
    component: GeneralSettingsPanel,
    order: 10,
    color: 'blue',
  });

  registry.registerSettingsPanel({
    id: 'modules',
    label: 'Modules',
    component: ModulesSettingsPanel,
    order: 15,
    color: 'orange',
  });

  registry.registerSettingsPanel({
    id: 'editor',
    label: 'Editor',
    component: EditorSettingsPanel,
    order: 25,
    color: 'blue',
  });

  registry.registerSettingsPanel({
    id: 'themes',
    label: 'Themes',
    component: ThemeSettingsPanel,
    order: 20,
    color: 'blue',
  });

  registry.registerSettingsPanel({
    id: 'providers',
    label: 'AI Providers',
    component: ProvidersSettingsPanel,
    order: 40,
    color: 'blue',
  });

  registry.registerSettingsPanel({
    id: 'rag',
    label: 'RAG',
    component: RagSettingsPanel,
    order: 50,
    color: 'blue',
  });

  registry.registerSettingsPanel({
    id: 'templates',
    label: 'Templates',
    component: TemplatesSettingsPanel,
    order: 60,
    color: 'blue',
  });

  registry.registerSettingsPanel({
    id: 'presets',
    label: 'LLM Presets',
    component: PresetsSettingsPanel,
    order: 70,
    color: 'blue',
  });

  registry.registerSettingsPanel({
    id: 'backup',
    label: 'Backup & Restore',
    component: BackupRestorePanel,
    order: 80,
    color: 'green',
  });

  // Add more core settings panels here as they are extracted
}
