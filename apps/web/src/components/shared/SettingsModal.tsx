/**
 * Settings Modal for Application Configuration
 */

import { useState, Suspense } from 'react';
import { TemplateSnippetPanel } from '../../features/editor/components/TemplateSnippetPanel';
import { useSettingsPanels, useModules } from '../../lib/registry/hooks';
import { registry } from '../../lib/registry';
import type { SettingsPanelDefinition, ModuleDefinition } from '../../lib/registry/types';
import { useSettingsStore } from '../../store/settings-store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<string>('general');

  // Get all registered settings panels
  const allSettingsPanels = useSettingsPanels();

  // Separate core panels and module panels
  const coreSettingsPanels = allSettingsPanels.filter(
    (panel) => panel.row === 'main' || !panel.row
  );
  const moduleSettingsPanels = allSettingsPanels.filter((panel) => panel.row === 'modules');

  // Get registered modules for dynamic toggles in the sub-nav
  // We only show module tabs if the module is enabled
  const allRegisteredModules = useModules();
  const features = useSettingsStore((state) => state.features);

  // Check if a module is enabled based on its feature flag
  const isModuleEnabled = (module: ModuleDefinition): boolean => {
    const flagName = registry.moduleIdToFlagName(module.id);
    return features?.[flagName] ?? module.defaultEnabled;
  };

  // Helper to get color class for panel tab
  const getColorClass = (color: SettingsPanelDefinition['color'], isActive: boolean) => {
    const colorMap: Record<string, { active: string; inactive: string }> = {
      blue: {
        active: 'border-b-2 border-blue-500 text-blue-500',
        inactive: 'text-dark-muted hover:text-dark-text',
      },
      purple: {
        active: 'border-b-2 border-purple-500 text-purple-500',
        inactive: 'text-dark-muted hover:text-dark-text',
      },
      green: {
        active: 'border-b-2 border-green-500 text-green-500',
        inactive: 'text-dark-muted hover:text-dark-text',
      },
      orange: {
        active: 'border-b-2 border-orange-500 text-orange-500',
        inactive: 'text-dark-muted hover:text-dark-text',
      },
      red: {
        active: 'border-b-2 border-red-500 text-red-500',
        inactive: 'text-dark-muted hover:text-dark-text',
      },
      pink: {
        active: 'border-b-2 border-pink-500 text-pink-500',
        inactive: 'text-dark-muted hover:text-pink-text',
      },
      cyan: {
        active: 'border-b-2 border-cyan-500 text-cyan-500',
        inactive: 'text-dark-muted hover:text-cyan-text',
      },
      amber: {
        active: 'border-b-2 border-amber-500 text-amber-500',
        inactive: 'text-dark-muted hover:text-amber-text',
      },
      teal: {
        active: 'border-b-2 border-teal-500 text-teal-500',
        inactive: 'text-dark-muted hover:text-teal-text',
      },
    };
    const classes = colorMap[color || 'blue'] || colorMap.blue;
    return isActive ? classes.active : classes.inactive;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-5xl h-[67vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-border flex justify-between items-center">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-dark-text transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Settings Tabs - Row 1: Core */}
        <div className="flex border-b border-dark-border overflow-x-auto">
          {coreSettingsPanels.map((panel) => (
            <button
              key={panel.id}
              className={`font-medium transition-colors whitespace-nowrap ${getColorClass(
                panel.color,
                activeTab === panel.id
              )}`}
              onClick={() => setActiveTab(panel.id)}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {/* Settings Tabs - Row 2: Module Settings (only if modules are enabled) */}
        {moduleSettingsPanels.filter((panel) => {
          const module = allRegisteredModules.find((m) => m.id === panel.id);
          return !module || isModuleEnabled(module);
        }).length > 0 && (
          <div className="flex border-b border-dark-border overflow-x-auto bg-dark-bg/50">
            {moduleSettingsPanels.map((panel) => {
              const module = allRegisteredModules.find((m) => m.id === panel.id);
              if (module && !isModuleEnabled(module)) {
                return null;
              }
              return (
                <button
                  key={panel.id}
                  className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${getColorClass(panel.color, activeTab === panel.id)}`}
                  onClick={() => setActiveTab(panel.id)}
                >
                  {panel.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {allSettingsPanels.map(
            (panel) =>
              activeTab === panel.id && (
                <Suspense key={panel.id} fallback={<div>Loading {panel.label} settings...</div>}>
                  <panel.component />
                </Suspense>
              )
          )}

          {/* Special Case: Templates (Legacy, not yet a registered panel) */}
          {activeTab === 'templates' && (
            <TemplateSnippetPanel
              isOpen={true}
              onClose={() => {}}
              manageMode={true}
              embedded={true}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
