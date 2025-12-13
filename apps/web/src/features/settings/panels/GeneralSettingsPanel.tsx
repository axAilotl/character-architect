import { AutoForm } from '@character-foundry/app-framework';
import { useSettingsStore } from '../../../store/settings-store';
import { getDeploymentConfig } from '../../../config/deployment';
import {
  generalSettingsSchema,
  generalSettingsUiHints,
  type GeneralSettings,
} from '../../../lib/schemas/settings/general';

export function GeneralSettingsPanel() {
  const { linkedImageArchivalEnabled, setLinkedImageArchivalEnabled } =
    useSettingsStore((state) => ({
      linkedImageArchivalEnabled:
        state.features?.linkedImageArchivalEnabled ?? false,
      setLinkedImageArchivalEnabled: state.setLinkedImageArchivalEnabled,
    }));

  const deploymentConfig = getDeploymentConfig();

  const values: GeneralSettings = {
    linkedImageArchivalEnabled,
  };

  const handleChange = (updated: GeneralSettings) => {
    if (updated.linkedImageArchivalEnabled !== linkedImageArchivalEnabled) {
      setLinkedImageArchivalEnabled(updated.linkedImageArchivalEnabled);
    }
  };

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
          <AutoForm
            schema={generalSettingsSchema}
            values={values}
            onChange={handleChange}
            uiHints={generalSettingsUiHints}
          />
          {linkedImageArchivalEnabled && (
            <div className="pt-4 border-t border-dark-border">
              <div className="p-3 bg-amber-900/20 border border-amber-600 rounded">
                <p className="text-sm text-amber-200">
                  <strong>Warning:</strong> This feature modifies card content.
                  A snapshot backup is automatically created before archiving.
                  Use the "Convert Linked Images" button in the Assets tab to
                  archive images for the current card.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-dark-bg rounded border border-dark-border">
        <p className="text-sm text-dark-muted">
          Module-specific settings have been moved to their respective tabs in
          the Module Settings row above.
        </p>
        <ul className="text-xs text-dark-muted mt-2 space-y-1 list-disc list-inside">
          <li>
            <strong>Auto-Snapshot</strong> → Diff module settings
          </li>
          <li>
            <strong>Creator's Notes HTML</strong> → Focused module settings
          </li>
          <li>
            <strong>Focused Editor Fields</strong> → Focused module settings
          </li>
        </ul>
      </div>
    </div>
  );
}
