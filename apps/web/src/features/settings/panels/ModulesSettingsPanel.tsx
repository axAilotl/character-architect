import { useSettingsStore } from '../../../store/settings-store';
import { useModules } from '../../../lib/registry/hooks';
import { registry } from '../../../lib/registry';
import { getDeploymentConfig } from '../../../config/deployment';
import type { ModuleDefinition } from '../../../lib/registry/types';

// Helper to get toggle switch classes based on module color
const getToggleColorClasses = (color: ModuleDefinition['color']) => {
  const colorMap: Record<string, { ring: string; bg: string; badge: string; text: string }> = {
    blue: { ring: 'peer-focus:ring-blue-500', bg: 'peer-checked:bg-blue-500', badge: 'bg-blue-500/20 text-blue-400', text: 'text-blue-400' },
    purple: { ring: 'peer-focus:ring-purple-500', bg: 'peer-checked:bg-purple-500', badge: 'bg-purple-500/20 text-purple-400', text: 'text-purple-400' },
    green: { ring: 'peer-focus:ring-green-500', bg: 'peer-checked:bg-green-500', badge: 'bg-green-500/20 text-green-400', text: 'text-green-400' },
    orange: { ring: 'peer-focus:ring-orange-500', bg: 'peer-checked:bg-orange-500', badge: 'bg-orange-500/20 text-orange-400', text: 'text-orange-400' },
    red: { ring: 'peer-focus:ring-red-500', bg: 'peer-checked:bg-red-500', badge: 'bg-red-500/20 text-red-400', text: 'text-red-400' },
    pink: { ring: 'peer-focus:ring-pink-500', bg: 'peer-checked:bg-pink-500', badge: 'bg-pink-500/20 text-pink-400', text: 'text-pink-400' },
    cyan: { ring: 'peer-focus:ring-cyan-500', bg: 'peer-checked:bg-cyan-500', badge: 'bg-cyan-500/20 text-cyan-400', text: 'text-cyan-400' },
    amber: { ring: 'peer-focus:ring-amber-500', bg: 'peer-checked:bg-amber-500', badge: 'bg-amber-500/20 text-amber-400', text: 'text-amber-400' },
    teal: { ring: 'peer-focus:ring-teal-500', bg: 'peer-checked:bg-teal-500', badge: 'bg-teal-500/20 text-teal-400', text: 'text-teal-400' },
  };
  return colorMap[color || 'blue'] || colorMap.blue;
};

export function ModulesSettingsPanel() {
  const allRegisteredModules = useModules();
  const deploymentConfig = getDeploymentConfig();
  const features = useSettingsStore((state) => state.features);
  const setModuleEnabled = useSettingsStore((state) => state.setModuleEnabled);

  // Filter out modules that shouldn't appear in LITE/static modes
  const registeredModules = deploymentConfig.mode === 'full'
    ? allRegisteredModules
    : allRegisteredModules.filter(m => !['federation', 'sillytavern'].includes(m.id));

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
        const colorClasses = getToggleColorClasses(module.color);
        const enabled = isModuleEnabled(module);
        return (
          <div key={module.id} className="border border-dark-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold flex items-center gap-2">
                  {module.name}
                  {module.badge && (
                    <span className={`px-2 py-0.5 ${colorClasses.badge} text-xs rounded`}>
                      {module.badge}
                    </span>
                  )}
                </h4>
                <p className="text-sm text-dark-muted mt-1">
                  {module.description}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => handleModuleToggle(module, e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 ${colorClasses.ring} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${colorClasses.bg}`}></div>
              </label>
            </div>
            {enabled && (
              <div className="pt-4 border-t border-dark-border">
                <p className="text-xs text-dark-muted">
                  Configure settings in the{' '}
                  <span className={`${colorClasses.text}`}>
                    {module.name} tab
                  </span>.
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
