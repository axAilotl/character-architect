import { useState, useEffect } from 'react';
import { useCardStore } from '../store/card-store';

interface SelectiveLogic {
  type: 'AND' | 'OR';
  primaryMatched: boolean;
  secondaryMatched: boolean;
  shouldActivate: boolean;
}

interface ActiveEntry {
  entry: any;
  matchedKeys: string[];
  matchedSecondaryKeys: string[];
  matchType: 'primary' | 'secondary' | 'both';
  position: number;
  injectionDepth: number;
  reason: string;
  selectiveLogic?: SelectiveLogic;
}

interface TriggerTestResult {
  input: string;
  activeEntries: ActiveEntry[];
  injectionPreview: string;
  totalTokens: number;
}

export function LoreTriggerPanel() {
  const { currentCard } = useCardStore();
  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState<TriggerTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test the input
  const runTest = async () => {
    if (!currentCard || !currentCard.data || !testInput.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/lore-trigger/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: currentCard.data,
          input: testInput,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.result);
      } else {
        setError(data.error || 'Failed to test triggers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-test on input change (debounced)
  useEffect(() => {
    if (!testInput.trim()) {
      setResult(null);
      return;
    }

    const timer = setTimeout(() => {
      runTest();
    }, 500);

    return () => clearTimeout(timer);
  }, [testInput, currentCard?.meta.id]);

  const getLogicBadge = (logic: SelectiveLogic) => {
    const bgColor = logic.shouldActivate ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700';
    const textColor = logic.shouldActivate ? 'text-green-400' : 'text-red-400';

    return (
      <span className={`px-2 py-1 text-xs font-mono rounded border ${bgColor} ${textColor}`}>
        {logic.type} Logic
      </span>
    );
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Lore Trigger Tester</h2>
          <p className="text-slate-400">
            Test which character_book entries activate for specific phrases
          </p>
        </div>

        {/* Input Section */}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Test Input
            </label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Enter a phrase or message to test lorebook triggers..."
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              rows={4}
            />
          </div>

          {testInput.trim() && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-400">
                Testing: "{testInput.substring(0, 50)}{testInput.length > 50 ? '...' : ''}"
              </span>
              {loading && (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              )}
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="card bg-red-900/20 border-red-500 text-red-300">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card text-center">
                <div className={`text-3xl font-bold ${result.activeEntries.length > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                  {result.activeEntries.length}
                </div>
                <div className="text-sm text-slate-400 mt-1">Active Entries</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-blue-400">{result.totalTokens}</div>
                <div className="text-sm text-slate-400 mt-1">Total Tokens (with Injection)</div>
              </div>
            </div>

            {/* No Matches */}
            {result.activeEntries.length === 0 && (
              <div className="card bg-slate-800/50 text-center py-8">
                <div className="text-4xl mb-3 text-slate-600">∅</div>
                <p className="text-slate-400">No lorebook entries matched this input</p>
              </div>
            )}

            {/* Active Entries */}
            {result.activeEntries.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200">
                  Active Entries ({result.activeEntries.length})
                </h3>

                {result.activeEntries.map((active, idx) => (
                  <div key={idx} className="card border border-green-800/50 bg-green-900/10">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-green-400">
                            #{idx + 1}
                          </span>
                          <span className="text-slate-200 font-medium">
                            {active.entry.name || `Entry ${idx + 1}`}
                          </span>
                          {active.selectiveLogic && getLogicBadge(active.selectiveLogic)}
                        </div>
                        <p className="text-sm text-slate-400">{active.reason}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-slate-500">
                          Priority: {active.entry.priority || 0}
                        </span>
                        <span className="text-xs text-slate-500">
                          Position: {active.position === 0 ? 'Before' : 'After'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Depth: {active.injectionDepth}
                        </span>
                      </div>
                    </div>

                    {/* Matched Keys */}
                    {active.matchedKeys.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-slate-500 mb-1">Matched Primary Keys:</div>
                        <div className="flex flex-wrap gap-2">
                          {active.matchedKeys.map((key, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs bg-blue-900/30 border border-blue-800 text-blue-300 rounded font-mono"
                            >
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Secondary Keys */}
                    {active.matchedSecondaryKeys.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-slate-500 mb-1">Matched Secondary Keys:</div>
                        <div className="flex flex-wrap gap-2">
                          {active.matchedSecondaryKeys.map((key, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs bg-purple-900/30 border border-purple-800 text-purple-300 rounded font-mono"
                            >
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Content Preview */}
                    <div className="border-t border-slate-700 pt-3">
                      <div className="text-xs text-slate-500 mb-2">Content to Inject:</div>
                      <div className="bg-slate-800/50 rounded p-3 text-sm text-slate-300 font-mono max-h-32 overflow-y-auto">
                        {active.entry.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Injection Preview */}
            {result.activeEntries.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                  Full Injection Preview
                </h3>
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                    {result.injectionPreview}
                  </pre>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-slate-400">
                    Total: {result.totalTokens} tokens
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.injectionPreview);
                    }}
                    className="btn-secondary text-sm"
                  >
                    Copy Preview
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Help Text */}
        {!testInput.trim() && (
          <div className="card bg-blue-900/10 border-blue-800/50">
            <p className="text-blue-300 font-medium mb-2">How to use:</p>
            <ul className="text-sm text-blue-200/80 space-y-1 list-disc list-inside">
              <li>Enter a message or phrase in the input above</li>
              <li>See which lorebook entries would activate in real-time</li>
              <li>View matching keywords and AND/NOT logic results</li>
              <li>Preview the full injected prompt with entry ordering</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
