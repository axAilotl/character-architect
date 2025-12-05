/**
 * ComfyUI Tab - Image generation with ComfyUI integration
 * Sub-tabs: General | Emotion Images
 */

import { useState, useEffect, useCallback } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { useSettingsStore } from '../../store/settings-store';
import { useLLMStore } from '../../store/llm-store';
import { getDeploymentConfig } from '../../config/deployment';

type SubTab = 'general' | 'emotions';

interface ConnectionStatus {
  connected: boolean;
  checking: boolean;
  error?: string;
  systemInfo?: {
    system?: { os: string; python_version: string };
    devices?: Array<{ name: string; type: string; vram_total?: number; vram_free?: number }>;
  };
}

interface GenerationState {
  generating: boolean;
  progress?: { value: number; max: number };
  currentNode?: string;
  error?: string;
  generatedImage?: string;
}

interface Workflow {
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
}

export function ComfyUITab() {
  const { currentCard } = useCardStore();
  const comfyUISettings = useSettingsStore((state) => state.comfyUI);
  const { settings: llmSettings, loadSettings: loadLLMSettings } = useLLMStore();

  // Store actions for persisted state
  const setPositivePrompt = useSettingsStore((state) => state.setComfyUIPositivePrompt);
  const setNegativePrompt = useSettingsStore((state) => state.setComfyUINegativePrompt);
  const setSeed = useSettingsStore((state) => state.setComfyUISeed);
  const setSelectedCheckpoint = useSettingsStore((state) => state.setComfyUISelectedCheckpoint);
  const setSelectedWorkflowId = useSettingsStore((state) => state.setComfyUISelectedWorkflowId);
  const addHistoryItem = useSettingsStore((state) => state.addComfyUIHistoryItem);
  const setHistory = useSettingsStore((state) => state.setComfyUIHistory);

  // Persisted state from store
  const positivePrompt = comfyUISettings.positivePrompt;
  const negativePrompt = comfyUISettings.negativePrompt;
  const seed = comfyUISettings.seed;
  const selectedCheckpoint = comfyUISettings.selectedCheckpoint;
  const selectedWorkflowId = comfyUISettings.selectedWorkflowId;
  const history = comfyUISettings.history;

  const [subTab, setSubTab] = useState<SubTab>('general');

  // Connection state
  const [connection, setConnection] = useState<ConnectionStatus>({
    connected: false,
    checking: false,
  });

  // Generation state
  const [generation, setGeneration] = useState<GenerationState>({
    generating: false,
  });

  // Form state (non-persisted)
  const [selectedPromptType, setSelectedPromptType] = useState('character');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // LLM prompt generation state
  const [generatingLLMPrompt, setGeneratingLLMPrompt] = useState(false);
  const [llmPromptModal, setLlmPromptModal] = useState<{
    open: boolean;
    instruction: string;
    includeFields: {
      name: boolean;
      description: boolean;
      personality: boolean;
      appearance: boolean;
      scenario: boolean;
      firstMessage: boolean;
    };
    temperature: number;
  }>({
    open: false,
    instruction: '',
    includeFields: {
      name: true,
      description: true,
      personality: true,
      appearance: true,
      scenario: true,
      firstMessage: false,
    },
    temperature: 0.7,
  });

  // Save modal state
  const [saveModal, setSaveModal] = useState<{
    open: boolean;
    imageUrl: string;
    suggestedType: string;
    suggestedFilename: string;
  } | null>(null);

  // Emotion generation state - load from localStorage
  const [emotionFormat, setEmotionFormat] = useState<'sillytavern' | 'voxta'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('comfyui-emotion-format') as 'sillytavern' | 'voxta') || 'sillytavern';
    }
    return 'sillytavern';
  });
  const [emotionData, setEmotionData] = useState<{
    sillytavern: { items: Array<{ filename: string; prompt: string }> };
    voxta: { items: Array<{ filename: string; prompt: string }> };
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_emotionSourceType, _setEmotionSourceType] = useState<'icon' | 'upload'>('icon');
  const [emotionImagesPerExpression, setEmotionImagesPerExpression] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('comfyui-emotion-per-expression') || '1') || 1;
    }
    return 1;
  });
  const [emotionTotalLimit, setEmotionTotalLimit] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('comfyui-emotion-total-limit') || '0') || 0;
    }
    return 0;
  });
  const [emotionGenerating, setEmotionGenerating] = useState(false);
  const [emotionError, setEmotionError] = useState<string | null>(null);
  const [emotionResults, setEmotionResults] = useState<Array<{
    filename: string;
    url: string;
    selected: boolean;
  }>>([]);
  const [emotionSourceImage, setEmotionSourceImage] = useState<string | null>(null);
  const [emotionSourceFilename, setEmotionSourceFilename] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('comfyui-emotion-source-filename') || '';
    }
    return '';
  });
  const [emotionOutputPath, setEmotionOutputPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('comfyui-emotion-output-path') || '';
    }
    return '';
  });

  // Persist emotion settings to localStorage
  useEffect(() => {
    localStorage.setItem('comfyui-emotion-format', emotionFormat);
  }, [emotionFormat]);
  useEffect(() => {
    localStorage.setItem('comfyui-emotion-per-expression', String(emotionImagesPerExpression));
  }, [emotionImagesPerExpression]);
  useEffect(() => {
    localStorage.setItem('comfyui-emotion-total-limit', String(emotionTotalLimit));
  }, [emotionTotalLimit]);
  useEffect(() => {
    localStorage.setItem('comfyui-emotion-source-filename', emotionSourceFilename);
  }, [emotionSourceFilename]);
  useEffect(() => {
    localStorage.setItem('comfyui-emotion-output-path', emotionOutputPath);
  }, [emotionOutputPath]);

  // Card data for prompt generation
  const cardData = currentCard ? extractCardData(currentCard) : null;

  // Test connection on mount and when server URL changes
  const testConnection = useCallback(async () => {
    if (!comfyUISettings.serverUrl) {
      setConnection({ connected: false, checking: false, error: 'No server URL configured' });
      return;
    }

    setConnection((prev) => ({ ...prev, checking: true, error: undefined }));

    try {
      const response = await fetch('/api/comfyui/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: comfyUISettings.serverUrl }),
      });

      const data = await response.json();

      if (data.connected) {
        setConnection({
          connected: true,
          checking: false,
          systemInfo: data.systemInfo,
        });
      } else {
        setConnection({
          connected: false,
          checking: false,
          error: data.error || 'Connection failed',
        });
      }
    } catch (error) {
      setConnection({
        connected: false,
        checking: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }, [comfyUISettings.serverUrl]);

  // Load workflows
  const loadWorkflows = useCallback(async () => {
    try {
      const response = await fetch('/api/comfyui/workflows');
      const data = await response.json();
      setWorkflows(data.workflows || []);

      // Select first workflow if none selected
      if (!selectedWorkflowId && data.workflows?.length > 0) {
        setSelectedWorkflowId(data.workflows[0].id);
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  }, [selectedWorkflowId]);

  // Load checkpoints from ComfyUI
  const loadCheckpoints = useCallback(async () => {
    if (!comfyUISettings.serverUrl || !connection.connected) return;

    try {
      const response = await fetch('/api/comfyui/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: comfyUISettings.serverUrl }),
      });
      const data = await response.json();
      setCheckpoints(data.checkpoints || []);

      // Auto-select first checkpoint if none selected
      if (!selectedCheckpoint && data.checkpoints?.length > 0) {
        setSelectedCheckpoint(data.checkpoints[0]);
      }
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
    }
  }, [comfyUISettings.serverUrl, connection.connected, selectedCheckpoint]);

  useEffect(() => {
    testConnection();
    loadWorkflows();
    loadLLMSettings();
  }, [testConnection, loadWorkflows, loadLLMSettings]);

  // Load emotion presets
  useEffect(() => {
    const loadEmotions = async () => {
      try {
        const response = await fetch('/api/comfyui/emotions');
        const data = await response.json();
        setEmotionData(data);
      } catch (error) {
        console.error('Failed to load emotion presets:', error);
      }
    };
    loadEmotions();
  }, []);

  // Load checkpoints when connected
  useEffect(() => {
    if (connection.connected) {
      loadCheckpoints();
    }
  }, [connection.connected, loadCheckpoints]);

  // Build prompt from card data - uses appearance/visual_description from extensions
  const buildPromptFromCard = useCallback(() => {
    if (!cardData) return;

    const parts: string[] = [];

    // Add quality tags (common for anime/illustrious models)
    parts.push('score_9, score_8_up, score_7_up, masterpiece, best quality, ai assistant');

    // Get appearance from extensions (voxta.appearance or visual_description)
    const extensions = (cardData as any).extensions || {};
    const appearance = extensions.voxta?.appearance || extensions.visual_description;

    if (appearance && typeof appearance === 'string') {
      // Use appearance field - this is designed for image gen prompts
      parts.push(appearance);
    } else if (cardData.name) {
      // Fallback: just use name if no appearance set
      parts.push(`1girl, ${cardData.name}`);
    }

    setPositivePrompt(parts.join(', '));
    setNegativePrompt('score_6, score_5, score_4, blurry, low quality, deformed, bad anatomy, watermark, signature, text');
  }, [cardData]);

  // Open LLM prompt modal with default instruction based on prompt type
  const openLLMPromptModal = () => {
    const defaultInstructions: Record<string, string> = {
      character: 'Generate a detailed comma-delimited list of keywords and phrases describing this character for a full body portrait. Include hair color, eye color, accessories, outfit, body type, and artistic medium/style. Output ONLY the keywords, no explanations.',
      portrait: 'Generate a detailed comma-delimited list of keywords and phrases for a close-up facial portrait of this character. Focus on facial features, eye color, expression, hair, and lighting. Output ONLY the keywords, no explanations.',
      scenario: 'Generate a detailed comma-delimited list of keywords and phrases for an illustrated scene featuring this character in their scenario. Include the character, environment, lighting, atmosphere, and composition. Output ONLY the keywords, no explanations.',
      background: 'Generate a detailed comma-delimited list of keywords and phrases for a background/environment based on this character\'s scenario. Focus on architecture, lighting, time of day, weather, and atmosphere. NO characters should be present. Output ONLY the keywords, no explanations.',
    };

    setLlmPromptModal((prev) => ({
      ...prev,
      open: true,
      instruction: defaultInstructions[selectedPromptType] || defaultInstructions.character,
    }));
  };

  // Generate prompt using LLM with modal settings
  const handleLLMGeneratePrompt = async () => {
    if (!cardData) {
      alert('Please load a character card first.');
      return;
    }

    // Find active LLM provider
    let activeProvider = llmSettings.providers.find((p) => p.id === llmSettings.activeProviderId);
    if (!activeProvider && llmSettings.providers.length > 0) {
      activeProvider = llmSettings.providers[0];
    }
    if (!activeProvider) {
      alert('Please configure an LLM provider in Settings > AI Providers first.');
      return;
    }

    setGeneratingLLMPrompt(true);

    try {
      // Build character context from selected fields
      const extensions = (cardData as any).extensions || {};
      const appearance = extensions.voxta?.appearance || extensions.visual_description || '';
      const { includeFields } = llmPromptModal;

      const contextParts: string[] = [];
      if (includeFields.name && cardData.name) {
        contextParts.push(`Character Name: ${cardData.name}`);
      }
      if (includeFields.description && cardData.description) {
        contextParts.push(`Description: ${cardData.description}`);
      }
      if (includeFields.personality && cardData.personality) {
        contextParts.push(`Personality: ${cardData.personality}`);
      }
      if (includeFields.appearance && appearance) {
        contextParts.push(`Appearance: ${appearance}`);
      }
      if (includeFields.scenario && cardData.scenario) {
        contextParts.push(`Scenario: ${cardData.scenario}`);
      }
      if (includeFields.firstMessage && cardData.first_mes) {
        contextParts.push(`First Message: ${cardData.first_mes}`);
      }

      const characterContext = contextParts.join('\n\n');

      const response = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.id,
          system: 'You are an expert at creating prompts for Stable Diffusion image generation. Generate concise, descriptive keyword lists that produce high-quality images. Always include quality tags like "masterpiece, best quality" at the start. For anime models, include "score_9, score_8_up" tags. Output ONLY comma-separated keywords, no explanations or formatting.',
          messages: [
            { role: 'user', content: `${llmPromptModal.instruction}\n\n${characterContext}` }
          ],
          temperature: llmPromptModal.temperature,
          maxTokens: 500,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const content = (data.content || data.text || '').trim();
      if (content) {
        setPositivePrompt(content);
        setNegativePrompt('score_6, score_5, score_4, blurry, low quality, deformed, bad anatomy, watermark, signature, text, cropped');
        setLlmPromptModal((prev) => ({ ...prev, open: false }));
      }
    } catch (err) {
      console.error('Failed to generate prompt with LLM:', err);
      alert(`Failed to generate prompt: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGeneratingLLMPrompt(false);
    }
  };

  // Load history from ComfyUI server
  const loadServerHistory = useCallback(async () => {
    if (!comfyUISettings.serverUrl) return;

    try {
      const response = await fetch('/api/comfyui/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: comfyUISettings.serverUrl, limit: 20 }),
      });

      const data = await response.json();
      if (data.history) {
        // Transform to our history format
        const historyItems = data.history.map((entry: {
          promptId: string;
          timestamp: number;
          images: Array<{ url: string }>;
          positivePrompt: string;
          negativePrompt: string;
          seed: number;
        }) => ({
          id: entry.promptId,
          timestamp: entry.timestamp,
          imageUrl: entry.images[0]?.url || '',
          positivePrompt: entry.positivePrompt || '',
          negativePrompt: entry.negativePrompt || '',
          seed: entry.seed || 0,
          workflowId: '',
        })).filter((item: { imageUrl: string }) => item.imageUrl);

        setHistory(historyItems);
      }
    } catch (error) {
      console.error('Failed to load server history:', error);
    }
  }, [comfyUISettings.serverUrl, setHistory]);

  // Generate image
  const handleGenerate = async (regenPrompt?: string, regenNegPrompt?: string, regenSeed?: number) => {
    if (!comfyUISettings.serverUrl || !selectedWorkflowId) {
      setGeneration({ generating: false, error: 'Server URL and workflow required' });
      return;
    }

    // Use regen values if provided, otherwise use current form values
    const genPositive = regenPrompt ?? (positivePrompt || 'beautiful landscape');
    const genNegative = regenNegPrompt ?? (negativePrompt || 'blurry, low quality');
    const genSeed = regenSeed ?? seed;

    setGeneration({ generating: true, error: undefined });

    try {
      const response = await fetch('/api/comfyui/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: comfyUISettings.serverUrl,
          workflowId: selectedWorkflowId,
          values: {
            positivePrompt: genPositive,
            negativePrompt: genNegative,
            seed: genSeed,
            checkpoint: selectedCheckpoint || undefined,
          },
          includeBase64: true,
        }),
      });

      const data = await response.json();

      if (data.success && data.images?.length > 0) {
        const image = data.images[0];
        // Construct proxy URL (used for fallback and history)
        const proxyUrl = `/api/comfyui/image?serverUrl=${encodeURIComponent(comfyUISettings.serverUrl)}&filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || '')}&type=${encodeURIComponent(image.type || 'output')}`;
        // Use base64 for immediate display (faster), fallback to proxy URL (not direct ComfyUI URL due to CORS)
        const displayUrl = image.base64 ? `data:image/png;base64,${image.base64}` : proxyUrl;

        setGeneration({
          generating: false,
          generatedImage: displayUrl,
        });

        // Add to history using proxy URL (not base64)
        addHistoryItem({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          positivePrompt: genPositive,
          negativePrompt: genNegative,
          seed: genSeed,
          imageUrl: proxyUrl,
          workflowId: selectedWorkflowId,
        });

        // Randomize seed for next generation
        setSeed(Math.floor(Math.random() * 999999999));
      } else {
        setGeneration({
          generating: false,
          error: data.error || 'No images returned',
        });
      }
    } catch (error) {
      setGeneration({
        generating: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      });
    }
  };

  // Handle save - opens modal if auto-select is off, otherwise saves directly
  const handleSave = async (imageUrl: string) => {
    const autoSelect = comfyUISettings?.autoSelectType ?? true;
    const cardName = cardData?.name || 'character';
    const suggestedFilename = `${cardName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

    if (!autoSelect) {
      // Show modal to select type and filename
      setSaveModal({
        open: true,
        imageUrl,
        suggestedType: 'icon',
        suggestedFilename,
      });
    } else {
      // Auto-save as icon
      await doSaveAsset(imageUrl, 'icon', suggestedFilename);
    }
  };

  // Actually save the asset
  const doSaveAsset = async (imageUrl: string, type: string, assetFilename: string) => {
    if (!currentCard) return;

    try {
      // Convert base64 to blob if needed
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      } else {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      }

      const formData = new FormData();
      formData.append('file', blob, `${assetFilename}.png`);
      formData.append('type', type);

      const response = await fetch(`/api/cards/${currentCard.meta.id}/assets`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setSaveModal(null);
        // Could show success toast here
      }
    } catch (error) {
      console.error('Failed to save asset:', error);
    }
  };

  // Randomize seed
  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 999999999));
  };

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full text-dark-muted">
        <div className="text-center">
          <div className="text-6xl mb-4">&#127912;</div>
          <h2 className="text-xl font-semibold mb-2">No Card Loaded</h2>
          <p>Create or load a character card to use ComfyUI integration.</p>
        </div>
      </div>
    );
  }

  // Light mode check - ComfyUI requires server
  const config = getDeploymentConfig();
  if (config.mode === 'light' || config.mode === 'static') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-dark-muted max-w-md">
          <h2 className="text-xl font-semibold mb-2">ComfyUI Integration</h2>
          <p className="mb-4">
            ComfyUI integration requires running Card Architect locally with a backend server.
          </p>
          <p className="text-sm">
            This feature connects to your local ComfyUI instance to generate images for your character cards.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connection.checking
                ? 'bg-yellow-500 animate-pulse'
                : connection.connected
                  ? 'bg-green-500'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-dark-muted">
            {connection.checking
              ? 'Connecting...'
              : connection.connected
                ? `Connected to ${comfyUISettings.serverUrl}`
                : connection.error || 'Not connected'}
          </span>
        </div>
        <button
          onClick={testConnection}
          disabled={connection.checking}
          className="px-3 py-1 text-xs bg-dark-border rounded hover:bg-dark-muted/20 transition-colors disabled:opacity-50"
        >
          {connection.checking ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-dark-border bg-dark-surface">
        <button
          onClick={() => setSubTab('general')}
          className={`px-6 py-3 font-medium transition-colors ${
            subTab === 'general'
              ? 'text-green-400 border-b-2 border-green-500'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setSubTab('emotions')}
          className={`px-6 py-3 font-medium transition-colors ${
            subTab === 'emotions'
              ? 'text-green-400 border-b-2 border-green-500'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          Emotion Images
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {subTab === 'general' && (
          <div className="w-full">
            {!connection.connected && (
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
                <p className="text-yellow-200 text-sm">
                  <strong>Not Connected:</strong> Configure your ComfyUI server URL in Settings &gt; ComfyUI to enable image generation.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              {/* Left - Generated Image Preview */}
              <div className="space-y-4">
                <div className="aspect-[3/4] bg-dark-surface border-2 border-dashed border-dark-border rounded-lg flex items-center justify-center overflow-hidden">
                  {generation.generating ? (
                    <div className="text-center text-dark-muted">
                      <div className="animate-spin text-4xl mb-2">&#9881;</div>
                      <p>Generating...</p>
                      {generation.progress && (
                        <p className="text-sm mt-1">
                          Step {generation.progress.value}/{generation.progress.max}
                        </p>
                      )}
                    </div>
                  ) : generation.generatedImage ? (
                    <img
                      src={generation.generatedImage}
                      alt="Generated"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-dark-muted">
                      <div className="text-4xl mb-2">&#127912;</div>
                      <p>Generated image will appear here</p>
                    </div>
                  )}
                </div>

                {generation.error && (
                  <div className="bg-red-900/20 border border-red-700 rounded p-3">
                    <p className="text-red-200 text-sm">{generation.error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={() => generation.generatedImage && handleSave(generation.generatedImage)}
                    disabled={!generation.generatedImage}
                    className="w-full px-4 py-2 bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Save as Asset
                  </button>
                </div>
              </div>

              {/* Right - Generation Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Workflow</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedWorkflowId || ''}
                      onChange={(e) => setSelectedWorkflowId(e.target.value || null)}
                      className="flex-1 bg-dark-surface border border-dark-border rounded px-3 py-2"
                    >
                      <option value="">-- Select Workflow --</option>
                      {workflows.map((wf) => (
                        <option key={wf.id} value={wf.id}>
                          {wf.name}
                        </option>
                      ))}
                    </select>
                    <label className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer text-sm">
                      Upload
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const text = await file.text();
                            const workflow = JSON.parse(text);
                            const name = file.name.replace('.json', '');
                            const response = await fetch('/api/comfyui/workflows', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name, workflow }),
                            });
                            if (response.ok) {
                              loadWorkflows();
                            }
                          } catch (err) {
                            console.error('Failed to upload workflow:', err);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Checkpoint</label>
                  <select
                    value={selectedCheckpoint}
                    onChange={(e) => setSelectedCheckpoint(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-sm"
                    disabled={!connection.connected || checkpoints.length === 0}
                  >
                    <option value="">{checkpoints.length === 0 ? 'Loading...' : '-- Use workflow default --'}</option>
                    {checkpoints.map((ckpt) => (
                      <option key={ckpt} value={ckpt}>
                        {ckpt.split('/').pop()}
                      </option>
                    ))}
                  </select>
                </div>


                <div>
                  <label className="block text-sm font-medium mb-1">Seed</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                      className="flex-1 bg-dark-surface border border-dark-border rounded px-3 py-2"
                    />
                    <button
                      onClick={randomizeSeed}
                      className="px-3 py-2 bg-dark-surface border border-dark-border rounded hover:bg-dark-border transition-colors"
                      title="Random seed"
                    >
                      &#127922;
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Prompt Type</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPromptType}
                      onChange={(e) => setSelectedPromptType(e.target.value)}
                      className="flex-1 bg-dark-surface border border-dark-border rounded px-3 py-2"
                    >
                      <option value="character">Character (Full Body)</option>
                      <option value="scenario">Scenario (Scene)</option>
                      <option value="portrait">Portrait (Face)</option>
                      <option value="background">Background</option>
                    </select>
                    <button
                      onClick={buildPromptFromCard}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      title="Build basic prompt from card data"
                    >
                      From Card
                    </button>
                    <button
                      onClick={openLLMPromptModal}
                      disabled={!cardData}
                      className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Generate prompt using AI (opens configuration)"
                    >
                      &#10024;
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Positive Prompt</label>
                  <textarea
                    value={positivePrompt}
                    onChange={(e) => setPositivePrompt(e.target.value)}
                    rows={3}
                    placeholder="Enter positive prompt..."
                    className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Negative Prompt</label>
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    rows={2}
                    placeholder="Enter negative prompt..."
                    className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-sm"
                  />
                </div>

                <button
                  onClick={() => handleGenerate()}
                  disabled={!connection.connected || generation.generating || !selectedWorkflowId}
                  className="w-full px-4 py-3 bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium hover:bg-green-700 transition-colors"
                >
                  {generation.generating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>

            {/* Generation History */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Recent Generations</h3>
                <div className="flex gap-2">
                  <button
                    onClick={loadServerHistory}
                    disabled={!connection.connected}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    title="Load history from ComfyUI server"
                  >
                    Load from Server
                  </button>
                  <button
                    onClick={() => setHistory([])}
                    disabled={history.length === 0}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    title="Clear generation history"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {history.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="relative group flex-shrink-0 w-52 aspect-[3/4] bg-dark-surface border border-dark-border rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => setLightboxImage(item.imageUrl)}
                    >
                      <img
                        src={item.imageUrl}
                        alt={`Gen ${item.seed}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSave(item.imageUrl);
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          title="Save as asset"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPositivePrompt(item.positivePrompt);
                            setNegativePrompt(item.negativePrompt);
                            setSeed(item.seed);
                          }}
                          className="px-3 py-1.5 bg-dark-border text-white text-xs rounded hover:bg-dark-muted"
                          title="Load settings into form"
                        >
                          Load
                        </button>
                        <span className="text-xs text-dark-muted mt-1">Seed: {item.seed}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-dark-muted text-center py-4">
                  No recent generations. Click "Load from Server" to fetch history from ComfyUI.
                </p>
              )}
            </div>
          </div>
        )}

        {subTab === 'emotions' && (
          <div className="h-full flex gap-6">
            {/* Left side - Source Image, Settings & Items List */}
            <div className="w-80 flex flex-col space-y-3 overflow-auto">
              {/* Source Image - TOP */}
              <div className="bg-dark-surface border border-dark-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Source Image</label>
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        if (!comfyUISettings.serverUrl || !currentCard?.meta.id) return;
                        setEmotionSourceFilename('Uploading...');
                        setEmotionSourceImage(`/api/cards/${currentCard.meta.id}/icon`);

                        try {
                          // Fetch the card icon and upload to ComfyUI
                          const iconResponse = await fetch(`/api/cards/${currentCard.meta.id}/icon`);
                          const blob = await iconResponse.blob();

                          const formData = new FormData();
                          formData.append('file', blob, `${currentCard.meta.name || 'card'}_icon.png`);

                          const response = await fetch(`/api/comfyui/upload-image?serverUrl=${encodeURIComponent(comfyUISettings.serverUrl)}`, {
                            method: 'POST',
                            body: formData,
                          });

                          const data = await response.json();
                          if (data.success && data.name) {
                            setEmotionSourceFilename(data.name);
                          } else {
                            setEmotionError(data.error || 'Upload failed');
                            setEmotionSourceFilename('');
                          }
                        } catch (err) {
                          setEmotionError(err instanceof Error ? err.message : 'Upload failed');
                          setEmotionSourceFilename('');
                        }
                      }}
                      disabled={!comfyUISettings.serverUrl || !currentCard?.meta.id}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      title={currentCard?.meta.id ? 'Upload card icon to ComfyUI' : 'No card loaded'}
                    >
                      Card Icon
                    </button>
                    <label className={`px-2 py-1 text-xs text-white rounded cursor-pointer ${emotionGenerating ? 'bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={emotionGenerating}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !comfyUISettings.serverUrl) return;

                          // Show preview immediately
                          const previewUrl = URL.createObjectURL(file);
                          setEmotionSourceImage(previewUrl);
                          setEmotionSourceFilename('Uploading...');

                          try {
                            // Upload to ComfyUI
                            const formData = new FormData();
                            formData.append('file', file);

                            const response = await fetch(`/api/comfyui/upload-image?serverUrl=${encodeURIComponent(comfyUISettings.serverUrl)}`, {
                              method: 'POST',
                              body: formData,
                            });

                            const data = await response.json();
                            if (data.success && data.name) {
                              setEmotionSourceFilename(data.name);
                            } else {
                              setEmotionSourceFilename(file.name);
                              setEmotionError(data.error || 'Upload failed');
                            }
                          } catch (err) {
                            setEmotionSourceFilename(file.name);
                            setEmotionError(err instanceof Error ? err.message : 'Upload failed');
                          }

                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="aspect-square bg-black/30 rounded-lg flex items-center justify-center overflow-hidden mb-2">
                  {emotionSourceImage || currentCard?.meta?.id ? (
                    <img
                      src={emotionSourceImage || `/api/cards/${currentCard?.meta.id}/icon`}
                      alt="Source"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-dark-muted">
                      <div className="text-3xl mb-1">&#128444;</div>
                      <p className="text-xs">No image</p>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={emotionSourceFilename}
                  onChange={(e) => setEmotionSourceFilename(e.target.value)}
                  placeholder="Image filename (in ComfyUI input)"
                  className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs"
                />
              </div>

              {/* Settings */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Format</label>
                    <select
                      value={emotionFormat}
                      onChange={(e) => setEmotionFormat(e.target.value as 'sillytavern' | 'voxta')}
                      className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs"
                    >
                      <option value="sillytavern">SillyTavern ({emotionData?.sillytavern?.items?.length || 84})</option>
                      <option value="voxta">Voxta ({emotionData?.voxta?.items?.length || 186})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Workflow</label>
                    <select
                      value={selectedWorkflowId || ''}
                      onChange={(e) => setSelectedWorkflowId(e.target.value || null)}
                      className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs"
                    >
                      <option value="">-- Select --</option>
                      {workflows
                        .filter((wf) => wf.name.toLowerCase().includes('voxta') || wf.name.toLowerCase().includes('avatar'))
                        .map((wf) => (
                          <option key={wf.id} value={wf.id}>{wf.name.replace('Voxta_Avatar_Generator_', 'VAG ')}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Total Limit</label>
                    <input
                      type="number"
                      value={emotionTotalLimit}
                      onChange={(e) => setEmotionTotalLimit(Math.max(0, parseInt(e.target.value) || 0))}
                      min={0}
                      placeholder="0 = all"
                      className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Per Expression</label>
                    <input
                      type="number"
                      value={emotionImagesPerExpression}
                      onChange={(e) => setEmotionImagesPerExpression(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
                      min={1}
                      max={4}
                      className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Output Path</label>
                  <input
                    type="text"
                    value={emotionOutputPath}
                    onChange={(e) => setEmotionOutputPath(e.target.value)}
                    placeholder="e.g., CharacterName/"
                    className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs"
                  />
                </div>

                <button
                  onClick={async () => {
                    if (!comfyUISettings.serverUrl || !selectedWorkflowId) return;
                    setEmotionGenerating(true);
                    setEmotionError(null);
                    try {
                      const response = await fetch('/api/comfyui/generate-emotions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          serverUrl: comfyUISettings.serverUrl,
                          workflowId: selectedWorkflowId,
                          format: emotionFormat,
                          totalLimit: emotionTotalLimit,
                          sourceImage: emotionSourceFilename || undefined,
                          outputPath: emotionOutputPath || undefined,
                        }),
                      });
                      const data = await response.json();
                      if (!data.success) throw new Error(data.error || 'Generation failed');

                      // Add results to display
                      if (data.images?.length) {
                        const newResults = data.images.map((img: { filename: string; url: string }) => ({
                          filename: img.filename,
                          url: `/api/comfyui/image?serverUrl=${encodeURIComponent(comfyUISettings.serverUrl)}&filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(emotionOutputPath || '')}&type=output`,
                          selected: false,
                        }));
                        setEmotionResults(prev => [...newResults, ...prev]);
                      }
                    } catch (err) {
                      setEmotionError(err instanceof Error ? err.message : 'Generation failed');
                    } finally {
                      setEmotionGenerating(false);
                    }
                  }}
                  disabled={!connection.connected || emotionGenerating || !selectedWorkflowId}
                  className="w-full px-3 py-2 bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium text-sm hover:bg-green-700 transition-colors"
                >
                  {emotionGenerating ? 'Generating...' : `Generate ${emotionTotalLimit || emotionData?.[emotionFormat]?.items?.length || 0}`}
                </button>

                {emotionError && (
                  <div className="bg-red-900/20 border border-red-700 rounded p-2">
                    <p className="text-red-200 text-xs">{emotionError}</p>
                  </div>
                )}
              </div>

              {/* Items list */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-dark-muted">
                    Items ({emotionData?.[emotionFormat]?.items?.length || 0})
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const items = emotionData?.[emotionFormat]?.items || [];
                        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${emotionFormat}-emotions.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-2 py-0.5 text-xs bg-dark-border rounded hover:bg-dark-muted"
                    >
                      Export
                    </button>
                    <label className="px-2 py-0.5 text-xs bg-dark-border rounded hover:bg-dark-muted cursor-pointer">
                      Import
                      <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const items = JSON.parse(text);
                          if (Array.isArray(items)) {
                            await fetch('/api/comfyui/emotions', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ format: emotionFormat, items }),
                            });
                            const response = await fetch('/api/comfyui/emotions');
                            const data = await response.json();
                            setEmotionData(data);
                          }
                        } catch (err) { console.error('Failed to import:', err); }
                        e.target.value = '';
                      }} />
                    </label>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={emotionData?.[emotionFormat]?.items?.map((item: { filename: string; prompt: string }) => `${item.filename}: ${item.prompt}`).join('\n') || 'Loading...'}
                  className="flex-1 w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs font-mono resize-none"
                />
              </div>
            </div>

            {/* Right - Results Grid */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Actions bar */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Results ({emotionResults.length})</label>
                  <span className="text-xs text-dark-muted">
                    {emotionResults.filter(r => r.selected).length} selected
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEmotionResults(prev => prev.map(r => ({ ...r, selected: true })))}
                    disabled={emotionResults.length === 0}
                    className="px-2 py-1 text-xs bg-dark-border rounded hover:bg-dark-muted disabled:opacity-50"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setEmotionResults(prev => prev.map(r => ({ ...r, selected: false })))}
                    disabled={emotionResults.filter(r => r.selected).length === 0}
                    className="px-2 py-1 text-xs bg-dark-border rounded hover:bg-dark-muted disabled:opacity-50"
                  >
                    Deselect
                  </button>
                  <button
                    onClick={async () => {
                      const selected = emotionResults.filter(r => r.selected);
                      if (selected.length === 0 || !currentCard) return;

                      for (const item of selected) {
                        try {
                          const response = await fetch(item.url);
                          const blob = await response.blob();
                          const formData = new FormData();
                          formData.append('file', blob, `${item.filename}.png`);
                          formData.append('type', 'emotion');
                          await fetch(`/api/cards/${currentCard.meta.id}/assets`, {
                            method: 'POST',
                            body: formData,
                          });
                        } catch (err) {
                          console.error('Failed to save:', item.filename, err);
                        }
                      }
                      // Remove saved items
                      setEmotionResults(prev => prev.filter(r => !r.selected));
                    }}
                    disabled={emotionResults.filter(r => r.selected).length === 0}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Save as Emotions
                  </button>
                  <button
                    onClick={() => setEmotionResults(prev => prev.filter(r => !r.selected))}
                    disabled={emotionResults.filter(r => r.selected).length === 0}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Image grid */}
              <div className="flex-1 overflow-auto">
                {emotionResults.length > 0 ? (
                  <div className="grid grid-cols-6 gap-2">
                    {emotionResults.map((result, idx) => (
                      <div
                        key={idx}
                        onClick={() => setEmotionResults(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))}
                        className={`relative aspect-square bg-dark-surface border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                          result.selected ? 'border-green-500 ring-2 ring-green-500/50' : 'border-dark-border hover:border-dark-muted'
                        }`}
                      >
                        <img src={result.url} alt={result.filename} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                          <p className="text-xs text-white truncate">{result.filename}</p>
                        </div>
                        {result.selected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">&#10003;</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-dark-muted">
                    <div className="text-center">
                      <div className="text-4xl mb-2">&#127912;</div>
                      <p>Generated emotions will appear here</p>
                      <p className="text-xs mt-1">Click images to select, then save or delete</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300"
            onClick={() => setLightboxImage(null)}
          >
            &times;
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Save Asset Modal */}
      {saveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Save as Asset</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Asset Type</label>
                <select
                  value={saveModal.suggestedType}
                  onChange={(e) => setSaveModal({ ...saveModal, suggestedType: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                >
                  <option value="icon">Icon</option>
                  <option value="background">Background</option>
                  <option value="user_avatar">User Avatar</option>
                  <option value="emotion">Emotion</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Filename</label>
                <input
                  type="text"
                  value={saveModal.suggestedFilename}
                  onChange={(e) => setSaveModal({ ...saveModal, suggestedFilename: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => setSaveModal(null)}
                  className="px-4 py-2 bg-dark-border text-white rounded hover:bg-dark-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => doSaveAsset(saveModal.imageUrl, saveModal.suggestedType, saveModal.suggestedFilename)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LLM Prompt Generation Modal */}
      {llmPromptModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Generate Prompt with AI</h3>
              <button
                onClick={() => setLlmPromptModal((prev) => ({ ...prev, open: false }))}
                className="text-dark-muted hover:text-dark-text text-xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {/* Provider Info */}
              <div className="text-sm text-dark-muted">
                Using: {llmSettings.providers.find((p) => p.id === llmSettings.activeProviderId)?.label || llmSettings.providers[0]?.label || 'No provider configured'}
              </div>

              {/* Fields to Include */}
              <div>
                <label className="block text-sm font-medium mb-2">Include Fields</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'name', label: 'Name', hasData: !!cardData?.name },
                    { key: 'description', label: 'Description', hasData: !!cardData?.description },
                    { key: 'personality', label: 'Personality', hasData: !!cardData?.personality },
                    { key: 'appearance', label: 'Appearance', hasData: !!(((cardData as any)?.extensions?.voxta?.appearance) || ((cardData as any)?.extensions?.visual_description)) },
                    { key: 'scenario', label: 'Scenario', hasData: !!cardData?.scenario },
                    { key: 'firstMessage', label: 'First Message', hasData: !!cardData?.first_mes },
                  ].map(({ key, label, hasData }) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        llmPromptModal.includeFields[key as keyof typeof llmPromptModal.includeFields]
                          ? 'border-purple-500 bg-purple-900/20'
                          : 'border-dark-border hover:border-dark-muted'
                      } ${!hasData ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={llmPromptModal.includeFields[key as keyof typeof llmPromptModal.includeFields]}
                        onChange={(e) =>
                          setLlmPromptModal((prev) => ({
                            ...prev,
                            includeFields: { ...prev.includeFields, [key]: e.target.checked },
                          }))
                        }
                        className="rounded"
                        disabled={!hasData}
                      />
                      <span className="text-sm">{label}</span>
                      {!hasData && <span className="text-xs text-dark-muted">(empty)</span>}
                    </label>
                  ))}
                </div>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Temperature: {llmPromptModal.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.1"
                  value={llmPromptModal.temperature}
                  onChange={(e) =>
                    setLlmPromptModal((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-dark-muted">
                  <span>Focused</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Instruction */}
              <div>
                <label className="block text-sm font-medium mb-1">Instruction</label>
                <textarea
                  value={llmPromptModal.instruction}
                  onChange={(e) => setLlmPromptModal((prev) => ({ ...prev, instruction: e.target.value }))}
                  rows={4}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
                  placeholder="Describe how the AI should generate the prompt..."
                />
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-medium mb-2">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Full Body', value: 'Generate a detailed comma-delimited list of keywords for a full body portrait. Include hair, eyes, outfit, body type, pose, and artistic style. Output ONLY keywords.' },
                    { label: 'Portrait', value: 'Generate keywords for a close-up facial portrait. Focus on face, eyes, expression, hair, lighting. Output ONLY keywords.' },
                    { label: 'Scene', value: 'Generate keywords for an illustrated scene with this character. Include character, environment, lighting, atmosphere. Output ONLY keywords.' },
                    { label: 'Background', value: 'Generate keywords for a background/environment only. No characters. Focus on architecture, lighting, atmosphere. Output ONLY keywords.' },
                  ].map(({ label, value }) => (
                    <button
                      key={label}
                      onClick={() => setLlmPromptModal((prev) => ({ ...prev, instruction: value }))}
                      className="px-3 py-1 text-xs bg-dark-border rounded hover:bg-dark-muted transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t border-dark-border">
                <button
                  onClick={() => setLlmPromptModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 bg-dark-border text-white rounded hover:bg-dark-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLLMGeneratePrompt}
                  disabled={generatingLLMPrompt || !llmPromptModal.instruction.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generatingLLMPrompt ? (
                    <>
                      <span className="animate-spin">&#9696;</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      &#10024; Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
