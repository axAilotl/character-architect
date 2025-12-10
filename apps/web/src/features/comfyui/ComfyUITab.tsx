/**
 * ComfyUI Tab - Iframe-based ComfyUI integration
 *
 * Embeds ComfyUI in an iframe and captures generated images via postMessage bridge.
 * Users work directly in ComfyUI's native interface.
 */

import { useState, useRef } from 'react';
import { useCardStore } from '../../store/card-store';
import { useSettingsStore } from '../../store/settings-store';
import { useComfyBridge, type ComfyImagePayload } from '../../hooks/useComfyBridge';
import { getDeploymentConfig } from '../../config/deployment';

/**
 * Setup instructions shown when no ComfyUI URL is configured
 */
function SetupInstructions() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="text-6xl mb-6">&#127912;</div>
        <h2 className="text-2xl font-semibold mb-4">Connect to ComfyUI</h2>
        <p className="text-dark-muted mb-6">
          Configure your ComfyUI server URL in Settings &gt; ComfyUI to enable image generation.
        </p>
        <div className="text-left bg-dark-surface border border-dark-border rounded-lg p-6 space-y-4">
          <h3 className="font-medium">Quick Setup:</h3>
          <ol className="list-decimal list-inside space-y-2 text-dark-muted text-sm">
            <li>Go to <strong className="text-dark-text">Settings &gt; ComfyUI</strong></li>
            <li>Enter your ComfyUI server URL (e.g., <code className="bg-dark-bg px-1 rounded">http://127.0.0.1:8188</code>)</li>
            <li>Install the bridge extension (code provided in settings)</li>
            <li>Launch ComfyUI with CORS enabled: <code className="bg-dark-bg px-1 rounded">--enable-cors-header *</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * Save image overlay - appears when an image is captured from ComfyUI
 */
interface SaveImageOverlayProps {
  image: ComfyImagePayload;
  comfyUrl: string;
  cardId: string;
  onSaved: () => void;
  onDismiss: () => void;
}

function SaveImageOverlay({ image, comfyUrl, cardId, onSaved, onDismiss }: SaveImageOverlayProps) {
  const [saving, setSaving] = useState(false);
  const [assetType, setAssetType] = useState<'icon' | 'background' | 'user_avatar' | 'emotion'>('icon');

  // Construct image URL via our proxy (to avoid CORS issues)
  const imageUrl = `/api/comfyui/image?serverUrl=${encodeURIComponent(comfyUrl)}&filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${encodeURIComponent(image.type)}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Fetch the image through our proxy
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Upload to card assets
      const formData = new FormData();
      formData.append('file', blob, `${image.filename}`);
      formData.append('type', assetType);

      const uploadResponse = await fetch(`/api/cards/${cardId}/assets`, {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        onSaved();
      } else {
        console.error('Failed to save asset:', await uploadResponse.text());
      }
    } catch (error) {
      console.error('Failed to save image:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-dark-surface border border-dark-border rounded-lg shadow-xl p-4 w-80">
      <div className="flex items-start gap-3">
        {/* Image preview */}
        <div className="w-20 h-20 bg-dark-bg rounded overflow-hidden flex-shrink-0">
          <img
            src={imageUrl}
            alt="Generated"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-2 truncate" title={image.filename}>
            {image.filename}
          </p>

          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as typeof assetType)}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm mb-2"
          >
            <option value="icon">Icon</option>
            <option value="background">Background</option>
            <option value="user_avatar">User Avatar</option>
            <option value="emotion">Emotion</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 bg-dark-border text-dark-text text-sm rounded hover:bg-dark-muted/30"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Image history panel - shows recently captured images
 */
interface ImageHistoryPanelProps {
  images: ComfyImagePayload[];
  comfyUrl: string;
  cardId: string;
  onClear: () => void;
}

function ImageHistoryPanel({ images, comfyUrl, cardId, onClear }: ImageHistoryPanelProps) {
  const [saving, setSaving] = useState<string | null>(null);

  if (images.length === 0) return null;

  const handleSave = async (image: ComfyImagePayload, assetType: string) => {
    setSaving(image.filename);
    try {
      const imageUrl = `/api/comfyui/image?serverUrl=${encodeURIComponent(comfyUrl)}&filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${encodeURIComponent(image.type)}`;
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('file', blob, image.filename);
      formData.append('type', assetType);

      await fetch(`/api/cards/${cardId}/assets`, {
        method: 'POST',
        body: formData,
      });
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-40 bg-dark-surface/95 border border-dark-border rounded-lg p-3 max-w-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-dark-muted">Recent ({images.length})</span>
        <button
          onClick={onClear}
          className="text-xs text-dark-muted hover:text-dark-text"
        >
          Clear
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.slice(0, 10).map((img, idx) => {
          const imageUrl = `/api/comfyui/image?serverUrl=${encodeURIComponent(comfyUrl)}&filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
          return (
            <div key={`${img.filename}-${idx}`} className="relative group flex-shrink-0">
              <div className="w-16 h-16 bg-dark-bg rounded overflow-hidden">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => handleSave(img, 'icon')}
                  disabled={saving === img.filename}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {saving === img.filename ? '...' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Main ComfyUI Tab component
 */
export function ComfyUITab() {
  const { currentCard } = useCardStore();
  const comfyUrl = useSettingsStore((state) => state.comfyUI.serverUrl);
  const { pendingImage, imageHistory, clearPending, clearHistory } = useComfyBridge(comfyUrl);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeError, setIframeError] = useState(false);

  // Check deployment mode
  const config = getDeploymentConfig();
  if (config.mode === 'light' || config.mode === 'static') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-dark-muted max-w-md">
          <h2 className="text-xl font-semibold mb-2">ComfyUI Integration</h2>
          <p className="mb-4">
            ComfyUI integration requires running Character Architect locally with a backend server.
          </p>
          <p className="text-sm">
            This feature connects to your ComfyUI instance to generate images for your character cards.
          </p>
        </div>
      </div>
    );
  }

  // No card loaded
  if (!currentCard) {
    return (
      <div className="h-full flex items-center justify-center text-dark-muted">
        <div className="text-center">
          <div className="text-6xl mb-4">&#127912;</div>
          <h2 className="text-xl font-semibold mb-2">No Card Loaded</h2>
          <p>Create or load a character card to use ComfyUI integration.</p>
        </div>
      </div>
    );
  }

  // No URL configured
  if (!comfyUrl) {
    return <SetupInstructions />;
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Connection status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              iframeError ? 'bg-red-500' : 'bg-green-500'
            }`}
          />
          <span className="text-sm text-dark-muted truncate max-w-md" title={comfyUrl}>
            {comfyUrl}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {imageHistory.length > 0 && (
            <span className="text-xs text-dark-muted">
              {imageHistory.length} captured
            </span>
          )}
          <button
            onClick={() => iframeRef.current?.contentWindow?.location.reload()}
            className="px-2 py-1 text-xs bg-dark-border rounded hover:bg-dark-muted/30"
            title="Reload ComfyUI"
          >
            Reload
          </button>
        </div>
      </div>

      {/* ComfyUI iframe */}
      <div className="flex-1 relative">
        {iframeError ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-dark-muted max-w-md p-8">
              <div className="text-4xl mb-4">&#9888;</div>
              <h3 className="text-lg font-medium mb-2">Connection Failed</h3>
              <p className="text-sm mb-4">
                Could not load ComfyUI from <code className="bg-dark-bg px-1 rounded">{comfyUrl}</code>
              </p>
              <ul className="text-sm text-left space-y-2">
                <li>&#8226; Make sure ComfyUI is running</li>
                <li>&#8226; Check if the URL is correct</li>
                <li>&#8226; Ensure CORS is enabled: <code className="bg-dark-bg px-1 rounded">--enable-cors-header *</code></li>
              </ul>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={comfyUrl}
            className="w-full h-full border-0"
            allow="clipboard-write; clipboard-read"
            onError={() => setIframeError(true)}
            title="ComfyUI"
          />
        )}

        {/* Image history panel */}
        <ImageHistoryPanel
          images={imageHistory}
          comfyUrl={comfyUrl}
          cardId={currentCard.meta.id}
          onClear={clearHistory}
        />
      </div>

      {/* Save overlay for most recent image */}
      {pendingImage && (
        <SaveImageOverlay
          image={pendingImage}
          comfyUrl={comfyUrl}
          cardId={currentCard.meta.id}
          onSaved={clearPending}
          onDismiss={clearPending}
        />
      )}
    </div>
  );
}
