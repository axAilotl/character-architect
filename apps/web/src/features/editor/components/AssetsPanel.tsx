import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCardStore } from '../../../store/card-store';
import { useSettingsStore } from '../../../store/settings-store';
import { getDeploymentConfig } from '../../../config/deployment';
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

type ViewMode = 'list' | 'grid';
type SortField = 'name' | 'type' | 'ext' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const ASSET_TYPES = [
  { value: 'icon', label: 'Icon / Portrait' },
  { value: 'background', label: 'Background' },
  { value: 'emotion', label: 'Expression / Emotion' },
  { value: 'sound', label: 'Sound' },
  { value: 'workflow', label: 'Workflow (ComfyUI)' },
  { value: 'lorebook', label: 'Lorebook' },
  { value: 'custom', label: 'Custom' },
];

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

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Bulk selection state
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [bulkEditType, setBulkEditType] = useState('');

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

  // Sort assets
  const sortedAssets = useMemo(() => {
    const sorted = [...assets].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'type':
          aVal = a.type.toLowerCase();
          bVal = b.type.toLowerCase();
          break;
        case 'ext':
          aVal = a.ext.toLowerCase();
          bVal = b.ext.toLowerCase();
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [assets, sortField, sortOrder]);

  const loadAssets = useCallback(async () => {
    if (!currentCard) return;

    const config = getDeploymentConfig();

    // In client-side mode, assets are not supported yet
    if (config.mode === 'light' || config.mode === 'static') {
      setAssets([]);
      setAssetGraph(null);
      return;
    }

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

  // Clear selection when switching view modes
  useEffect(() => {
    setSelectedAssets(new Set());
    setSelectedAsset(null);
  }, [viewMode]);

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
        const name = files.length > 1 ? file.name : (uploadName || file.name);

        await api.uploadAsset(
          currentCard.meta.id,
          file,
          uploadType,
          name,
          uploadIsMain && i === 0,
          uploadTags
        );
      }

      setUploadName('');
      setUploadTags([]);
      setUploadIsMain(false);
      setShowUploadForm(false);
      await loadAssets();
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
      setSelectedAssets(prev => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
      await useCardStore.getState().loadCard(currentCard.meta.id);
    } catch (err) {
      console.error('Failed to delete asset:', err);
      alert('Failed to delete asset');
    }
  };

  const handleBulkDelete = async () => {
    if (!currentCard || selectedAssets.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedAssets.size} asset(s)?`)) return;

    try {
      const deletePromises = Array.from(selectedAssets).map(assetId =>
        api.deleteAsset(currentCard.meta.id, assetId)
      );
      await Promise.allSettled(deletePromises);
      await loadAssets();
      setSelectedAssets(new Set());
      setSelectedAsset(null);
      await useCardStore.getState().loadCard(currentCard.meta.id);
    } catch (err) {
      console.error('Failed to bulk delete assets:', err);
      alert('Failed to delete some assets');
    }
  };

  const handleBulkChangeType = async () => {
    if (!currentCard || selectedAssets.size === 0 || !bulkEditType) return;

    try {
      const updatePromises = Array.from(selectedAssets).map(assetId =>
        api.updateAsset(currentCard.meta.id, assetId, { type: bulkEditType })
      );
      await Promise.allSettled(updatePromises);
      await loadAssets();
      setBulkEditType('');
    } catch (err) {
      console.error('Failed to bulk update asset types:', err);
      alert('Failed to update some assets');
    }
  };

  const handleSetPortraitOverride = async (assetId: string) => {
    if (!currentCard) return;

    try {
      await api.setPortraitOverride(currentCard.meta.id, assetId);
      await loadAssets();
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

  const toggleSelectAll = () => {
    if (selectedAssets.size === sortedAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(sortedAssets.map(a => a.id)));
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const selectedAssetData = assets.find(a => a.id === selectedAsset);

  if (!currentCard) {
    return (
      <div className="h-full flex items-center justify-center text-dark-muted">
        <p>No card selected</p>
      </div>
    );
  }

  // Render asset thumbnail
  const renderAssetThumbnail = (asset: CardAssetWithDetails, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClasses = {
      sm: 'w-12 h-12',
      md: 'w-24 h-24',
      lg: 'w-32 h-32',
    };

    if (asset.asset.mimetype.startsWith('image/')) {
      return (
        <img
          src={`/api/assets/${asset.asset.id}/thumbnail?size=${size === 'lg' ? 256 : size === 'md' ? 128 : 96}`}
          alt={asset.name}
          className={`${sizeClasses[size]} object-cover rounded`}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = asset.asset.url;
          }}
        />
      );
    } else if (asset.asset.mimetype.startsWith('video/')) {
      return (
        <div className={`${sizeClasses[size]} flex items-center justify-center bg-purple-900/20 rounded`}>
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    } else if (asset.asset.mimetype.startsWith('audio/')) {
      return (
        <div className={`${sizeClasses[size]} flex items-center justify-center bg-green-900/20 rounded`}>
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      );
    } else if (asset.asset.mimetype === 'application/json' || asset.ext === 'json') {
      const bgColor = asset.type === 'lorebook' ? 'bg-amber-900/20' : asset.type === 'workflow' ? 'bg-cyan-900/20' : 'bg-slate-900/20';
      const iconColor = asset.type === 'lorebook' ? 'text-amber-400' : asset.type === 'workflow' ? 'text-cyan-400' : 'text-slate-400';
      return (
        <div className={`${sizeClasses[size]} flex items-center justify-center ${bgColor} rounded`}>
          <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className={`${sizeClasses[size]} flex items-center justify-center bg-dark-bg rounded`}>
          <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      );
    }
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'icon': return 'bg-blue-900/30 text-blue-400';
      case 'background': return 'bg-purple-900/30 text-purple-400';
      case 'emotion': return 'bg-pink-900/30 text-pink-400';
      case 'sound': return 'bg-green-900/30 text-green-400';
      case 'workflow': return 'bg-cyan-900/30 text-cyan-400';
      case 'lorebook': return 'bg-amber-900/30 text-amber-400';
      default: return 'bg-slate-900/30 text-slate-400';
    }
  };

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-80 border-r border-dark-border flex flex-col">
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Assets</h2>
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-dark-bg rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-dark-surface text-white' : 'text-dark-muted hover:text-white'}`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-dark-surface text-white' : 'text-dark-muted hover:text-white'}`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Grid View: Show selected asset preview */}
          {viewMode === 'grid' && selectedAsset && selectedAssetData && (
            <div className="mb-4 p-3 bg-dark-bg rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {renderAssetThumbnail(selectedAssetData, 'md')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{selectedAssetData.name}</div>
                  <div className="text-xs text-dark-muted mt-1">
                    <span className={`px-1.5 py-0.5 rounded ${getTypeBadgeColor(selectedAssetData.type)}`}>
                      {selectedAssetData.type}
                    </span>
                  </div>
                  <div className="text-xs text-dark-muted mt-1">
                    {selectedAssetData.ext.toUpperCase()} • {(selectedAssetData.asset.size / 1024).toFixed(1)} KB
                  </div>
                  {selectedAssetData.asset.width && selectedAssetData.asset.height && (
                    <div className="text-xs text-dark-muted">
                      {selectedAssetData.asset.width} × {selectedAssetData.asset.height}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                    <span>Warning: {assetGraph.validation.errors.length} validation issue(s)</span>
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
                {ASSET_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
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
                accept="image/*,video/*,audio/*,.json"
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

        {/* Asset List (only in list view) */}
        {viewMode === 'list' && (
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
                {sortedAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset.id)}
                    className={`w-full p-3 text-left hover:bg-dark-hover transition-colors ${
                      selectedAsset === asset.id ? 'bg-dark-hover' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded bg-dark-bg overflow-hidden flex-shrink-0">
                        {renderAssetThumbnail(asset, 'sm')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{asset.name}</div>
                        <div className="text-xs text-dark-muted mt-1 flex flex-wrap gap-1">
                          <span className={`px-1.5 py-0.5 rounded ${getTypeBadgeColor(asset.type)}`}>{asset.type}</span>
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
        )}

        {/* Grid view fills remaining space */}
        {viewMode === 'grid' && (
          <div className="flex-1" />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'grid' ? (
          <>
            {/* Grid Toolbar */}
            <div className="p-4 border-b border-dark-border space-y-3">
              {/* Sort Controls */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-dark-muted">Sort by:</span>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="input-field text-sm py-1"
                  >
                    <option value="name">Name</option>
                    <option value="type">Type</option>
                    <option value="ext">Format</option>
                    <option value="createdAt">Date</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1.5 rounded hover:bg-dark-hover"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="btn-secondary text-sm px-3 py-1.5"
                  >
                    {selectedAssets.size === sortedAssets.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedAssets.size > 0 && (
                    <span className="text-sm text-dark-muted">{selectedAssets.size} selected</span>
                  )}
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedAssets.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-dark-bg rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-dark-muted">Change type to:</span>
                    <select
                      value={bulkEditType}
                      onChange={(e) => setBulkEditType(e.target.value)}
                      className="input-field text-sm py-1"
                    >
                      <option value="">Select type...</option>
                      {ASSET_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkChangeType}
                      disabled={!bulkEditType}
                      className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                  <button
                    onClick={handleBulkDelete}
                    className="btn-danger text-sm px-3 py-1.5 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Selected
                  </button>
                </div>
              )}
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="text-center text-dark-muted py-8">Loading assets...</div>
              ) : sortedAssets.length === 0 ? (
                <div className="text-center text-dark-muted py-8">No assets yet. Upload some!</div>
              ) : (
                <div className="grid grid-cols-4 gap-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {sortedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`group relative bg-dark-surface rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-blue-500/50 ${
                        selectedAssets.has(asset.id) ? 'ring-2 ring-blue-500' : ''
                      } ${selectedAsset === asset.id ? 'ring-2 ring-teal-500' : ''}`}
                      onClick={() => setSelectedAsset(asset.id)}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedAssets.has(asset.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleAssetSelection(asset.id);
                          }}
                          className="w-4 h-4 rounded border-dark-border bg-dark-bg/80"
                        />
                      </div>

                      {/* Thumbnail */}
                      <div className="aspect-square bg-dark-bg flex items-center justify-center">
                        {renderAssetThumbnail(asset, 'lg')}
                      </div>

                      {/* Info */}
                      <div className="p-2">
                        <div className="font-medium text-sm truncate" title={asset.name}>
                          {asset.name}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeBadgeColor(asset.type)}`}>
                            {asset.type}
                          </span>
                          <span className="text-xs text-dark-muted">
                            {asset.ext.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* List View Detail Panel */
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
                            {ASSET_TYPES.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
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
                    {(!selectedAssetData.tags || selectedAssetData.tags.length === 0) && (
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
        )}
      </div>
    </div>
  );
}
