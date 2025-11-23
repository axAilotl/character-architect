import { useState } from 'react';
import { useCardStore } from '../../../store/card-store';
import { useUIStore } from '../../../store/ui-store';

export function EditorTabs() {
  const { currentCard, createSnapshot } = useCardStore();
  const { activeTab, setActiveTab } = useUIStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [message, setMessage] = useState('');

  const tabs = [
    { id: 'edit', label: 'Edit' },
    { id: 'assets', label: 'Assets' },
    { id: 'focused', label: 'Focused' },
    { id: 'preview', label: 'Preview' },
    { id: 'diff', label: 'Diff' },
    // { id: 'redundancy', label: 'Card Efficiency' }, // Disabled
    // { id: 'lore-trigger', label: 'Lore Trigger Tester' }, // Disabled
  ] as const;

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
    <div className="bg-dark-surface border-b border-dark-border">
      <div className="flex items-center justify-between">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-dark-bg text-dark-text border-b-2 border-blue-500'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Snapshot Button */}
        {currentCard?.meta.id && (
          <div className="relative px-4">
            {showPrompt ? (
              <div className="absolute top-full right-4 mt-2 bg-dark-surface border border-dark-border rounded-lg shadow-2xl p-4 w-80 z-50">
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2 text-sm"
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
        )}
      </div>
    </div>
  );
}
