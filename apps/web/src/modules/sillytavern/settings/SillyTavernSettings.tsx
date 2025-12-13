/**
 * SillyTavern Settings Panel
 *
 * Configure SillyTavern push integration.
 */

import { useState, useEffect } from 'react';
import { AutoForm } from '@character-foundry/app-framework';
import { api } from '../../../lib/api';
import { getDeploymentConfig } from '../../../config/deployment';
import {
  sillyTavernSettingsSchema,
  sillyTavernSettingsUiHints,
  type SillyTavernSettings as SillyTavernSettingsType,
} from '../../../lib/schemas/settings/sillytavern';

export function SillyTavernSettings() {
  const [values, setValues] = useState<SillyTavernSettingsType>({
    enabled: false,
    baseUrl: '',
    importEndpoint: '/api/characters/import',
    sessionCookie: '',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const config = getDeploymentConfig();
  const isLightMode = config.mode === 'light' || config.mode === 'static';

  useEffect(() => {
    const loadSettings = async () => {
      if (isLightMode) {
        try {
          const stored = localStorage.getItem('ca-sillytavern-settings');
          if (stored) {
            const s = JSON.parse(stored);
            setValues({
              enabled: s.enabled ?? false,
              baseUrl: s.baseUrl ?? '',
              importEndpoint: s.importEndpoint ?? '/api/characters/import',
              sessionCookie: s.sessionCookie ?? '',
            });
          }
        } catch {
          // Ignore parse errors
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await api.getSillyTavernSettings();
      setLoading(false);

      if (result.data?.settings) {
        const s = result.data.settings;
        setValues({
          enabled: s.enabled ?? false,
          baseUrl: s.baseUrl ?? '',
          importEndpoint: s.importEndpoint ?? '/api/characters/import',
          sessionCookie: s.sessionCookie ?? '',
        });
      }
    };

    loadSettings();
  }, [isLightMode]);

  const handleSave = async () => {
    setLoading(true);
    setStatus(null);

    if (isLightMode) {
      try {
        localStorage.setItem('ca-sillytavern-settings', JSON.stringify(values));
        setStatus('Settings saved successfully!');
      } catch {
        setStatus('Failed to save settings.');
      }
      setLoading(false);
      return;
    }

    const result = await api.updateSillyTavernSettings(values);
    setLoading(false);

    if (result.error) {
      setStatus(`Failed to save: ${result.error}`);
    } else {
      setStatus('Settings saved successfully!');
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

      {status && (
        <div className={`p-3 rounded border ${
          status.includes('success') || status.includes('saved')
            ? 'bg-green-900/20 border-green-700 text-green-100'
            : 'bg-red-900/30 border-red-700 text-red-100'
        }`}>
          {status}
        </div>
      )}

      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <AutoForm
          schema={sillyTavernSettingsSchema}
          values={values}
          onChange={(updated: SillyTavernSettingsType) => {
            // Only update if values actually changed to prevent infinite loops
            if (
              updated.enabled !== values.enabled ||
              updated.baseUrl !== values.baseUrl ||
              updated.importEndpoint !== values.importEndpoint ||
              updated.sessionCookie !== values.sessionCookie
            ) {
              setValues(updated);
            }
          }}
          uiHints={sillyTavernSettingsUiHints}
        />

        <div className="pt-4 border-t border-dark-border">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="border border-dark-border rounded-lg p-6">
        <h4 className="font-semibold mb-3">How to Use</h4>
        <ol className="list-decimal list-inside space-y-2 text-sm text-dark-muted">
          <li>Enable the integration and configure your SillyTavern base URL above</li>
          <li>Click "Save Settings" to apply the configuration</li>
          <li>Open a character card in the editor</li>
          <li>Click the "-&gt; SillyTavern" button in the header - the card will be automatically converted to PNG and pushed</li>
        </ol>
      </div>
    </div>
  );
}
