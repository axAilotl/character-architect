/**
 * Background Upload Widget
 *
 * Image upload widget with preview for background images.
 */

import { useState } from 'react';
import type { FieldWidgetProps } from '@character-foundry/app-framework';
import { getDeploymentConfig } from '../../../config/deployment';

export function BackgroundUpload({
  value,
  onChange,
  name,
  hint,
}: FieldWidgetProps<string>) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = getDeploymentConfig();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      if (config.mode === 'light' || config.mode === 'static') {
        // Light mode: convert to data URL and store
        const reader = new FileReader();
        reader.onload = (event) => {
          onChange(event.target?.result as string);
          setUploading(false);
        };
        reader.onerror = () => {
          setError('Failed to read file');
          setUploading(false);
        };
        reader.readAsDataURL(file);
      } else {
        // Full mode: upload to server
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/settings/theme/background', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        const result = await response.json();
        onChange(result.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    // If it's a server URL, try to delete the file
    if (value.startsWith('/api/settings/theme/images/')) {
      const filename = value.split('/').pop();
      if (filename) {
        try {
          await fetch(`/api/settings/theme/images/${filename}`, { method: 'DELETE' });
        } catch {
          // Ignore delete errors, still clear the value
        }
      }
    }
    onChange('');
  };

  return (
    <div className={hint?.className} data-field={name}>
      {hint?.label && (
        <label className="block text-sm font-medium mb-2">{hint.label}</label>
      )}
      {hint?.helperText && (
        <p className="text-sm text-dark-muted mb-3">{hint.helperText}</p>
      )}

      <div className="space-y-3">
        {/* Preview */}
        {value && (
          <div className="relative">
            <img
              src={value}
              alt="Background preview"
              className="w-full h-32 object-cover rounded-lg border border-dark-border"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
          </div>
        )}

        {/* Upload input */}
        <div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={uploading}
            className="w-full text-sm text-dark-text file:mr-3 file:rounded file:border-0 file:px-3 file:py-2 file:bg-blue-600 file:text-white file:cursor-pointer disabled:opacity-50"
          />
        </div>

        {/* Status */}
        {uploading && (
          <p className="text-sm text-blue-400">Uploading...</p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
