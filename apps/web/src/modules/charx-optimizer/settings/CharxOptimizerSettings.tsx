/**
 * Package Optimizer Settings Panel
 *
 * Configure media optimization settings for CHARX and Voxta exports.
 * Controls WebP/WebM conversion, quality, maximum resolution, metadata stripping,
 * and selective asset type export.
 */

import { useState, useEffect } from 'react';

interface PackageExportSettings {
  convertToWebp: boolean;
  webpQuality: number;
  maxMegapixels: number;
  stripMetadata: boolean;
  convertMp4ToWebm: boolean;
  webmQuality: number;
  includedAssetTypes: string[];
}

const DEFAULT_SETTINGS: PackageExportSettings = {
  convertToWebp: true,
  webpQuality: 85,
  maxMegapixels: 4,
  stripMetadata: true,
  convertMp4ToWebm: false,
  webmQuality: 30,
  includedAssetTypes: [],
};

const ASSET_TYPES = [
  { id: 'icon', label: 'Icons', description: 'Character portraits/avatars' },
  { id: 'background', label: 'Backgrounds', description: 'Scene backgrounds' },
  { id: 'emotion', label: 'Emotions', description: 'Expression/emotion sprites' },
  { id: 'user_icon', label: 'User Icons', description: 'User avatars' },
  { id: 'sound', label: 'Sounds', description: 'Audio files' },
  { id: 'workflow', label: 'Workflows', description: 'ComfyUI workflow JSON' },
  { id: 'lorebook', label: 'Lorebooks', description: 'Linked lorebook files' },
  { id: 'custom', label: 'Custom', description: 'Other/miscellaneous assets' },
];

