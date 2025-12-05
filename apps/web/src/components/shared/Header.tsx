import { useState, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { useTokenStore } from '../../store/token-store';
import { useSettingsStore } from '../../store/settings-store';
import { SettingsModal } from './SettingsModal';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { SillyTavernClient, shouldUseClientSidePush, type SillyTavernSettings } from '../../lib/sillytavern-client';

interface HeaderProps {
  onBack: () => void;
}


export function Header({ onBack }: HeaderProps) {
  const navigate = useNavigate();
  const { currentCard, isSaving, createNewCard } = useCardStore();
  const tokenCounts = useTokenStore((state) => state.tokenCounts);
  const sillytavernEnabled = useSettingsStore((state) => state.features?.sillytavernEnabled ?? false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [pushStatus, setPushStatus] = useState<{type: 'success' | 'error'; message: string} | null>(null);
  const [stSettings, setStSettings] = useState<SillyTavernSettings | null>(null);

  // Load SillyTavern settings for client-side push
  useEffect(() => {
    if (sillytavernEnabled) {
      api.getSillyTavernSettings().then((result) => {
        if (result.data?.settings) {
          setStSettings(result.data.settings as SillyTavernSettings);
        }
      });
    }
  }, [sillytavernEnabled]);

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
    input.accept = '.json,.png,.charx,.voxpkg';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        let id = null;
        if (file.name.endsWith('.voxpkg')) {
          id = await useCardStore.getState().importVoxtaPackage(file);
        } else {
          id = await useCardStore.getState().importCard(file);
        }
        
        if (id) {
          navigate(`/cards/${id}`);
        }
      }
    };
    input.click();
  };

  const handleImportURL = async () => {
    setShowImportMenu(false);
    const url = prompt('Enter the URL to the character card (PNG, JSON, or CHARX file):');
    if (url && url.trim()) {
      const id = await useCardStore.getState().importCardFromURL(url.trim());
      if (id) {
        navigate(`/cards/${id}`);
      }
    }
  };

  const handleExport = async (format: 'json' | 'png' | 'charx' | 'voxta') => {
    setShowExportMenu(false);
    await useCardStore.getState().exportCard(format);
  };

  const handlePushToSillyTavern = async () => {
    if (!currentCard?.meta?.id) return;

    setPushStatus(null);

    // CRITICAL: ALWAYS save before pushing to ensure DB has latest data
    const store = useCardStore.getState();
    console.log('[pushToST] FORCE SAVING before push');
    try {
      await store.saveCard();
      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 150));
      console.log('[pushToST] Save completed, proceeding with push');
    } catch (error: any) {
      console.error('[pushToST] FAILED to save before push:', error);
      setPushStatus({
        type: 'error',
        message: `Failed to save edits: ${error.message}`
      });
      setTimeout(() => setPushStatus(null), 8000);
      return;
    }

    // Check if we should use client-side push (localhost ST)
    const useClientSide = stSettings && shouldUseClientSidePush(stSettings);
    console.log('[pushToST] Using client-side push:', useClientSide);

    if (useClientSide && stSettings) {
      // Client-side push: fetch image, generate PNG, push directly to ST
      try {
        // Fetch original image from server
        const imageResponse = await fetch(`/api/cards/${currentCard.meta.id}/original-image`);
        let imageBuffer: Uint8Array;

        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = new Uint8Array(arrayBuffer);
        } else {
          // Create a placeholder image if none exists
          console.log('[pushToST] No image found, using placeholder');
          // Use a simple 1x1 transparent PNG as placeholder
          // Real PNG generation happens in createCardPNG
          const placeholderResponse = await fetch('/placeholder-avatar.png');
          if (placeholderResponse.ok) {
            const arrayBuffer = await placeholderResponse.arrayBuffer();
            imageBuffer = new Uint8Array(arrayBuffer);
          } else {
            // Minimal valid PNG (1x1 gray pixel)
            imageBuffer = new Uint8Array([
              0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
              0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
              0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
              0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
              0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
              0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00,
              0x00, 0x00, 0x04, 0x00, 0x01, 0x5C, 0xCD, 0xFF,
              0xA2, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
              0x44, 0xAE, 0x42, 0x60, 0x82
            ]);
          }
        }

        // Use client-side push
        const client = new SillyTavernClient(stSettings);
        const result = await client.push(currentCard, imageBuffer);

        if (result.success) {
          setPushStatus({
            type: 'success',
            message: `Successfully pushed ${getCharacterName()} to SillyTavern!`
          });
          setTimeout(() => setPushStatus(null), 5000);
        } else {
          setPushStatus({
            type: 'error',
            message: result.error || 'Failed to push to SillyTavern'
          });
          setTimeout(() => setPushStatus(null), 8000);
        }
      } catch (error: any) {
        console.error('[pushToST] Client-side push failed:', error);
        setPushStatus({
          type: 'error',
          message: error?.message || 'Failed to push to SillyTavern'
        });
        setTimeout(() => setPushStatus(null), 8000);
      }
    } else {
      // Server-side push (fallback for non-localhost or when settings not loaded)
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
    }
  };

  const handleCreateNew = async () => {
    await createNewCard();
    const newCard = useCardStore.getState().currentCard;
    if (newCard?.meta?.id) {
      navigate(`/cards/${newCard.meta.id}`);
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

        <button onClick={handleCreateNew} className="btn-secondary">
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
                  title="Import from local file (JSON, PNG, CHARX, or VOXPKG)"
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
                    className="block w-full px-4 py-2 text-left hover:bg-slate-700"
                    title="Export as CHARX (with assets)"
                  >
                    CHARX
                  </button>
                  <button
                    onClick={() => handleExport('voxta')}
                    className="block w-full px-4 py-2 text-left hover:bg-slate-700 rounded-b"
                    title="Export as Voxta Package (with assets and scenarios)"
                  >
                    Voxta
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {currentCard && sillytavernEnabled && (
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
