/**
 * ComfyUI Settings Panel
 *
 * Configure ComfyUI server and workflow settings.
 * Workflows are JSON files, editable and deletable.
 */

import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../../store/settings-store';

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  injectionMap?: {
    positive_prompt?: string;
    negative_prompt?: string;
    seed?: string;
    hires_seed?: string;
    filename_prefix?: string;
    checkpoint?: string;
    width_height?: string;
  };
  workflow?: Record<string, unknown>;
}

interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'character' | 'scenario' | 'portrait' | 'background' | 'custom';
  prompt: string;
  negativePrompt?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function ComfyUISettings() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  const comfyUISettings = useSettingsStore((state) => state.comfyUI);
  const setComfyUIServerUrl = useSettingsStore((state) => state.setComfyUIServerUrl);
  const setComfyUIActiveWorkflow = useSettingsStore((state) => state.setComfyUIActiveWorkflow);
  const setComfyUIActivePrompt = useSettingsStore((state) => state.setComfyUIActivePrompt);

  useEffect(() => {
    loadWorkflows();
    loadPromptTemplates();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/comfyui/workflows');
      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch {
      setStatus('Failed to load workflows');
    }
    setLoading(false);
  };

  const loadPromptTemplates = async () => {
    try {
      const response = await fetch('/api/comfyui/prompts');
      const data = await response.json();
      setPromptTemplates(data.promptTemplates || []);
    } catch {
      console.error('Failed to load prompt templates');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const confirmed = window.confirm('Delete this prompt template? This cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/comfyui/prompts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to delete');
        return;
      }
      setStatus('Template deleted.');
      loadPromptTemplates();
    } catch {
      setStatus('Failed to delete template');
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    const isNew = !promptTemplates.find((t) => t.id === editingTemplate.id);

    try {
      const response = await fetch(
        isNew ? '/api/comfyui/prompts' : `/api/comfyui/prompts/${editingTemplate.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingTemplate.name,
            description: editingTemplate.description,
            type: editingTemplate.type,
            prompt: editingTemplate.prompt,
            negativePrompt: editingTemplate.negativePrompt,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to save');
        return;
      }

      setStatus('Template saved.');
      setEditingTemplate(null);
      loadPromptTemplates();
    } catch {
      setStatus('Failed to save template');
    }
  };

  const handleExportTemplates = () => {
    const data = JSON.stringify({ promptTemplates }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comfyui-prompt-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplates = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const templates = data.promptTemplates || data;

      if (!Array.isArray(templates)) {
        setStatus('Invalid template file format');
        return;
      }

      // Import each template
      let imported = 0;
      for (const template of templates) {
        if (template.name && template.prompt) {
          const response = await fetch('/api/comfyui/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: template.name,
              description: template.description,
              type: template.type || 'custom',
              prompt: template.prompt,
              negativePrompt: template.negativePrompt,
            }),
          });
          if (response.ok) imported++;
        }
      }

      setStatus(`Imported ${imported} template(s).`);
      loadPromptTemplates();
    } catch {
      setStatus('Failed to parse template file');
    }

    e.target.value = '';
  };

  const createNewTemplate = () => {
    setEditingTemplate({
      id: `new-${Date.now()}`,
      name: '',
      description: '',
      type: 'custom',
      prompt: '',
      negativePrompt: '',
    });
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
      loadWorkflows();
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
      loadWorkflows();
    } catch {
      setStatus('Failed to parse workflow file');
    }

    e.target.value = '';
  };

  const handleEditWorkflow = async (workflow: WorkflowItem) => {
    // Fetch full workflow data if not already loaded
    try {
      const response = await fetch(`/api/comfyui/workflows/${workflow.id}`);
      const data = await response.json();
      setEditingWorkflow(data.workflow || workflow);
    } catch {
      setEditingWorkflow(workflow);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!editingWorkflow) return;

    try {
      const response = await fetch(`/api/comfyui/workflows/${editingWorkflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingWorkflow.name,
          description: editingWorkflow.description,
          injectionMap: editingWorkflow.injectionMap,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to save');
        return;
      }

      setStatus('Workflow saved.');
      setEditingWorkflow(null);
      loadWorkflows();
    } catch {
      setStatus('Failed to save workflow');
    }
  };

  const handleExportWorkflows = () => {
    const data = JSON.stringify({ workflows }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comfyui-workflows-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleWorkflow = (wf: WorkflowItem) => {
    // Export just the ComfyUI workflow JSON (for import into ComfyUI)
    const data = JSON.stringify(wf.workflow, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wf.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get text node IDs from workflow for injection mapping
  const getTextNodeOptions = (workflow: Record<string, unknown> | undefined): Array<{id: string, title: string}> => {
    if (!workflow) return [];

    const nodes: Array<{id: string, title: string}> = [];
    for (const [nodeId, node] of Object.entries(workflow)) {
      const nodeData = node as Record<string, unknown>;
      if (nodeData.class_type === 'CLIPTextEncode' ||
          nodeData.class_type === 'CLIPTextEncodeSDXL' ||
          nodeData.class_type === 'CLIPTextEncodeSDXLRefiner') {
        const meta = nodeData._meta as Record<string, string> | undefined;
        nodes.push({
          id: nodeId,
          title: meta?.title || `${nodeData.class_type} (${nodeId})`,
        });
      }
    }
    return nodes;
  };

  // Get sampler/seed node IDs from workflow
  const getSeedNodeOptions = (workflow: Record<string, unknown> | undefined): Array<{id: string, title: string}> => {
    if (!workflow) return [];

    const nodes: Array<{id: string, title: string}> = [];
    for (const [nodeId, node] of Object.entries(workflow)) {
      const nodeData = node as Record<string, unknown>;
      if (nodeData.class_type === 'KSampler' ||
          nodeData.class_type === 'KSamplerAdvanced' ||
          nodeData.class_type === 'SamplerCustom') {
        const meta = nodeData._meta as Record<string, string> | undefined;
        nodes.push({
          id: nodeId,
          title: meta?.title || `${nodeData.class_type} (${nodeId})`,
        });
      }
    }
    return nodes;
  };

  // Get checkpoint loader node IDs
  const getCheckpointNodeOptions = (workflow: Record<string, unknown> | undefined): Array<{id: string, title: string}> => {
    if (!workflow) return [];

    const nodes: Array<{id: string, title: string}> = [];
    for (const [nodeId, node] of Object.entries(workflow)) {
      const nodeData = node as Record<string, unknown>;
      if (nodeData.class_type === 'CheckpointLoaderSimple' ||
          nodeData.class_type === 'CheckpointLoader') {
        const meta = nodeData._meta as Record<string, string> | undefined;
        nodes.push({
          id: nodeId,
          title: meta?.title || `${nodeData.class_type} (${nodeId})`,
        });
      }
    }
    return nodes;
  };

  // Get EmptyLatentImage node IDs for width/height
  const getLatentNodeOptions = (workflow: Record<string, unknown> | undefined): Array<{id: string, title: string}> => {
    if (!workflow) return [];

    const nodes: Array<{id: string, title: string}> = [];
    for (const [nodeId, node] of Object.entries(workflow)) {
      const nodeData = node as Record<string, unknown>;
      if (nodeData.class_type === 'EmptyLatentImage' ||
          nodeData.class_type === 'EmptySD3LatentImage') {
        const meta = nodeData._meta as Record<string, string> | undefined;
        nodes.push({
          id: nodeId,
          title: meta?.title || `${nodeData.class_type} (${nodeId})`,
        });
      }
    }
    return nodes;
  };

  // Get SaveImage node IDs for filename
  const getSaveImageNodeOptions = (workflow: Record<string, unknown> | undefined): Array<{id: string, title: string}> => {
    if (!workflow) return [];

    const nodes: Array<{id: string, title: string}> = [];
    for (const [nodeId, node] of Object.entries(workflow)) {
      const nodeData = node as Record<string, unknown>;
      if (nodeData.class_type === 'SaveImage' ||
          nodeData.class_type === 'PreviewImage') {
        const meta = nodeData._meta as Record<string, string> | undefined;
        nodes.push({
          id: nodeId,
          title: meta?.title || `${nodeData.class_type} (${nodeId})`,
        });
      }
    }
    return nodes;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">ComfyUI Configuration</h3>
        <p className="text-dark-muted">
          Configure ComfyUI server connection and manage workflows.
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

      {/* Server Configuration & Workflows */}
      <div className="border border-dark-border rounded-lg p-6 space-y-6">
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
            The address of your ComfyUI server
          </p>
        </div>

        {/* Workflows Section */}
        <div className="pt-4 border-t border-dark-border">
          <div className="flex justify-between items-center mb-3">
            <h5 className="font-medium">Workflows</h5>
            <div className="flex gap-2">
              <select
                value={comfyUISettings.activeWorkflowId || ''}
                onChange={(e) => setComfyUIActiveWorkflow(e.target.value || null)}
                className="bg-dark-card border border-dark-border rounded px-3 py-1 text-sm"
              >
                <option value="">-- Select default workflow --</option>
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
              </select>
              <button
                onClick={handleExportWorkflows}
                disabled={workflows.length === 0}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Export All
              </button>
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

          <div className="space-y-2 max-h-64 overflow-auto">
            {loading ? (
              <div className="text-center py-4 text-dark-muted">Loading...</div>
            ) : workflows.length === 0 ? (
              <p className="text-sm text-dark-muted text-center py-4">
                No workflows. Import a ComfyUI workflow JSON file.
              </p>
            ) : (
              workflows.map((wf) => (
                <div
                  key={wf.id}
                  className="border border-dark-border rounded p-3"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{wf.name}</span>
                      {wf.description && (
                        <p className="text-xs text-dark-muted">{wf.description}</p>
                      )}
                      {wf.injectionMap && Object.keys(wf.injectionMap).length > 0 && (
                        <p className="text-xs text-green-400 mt-1">
                          Mapped: {Object.keys(wf.injectionMap).filter(k => (wf.injectionMap as Record<string, string>)[k]).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditWorkflow(wf)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleExportSingleWorkflow(wf)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        title="Export as ComfyUI JSON"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(wf.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Workflow Editor Modal */}
      {editingWorkflow && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Workflow: {editingWorkflow.name}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editingWorkflow.name}
                  onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={editingWorkflow.description || ''}
                  onChange={(e) => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                />
              </div>

              {/* Injection Map Editor */}
              <div className="pt-4 border-t border-dark-border">
                <h4 className="font-medium mb-3">Node Mapping (Injection Map)</h4>
                <p className="text-xs text-dark-muted mb-4">
                  Map workflow nodes to injection points. Select which nodes receive prompts, seeds, etc.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Positive Prompt */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Positive Prompt Node</label>
                    <select
                      value={editingWorkflow.injectionMap?.positive_prompt || ''}
                      onChange={(e) => setEditingWorkflow({
                        ...editingWorkflow,
                        injectionMap: { ...editingWorkflow.injectionMap, positive_prompt: e.target.value || undefined },
                      })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                    >
                      <option value="">-- None --</option>
                      {getTextNodeOptions(editingWorkflow.workflow).map((n) => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Negative Prompt */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Negative Prompt Node</label>
                    <select
                      value={editingWorkflow.injectionMap?.negative_prompt || ''}
                      onChange={(e) => setEditingWorkflow({
                        ...editingWorkflow,
                        injectionMap: { ...editingWorkflow.injectionMap, negative_prompt: e.target.value || undefined },
                      })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                    >
                      <option value="">-- None --</option>
                      {getTextNodeOptions(editingWorkflow.workflow).map((n) => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Seed */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Seed Node (KSampler)</label>
                    <select
                      value={editingWorkflow.injectionMap?.seed || ''}
                      onChange={(e) => setEditingWorkflow({
                        ...editingWorkflow,
                        injectionMap: { ...editingWorkflow.injectionMap, seed: e.target.value || undefined },
                      })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                    >
                      <option value="">-- None --</option>
                      {getSeedNodeOptions(editingWorkflow.workflow).map((n) => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* HiRes Seed */}
                  <div>
                    <label className="block text-sm font-medium mb-1">HiRes Seed Node (optional)</label>
                    <select
                      value={editingWorkflow.injectionMap?.hires_seed || ''}
                      onChange={(e) => setEditingWorkflow({
                        ...editingWorkflow,
                        injectionMap: { ...editingWorkflow.injectionMap, hires_seed: e.target.value || undefined },
                      })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                    >
                      <option value="">-- None --</option>
                      {getSeedNodeOptions(editingWorkflow.workflow).map((n) => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Checkpoint */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Checkpoint Loader Node</label>
                    <select
                      value={editingWorkflow.injectionMap?.checkpoint || ''}
                      onChange={(e) => setEditingWorkflow({
                        ...editingWorkflow,
                        injectionMap: { ...editingWorkflow.injectionMap, checkpoint: e.target.value || undefined },
                      })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                    >
                      <option value="">-- None --</option>
                      {getCheckpointNodeOptions(editingWorkflow.workflow).map((n) => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Width/Height */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Width/Height Node</label>
                    <select
                      value={editingWorkflow.injectionMap?.width_height || ''}
                      onChange={(e) => setEditingWorkflow({
                        ...editingWorkflow,
                        injectionMap: { ...editingWorkflow.injectionMap, width_height: e.target.value || undefined },
                      })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                    >
                      <option value="">-- None --</option>
                      {getLatentNodeOptions(editingWorkflow.workflow).map((n) => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filename Prefix */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Filename Prefix Node</label>
                    <select
                      value={editingWorkflow.injectionMap?.filename_prefix || ''}
                      onChange={(e) => setEditingWorkflow({
                        ...editingWorkflow,
                        injectionMap: { ...editingWorkflow.injectionMap, filename_prefix: e.target.value || undefined },
                      })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                    >
                      <option value="">-- None --</option>
                      {getSaveImageNodeOptions(editingWorkflow.workflow).map((n) => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Manual ID Entry */}
                <div className="mt-4 pt-4 border-t border-dark-border">
                  <p className="text-xs text-dark-muted mb-2">
                    Or enter node IDs manually (comma-separated format: positive_prompt:416, negative_prompt:417, etc.)
                  </p>
                  <input
                    type="text"
                    placeholder="positive_prompt:416, negative_prompt:417, seed:204"
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm font-mono"
                    onChange={(e) => {
                      const text = e.target.value;
                      const map: Record<string, string> = {};
                      text.split(',').forEach((pair) => {
                        const [key, val] = pair.trim().split(':');
                        if (key && val) {
                          map[key.trim()] = val.trim();
                        }
                      });
                      if (Object.keys(map).length > 0) {
                        setEditingWorkflow({
                          ...editingWorkflow,
                          injectionMap: { ...editingWorkflow.injectionMap, ...map },
                        });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => setEditingWorkflow(null)}
                  className="px-4 py-2 bg-dark-border text-white rounded hover:bg-dark-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWorkflow}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Templates */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Prompt Templates</h4>
          <div className="flex gap-2">
            <select
              value={comfyUISettings.activePromptId || ''}
              onChange={(e) => setComfyUIActivePrompt(e.target.value || null)}
              className="bg-dark-card border border-dark-border rounded px-3 py-1 text-sm"
            >
              <option value="">-- Select default template --</option>
              {promptTemplates.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
            <button
              onClick={handleExportTemplates}
              disabled={promptTemplates.length === 0}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Export
            </button>
            <label className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportTemplates}
                className="hidden"
              />
            </label>
            <button
              onClick={createNewTemplate}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              New
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-auto">
          {promptTemplates.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-4">
              No templates. Create or import prompt templates.
            </p>
          ) : (
            promptTemplates.map((pt) => (
              <div
                key={pt.id}
                className="border border-dark-border rounded p-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pt.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-dark-border rounded">{pt.type}</span>
                    </div>
                    {pt.description && (
                      <p className="text-xs text-dark-muted mt-1">{pt.description}</p>
                    )}
                    <p className="text-xs text-dark-muted mt-1 truncate">{pt.prompt.slice(0, 100)}...</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => setEditingTemplate(pt)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(pt.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Template Editor Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">
              {promptTemplates.find((t) => t.id === editingTemplate.id) ? 'Edit' : 'New'} Prompt Template
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="My Template"
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={editingTemplate.type}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, type: e.target.value as PromptTemplate['type'] })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                  >
                    <option value="character">Character (Full Body)</option>
                    <option value="portrait">Portrait (Face)</option>
                    <option value="scenario">Scenario (Scene)</option>
                    <option value="background">Background</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={editingTemplate.description || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  placeholder="Short description of what this template does"
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Prompt Template</label>
                <p className="text-xs text-dark-muted mb-2">
                  Use {'{{char}}'} for character name, {'{{user}}'} for user name. This text is sent to the LLM to generate the image prompt.
                </p>
                <textarea
                  value={editingTemplate.prompt}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, prompt: e.target.value })}
                  rows={6}
                  placeholder="Describe {{char}}'s appearance in detail for image generation..."
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Default Negative Prompt</label>
                <textarea
                  value={editingTemplate.negativePrompt || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, negativePrompt: e.target.value })}
                  rows={2}
                  placeholder="blurry, low quality, deformed..."
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 bg-dark-border text-white rounded hover:bg-dark-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!editingTemplate.name || !editingTemplate.prompt}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
