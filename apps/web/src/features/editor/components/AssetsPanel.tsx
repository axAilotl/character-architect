import { useState, useEffect, useCallback, useRef } from 'react';
import { useCardStore } from '../../../store/card-store';
import { useSettingsStore } from '../../../store/settings-store';
import { api } from '../../../lib/api';
import type { CardAssetWithDetails } from '@card-architect/schemas';

interface AssetGraph {
  nodes: any[];
  summary: {
    totalAssets: number;
    actors: number[];
    mainPortrait: { id: string; name: string; url: string } | null;
    mainBackground: { id: string; name: string; url: string } | null;
    animatedCount: number;
  };
  validation: {
    valid: boolean;
    errors: Array<{ assetId: string; assetName: string; severity: string; message: string }>;
  };
}

export function AssetsPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const linkedImageArchivalEnabled = useSettingsStore((state) => state.features?.linkedImageArchivalEnabled ?? false);
  const [assets, setAssets] = useState<CardAssetWithDetails[]>([]);
  const [assetGraph, setAssetGraph] = useState<AssetGraph | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Linked image archival state
  const [archiveStatus, setArchiveStatus] = useState<{
    externalImages: number;
    archivedImages: number;
    canArchive: boolean;
    canRevert: boolean;
  } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Upload form state
  const [uploadType, setUploadType] = useState('icon');
  const [uploadName, setUploadName] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadIsMain, setUploadIsMain] = useState(false);

  // Edit mode state
  const [editingName, setEditingName] = useState(false);
  const [editingType, setEditingType] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');

  // Validation errors display
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const loadAssets = useCallback(async () => {
    if (!currentCard) return;

    setIsLoading(true);
    try {
      const [assetsData, graphData] = await Promise.all([
        api.getAssets(currentCard.meta.id),
        api.getAssetGraph(currentCard.meta.id),
      ]);
      setAssets(assetsData);
      setAssetGraph(graphData);
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentCard?.meta.id]);

  const loadArchiveStatus = useCallback(async () => {
    if (!currentCard || !linkedImageArchivalEnabled) return;

    try {
      const response = await fetch(`/api/cards/${currentCard.meta.id}/archive-status`);
      if (response.ok) {
        const status = await response.json();
        setArchiveStatus(status);
      }
    } catch (err) {
      console.error('Failed to load archive status:', err);
    }
  }, [currentCard?.meta.id, linkedImageArchivalEnabled]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    loadArchiveStatus();
  }, [loadArchiveStatus]);

  const handleArchiveLinkedImages = async () => {
    if (!currentCard) return;

    const confirmed = confirm(
      'This will archive all external images from first message and alternate greetings as local assets.\n\n' +
      'A snapshot backup will be created automatically before any changes.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setIsArchiving(true);
    try {
      const response = await fetch(`/api/cards/${currentCard.meta.id}/archive-linked-images`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully archived ${result.archived} images.\n${result.skipped > 0 ? `${result.skipped} failed.` : ''}`);
        await loadAssets();
        await loadArchiveStatus();
        // Reload the card to get updated content
        await useCardStore.getState().loadCard(currentCard.meta.id);
      } else {
        alert(`Failed to archive images: ${result.error}`);
      }
    } catch (err) {
      console.error('Failed to archive linked images:', err);
      alert('Failed to archive linked images');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRevertArchivedImages = async () => {
    if (!currentCard) return;

    const confirmed = confirm(
      'This will revert all archived images back to their original URLs.\n\n' +
      'A snapshot backup will be created automatically before any changes.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setIsReverting(true);
    try {
      const response = await fetch(`/api/cards/${currentCard.meta.id}/revert-archived-images`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully reverted ${result.reverted} images to original URLs.`);
        await loadAssets();
        await loadArchiveStatus();
        // Reload the card to get updated content
        await useCardStore.getState().loadCard(currentCard.meta.id);
      } else {
        alert(`Failed to revert images: ${result.error}`);
      }
    } catch (err) {
      console.error('Failed to revert archived images:', err);
      alert('Failed to revert archived images');
    } finally {
      setIsReverting(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !currentCard) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // If multiple files are selected, use their original filenames to avoid naming collisions,
        // unless the user explicitly provided a name (which we only use if it's a single file upload)
        const name = files.length > 1 ? file.name : (uploadName || file.name);

        await api.uploadAsset(
          currentCard.meta.id,
          file,
          uploadType,
          name,
          uploadIsMain && i === 0, // Only set as main for the first file if multiple
          uploadTags
        );
      }

      // Reset form and reload
      setUploadName('');
      setUploadTags([]);
      setUploadIsMain(false);
      setShowUploadForm(false);
      await loadAssets();

      // Refresh the card store to update timestamps (for header avatar cache busting)
      await useCardStore.getState().loadCard(currentCard.meta.id);
    } catch (err) {
      console.error('Failed to upload assets:', err);
      alert('Failed to upload one or more assets');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!currentCard) return;
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      await api.deleteAsset(currentCard.meta.id, assetId);
      await loadAssets();
      if (selectedAsset === assetId) {
        setSelectedAsset(null);
      }
      // Refresh card store to update header avatar (in case deleted asset was the portrait)
      await useCardStore.getState().loadCard(currentCard.meta.id);
    } catch (err) {
      console.error('Failed to delete asset:', err);
      alert('Failed to delete asset');
    }
  };

  const handleSetPortraitOverride = async (assetId: string) => {
    if (!currentCard) return;

    try {
      await api.setPortraitOverride(currentCard.meta.id, assetId);
      await loadAssets();
      // Refresh card store to update header avatar
      await useCardStore.getState().loadCard(currentCard.meta.id);
    } catch (err) {
      console.error('Failed to set portrait override:', err);
      alert('Failed to set portrait override');
    }
  };

  const handleSetMainBackground = async (assetId: string) => {
    if (!currentCard) return;

    try {
      await api.setMainBackground(currentCard.meta.id, assetId);
      await loadAssets();
    } catch (err) {
      console.error('Failed to set main background:', err);
      alert('Failed to set main background');
    }
  };

  const handleBindActor = async (assetId: string) => {
    if (!currentCard) return;

    const actorIndex = prompt('Enter actor number (1, 2, 3...):');
    if (!actorIndex) return;

    const index = parseInt(actorIndex, 10);
    if (isNaN(index) || index < 1) {
      alert('Please enter a valid positive number');
      return;
    }

    try {
      await api.bindAssetToActor(currentCard.meta.id, assetId, index);
      await loadAssets();
    } catch (err) {
      console.error('Failed to bind actor:', err);
      alert('Failed to bind actor');
    }
  };

  const handleUnbindActor = async (assetId: string) => {
    if (!currentCard) return;

    try {
      await api.unbindAssetFromActor(currentCard.meta.id, assetId);
      await loadAssets();
    } catch (err) {
      console.error('Failed to unbind actor:', err);
      alert('Failed to unbind actor');
    }
  };

  const handleSaveName = async () => {
    if (!currentCard || !selectedAsset) return;

    try {
      await api.updateAsset(currentCard.meta.id, selectedAsset, { name: editName });
      await loadAssets();
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update asset name:', err);
      alert('Failed to update asset name');
    }
  };

  const handleSaveType = async () => {
    if (!currentCard || !selectedAsset) return;

    try {
      await api.updateAsset(currentCard.meta.id, selectedAsset, { type: editType });
      await loadAssets();
      setEditingType(false);
    } catch (err) {
      console.error('Failed to update asset type:', err);
      alert('Failed to update asset type');
    }
  };

  const selectedAssetData = assets.find(a => a.id === selectedAsset);

  if (!currentCard) {
    return (
      <div className="h-full flex items-center justify-center text-dark-muted">
        <p>No card selected</p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Asset List */}
      <div className="w-80 border-r border-dark-border flex flex-col">
        <div className="p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold mb-4">Assets</h2>

          {assetGraph && (
            <div className="mb-4 p-3 bg-dark-bg rounded text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-dark-muted">Total:</span>
                <span className="font-medium">{assetGraph.summary.totalAssets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Animated:</span>
                <span className="font-medium">{assetGraph.summary.animatedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Actors:</span>
                <span className="font-medium">{assetGraph.summary.actors.length}</span>
              </div>
              {assetGraph.validation.errors.length > 0 && (
                <div className="pt-2 border-t border-dark-border">
                  <button
                    onClick={() => setShowValidationErrors(!showValidationErrors)}
                    className="text-red-400 text-xs hover:text-red-300 flex items-center gap-1 w-full"
                  >
                    <span>⚠ {assetGraph.validation.errors.length} validation issue(s)</span>
                    <svg
                      className={`w-3 h-3 transition-transform ${showValidationErrors ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showValidationErrors && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {assetGraph.validation.errors.map((error, idx) => (
                        <div key={idx} className="p-2 bg-red-900/20 rounded text-xs">
                          <div className="font-medium text-red-300">{error.assetName}</div>
                          <div className="text-red-400 mt-1">{error.message}</div>
                          <div className="text-dark-muted text-xs mt-1">
                            Severity: {error.severity}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Linked Image Archival */}
          {linkedImageArchivalEnabled && (
            <div className="mb-4 p-3 bg-red-900/10 border border-red-900/30 rounded space-y-2">
              <div className="text-xs font-semibold text-red-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Linked Image Archival
              </div>
              {archiveStatus && (
                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-dark-muted">
                    <span>External images:</span>
                    <span className="font-medium text-dark-text">{archiveStatus.externalImages}</span>
                  </div>
                  <div className="flex justify-between text-dark-muted">
                    <span>Archived images:</span>
                    <span className="font-medium text-dark-text">{archiveStatus.archivedImages}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleArchiveLinkedImages}
                  disabled={isArchiving || !archiveStatus?.canArchive}
                  className="flex-1 px-2 py-1.5 text-xs bg-red-600 hover:bg-red-700 disabled:bg-red-900/30 disabled:text-red-400/50 text-white rounded transition-colors flex items-center justify-center gap-1"
                  title={!archiveStatus?.canArchive ? 'No external images to archive' : 'Convert linked images to local assets'}
                >
                  {isArchiving ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Archiving...
                    </>
                  ) : (
                    <>Archive</>
                  )}
                </button>
                <button
                  onClick={handleRevertArchivedImages}
                  disabled={isReverting || !archiveStatus?.canRevert}
                  className="flex-1 px-2 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 disabled:bg-amber-900/30 disabled:text-amber-400/50 text-white rounded transition-colors flex items-center justify-center gap-1"
                  title={!archiveStatus?.canRevert ? 'No archived images to revert' : 'Revert archived images to original URLs'}
                >
                  {isReverting ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Reverting...
                    </>
                  ) : (
                    <>Revert</>
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Asset
          </button>
        </div>

        {/* Upload Form */}
        {showUploadForm && (
          <div className="p-4 bg-dark-bg border-b border-dark-border space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="input-field w-full text-sm"
              >
                <option value="icon">Icon / Portrait</option>
                <option value="background">Background</option>
                <option value="emotion">Expression / Emotion</option>
                <option value="sound">Sound</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name (optional)</label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Auto-generate from filename"
                className="input-field w-full text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="upload-is-main"
                checked={uploadIsMain}
                onChange={(e) => setUploadIsMain(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="upload-is-main" className="text-sm">
                Set as main for this type
              </label>
            </div>

            <div
              className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-dark-border hover:border-blue-500'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                disabled={isUploading}
              />

              {isUploading ? (
                <p className="text-sm text-blue-400">Uploading...</p>
              ) : (
                <p className="text-sm text-dark-muted">
                  Drop file or click to browse
                </p>
              )}
            </div>
          </div>
        )}

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-dark-muted">
              Loading assets...
            </div>
          ) : assets.length === 0 ? (
            <div className="p-4 text-center text-dark-muted">
              No assets yet. Upload some!
            </div>
          ) : (
            <div className="divide-y divide-dark-border">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset.id)}
                  className={`w-full p-3 text-left hover:bg-dark-hover transition-colors ${
                    selectedAsset === asset.id ? 'bg-dark-hover' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail - Use thumbnail endpoint for images */}
                    <div className="w-12 h-12 rounded bg-dark-bg overflow-hidden flex-shrink-0">
                      {asset.asset.mimetype.startsWith('image/') ? (
                        <img
                          src={`/api/assets/${asset.asset.id}/thumbnail?size=96`}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback to full image if thumbnail fails
                            e.currentTarget.src = asset.asset.url;
                          }}
                        />
                      ) : asset.asset.mimetype.startsWith('video/') ? (
                        <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
                          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      ) : asset.asset.mimetype.startsWith('audio/') ? (
                        <div className="w-full h-full flex items-center justify-center bg-green-900/20">
                          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-dark-bg">
                          <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{asset.name}</div>
                      <div className="text-xs text-dark-muted mt-1 flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 bg-dark-bg rounded">{asset.type}</span>
                        {asset.tags?.map(tag => {
                          let bgColor = 'bg-blue-900/30 text-blue-400';
                          if (tag.startsWith('emotion:')) bgColor = 'bg-purple-900/30 text-purple-400';
                          if (tag.startsWith('state:')) bgColor = 'bg-orange-900/30 text-orange-400';
                          if (tag.startsWith('variant:')) bgColor = 'bg-green-900/30 text-green-400';
                          
                          return (
                            <span key={tag} className={`px-1.5 py-0.5 rounded ${bgColor}`}>
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Asset Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedAssetData ? (
          <div className="p-6 space-y-6">
            {/* Preview */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Preview</h3>
              <div className="bg-dark-bg rounded-lg p-4 flex items-center justify-center">
                {selectedAssetData.asset.mimetype.startsWith('image/') ? (
                  <img
                    src={`/api/assets/${selectedAssetData.asset.id}/thumbnail?size=512`}
                    alt={selectedAssetData.name}
                    className="max-w-full max-h-96 rounded cursor-pointer"
                    loading="lazy"
                    title="Click to view full size"
                    onClick={() => window.open(selectedAssetData.asset.url, '_blank')}
                    onError={(e) => {
                      // Fallback to full image if thumbnail fails
                      e.currentTarget.src = selectedAssetData.asset.url;
                    }}
                  />
                ) : selectedAssetData.asset.mimetype.startsWith('video/') ? (
                  <video
                    src={selectedAssetData.asset.url}
                    controls
                    className="max-w-full max-h-96 rounded"
                    preload="metadata"
                  />
                ) : selectedAssetData.asset.mimetype.startsWith('audio/') ? (
                  <audio
                    src={selectedAssetData.asset.url}
                    controls
                    className="w-full"
                    preload="metadata"
                  />
                ) : (
                  <div className="text-center p-8">
                    <p className="text-dark-muted">No preview available</p>
                    <p className="text-sm text-dark-muted mt-2">{selectedAssetData.asset.mimetype}</p>
                  </div>
                )}
              </div>
              {selectedAssetData.asset.mimetype.startsWith('image/') && (
                <p className="text-xs text-dark-muted text-center mt-2">Click image to view full size</p>
              )}
            </div>

            {/* Details */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Details</h3>
              <div className="bg-dark-bg rounded-lg p-4 space-y-3 text-sm">
                {/* Name - Editable */}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-dark-muted">Name:</span>
                  {editingName ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-field flex-1 text-sm py-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                      />
                      <button onClick={handleSaveName} className="btn-primary text-xs px-2 py-1">Save</button>
                      <button onClick={() => setEditingName(false)} className="btn-secondary text-xs px-2 py-1">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedAssetData.name}</span>
                      <button
                        onClick={() => {
                          setEditName(selectedAssetData.name);
                          setEditingName(true);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                        title="Edit name"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Type - Editable */}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-dark-muted">Type:</span>
                  {editingType ? (
                    <div className="flex gap-2 flex-1">
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="input-field flex-1 text-sm py-1"
                        autoFocus
                      >
                        <option value="icon">Icon / Portrait</option>
                        <option value="background">Background</option>
                        <option value="emotion">Expression / Emotion</option>
                        <option value="sound">Sound</option>
                        <option value="custom">Custom</option>
                      </select>
                      <button onClick={handleSaveType} className="btn-primary text-xs px-2 py-1">Save</button>
                      <button onClick={() => setEditingType(false)} className="btn-secondary text-xs px-2 py-1">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedAssetData.type}</span>
                      <button
                        onClick={() => {
                          setEditType(selectedAssetData.type);
                          setEditingType(true);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                        title="Edit type"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-muted">Format:</span>
                  <span className="font-medium">{selectedAssetData.ext.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-muted">Size:</span>
                  <span className="font-medium">{(selectedAssetData.asset.size / 1024).toFixed(2)} KB</span>
                </div>
                {selectedAssetData.asset.width && selectedAssetData.asset.height && (
                  <div className="flex justify-between">
                    <span className="text-dark-muted">Dimensions:</span>
                    <span className="font-medium">{selectedAssetData.asset.width} × {selectedAssetData.asset.height}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-dark-muted">Main:</span>
                  <span className="font-medium">{selectedAssetData.isMain ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {selectedAssetData.tags?.map(tag => {
                  let bgColor = 'bg-blue-900/30 text-blue-400';
                  if (tag.startsWith('emotion:')) bgColor = 'bg-purple-900/30 text-purple-400';
                  if (tag.startsWith('state:')) bgColor = 'bg-orange-900/30 text-orange-400';
                  if (tag.startsWith('variant:')) bgColor = 'bg-green-900/30 text-green-400';

                  return (
                    <span key={tag} className={`px-3 py-1.5 rounded-lg text-sm ${bgColor}`}>
                      {tag}
                    </span>
                  );
                })}
                {!selectedAssetData.tags || selectedAssetData.tags.length === 0 && (
                  <p className="text-sm text-dark-muted">No tags</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Actions</h3>
              <div className="space-y-2">
                {selectedAssetData.type === 'icon' && (
                  <button
                    onClick={() => handleSetPortraitOverride(selectedAssetData.id)}
                    className="btn-secondary w-full justify-start"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Set as Main Portrait
                  </button>
                )}

                {selectedAssetData.type === 'background' && (
                  <button
                    onClick={() => handleSetMainBackground(selectedAssetData.id)}
                    className="btn-secondary w-full justify-start"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Set as Main Background
                  </button>
                )}

                <button
                  onClick={() => handleBindActor(selectedAssetData.id)}
                  className="btn-secondary w-full justify-start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Bind to Actor
                </button>

                <button
                  onClick={() => handleUnbindActor(selectedAssetData.id)}
                  className="btn-secondary w-full justify-start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Unbind from Actor
                </button>

                <button
                  onClick={() => handleDeleteAsset(selectedAssetData.id)}
                  className="btn-danger w-full justify-start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Asset
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-dark-muted">
            <p>Select an asset to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
