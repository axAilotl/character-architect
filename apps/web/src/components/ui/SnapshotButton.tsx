import { useState } from 'react';
import { useCardStore } from '../../store/card-store';
import { getDeploymentConfig } from '../../config/deployment';

export function SnapshotButton() {
  const { currentCard, createSnapshot } = useCardStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [message, setMessage] = useState('');

  const config = getDeploymentConfig();

  // Hide snapshots in light mode (no server)
  if (config.mode === 'light' || config.mode === 'static') return null;

  if (!currentCard || !currentCard.meta.id) return null;

  const handleCreateSnapshot = async () => {
    if (showPrompt) {
      setIsCreating(true);
      try {
        await createSnapshot(message || undefined);
        setMessage('');
        setShowPrompt(false);
      } catch (err) {
        console.error('Failed to create snapshot:', err);
      } finally {
        setIsCreating(false);
      }
    } else {
      setShowPrompt(true);
    }
  };

  const handleCancel = () => {
    setShowPrompt(false);
    setMessage('');
  };

  return (
    <div className="fixed top-20 right-6 z-50">
      {showPrompt ? (
        <div className="bg-dark-surface border border-dark-border rounded-lg shadow-2xl p-4 w-80">
          <h3 className="text-sm font-semibold mb-2">Create Snapshot</h3>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Version message (optional)"
            className="w-full mb-3 px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSnapshot();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateSnapshot}
              disabled={isCreating}
              className="btn-primary flex-1 text-sm"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isCreating}
              className="btn-secondary flex-1 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowPrompt(true)}
          className="btn-primary shadow-lg px-4 py-2 flex items-center gap-2"
          title="Create version snapshot"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Snapshot
        </button>
      )}
    </div>
  );
}
