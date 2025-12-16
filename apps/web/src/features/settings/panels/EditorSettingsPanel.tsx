import { AutoForm } from '@character-foundry/character-foundry/app-framework';
import { useSettingsStore } from '../../../store/settings-store';
import {
  editorSettingsSchema,
  editorSettingsUiHints,
  type EditorSettings,
} from '../../../lib/schemas/settings/editor';

export function EditorSettingsPanel() {
  const { editor, setShowV3Fields, setExportSpec, setShowExtensionsTab } =
    useSettingsStore();

  const values: EditorSettings = {
    showV3Fields: editor.showV3Fields,
    exportSpec: editor.exportSpec,
    showExtensionsTab: editor.showExtensionsTab,
  };

  const handleChange = (updated: EditorSettings) => {
    if (updated.showV3Fields !== editor.showV3Fields) {
      setShowV3Fields(updated.showV3Fields);
    }
    if (updated.exportSpec !== editor.exportSpec) {
      setExportSpec(updated.exportSpec);
    }
    if (updated.showExtensionsTab !== editor.showExtensionsTab) {
      setShowExtensionsTab(updated.showExtensionsTab);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Editor Settings</h3>
        <p className="text-dark-muted">
          Configure how the character card editor behaves.
        </p>
      </div>

      <div className="border border-dark-border rounded-lg p-6">
        <AutoForm
          schema={editorSettingsSchema}
          values={values}
          onChange={handleChange}
          uiHints={editorSettingsUiHints}
        />
      </div>

      <div className="p-3 bg-dark-bg rounded border border-dark-border">
        <h5 className="font-medium text-sm mb-2">V3-Only Fields Include</h5>
        <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
          <li>Group Only Greetings</li>
          <li>Source URLs</li>
          <li>Multilingual Creator Notes</li>
          <li>Metadata Timestamps</li>
        </ul>
      </div>

      <div className="p-3 bg-dark-bg rounded border border-dark-border">
        <p className="text-xs text-dark-muted">
          <strong>Focused Editor Fields</strong> have been moved to the Focused
          module settings tab.
        </p>
      </div>
    </div>
  );
}
