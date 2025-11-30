/**
 * ComfyUI Tab - Scaffolding for future ComfyUI integration
 * Sub-tabs: General | Emotion Images
 */

import { useState } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { useSettingsStore } from '../../store/settings-store';

type SubTab = 'general' | 'emotions';

export function ComfyUITab() {
  const { currentCard } = useCardStore();
  const comfyUISettings = useSettingsStore((state) => state.comfyUI);
  const [subTab, setSubTab] = useState<SubTab>('general');

  // Form state for generation (scaffolding - not connected)
  const [selectedPromptType, setSelectedPromptType] = useState('character');
  const [seed, setSeed] = useState(Math.floor(Math.random() * 999999999));
  const [filename, setFilename] = useState('');

  // Card data available for future use when connected
  const _cardData = currentCard ? extractCardData(currentCard) : null;
  void _cardData; // Suppress unused warning

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full text-dark-muted">
        <div className="text-center">
          <div className="text-6xl mb-4">&#127912;</div>
          <h2 className="text-xl font-semibold mb-2">No Card Loaded</h2>
          <p>Create or load a character card to use ComfyUI integration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tabs */}
      <div className="flex border-b border-dark-border bg-dark-surface">
        <button
          onClick={() => setSubTab('general')}
          className={`px-6 py-3 font-medium transition-colors ${
            subTab === 'general'
              ? 'text-green-400 border-b-2 border-green-500'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setSubTab('emotions')}
          className={`px-6 py-3 font-medium transition-colors ${
            subTab === 'emotions'
              ? 'text-green-400 border-b-2 border-green-500'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          Emotion Images
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {subTab === 'general' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm">
                <strong>Scaffolding Mode:</strong> This is a preview of the ComfyUI integration interface.
                The actual connection to ComfyUI is not yet implemented.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left - Generated Image Preview */}
              <div className="space-y-4">
                <div className="aspect-[3/4] bg-dark-surface border-2 border-dashed border-dark-border rounded-lg flex items-center justify-center">
                  <div className="text-center text-dark-muted">
                    <div className="text-4xl mb-2">&#127912;</div>
                    <p>Generated image will appear here</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoSelectType"
                      checked={comfyUISettings?.autoSelectType ?? true}
                      readOnly
                      className="rounded"
                    />
                    <label htmlFor="autoSelectType" className="text-sm">
                      Auto-select type from prompt
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled
                      className="flex-1 px-4 py-2 bg-green-600 opacity-50 cursor-not-allowed text-white rounded"
                    >
                      Save Asset
                    </button>
                    <select className="bg-dark-surface border border-dark-border rounded px-3 py-2">
                      <option>icon</option>
                      <option>background</option>
                      <option>user_avatar</option>
                      <option>emotion</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoFilename"
                      checked={comfyUISettings?.autoGenerateFilename ?? true}
                      readOnly
                      className="rounded"
                    />
                    <label htmlFor="autoFilename" className="text-sm">
                      Auto-generate filename
                    </label>
                  </div>

                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="Filename"
                    className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
                  />
                </div>
              </div>

              {/* Right - Generation Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Workflow</label>
                  <select className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2">
                    <option>Basic Text to Image</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Model</label>
                  <input
                    type="text"
                    value={comfyUISettings?.defaultModel || ''}
                    readOnly
                    placeholder="model.safetensors"
                    className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Sampler</label>
                    <select
                      value={comfyUISettings?.defaultSampler || 'euler'}
                      className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
                      disabled
                    >
                      <option value="euler">euler</option>
                      <option value="euler_ancestral">euler_ancestral</option>
                      <option value="heun">heun</option>
                      <option value="dpm_2">dpm_2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Scheduler</label>
                    <select
                      value={comfyUISettings?.defaultScheduler || 'normal'}
                      className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
                      disabled
                    >
                      <option value="normal">normal</option>
                      <option value="karras">karras</option>
                      <option value="exponential">exponential</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Width</label>
                    <input
                      type="number"
                      value={comfyUISettings?.defaultWidth || 512}
                      readOnly
                      className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Height</label>
                    <input
                      type="number"
                      value={comfyUISettings?.defaultHeight || 768}
                      readOnly
                      className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Seed</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                      className="flex-1 bg-dark-surface border border-dark-border rounded px-3 py-2"
                    />
                    <button
                      onClick={() => setSeed(Math.floor(Math.random() * 999999999))}
                      className="px-3 py-2 bg-dark-surface border border-dark-border rounded hover:bg-dark-border transition-colors"
                      title="Random seed"
                    >
                      &#127922;
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Prompt Type</label>
                  <select
                    value={selectedPromptType}
                    onChange={(e) => setSelectedPromptType(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
                  >
                    <option value="character">Character (Full Body)</option>
                    <option value="scenario">Scenario (Scene)</option>
                    <option value="portrait">Portrait (Face)</option>
                    <option value="background">Background</option>
                  </select>
                </div>

                <details className="border border-dark-border rounded">
                  <summary className="px-3 py-2 cursor-pointer text-sm font-medium">
                    Advanced
                  </summary>
                  <div className="p-3 space-y-3 border-t border-dark-border">
                    <div>
                      <label className="block text-sm font-medium mb-1">Positive Prefix</label>
                      <textarea
                        value={comfyUISettings?.positivePrefix || ''}
                        readOnly
                        rows={2}
                        className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Negative Prefix</label>
                      <textarea
                        value={comfyUISettings?.negativePrefix || ''}
                        readOnly
                        rows={2}
                        className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </details>

                <button
                  disabled
                  className="w-full px-4 py-3 bg-green-600 opacity-50 cursor-not-allowed text-white rounded font-medium"
                >
                  Generate (Not Connected)
                </button>
              </div>
            </div>
          </div>
        )}

        {subTab === 'emotions' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm">
                <strong>Scaffolding Mode:</strong> Emotion sprite generation is not yet implemented.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Source Asset</label>
                  <div className="flex gap-2">
                    <select className="flex-1 bg-dark-surface border border-dark-border rounded px-3 py-2">
                      <option>Select from card assets...</option>
                    </select>
                    <button
                      disabled
                      className="px-4 py-2 bg-dark-surface border border-dark-border rounded opacity-50 cursor-not-allowed"
                    >
                      Upload
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Format</label>
                  <div className="flex gap-2">
                    <select className="flex-1 bg-dark-surface border border-dark-border rounded px-3 py-2">
                      <option>SillyTavern (28 expressions)</option>
                      <option>Voxta (8 expressions)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cards per Expression</label>
                <input
                  type="number"
                  defaultValue={1}
                  min={1}
                  max={4}
                  className="w-32 bg-dark-surface border border-dark-border rounded px-3 py-2"
                />
              </div>

              <button
                disabled
                className="px-6 py-3 bg-green-600 opacity-50 cursor-not-allowed text-white rounded font-medium"
              >
                Generate All (Not Connected)
              </button>

              <div>
                <h4 className="font-medium mb-3">Results</h4>
                <div className="grid grid-cols-7 gap-2">
                  {['happy', 'sad', 'angry', 'surprised', 'disgusted', 'fearful', 'neutral'].map(
                    (emotion) => (
                      <div
                        key={emotion}
                        className="aspect-square bg-dark-surface border border-dark-border rounded flex items-center justify-center"
                      >
                        <span className="text-xs text-dark-muted">{emotion}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
