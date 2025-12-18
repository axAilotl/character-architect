/**
 * Modules Settings Panel
 *
 * Enable and configure optional modules from the registry.
 * Note: This panel uses dynamic registry data rather than AutoForm
 * since module fields are generated at runtime.
 */

import { useSettingsStore } from '../../../store/settings-store';
import { useModules } from '../../../lib/registry/hooks';
import { registry } from '../../../lib/registry';
import { getModuleToggleColors } from '../../../lib/schemas/settings/modules';
import type { ModuleDefinition } from '../../../lib/registry/types';

export function ModulesSettingsPanel() {
  // Get modules from registry - server-only modules are already filtered by the module loader
  // based on their requiresServer metadata property
  const registeredModules = useModules();
  const features = useSettingsStore((state) => state.features);
  const setModuleEnabled = useSettingsStore((state) => state.setModuleEnabled);

  // Check if a module is enabled based on its feature flag
  const isModuleEnabled = (module: ModuleDefinition): boolean => {
    const flagName = registry.moduleIdToFlagName(module.id);
    return features?.[flagName] ?? module.defaultEnabled;
  };

  // Handle module toggle
  const handleModuleToggle = (module: ModuleDefinition, enabled: boolean) => {
    const camelId = module.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    setModuleEnabled(camelId, enabled);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Modules</h3>
        <p className="text-dark-muted">
          Enable and configure optional modules. Enabled modules appear as tabs in the editor.
        </p>
      </div>

      {/* Dynamic Module Toggles */}
      {registeredModules.map((module) => {
        const colorClasses = getModuleToggleColors(module.color);
        const enabled = isModuleEnabled(module);
        const unavailable = module.unavailableInCurrentMode;
        return (
          <div
            key={module.id}
            className={`border border-dark-border rounded-lg p-6 space-y-4 ${unavailable ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold flex items-center gap-2">
                  {module.name}
                  {module.badge && (
                    <span className={`px-2 py-0.5 ${colorClasses.badge} text-xs rounded`}>
                      {module.badge}
                    </span>
                  )}
                  {unavailable && (
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                      Requires Server
                    </span>
                  )}
                </h4>
                <p className="text-sm text-dark-muted mt-1">{module.description}</p>
              </div>
              <label
                className={`relative inline-flex items-center ${unavailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={enabled && !unavailable}
                  onChange={(e) => !unavailable && handleModuleToggle(module, e.target.checked)}
                  disabled={unavailable}
                  className="sr-only peer"
                />
                <div
                  className={`w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 ${colorClasses.ring} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${unavailable ? 'opacity-50' : colorClasses.bg}`}
                ></div>
              </label>
            </div>
            {enabled && !unavailable && (
              <div className="pt-4 border-t border-dark-border">
                <p className="text-xs text-dark-muted">
                  Configure settings in the{' '}
                  <span className={`${colorClasses.text}`}>{module.name} tab</span>.
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Module Info */}
      <div className="p-4 bg-dark-bg rounded border border-dark-border">
        <h5 className="font-medium text-sm mb-2">About Modules</h5>
        <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
          <li>Enabled modules appear as tabs in the character editor</li>
          <li>Module state is saved locally in your browser</li>
          <li>Disabling a module hides it but preserves your data</li>
          <li>Module-specific settings appear in their dedicated tabs when enabled</li>
        </ul>
      </div>
    </div>
  );
}
