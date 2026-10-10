import { useSettingsStore } from '../../../store/settings-store';
import { getDeploymentConfig } from '../../../config/deployment';

export function GeneralSettingsPanel() {
  const { features, setAssetsEnabled, setDiffEnabled, setLinkedImageArchivalEnabled } = useSettingsStore();
  return (
    <div className="space-y-6">
      <div><h3 className="settings-heading">Workspace preferences</h3>
        <p className="settings-description">Choose the tools and storage behavior for your workspace.</p></div>
      <section className="settings-section space-y-4">
        <h4 className="font-medium">Card workspace</h4>
        <label className="flex items-start justify-between gap-6">
          <span><span className="block text-sm font-medium">Assets tab</span><span className="block text-sm text-dark-muted mt-1">Manage portraits, images, and files attached to cards.</span></span>
          <input className="module-switch" role="switch" type="checkbox" checked={features.assetsEnabled} onChange={event => setAssetsEnabled(event.target.checked)} />
        </label>
        <label className="flex items-start justify-between gap-6">
          <span><span className="block text-sm font-medium">Diff tab</span><span className="block text-sm text-dark-muted mt-1">Compare versions and restore snapshots.</span></span>
          <input className="module-switch" role="switch" type="checkbox" checked={features.diffEnabled} onChange={event => setDiffEnabled(event.target.checked)} />
        </label>
      </section>
      {getDeploymentConfig().mode === 'full' && <section className="settings-section space-y-3">
        <h4 className="font-medium">Image storage</h4>
        <label className="flex items-start justify-between gap-6">
          <span><span className="block text-sm font-medium">Linked image archival</span><span className="block text-sm text-dark-muted mt-1">Allow external images in greetings to be saved as local assets.</span></span>
          <input className="module-switch" role="switch" type="checkbox" checked={features.linkedImageArchivalEnabled} onChange={event => setLinkedImageArchivalEnabled(event.target.checked)} />
        </label>
        {features.linkedImageArchivalEnabled && <p className="text-sm text-dark-muted border-t border-dark-border pt-3">Use Convert Linked Images in Assets to archive a card’s images. This updates card content and creates a snapshot first; original URLs are preserved for export.</p>}
      </section>}
    </div>
  );
}
