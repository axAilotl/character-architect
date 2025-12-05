/**
 * Settings Modal for Application Configuration
 */

import { useState, useEffect, Suspense } from 'react';
import { useLLMStore } from '../../store/llm-store';
import { useCardStore } from '../../store/card-store';
import { useSettingsStore, THEMES } from '../../store/settings-store';
import { extractCardData } from '../../lib/card-utils';
import type { ProviderConfig, ProviderKind, OpenAIMode, UserPreset, CreatePresetRequest } from '@card-architect/schemas';
import { TemplateSnippetPanel } from '../../features/editor/components/TemplateSnippetPanel';
import { api } from '../../lib/api';
import { getDeploymentConfig } from '../../config/deployment';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useSettingsPanels, useModules } from '../../lib/registry/hooks';
import { registry } from '../../lib/registry';
import type { SettingsPanelDefinition, ModuleDefinition } from '../../lib/registry/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Light mode check - RAG requires server
  const deploymentConfig = getDeploymentConfig();
  const isLightMode = deploymentConfig.mode === 'light' || deploymentConfig.mode === 'static';

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

  const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'editor' | 'themes' | 'providers' | 'rag' | 'templates' | 'presets' | 'sillytavern' | 'wwwyzzerdd' | 'comfyui' | 'webimport' | 'charx-optimizer' | 'focused-settings' | 'diff-settings' | 'blockeditor-settings'>('general');

  // Settings from store
  const {
    theme,
    setTheme,
    setCustomCss,
    setBackgroundImage,
    setUseCardAsBackground,
    editor,
    setShowV3Fields,
    setExportSpec,
    setShowExtensionsTab,
    setAssetsEnabled,
    setFocusedEnabled,
    setDiffEnabled,
  } = useSettingsStore();

  // Use individual selectors for feature flags to ensure proper reactivity
  const assetsEnabled = useSettingsStore((state) => state.features?.assetsEnabled ?? true);
  const focusedEnabled = useSettingsStore((state) => state.features?.focusedEnabled ?? true);
  const diffEnabled = useSettingsStore((state) => state.features?.diffEnabled ?? true);
  const linkedImageArchivalEnabled = useSettingsStore((state) => state.features?.linkedImageArchivalEnabled ?? false);
  const setLinkedImageArchivalEnabled = useSettingsStore((state) => state.setLinkedImageArchivalEnabled);
  const setModuleEnabled = useSettingsStore((state) => state.setModuleEnabled);

  // Get module settings panels from registry
  const moduleSettingsPanels = useSettingsPanels('modules');

  // Get registered modules for dynamic toggles
  const registeredModules = useModules();

  // Get the current feature flags for dynamic modules
  const features = useSettingsStore((state) => state.features);

  // Helper to get color class for panel tab
  const getColorClass = (color: SettingsPanelDefinition['color'], isActive: boolean) => {
    const colorMap: Record<string, { active: string; inactive: string }> = {
      blue: { active: 'border-b-2 border-blue-500 text-blue-500', inactive: 'text-dark-muted hover:text-dark-text' },
      purple: { active: 'border-b-2 border-purple-500 text-purple-500', inactive: 'text-dark-muted hover:text-dark-text' },
      green: { active: 'border-b-2 border-green-500 text-green-500', inactive: 'text-dark-muted hover:text-dark-text' },
      orange: { active: 'border-b-2 border-orange-500 text-orange-500', inactive: 'text-dark-muted hover:text-dark-text' },
      red: { active: 'border-b-2 border-red-500 text-red-500', inactive: 'text-dark-muted hover:text-dark-text' },
      pink: { active: 'border-b-2 border-pink-500 text-pink-500', inactive: 'text-dark-muted hover:text-dark-text' },
      cyan: { active: 'border-b-2 border-cyan-500 text-cyan-500', inactive: 'text-dark-muted hover:text-dark-text' },
      amber: { active: 'border-b-2 border-amber-500 text-amber-500', inactive: 'text-dark-muted hover:text-dark-text' },
      teal: { active: 'border-b-2 border-teal-500 text-teal-500', inactive: 'text-dark-muted hover:text-dark-text' },
    };
    const classes = colorMap[color || 'blue'] || colorMap.blue;
    return isActive ? classes.active : classes.inactive;
  };

  // Helper to get toggle switch classes based on module color
  const getToggleColorClasses = (color: ModuleDefinition['color']) => {
    const colorMap: Record<string, { ring: string; bg: string; badge: string; text: string }> = {
      blue: { ring: 'peer-focus:ring-blue-500', bg: 'peer-checked:bg-blue-500', badge: 'bg-blue-500/20 text-blue-400', text: 'text-blue-400' },
      purple: { ring: 'peer-focus:ring-purple-500', bg: 'peer-checked:bg-purple-500', badge: 'bg-purple-500/20 text-purple-400', text: 'text-purple-400' },
      green: { ring: 'peer-focus:ring-green-500', bg: 'peer-checked:bg-green-500', badge: 'bg-green-500/20 text-green-400', text: 'text-green-400' },
      orange: { ring: 'peer-focus:ring-orange-500', bg: 'peer-checked:bg-orange-500', badge: 'bg-orange-500/20 text-orange-400', text: 'text-orange-400' },
      red: { ring: 'peer-focus:ring-red-500', bg: 'peer-checked:bg-red-500', badge: 'bg-red-500/20 text-red-400', text: 'text-red-400' },
      pink: { ring: 'peer-focus:ring-pink-500', bg: 'peer-checked:bg-pink-500', badge: 'bg-pink-500/20 text-pink-400', text: 'text-pink-400' },
      cyan: { ring: 'peer-focus:ring-cyan-500', bg: 'peer-checked:bg-cyan-500', badge: 'bg-cyan-500/20 text-cyan-400', text: 'text-cyan-400' },
      amber: { ring: 'peer-focus:ring-amber-500', bg: 'peer-checked:bg-amber-500', badge: 'bg-amber-500/20 text-amber-400', text: 'text-amber-400' },
      teal: { ring: 'peer-focus:ring-teal-500', bg: 'peer-checked:bg-teal-500', badge: 'bg-teal-500/20 text-teal-400', text: 'text-teal-400' },
    };
    return colorMap[color || 'blue'] || colorMap.blue;
  };

  // Check if a module is enabled based on its feature flag
  const isModuleEnabled = (module: ModuleDefinition): boolean => {
    const flagName = registry.moduleIdToFlagName(module.id);
    return features?.[flagName] ?? module.defaultEnabled;
  };

  // Handle module toggle
  const handleModuleToggle = (module: ModuleDefinition, enabled: boolean) => {
    // Convert module ID to the expected format for setModuleEnabled
    // 'charx-optimizer' -> 'charxOptimizer' (remove hyphens, camelCase)
    const camelId = module.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    setModuleEnabled(camelId, enabled);
  };

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

  // Note: SillyTavern, wwwyzzerdd, ComfyUI, and Web Import state/handlers
  // have been moved to their respective modular settings components

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

  // Note: Module data loading hooks have been moved to modular settings components

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

  // Default presets for client-side use
  const now = new Date().toISOString();
  const DEFAULT_PRESETS: UserPreset[] = [
    { id: 'rewrite', name: 'Rewrite', instruction: 'Rewrite this text to be clearer and more engaging while preserving the meaning.', category: 'rewrite', description: 'Improve clarity and engagement', isBuiltIn: true, createdAt: now, updatedAt: now },
    { id: 'expand', name: 'Expand', instruction: 'Expand this text with more detail and description while maintaining the original tone and style.', category: 'rewrite', description: 'Add more detail', isBuiltIn: true, createdAt: now, updatedAt: now },
    { id: 'condense', name: 'Condense', instruction: 'Condense this text while keeping the key information and essential meaning.', category: 'rewrite', description: 'Make it shorter', isBuiltIn: true, createdAt: now, updatedAt: now },
    { id: 'format-jed', name: 'Format as JED', instruction: 'Reformat this text using JED (JSON-Enhanced Description) format with sections like [Character], [Personality], [Background], etc.', category: 'format', description: 'Convert to JED format', isBuiltIn: true, createdAt: now, updatedAt: now },
    { id: 'proofread', name: 'Proofread', instruction: 'Fix grammar, spelling, and punctuation errors in this text while preserving the original style.', category: 'rewrite', description: 'Fix errors', isBuiltIn: true, createdAt: now, updatedAt: now },
  ];

  // Preset handlers
  const loadPresets = async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    setPresetsLoading(true);
    setPresetError(null);

    if (isLightMode) {
      // Load from localStorage in light mode
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
      // Save to localStorage in light mode
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
          // Update existing
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
        // Import to localStorage in light mode
        const stored = localStorage.getItem('ca-llm-presets');
        const userPresets: UserPreset[] = stored ? JSON.parse(stored) : [];

        // Filter out built-in presets from import, only import custom ones
        const customPresets = json.presets.filter((p: UserPreset) => !p.isBuiltIn);
        let imported = 0;

        for (const preset of customPresets) {
          // Skip if already exists
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
    const currentCard = useCardStore.getState().currentCard;

    if (!currentCard) {
      setRagStatus('No card loaded.');
      return;
    }

    // Extract card data
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

  // Note: wwwyzzerdd, ComfyUI, Web Import, and SillyTavern handlers
  // have been moved to their respective modular settings components

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

        {/* Core Settings Tabs - Row 1 */}
        <div className="flex border-b border-dark-border overflow-x-auto">
          <button
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'modules'
                ? 'border-b-2 border-orange-500 text-orange-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('modules')}
          >
            Modules
          </button>
          <button
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'editor'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('editor')}
          >
            Editor
          </button>
          <button
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'themes'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('themes')}
          >
            Themes
          </button>
          <button
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'providers'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('providers')}
          >
            AI Providers
          </button>
          {/* RAG requires server - hide in light mode */}
          {!isLightMode && (
            <button
              className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'rag'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
              onClick={() => setActiveTab('rag')}
            >
              RAG
            </button>
          )}
          <button
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'templates'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'presets'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-dark-muted hover:text-dark-text'
            }`}
            onClick={() => setActiveTab('presets')}
          >
            LLM Presets
          </button>
        </div>

        {/* Module Settings Tabs - Row 2 (dynamically rendered from registry) */}
        {moduleSettingsPanels.length > 0 && (
          <div className="flex border-b border-dark-border overflow-x-auto bg-dark-card/50">
            <span className="px-4 py-2 text-xs text-dark-muted uppercase tracking-wide self-center">Module Settings:</span>
            {moduleSettingsPanels.map((panel) => (
              <button
                key={panel.id}
                className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${getColorClass(panel.color, activeTab === panel.id)}`}
                onClick={() => setActiveTab(panel.id as typeof activeTab)}
              >
                {panel.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">General Settings</h3>
                <p className="text-dark-muted">
                  Configure application-wide settings and behaviors.
                </p>
              </div>

              {/* Linked Image Archival */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      Linked Image Archival
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Destructive</span>
                    </h4>
                    <p className="text-sm text-dark-muted mt-1">
                      Archive external images from first message and alternate greetings as local assets.
                      Original URLs are preserved for export to JSON/PNG formats.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkedImageArchivalEnabled}
                      onChange={(e) => setLinkedImageArchivalEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                  </label>
                </div>
                {linkedImageArchivalEnabled && (
                  <div className="pt-4 border-t border-dark-border">
                    <div className="p-3 bg-amber-900/20 border border-amber-600 rounded">
                      <p className="text-sm text-amber-200">
                        <strong>Warning:</strong> This feature modifies card content. A snapshot backup is automatically created before archiving.
                        Use the "Convert Linked Images" button in the Assets tab to archive images for the current card.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-dark-bg rounded border border-dark-border">
                <p className="text-sm text-dark-muted">
                  Module-specific settings have been moved to their respective tabs in the Module Settings row above.
                </p>
                <ul className="text-xs text-dark-muted mt-2 space-y-1 list-disc list-inside">
                  <li><strong>Auto-Snapshot</strong> → Diff module settings</li>
                  <li><strong>Creator's Notes HTML</strong> → Focused module settings</li>
                  <li><strong>Focused Editor Fields</strong> → Focused module settings</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Modules</h3>
                <p className="text-dark-muted">
                  Enable and configure optional modules. Enabled modules appear as tabs in the editor.
                </p>
              </div>

              {/* Dynamic Module Toggles - rendered from registry */}
              {registeredModules.map((module) => {
                const colorClasses = getToggleColorClasses(module.color);
                const enabled = isModuleEnabled(module);
                return (
                  <div key={module.id} className="border border-dark-border rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {module.name}
                          {module.badge && (
                            <span className={`px-2 py-0.5 ${colorClasses.badge} text-xs rounded`}>
                              {module.badge}
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-dark-muted mt-1">
                          {module.description}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => handleModuleToggle(module, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 ${colorClasses.ring} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${colorClasses.bg}`}></div>
                      </label>
                    </div>
                    {enabled && (
                      <div className="pt-4 border-t border-dark-border">
                        <p className="text-xs text-dark-muted">
                          Configure settings in the{' '}
                          <button
                            className={`${colorClasses.text} hover:underline`}
                            onClick={() => setActiveTab(module.id as typeof activeTab)}
                          >
                            {module.name} tab
                          </button>.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Core Tabs Section */}
              <div className="border-t border-dark-border pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-2">Core Tabs</h3>
                <p className="text-dark-muted mb-4">
                  Toggle visibility of built-in editor tabs.
                </p>

                {/* Assets Tab */}
                <div className="border border-dark-border rounded-lg p-6 space-y-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        Assets
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Core</span>
                      </h4>
                      <p className="text-sm text-dark-muted mt-1">
                        Manage character images and assets with crop, resize, and format conversion.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assetsEnabled}
                        onChange={(e) => setAssetsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>

                {/* Focused Tab */}
                <div className="border border-dark-border rounded-lg p-6 space-y-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        Focused
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded">Core</span>
                      </h4>
                      <p className="text-sm text-dark-muted mt-1">
                        Distraction-free WYSIWYG + raw markdown editing with AI assistant integration.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={focusedEnabled}
                        onChange={(e) => setFocusedEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>
                </div>

                {/* Diff Tab */}
                <div className="border border-dark-border rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        Diff
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">Core</span>
                      </h4>
                      <p className="text-sm text-dark-muted mt-1">
                        Version comparison and snapshot management for tracking changes.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={diffEnabled}
                        onChange={(e) => setDiffEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Module Info */}
              <div className="p-4 bg-dark-bg rounded border border-dark-border">
                <h5 className="font-medium text-sm mb-2">About Modules</h5>
                <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
                  <li>Enabled modules appear as tabs in the character editor</li>
                  <li>Module state is saved locally in your browser</li>
                  <li>Disabling a module hides it but preserves your data</li>
                  <li>Module-specific settings appear in their dedicated tabs when enabled</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Editor Settings</h3>
                <p className="text-dark-muted">
                  Configure how the character card editor behaves.
                </p>
              </div>

              {/* Export Spec */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <h4 className="font-semibold">Export Format</h4>
                <p className="text-sm text-dark-muted">
                  Choose the default spec version for PNG and JSON exports. CHARX is always V3, Voxta uses its own format.
                </p>

                <div>
                  <label className="block text-sm font-medium mb-1">Export Spec</label>
                  <select
                    value={editor.exportSpec}
                    onChange={(e) => setExportSpec(e.target.value as 'v2' | 'v3')}
                    className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                  >
                    <option value="v3">CCv3 (Character Card v3)</option>
                    <option value="v2">CCv2 (Character Card v2)</option>
                  </select>
                  <p className="text-xs text-dark-muted mt-1">
                    V3 includes additional fields like timestamps, group greetings, and multilingual notes.
                  </p>
                </div>
              </div>

              {/* V3 Fields Toggle */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <h4 className="font-semibold">V3 Field Visibility</h4>
                <p className="text-sm text-dark-muted">
                  Control visibility of CCv3-only fields in the editor.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showV3Fields"
                    checked={editor.showV3Fields}
                    onChange={(e) => setShowV3Fields(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="showV3Fields" className="text-sm font-medium">
                    Show V3-Only Fields
                  </label>
                </div>

                <div className="p-3 bg-dark-bg rounded border border-dark-border">
                  <h5 className="font-medium text-sm mb-2">V3-Only Fields</h5>
                  <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
                    <li>Group Only Greetings</li>
                    <li>Source URLs</li>
                    <li>Multilingual Creator Notes</li>
                    <li>Metadata Timestamps</li>
                  </ul>
                </div>
              </div>

              {/* Extensions Tab Toggle */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <h4 className="font-semibold">Extensions Tab</h4>
                <p className="text-sm text-dark-muted">
                  Show or hide the Extensions tab in the editor.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showExtensionsTab"
                    checked={editor.showExtensionsTab}
                    onChange={(e) => setShowExtensionsTab(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="showExtensionsTab" className="text-sm font-medium">
                    Show Extensions Tab
                  </label>
                </div>
              </div>

              <div className="p-3 bg-dark-bg rounded border border-dark-border">
                <p className="text-xs text-dark-muted">
                  <strong>Focused Editor Fields</strong> have been moved to the Focused module settings tab.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'themes' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Theme Settings</h3>
                <p className="text-dark-muted">
                  Customize the look and feel of the application.
                </p>
              </div>

              {/* Theme Selector */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <h4 className="font-semibold">Color Theme</h4>
                <p className="text-sm text-dark-muted">
                  Choose from built-in color schemes.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        theme.themeId === t.id
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-dark-border hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Color preview */}
                        <div className="flex gap-1">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: t.colors.bg }}
                            title="Background"
                          />
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: t.colors.surface }}
                            title="Surface"
                          />
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: t.colors.accent }}
                            title="Accent"
                          />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{t.name}</div>
                          <div className="text-xs text-dark-muted">
                            {t.isDark ? 'Dark' : 'Light'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Image */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <h4 className="font-semibold">Background Image</h4>
                <p className="text-sm text-dark-muted">
                  Upload a custom background image for the editor area.
                </p>

                <div className="space-y-3">
                  {/* Preview current background */}
                  {theme.backgroundImage && (
                    <div className="relative">
                      <img
                        src={theme.backgroundImage}
                        alt="Background preview"
                        className="w-full h-32 object-cover rounded border border-dark-border"
                      />
                      <button
                        onClick={async () => {
                          // If it's a server URL, try to delete the file
                          if (theme.backgroundImage.startsWith('/api/settings/theme/images/')) {
                            const filename = theme.backgroundImage.split('/').pop();
                            if (filename) {
                              await fetch(`/api/settings/theme/images/${filename}`, { method: 'DELETE' });
                            }
                          }
                          setBackgroundImage('');
                        }}
                        className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <label className="block">
                    <span className="text-sm font-medium mb-1 block">Upload Image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Upload to server
                        const formData = new FormData();
                        formData.append('file', file);

                        try {
                          const response = await fetch('/api/settings/theme/background', {
                            method: 'POST',
                            body: formData,
                          });

                          if (response.ok) {
                            const result = await response.json();
                            setBackgroundImage(result.url);
                          } else {
                            const err = await response.json();
                            alert(err.error || 'Failed to upload image');
                          }
                        } catch (err) {
                          alert('Failed to upload image');
                        }

                        e.target.value = ''; // Reset for re-upload
                      }}
                      className="w-full text-sm text-dark-text file:mr-3 file:rounded file:border-0 file:px-3 file:py-2 file:bg-blue-600 file:text-white file:cursor-pointer"
                    />
                  </label>
                  <p className="text-xs text-dark-muted">
                    Supports PNG, JPG, WebP, GIF. Image is stored on the server.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCardAsBackground"
                    checked={theme.useCardAsBackground}
                    onChange={(e) => setUseCardAsBackground(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="useCardAsBackground" className="text-sm font-medium">
                    Use character card as background
                  </label>
                </div>
                <p className="text-xs text-dark-muted">
                  When editing a card, use its avatar as a blurred background overlay at 40% opacity.
                </p>
              </div>

              {/* Custom CSS */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <h4 className="font-semibold">Custom CSS</h4>
                <p className="text-sm text-dark-muted">
                  Add custom CSS to further customize the appearance.
                </p>

                <details className="text-sm">
                  <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                    Available CSS Variables
                  </summary>
                  <div className="mt-2 p-3 bg-dark-bg rounded border border-dark-border font-mono text-xs">
                    <pre className="whitespace-pre-wrap">
{`--color-bg         /* Main background */
--color-surface    /* Surface/card background */
--color-border     /* Border color */
--color-text       /* Primary text */
--color-muted      /* Muted text */
--color-accent     /* Accent/primary color */
--color-accent-hover /* Accent hover state */

/* Classes: */
.theme-bg, .theme-surface, .theme-border
.theme-text, .theme-muted
.btn-primary, .btn-secondary, .btn-danger
.card, .label, .chip`}
                    </pre>
                  </div>
                </details>

                <textarea
                  value={theme.customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  placeholder="/* Your custom CSS here */\n:root {\n  --color-accent: #ff00ff;\n}"
                  rows={8}
                  className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-sm resize-none"
                />
              </div>
            </div>
          )}

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

          {/* Note: SillyTavern settings panel is now rendered via registry */}

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

              {/* AI Generation Prompts */}
              <div className="mt-8 border-t border-dark-border pt-6">
                <h3 className="text-lg font-semibold mb-4">AI Generation Prompts</h3>
                <p className="text-dark-muted mb-4">
                  System prompts for the AI generate buttons (tags, tagline).
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tags Generation</label>
                    <p className="text-xs text-dark-muted mb-2">
                      5-10 single-word slugs. Hyphens for compound words.
                    </p>
                    <textarea
                      value={useSettingsStore.getState().aiPrompts.tagsSystemPrompt}
                      onChange={(e) => useSettingsStore.getState().setTagsSystemPrompt(e.target.value)}
                      rows={3}
                      className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tagline Generation</label>
                    <p className="text-xs text-dark-muted mb-2">
                      Catchy text, up to 500 characters.
                    </p>
                    <textarea
                      value={useSettingsStore.getState().aiPrompts.taglineSystemPrompt}
                      onChange={(e) => useSettingsStore.getState().setTaglineSystemPrompt(e.target.value)}
                      rows={3}
                      className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Module Settings Panels - rendered from registry */}
          {moduleSettingsPanels.map((panel) => {
            if (activeTab !== panel.id) return null;

            // Render the panel's component with Suspense
            const PanelComponent = panel.component;
            return (
              <Suspense key={panel.id} fallback={<div className="text-dark-muted">Loading...</div>}>
                <PanelComponent />
              </Suspense>
            );
          })}
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
