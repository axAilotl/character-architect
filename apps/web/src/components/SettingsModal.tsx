/**
 * Settings Modal for LLM Provider Configuration
 */

import { useState, useEffect } from 'react';
import { useLLMStore } from '../store/llm-store';
import type { ProviderConfig, ProviderKind, OpenAIMode, UserPreset, CreatePresetRequest } from '@card-architect/schemas';
import { TemplateSnippetPanel } from './TemplateSnippetPanel';
import { api } from '../lib/api';
import { SearchableSelect } from './SearchableSelect';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    settings,
    loadSettings,
    addProvider,
    updateProvider,
    removeProvider,
    testConnection,
    loadRagDatabases,
    ragDatabases,
    ragActiveDatabaseId,
    ragDatabaseDetails,
    ragIsLoading,
    ragError,
    createRagDatabase,
    deleteRagDatabase,
    loadRagDatabaseDetail,
    setActiveRagDatabaseId,
    uploadRagDocument,
    removeRagDocument,
    fetchModelsForProvider,
    getCachedModels,
  } = useLLMStore();

  const [activeTab, setActiveTab] = useState<'providers' | 'rag' | 'templates' | 'presets' | 'sillytavern'>('providers');
  const [editingProvider, setEditingProvider] = useState<Partial<ProviderConfig> | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [modelFetchLoading, setModelFetchLoading] = useState(false);
  const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
  const [newDbName, setNewDbName] = useState('');
  const [newDbDescription, setNewDbDescription] = useState('');
  const [ragStatus, setRagStatus] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Free text entry state
  const [freeTextTitle, setFreeTextTitle] = useState('');
  const [freeTextContent, setFreeTextContent] = useState('');
  const [addingFreeText, setAddingFreeText] = useState(false);

  // Preset state
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<Partial<UserPreset> | null>(null);
  const [presetStatus, setPresetStatus] = useState<string | null>(null);

  // SillyTavern state
  const [stEnabled, setStEnabled] = useState(false);
  const [stBaseUrl, setStBaseUrl] = useState('');
  const [stImportEndpoint, setStImportEndpoint] = useState('/api/characters/import');
  const [stSessionCookie, setStSessionCookie] = useState('');
  const [stStatus, setStStatus] = useState<string | null>(null);
  const [stLoading, setStLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  useEffect(() => {
    setModelFetchError(null);
    setModelFetchLoading(false);
  }, [editingProvider?.id]);

  useEffect(() => {
    if (isOpen && activeTab === 'rag') {
      loadRagDatabases();
    }
  }, [isOpen, activeTab, loadRagDatabases]);

  useEffect(() => {
    if (isOpen && activeTab === 'presets') {
      loadPresets();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'sillytavern') {
      // Load SillyTavern settings from backend
      const loadStSettings = async () => {
        setStLoading(true);
        const result = await api.getSillyTavernSettings();
        setStLoading(false);

        if (result.data?.settings) {
          const s = result.data.settings;
          setStEnabled(s.enabled ?? false);
          setStBaseUrl(s.baseUrl ?? '');
          setStImportEndpoint(s.importEndpoint ?? '/api/characters/import');
          setStSessionCookie(s.sessionCookie ?? '');
        }
      };

      loadStSettings();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!selectedDbId && ragDatabases.length > 0) {
      const defaultId = ragActiveDatabaseId || ragDatabases[0].id;
      setSelectedDbId(defaultId);
    }
  }, [ragDatabases, ragActiveDatabaseId, selectedDbId]);

  useEffect(() => {
    if (selectedDbId && !ragDatabaseDetails[selectedDbId]) {
      loadRagDatabaseDetail(selectedDbId);
    }
  }, [selectedDbId, ragDatabaseDetails, loadRagDatabaseDetail]);

  const selectedDatabase = selectedDbId ? ragDatabaseDetails[selectedDbId] : null;

  // Preset handlers
  const loadPresets = async () => {
    setPresetsLoading(true);
    setPresetError(null);
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

    const data: CreatePresetRequest = {
      name: editingPreset.name,
      description: editingPreset.description,
      instruction: editingPreset.instruction,
      category: editingPreset.category as any,
    };

    let result;
    if (editingPreset.id) {
      // Update existing preset
      result = await api.updatePreset(editingPreset.id, data);
    } else {
      // Create new preset
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

    const result = await api.deletePreset(id);
    if (result.error) {
      setPresetStatus(result.error);
      return;
    }

    setPresetStatus('Preset deleted.');
    loadPresets();
  };

  const handleExportPresets = async () => {
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

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!Array.isArray(json.presets)) {
        setPresetStatus('Invalid preset file format.');
        return;
      }

      const result = await api.importPresets(json.presets);
      if (result.error) {
        setPresetStatus(result.error);
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

    // Reset file input
    e.target.value = '';
  };

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

  const handleCreateDatabase = async () => {
    if (!newDbName.trim()) {
      setRagStatus('Please provide a name for the knowledge base.');
      return;
    }

    const result = await createRagDatabase({
      label: newDbName,
      description: newDbDescription,
    });

    if (!result.success) {
      setRagStatus(result.error || 'Failed to create knowledge base.');
      return;
    }

    setNewDbName('');
    setNewDbDescription('');
    setRagStatus('Knowledge base created.');
    loadRagDatabases();
  };

  const handleSelectDatabase = async (dbId: string) => {
    setSelectedDbId(dbId);
    if (!ragDatabaseDetails[dbId]) {
      await loadRagDatabaseDetail(dbId);
    }
  };

  const handleDeleteDatabase = async (dbId: string) => {
    const confirmed = window.confirm('Delete this knowledge base? This cannot be undone.');
    if (!confirmed) return;

    const result = await deleteRagDatabase(dbId);
    if (!result.success) {
      setRagStatus(result.error || 'Failed to delete knowledge base.');
      return;
    }

    if (selectedDbId === dbId) {
      setSelectedDbId(null);
    }
    setRagStatus('Knowledge base deleted.');
  };

  const handleUploadDocument = async () => {
    if (!selectedDbId || !uploadFile) {
      setRagStatus('Choose a file to upload.');
      return;
    }

    setUploading(true);
    const result = await uploadRagDocument(selectedDbId, uploadFile, {
      title: uploadTitle.trim() || undefined,
    });
    setUploading(false);

    if (!result.success) {
      setRagStatus(result.error || 'Failed to upload document.');
      return;
    }

    setUploadTitle('');
    setUploadFile(null);
    setFileInputKey((key) => key + 1);
    setRagStatus('Document indexed.');
  };

  const handleRemoveDocument = async (sourceId: string) => {
    if (!selectedDbId) return;
    const confirmed = window.confirm('Remove this document from the knowledge base?');
    if (!confirmed) return;

    const result = await removeRagDocument(selectedDbId, sourceId);
    if (!result.success) {
      setRagStatus(result.error || 'Failed to remove document.');
      return;
    }

    setRagStatus('Document removed.');
  };

  const handleSetActiveDatabase = async (dbId: string) => {
    await setActiveRagDatabaseId(dbId);
    setRagStatus('Active knowledge base updated.');
  };

  const handleAddFreeText = async () => {
    if (!selectedDbId || !freeTextTitle.trim() || !freeTextContent.trim()) {
      setRagStatus('Please provide both title and content.');
      return;
    }

    setAddingFreeText(true);
    const result = await api.addRagFreeText(selectedDbId, {
      title: freeTextTitle.trim(),
      content: freeTextContent.trim(),
    });
    setAddingFreeText(false);

    if ('error' in result) {
      setRagStatus(result.error || 'Failed to add free text entry.');
      return;
    }

    setFreeTextTitle('');
    setFreeTextContent('');
    setRagStatus(`Indexed ${result.data!.indexedChunks} chunks from free text.`);
    if (selectedDbId) {
      loadRagDatabaseDetail(selectedDbId);
    }
  };

  const handleImportCurrentLorebook = async () => {
    if (!selectedDbId) {
      setRagStatus('Please select a knowledge base first.');
      return;
    }

    // Get current card from card store
    const cardStore = await import('../store/card-store');
    const currentCard = cardStore.useCardStore.getState().currentCard;

    if (!currentCard) {
      setRagStatus('No card loaded.');
      return;
    }

    // Extract card data
    const extractCardData = (await import('../lib/card-utils')).extractCardData;
    const cardData = extractCardData(currentCard);
    const lorebook = (cardData as any).character_book;

    if (!lorebook || !lorebook.entries || lorebook.entries.length === 0) {
      setRagStatus('Current card has no lorebook entries.');
      return;
    }

    setUploading(true);
    const result = await api.addRagLorebook(selectedDbId, {
      characterName: cardData.name,
      lorebook,
    });
    setUploading(false);

    if ('error' in result) {
      setRagStatus(result.error || 'Failed to import lorebook.');
      return;
    }

    setRagStatus(
      `Imported ${lorebook.entries.length} lorebook entries (${result.data!.indexedChunks} chunks indexed).`
    );
    if (selectedDbId) {
      loadRagDatabaseDetail(selectedDbId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl h-[67vh] overflow-hidden flex flex-col">
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
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'templates'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('templates')}
          >
            Templates & Snippets
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'presets'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('presets')}
          >
            LLM Presets
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'sillytavern'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('sillytavern')}
          >
            SillyTavern
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
                                  // Auto-select first model if none selected
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
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">RAG Configuration</h3>
                <p className="text-dark-muted">
                  Connect curated lore, style guides, and JSON instruction files so LLM Assist can cite
                  them automatically.
                </p>
              </div>

              <div className="space-y-4 border border-dark-border rounded-lg p-4">
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
                    Enable RAG for LLM Assist
                  </label>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Top-K Snippets</label>
                    <input
                      type="number"
                      value={settings.rag.topK}
                      min={1}
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
                      min={200}
                      onChange={(e) =>
                        useLLMStore
                          .getState()
                          .saveSettings({
                            rag: { ...settings.rag, tokenCap: parseInt(e.target.value) || 0 },
                          })
                      }
                      className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold">Knowledge Bases</h4>
                <button
                  onClick={loadRagDatabases}
                  className="px-3 py-1 text-sm border border-dark-border rounded hover:border-blue-500 transition-colors"
                >
                  ↻ Refresh
                </button>
              </div>

              {(ragError || ragStatus) && (
                <div className="space-y-2">
                  {ragError && (
                    <div className="p-2 rounded bg-red-900/30 border border-red-700 text-red-100 text-sm">
                      {ragError}
                    </div>
                  )}
                  {ragStatus && (
                    <div className="p-2 rounded bg-green-900/20 border border-green-700 text-green-100 text-sm">
                      {ragStatus}
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-dark-border rounded-lg p-4 space-y-3">
                  <h5 className="font-semibold">Create Knowledge Base</h5>
                  <input
                    type="text"
                    placeholder="Name (e.g., Warhammer 40K Lore)"
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value)}
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="Optional description"
                    value={newDbDescription}
                    onChange={(e) => setNewDbDescription(e.target.value)}
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm h-24 resize-none"
                  />
                  <button
                    onClick={handleCreateDatabase}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    Create Knowledge Base
                  </button>
                </div>

                <div className="border border-dark-border rounded-lg p-4 space-y-3">
                  <h5 className="font-semibold">Available Bases</h5>
                  {ragIsLoading ? (
                    <p className="text-sm text-dark-muted">Loading knowledge bases…</p>
                  ) : ragDatabases.length === 0 ? (
                    <p className="text-sm text-dark-muted">
                      No knowledge bases yet. Create one on the left to start indexing lore.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-auto pr-1">
                      {ragDatabases.map((db) => (
                        <div
                          key={db.id}
                          className={`rounded-md border p-3 ${
                            selectedDbId === db.id
                              ? 'border-blue-500 bg-blue-900/10'
                              : 'border-dark-border'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <div className="font-medium">{db.label}</div>
                              {db.description && (
                                <div className="text-xs text-dark-muted mt-0.5">{db.description}</div>
                              )}
                              <div className="text-xs text-dark-muted mt-1">
                                Docs: {db.sourceCount} • Chunks: {db.chunkCount} • Tokens: {db.tokenCount}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 text-xs">
                              <button
                                onClick={() => handleSelectDatabase(db.id)}
                                className="px-2 py-1 rounded border border-dark-border hover:border-blue-500 transition-colors"
                              >
                                Manage
                              </button>
                              <button
                                onClick={() => handleSetActiveDatabase(db.id)}
                                disabled={ragActiveDatabaseId === db.id}
                                className={`px-2 py-1 rounded border ${
                                  ragActiveDatabaseId === db.id
                                    ? 'border-green-600 text-green-200 cursor-default'
                                    : 'border-dark-border hover:border-green-500'
                                }`}
                              >
                                {ragActiveDatabaseId === db.id ? 'Active' : 'Set Active'}
                              </button>
                              <button
                                onClick={() => handleDeleteDatabase(db.id)}
                                className="px-2 py-1 rounded border border-red-600 text-red-200 hover:bg-red-600/10 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedDatabase && (
                <div className="border border-dark-border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-semibold">{selectedDatabase.label}</h5>
                      <p className="text-xs text-dark-muted">
                        {selectedDatabase.description || 'No description'} • {selectedDatabase.sourceCount}{' '}
                        docs • {selectedDatabase.tokenCount} tokens
                      </p>
                    </div>
                    <button
                      onClick={() => handleSetActiveDatabase(selectedDatabase.id)}
                      className="px-3 py-1 text-sm border border-dark-border rounded hover:border-blue-500 transition-colors"
                    >
                      {ragActiveDatabaseId === selectedDatabase.id ? 'Active' : 'Set Active'}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {/* File Upload */}
                    <div className="space-y-2">
                      <h6 className="font-semibold text-sm">Upload Document</h6>
                      <input
                        type="text"
                        placeholder="Optional display title"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
                      />
                      <input
                        key={fileInputKey}
                        type="file"
                        accept=".md,.markdown,.txt,.json,.pdf"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-dark-text file:mr-3 file:rounded file:border-0 file:px-3 file:py-2 file:bg-blue-600 file:text-white"
                      />
                      <button
                        onClick={handleUploadDocument}
                        disabled={uploading || !uploadFile}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm transition-colors"
                      >
                        {uploading ? 'Uploading…' : 'Upload & Index'}
                      </button>
                      <p className="text-xs text-dark-muted">
                        PDF, Markdown, JSON, text files
                      </p>
                    </div>

                    {/* Free Text Entry */}
                    <div className="space-y-2">
                      <h6 className="font-semibold text-sm">Add Free Text</h6>
                      <input
                        type="text"
                        placeholder="Title (e.g., Writing Guide)"
                        value={freeTextTitle}
                        onChange={(e) => setFreeTextTitle(e.target.value)}
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
                      />
                      <textarea
                        placeholder="Paste your documentation, notes, or guidelines here..."
                        value={freeTextContent}
                        onChange={(e) => setFreeTextContent(e.target.value)}
                        rows={3}
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm resize-none"
                      />
                      <button
                        onClick={handleAddFreeText}
                        disabled={addingFreeText || !freeTextTitle.trim() || !freeTextContent.trim()}
                        className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm transition-colors"
                      >
                        {addingFreeText ? 'Adding…' : 'Add Text Entry'}
                      </button>
                      <p className="text-xs text-dark-muted">
                        Direct text input for notes
                      </p>
                    </div>

                    {/* Lorebook Import */}
                    <div className="space-y-2">
                      <h6 className="font-semibold text-sm">Import Lorebook</h6>
                      <p className="text-xs text-dark-muted mb-3">
                        Import the lorebook from the currently loaded card as searchable knowledge.
                      </p>
                      <button
                        onClick={handleImportCurrentLorebook}
                        disabled={uploading}
                        className="w-full px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm transition-colors"
                      >
                        {uploading ? 'Importing…' : 'Import Current Card Lorebook'}
                      </button>
                      <p className="text-xs text-dark-muted">
                        Extracts all lorebook entries with keywords and content
                      </p>
                    </div>

                  </div>

                  {/* Documents List */}
                  <div className="mt-4">
                    <h6 className="font-semibold text-sm mb-2">Indexed Documents</h6>
                    {selectedDatabase.sources.length === 0 ? (
                      <p className="text-sm text-dark-muted">No documents indexed yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-auto pr-1">
                        {selectedDatabase.sources.map((source) => {
                          // Define type badge colors
                          const typeColors: Record<string, string> = {
                            pdf: 'bg-red-600',
                            markdown: 'bg-blue-600',
                            json: 'bg-yellow-600',
                            text: 'bg-gray-600',
                            html: 'bg-green-600',
                            freetext: 'bg-purple-600',
                            lorebook: 'bg-orange-600',
                          };
                          const typeColor = typeColors[source.type] || 'bg-slate-600';

                          return (
                            <div
                              key={source.id}
                              className="border border-dark-border rounded-md p-2 flex justify-between items-start gap-3"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium">{source.title}</div>
                                  <span className={`text-xs px-2 py-0.5 rounded text-white ${typeColor}`}>
                                    {source.type.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-xs text-dark-muted">
                                  {source.chunkCount} chunks • {source.tokenCount} tokens
                                  {source.tags && source.tags.length > 0 && (
                                    <span> • Tags: {source.tags.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveDocument(source.id)}
                                className="text-xs text-red-300 hover:text-red-200 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <TemplateSnippetPanel
              isOpen={true}
              onClose={() => {}} // No close needed in settings modal
              manageMode={true}
              embedded={true}
            />
          )}

          {activeTab === 'sillytavern' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">SillyTavern Integration</h3>
                <p className="text-dark-muted">
                  Configure push integration to send character cards directly to your SillyTavern instance.
                </p>
              </div>

              {stStatus && (
                <div className={`p-3 rounded border ${
                  stStatus.includes('success') || stStatus.includes('saved')
                    ? 'bg-green-900/20 border-green-700 text-green-100'
                    : 'bg-red-900/30 border-red-700 text-red-100'
                }`}>
                  {stStatus}
                </div>
              )}

              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stEnabled"
                    checked={stEnabled}
                    onChange={(e) => setStEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="stEnabled" className="text-sm font-medium">
                    Enable SillyTavern Push Integration
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    SillyTavern Base URL *
                  </label>
                  <input
                    type="text"
                    value={stBaseUrl}
                    onChange={(e) => setStBaseUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                    disabled={!stEnabled}
                  />
                  <p className="text-xs text-dark-muted mt-1">
                    The base URL of your SillyTavern instance (e.g., http://localhost:8000)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Import Endpoint
                  </label>
                  <input
                    type="text"
                    value={stImportEndpoint}
                    onChange={(e) => setStImportEndpoint(e.target.value)}
                    placeholder="/api/characters/import"
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                    disabled={!stEnabled}
                  />
                  <p className="text-xs text-dark-muted mt-1">
                    Usually /api/characters/import (default)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Session Cookie (Optional)
                  </label>
                  <textarea
                    value={stSessionCookie}
                    onChange={(e) => setStSessionCookie(e.target.value)}
                    placeholder="connect.sid=..."
                    rows={3}
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-xs resize-none"
                    disabled={!stEnabled}
                  />
                  <p className="text-xs text-dark-muted mt-1">
                    Optional session cookie for authentication. Usually not needed for local instances.
                  </p>
                </div>

                <div className="pt-4 border-t border-dark-border">
                  <button
                    onClick={async () => {
                      setStLoading(true);
                      setStStatus(null);

                      const config = {
                        enabled: stEnabled,
                        baseUrl: stBaseUrl,
                        importEndpoint: stImportEndpoint,
                        sessionCookie: stSessionCookie,
                      };

                      const result = await api.updateSillyTavernSettings(config);
                      setStLoading(false);

                      if (result.error) {
                        setStStatus(`Failed to save: ${result.error}`);
                      } else {
                        setStStatus('Settings saved successfully!');
                      }
                    }}
                    disabled={stLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {stLoading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>

              </div>

              <div className="border border-dark-border rounded-lg p-6">
                <h4 className="font-semibold mb-3">How to Use</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-dark-muted">
                  <li>Enable the integration and configure your SillyTavern base URL above</li>
                  <li>Click "Save Settings" to apply the configuration</li>
                  <li>Open a character card in the editor</li>
                  <li>Click the "→ SillyTavern" button in the header - the card will be automatically converted to PNG and pushed</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
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
                            } transition-colors`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h6 className="font-semibold">{preset.name}</h6>
                                  {preset.isBuiltIn && (
                                    <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                                      Built-in
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
                              {!preset.isBuiltIn && (
                                <div className="flex gap-2 ml-4">
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
                                </div>
                              )}
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

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name *</label>
                      <input
                        type="text"
                        value={editingPreset.name || ''}
                        onChange={(e) =>
                          setEditingPreset({ ...editingPreset, name: e.target.value })
                        }
                        placeholder="e.g., Tighten to 100 tokens"
                        maxLength={100}
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <input
                        type="text"
                        value={editingPreset.description || ''}
                        onChange={(e) =>
                          setEditingPreset({ ...editingPreset, description: e.target.value })
                        }
                        placeholder="Brief description of what this preset does"
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select
                        value={editingPreset.category || 'custom'}
                        onChange={(e) =>
                          setEditingPreset({
                            ...editingPreset,
                            category: e.target.value as any,
                          })
                        }
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                      >
                        <option value="rewrite">Rewrite</option>
                        <option value="format">Format</option>
                        <option value="generate">Generate</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Instruction *</label>
                      <textarea
                        value={editingPreset.instruction || ''}
                        onChange={(e) =>
                          setEditingPreset({ ...editingPreset, instruction: e.target.value })
                        }
                        placeholder="The prompt/instruction to send to the LLM"
                        maxLength={5000}
                        rows={8}
                        className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-sm"
                      />
                      <p className="text-xs text-dark-muted mt-1">
                        {editingPreset.instruction?.length || 0} / 5000 characters
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end">
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
                </div>
              )}
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
