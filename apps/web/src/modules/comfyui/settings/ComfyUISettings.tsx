/**
 * ComfyUI Settings Panel
 *
 * Configure ComfyUI integration settings, workflows, and prompt templates.
 */

import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../../store/settings-store';

interface ComfyUIPromptTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'character' | 'scenario' | 'portrait' | 'background' | 'custom';
  prompt: string;
  negativePrompt?: string;
  isDefault?: boolean;
}

interface ComfyUIWorkflowItem {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

export function ComfyUISettings() {
  const [promptTemplates, setPromptTemplates] = useState<ComfyUIPromptTemplate[]>([]);
  const [workflows, setWorkflows] = useState<ComfyUIWorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Partial<ComfyUIPromptTemplate> | null>(null);

  const comfyUISettings = useSettingsStore((state) => state.comfyUI);
  const setComfyUIServerUrl = useSettingsStore((state) => state.setComfyUIServerUrl);
  const setComfyUIActiveWorkflow = useSettingsStore((state) => state.setComfyUIActiveWorkflow);
  const setComfyUIAutoSelectType = useSettingsStore((state) => state.setComfyUIAutoSelectType);
  const setComfyUIAutoGenerateFilename = useSettingsStore((state) => state.setComfyUIAutoGenerateFilename);
  const setComfyUIDefaults = useSettingsStore((state) => state.setComfyUIDefaults);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const [promptsRes, workflowsRes] = await Promise.all([
        fetch('/api/comfyui/prompts'),
        fetch('/api/comfyui/workflows'),
      ]);
      const promptsData = await promptsRes.json();
      const workflowsData = await workflowsRes.json();
      setPromptTemplates(promptsData.promptTemplates || []);
      setWorkflows(workflowsData.workflows || []);
    } catch {
      setStatus('Failed to load ComfyUI data');
    }
    setLoading(false);
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt || !editingPrompt.name || !editingPrompt.type || !editingPrompt.prompt) {
      setStatus('Name, type, and prompt are required.');
      return;
    }

    try {
      const method = editingPrompt.id ? 'PATCH' : 'POST';
      const url = editingPrompt.id
        ? `/api/comfyui/prompts/${editingPrompt.id}`
        : '/api/comfyui/prompts';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPrompt.name,
          description: editingPrompt.description,
          type: editingPrompt.type,
          prompt: editingPrompt.prompt,
          negativePrompt: editingPrompt.negativePrompt,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to save');
        return;
      }

      setEditingPrompt(null);
      setStatus(editingPrompt.id ? 'Prompt template updated.' : 'Prompt template created.');
      loadData();
    } catch {
      setStatus('Failed to save prompt template');
    }
  };

  const handleDeletePrompt = async (id: string) => {
    const confirmed = window.confirm('Delete this prompt template? This cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/comfyui/prompts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to delete');
        return;
      }
      setStatus('Prompt template deleted.');
      loadData();
    } catch {
      setStatus('Failed to delete prompt template');
    }
  };

  const handleCopyPrompt = async (id: string) => {
    try {
      const response = await fetch(`/api/comfyui/prompts/${id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to copy');
        return;
      }
      setStatus('Prompt template copied.');
      loadData();
    } catch {
      setStatus('Failed to copy prompt template');
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    const confirmed = window.confirm('Delete this workflow? This cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/comfyui/workflows/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to delete');
        return;
      }
      setStatus('Workflow deleted.');
      loadData();
    } catch {
      setStatus('Failed to delete workflow');
    }
  };

  const handleImportWorkflow = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const workflow = JSON.parse(text);
      const name = file.name.replace(/\.json$/, '');

      const response = await fetch('/api/comfyui/workflows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, workflow }),
      });

      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to import');
        return;
      }

      setStatus('Workflow imported.');
      loadData();
    } catch {
      setStatus('Failed to parse workflow file');
    }

    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">ComfyUI Configuration</h3>
        <p className="text-dark-muted">
          Configure ComfyUI integration settings, workflows, and prompt templates.
          <span className="text-yellow-400 ml-2">(Scaffolding - not yet connected)</span>
        </p>
      </div>

      {status && (
        <div className={`p-2 rounded text-sm ${
          status.includes('Failed') || status.includes('required')
            ? 'bg-red-900/30 border border-red-700 text-red-100'
            : 'bg-green-900/20 border border-green-700 text-green-100'
        }`}>
          {status}
        </div>
      )}

      {/* Server Configuration */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Server Configuration</h4>
        <div>
          <label className="block text-sm font-medium mb-1">ComfyUI Server URL</label>
          <input
            type="text"
            value={comfyUISettings.serverUrl}
            onChange={(e) => setComfyUIServerUrl(e.target.value)}
            placeholder="http://127.0.0.1:8188"
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
          />
          <p className="text-xs text-dark-muted mt-1">
            The address of your ComfyUI server (not connected yet - for future use)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="comfyAutoSelectType"
              checked={comfyUISettings.autoSelectType}
              onChange={(e) => setComfyUIAutoSelectType(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="comfyAutoSelectType" className="text-sm">
              Auto-select asset type from prompt
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="comfyAutoFilename"
              checked={comfyUISettings.autoGenerateFilename}
              onChange={(e) => setComfyUIAutoGenerateFilename(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="comfyAutoFilename" className="text-sm">
              Auto-generate filenames
            </label>
          </div>
        </div>
      </div>

      {/* Default Generation Settings */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Default Generation Settings</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Sampler</label>
            <select
              value={comfyUISettings.defaultSampler}
              onChange={(e) => setComfyUIDefaults({ defaultSampler: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            >
              <option value="euler">euler</option>
              <option value="euler_ancestral">euler_ancestral</option>
              <option value="heun">heun</option>
              <option value="dpm_2">dpm_2</option>
              <option value="dpm_2_ancestral">dpm_2_ancestral</option>
              <option value="lms">lms</option>
              <option value="ddim">ddim</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scheduler</label>
            <select
              value={comfyUISettings.defaultScheduler}
              onChange={(e) => setComfyUIDefaults({ defaultScheduler: e.target.value })}
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            >
              <option value="normal">normal</option>
              <option value="karras">karras</option>
              <option value="exponential">exponential</option>
              <option value="sgm_uniform">sgm_uniform</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default Model</label>
            <input
              type="text"
              value={comfyUISettings.defaultModel}
              onChange={(e) => setComfyUIDefaults({ defaultModel: e.target.value })}
              placeholder="model.safetensors"
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Default Width</label>
            <input
              type="number"
              value={comfyUISettings.defaultWidth}
              onChange={(e) => setComfyUIDefaults({ defaultWidth: parseInt(e.target.value) || 512 })}
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default Height</label>
            <input
              type="number"
              value={comfyUISettings.defaultHeight}
              onChange={(e) => setComfyUIDefaults({ defaultHeight: parseInt(e.target.value) || 768 })}
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Negative Prompt Prefix</label>
          <textarea
            value={comfyUISettings.negativePrefix}
            onChange={(e) => setComfyUIDefaults({ negativePrefix: e.target.value })}
            placeholder="blurry, low quality..."
            rows={2}
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Prompt Templates */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Prompt Templates</h4>
          <button
            onClick={() => setEditingPrompt({
              name: '',
              description: '',
              type: 'character',
              prompt: '',
              negativePrompt: '',
            })}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + New Template
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4 text-dark-muted">Loading...</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {promptTemplates.map((pt) => (
              <div
                key={pt.id}
                className={`border rounded p-3 ${
                  pt.isDefault ? 'border-dark-border bg-dark-card/50' : 'border-dark-border'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pt.name}</span>
                      <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                        {pt.type}
                      </span>
                      {pt.isDefault && (
                        <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                          Built-in
                        </span>
                      )}
                    </div>
                    {pt.description && (
                      <p className="text-xs text-dark-muted mt-1">{pt.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleCopyPrompt(pt.id)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Copy
                    </button>
                    {!pt.isDefault && (
                      <>
                        <button
                          onClick={() => setEditingPrompt(pt)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(pt.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
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
        )}

        {/* Prompt Template Editor */}
        {editingPrompt && (
          <div className="border border-green-500 rounded-lg p-4 bg-dark-bg mt-4">
            <h5 className="font-semibold mb-3">
              {editingPrompt.id ? 'Edit Template' : 'New Template'}
            </h5>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={editingPrompt.name || ''}
                    onChange={(e) =>
                      setEditingPrompt({ ...editingPrompt, name: e.target.value })
                    }
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select
                    value={editingPrompt.type || 'character'}
                    onChange={(e) =>
                      setEditingPrompt({ ...editingPrompt, type: e.target.value as ComfyUIPromptTemplate['type'] })
                    }
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
                  >
                    <option value="character">Character</option>
                    <option value="scenario">Scenario</option>
                    <option value="portrait">Portrait</option>
                    <option value="background">Background</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prompt *</label>
                <textarea
                  value={editingPrompt.prompt || ''}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, prompt: e.target.value })
                  }
                  rows={4}
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Negative Prompt</label>
                <textarea
                  value={editingPrompt.negativePrompt || ''}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, negativePrompt: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingPrompt(null)}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrompt}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workflows */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Workflows</h4>
          <div className="flex gap-2">
            <select
              value={comfyUISettings.activeWorkflowId || ''}
              onChange={(e) => setComfyUIActiveWorkflow(e.target.value || null)}
              className="bg-dark-card border border-dark-border rounded px-3 py-1 text-sm"
            >
              <option value="">-- Select active workflow --</option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>{wf.name}</option>
              ))}
            </select>
            <label className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportWorkflow}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="space-y-2 max-h-48 overflow-auto">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`border rounded p-3 ${
                wf.isDefault ? 'border-dark-border bg-dark-card/50' : 'border-dark-border'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{wf.name}</span>
                  {wf.isDefault && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                      Built-in
                    </span>
                  )}
                  {wf.description && (
                    <p className="text-xs text-dark-muted">{wf.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {!wf.isDefault && (
                    <button
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {workflows.length === 0 && (
            <p className="text-sm text-dark-muted text-center py-4">
              No workflows. Import a ComfyUI workflow JSON file.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
