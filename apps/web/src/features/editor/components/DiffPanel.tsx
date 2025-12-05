import { useEffect, useState } from 'react';
import { useCardStore } from '../../../store/card-store';
import { api } from '../../../lib/api';
import { localDB, type StoredVersion } from '../../../lib/db';
import { DiffViewer } from '../../../components/ui/DiffViewer';
import { getDeploymentConfig } from '../../../config/deployment';
import type { DiffOperation } from '@card-architect/schemas';

// Simple diff computation on the client
function computeSimpleDiff(original: string, revised: string): DiffOperation[] {
  const originalLines = original.split('\n');
  const revisedLines = revised.split('\n');
  const diff: DiffOperation[] = [];

  let i = 0, j = 0;
  while (i < originalLines.length || j < revisedLines.length) {
    const origLine = originalLines[i];
    const revLine = revisedLines[j];

    if (origLine === revLine) {
      diff.push({ type: 'unchanged', value: origLine + '\n', lineNumber: i + 1 });
      i++; j++;
    } else if (i >= originalLines.length) {
      diff.push({ type: 'add', value: revLine + '\n', lineNumber: j + 1 });
      j++;
    } else if (j >= revisedLines.length) {
      diff.push({ type: 'remove', value: origLine + '\n', lineNumber: i + 1 });
      i++;
    } else {
      diff.push({ type: 'remove', value: origLine + '\n', lineNumber: i + 1 });
      diff.push({ type: 'add', value: revLine + '\n', lineNumber: j + 1 });
      i++; j++;
    }
  }

  return diff;
}

// Type that works for both API and IndexedDB versions
type UnifiedVersion = {
  id: string;
  version: number;
  message?: string;
  data: any;
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

export function DiffPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const setCurrentCard = useCardStore((state) => state.setCurrentCard);
  const [versions, setVersions] = useState<UnifiedVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<UnifiedVersion | null>(null);

  const config = getDeploymentConfig();
  const isClientMode = config.mode === 'light' || config.mode === 'static';

  useEffect(() => {
    if (currentCard?.meta.id) {
      loadVersions();
    }
  }, [currentCard?.meta.id]);

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
        id: crypto.randomUUID(),
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
        data: version.data,
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
    const diff = computeSimpleDiff(originalText, revisedText);

    return (
      <div className="h-full flex flex-col">
        <div className="p-4 bg-dark-surface border-b border-dark-border flex justify-between items-center">
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
            <button onClick={() => setSelectedVersion(null)} className="btn-secondary">
              Back to Versions
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <DiffViewer diff={diff} originalText={originalText} revisedText={revisedText} compact={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-dark-surface border-b border-dark-border flex justify-between items-center">
        <h3 className="font-semibold">Version History</h3>
        <button onClick={handleCreateSnapshot} className="btn-primary">
          Create Snapshot
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {versions.length === 0 ? (
          <div className="text-center text-dark-muted py-8">
            <p>No snapshots yet</p>
            <p className="text-sm mt-2">Create a snapshot to save a version of your card</p>
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
                  <div className="font-medium">Version {version.version}</div>
                  {version.message && (
                    <div className="text-sm text-dark-muted">{version.message}</div>
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
