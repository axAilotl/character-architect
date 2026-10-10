import { useState, Suspense, type KeyboardEvent } from 'react';
import { useSettingsPanels, useModules } from '../../lib/registry/hooks';
import { groupSettingsPanels } from '../../lib/registry/settings-navigation';
import { ModuleToggle } from '../../features/settings/ModuleToggle';
import { Dialog } from '../ui/Dialog';

interface SettingsModalProps { isOpen: boolean; onClose: () => void }

function moveTab(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[index]?.focus();
  tabs[index]?.click();
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [categoryId, setCategoryId] = useState('general');
  const [selectedPanels, setSelectedPanels] = useState<Record<string, string>>({});
  const panels = useSettingsPanels();
  const modules = useModules();
  const categories = groupSettingsPanels(panels);
  const category = categories.find(item => item.id === categoryId) ?? categories[0];
  const panel = category?.panels.find(item => item.id === selectedPanels[category.id]) ?? category?.panels[0];
  const module = panel?.moduleId ? modules.find(item => item.id === panel.moduleId) : undefined;

  if (!isOpen) return null;
  return (
    <Dialog label="Settings" onClose={onClose} className="settings-dialog">
      <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-dark-border shrink-0">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-dark-muted mt-0.5">Make Architect your own.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      <div role="tablist" aria-label="Settings categories" onKeyDown={moveTab} className="settings-categories">
        {categories.map(item => (
          <button key={item.id} id={`settings-category-${item.id}`} type="button" role="tab"
            aria-selected={category?.id === item.id} aria-controls="settings-category-content"
            tabIndex={category?.id === item.id ? 0 : -1}
            className="settings-tab" onClick={() => setCategoryId(item.id)}>{item.label}</button>
        ))}
      </div>
      {category && <div role="tabpanel" id="settings-category-content" aria-labelledby={`settings-category-${category.id}`} className="flex flex-col min-h-0 flex-1">
        {category.panels.length > 1 && (
          <div role="tablist" aria-label={`${category.label} settings`} onKeyDown={moveTab} className="settings-subtabs">
            {category.panels.map(item => (
              <button key={item.id} id={`settings-panel-${item.id}`} type="button" role="tab" aria-selected={panel?.id === item.id}
                aria-controls="settings-panel-content" tabIndex={panel?.id === item.id ? 0 : -1}
                className="settings-subtab" onClick={() => setSelectedPanels(previous => ({ ...previous, [category.id]: item.id }))}>{item.label}</button>
            ))}
          </div>
        )}
        <div key={panel?.id} id="settings-panel-content" role={category.panels.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={category.panels.length > 1 ? `settings-panel-${panel?.id}` : undefined}
          className="settings-content flex-1 overflow-y-auto px-5 sm:px-7 py-6">
          <div className="max-w-4xl mx-auto">
            {module && <div className="settings-list mb-6"><ModuleToggle module={module} /></div>}
            {panel && <Suspense fallback={<p className="text-dark-muted" role="status">Loading {panel.label} settings…</p>}><panel.component /></Suspense>}
          </div>
        </div>
      </div>}
    </Dialog>
  );
}
