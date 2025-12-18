import { useState } from 'react';
import { useCardStore } from '../../../store/card-store';
import { useUIStore } from '../../../store/ui-store';
import { useEditorTabs, useAvailableTabIds } from '../../../lib/registry/hooks';
import type { TabContext } from '../../../lib/registry/types';

interface EditorTabsProps {
  context?: TabContext;
}

export function EditorTabs({ context = 'card' }: EditorTabsProps) {
  const { currentCard, createSnapshot } = useCardStore();
  const { activeTab, setActiveTab } = useUIStore();
  const tabs = useEditorTabs(context);
  const availableTabIds = useAvailableTabIds(context);

  const [isCreating, setIsCreating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [message, setMessage] = useState('');

  // If current active tab is not available, fallback to first available
  const effectiveActiveTab = availableTabIds.includes(activeTab)
    ? activeTab
    : (availableTabIds[0] ?? 'edit');

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

  // Get color classes based on tab color
  const getColorClasses = (color?: string, isActive?: boolean) => {
    if (!isActive) return 'text-dark-muted hover:text-dark-text';

    switch (color) {
      case 'purple':
        return 'text-purple-400 border-b-2 border-purple-500 bg-dark-bg';
      case 'green':
        return 'text-green-400 border-b-2 border-green-500 bg-dark-bg';
      case 'orange':
        return 'text-orange-400 border-b-2 border-orange-500 bg-dark-bg';
      case 'red':
        return 'text-red-400 border-b-2 border-red-500 bg-dark-bg';
      default:
        return 'text-dark-text border-b-2 border-blue-500 bg-dark-bg';
    }
  };

  return (
    <div className="bg-dark-surface border-b border-dark-border">
      <div className="flex items-center justify-between">
        <div className="flex">
          {tabs.map((tab) => {
            const isActive = effectiveActiveTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`font-medium transition-colors ${getColorClasses(tab.color, isActive)}`}
              >
                {tab.icon && <tab.icon className="w-4 h-4 mr-2 inline" />}
                {tab.label}
              </button>
            );
          })}
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
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
