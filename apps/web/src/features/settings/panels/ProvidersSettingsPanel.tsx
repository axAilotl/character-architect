/**
 * Providers Settings Panel
 *
 * Configure LLM providers with connection testing and model fetching.
 */

import { useState, useEffect } from 'react';
import { useLLMStore } from '../../../store/llm-store';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import type { ProviderConfig } from '../../../lib/types';

type ProviderKind = 'openai' | 'anthropic' | 'openai-compatible';

export function ProvidersSettingsPanel() {
  const {
    settings,
    loadSettings,
    addProvider,
    updateProvider,
    removeProvider,
    testConnection,
    fetchModelsForProvider,
    getCachedModels,
  } = useLLMStore();

  const [editingProvider, setEditingProvider] = useState<Partial<ProviderConfig> | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [modelFetchLoading, setModelFetchLoading] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setModelFetchError(null);
    setModelFetchLoading(false);
  }, [editingProvider?.id]);

  const handleSaveProvider = async () => {
    if (!editingProvider || !editingProvider.id) return;

    try {
      if (settings.providers.find((p) => p.id === editingProvider.id)) {
        await updateProvider(editingProvider.id, editingProvider as ProviderConfig);
      } else {
        await addProvider(editingProvider as ProviderConfig);
      }
      setEditingProvider(null);
    } catch (error) {
      alert(`Failed to save provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    const result = await testConnection(providerId);
    setTestResults((prev) => ({ ...prev, [providerId]: result }));
  };

  const handleNewProvider = () => {
    setEditingProvider({
      id: `provider-${Date.now()}`,
      kind: 'openai',
      name: 'New Provider',
      baseURL: 'https://api.openai.com',
      apiKey: '',
      defaultModel: 'gpt-4',
      mode: 'chat',
      streamDefault: true,
      temperature: 0.7,
      maxTokens: 2048,
    });
  };

  const updateField = <K extends keyof ProviderConfig>(field: K, value: ProviderConfig[K]) => {
    if (!editingProvider) return;
    setEditingProvider({ ...editingProvider, [field]: value });
  };

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold">Configured Providers</h3>
        <button
          onClick={handleNewProvider}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + Add Provider
        </button>
      </div>

      {/* Provider List */}
      <div className="space-y-3 mb-6">
        {settings.providers.map((provider) => (
          <div
            key={provider.id}
            className="border border-dark-border rounded-lg p-4 hover:border-blue-500 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">{provider.name}</h4>
                <p className="text-sm text-dark-muted">
                  {provider.kind} • {provider.defaultModel}
                </p>
                <p className="text-xs text-dark-muted mt-1">{provider.baseURL}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTestConnection(provider.id)}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Test
                </button>
                <button
                  onClick={() => setEditingProvider({ ...provider })}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeProvider(provider.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Test Result */}
            {testResults[provider.id] && (
              <div
                className={`mt-2 p-2 rounded text-sm ${
                  testResults[provider.id].success
                    ? 'bg-green-900 text-green-200'
                    : 'bg-red-900 text-red-200'
                }`}
              >
                {testResults[provider.id].success
                  ? '✓ Connection successful'
                  : `✗ ${testResults[provider.id].error}`}
              </div>
            )}
          </div>
        ))}

        {settings.providers.length === 0 && (
          <div className="text-center py-8 text-dark-muted">
            No providers configured. Click "Add Provider" to get started.
          </div>
        )}
      </div>

      {/* Provider Editor */}
      {editingProvider && (
        <div className="border border-blue-500 rounded-lg p-6 bg-dark-bg">
          <h4 className="text-lg font-semibold mb-4">
            {settings.providers.find((p) => p.id === editingProvider.id)
              ? 'Edit Provider'
              : 'New Provider'}
          </h4>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={editingProvider.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="My Provider"
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Kind */}
            <div>
              <label className="block text-sm font-medium mb-1">Provider Type</label>
              <select
                value={editingProvider.kind || 'openai'}
                onChange={(e) => updateField('kind', e.target.value as ProviderKind)}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="openai">OpenAI</option>
                <option value="openai-compatible">OpenAI-Compatible</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium mb-1">Base URL</label>
              <input
                type="text"
                value={editingProvider.baseURL || ''}
                onChange={(e) => updateField('baseURL', e.target.value)}
                placeholder="https://api.openai.com"
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <input
                type="password"
                value={editingProvider.apiKey || ''}
                onChange={(e) => updateField('apiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Temperature: {editingProvider.temperature ?? 0.7}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={editingProvider.temperature ?? 0.7}
                onChange={(e) => updateField('temperature', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens</label>
              <input
                type="number"
                value={editingProvider.maxTokens ?? 2048}
                onChange={(e) => updateField('maxTokens', parseInt(e.target.value) || 2048)}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Stream Default */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="streamDefault"
                checked={editingProvider.streamDefault ?? true}
                onChange={(e) => updateField('streamDefault', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="streamDefault" className="text-sm">Enable streaming by default</label>
            </div>

            {/* Mode (OpenAI only) */}
            {(editingProvider.kind === 'openai' || editingProvider.kind === 'openai-compatible') && (
              <div>
                <label className="block text-sm font-medium mb-1">Mode</label>
                <select
                  value={editingProvider.mode || 'chat'}
                  onChange={(e) => updateField('mode', e.target.value as 'chat' | 'responses')}
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="chat">Chat Completions</option>
                  <option value="responses">Responses API</option>
                </select>
              </div>
            )}

            {/* Organization (OpenAI only) */}
            {(editingProvider.kind === 'openai' || editingProvider.kind === 'openai-compatible') && (
              <div>
                <label className="block text-sm font-medium mb-1">Organization ID (Optional)</label>
                <input
                  type="text"
                  value={editingProvider.organization || ''}
                  onChange={(e) => updateField('organization', e.target.value)}
                  placeholder="org-..."
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Anthropic Version */}
            {editingProvider.kind === 'anthropic' && (
              <div>
                <label className="block text-sm font-medium mb-1">Anthropic Version</label>
                <input
                  type="text"
                  value={editingProvider.anthropicVersion || ''}
                  onChange={(e) => updateField('anthropicVersion', e.target.value)}
                  placeholder="2023-06-01"
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Model selector */}
            <div>
              <label className="block text-sm font-medium mb-1">Default Model</label>
              <div className="flex gap-2">
                {editingProvider.id && getCachedModels(editingProvider.id).length > 0 ? (
                  <SearchableSelect
                    options={getCachedModels(editingProvider.id)}
                    value={editingProvider.defaultModel || ''}
                    onChange={(value) => updateField('defaultModel', value)}
                    placeholder="Search models..."
                    className="flex-1"
                  />
                ) : (
                  <input
                    type="text"
                    value={editingProvider.defaultModel || ''}
                    onChange={(e) => updateField('defaultModel', e.target.value)}
                    placeholder="gpt-4, claude-3-opus, etc."
                    className="flex-1 bg-dark-card border border-dark-border rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                )}
                <button
                  onClick={async () => {
                    if (!editingProvider.id) {
                      alert('Please save provider first');
                      return;
                    }

                    if (!editingProvider.baseURL || !editingProvider.apiKey) {
                      alert('Please enter Base URL and API Key first');
                      return;
                    }

                    setModelFetchLoading(true);
                    setModelFetchError(null);

                    const result = await fetchModelsForProvider(editingProvider.id);
                    setModelFetchLoading(false);

                    if (!result.success) {
                      setModelFetchError(result.error || 'Failed to fetch models');
                    } else if (!editingProvider.defaultModel && result.models && result.models.length > 0) {
                      updateField('defaultModel', result.models[0]);
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors whitespace-nowrap disabled:opacity-60"
                  title="Fetch available models from provider"
                  disabled={modelFetchLoading}
                >
                  {modelFetchLoading ? 'Fetching...' : 'Fetch Models'}
                </button>
              </div>
              {modelFetchError && (
                <p className="text-xs text-red-300 mt-1">{modelFetchError}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-dark-border">
              <button
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProvider}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
