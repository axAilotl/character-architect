import { useState, useCallback, useRef } from 'react';
import {
  createBackup,
  restoreBackup,
  previewBackup,
  type BackupPreview,
} from '../../../lib/backup';

export function BackupRestorePanel() {
  const [includeVersions, setIncludeVersions] = useState(true);
  const [includePresets, setIncludePresets] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('merge');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get library stats from store (placeholder - actual implementation may vary)
  const cardCount = 0; // TODO: Get from store/API

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const blob = await createBackup({ includeVersions, includePresets });
      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess('Backup created successfully!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create backup');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setSuccess(null);
    setPreview(null);
    try {
      const p = await previewBackup(file);
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid backup file');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.zip')) {
        handleFileSelect(file);
      } else {
        setError('Please select a valid backup ZIP file');
      }
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleRestore = async () => {
    if (!selectedFile) return;

    // Show confirmation for replace mode
    if (restoreMode === 'replace') {
      const confirmed = window.confirm(
        'Replace mode will DELETE all existing data. This cannot be undone. Continue?'
      );
      if (!confirmed) return;
    }

    setIsRestoring(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await restoreBackup(selectedFile, { mode: restoreMode });
      if (result.success) {
        setSuccess(
          `Restored ${result.imported.cards} cards, ${result.imported.assets} assets, ${result.imported.versions} versions`
        );
        setSelectedFile(null);
        setPreview(null);
        // Refresh the page to reload data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(result.errors.join(', '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Backup & Restore</h3>
        <p className="text-dark-muted">
          Create backups of your character library and restore from previous backups.
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-600 rounded">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-900/20 border border-green-600 rounded">
          <p className="text-sm text-green-200">{success}</p>
        </div>
      )}

      {/* Create Backup Section */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <div>
          <h4 className="font-semibold mb-3">Create Backup</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeVersions}
                onChange={(e) => setIncludeVersions(e.target.checked)}
                className="w-4 h-4 rounded border-dark-border bg-dark-surface text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm">Include version history</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePresets}
                onChange={(e) => setIncludePresets(e.target.checked)}
                className="w-4 h-4 rounded border-dark-border bg-dark-surface text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm">Include LLM presets</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={isCreating}
          className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <span>{isCreating ? 'Creating...' : '📦 Create Backup'}</span>
        </button>

        <div className="pt-3 border-t border-dark-border">
          <p className="text-xs text-dark-muted">
            Library: {cardCount} cards
          </p>
        </div>
      </div>

      {/* Restore from Backup Section */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <div>
          <h4 className="font-semibold mb-3">Restore from Backup</h4>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-dark-border hover:border-blue-500'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".zip"
              onChange={handleFileInputChange}
            />
            <p className="text-sm text-dark-muted">
              Drop backup ZIP here or click to select file
            </p>
            {selectedFile && (
              <p className="text-xs text-blue-400 mt-2">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="border border-dark-border rounded p-4 space-y-3 bg-dark-surface">
            <h5 className="font-medium text-sm">Backup Preview</h5>
            <div className="text-sm space-y-1">
              <p className="text-dark-muted">
                <span className="font-medium">Date:</span> {new Date(preview.manifest.createdAt).toLocaleString()}
              </p>
              <p className="text-dark-muted">
                <span className="font-medium">Mode:</span> {preview.manifest.sourceMode}
              </p>
              <p className="text-dark-muted">
                <span className="font-medium">Cards:</span> {preview.manifest.counts.cards}
              </p>
              <p className="text-dark-muted">
                <span className="font-medium">Assets:</span> {preview.manifest.counts.assets}
              </p>
              <p className="text-dark-muted">
                <span className="font-medium">Versions:</span> {preview.manifest.counts.versions}
              </p>
              <p className="text-dark-muted">
                <span className="font-medium">Size:</span> {(preview.totalSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            {/* Card List (collapsible if many) */}
            {preview.cardNames.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-400 hover:text-blue-300 font-medium">
                  Card List ({preview.cardNames.length})
                </summary>
                <div className="mt-2 p-2 bg-dark-bg rounded max-h-40 overflow-y-auto">
                  <ul className="space-y-1">
                    {preview.cardNames.map((name, idx) => (
                      <li key={idx} className="text-xs text-dark-muted">
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Restore Mode Selection */}
        {preview && (
          <div className="space-y-3">
            <h5 className="font-medium text-sm">Restore Mode</h5>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="restoreMode"
                value="merge"
                checked={restoreMode === 'merge'}
                onChange={() => setRestoreMode('merge')}
                className="w-4 h-4 border-dark-border bg-dark-surface text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm">Merge (keep existing, add new)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="restoreMode"
                value="replace"
                checked={restoreMode === 'replace'}
                onChange={() => setRestoreMode('replace')}
                className="w-4 h-4 border-dark-border bg-dark-surface text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm">Replace all (clear existing data)</span>
            </label>

            {restoreMode === 'replace' && (
              <div className="p-3 bg-amber-900/20 border border-amber-600 rounded">
                <p className="text-sm text-amber-200">
                  <strong>Warning:</strong> Replace mode will delete all existing cards,
                  assets, and settings. This cannot be undone.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Restore Button */}
        {preview && (
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <span>{isRestoring ? 'Restoring...' : '🔄 Restore'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
