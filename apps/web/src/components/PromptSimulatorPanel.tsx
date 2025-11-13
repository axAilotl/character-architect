import { useState, useEffect } from 'react';
import { useCardStore } from '../store/card-store';

type PromptProfile = 'generic-ccv3' | 'strict-ccv3' | 'ccv2-compat';
type DropPolicy = 'oldest-first' | 'lowest-priority' | 'truncate-end';

interface PromptSegment {
  fieldName: string;
  content: string;
  tokens: number;
  priority: number;
  order: number;
  dropped: boolean;
}

interface PromptComposition {
  profile: PromptProfile;
  fullPrompt: string;
  segments: PromptSegment[];
  totalTokens: number;
  droppedSegments: PromptSegment[];
  withinBudget: boolean;
}

interface ProfileConfig {
  name: string;
  description: string;
}

export function PromptSimulatorPanel() {
  const card = useCardStore((state) => state.currentCard);
  const [profiles, setProfiles] = useState<Record<PromptProfile, ProfileConfig>>({});
  const [selectedProfile, setSelectedProfile] = useState<PromptProfile>('generic-ccv3');
  const [composition, setComposition] = useState<PromptComposition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Budget settings
  const [useBudget, setUseBudget] = useState(false);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [dropPolicy, setDropPolicy] = useState<DropPolicy>('lowest-priority');
  const [preserveFields, setPreserveFields] = useState<string[]>(['description', 'first_mes']);

  // Load available profiles
  useEffect(() => {
    fetch('http://localhost:3001/prompt-simulator/profiles')
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles))
      .catch((err) => console.error('Failed to load profiles:', err));
  }, []);

  // Simulate prompt composition
  const simulate = async () => {
    if (!card || !card.data) {
      setError('No card loaded');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/prompt-simulator/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: card.data,
          profile: selectedProfile,
          budget: useBudget ? {
            maxTokens,
            dropPolicy,
            preserveFields,
          } : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setComposition(data.composition);
      } else {
        setError(data.error || 'Failed to simulate prompt');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-simulate when card or settings change
  useEffect(() => {
    if (card) {
      simulate();
    }
  }, [card, selectedProfile, useBudget, maxTokens, dropPolicy, preserveFields.join(',')]);

  const getFieldLabel = (fieldName: string) => {
    return fieldName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Prompt Simulator</h2>
          <p className="text-slate-400">
            Preview how different frontends compose your character card into prompts
          </p>
        </div>

        {/* Profile Selection */}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Target Profile
            </label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value as PromptProfile)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {Object.entries(profiles).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name} - {config.description}
                </option>
              ))}
            </select>
          </div>

          {/* Token Budget Settings */}
          <div className="space-y-3 border-t border-slate-700 pt-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use-budget"
                checked={useBudget}
                onChange={(e) => setUseBudget(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500"
              />
              <label htmlFor="use-budget" className="text-sm font-medium text-slate-300">
                Enable Token Budget Limit
              </label>
            </div>

            {useBudget && (
              <div className="grid grid-cols-2 gap-4 pl-7">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    min={100}
                    max={200000}
                    step={100}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Drop Policy</label>
                  <select
                    value={dropPolicy}
                    onChange={(e) => setDropPolicy(e.target.value as DropPolicy)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="oldest-first">Drop Oldest First</option>
                    <option value="lowest-priority">Drop Lowest Priority</option>
                    <option value="truncate-end">Truncate End</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="card text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-slate-400 mt-2">Simulating prompt composition...</p>
          </div>
        )}

        {error && (
          <div className="card bg-red-900/20 border-red-500 text-red-300">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {composition && !loading && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center">
                <div className="text-3xl font-bold text-blue-400">{composition.totalTokens}</div>
                <div className="text-sm text-slate-400 mt-1">Total Tokens</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-green-400">{composition.segments.length}</div>
                <div className="text-sm text-slate-400 mt-1">Active Segments</div>
              </div>
              <div className="card text-center">
                <div className={`text-3xl font-bold ${composition.droppedSegments.length > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                  {composition.droppedSegments.length}
                </div>
                <div className="text-sm text-slate-400 mt-1">Dropped Segments</div>
              </div>
            </div>

            {/* Budget Warning */}
            {useBudget && !composition.withinBudget && (
              <div className="card bg-yellow-900/20 border-yellow-500 text-yellow-300">
                <p className="font-medium">⚠ Over Budget</p>
                <p className="text-sm mt-1">
                  The prompt exceeds your {maxTokens} token budget by{' '}
                  {composition.totalTokens - maxTokens} tokens even after applying drop policy.
                </p>
              </div>
            )}

            {/* Segments Breakdown */}
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Prompt Segments</h3>
              <div className="space-y-3">
                {composition.segments.map((segment, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500">#{segment.order + 1}</span>
                        <span className="font-medium text-slate-200">
                          {getFieldLabel(segment.fieldName)}
                        </span>
                        <span className="text-xs text-slate-500">Priority: {segment.priority}</span>
                      </div>
                      <div className="chip-token">{segment.tokens} tokens</div>
                    </div>
                    <div className="text-sm text-slate-400 font-mono whitespace-pre-wrap line-clamp-3">
                      {segment.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dropped Segments */}
            {composition.droppedSegments.length > 0 && (
              <div className="card border-red-800/50">
                <h3 className="text-lg font-semibold text-red-400 mb-4">
                  Dropped Segments ({composition.droppedSegments.length})
                </h3>
                <div className="space-y-3">
                  {composition.droppedSegments.map((segment, idx) => (
                    <div
                      key={idx}
                      className="bg-red-900/10 rounded-lg p-4 border border-red-800/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-red-300">
                          {getFieldLabel(segment.fieldName)}
                        </span>
                        <div className="chip-token bg-red-900/50 border-red-700">
                          {segment.tokens} tokens
                        </div>
                      </div>
                      <div className="text-sm text-slate-500 font-mono whitespace-pre-wrap line-clamp-2">
                        {segment.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Prompt Preview */}
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Full Prompt Preview</h3>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 max-h-96 overflow-y-auto">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {composition.fullPrompt}
                </pre>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-slate-400">
                  {composition.fullPrompt.length} characters
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(composition.fullPrompt);
                  }}
                  className="btn-secondary text-sm"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
