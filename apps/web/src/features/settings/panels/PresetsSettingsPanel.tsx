import { useState, useEffect } from 'react';
import { AutoForm } from '@character-foundry/app-framework';
import { useSettingsStore } from '../../../store/settings-store';
import { api } from '../../../lib/api';
import { getDeploymentConfig } from '../../../config/deployment';
import { defaultPresets } from '../../../lib/default-presets';
import {
  presetEditorSchema,
  presetEditorUiHints,
  aiPromptsSchema,
  aiPromptsUiHints,
  type PresetEditor,
  type AIPrompts,
} from '../../../lib/schemas/settings/presets';
import type { UserPreset, CreatePresetRequest } from '../../../lib/types';

export function PresetsSettingsPanel() {
  const { aiPrompts, setTagsSystemPrompt, setTaglineSystemPrompt } = useSettingsStore();

  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<Partial<UserPreset> | null>(null);
  const [presetStatus, setPresetStatus] = useState<string | null>(null);

  const DEFAULT_PRESETS = defaultPresets;

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    setPresetsLoading(true);
    setPresetError(null);

    if (isLightMode) {
      try {
        const stored = localStorage.getItem('ca-llm-presets');
        const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];
        setPresets([...DEFAULT_PRESETS, ...userPresets]);
      } catch {
        setPresets(DEFAULT_PRESETS);
      }
      setPresetsLoading(false);
      return;
    }

    const result = await api.getPresets();
    setPresetsLoading(false);

    if (result.error) {
      setPresetError(result.error);
      return;
    }

    setPresets(result.data?.presets || []);
  };

  const handleNewPreset = () => {
    setEditingPreset({
      name: '',
      description: '',
      instruction: '',
      category: 'custom',
    });
  };

  const handleSavePreset = async () => {
    if (!editingPreset || !editingPreset.name || !editingPreset.instruction) {
      setPresetStatus('Name and instruction are required.');
      return;
    }

    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      try {
        const stored = localStorage.getItem('ca-llm-presets');
        const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];

        const nowTs = new Date().toISOString();
        const newPreset: UserPreset = {
          id: editingPreset.id || crypto.randomUUID(),
          name: editingPreset.name,
          description: editingPreset.description || '',
          instruction: editingPreset.instruction,
          category: editingPreset.category as any || 'custom',
          isBuiltIn: false,
          createdAt: nowTs,
          updatedAt: nowTs,
        };

        if (editingPreset.id) {
          const idx = userPresets.findIndex(p => p.id === editingPreset.id);
          if (idx >= 0) {
            userPresets[idx] = newPreset;
          } else {
            userPresets.push(newPreset);
          }
        } else {
          userPresets.push(newPreset);
        }

        localStorage.setItem('ca-llm-presets', JSON.stringify(userPresets));
        setEditingPreset(null);
        setPresetStatus(editingPreset.id ? 'Preset updated.' : 'Preset created.');
        loadPresets();
      } catch {
        setPresetStatus('Failed to save preset.');
      }
      return;
    }

    const data: CreatePresetRequest = {
      name: editingPreset.name,
      description: editingPreset.description,
      instruction: editingPreset.instruction,
      category: editingPreset.category as any,
    };

    let result;
    if (editingPreset.id) {
      result = await api.updatePreset(editingPreset.id, data);
    } else {
      result = await api.createPreset(data);
    }

    if (result.error) {
      setPresetStatus(result.error);
      return;
    }

    setEditingPreset(null);
    setPresetStatus(editingPreset.id ? 'Preset updated.' : 'Preset created.');
    loadPresets();
  };

  const handleDeletePreset = async (id: string) => {
    const confirmed = window.confirm('Delete this preset? This cannot be undone.');
    if (!confirmed) return;

    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      try {
        const stored = localStorage.getItem('ca-llm-presets');
        const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];
        const updated = userPresets.filter(p => p.id !== id);
        localStorage.setItem('ca-llm-presets', JSON.stringify(updated));
        setPresetStatus('Preset deleted.');
        loadPresets();
      } catch {
        setPresetStatus('Failed to delete preset.');
      }
      return;
    }

    const result = await api.deletePreset(id);
    if (result.error) {
      setPresetStatus(result.error);
      return;
    }

    setPresetStatus('Preset deleted.');
    loadPresets();
  };

  const handleExportPresets = async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      try {
        const stored = localStorage.getItem('ca-llm-presets');
        const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];
        const allPresets = [...DEFAULT_PRESETS, ...userPresets];
        const blob = new Blob([JSON.stringify({ presets: allPresets }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'llm-presets.json';
        a.click();
        URL.revokeObjectURL(url);
        setPresetStatus('Presets exported.');
      } catch {
        setPresetStatus('Failed to export presets.');
      }
      return;
    }

    const result = await api.exportPresets();
    if (result.error) {
      setPresetStatus(result.error);
      return;
    }

    if (result.data) {
      const url = URL.createObjectURL(result.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'llm-presets.json';
      a.click();
      URL.revokeObjectURL(url);
      setPresetStatus('Presets exported.');
    }
  };

  const handleImportPresets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!Array.isArray(json.presets)) {
        setPresetStatus('Invalid preset file format.');
        e.target.value = '';
        return;
      }

      if (isLightMode) {
        const stored = localStorage.getItem('ca-llm-presets');
        const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];
        const customPresets = json.presets.filter((p: UserPreset) => !p.isBuiltIn);
        let imported = 0;

        for (const preset of customPresets) {
          if (userPresets.some(p => p.id === preset.id)) continue;
          userPresets.push({
            ...preset,
            id: preset.id || crypto.randomUUID(),
            isBuiltIn: false,
          });
          imported++;
        }

        localStorage.setItem('ca-llm-presets', JSON.stringify(userPresets));
        setPresetStatus(`Imported ${imported} preset(s).`);
        loadPresets();
        e.target.value = '';
        return;
      }

      const result = await api.importPresets(json.presets);
      if (result.error) {
        setPresetStatus(result.error);
        e.target.value = '';
        return;
      }

      if (result.data) {
        const { imported, failed, failures } = result.data;
        let message = `Imported ${imported} preset(s).`;
        if (failed > 0) {
          message += ` ${failed} failed: ${failures.map(f => f.name).join(', ')}`;
        }
        setPresetStatus(message);
        loadPresets();
      }
    } catch (err) {
      setPresetStatus('Failed to parse preset file.');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">LLM Presets</h3>
        <p className="text-dark-muted">
          Manage custom AI operation presets for rewriting, formatting, and generating content.
          Built-in presets cannot be modified.
        </p>
      </div>

      {(presetError || presetStatus) && (
        <div className="space-y-2">
          {presetError && (
            <div className="p-2 rounded bg-red-900/30 border border-red-700 text-red-100 text-sm">
              {presetError}
            </div>
          )}
          {presetStatus && (
            <div className="p-2 rounded bg-green-900/20 border border-green-700 text-green-100 text-sm">
              {presetStatus}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">All Presets</h4>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors cursor-pointer">
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImportPresets}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExportPresets}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Export
          </button>
          <button
            onClick={handleNewPreset}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + New Preset
          </button>
        </div>
      </div>

      {presetsLoading ? (
        <div className="text-center py-8 text-dark-muted">Loading presets...</div>
      ) : (
        <div className="space-y-4">
          {/* Group by category */}
          {(['rewrite', 'format', 'generate', 'custom'] as const).map((category) => {
            const categoryPresets = presets.filter((p) => p.category === category);
            if (categoryPresets.length === 0) return null;

            return (
              <div key={category} className="space-y-2">
                <h5 className="font-semibold text-sm text-dark-muted uppercase tracking-wider">
                  {category}
                </h5>
                {categoryPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`border rounded-lg p-4 ${
                      preset.isBuiltIn
                        ? 'border-dark-border bg-dark-card/50'
                        : 'border-dark-border hover:border-blue-500'
                    } ${preset.isHidden ? 'opacity-50' : ''} transition-colors`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {/* Show/Hide checkbox */}
                          <input
                            type="checkbox"
                            checked={!preset.isHidden}
                            onChange={async () => {
                              const cfg = getDeploymentConfig();
                              const isLight = cfg.mode === 'light' || cfg.mode === 'static';

                              if (isLight) {
                                try {
                                  const stored = localStorage.getItem('ca-llm-presets');
                                  const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];
                                  const idx = userPresets.findIndex(p => p.id === preset.id);
                                  if (idx >= 0) {
                                    userPresets[idx].isHidden = !userPresets[idx].isHidden;
                                    localStorage.setItem('ca-llm-presets', JSON.stringify(userPresets));
                                  }
                                  loadPresets();
                                } catch {
                                  setPresetStatus('Failed to toggle visibility.');
                                }
                                return;
                              }

                              const result = await api.togglePresetHidden(preset.id);
                              if (!result.error) {
                                loadPresets();
                              } else {
                                setPresetStatus(`Failed to toggle visibility: ${result.error}`);
                              }
                            }}
                            title={preset.isHidden ? 'Show in LLM Assist' : 'Hide from LLM Assist'}
                            className="rounded"
                          />
                          <h6 className="font-semibold">{preset.name}</h6>
                          {preset.isBuiltIn && (
                            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                              Built-in
                            </span>
                          )}
                          {preset.isHidden && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-700 text-yellow-200 rounded">
                              Hidden
                            </span>
                          )}
                        </div>
                        {preset.description && (
                          <p className="text-sm text-dark-muted mt-1">{preset.description}</p>
                        )}
                        <details className="mt-2">
                          <summary className="text-xs text-dark-muted cursor-pointer hover:text-dark-text">
                            Show instruction
                          </summary>
                          <pre className="mt-2 text-xs bg-dark-bg p-2 rounded border border-dark-border whitespace-pre-wrap">
                            {preset.instruction}
                          </pre>
                        </details>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {/* Copy button - always available */}
                        <button
                          onClick={async () => {
                            const cfg = getDeploymentConfig();
                            const isLight = cfg.mode === 'light' || cfg.mode === 'static';

                            if (isLight) {
                              try {
                                const stored = localStorage.getItem('ca-llm-presets');
                                const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];
                                const copyNow = new Date().toISOString();
                                const newPreset: UserPreset = {
                                  id: crypto.randomUUID(),
                                  name: `${preset.name} (Copy)`,
                                  description: preset.description || '',
                                  instruction: preset.instruction,
                                  category: 'custom',
                                  isBuiltIn: false,
                                  createdAt: copyNow,
                                  updatedAt: copyNow,
                                };
                                userPresets.push(newPreset);
                                localStorage.setItem('ca-llm-presets', JSON.stringify(userPresets));
                                setPresetStatus(`Copied "${preset.name}" as a new user preset`);
                                loadPresets();
                              } catch {
                                setPresetStatus('Failed to copy preset.');
                              }
                              return;
                            }

                            const result = await api.copyPreset(preset.id);
                            if (!result.error) {
                              setPresetStatus(`Copied "${preset.name}" as a new user preset`);
                              loadPresets();
                            } else {
                              setPresetStatus(`Failed to copy: ${result.error}`);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          title="Create editable copy"
                        >
                          Copy
                        </button>
                        {!preset.isBuiltIn && (
                          <>
                            <button
                              onClick={() => setEditingPreset(preset)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePreset(preset.id)}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {presets.length === 0 && (
            <div className="text-center py-8 text-dark-muted">
              No presets found. Built-in presets will be created automatically on first server start.
            </div>
          )}
        </div>
      )}

      {/* Preset Editor */}
      {editingPreset && (
        <div className="border border-blue-500 rounded-lg p-6 bg-dark-bg">
          <h4 className="text-lg font-semibold mb-4">
            {editingPreset.id ? 'Edit Preset' : 'New Preset'}
          </h4>

          <AutoForm
            schema={presetEditorSchema}
            values={{
              name: editingPreset.name || '',
              description: editingPreset.description || '',
              category: (editingPreset.category as PresetEditor['category']) || 'custom',
              instruction: editingPreset.instruction || '',
            }}
            onChange={(updated: PresetEditor) => {
              // Only update if values actually changed to prevent infinite loops
              const currentName = editingPreset.name || '';
              const currentDesc = editingPreset.description || '';
              const currentCat = editingPreset.category || 'custom';
              const currentInst = editingPreset.instruction || '';
              if (
                updated.name !== currentName ||
                updated.description !== currentDesc ||
                updated.category !== currentCat ||
                updated.instruction !== currentInst
              ) {
                setEditingPreset({ ...editingPreset, ...updated });
              }
            }}
            uiHints={presetEditorUiHints}
          />

          <div className="flex gap-2 justify-end pt-4 border-t border-dark-border">
            <button
              onClick={() => setEditingPreset(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePreset}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* AI Generation Prompts */}
      <div className="mt-8 border-t border-dark-border pt-6">
        <h3 className="text-lg font-semibold mb-2">AI Generation Prompts</h3>
        <p className="text-dark-muted mb-4">
          System prompts for the AI generate buttons (tags, tagline).
        </p>

        <AutoForm
          schema={aiPromptsSchema}
          values={aiPrompts}
          onChange={(updated: AIPrompts) => {
            if (updated.tagsSystemPrompt !== aiPrompts.tagsSystemPrompt) {
              setTagsSystemPrompt(updated.tagsSystemPrompt);
            }
            if (updated.taglineSystemPrompt !== aiPrompts.taglineSystemPrompt) {
              setTaglineSystemPrompt(updated.taglineSystemPrompt);
            }
          }}
          uiHints={aiPromptsUiHints}
        />
      </div>
    </div>
  );
}
