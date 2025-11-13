import { useState } from 'react';
import { useCardStore } from '../store/card-store';
import { SettingsModal } from './SettingsModal';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { currentCard, isDirty, isSaving, saveCard, createNewCard } = useCardStore();
  const tokenCounts = useCardStore((state) => state.tokenCounts);
  const [showSettings, setShowSettings] = useState(false);

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.png';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await useCardStore.getState().importCard(file);
      }
    };
    input.click();
  };

  const handleExport = async (format: 'json' | 'png') => {
    await useCardStore.getState().exportCard(format);
  };

  return (
    <header className="bg-dark-surface border-b border-dark-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="btn-secondary">
          ☰
        </button>

        <h1 className="text-xl font-bold">Card Architect</h1>

        {currentCard && (
          <span className="text-sm text-dark-muted">
            {currentCard.meta.name} {isDirty && '(unsaved)'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {tokenCounts && (
          <div className="chip chip-token">
            Total: {tokenCounts.total} tokens
          </div>
        )}

        <button onClick={() => setShowSettings(true)} className="btn-secondary" title="LLM Settings">
          ⚙️
        </button>

        <button onClick={createNewCard} className="btn-secondary">
          New
        </button>

        <button onClick={handleImport} className="btn-secondary">
          Import
        </button>

        {currentCard && (
          <>
            <div className="relative group">
              <button className="btn-secondary">Export</button>
              <div className="absolute right-0 mt-1 hidden group-hover:block bg-dark-surface border border-dark-border rounded shadow-lg">
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full px-4 py-2 text-left hover:bg-slate-700"
                >
                  JSON
                </button>
                <button
                  onClick={() => handleExport('png')}
                  className="block w-full px-4 py-2 text-left hover:bg-slate-700"
                >
                  PNG
                </button>
              </div>
            </div>

            <button
              onClick={saveCard}
              disabled={!isDirty || isSaving}
              className="btn-primary"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
}
