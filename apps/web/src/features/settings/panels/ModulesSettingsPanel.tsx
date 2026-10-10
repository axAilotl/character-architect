import { useModules } from '../../../lib/registry/hooks';
import { ModuleToggle } from '../ModuleToggle';

export function ModulesSettingsPanel() {
  const modules = useModules().filter(module => module.category !== 'editor');
  return (
    <div className="space-y-5">
      <div>
        <h3 className="settings-heading">Optional modules</h3>
        <p className="settings-description">Choose the tools you use. Disabling a module preserves its settings and data.</p>
      </div>
      <div className="settings-list">
        {modules.map(module => <ModuleToggle key={module.id} module={module} />)}
      </div>
      <p className="text-sm text-dark-muted">Editor choices live in Editors. Connection settings live in Federation. Other enabled modules appear in the tabs above.</p>
    </div>
  );
}
