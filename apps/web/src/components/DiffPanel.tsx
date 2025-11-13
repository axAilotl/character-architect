import { useEffect, useState } from 'react';
import { useCardStore } from '../store/card-store';
import { api } from '../lib/api';

export function DiffPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const [versions, setVersions] = useState<unknown[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (currentCard?.meta.id) {
      loadVersions();
    }
  }, [currentCard?.meta.id]);

  const loadVersions = async () => {
    if (!currentCard?.meta.id) return;

    const { data } = await api.listVersions(currentCard.meta.id);
    if (data) {
      setVersions(data);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!currentCard?.meta.id) return;

    const message = prompt('Snapshot message (optional):');
    await api.createVersion(currentCard.meta.id, message || undefined);
    loadVersions();
  };

  if (!currentCard) return null;

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
            {versions.map((version: any) => (
              <div
                key={version.id}
                className="card flex justify-between items-center"
                onClick={() => setSelectedVersion(version.id)}
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

                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm('Restore this version?')) {
                      await api.restoreVersion(currentCard.meta.id, version.id);
                      window.location.reload();
                    }
                  }}
                  className="btn-secondary"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
