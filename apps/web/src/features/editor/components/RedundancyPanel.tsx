import { useState, useEffect } from 'react';
import { useCardStore } from '../../../store/card-store';

type RedundancyType = 'exact-duplicate' | 'semantic-overlap' | 'repeated-phrase';
type Severity = 'high' | 'medium' | 'low';

interface RedundantField {
  fieldName: string;
  content: string;
  startIndex: number;
  endIndex: number;
  excerpt: string;
}

interface ConsolidationSuggestion {
  action: 'remove' | 'merge' | 'rewrite';
  targetField: string;
  sourceFields: string[];
  originalContent: Record<string, string>;
  proposedContent: Record<string, string>;
  tokenDelta: number;
  confidence: number;
}

interface Redundancy {
  id: string;
  type: RedundancyType;
  severity: Severity;
  fields: RedundantField[];
  description: string;
  tokenImpact: number;
  suggestions: ConsolidationSuggestion[];
}

interface RedundancyReport {
  redundancies: Redundancy[];
  potentialSavings: number;
  overallScore: number;
}

export function RedundancyPanel() {
  const { currentCard, updateCardData } = useCardStore();
  const [report, setReport] = useState<RedundancyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null); // ID of redundancy being fixed

  // Analyze card for redundancies
  const analyze = async () => {
    if (!currentCard || !currentCard.data) {
      setError('No card loaded');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/redundancy/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: currentCard.data,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReport(data.report);
      } else {
        setError(data.error || 'Failed to analyze redundancy');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Apply a consolidation fix
  const applyFix = async (redundancy: Redundancy, suggestion: ConsolidationSuggestion) => {
    if (!currentCard || !currentCard.data) return;

    setApplying(redundancy.id);

    try {
      // Apply the fix locally
      const updates: any = {};

      for (const [fieldName, newContent] of Object.entries(suggestion.proposedContent)) {
        updates[fieldName] = newContent;
      }

      // Update card in store
      updateCardData(updates);

      // Re-analyze after applying fix
      setTimeout(analyze, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply fix');
    } finally {
      setApplying(null);
    }
  };

  // Auto-analyze when card changes
  useEffect(() => {
    if (currentCard) {
      analyze();
    }
  }, [currentCard?.meta.id]);

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case 'high':
        return 'text-red-400 bg-red-900/20 border-red-800';
      case 'medium':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
      case 'low':
        return 'text-blue-400 bg-blue-900/20 border-blue-800';
    }
  };

  const getTypeLabel = (type: RedundancyType) => {
    switch (type) {
      case 'exact-duplicate':
        return 'Exact Duplicate';
      case 'semantic-overlap':
        return 'Semantic Overlap';
      case 'repeated-phrase':
        return 'Repeated Phrase';
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-green-400';
    if (score < 60) return 'text-yellow-400';
    return 'text-red-400';
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Card Efficiency</h2>
            <p className="text-slate-400">
              Detect and eliminate repeated content across your card fields
            </p>
          </div>
          <button onClick={analyze} disabled={loading} className="btn-primary">
            {loading ? 'Analyzing...' : 'Re-analyze'}
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="card text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-slate-400 mt-2">Analyzing card for redundancies...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card bg-red-900/20 border-red-500 text-red-300">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Report Summary */}
        {report && !loading && (
          <>
            {/* Score Card */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center">
                <div className={`text-3xl font-bold ${getScoreColor(report.overallScore)}`}>
                  {Math.round(report.overallScore)}
                </div>
                <div className="text-sm text-slate-400 mt-1">Redundancy Score</div>
                <div className="text-xs text-slate-500 mt-1">(Lower is better)</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-orange-400">
                  {report.redundancies.length}
                </div>
                <div className="text-sm text-slate-400 mt-1">Issues Found</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-green-400">{report.potentialSavings}</div>
                <div className="text-sm text-slate-400 mt-1">Potential Token Savings</div>
              </div>
            </div>

            {/* No Issues */}
            {report.redundancies.length === 0 && (
              <div className="card bg-green-900/20 border-green-500 text-green-300 text-center py-8">
                <div className="text-4xl mb-3">✓</div>
                <p className="font-medium text-lg">No Redundancies Found</p>
                <p className="text-sm mt-1">Your card content is well-optimized!</p>
              </div>
            )}

            {/* Redundancy List */}
            {report.redundancies.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200">Detected Redundancies</h3>

                {report.redundancies.map((redundancy) => (
                  <div key={redundancy.id} className={`card border ${getSeverityColor(redundancy.severity)}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(redundancy.severity)}`}
                          >
                            {redundancy.severity.toUpperCase()}
                          </span>
                          <span className="text-sm text-slate-400">
                            {getTypeLabel(redundancy.type)}
                          </span>
                          <span className="chip-token text-xs">
                            -{redundancy.tokenImpact} tokens
                          </span>
                        </div>
                        <p className="text-slate-200 font-medium">{redundancy.description}</p>
                      </div>
                    </div>

                    {/* Affected Fields */}
                    <div className="space-y-2 mb-4">
                      {redundancy.fields.map((field, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-800/50 rounded p-3 border border-slate-700"
                        >
                          <div className="text-sm font-medium text-slate-300 mb-1">
                            {getFieldLabel(field.fieldName)}
                          </div>
                          <div className="text-sm text-slate-400 font-mono">
                            {field.excerpt}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Suggestions */}
                    {redundancy.suggestions.length > 0 && (
                      <div className="border-t border-slate-700 pt-4">
                        <p className="text-sm text-slate-400 mb-3">Suggested Fixes:</p>
                        <div className="space-y-2">
                          {redundancy.suggestions.map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-slate-800/30 rounded p-3"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-slate-200 capitalize">
                                    {suggestion.action}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    in {getFieldLabel(suggestion.targetField)}
                                  </span>
                                  <span
                                    className={`text-xs font-medium ${
                                      suggestion.tokenDelta < 0 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    {suggestion.tokenDelta > 0 ? '+' : ''}
                                    {suggestion.tokenDelta} tokens
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  Confidence: {Math.round(suggestion.confidence * 100)}%
                                </div>
                              </div>
                              <button
                                onClick={() => applyFix(redundancy, suggestion)}
                                disabled={applying === redundancy.id}
                                className="btn-secondary text-sm"
                              >
                                {applying === redundancy.id ? 'Applying...' : 'Apply Fix'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
