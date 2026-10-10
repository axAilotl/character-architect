import { FavoriteButton } from './FavoriteButton';
import { ChatExportMenu } from './ChatExportMenu';
import { useState, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { useTokenStore } from '../../store/token-store';
import { useSettingsStore } from '../../store/settings-store';
import { SettingsButton } from './SettingsButton';
import { SettingsModal } from './SettingsModal';
import { api } from '../../lib/api';
import { localDB } from '../../lib/db';
import { getDeploymentConfig } from '../../config/deployment';
import {
  SillyTavernClient,
  shouldUseClientSidePush,
  type SillyTavernSettings,
} from '../../lib/sillytavern-client';

interface HeaderProps {
  onBack: () => void;
}

export function Header({ onBack }: HeaderProps) {
  const { currentCard, isSaving } = useCardStore();
  const tokenCounts = useTokenStore((state) => state.tokenCounts);
  const sillytavernEnabled = useSettingsStore(
    (state) => state.features?.sillytavernEnabled ?? false
  );
  const lumiverseEnabled = useSettingsStore(state => state.features.lumiverseEnabled ?? false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pushStatus, setPushStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [stSettings, setStSettings] = useState<SillyTavernSettings | null>(null);
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState<string | null>(null);

  const config = getDeploymentConfig();
  const isLightMode = config.mode === 'light' || config.mode === 'static';

  // Load SillyTavern settings for client-side push
  useEffect(() => {
    if (!sillytavernEnabled) return;

    if (isLightMode) {
      // Light mode: load from localStorage
      try {
        const stored = localStorage.getItem('ca-sillytavern-settings');
        if (stored) {
          setStSettings(JSON.parse(stored) as SillyTavernSettings);
        }
      } catch {
        // Ignore parse errors
      }
    } else {
      // Server mode: load from API
      api.getSillyTavernSettings().then((result) => {
        if (result.data?.settings) {
          setStSettings(result.data.settings as SillyTavernSettings);
        }
      });
    }
  }, [sillytavernEnabled, isLightMode]);

  // Load cached avatar from IndexedDB in light mode
  useEffect(() => {
    if (isLightMode && currentCard?.meta?.id) {
      localDB.getImage(currentCard.meta.id, 'thumbnail').then((imageData) => {
        setCachedAvatarUrl(imageData);
      });
    } else {
      setCachedAvatarUrl(null);
    }
  }, [isLightMode, currentCard?.meta?.id]);

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

  // Get card type label for header title
  const getCardTypeLabel = () => {
    if (!currentCard) return 'Character Architect';
    const spec = currentCard.meta.spec;
    if (spec === 'collection') return 'Collection';
    if (spec === 'lorebook') return 'Lorebook';
    return 'Character';
  };

  // Get character avatar URL - use thumbnail endpoint for fast loading
  const getAvatarUrl = () => {
    if (!currentCard?.meta?.id) return null;
    // In light mode, use cached avatar from IndexedDB
    if (isLightMode) {
      return cachedAvatarUrl;
    }
    const timestamp = currentCard.meta.updatedAt || '';
    return `/api/cards/${currentCard.meta.id}/thumbnail?size=96&t=${timestamp}`;
  };

  const avatarUrl = getAvatarUrl();

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
      await new Promise((resolve) => setTimeout(resolve, 150));
      console.log('[pushToST] Save completed, proceeding with push');
    } catch (error: any) {
      console.error('[pushToST] FAILED to save before push:', error);
      setPushStatus({
        type: 'error',
        message: `Failed to save edits: ${error.message}`,
      });
      setTimeout(() => setPushStatus(null), 8000);
      return;
    }

    // Federation is optional: only load it if explicitly enabled.
    const federationEnabled = useSettingsStore.getState().features?.federationEnabled ?? false;
    if (!isLightMode && federationEnabled) {
      try {
        const { useFederationStore } = await import('../../modules/federation/lib/federation-store');
        const federationState = useFederationStore.getState();

        if (!federationState.initialized) {
          await federationState.initialize();
        }

        const refreshed = useFederationStore.getState();
        const stFederationEnabled =
          refreshed.settings?.platforms?.sillytavern?.enabled &&
          refreshed.settings?.platforms?.sillytavern?.connected;

        if (stFederationEnabled) {
          // Use federation to push to SillyTavern
          console.log('[pushToST] Using FEDERATION to push to SillyTavern');
          try {
            const result = await refreshed.pushToST(currentCard.meta.id);

            if (result.success) {
              setPushStatus({
                type: 'success',
                message: `Successfully synced ${getCharacterName()} to SillyTavern via federation!`,
              });
              setTimeout(() => setPushStatus(null), 5000);
            } else {
              setPushStatus({
                type: 'error',
                message: result.error || 'Federation sync failed',
              });
              setTimeout(() => setPushStatus(null), 8000);
            }
          } catch (error: any) {
            console.error('[pushToST] Federation push failed:', error);
            setPushStatus({
              type: 'error',
              message: error?.message || 'Federation sync failed',
            });
            setTimeout(() => setPushStatus(null), 8000);
          }
          return;
        }
      } catch (err) {
        console.warn('[pushToST] Federation module failed to load, falling back to direct push:', err);
      }
    }

    // Fall back to direct SillyTavern push (non-federation)
    console.log('[pushToST] Federation not enabled, using DIRECT push');

    // Check if we should use client-side push (localhost ST or light mode)
    const useClientSide = stSettings && (shouldUseClientSidePush(stSettings) || isLightMode);
    console.log('[pushToST] Using client-side push:', useClientSide, 'isLightMode:', isLightMode);

    if (useClientSide && stSettings) {
      // Client-side push: fetch image, generate PNG, push directly to ST
      try {
        let imageBuffer: Uint8Array;

        if (isLightMode) {
          // Light mode: use full PNG icon from IndexedDB (not thumbnail which is WebP)
          const imageData = await localDB.getImage(currentCard.meta.id, 'icon');
          if (imageData) {
            const base64 = imageData.split(',')[1];
            const binary = atob(base64);
            imageBuffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              imageBuffer[i] = binary.charCodeAt(i);
            }
          } else {
            // Minimal valid PNG (1x1 gray pixel)
            imageBuffer = new Uint8Array([
              0x89,
              0x50,
              0x4e,
              0x47,
              0x0d,
              0x0a,
              0x1a,
              0x0a, // PNG signature
              0x00,
              0x00,
              0x00,
              0x0d,
              0x49,
              0x48,
              0x44,
              0x52, // IHDR chunk
              0x00,
              0x00,
              0x00,
              0x01,
              0x00,
              0x00,
              0x00,
              0x01,
              0x08,
              0x02,
              0x00,
              0x00,
              0x00,
              0x90,
              0x77,
              0x53,
              0xde,
              0x00,
              0x00,
              0x00,
              0x0c,
              0x49,
              0x44,
              0x41, // IDAT chunk
              0x54,
              0x08,
              0xd7,
              0x63,
              0x60,
              0x60,
              0x60,
              0x00,
              0x00,
              0x00,
              0x04,
              0x00,
              0x01,
              0x5c,
              0xcd,
              0xff,
              0xa2,
              0x00,
              0x00,
              0x00,
              0x00,
              0x49,
              0x45,
              0x4e, // IEND chunk
              0x44,
              0xae,
              0x42,
              0x60,
              0x82,
            ]);
          }
        } else {
          // Server mode: fetch original image from server
          const imageResponse = await fetch(`/api/cards/${currentCard.meta.id}/original-image`);

          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBuffer = new Uint8Array(arrayBuffer);
          } else {
            // Create a placeholder image if none exists
            console.log('[pushToST] No image found, using placeholder');
            const placeholderResponse = await fetch('/placeholder-avatar.png');
            if (placeholderResponse.ok) {
              const arrayBuffer = await placeholderResponse.arrayBuffer();
              imageBuffer = new Uint8Array(arrayBuffer);
            } else {
              // Minimal valid PNG (1x1 gray pixel)
              imageBuffer = new Uint8Array([
                0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a, // PNG signature
                0x00,
                0x00,
                0x00,
                0x0d,
                0x49,
                0x48,
                0x44,
                0x52, // IHDR chunk
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x01,
                0x08,
                0x02,
                0x00,
                0x00,
                0x00,
                0x90,
                0x77,
                0x53,
                0xde,
                0x00,
                0x00,
                0x00,
                0x0c,
                0x49,
                0x44,
                0x41, // IDAT chunk
                0x54,
                0x08,
                0xd7,
                0x63,
                0x60,
                0x60,
                0x60,
                0x00,
                0x00,
                0x00,
                0x04,
                0x00,
                0x01,
                0x5c,
                0xcd,
                0xff,
                0xa2,
                0x00,
                0x00,
                0x00,
                0x00,
                0x49,
                0x45,
                0x4e, // IEND chunk
                0x44,
                0xae,
                0x42,
                0x60,
                0x82,
              ]);
            }
          }
        }

        // Use client-side push
        const client = new SillyTavernClient(stSettings);
        const result = await client.push(currentCard, imageBuffer);

        if (result.success) {
          // Record the sync state for badge display (only if federation is enabled)
          const federationEnabled = useSettingsStore.getState().features?.federationEnabled ?? false;
          if (!isLightMode && federationEnabled) {
            try {
              const { useFederationStore } = await import(
                '../../modules/federation/lib/federation-store'
              );
              const { recordManualSync } = useFederationStore.getState();
              await recordManualSync(currentCard.meta.id, 'sillytavern', result.fileName);
            } catch (err) {
              console.warn('[pushToST] Failed to record federation sync state:', err);
            }
          }

          setPushStatus({
            type: 'success',
            message: `Successfully pushed ${getCharacterName()} to SillyTavern!`,
          });
          setTimeout(() => setPushStatus(null), 5000);
        } else {
          setPushStatus({
            type: 'error',
            message: result.error || 'Failed to push to SillyTavern',
          });
          setTimeout(() => setPushStatus(null), 8000);
        }
      } catch (error: any) {
        console.error('[pushToST] Client-side push failed:', error);
        setPushStatus({
          type: 'error',
          message: error?.message || 'Failed to push to SillyTavern',
        });
        setTimeout(() => setPushStatus(null), 8000);
      }
    } else {
      // Server-side push (fallback for non-localhost or when settings not loaded)
      if (isLightMode) {
        // Light mode requires SillyTavern settings for client-side push
        setPushStatus({
          type: 'error',
          message: 'SillyTavern push requires configuring SillyTavern settings first',
        });
        setTimeout(() => setPushStatus(null), 8000);
        return;
      }

      try {
        const result = await api.pushToSillyTavern(currentCard.meta.id);

        if (result.data?.success) {
          // Record the sync state for badge display (only if federation is enabled)
          const federationEnabled = useSettingsStore.getState().features?.federationEnabled ?? false;
          if (!isLightMode && federationEnabled) {
            try {
              const { useFederationStore } = await import(
                '../../modules/federation/lib/federation-store'
              );
              const { recordManualSync } = useFederationStore.getState();
              await recordManualSync(currentCard.meta.id, 'sillytavern', result.data.fileName);
            } catch (err) {
              console.warn('[pushToST] Failed to record federation sync state:', err);
            }
          }

          setPushStatus({
            type: 'success',
            message: `Successfully pushed ${getCharacterName()} to SillyTavern!`,
          });
          setTimeout(() => setPushStatus(null), 5000);
        } else {
          setPushStatus({
            type: 'error',
            message: result.error || result.data?.error || 'Failed to push to SillyTavern',
          });
          setTimeout(() => setPushStatus(null), 8000);
        }
      } catch (error: any) {
        setPushStatus({
          type: 'error',
          message: error?.message || 'Failed to push to SillyTavern',
        });
        setTimeout(() => setPushStatus(null), 8000);
      }
    }
  };

  return (
    <header className="editor-header bg-dark-surface border-b border-dark-border">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button onClick={onBack} className="icon-button shrink-0" title="Back to Cards" aria-label="Back to Cards">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </button>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={getCharacterName()}
            className="w-11 h-11 rounded-lg object-cover border border-dark-border shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted text-xs shrink-0">
            No img
          </div>
        )}

        {currentCard && (
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-semibold leading-tight truncate" title={getCharacterName()}>
              {getCharacterName()}
              {isSaving && <span className="text-xs text-dark-muted ml-2">(saving...)</span>}
            </span>
            <div className="flex items-center gap-3 text-xs text-dark-muted mt-1 truncate">
              <span>{getCardTypeLabel()}</span>
              {tokenCounts && <span title="Permanent tokens / total tokens">{getPermanentTokens().toLocaleString()} perm · {tokenCounts.total.toLocaleString()} total</span>}
            </div>
          </div>
        )}
      </div>

      <div className="editor-header-actions">
        {currentCard && <FavoriteButton card={currentCard} className="icon-button favorite-action" onChange={favorite => {
          useCardStore.setState(state => state.currentCard ? { currentCard: { ...state.currentCard, meta: { ...state.currentCard.meta, favorite } } } : {});
        }} />}

        {currentCard && (
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-secondary">
              Export ▾
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
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

        {currentCard && <ChatExportMenu
          onLumiverse={lumiverseEnabled && config.mode === 'full' ? async () => {
            try {
              await useCardStore.getState().saveCard();
              const result = await api.pushToLumiverse(currentCard.meta.id);
              setPushStatus({ type: result.error ? 'error' : 'success', message: result.error || 'Sent to Lumiverse' });
            } catch (error) { setPushStatus({ type: 'error', message: error instanceof Error ? error.message : 'Send failed' }); }
          } : undefined}
          onSillyTavern={sillytavernEnabled ? handlePushToSillyTavern : undefined}
        />}
        <SettingsButton onClick={() => setShowSettings(true)} />
      </div>

      {pushStatus && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            pushStatus.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {pushStatus.message}
        </div>
      )}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
}
