/**
 * Settings Modal for LLM Provider Configuration
 */

import { useState, useEffect } from 'react';
import { useLLMStore } from '../store/llm-store';
import type { ProviderConfig, ProviderKind, OpenAIMode } from '@card-architect/schemas';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, loadSettings, addProvider, updateProvider, removeProvider, testConnection } =
    useLLMStore();

  const [activeTab, setActiveTab] = useState<'providers' | 'rag'>('providers');
  const [editingProvider, setEditingProvider] = useState<Partial<ProviderConfig> | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

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
      label: 'New Provider',
      baseURL: 'https://api.openai.com',
      apiKey: '',
      defaultModel: 'gpt-4',
      mode: 'chat',
      streamDefault: true,
      temperature: 0.7,
      maxTokens: 2048,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-border flex justify-between items-center">
          <h2 className="text-xl font-bold">LLM Settings</h2>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-dark-text transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-border">
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'providers'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('providers')}
          >
            AI Providers
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'rag'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('rag')}
          >
            Knowledge (RAG)
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'providers' && (
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
                        <h4 className="font-semibold">{provider.label}</h4>
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
                    <div>
                      <label className="block text-sm font-medium mb-1">Label</label>
                      <input
                        type="text"
                        value={editingProvider.label || ''}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, label: e.target.value })
                        }
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Provider Type</label>
                      <select
                        value={editingProvider.kind || 'openai'}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            kind: e.target.value as ProviderKind,
                          })
                        }
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="openai-compatible">OpenAI-Compatible</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Base URL</label>
                      <input
                        type="text"
                        value={editingProvider.baseURL || ''}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, baseURL: e.target.value })
                        }
                        placeholder="https://api.openai.com"
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">API Key</label>
                      <input
                        type="password"
                        value={editingProvider.apiKey || ''}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, apiKey: e.target.value })
                        }
                        placeholder="sk-..."
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      />
                    </div>

                    {(editingProvider.kind === 'openai' ||
                      editingProvider.kind === 'openai-compatible') && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-1">Mode</label>
                          <select
                            value={editingProvider.mode || 'chat'}
                            onChange={(e) =>
                              setEditingProvider({
                                ...editingProvider,
                                mode: e.target.value as OpenAIMode,
                              })
                            }
                            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                          >
                            <option value="chat">Chat Completions</option>
                            <option value="responses">Responses API</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Organization ID (Optional)
                          </label>
                          <input
                            type="text"
                            value={editingProvider.organization || ''}
                            onChange={(e) =>
                              setEditingProvider({
                                ...editingProvider,
                                organization: e.target.value,
                              })
                            }
                            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                          />
                        </div>
                      </>
                    )}

                    {editingProvider.kind === 'anthropic' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Anthropic Version
                        </label>
                        <input
                          type="text"
                          value={editingProvider.anthropicVersion || '2023-06-01'}
                          onChange={(e) =>
                            setEditingProvider({
                              ...editingProvider,
                              anthropicVersion: e.target.value,
                            })
                          }
                          className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1">Default Model</label>
                      <input
                        type="text"
                        value={editingProvider.defaultModel || ''}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            defaultModel: e.target.value,
                          })
                        }
                        placeholder="gpt-4, claude-3-5-sonnet-20241022, etc."
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Temperature</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={editingProvider.temperature ?? 0.7}
                          onChange={(e) =>
                            setEditingProvider({
                              ...editingProvider,
                              temperature: parseFloat(e.target.value),
                            })
                          }
                          className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Max Tokens</label>
                        <input
                          type="number"
                          value={editingProvider.maxTokens ?? 2048}
                          onChange={(e) =>
                            setEditingProvider({
                              ...editingProvider,
                              maxTokens: parseInt(e.target.value),
                            })
                          }
                          className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="streamDefault"
                        checked={editingProvider.streamDefault ?? true}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            streamDefault: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <label htmlFor="streamDefault" className="text-sm">
                        Enable streaming by default
                      </label>
                    </div>

                    <div className="flex gap-2 justify-end">
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
          )}

          {activeTab === 'rag' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">RAG Configuration</h3>
              <p className="text-dark-muted mb-4">
                Enable RAG to augment LLM responses with your local documentation and style guides.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ragEnabled"
                    checked={settings.rag.enabled}
                    onChange={(e) =>
                      useLLMStore
                        .getState()
                        .saveSettings({ rag: { ...settings.rag, enabled: e.target.checked } })
                    }
                    className="rounded"
                  />
                  <label htmlFor="ragEnabled" className="text-sm font-medium">
                    Enable RAG
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Top-K Results</label>
                  <input
                    type="number"
                    value={settings.rag.topK}
                    onChange={(e) =>
                      useLLMStore
                        .getState()
                        .saveSettings({ rag: { ...settings.rag, topK: parseInt(e.target.value) } })
                    }
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Token Cap</label>
                  <input
                    type="number"
                    value={settings.rag.tokenCap}
                    onChange={(e) =>
                      useLLMStore
                        .getState()
                        .saveSettings({
                          rag: { ...settings.rag, tokenCap: parseInt(e.target.value) },
                        })
                    }
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                  />
                </div>

                <div className="p-4 bg-dark-bg border border-dark-border rounded">
                  <p className="text-sm text-dark-muted">
                    RAG indexing and search is currently a placeholder. Implementation requires
                    embedding model and vector database setup.
                  </p>
                </div>
              </div>
            </div>
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
