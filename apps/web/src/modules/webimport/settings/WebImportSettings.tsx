/**
 * Web Import Settings Panel
 *
 * Configure web import userscript and asset processing settings.
 */

import { useState, useEffect } from 'react';
import { getDeploymentConfig } from '../../../config/deployment';

interface WebImportSettingsData {
  icons: { convertToWebp: boolean; webpQuality: number; maxMegapixels: number };
  emotions: { convertToWebp: boolean; webpQuality: number; maxMegapixels: number };
  skipDefaultEmoji: boolean;
  audio: {
    enabled: boolean;
    downloadAllModels: boolean;
  };
  wyvernGallery: {
    enabled: boolean;
    includeAvatar: boolean;
    includeBackground: boolean;
    includeOther: boolean;
    convertToWebp: boolean;
    webpQuality: number;
  };
  chubGallery: {
    enabled: boolean;
    convertToWebp: boolean;
    webpQuality: number;
  };
  relatedLorebooks: {
    enabled: boolean;
    mergeIntoCard: boolean;
    saveAsAsset: boolean;
  };
}

interface SiteInfo {
  id: string;
  name: string;
  patterns: string[];
}

export function WebImportSettings() {
  const [settings, setSettings] = useState<WebImportSettingsData | null>(null);
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const config = getDeploymentConfig();

    // In client-side mode, web import settings aren't configurable
    if (config.mode === 'light' || config.mode === 'static') {
      // Set default sites info (static)
      setSites([
        { id: 'chub', name: 'Chub.ai', patterns: ['chub.ai/characters/*'] },
        { id: 'risu', name: 'RisuAI Realm', patterns: ['realm.risuai.net/character/*'] },
        { id: 'character_tavern', name: 'Character Tavern', patterns: ['character-tavern.com/character/*'] },
        { id: 'wyvern', name: 'Wyvern', patterns: ['app.wyvern.chat/characters/*'] },
      ]);
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const [settingsRes, sitesRes] = await Promise.all([
        fetch('/api/web-import/settings'),
        fetch('/api/web-import/sites'),
      ]);
      const settingsData = await settingsRes.json();
      const sitesData = await sitesRes.json();
      // API returns settings directly, not wrapped in { settings: ... }
      setSettings(settingsData);
      setSites(sitesData.sites || []);
    } catch {
      setStatus('Failed to load Web Import settings');
    }
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      const response = await fetch('/api/web-import/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const err = await response.json();
        setStatus(err.error || 'Failed to save settings');
        return;
      }

      setStatus('Settings saved successfully.');
    } catch {
      setStatus('Failed to save settings');
    }
  };

  const handleDownloadUserscript = () => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      // In client-side mode, show info about manual configuration
      alert('Web Import userscript requires a local Card Architect server.\n\nTo use web import:\n1. Run Card Architect locally\n2. Download userscript from your local server\n3. Configure the userscript API URL');
      return;
    }
    window.location.href = '/api/web-import/userscript';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Web Import</h3>
        <p className="text-dark-muted">
          Import character cards directly from supported sites using a browser userscript.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-dark-muted">Loading...</div>
      ) : (
        <>
          {status && (
            <div className={`p-3 rounded ${status.includes('Failed') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              {status}
            </div>
          )}

          {/* Userscript Download */}
          <div className="border border-dark-border rounded-lg p-6 space-y-4">
            <h4 className="font-semibold">Userscript Installation</h4>
            <p className="text-sm text-dark-muted">
              Install this userscript in Tampermonkey, Violentmonkey, or Greasemonkey to add "Send to Card Architect" buttons on supported sites.
            </p>
            <button
              onClick={handleDownloadUserscript}
              className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
            >
              Download Userscript
            </button>
          </div>

          {/* Supported Sites */}
          <div className="border border-dark-border rounded-lg p-6 space-y-4">
            <h4 className="font-semibold">Supported Sites</h4>
            <div className="space-y-2">
              {sites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-3 bg-dark-card rounded">
                  <div>
                    <span className="font-medium">{site.name}</span>
                    <p className="text-xs text-dark-muted">{site.patterns?.join(', ') || ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Processing Settings */}
          {settings && (
            <div className="border border-dark-border rounded-lg p-6 space-y-6">
              <h4 className="font-semibold">Asset Processing</h4>
              <p className="text-sm text-dark-muted">
                Configure how imported images are processed and optimized.
              </p>

              {/* Icons Settings */}
              <div className="space-y-3">
                <h5 className="font-medium text-sm">Icons (Main Character Image)</h5>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.icons.convertToWebp}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          icons: { ...settings.icons, convertToWebp: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Convert to WebP</span>
                  </label>
                  <div>
                    <label className="block text-xs text-dark-muted mb-1">Quality</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.icons.webpQuality}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          icons: { ...settings.icons, webpQuality: parseInt(e.target.value) || 80 },
                        })
                      }
                      className="w-full bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-muted mb-1">Max Megapixels</label>
                    <input
                      type="number"
                      min="0.1"
                      max="50"
                      step="0.1"
                      value={settings.icons.maxMegapixels}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          icons: { ...settings.icons, maxMegapixels: parseFloat(e.target.value) || 2 },
                        })
                      }
                      className="w-full bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Emotions Settings */}
              <div className="space-y-3">
                <h5 className="font-medium text-sm">Emotions / Expressions</h5>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.emotions.convertToWebp}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emotions: { ...settings.emotions, convertToWebp: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Convert to WebP</span>
                  </label>
                  <div>
                    <label className="block text-xs text-dark-muted mb-1">Quality</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.emotions.webpQuality}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emotions: { ...settings.emotions, webpQuality: parseInt(e.target.value) || 80 },
                        })
                      }
                      className="w-full bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-muted mb-1">Max Megapixels</label>
                    <input
                      type="number"
                      min="0.1"
                      max="50"
                      step="0.1"
                      value={settings.emotions.maxMegapixels}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emotions: { ...settings.emotions, maxMegapixels: parseFloat(e.target.value) || 1 },
                        })
                      }
                      className="w-full bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Skip Default Emoji */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.skipDefaultEmoji}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      skipDefaultEmoji: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">Skip default emoji placeholders (120x120 images)</span>
              </label>

              {/* Audio Settings (Chub) */}
              <div className="space-y-3 pt-4 border-t border-dark-border">
                <h5 className="font-medium text-sm">Audio Archival (Chub Voice Samples)</h5>
                <p className="text-xs text-dark-muted">
                  Download voice samples from Chub cards that have voice data attached.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.audio?.enabled ?? false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          audio: { ...settings.audio, enabled: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Enable audio archival</span>
                  </label>
                  <label className="flex items-center gap-2 ml-6">
                    <input
                      type="checkbox"
                      checked={settings.audio?.downloadAllModels ?? false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          audio: { ...settings.audio, downloadAllModels: e.target.checked },
                        })
                      }
                      disabled={!settings.audio?.enabled}
                      className="rounded"
                    />
                    <span className={`text-sm ${!settings.audio?.enabled ? 'text-dark-muted' : ''}`}>
                      Download all TTS models (e2, f5, z variants)
                    </span>
                  </label>
                </div>
              </div>

              {/* Chub Gallery Settings */}
              <div className="space-y-3 pt-4 border-t border-dark-border">
                <h5 className="font-medium text-sm">Chub Gallery Images</h5>
                <p className="text-xs text-dark-muted">
                  Download gallery images from Chub character pages (when hasGallery is true).
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.chubGallery?.enabled ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          chubGallery: { ...settings.chubGallery, enabled: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Enable Chub gallery archival</span>
                  </label>
                  <div className="ml-6 flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.chubGallery?.convertToWebp ?? false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            chubGallery: { ...settings.chubGallery, convertToWebp: e.target.checked },
                          })
                        }
                        disabled={!settings.chubGallery?.enabled}
                        className="rounded"
                      />
                      <span className={`text-sm ${!settings.chubGallery?.enabled ? 'text-dark-muted' : ''}`}>
                        Convert to WebP
                      </span>
                    </label>
                    <div>
                      <label className="block text-xs text-dark-muted mb-1">Quality</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={settings.chubGallery?.webpQuality ?? 85}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            chubGallery: { ...settings.chubGallery, webpQuality: parseInt(e.target.value) || 85 },
                          })
                        }
                        disabled={!settings.chubGallery?.enabled || !settings.chubGallery?.convertToWebp}
                        className="w-20 bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Lorebooks Settings (Chub) */}
              <div className="space-y-3 pt-4 border-t border-dark-border">
                <h5 className="font-medium text-sm">Related Lorebooks (Chub)</h5>
                <p className="text-xs text-dark-muted">
                  Automatically fetch and merge linked lorebooks from Chub cards into the character's lorebook.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.relatedLorebooks?.enabled ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          relatedLorebooks: { ...settings.relatedLorebooks, enabled: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Fetch related lorebooks</span>
                  </label>
                  <label className="flex items-center gap-2 ml-6">
                    <input
                      type="checkbox"
                      checked={settings.relatedLorebooks?.mergeIntoCard ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          relatedLorebooks: { ...settings.relatedLorebooks, mergeIntoCard: e.target.checked },
                        })
                      }
                      disabled={!settings.relatedLorebooks?.enabled}
                      className="rounded"
                    />
                    <span className={`text-sm ${!settings.relatedLorebooks?.enabled ? 'text-dark-muted' : ''}`}>
                      Merge entries into character_book
                    </span>
                  </label>
                  <label className="flex items-center gap-2 ml-6">
                    <input
                      type="checkbox"
                      checked={settings.relatedLorebooks?.saveAsAsset ?? false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          relatedLorebooks: { ...settings.relatedLorebooks, saveAsAsset: e.target.checked },
                        })
                      }
                      disabled={!settings.relatedLorebooks?.enabled}
                      className="rounded"
                    />
                    <span className={`text-sm ${!settings.relatedLorebooks?.enabled ? 'text-dark-muted' : ''}`}>
                      Save as separate asset (JSON)
                    </span>
                  </label>
                  <p className="text-xs text-dark-muted ml-6">
                    Source tracking is added to each merged entry for traceability.
                  </p>
                </div>
              </div>

              {/* Wyvern Gallery Settings */}
              <div className="space-y-3 pt-4 border-t border-dark-border">
                <h5 className="font-medium text-sm">Wyvern Gallery Images</h5>
                <p className="text-xs text-dark-muted">
                  Download gallery images (avatar, backgrounds) from Wyvern character pages.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.wyvernGallery?.enabled ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          wyvernGallery: { ...settings.wyvernGallery, enabled: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Enable gallery archival</span>
                  </label>
                  <div className="ml-6 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.wyvernGallery?.includeAvatar ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            wyvernGallery: { ...settings.wyvernGallery, includeAvatar: e.target.checked },
                          })
                        }
                        disabled={!settings.wyvernGallery?.enabled}
                        className="rounded"
                      />
                      <span className={`text-sm ${!settings.wyvernGallery?.enabled ? 'text-dark-muted' : ''}`}>
                        Include avatars (icon type)
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.wyvernGallery?.includeBackground ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            wyvernGallery: { ...settings.wyvernGallery, includeBackground: e.target.checked },
                          })
                        }
                        disabled={!settings.wyvernGallery?.enabled}
                        className="rounded"
                      />
                      <span className={`text-sm ${!settings.wyvernGallery?.enabled ? 'text-dark-muted' : ''}`}>
                        Include backgrounds
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.wyvernGallery?.includeOther ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            wyvernGallery: { ...settings.wyvernGallery, includeOther: e.target.checked },
                          })
                        }
                        disabled={!settings.wyvernGallery?.enabled}
                        className="rounded"
                      />
                      <span className={`text-sm ${!settings.wyvernGallery?.enabled ? 'text-dark-muted' : ''}`}>
                        Include other gallery images
                      </span>
                    </label>
                    <div className="flex items-center gap-4 pt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settings.wyvernGallery?.convertToWebp ?? false}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              wyvernGallery: { ...settings.wyvernGallery, convertToWebp: e.target.checked },
                            })
                          }
                          disabled={!settings.wyvernGallery?.enabled}
                          className="rounded"
                        />
                        <span className={`text-sm ${!settings.wyvernGallery?.enabled ? 'text-dark-muted' : ''}`}>
                          Convert to WebP
                        </span>
                      </label>
                      <div>
                        <label className="block text-xs text-dark-muted mb-1">Quality</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={settings.wyvernGallery?.webpQuality ?? 85}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              wyvernGallery: { ...settings.wyvernGallery, webpQuality: parseInt(e.target.value) || 85 },
                            })
                          }
                          disabled={!settings.wyvernGallery?.enabled || !settings.wyvernGallery?.convertToWebp}
                          className="w-20 bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-dark-border">
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
