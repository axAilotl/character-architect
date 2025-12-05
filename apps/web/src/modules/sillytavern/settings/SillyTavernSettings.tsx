/**
 * SillyTavern Settings Panel
 *
 * Configure SillyTavern push integration.
 */

import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { getDeploymentConfig } from '../../../config/deployment';

export function SillyTavernSettings() {
  const [stEnabled, setStEnabled] = useState(false);
  const [stBaseUrl, setStBaseUrl] = useState('');
  const [stImportEndpoint, setStImportEndpoint] = useState('/api/characters/import');
  const [stSessionCookie, setStSessionCookie] = useState('');
  const [stStatus, setStStatus] = useState<string | null>(null);
  const [stLoading, setStLoading] = useState(false);

  const config = getDeploymentConfig();
  const isLightMode = config.mode === 'light' || config.mode === 'static';

  useEffect(() => {
    const loadStSettings = async () => {
      if (isLightMode) {
        // Light mode: load from localStorage
        try {
          const stored = localStorage.getItem('ca-sillytavern-settings');
          if (stored) {
            const s = JSON.parse(stored);
            setStEnabled(s.enabled ?? false);
            setStBaseUrl(s.baseUrl ?? '');
            setStImportEndpoint(s.importEndpoint ?? '/api/characters/import');
            setStSessionCookie(s.sessionCookie ?? '');
          }
        } catch {
          // Ignore parse errors
        }
        setStLoading(false);
        return;
      }

      setStLoading(true);
      const result = await api.getSillyTavernSettings();
      setStLoading(false);

      if (result.data?.settings) {
        const s = result.data.settings;
        setStEnabled(s.enabled ?? false);
        setStBaseUrl(s.baseUrl ?? '');
        setStImportEndpoint(s.importEndpoint ?? '/api/characters/import');
        setStSessionCookie(s.sessionCookie ?? '');
      }
    };

    loadStSettings();
  }, [isLightMode]);

  const handleSave = async () => {
    setStLoading(true);
    setStStatus(null);

    const settings = {
      enabled: stEnabled,
      baseUrl: stBaseUrl,
      importEndpoint: stImportEndpoint,
      sessionCookie: stSessionCookie,
    };

    if (isLightMode) {
      // Light mode: save to localStorage
      try {
        localStorage.setItem('ca-sillytavern-settings', JSON.stringify(settings));
        setStStatus('Settings saved successfully!');
      } catch {
        setStStatus('Failed to save settings.');
      }
      setStLoading(false);
      return;
    }

    const result = await api.updateSillyTavernSettings(settings);
    setStLoading(false);

    if (result.error) {
      setStStatus(`Failed to save: ${result.error}`);
    } else {
      setStStatus('Settings saved successfully!');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">SillyTavern Integration</h3>
        <p className="text-dark-muted">
          Configure push integration to send character cards directly to your SillyTavern instance.
        </p>
      </div>

      {stStatus && (
        <div className={`p-3 rounded border ${
          stStatus.includes('success') || stStatus.includes('saved')
            ? 'bg-green-900/20 border-green-700 text-green-100'
            : 'bg-red-900/30 border-red-700 text-red-100'
        }`}>
          {stStatus}
        </div>
      )}

      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="stEnabled"
            checked={stEnabled}
            onChange={(e) => setStEnabled(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="stEnabled" className="text-sm font-medium">
            Enable SillyTavern Push Integration
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            SillyTavern Base URL *
          </label>
          <input
            type="text"
            value={stBaseUrl}
            onChange={(e) => setStBaseUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            disabled={!stEnabled}
          />
          <p className="text-xs text-dark-muted mt-1">
            The base URL of your SillyTavern instance (e.g., http://localhost:8000)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Import Endpoint
          </label>
          <input
            type="text"
            value={stImportEndpoint}
            onChange={(e) => setStImportEndpoint(e.target.value)}
            placeholder="/api/characters/import"
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            disabled={!stEnabled}
          />
          <p className="text-xs text-dark-muted mt-1">
            Usually /api/characters/import (default)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Session Cookie (Optional)
          </label>
          <textarea
            value={stSessionCookie}
            onChange={(e) => setStSessionCookie(e.target.value)}
            placeholder="connect.sid=..."
            rows={3}
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-xs resize-none"
            disabled={!stEnabled}
          />
          <p className="text-xs text-dark-muted mt-1">
            Optional session cookie for authentication. Usually not needed for local instances.
          </p>
        </div>

        <div className="pt-4 border-t border-dark-border">
          <button
            onClick={handleSave}
            disabled={stLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {stLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="border border-dark-border rounded-lg p-6">
        <h4 className="font-semibold mb-3">How to Use</h4>
        <ol className="list-decimal list-inside space-y-2 text-sm text-dark-muted">
          <li>Enable the integration and configure your SillyTavern base URL above</li>
          <li>Click "Save Settings" to apply the configuration</li>
          <li>Open a character card in the editor</li>
          <li>Click the "→ SillyTavern" button in the header - the card will be automatically converted to PNG and pushed</li>
        </ol>
      </div>
    </div>
  );
}
