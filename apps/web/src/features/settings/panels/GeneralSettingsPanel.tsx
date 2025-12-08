import { useSettingsStore } from '../../../store/settings-store';
import { getDeploymentConfig } from '../../../config/deployment';

export function GeneralSettingsPanel() {
  const {
    linkedImageArchivalEnabled,
    setLinkedImageArchivalEnabled,
  } = useSettingsStore((state) => ({
    linkedImageArchivalEnabled: state.features?.linkedImageArchivalEnabled ?? false,
    setLinkedImageArchivalEnabled: state.setLinkedImageArchivalEnabled,
  }));

  const deploymentConfig = getDeploymentConfig();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">General Settings</h3>
        <p className="text-dark-muted">
          Configure application-wide settings and behaviors.
        </p>
      </div>

      {/* Linked Image Archival - Only available in full mode */}
      {deploymentConfig.mode === 'full' && (
        <div className="border border-dark-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                Linked Image Archival
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Destructive</span>
              </h4>
              <p className="text-sm text-dark-muted mt-1">
                Archive external images from first message and alternate greetings as local assets.
                Original URLs are preserved for export to JSON/PNG formats.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={linkedImageArchivalEnabled}
                onChange={(e) => setLinkedImageArchivalEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
          {linkedImageArchivalEnabled && (
            <div className="pt-4 border-t border-dark-border">
              <div className="p-3 bg-amber-900/20 border border-amber-600 rounded">
                <p className="text-sm text-amber-200">
                  <strong>Warning:</strong> This feature modifies card content. A snapshot backup is automatically created before archiving.
                  Use the "Convert Linked Images" button in the Assets tab to archive images for the current card.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-dark-bg rounded border border-dark-border">
        <p className="text-sm text-dark-muted">
          Module-specific settings have been moved to their respective tabs in the Module Settings row above.
        </p>
        <ul className="text-xs text-dark-muted mt-2 space-y-1 list-disc list-inside">
          <li><strong>Auto-Snapshot</strong> → Diff module settings</li>
          <li><strong>Creator's Notes HTML</strong> → Focused module settings</li>
          <li><strong>Focused Editor Fields</strong> → Focused module settings</li>
        </ul>
      </div>
    </div>
  );
}
