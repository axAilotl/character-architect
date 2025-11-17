/**
 * LLM Assist Sidebar
 * Provides AI-powered editing capabilities for any field
 */

import { useState, useEffect } from 'react';
import { useLLMStore } from '../store/llm-store';
import { api } from '../lib/api';
import type {
  FieldContext,
  CCFieldName,
  PresetOperation,
  LLMAssistResponse,
  LLMStreamChunk,
  RagSnippet,
  UserPreset,
} from '@card-architect/schemas';
import { DiffViewer } from './DiffViewer';

interface LLMAssistSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fieldName: CCFieldName;
  currentValue: string;
  selection?: string;
  onApply: (value: string, action: 'replace' | 'append' | 'insert') => void;
  cardSpec: 'v2' | 'v3';
  panelWidth?: string;
  panelRight?: string;
}

export function LLMAssistSidebar({
  isOpen,
  onClose,
  fieldName,
  currentValue,
  selection,
  onApply,
  cardSpec,
  panelWidth = '600px',
  panelRight = '0px',
}: LLMAssistSidebarProps) {
  const { settings, loadSettings, ragDatabases, ragActiveDatabaseId, loadRagDatabases } =
    useLLMStore();

  const [instruction, setInstruction] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<PresetOperation | null>(null);
  const [presetParams, setPresetParams] = useState<Record<string, any>>({});
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
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
      setUseKnowledgeBase(settings.rag.enabled && ragDatabases.length > 0);
    }
  }, [settings.rag.enabled, ragDatabases.length, ragToggleTouched]);

  useEffect(() => {
    if (!useKnowledgeBase) {
      setLastRagSnippets([]);
    }
  }, [useKnowledgeBase]);

  const handleRun = async () => {
    if (!instruction && !selectedPreset && !selectedPresetId) {
      setError('Please provide an instruction or select a preset');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStreamedContent('');
    setAssistResponse(null);
    setRagSearching(false);

    // Get instruction from either custom instruction, new preset system, or old preset system
    let finalInstruction = instruction;
    if (!finalInstruction && selectedPresetId) {
      const preset = presets.find(p => p.id === selectedPresetId);
      if (preset) {
        finalInstruction = preset.instruction;
      }
    }
    if (!finalInstruction && selectedPreset) {
      finalInstruction = getPresetInstruction(selectedPreset, presetParams);
    }

    let ragSnippets: RagSnippet[] | undefined;

    if (useKnowledgeBase) {
      if (!settings.rag.enabled) {
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
      preset: selectedPreset ? { operation: selectedPreset, params: presetParams } : undefined,
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
        },
        (err: string) => {
          setError(err);
          setIsProcessing(false);
        }
      );
    } else {
      const { data, error: apiError } = await api.llmAssist(request);
      setIsProcessing(false);

      if (apiError) {
        setError(apiError);
      } else if (data) {
        setAssistResponse(data);
      }
    }
  };

  const handleApply = (action: 'replace' | 'append' | 'insert') => {
    if (assistResponse) {
      onApply(assistResponse.revised, action);
      onClose();
    }
  };

  const handlePresetSelect = (preset: PresetOperation) => {
    setSelectedPreset(preset);
    setSelectedPresetId(null); // Clear new preset selection
    setInstruction(''); // Clear custom instruction when preset is selected

    // Set default params for presets
    if (preset === 'tighten') {
      setPresetParams({ tokenTarget: 200 });
    } else if (preset === 'generate-alts') {
      setPresetParams({ count: 3 });
    } else {
      setPresetParams({});
    }
  };

  const handleUserPresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    setSelectedPreset(null); // Clear old preset selection
    setInstruction(''); // Clear custom instruction when preset is selected
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-0 h-full bg-slate-800 border-l border-dark-border shadow-2xl z-40 flex flex-col"
      style={{ width: panelWidth, right: panelRight }}
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
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Temp</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="streaming"
            checked={streaming}
            onChange={(e) => setStreaming(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="streaming" className="text-sm">
            Stream response
          </label>
        </div>

        <div className="pt-3 border-t border-dark-border">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Knowledge Base</label>
            <span className="text-xs text-dark-muted">
              {settings.rag.enabled ? `${ragDatabases.length} available` : 'Disabled'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="useRag"
              checked={useKnowledgeBase}
              disabled={!settings.rag.enabled || ragDatabases.length === 0}
              onChange={(e) => {
                setUseKnowledgeBase(e.target.checked);
                setRagToggleTouched(true);
              }}
              className="rounded"
            />
            <label htmlFor="useRag" className="text-xs text-dark-muted">
              {settings.rag.enabled
                ? ragDatabases.length === 0
                  ? 'Add knowledge bases in Settings to enable.'
                  : 'Retrieve lore and guide snippets before prompting.'
                : 'Enable RAG in Settings to use knowledge bases.'}
            </label>
          </div>

          {useKnowledgeBase && settings.rag.enabled && ragDatabases.length > 0 && (
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

      {/* Presets */}
      <div className="p-4 border-b border-dark-border max-h-96 overflow-y-auto">
        <label className="block text-sm font-medium mb-2">Presets</label>

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

      {/* Custom Instruction */}
      <div className="p-4 border-b border-dark-border">
        <label className="block text-sm font-medium mb-2">
          Custom Instruction {(selectedPreset || selectedPresetId) && '(overrides preset)'}
        </label>
        <textarea
          value={instruction}
          onChange={(e) => {
            setInstruction(e.target.value);
            if (e.target.value) {
              setSelectedPreset(null);
              setSelectedPresetId(null);
            }
          }}
          placeholder="Describe what you want to do..."
          className="w-full h-24 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm resize-none"
        />

        <button
          onClick={handleRun}
          disabled={isProcessing || (!instruction && !selectedPreset && !selectedPresetId)}
          className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? 'Processing...' : 'Run'}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
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
              <div className="text-xs text-dark-muted">
                {assistResponse.tokenDelta.delta > 0 ? '+' : ''}
                {assistResponse.tokenDelta.delta} tokens ({assistResponse.tokenDelta.before} →{' '}
                {assistResponse.tokenDelta.after})
              </div>
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

/**
 * Get preset instruction text
 */
function getPresetInstruction(preset: PresetOperation, params: Record<string, any>): string {
  switch (preset) {
    case 'tighten':
      return `Tighten this text to approximately ${params.tokenTarget || 200} tokens`;
    case 'convert-structured':
      return 'Convert to structured format with labeled sections';
    case 'convert-prose':
      return 'Convert to flowing prose style';
    case 'convert-hybrid':
      return 'Convert to hybrid format (prose + bullets)';
    case 'enforce-style':
      return 'Fix formatting and enforce style rules';
    case 'generate-alts':
      return `Generate ${params.count || 3} alternate greetings`;
    case 'generate-lore':
      return 'Create a lorebook entry from this content';
    default:
      return '';
  }
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
