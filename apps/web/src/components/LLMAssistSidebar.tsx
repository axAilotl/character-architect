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
  const { settings, loadSettings } = useLLMStore();

  const [instruction, setInstruction] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<PresetOperation | null>(null);
  const [presetParams, setPresetParams] = useState<Record<string, any>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [streaming, setStreaming] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [assistResponse, setAssistResponse] = useState<LLMAssistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

  const handleRun = async () => {
    if (!instruction && !selectedPreset) {
      setError('Please provide an instruction or select a preset');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStreamedContent('');
    setAssistResponse(null);

    const context: FieldContext = {
      fieldName,
      currentValue,
      selection,
      spec: cardSpec,
    };

    const request = {
      providerId: selectedProvider,
      model,
      instruction: instruction || getPresetInstruction(selectedPreset!, presetParams),
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

  if (!isOpen) return null;

  const provider = settings.providers.find((p) => p.id === selectedProvider);

  return (
    <div className="fixed right-0 top-0 h-full w-[600px] bg-slate-800 border-l border-dark-border shadow-2xl z-40 flex flex-col">
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
      </div>

      {/* Presets */}
      <div className="p-4 border-b border-dark-border">
        <label className="block text-sm font-medium mb-2">Quick Presets</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handlePresetSelect('tighten')}
            className={`px-3 py-2 text-sm rounded border ${
              selectedPreset === 'tighten'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-dark-border hover:border-blue-500'
            }`}
          >
            Tighten
          </button>
          <button
            onClick={() => handlePresetSelect('convert-structured')}
            className={`px-3 py-2 text-sm rounded border ${
              selectedPreset === 'convert-structured'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-dark-border hover:border-blue-500'
            }`}
          >
            → Structured
          </button>
          <button
            onClick={() => handlePresetSelect('convert-prose')}
            className={`px-3 py-2 text-sm rounded border ${
              selectedPreset === 'convert-prose'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-dark-border hover:border-blue-500'
            }`}
          >
            → Prose
          </button>
          <button
            onClick={() => handlePresetSelect('enforce-style')}
            className={`px-3 py-2 text-sm rounded border ${
              selectedPreset === 'enforce-style'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-dark-border hover:border-blue-500'
            }`}
          >
            Fix Style
          </button>
          <button
            onClick={() => handlePresetSelect('generate-alts')}
            className={`px-3 py-2 text-sm rounded border ${
              selectedPreset === 'generate-alts'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-dark-border hover:border-blue-500'
            }`}
          >
            Gen Alts
          </button>
          <button
            onClick={() => handlePresetSelect('generate-lore')}
            className={`px-3 py-2 text-sm rounded border ${
              selectedPreset === 'generate-lore'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-dark-border hover:border-blue-500'
            }`}
          >
            → Lore Entry
          </button>
        </div>

        {/* Preset Params */}
        {selectedPreset === 'tighten' && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Target Tokens</label>
            <input
              type="number"
              value={presetParams.tokenTarget || 200}
              onChange={(e) =>
                setPresetParams({ ...presetParams, tokenTarget: parseInt(e.target.value) })
              }
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
            />
          </div>
        )}

        {selectedPreset === 'generate-alts' && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Number of Alternatives</label>
            <input
              type="number"
              min="1"
              max="10"
              value={presetParams.count || 3}
              onChange={(e) =>
                setPresetParams({ ...presetParams, count: parseInt(e.target.value) })
              }
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Custom Instruction */}
      <div className="p-4 border-b border-dark-border">
        <label className="block text-sm font-medium mb-2">
          Custom Instruction {selectedPreset && '(overrides preset)'}
        </label>
        <textarea
          value={instruction}
          onChange={(e) => {
            setInstruction(e.target.value);
            if (e.target.value) setSelectedPreset(null);
          }}
          placeholder="Describe what you want to do..."
          className="w-full h-24 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm resize-none"
        />

        <button
          onClick={handleRun}
          disabled={isProcessing || (!instruction && !selectedPreset)}
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

            <div className="text-xs text-dark-muted space-y-1">
              <div>Provider: {assistResponse.metadata.provider}</div>
              <div>Model: {assistResponse.metadata.model}</div>
              <div>
                Tokens: {assistResponse.metadata.promptTokens} prompt +{' '}
                {assistResponse.metadata.completionTokens} completion
              </div>
            </div>
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
