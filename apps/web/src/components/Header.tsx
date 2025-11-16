import { useState } from 'react';
import { useCardStore } from '../store/card-store';
import { SettingsModal } from './SettingsModal';
import type { CCv2Data, CCv3Data } from '@card-architect/schemas';

interface HeaderProps {
  onBack: () => void;
}

// Simple circular favicon icon
function FaviconIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="url(#gradient)" />
      <path d="M8 10 L12 14 L16 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Header({ onBack }: HeaderProps) {
  const { currentCard, isSaving, createNewCard } = useCardStore();
  const tokenCounts = useCardStore((state) => state.tokenCounts);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Calculate permanent tokens (name + description + personality + scenario)
  const getPermanentTokens = () => {
    if (!tokenCounts) return 0;
    const name = tokenCounts.name || 0;
    const description = tokenCounts.description || 0;
    const personality = tokenCounts.personality || 0;
    const scenario = tokenCounts.scenario || 0;
    return name + description + personality + scenario;
  };

  // Get character name from current card
  const getCharacterName = () => {
    if (!currentCard) return '';
    const isV3 = currentCard.meta.spec === 'v3';
    const data = isV3 ? (currentCard.data as CCv3Data).data : (currentCard.data as CCv2Data);
    return data.name || 'Untitled';
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.png,.charx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await useCardStore.getState().importCard(file);
      }
    };
    input.click();
  };

  const handleExport = async (format: 'json' | 'png' | 'charx') => {
    setShowExportMenu(false);
    await useCardStore.getState().exportCard(format);
  };

  return (
    <header className="bg-dark-surface border-b border-dark-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-secondary" title="Back to Cards">
          ← Back
        </button>

        <div className="flex items-center gap-2">
          <FaviconIcon />
          <h1 className="text-lg font-semibold text-dark-muted">Card Architect</h1>
        </div>

        {currentCard && (
          <span className="text-2xl font-bold">
            {getCharacterName()} {isSaving && <span className="text-sm text-dark-muted">(saving...)</span>}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {tokenCounts && (
          <>
            <div className="chip chip-token" title="Permanent tokens: Name + Description + Personality + Scenario">
              Permanent: {getPermanentTokens()} tokens
            </div>
            <div className="chip chip-token">
              Total: {tokenCounts.total} tokens
            </div>
          </>
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
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary"
            >
              Export ▾
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-1 bg-dark-surface border border-dark-border rounded shadow-lg z-50 min-w-[120px]">
                  <button
                    onClick={() => handleExport('json')}
                    className="block w-full px-4 py-2 text-left hover:bg-slate-700 rounded-t"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => handleExport('png')}
                    className="block w-full px-4 py-2 text-left hover:bg-slate-700"
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => handleExport('charx')}
                    className="block w-full px-4 py-2 text-left hover:bg-slate-700 rounded-b"
                    title="Export as CHARX (with assets)"
                  >
                    CHARX
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
}
