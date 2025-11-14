import { useCardStore } from '../store/card-store';

export function EditorTabs() {
  const { activeTab, setActiveTab } = useCardStore();

  const tabs = [
    { id: 'edit', label: 'Edit' },
    { id: 'preview', label: 'Preview' },
    { id: 'diff', label: 'Diff' },
    { id: 'redundancy', label: 'Card Efficiency' },
    { id: 'lore-trigger', label: 'Lore Trigger Tester' },
  ] as const;

  return (
    <div className="bg-dark-surface border-b border-dark-border">
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
    </div>
  );
}
