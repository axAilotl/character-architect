import { useState } from 'react';
import { useCardStore, extractCardData } from '../store/card-store';
import { SettingsModal } from './SettingsModal';
import { api } from '../lib/api';

interface HeaderProps {
  onBack: () => void;
}


export function Header({ onBack }: HeaderProps) {
  const { currentCard, isSaving, createNewCard } = useCardStore();
  const tokenCounts = useCardStore((state) => state.tokenCounts);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [pushStatus, setPushStatus] = useState<{type: 'success' | 'error'; message: string} | null>(null);

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
    const data = extractCardData(currentCard);
    return data.name || 'Untitled';
  };

  // Get character avatar URL - use thumbnail endpoint for fast loading
  const getAvatarUrl = () => {
    if (!currentCard?.meta?.id) return null;
    const timestamp = currentCard.meta.updatedAt || '';
    return `/api/cards/${currentCard.meta.id}/thumbnail?size=96&t=${timestamp}`;
  };

  const avatarUrl = getAvatarUrl();

  const handleImportFile = async () => {
    setShowImportMenu(false);
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

  const handleImportURL = async () => {
    setShowImportMenu(false);
    const url = prompt('Enter the URL to the character card (PNG, JSON, or CHARX file):');
    if (url && url.trim()) {
      await useCardStore.getState().importCardFromURL(url.trim());
    }
  };

  const handleExport = async (format: 'json' | 'png' | 'charx') => {
    setShowExportMenu(false);
    await useCardStore.getState().exportCard(format);
  };

  const handlePushToSillyTavern = async () => {
    if (!currentCard?.meta?.id) return;

    setPushStatus(null);
    try {
      const result = await api.pushToSillyTavern(currentCard.meta.id);

      if (result.data?.success) {
        setPushStatus({
          type: 'success',
          message: `Successfully pushed ${getCharacterName()} to SillyTavern!`
        });
        setTimeout(() => setPushStatus(null), 5000);
      } else {
        setPushStatus({
          type: 'error',
          message: result.error || result.data?.error || 'Failed to push to SillyTavern'
        });
        setTimeout(() => setPushStatus(null), 8000);
      }
    } catch (error: any) {
      setPushStatus({
        type: 'error',
        message: error?.message || 'Failed to push to SillyTavern'
      });
      setTimeout(() => setPushStatus(null), 8000);
    }
  };

  return (
    <header className="bg-dark-surface border-b border-dark-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-secondary" title="Back to Cards">
          ← Back
        </button>

        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Card Architect" className="w-6 h-6" />
          <h1 className="text-lg font-semibold text-dark-muted">Card Architect</h1>
        </div>

        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={getCharacterName()}
            className="w-24 h-24 rounded-full object-cover border-2 border-dark-border bg-slate-700"
            onError={(e) => {
              // Hide on error - card might not have an image
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

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

        <div className="relative">
          <button
            onClick={() => setShowImportMenu(!showImportMenu)}
            className="btn-secondary"
          >
            Import ▾
          </button>
          {showImportMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowImportMenu(false)}
              />
              <div className="absolute right-0 mt-1 bg-dark-surface border border-dark-border rounded shadow-lg z-50 min-w-[150px]">
                <button
                  onClick={handleImportFile}
                  className="block w-full px-4 py-2 text-left hover:bg-slate-700 rounded-t"
                  title="Import from local file (JSON, PNG, or CHARX)"
                >
                  From File
                </button>
                <button
                  onClick={handleImportURL}
                  className="block w-full px-4 py-2 text-left hover:bg-slate-700 rounded-b"
                  title="Import from URL (direct link to PNG, JSON, or CHARX)"
                >
                  From URL
                </button>
              </div>
            </>
          )}
        </div>

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

        {currentCard && (
          <button
            onClick={handlePushToSillyTavern}
            className="btn-primary"
            title="Push to SillyTavern (PNG)"
          >
            → SillyTavern
          </button>
        )}
      </div>

      {pushStatus && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            pushStatus.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {pushStatus.message}
        </div>
      )}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
}
