/**
 * LLM Assist Sidebar
 * Provides AI-powered editing capabilities for any field
 */

import { useState, useEffect, useRef } from 'react';
import { generateId } from '@card-architect/import-core';
import { useLLMStore } from '../../../store/llm-store';
import { api } from '../../../lib/api';
import { getDeploymentConfig } from '../../../config/deployment';
import { invokeClientLLM, type ClientLLMProvider } from '../../../lib/client-llm';
import type {
  FieldContext,
  LLMAssistResponse,
  LLMStreamChunk,
  RagSnippet,
  UserPreset,
} from '../../../lib/types';
import { DiffViewer } from '../../../components/ui/DiffViewer';
import { defaultPresets as DEFAULT_PRESETS } from '../../../lib/default-presets';

interface LLMAssistSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fieldName: string;
  currentValue: string;
  selection?: string;
  onApply: (value: string, action: 'replace' | 'append' | 'insert') => void;
  cardSpec: 'v2' | 'v3' | 'collection' | 'lorebook';
}

export function LLMAssistSidebar({
  isOpen,
  onClose,
  fieldName,
  currentValue,
  selection,
  onApply,
  cardSpec,
}: LLMAssistSidebarProps) {
  const { settings, loadSettings, ragDatabases, ragActiveDatabaseId, loadRagDatabases } =
    useLLMStore();

  const [instruction, setInstruction] = useState('');
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showCustomInstruction, setShowCustomInstruction] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [streaming, setStreaming] = useState(true);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(false);
  const [ragToggleTouched, setRagToggleTouched] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('');
  const [ragQuery, setRagQuery] = useState('');
  const [lastRagSnippets, setLastRagSnippets] = useState<RagSnippet[]>([]);
  const [ragSearching, setRagSearching] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [assistResponse, setAssistResponse] = useState<LLMAssistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadSettings();
    loadRagDatabases();
  }, [loadSettings, loadRagDatabases]);

  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen]);

  const loadPresets = async () => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      // Load from localStorage or use defaults
      try {
        const stored = localStorage.getItem('ca-llm-presets');
        if (stored) {
          setPresets([...DEFAULT_PRESETS, ...JSON.parse(stored)]);
        } else {
          setPresets(DEFAULT_PRESETS);
        }
      } catch {
        setPresets(DEFAULT_PRESETS);
      }
      return;
    }

    const result = await api.getPresets();
    if (result.data?.presets) {
      setPresets(result.data.presets);
    }
  };

  useEffect(() => {
    if (settings.providers.length > 0) {
      const activeProvider =
        settings.providers.find((p) => p.id === settings.activeProviderId) ||
        settings.providers[0];
      setSelectedProvider(activeProvider.id);
      setModel(activeProvider.defaultModel);
      setTemperature(activeProvider.temperature ?? 0.7);
      setMaxTokens(activeProvider.maxTokens ?? 2048);
      setStreaming(activeProvider.streamDefault ?? true);
    }
  }, [settings]);

  useEffect(() => {
    if (ragDatabases.length === 0) {
      setSelectedKnowledgeBase('');
      return;
    }

    if (ragActiveDatabaseId) {
      setSelectedKnowledgeBase(ragActiveDatabaseId);
    } else if (!selectedKnowledgeBase) {
      setSelectedKnowledgeBase(ragDatabases[0].id);
    }
  }, [ragDatabases, ragActiveDatabaseId, selectedKnowledgeBase]);

  useEffect(() => {
    if (!ragToggleTouched) {
      setUseKnowledgeBase(!!(settings.rag?.enabled && ragDatabases.length > 0));
    }
  }, [settings.rag?.enabled, ragDatabases.length, ragToggleTouched]);

  useEffect(() => {
    if (!useKnowledgeBase) {
      setLastRagSnippets([]);
    }
  }, [useKnowledgeBase]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
      setError('Request stopped by user');
    }
  };

  const handleRun = async () => {
    if (!instruction && !selectedPresetId) {
      setError('Please provide an instruction or select a preset');
      return;
    }

    // Create abort controller
    abortControllerRef.current = new AbortController();

    setIsProcessing(true);
    setError(null);
    setStreamedContent('');
    setAssistResponse(null);
    setRagSearching(false);

    // Get instruction from either custom instruction or selected preset
    let finalInstruction = instruction;
    if (!finalInstruction && selectedPresetId) {
      const preset = presets.find(p => p.id === selectedPresetId);
      if (preset) {
        finalInstruction = preset.instruction;
      }
    }

    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    // Light mode: use client-side LLM (no RAG support)
    if (isLightMode) {
      const activeProvider = settings.providers.find(p => p.id === selectedProvider);
      if (!activeProvider) {
        setError('No LLM provider configured. Go to Settings > AI Providers.');
        setIsProcessing(false);
        return;
      }

      const clientProvider: ClientLLMProvider = {
        id: activeProvider.id,
        name: activeProvider.label || activeProvider.name,
        kind: (activeProvider as any).clientKind || (activeProvider.kind === 'anthropic' ? 'anthropic' : 'openai-compatible'),
        baseURL: activeProvider.baseURL || '',
        apiKey: activeProvider.apiKey || '',
        defaultModel: activeProvider.defaultModel || '',
        temperature: activeProvider.temperature,
        maxTokens: activeProvider.maxTokens,
      };

      const systemPrompt = `You are an AI assistant helping to edit character card content.
Field being edited: ${fieldName}
${selection ? `Selected text: "${selection}"` : ''}

Your task: ${finalInstruction}

Respond with ONLY the revised text. Do not include explanations or markdown formatting.`;

      try {
        const result = await invokeClientLLM({
          provider: clientProvider,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: currentValue },
          ],
          temperature,
          maxTokens,
          model,
        });

        if (!result.success) {
          throw new Error(result.error || 'LLM request failed');
        }

        const revised = result.content || '';
        setAssistResponse({
          content: revised,
          model: activeProvider?.defaultModel || 'unknown',
          usage: { promptTokens: 0, completionTokens: 0 },
          original: selection || currentValue,
          revised,
          diff: [],
          tokenDelta: { before: 0, after: 0, delta: 0 },
          metadata: {
            model: activeProvider?.defaultModel || 'unknown',
            provider: activeProvider?.label || activeProvider?.name || 'unknown',
            temperature: 0.7,
            promptTokens: 0,
            completionTokens: 0,
          },
        });
        setIsProcessing(false);
        abortControllerRef.current = null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'LLM request failed');
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
      return;
    }

    // Full mode: use server-side LLM with RAG support
    let ragSnippets: RagSnippet[] | undefined;

    if (useKnowledgeBase) {
      if (!settings.rag?.enabled) {
        setError('Enable RAG in Settings to use knowledge bases.');
        setIsProcessing(false);
        return;
      }
      if (!selectedKnowledgeBase) {
        setError('Select a knowledge base before running LLM Assist.');
        setIsProcessing(false);
        return;
      }

      const queryText = buildRagQuery(ragQuery, finalInstruction, fieldName, currentValue);

      setRagSearching(true);
      const { data: ragData, error: ragError } = await api.searchRag(
        selectedKnowledgeBase,
        queryText
      );
      setRagSearching(false);

      if (ragError) {
        setError(`RAG search failed: ${ragError}`);
        setIsProcessing(false);
        return;
      }

      ragSnippets = ragData?.snippets ?? [];
      setLastRagSnippets(ragSnippets);
    }

    const context: FieldContext = {
      fieldName,
      currentValue,
      selection,
      spec: cardSpec,
    };
    if (ragSnippets && ragSnippets.length > 0) {
      context.ragSnippets = ragSnippets;
    }

    const request = {
      providerId: selectedProvider,
      model,
      instruction: finalInstruction,
      context,
      temperature,
      maxTokens,
      stream: streaming,
    };

    if (streaming) {
      api.llmAssistStream(
        request,
        (chunk: LLMStreamChunk) => {
          if (chunk.content) {
            setStreamedContent((prev) => prev + chunk.content);
          }
        },
        (response: LLMAssistResponse) => {
          setAssistResponse(response);
          setIsProcessing(false);
          abortControllerRef.current = null;
        },
        (err: string) => {
          if (!err.includes('abort')) {
            setError(err);
          }
          setIsProcessing(false);
          abortControllerRef.current = null;
        },
        abortControllerRef.current?.signal
      );
    } else {
      try {
        const { data, error: apiError } = await api.llmAssist(request);
        setIsProcessing(false);
        abortControllerRef.current = null;

        if (apiError) {
          setError(apiError);
        } else if (data) {
          setAssistResponse(data);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleApply = (action: 'replace' | 'append' | 'insert') => {
    if (assistResponse) {
      onApply(assistResponse.revised || assistResponse.content, action);
      onClose();
    }
  };

  const handleUserPresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    setInstruction(''); // Clear custom instruction when preset is selected
  };

  const handleSaveAsPreset = async () => {
    if (!instruction.trim()) return;

    const name = prompt('Enter a name for this preset:');
    if (!name) return;

    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      // Save to localStorage in light mode
      const saveNow = new Date().toISOString();
      const newPreset: UserPreset = {
        id: generateId(),
        name: name.trim(),
        instruction: instruction.trim(),
        category: 'custom',
        description: '',
        isBuiltIn: false,
        createdAt: saveNow,
        updatedAt: saveNow,
      };
      try {
        const stored = localStorage.getItem('ca-llm-presets');
        const existing = stored ? JSON.parse(stored) : [];
        const updated = [...existing, newPreset];
        localStorage.setItem('ca-llm-presets', JSON.stringify(updated));
        await loadPresets();
        setSelectedPresetId(newPreset.id);
        setInstruction('');
        setShowCustomInstruction(false);
      } catch {
        setError('Failed to save preset');
      }
      return;
    }

    const result = await api.createPreset({
      name: name.trim(),
      instruction: instruction.trim(),
      category: 'custom',
      description: '',
    });

    if (result.data?.preset) {
      await loadPresets();
      setSelectedPresetId(result.data.preset.id);
      setInstruction('');
      setShowCustomInstruction(false);
    } else if (result.error) {
      setError(`Failed to save preset: ${result.error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-0 right-0 bottom-0 bg-slate-800 border-l border-dark-border shadow-2xl z-40 flex flex-col w-[500px]"
    >
      {/* Header */}
      <div className="p-4 border-b border-dark-border flex justify-between items-center">
        <h3 className="text-lg font-bold">LLM Assist: {fieldName}</h3>
        <button
          onClick={onClose}
          className="text-dark-muted hover:text-dark-text transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Config */}
      <div className="p-4 border-b border-dark-border space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => {
              const newProvider = settings.providers.find((p) => p.id === e.target.value);
              if (newProvider) {
                setSelectedProvider(e.target.value);
                setModel(newProvider.defaultModel);
                setTemperature(newProvider.temperature ?? 0.7);
              }
            }}
            className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
          >
            {settings.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Knowledge Base</label>
            <span className="text-xs text-dark-muted">
              {settings.rag?.enabled ? `${ragDatabases.length} available` : 'Disabled'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="useRag"
              checked={useKnowledgeBase}
              disabled={!settings.rag?.enabled || ragDatabases.length === 0}
              onChange={(e) => {
                setUseKnowledgeBase(e.target.checked);
                setRagToggleTouched(true);
              }}
              className="rounded"
            />
            <label htmlFor="useRag" className="text-xs text-dark-muted">
              {settings.rag?.enabled
                ? ragDatabases.length === 0
                  ? 'Add knowledge bases in Settings to enable.'
                  : 'Retrieve lore and guide snippets before prompting.'
                : 'Enable RAG in Settings to use knowledge bases.'}
            </label>
          </div>

          {useKnowledgeBase && settings.rag?.enabled && ragDatabases.length > 0 && (
            <div className="mt-3 space-y-2">
              <select
                value={selectedKnowledgeBase}
                onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              >
                {ragDatabases.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.label} ({db.sourceCount} docs)
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Optional focus keywords"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-dark-muted">
                Leave blank to derive from the current instruction and field text.
              </p>
              {ragSearching && (
                <p className="text-xs text-blue-300">Retrieving knowledge snippets…</p>
              )}
            </div>
          )}
        </div>
      </div>

      {useKnowledgeBase && lastRagSnippets.length > 0 && (
        <div className="p-4 border-b border-dark-border bg-slate-900/30">
          <div className="text-xs font-semibold text-dark-muted uppercase tracking-wide mb-2">
            Injected Context
          </div>
          <div className="space-y-1 max-h-24 overflow-auto pr-1">
            {lastRagSnippets.slice(0, 4).map((snippet) => (
              <div key={snippet.id} className="text-xs text-dark-text">
                <span className="font-medium text-blue-200">{snippet.sourceTitle}</span>{' '}
                <span className="text-dark-muted">({snippet.tokenCount} tokens)</span>
              </div>
            ))}
            {lastRagSnippets.length > 4 && (
              <div className="text-xs text-dark-muted">
                +{lastRagSnippets.length - 4} additional snippets included
              </div>
            )}
          </div>
        </div>
      )}

      {/* Presets - Fixed height scrollable */}
      <div className="border-b border-dark-border flex flex-col" style={{ height: '400px' }}>
        <div className="p-4 pb-2">
          <label className="block text-sm font-medium mb-2">Presets</label>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {presets.length === 0 ? (
            <div className="text-xs text-dark-muted text-center py-4">
              No presets available. Add presets in Settings.
            </div>
          ) : (
            <div className="space-y-3">
              {(['rewrite', 'format', 'generate', 'custom'] as const).map((category) => {
                const categoryPresets = presets.filter((p) => p.category === category);
                if (categoryPresets.length === 0) return null;

                return (
                  <div key={category}>
                    <div className="text-xs font-semibold text-dark-muted uppercase tracking-wide mb-1.5">
                      {category}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {categoryPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleUserPresetSelect(preset.id)}
                          className={`px-3 py-2 text-xs rounded border text-left ${
                            selectedPresetId === preset.id
                              ? 'border-blue-500 bg-blue-900/30'
                              : 'border-dark-border hover:border-blue-500'
                          }`}
                          title={preset.description || preset.instruction.slice(0, 100)}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Custom Instruction - Collapsible */}
      <div className="border-b border-dark-border">
        <button
          onClick={() => setShowCustomInstruction(!showCustomInstruction)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
        >
          <span className="text-sm font-medium">
            Custom Instruction {selectedPresetId && '(overrides preset)'}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${showCustomInstruction ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCustomInstruction && (
          <div className="p-4 pt-0 flex flex-col gap-2">
            <textarea
              value={instruction}
              onChange={(e) => {
                setInstruction(e.target.value);
                if (e.target.value) {
                  setSelectedPresetId(null);
                }
              }}
              placeholder="Describe what you want to do..."
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm resize-none h-32"
            />
            {instruction.trim() && (
              <button
                onClick={handleSaveAsPreset}
                className="self-end px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
              >
                Save as Preset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Run/Stop Button - Always visible */}
      <div className="p-4 border-b border-dark-border">
        {isProcessing ? (
          <button
            onClick={handleStop}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={!instruction && !selectedPresetId}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run
          </button>
        )}
      </div>

      {/* Results - Takes remaining space */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        {isProcessing && streaming && streamedContent && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Streaming...</h4>
            <div className="p-3 bg-dark-bg border border-dark-border rounded text-sm whitespace-pre-wrap">
              {streamedContent}
            </div>
          </div>
        )}

        {assistResponse && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Result</h4>
              {assistResponse.tokenDelta && (
                <div className="text-xs text-dark-muted">
                  {assistResponse.tokenDelta.delta > 0 ? '+' : ''}
                  {assistResponse.tokenDelta.delta} tokens ({assistResponse.tokenDelta.before} →{' '}
                  {assistResponse.tokenDelta.after})
                </div>
              )}
            </div>

            {assistResponse.diff && (
              <DiffViewer
                diff={assistResponse.diff}
                originalText={assistResponse.original}
                revisedText={assistResponse.revised}
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleApply('replace')}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Replace
              </button>
              {(fieldName === 'alternate_greetings' || fieldName === 'mes_example') && (
                <button
                  onClick={() => handleApply('append')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Append
                </button>
              )}
            </div>

            {assistResponse.metadata && (
              <div className="text-xs text-dark-muted space-y-1">
                <div>Provider: {assistResponse.metadata.provider}</div>
                <div>Model: {assistResponse.metadata.model}</div>
                <div>
                  Tokens: {assistResponse.metadata.promptTokens} prompt +{' '}
                  {assistResponse.metadata.completionTokens} completion
                </div>
              </div>
            )}
         </div>
       )}

        {!isProcessing && !assistResponse && !error && (
          <div className="text-center text-dark-muted text-sm">
            Configure settings and run to see results
          </div>
        )}
      </div>
    </div>
  );
}

function buildRagQuery(
  customQuery: string,
  instruction: string,
  fieldName: string,
  fieldValue: string
): string {
  if (customQuery.trim()) {
    return customQuery.trim();
  }

  if (instruction.trim()) {
    return instruction.trim();
  }

  const condensed = fieldValue.replace(/\s+/g, ' ').slice(0, 200);
  return `${fieldName}: ${condensed}`;
}
