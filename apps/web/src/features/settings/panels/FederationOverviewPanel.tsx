import { useModules } from '../../../lib/registry/hooks';
import { ModuleToggle } from '../ModuleToggle';

export function FederationOverviewPanel() {
  const modules = useModules().filter(module => module.category === 'connection');
  return (
    <div className="space-y-5">
      <div>
        <h3 className="settings-heading">Connections & sync</h3>
        <p className="settings-description">Connect the apps you use, then open their tabs to configure them.</p>
      </div>
      <div className="settings-list">
        {modules.map(module => <ModuleToggle key={module.id} module={module} />)}
      </div>
      <p className="text-sm text-dark-muted">Lumiverse and SillyTavern support direct sending without enabling Federation sync.</p>
      <section className="settings-section">
        <h4 className="font-medium">Archive favorites</h4>
        <p className="settings-description">Favorites save locally without Chub. Send a card from Archive to link it with Architect; stars and unstars then sync automatically while Archive is running.</p>
      </section>
    </div>
  );
}
