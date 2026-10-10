import { useSettingsStore } from '../../store/settings-store';
import { isModuleEnabled } from '../../lib/module-state';
import type { ModuleDefinition } from '../../lib/registry/types';

export function ModuleToggle({ module }: { module: ModuleDefinition }) {
  const features = useSettingsStore(state => state.features);
  const setModuleEnabled = useSettingsStore(state => state.setModuleEnabled);
  const enabled = isModuleEnabled(module, features);
  const unavailable = module.unavailableInCurrentMode;
  return (
    <label className={`module-toggle ${unavailable ? 'opacity-60' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-medium">
          {module.name}
          <span className="text-xs font-normal text-dark-muted">{unavailable ? 'Full mode only' : enabled ? 'On' : 'Off'}</span>
        </span>
        <span className="block text-sm text-dark-muted mt-1 leading-relaxed">{module.description}</span>
      </span>
      <input type="checkbox" role="switch" aria-label={`Enable ${module.name}`} checked={enabled}
        disabled={unavailable} className="module-switch"
        onChange={event => setModuleEnabled(module.id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), event.target.checked)} />
    </label>
  );
}
