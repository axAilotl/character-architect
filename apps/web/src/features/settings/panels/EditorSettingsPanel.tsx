import { useSettingsStore } from '../../../store/settings-store';

export function EditorSettingsPanel() {
  const {
    editor,
    setShowV3Fields,
    setExportSpec,
    setShowExtensionsTab,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Editor Settings</h3>
        <p className="text-dark-muted">
          Configure how the character card editor behaves.
        </p>
      </div>

      {/* Export Spec */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Export Format</h4>
        <p className="text-sm text-dark-muted">
          Choose the default spec version for PNG and JSON exports. CHARX is always V3, Voxta uses its own format.
        </p>

        <div>
          <label className="block text-sm font-medium mb-1">Export Spec</label>
          <select
            value={editor.exportSpec}
            onChange={(e) => setExportSpec(e.target.value as 'v2' | 'v3')}
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
          >
            <option value="v3">CCv3 (Character Card v3)</option>
            <option value="v2">CCv2 (Character Card v2)</option>
          </select>
          <p className="text-xs text-dark-muted mt-1">
            V3 includes additional fields like timestamps, group greetings, and multilingual notes.
          </p>
        </div>
      </div>

      {/* V3 Fields Toggle */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">V3 Field Visibility</h4>
        <p className="text-sm text-dark-muted">
          Control visibility of CCv3-only fields in the editor.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showV3Fields"
            checked={editor.showV3Fields}
            onChange={(e) => setShowV3Fields(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="showV3Fields" className="text-sm font-medium">
            Show V3-Only Fields
          </label>
        </div>

        <div className="p-3 bg-dark-bg rounded border border-dark-border">
          <h5 className="font-medium text-sm mb-2">V3-Only Fields</h5>
          <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
            <li>Group Only Greetings</li>
            <li>Source URLs</li>
            <li>Multilingual Creator Notes</li>
            <li>Metadata Timestamps</li>
          </ul>
        </div>
      </div>

      {/* Extensions Tab Toggle */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Extensions Tab</h4>
        <p className="text-sm text-dark-muted">
          Show or hide the Extensions tab in the editor.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showExtensionsTab"
            checked={editor.showExtensionsTab}
            onChange={(e) => setShowExtensionsTab(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="showExtensionsTab" className="text-sm font-medium">
            Show Extensions Tab
          </label>
        </div>
      </div>

      <div className="p-3 bg-dark-bg rounded border border-dark-border">
        <p className="text-xs text-dark-muted">
          <strong>Focused Editor Fields</strong> have been moved to the Focused module settings tab.
        </p>
      </div>
    </div>
  );
}
