/**
 * Lorebook Diff View
 *
 * Displays per-entry lorebook diffing with:
 * - Entry list showing added/removed/modified status
 * - Detailed view of individual entry changes
 * - CodeMirror merge view for entry content comparison
 */

import { useState, lazy, Suspense } from 'react';
import type { LorebookDiff, EntryDiffResult } from '../../../lib/types';
import {
  formatEntryStatus,
  getStatusBadgeClass,
} from '../../../lib/diff-utils';

// Lazy load CodeMirror for entry detail view
const CodeMirrorMergeView = lazy(() =>
  import('../../../components/ui/CodeMirrorMergeView').then((m) => ({
    default: m.CodeMirrorMergeView,
  }))
);

interface LorebookDiffViewProps {
  lorebookDiff: LorebookDiff;
  originalData: unknown;
  currentData: unknown;
}

// Loading spinner
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
    </div>
  );
}

// Entry list item component
function EntryListItem({
  entry,
  isSelected,
  onClick,
}: {
  entry: EntryDiffResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const badgeClass = getStatusBadgeClass(entry.status);

  // Get keys for display
  const keys =
    entry.currentEntry?.keys || entry.originalEntry?.keys || [];
  const keyDisplay = keys.slice(0, 3).join(', ');
  const hasMoreKeys = keys.length > 3;

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded cursor-pointer transition-colors border ${
        isSelected
          ? 'border-blue-500 bg-blue-900/20'
          : 'border-dark-border hover:bg-dark-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeClass} text-white`}
            >
              {formatEntryStatus(entry.status)}
            </span>
            {entry.moved && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600 text-white">
                Moved
              </span>
            )}
          </div>
          <div className="font-medium text-sm mt-1 truncate">
            {entry.entryName}
          </div>
          {keyDisplay && (
            <div className="text-xs text-dark-muted mt-0.5 truncate">
              Keys: {keyDisplay}
              {hasMoreKeys && ` +${keys.length - 3} more`}
            </div>
          )}
        </div>
        {entry.fieldChanges && entry.fieldChanges.length > 0 && (
          <span className="text-xs text-dark-muted bg-dark-bg px-1.5 py-0.5 rounded">
            {entry.fieldChanges.length} field{entry.fieldChanges.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// Entry detail panel component
function EntryDetailPanel({ entry }: { entry: EntryDiffResult }) {
  const [showRawDiff, setShowRawDiff] = useState(false);

  const originalEntry = entry.originalEntry;
  const currentEntry = entry.currentEntry;

  // For added/removed entries, show single view
  if (entry.status === 'added' && currentEntry) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-green-400">New Entry</span>
          <span className="text-dark-muted">- {entry.entryName}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-dark-muted">Keys:</span>
            <div className="font-mono text-xs mt-1">
              {currentEntry.keys.join(', ') || '(none)'}
            </div>
          </div>
          <div>
            <span className="text-dark-muted">Enabled:</span>
            <div className="mt-1">
              {currentEntry.enabled !== false ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        <div>
          <span className="text-dark-muted text-sm">Content:</span>
          <pre className="mt-1 p-3 bg-green-900/20 border border-green-800 rounded text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
            {currentEntry.content || '(empty)'}
          </pre>
        </div>
      </div>
    );
  }

  if (entry.status === 'removed' && originalEntry) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-red-400">Removed Entry</span>
          <span className="text-dark-muted">- {entry.entryName}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-dark-muted">Keys:</span>
            <div className="font-mono text-xs mt-1">
              {originalEntry.keys.join(', ') || '(none)'}
            </div>
          </div>
          <div>
            <span className="text-dark-muted">Enabled:</span>
            <div className="mt-1">
              {originalEntry.enabled !== false ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        <div>
          <span className="text-dark-muted text-sm">Content:</span>
          <pre className="mt-1 p-3 bg-red-900/20 border border-red-800 rounded text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
            {originalEntry.content || '(empty)'}
          </pre>
        </div>
      </div>
    );
  }

  // Modified or unchanged entry - show comparison
  if (!originalEntry || !currentEntry) {
    return (
      <div className="text-center text-dark-muted py-8">
        Entry data not available
      </div>
    );
  }

  const originalText = JSON.stringify(originalEntry, null, 2);
  const currentText = JSON.stringify(currentEntry, null, 2);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-lg font-semibold ${
              entry.status === 'modified' ? 'text-yellow-400' : 'text-dark-text'
            }`}
          >
            {entry.status === 'modified' ? 'Modified Entry' : 'Unchanged Entry'}
          </span>
          <span className="text-dark-muted">- {entry.entryName}</span>
          {entry.moved && (
            <span className="text-xs text-purple-400">
              (moved from #{entry.movedFrom! + 1} to #{entry.movedTo! + 1})
            </span>
          )}
        </div>
        <button
          onClick={() => setShowRawDiff(!showRawDiff)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {showRawDiff ? 'Show Fields' : 'Show Raw JSON'}
        </button>
      </div>

      {showRawDiff ? (
        <Suspense fallback={<LoadingSpinner />}>
          <CodeMirrorMergeView
            originalText={originalText}
            currentText={currentText}
            language="json"
            height="400px"
            collapseUnchanged={{ margin: 2, minSize: 3 }}
            originalLabel="Original"
            currentLabel="Current"
          />
        </Suspense>
      ) : (
        <div className="space-y-4">
          {/* Field-by-field comparison */}
          {entry.fieldChanges && entry.fieldChanges.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-dark-muted">
                Changed Fields ({entry.fieldChanges.length})
              </div>
              {entry.fieldChanges.map((change, idx) => (
                <FieldChangeRow key={idx} change={change} />
              ))}
            </div>
          ) : (
            <div className="text-center text-dark-muted py-4">
              No field changes detected
            </div>
          )}

          {/* Always show content comparison if different */}
          {originalEntry.content !== currentEntry.content && (
            <div className="border-t border-dark-border pt-4">
              <div className="text-sm font-medium text-dark-muted mb-2">
                Content Comparison
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-dark-muted mb-1">Original</div>
                  <pre className="p-3 bg-red-900/10 border border-dark-border rounded text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-auto">
                    {originalEntry.content || '(empty)'}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-dark-muted mb-1">Current</div>
                  <pre className="p-3 bg-green-900/10 border border-dark-border rounded text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-auto">
                    {currentEntry.content || '(empty)'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Field change row component
function FieldChangeRow({
  change,
}: {
  change: { field: string; original: unknown; current: unknown };
}) {
  const formatValue = (value: unknown): string => {
    if (value === undefined) return '(undefined)';
    if (value === null) return '(null)';
    if (typeof value === 'string') return value || '(empty)';
    if (Array.isArray(value)) return value.join(', ') || '(empty array)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Skip content field as it's shown separately
  if (change.field === 'content') return null;

  return (
    <div className="bg-dark-surface rounded p-3 border border-dark-border">
      <div className="text-xs font-medium text-dark-muted mb-2">
        {change.field}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-red-400 font-medium">-</span>{' '}
          <span className="text-red-200">{formatValue(change.original)}</span>
        </div>
        <div>
          <span className="text-green-400 font-medium">+</span>{' '}
          <span className="text-green-200">{formatValue(change.current)}</span>
        </div>
      </div>
    </div>
  );
}

export function LorebookDiffView({
  lorebookDiff,
}: LorebookDiffViewProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | number | null>(
    null
  );

  const { entrySummary, entryDiffs, settingsChanged } = lorebookDiff;

  // Find selected entry
  const selectedEntry = entryDiffs.find((e) => e.entryId === selectedEntryId);

  // Filter entries by status for better organization
  const addedEntries = entryDiffs.filter((e) => e.status === 'added');
  const removedEntries = entryDiffs.filter((e) => e.status === 'removed');
  const modifiedEntries = entryDiffs.filter((e) => e.status === 'modified');
  const unchangedEntries = entryDiffs.filter((e) => e.status === 'unchanged');

  return (
    <div className="flex h-full border border-dark-border rounded-lg overflow-hidden">
      {/* Left panel - Entry list */}
      <div className="w-[320px] flex-shrink-0 border-r border-dark-border bg-dark-card flex flex-col">
        {/* Summary header */}
        <div className="p-3 border-b border-dark-border bg-dark-bg">
          <div className="text-sm font-semibold mb-2">Lorebook Changes</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {entrySummary.added > 0 && (
              <span className="px-2 py-0.5 bg-green-600 text-white rounded">
                +{entrySummary.added} added
              </span>
            )}
            {entrySummary.removed > 0 && (
              <span className="px-2 py-0.5 bg-red-600 text-white rounded">
                -{entrySummary.removed} removed
              </span>
            )}
            {entrySummary.modified > 0 && (
              <span className="px-2 py-0.5 bg-yellow-600 text-white rounded">
                ~{entrySummary.modified} modified
              </span>
            )}
            {entrySummary.unchanged > 0 && (
              <span className="px-2 py-0.5 bg-dark-muted/50 text-dark-text rounded">
                {entrySummary.unchanged} unchanged
              </span>
            )}
          </div>
          {settingsChanged && (
            <div className="mt-2 text-xs text-yellow-400">
              Lorebook settings changed
            </div>
          )}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {/* Added entries */}
          {addedEntries.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-green-400 px-1 py-1">
                Added ({addedEntries.length})
              </div>
              {addedEntries.map((entry) => (
                <EntryListItem
                  key={entry.entryId}
                  entry={entry}
                  isSelected={selectedEntryId === entry.entryId}
                  onClick={() => setSelectedEntryId(entry.entryId)}
                />
              ))}
            </div>
          )}

          {/* Removed entries */}
          {removedEntries.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-400 px-1 py-1">
                Removed ({removedEntries.length})
              </div>
              {removedEntries.map((entry) => (
                <EntryListItem
                  key={entry.entryId}
                  entry={entry}
                  isSelected={selectedEntryId === entry.entryId}
                  onClick={() => setSelectedEntryId(entry.entryId)}
                />
              ))}
            </div>
          )}

          {/* Modified entries */}
          {modifiedEntries.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-yellow-400 px-1 py-1">
                Modified ({modifiedEntries.length})
              </div>
              {modifiedEntries.map((entry) => (
                <EntryListItem
                  key={entry.entryId}
                  entry={entry}
                  isSelected={selectedEntryId === entry.entryId}
                  onClick={() => setSelectedEntryId(entry.entryId)}
                />
              ))}
            </div>
          )}

          {/* Unchanged entries (collapsed by default) */}
          {unchangedEntries.length > 0 && (
            <details className="group">
              <summary className="text-xs font-semibold text-dark-muted px-1 py-1 cursor-pointer hover:text-dark-text">
                Unchanged ({unchangedEntries.length})
                <span className="ml-1 text-[10px]">
                  (click to expand)
                </span>
              </summary>
              <div className="mt-1 space-y-1">
                {unchangedEntries.map((entry) => (
                  <EntryListItem
                    key={entry.entryId}
                    entry={entry}
                    isSelected={selectedEntryId === entry.entryId}
                    onClick={() => setSelectedEntryId(entry.entryId)}
                  />
                ))}
              </div>
            </details>
          )}

          {entryDiffs.length === 0 && (
            <div className="text-center text-dark-muted py-8 text-sm">
              No lorebook entries to compare
            </div>
          )}
        </div>
      </div>

      {/* Right panel - Entry detail */}
      <div className="flex-1 overflow-auto bg-dark-bg p-4">
        {selectedEntry ? (
          <EntryDetailPanel entry={selectedEntry} />
        ) : (
          <div className="flex items-center justify-center h-full text-dark-muted">
            <div className="text-center">
              <div className="text-lg mb-2">Select an entry</div>
              <div className="text-sm">
                Click on an entry from the list to see its details
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
