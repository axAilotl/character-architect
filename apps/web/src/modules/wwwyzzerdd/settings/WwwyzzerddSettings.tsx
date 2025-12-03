/**
 * wwwyzzerdd Settings Panel
 *
 * Configure the AI character creation wizard prompts and personality.
 */

import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../../store/settings-store';

interface WwwyzzerddPromptSet {
  id: string;
  name: string;
  description?: string;
  characterPrompt: string;
  lorePrompt: string;
  personality: string;
  isDefault?: boolean;
}

export function WwwyzzerddSettings() {
  const [promptSets, setPromptSets] = useState<WwwyzzerddPromptSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingPromptSet, setEditingPromptSet] = useState<Partial<WwwyzzerddPromptSet> | null>(null);

  const wwwyzzerddSettings = useSettingsStore((state) => state.wwwyzzerdd);
  const setWwwyzzerddActivePromptSet = useSettingsStore((state) => state.setWwwyzzerddActivePromptSet);

  useEffect(() => {
    loadPromptSets();
  }, []);

  const loadPromptSets = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/wwwyzzerdd/prompts');
      const data = await response.json();
      setPromptSets(data.promptSets || []);
    } catch (err) {
      setStatus('Failed to load prompt sets');
    }
    setLoading(false);
  };

  const handleSavePromptSet = async () => {
    if (!editingPromptSet || !editingPromptSet.name || !editingPromptSet.characterPrompt || !editingPromptSet.lorePrompt || !editingPromptSet.personality) {
      setStatus('Name, Character Prompt, Lore Prompt, and Personality are required.');
      return;
    }

    try {
      const method = editingPromptSet.id ? 'PATCH' : 'POST';
      const url = editingPromptSet.id
        ? `/api/wwwyzzerdd/prompts/${editingPromptSet.id}`
        : '/api/wwwyzzerdd/prompts';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPromptSet.name,
          description: editingPromptSet.description,
          characterPrompt: editingPromptSet.characterPrompt,
          lorePrompt: editingPromptSet.lorePrompt,
          personality: editingPromptSet.personality,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to save');
        return;
      }

      setEditingPromptSet(null);
      setStatus(editingPromptSet.id ? 'Prompt set updated.' : 'Prompt set created.');
      loadPromptSets();
    } catch {
      setStatus('Failed to save prompt set');
    }
  };

  const handleDeletePromptSet = async (id: string) => {
    const confirmed = window.confirm('Delete this prompt set? This cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/wwwyzzerdd/prompts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to delete');
        return;
      }
      setStatus('Prompt set deleted.');
      loadPromptSets();
    } catch {
      setStatus('Failed to delete prompt set');
    }
  };

  const handleCopyPromptSet = async (id: string) => {
    try {
      const response = await fetch(`/api/wwwyzzerdd/prompts/${id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to copy');
        return;
      }
      setStatus('Prompt set copied.');
      loadPromptSets();
    } catch {
      setStatus('Failed to copy prompt set');
    }
  };

  const handleExportPrompts = async () => {
    try {
      const response = await fetch('/api/wwwyzzerdd/prompts/export/all');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wwwyzzerdd-prompts.json';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Prompts exported.');
    } catch {
      setStatus('Failed to export prompts');
    }
  };

  const handleImportPrompts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const response = await fetch('/api/wwwyzzerdd/prompts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptSets: json.promptSets || [] }),
      });

      const result = await response.json();
      if (!response.ok) {
        setStatus(result.error || 'Failed to import');
        return;
      }

      setStatus(`Imported ${result.imported} prompt set(s).`);
      loadPromptSets();
    } catch {
      setStatus('Failed to parse import file');
    }

    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">wwwyzzerdd Configuration</h3>
        <p className="text-dark-muted">
          Configure the AI character creation wizard prompts and personality.
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

      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Prompt Sets</h4>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors cursor-pointer">
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImportPrompts}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExportPrompts}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Export
          </button>
          <button
            onClick={() => setEditingPromptSet({
              name: '',
              description: '',
              characterPrompt: '',
              lorePrompt: '',
              personality: '',
            })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + New Prompt Set
          </button>
        </div>
      </div>

      <div className="border border-dark-border rounded-lg p-4">
        <label className="block text-sm font-medium mb-2">Active Prompt Set</label>
        <select
          value={wwwyzzerddSettings.activePromptSetId || ''}
          onChange={(e) => setWwwyzzerddActivePromptSet(e.target.value || null)}
          className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
        >
          <option value="">-- Select a prompt set --</option>
          {promptSets.map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.name}</option>
          ))}
        </select>
        <p className="text-xs text-dark-muted mt-1">
          The active prompt set determines how wwwyzzerdd behaves when assisting with character creation.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-dark-muted">Loading prompt sets...</div>
      ) : (
        <div className="space-y-3">
          {promptSets.map((ps) => (
            <div
              key={ps.id}
              className={`border rounded-lg p-4 ${
                ps.isDefault
                  ? 'border-dark-border bg-dark-card/50'
                  : 'border-dark-border hover:border-purple-500'
              } transition-colors`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h6 className="font-semibold">{ps.name}</h6>
                    {ps.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                        Built-in
                      </span>
                    )}
                  </div>
                  {ps.description && (
                    <p className="text-sm text-dark-muted mt-1">{ps.description}</p>
                  )}
                  <details className="mt-2">
                    <summary className="text-xs text-dark-muted cursor-pointer hover:text-dark-text">
                      Show prompts
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <span className="text-xs font-medium">Character Prompt:</span>
                        <pre className="mt-1 text-xs bg-dark-bg p-2 rounded border border-dark-border whitespace-pre-wrap max-h-32 overflow-auto">
                          {ps.characterPrompt}
                        </pre>
                      </div>
                      <div>
                        <span className="text-xs font-medium">Lore Prompt:</span>
                        <pre className="mt-1 text-xs bg-dark-bg p-2 rounded border border-dark-border whitespace-pre-wrap max-h-32 overflow-auto">
                          {ps.lorePrompt}
                        </pre>
                      </div>
                      <div>
                        <span className="text-xs font-medium">Personality:</span>
                        <pre className="mt-1 text-xs bg-dark-bg p-2 rounded border border-dark-border whitespace-pre-wrap max-h-32 overflow-auto">
                          {ps.personality}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleCopyPromptSet(ps.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    title="Create editable copy"
                  >
                    Copy
                  </button>
                  {!ps.isDefault && (
                    <>
                      <button
                        onClick={() => setEditingPromptSet(ps)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePromptSet(ps.id)}
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

          {promptSets.length === 0 && (
            <div className="text-center py-8 text-dark-muted">
              No prompt sets found. Default sets will be created on first load.
            </div>
          )}
        </div>
      )}

      {/* Prompt Set Editor */}
      {editingPromptSet && (
        <div className="border border-purple-500 rounded-lg p-6 bg-dark-bg">
          <h4 className="text-lg font-semibold mb-4">
            {editingPromptSet.id ? 'Edit Prompt Set' : 'New Prompt Set'}
          </h4>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={editingPromptSet.name || ''}
                  onChange={(e) =>
                    setEditingPromptSet({ ...editingPromptSet, name: e.target.value })
                  }
                  placeholder="e.g., Creative Wizard"
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={editingPromptSet.description || ''}
                  onChange={(e) =>
                    setEditingPromptSet({ ...editingPromptSet, description: e.target.value })
                  }
                  placeholder="Brief description"
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Character Prompt *</label>
              <textarea
                value={editingPromptSet.characterPrompt || ''}
                onChange={(e) =>
                  setEditingPromptSet({ ...editingPromptSet, characterPrompt: e.target.value })
                }
                placeholder="System prompt for character creation assistance..."
                rows={6}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lore Prompt *</label>
              <textarea
                value={editingPromptSet.lorePrompt || ''}
                onChange={(e) =>
                  setEditingPromptSet({ ...editingPromptSet, lorePrompt: e.target.value })
                }
                placeholder="System prompt for lore/worldbuilding assistance..."
                rows={4}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Personality *</label>
              <textarea
                value={editingPromptSet.personality || ''}
                onChange={(e) =>
                  setEditingPromptSet({ ...editingPromptSet, personality: e.target.value })
                }
                placeholder="How wwwyzzerdd should speak and behave..."
                rows={3}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingPromptSet(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePromptSet}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
