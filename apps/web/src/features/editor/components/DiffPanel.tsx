/**
 * Diff Panel - Version History and Comparison
 *
 * Provides version snapshot management and diff viewing with:
 * - CodeMirror 6 merge view for side-by-side comparison
 * - Per-entry lorebook diffing
 * - Support for character cards and standalone lorebooks
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import { generateId } from '@card-architect/import-core';
import { useCardStore } from '../../../store/card-store';
import { api } from '../../../lib/api';
import { localDB, type StoredVersion } from '../../../lib/db';
import { getDeploymentConfig } from '../../../config/deployment';
import type { DiffViewMode } from '../../../lib/types';
import {
  getLorebookFromData,
  computeLorebookDiff,
  cardHasLorebook,
  type LorebookDiff,
} from '../../../lib/diff-utils';

// Lazy load heavy components
const CodeMirrorMergeView = lazy(() =>
  import('../../../components/ui/CodeMirrorMergeView').then((m) => ({
    default: m.CodeMirrorMergeView,
  }))
);

const LorebookDiffView = lazy(() =>
  import('./LorebookDiffView').then((m) => ({ default: m.LorebookDiffView }))
);

// Type that works for both API and IndexedDB versions
type UnifiedVersion = {
  id: string;
  version: number;
  message?: string;
  data: unknown;
  createdAt: string;
};

// Convert StoredVersion to UnifiedVersion
function storedToUnified(stored: StoredVersion): UnifiedVersion {
  return {
    id: stored.id,
    version: stored.versionNumber,
    message: stored.message,
    data: stored.data,
    createdAt: stored.createdAt,
  };
}

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}

// View mode selector component
function ViewModeSelector({
  mode,
  hasLorebook,
  lorebookDiff,
  onModeChange,
}: {
  mode: DiffViewMode;
  hasLorebook: boolean;
  lorebookDiff?: LorebookDiff;
  onModeChange: (mode: DiffViewMode) => void;
}) {
  const lorebookChanges = lorebookDiff
    ? lorebookDiff.entrySummary.added +
      lorebookDiff.entrySummary.removed +
      lorebookDiff.entrySummary.modified
    : 0;

  return (
    <div className="inline-flex rounded border border-dark-border overflow-hidden">
      <button
        onClick={() => onModeChange('split')}
        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'split'
            ? 'bg-blue-600 text-white'
            : 'bg-dark-card text-dark-muted hover:bg-dark-surface'
        }`}
      >
        Side-by-Side
      </button>
      <button
        onClick={() => onModeChange('unified')}
        className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-dark-border ${
          mode === 'unified'
            ? 'bg-blue-600 text-white'
            : 'bg-dark-card text-dark-muted hover:bg-dark-surface'
        }`}
      >
        Unified
      </button>
      {hasLorebook && (
        <button
          onClick={() => onModeChange('lorebook')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-dark-border flex items-center gap-1.5 ${
            mode === 'lorebook'
              ? 'bg-blue-600 text-white'
              : 'bg-dark-card text-dark-muted hover:bg-dark-surface'
          }`}
        >
          Lorebook
          {lorebookChanges > 0 && (
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                mode === 'lorebook' ? 'bg-white/20' : 'bg-yellow-600 text-white'
              }`}
            >
              {lorebookChanges}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export function DiffPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const setCurrentCard = useCardStore((state) => state.setCurrentCard);
  const [versions, setVersions] = useState<UnifiedVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<UnifiedVersion | null>(null);
  const [viewMode, setViewMode] = useState<DiffViewMode>('split');
  const [lorebookDiff, setLorebookDiff] = useState<LorebookDiff | undefined>();

  const config = getDeploymentConfig();
  const isClientMode = config.mode === 'light' || config.mode === 'static';

  // Check if current card has a lorebook
  const hasLorebook = currentCard ? cardHasLorebook(currentCard) : false;

  useEffect(() => {
    if (currentCard?.meta.id) {
      loadVersions();
    }
  }, [currentCard?.meta.id]);

  // Compute lorebook diff when version is selected
  useEffect(() => {
    if (!selectedVersion || !currentCard) {
      setLorebookDiff(undefined);
      return;
    }

    const originalLorebook = getLorebookFromData(selectedVersion.data);
    const currentLorebook = getLorebookFromData(currentCard.data);

    if (originalLorebook || currentLorebook) {
      const diff = computeLorebookDiff(originalLorebook, currentLorebook);
      setLorebookDiff(diff);
    } else {
      setLorebookDiff(undefined);
    }
  }, [selectedVersion, currentCard]);

  const loadVersions = async () => {
    if (!currentCard?.meta.id) return;

    if (isClientMode) {
      const stored = await localDB.getVersionsByCard(currentCard.meta.id);
      setVersions(stored.map(storedToUnified));
    } else {
      const { data } = await api.listVersions(currentCard.meta.id);
      if (data) {
        setVersions(data as UnifiedVersion[]);
      }
    }
  };

  const handleCreateSnapshot = async () => {
    if (!currentCard?.meta.id) return;

    const message = prompt('Snapshot message (optional):');

    if (isClientMode) {
      const versionNumber = await localDB.getNextVersionNumber(currentCard.meta.id);
      const version: StoredVersion = {
        id: generateId(),
        cardId: currentCard.meta.id,
        versionNumber,
        message: message || undefined,
        data: currentCard.data,
        createdAt: new Date().toISOString(),
      };
      await localDB.saveVersion(version);
    } else {
      await api.createVersion(currentCard.meta.id, message || undefined);
    }
    loadVersions();
  };

  const handleRestore = async (version: UnifiedVersion) => {
    if (!currentCard?.meta.id) return;
    if (!confirm(`Restore to Version ${version.version}?`)) return;

    if (isClientMode) {
      // Restore by updating the card with the version's data
      const restoredCard = {
        ...currentCard,
        data: version.data as typeof currentCard.data,
        meta: {
          ...currentCard.meta,
          updatedAt: new Date().toISOString(),
        },
      };
      await localDB.saveCard(restoredCard);
      setCurrentCard(restoredCard);
      setSelectedVersion(null);
    } else {
      await api.restoreVersion(currentCard.meta.id, version.id);
      window.location.reload();
    }
  };

  const handleDelete = async (version: UnifiedVersion) => {
    if (!currentCard?.meta.id) return;
    if (!confirm('Delete this snapshot? This cannot be undone.')) return;

    if (isClientMode) {
      await localDB.deleteVersion(version.id);
    } else {
      await api.deleteVersion(currentCard.meta.id, version.id);
    }
    loadVersions();
  };

  const handleVersionClick = (version: UnifiedVersion) => {
    if (selectedVersion?.id === version.id) {
      setSelectedVersion(null);
    } else {
      setSelectedVersion(version);
    }
  };

  if (!currentCard) return null;

  // If a version is selected, show the diff
  if (selectedVersion) {
    const originalText = JSON.stringify(selectedVersion.data, null, 2);
    const revisedText = JSON.stringify(currentCard.data, null, 2);

    // Determine if we should show lorebook view
    const showLorebookView = viewMode === 'lorebook' && lorebookDiff;

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 bg-dark-surface border-b border-dark-border">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">
              Comparing Version {selectedVersion.version} with Current
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(selectedVersion)}
                className="btn-primary"
              >
                Restore This Version
              </button>
              <button
                onClick={() => setSelectedVersion(null)}
                className="btn-secondary"
              >
                Back to Versions
              </button>
            </div>
          </div>

          {/* View mode selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-dark-muted">View:</span>
            <ViewModeSelector
              mode={viewMode}
              hasLorebook={hasLorebook || !!lorebookDiff}
              lorebookDiff={lorebookDiff}
              onModeChange={setViewMode}
            />
            {selectedVersion.message && (
              <span className="text-sm text-dark-muted ml-auto">
                "{selectedVersion.message}"
              </span>
            )}
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto p-4">
          <Suspense fallback={<LoadingSpinner />}>
            {showLorebookView && lorebookDiff ? (
              <LorebookDiffView
                lorebookDiff={lorebookDiff}
                originalData={selectedVersion.data}
                currentData={currentCard.data}
              />
            ) : (
              <CodeMirrorMergeView
                originalText={originalText}
                currentText={revisedText}
                language="json"
                collapseUnchanged={{ margin: 3, minSize: 4 }}
                height="calc(100vh - 250px)"
                originalLabel={`Version ${selectedVersion.version}`}
                currentLabel="Current"
              />
            )}
          </Suspense>
        </div>
      </div>
    );
  }

  // Version list view
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-dark-surface border-b border-dark-border flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Version History</h3>
          {hasLorebook && (
            <p className="text-xs text-dark-muted mt-1">
              This card has a lorebook - entry-level diffing available
            </p>
          )}
        </div>
        <button onClick={handleCreateSnapshot} className="btn-primary">
          Create Snapshot
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {versions.length === 0 ? (
          <div className="text-center text-dark-muted py-8">
            <p>No snapshots yet</p>
            <p className="text-sm mt-2">
              Create a snapshot to save a version of your card
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="card flex justify-between items-center cursor-pointer hover:bg-dark-surface"
                onClick={() => handleVersionClick(version)}
              >
                <div>
                  <div className="font-medium flex items-center gap-2">
                    Version {version.version}
                    {version.message?.startsWith('[Auto]') && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-dark-muted/30 text-dark-muted rounded">
                        Auto
                      </span>
                    )}
                  </div>
                  {version.message && (
                    <div className="text-sm text-dark-muted">
                      {version.message.replace('[Auto] ', '')}
                    </div>
                  )}
                  <div className="text-xs text-dark-muted">
                    {new Date(version.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVersionClick(version);
                    }}
                    className="btn-secondary"
                  >
                    Compare
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(version);
                    }}
                    className="btn-secondary"
                  >
                    Restore
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(version);
                    }}
                    className="btn-secondary text-red-400 hover:text-red-300 hover:border-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