export function CharxOptimizerSettings() {
  const [settings, setSettings] = useState<PackageExportSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/package-optimizer/settings');
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch {
      setStatus('Failed to load Package Optimizer settings');
      setSettings(DEFAULT_SETTINGS);
    }
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      const response = await fetch('/api/package-optimizer/settings', {
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
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus('Failed to save settings');
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const toggleAssetType = (typeId: string) => {
    if (!settings) return;
    const current = settings.includedAssetTypes;
    if (current.includes(typeId)) {
      setSettings({ ...settings, includedAssetTypes: current.filter(t => t !== typeId) });
    } else {
      setSettings({ ...settings, includedAssetTypes: [...current, typeId] });
    }
  };

  const selectAllAssetTypes = () => {
    if (!settings) return;
    setSettings({ ...settings, includedAssetTypes: ASSET_TYPES.map(t => t.id) });
  };

  const clearAssetTypes = () => {
    if (!settings) return;
    setSettings({ ...settings, includedAssetTypes: [] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Package Export Optimizer</h3>
        <p className="text-dark-muted">
          Optimize media when exporting to CHARX or Voxta formats. Reduces file sizes while maintaining quality.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-dark-muted">Loading...</div>
      ) : (
        <>
          {status && (
            <div
              className={`p-3 rounded ${
                status.includes('Failed') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
              }`}
            >
              {status}
            </div>
          )}

          {settings && (
            <div className="space-y-6">
              {/* Image Optimization Section */}
              <div className="border border-dark-border rounded-lg p-6 space-y-6">
                <h4 className="font-semibold">Image Optimization</h4>
                <p className="text-sm text-dark-muted">
                  PNG/JPEG images will be optimized based on these settings.
                </p>

                {/* WebP Conversion */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.convertToWebp}
                      onChange={(e) =>
                        setSettings({ ...settings, convertToWebp: e.target.checked })
                      }
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <span className="font-medium">Convert PNG to WebP</span>
                      <p className="text-xs text-dark-muted">
                        WebP provides better compression than PNG, typically 25-35% smaller files.
                      </p>
                    </div>
                  </label>

                  {/* WebP Quality */}
                  <div className={settings.convertToWebp ? '' : 'opacity-50'}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">WebP Quality</label>
                      <span className="text-sm text-dark-muted">{settings.webpQuality}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={settings.webpQuality}
                      onChange={(e) =>
                        setSettings({ ...settings, webpQuality: parseInt(e.target.value) })
                      }
                      disabled={!settings.convertToWebp}
                      className="w-full h-2 bg-dark-card rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="flex justify-between text-xs text-dark-muted mt-1">
                      <span>Smaller files</span>
                      <span>Higher quality</span>
                    </div>
                  </div>
                </div>

                {/* Max Resolution */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Maximum Resolution</label>
                    <span className="text-sm text-dark-muted">{settings.maxMegapixels} MP</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    step="0.5"
                    value={settings.maxMegapixels}
                    onChange={(e) =>
                      setSettings({ ...settings, maxMegapixels: parseFloat(e.target.value) })
                    }
                    className="w-full h-2 bg-dark-card rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                  <div className="flex justify-between text-xs text-dark-muted">
                    <span>1 MP (~1000x1000)</span>
                    <span>16 MP (~4000x4000)</span>
                  </div>
                </div>

                {/* Strip Metadata */}
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.stripMetadata}
                    onChange={(e) =>
                      setSettings({ ...settings, stripMetadata: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="font-medium">Strip Metadata</span>
                    <p className="text-xs text-dark-muted">
                      Remove EXIF data and other metadata from images.
                    </p>
                  </div>
                </label>
              </div>

              {/* Video Optimization Section */}
              <div className="border border-dark-border rounded-lg p-6 space-y-6">
                <h4 className="font-semibold">Video Optimization</h4>
                <p className="text-sm text-dark-muted">
                  MP4 videos can be converted to WebM for better compatibility.
                </p>

                {/* MP4 to WebM */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.convertMp4ToWebm}
                      onChange={(e) =>
                        setSettings({ ...settings, convertMp4ToWebm: e.target.checked })
                      }
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <span className="font-medium">Convert MP4 to WebM</span>
                      <p className="text-xs text-dark-muted">
                        Requires ffmpeg installed on the server. WebM has better browser support.
                      </p>
                    </div>
                  </label>

                  {/* WebM Quality */}
                  <div className={settings.convertMp4ToWebm ? '' : 'opacity-50'}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">WebM Quality (CRF)</label>
                      <span className="text-sm text-dark-muted">{settings.webmQuality}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={settings.webmQuality}
                      onChange={(e) =>
                        setSettings({ ...settings, webmQuality: parseInt(e.target.value) })
                      }
                      disabled={!settings.convertMp4ToWebm}
                      className="w-full h-2 bg-dark-card rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="flex justify-between text-xs text-dark-muted mt-1">
                      <span>Higher quality (larger)</span>
                      <span>Lower quality (smaller)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Asset Type Selection */}
              <div className="border border-dark-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Asset Types to Include</h4>
                    <p className="text-sm text-dark-muted">
                      Select which asset types to include in the export. Empty = include all.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllAssetTypes}
                      className="px-3 py-1 text-xs bg-dark-card hover:bg-dark-hover rounded transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearAssetTypes}
                      className="px-3 py-1 text-xs bg-dark-card hover:bg-dark-hover rounded transition-colors"
                    >
                      Clear (All)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {ASSET_TYPES.map((type) => (
                    <label
                      key={type.id}
                      className={`flex items-start gap-2 p-3 rounded border cursor-pointer transition-colors ${
                        settings.includedAssetTypes.length === 0 || settings.includedAssetTypes.includes(type.id)
                          ? 'border-teal-500 bg-teal-500/10'
                          : 'border-dark-border hover:border-dark-hover'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={settings.includedAssetTypes.length === 0 || settings.includedAssetTypes.includes(type.id)}
                        onChange={() => toggleAssetType(type.id)}
                        className="w-4 h-4 mt-0.5 rounded"
                      />
                      <div>
                        <span className="font-medium text-sm">{type.label}</span>
                        <p className="text-xs text-dark-muted">{type.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Main icon is always included regardless of selection
                </p>
              </div>

              {/* Info box */}
              <div className="bg-dark-card/50 rounded-lg p-4">
                <h5 className="font-medium text-sm mb-2">How it works</h5>
                <ul className="text-xs text-dark-muted space-y-1">
                  <li>• PNG/JPEG images are converted to WebP format (if enabled)</li>
                  <li>• MP4 videos are converted to WebM format (if enabled, requires ffmpeg)</li>
                  <li>• Large images are downscaled to fit the max resolution</li>
                  <li>• GIF images are preserved (animation support)</li>
                  <li>• Main icon and character.json are always included</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-dark-border">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-dark-muted hover:text-white transition-colors"
                >
                  Reset to Defaults
                </button>
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
