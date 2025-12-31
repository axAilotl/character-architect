/**
 * Providers Settings Panel
 *
 * Configure LLM providers with connection testing and model fetching.
 * Uses AutoForm for the provider editor form, with manual handling for
 * provider list CRUD operations and model selection.
 */

import { useState, useEffect, useMemo } from 'react';
import { AutoForm } from '@character-foundry/character-foundry/app-framework';
import { useLLMStore } from '../../../store/llm-store';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import {
  providerConfigSchema,
  providerConfigUiHints,
} from '../../../lib/schemas/settings/provider';
import type { ProviderConfig } from '../../../lib/types';

// Create a schema without the defaultModel field (handled separately)
const providerEditorSchema = providerConfigSchema.omit({ defaultModel: true });

export function ProvidersSettingsPanel() {
  const {
    settings,
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

  useEffect(() => {
    setModelFetchError(null);
    setModelFetchLoading(false);
  }, [editingProvider?.id]);

  const handleSaveProvider = async () => {
    if (!editingProvider || !editingProvider.id) return;

    if (settings.providers.find((p) => p.id === editingProvider.id)) {
      await updateProvider(editingProvider.id, editingProvider as ProviderConfig);
    } else {
      await addProvider(editingProvider as ProviderConfig);
    }

    setEditingProvider(null);
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

  // Memoize UI hints to avoid object recreation
  const editorUiHints = useMemo(() => {
    const { defaultModel: _, ...rest } = providerConfigUiHints;
    return rest;
  }, []);

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
                  onClick={() => setEditingProvider(provider)}
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
            {/* AutoForm handles most fields */}
            <AutoForm
              schema={providerEditorSchema}
              values={{
                id: editingProvider.id ?? '',
                name: editingProvider.name ?? '',
                kind: editingProvider.kind ?? 'openai',
                baseURL: editingProvider.baseURL ?? '',
                apiKey: editingProvider.apiKey ?? '',
                temperature: editingProvider.temperature,
                maxTokens: editingProvider.maxTokens,
                streamDefault: editingProvider.streamDefault,
                mode: editingProvider.mode,
                organization: editingProvider.organization,
                anthropicVersion: editingProvider.anthropicVersion,
              }}
              onChange={(updated) => {
                // Only update if values actually changed to prevent infinite loops
                const hasChanges =
                  updated.id !== (editingProvider.id ?? '') ||
                  updated.name !== (editingProvider.name ?? '') ||
                  updated.kind !== (editingProvider.kind ?? 'openai') ||
                  updated.baseURL !== (editingProvider.baseURL ?? '') ||
                  updated.apiKey !== (editingProvider.apiKey ?? '') ||
                  updated.temperature !== editingProvider.temperature ||
                  updated.maxTokens !== editingProvider.maxTokens ||
                  updated.streamDefault !== editingProvider.streamDefault ||
                  updated.mode !== editingProvider.mode ||
                  updated.organization !== editingProvider.organization ||
                  updated.anthropicVersion !== editingProvider.anthropicVersion;
                if (hasChanges) {
                  setEditingProvider({ ...editingProvider, ...updated });
                }
              }}
              uiHints={editorUiHints}
            />

            {/* Model selector - handled manually due to async fetch behavior */}
            <div>
              <label className="block text-sm font-medium mb-1">Default Model</label>
              <div className="flex gap-2">
                {editingProvider.id && getCachedModels(editingProvider.id).length > 0 ? (
                  <SearchableSelect
                    options={getCachedModels(editingProvider.id)}
                    value={editingProvider.defaultModel || ''}
                    onChange={(value) =>
                      setEditingProvider({
                        ...editingProvider,
                        defaultModel: value,
                      })
                    }
                    placeholder="Search models..."
                    className="flex-1"
                  />
                ) : (
                  <div className="flex-1 bg-dark-card border border-dark-border rounded px-3 py-2 text-dark-muted">
                    Click "Fetch Models" to load available models
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!editingProvider.id) {
                      return;
                    }

                    if (!editingProvider.baseURL || !editingProvider.apiKey) {
                      setModelFetchError('Please enter Base URL and API Key first');
                      return;
                    }

                    setModelFetchLoading(true);
                    setModelFetchError(null);

                    // Save provider first so fetchModelsForProvider can find it
                    const isExisting = settings.providers.some((p) => p.id === editingProvider.id);
                    if (isExisting) {
                      await updateProvider(editingProvider.id, editingProvider as ProviderConfig);
                    } else {
                      await addProvider(editingProvider as ProviderConfig);
                    }

                    const result = await fetchModelsForProvider(editingProvider.id);
                    setModelFetchLoading(false);

                    if (!result.success) {
                      setModelFetchError(result.error || 'Failed to fetch models');
                    } else if (!editingProvider.defaultModel && result.models && result.models.length > 0) {
                      setEditingProvider({
                        ...editingProvider,
                        defaultModel: result.models[0],
                      });
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors whitespace-nowrap disabled:opacity-60"
                  title="Fetch available models from provider"
                  disabled={modelFetchLoading}
                >
                  {modelFetchLoading ? 'Fetching…' : 'Fetch Models'}
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
