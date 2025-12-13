/**
 * Federation Settings Panel
 *
 * Configure federation platforms and sync settings.
 * Note: Per-platform cards use local form state with async operations,
 * not AutoForm, since each card manages its own test/connect/disconnect flow.
 */

import { useState, useEffect } from 'react';
import { useFederationStore } from '../lib/federation-store';
import { PLATFORM_INFO, normalizeUrl, platformRequiresApiKey } from '../../../lib/schemas/settings/federation';
import type { PlatformId } from '../lib/types';

function PlatformConfigCard({ platform }: { platform: PlatformId }) {
  const { settings, updatePlatformConfig, testConnection, connectPlatform, disconnectPlatform } =
    useFederationStore();

  const config = settings.platforms[platform];
  const info = PLATFORM_INFO[platform];
  const [url, setUrl] = useState(config?.baseUrl || '');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Sync local state with store state when it changes
  useEffect(() => {
    if (config?.baseUrl !== undefined) {
      setUrl(config.baseUrl);
    }
    if (config?.apiKey !== undefined) {
      setApiKey(config.apiKey);
    }
  }, [config?.baseUrl, config?.apiKey]);

  // Skip editor - it's always enabled
  if (platform === 'editor') return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    // Save normalized URL first
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    updatePlatformConfig(platform, { baseUrl: normalizedUrl, apiKey: apiKey || undefined });

    const result = await testConnection(platform);
    setTestResult(result);
    setTesting(false);
  };

  const handleConnect = async () => {
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    updatePlatformConfig(platform, { baseUrl: normalizedUrl, apiKey: apiKey || undefined });
    await connectPlatform(platform);
  };

  const handleDisconnect = () => {
    disconnectPlatform(platform);
    setTestResult(null);
  };

  return (
    <div className="border border-dark-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{info.name}</h4>
          <p className="text-xs text-dark-muted">{info.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {config?.connected && (
            <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded">
              Connected
            </span>
          )}
          {config?.enabled && !config?.connected && (
            <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded">
              Enabled
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">Base URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={info.placeholder}
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
          />
        </div>

        {platformRequiresApiKey(platform) && (
          <div>
            <label className="block text-sm font-medium mb-1">API Key (optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key..."
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {testResult !== null && (
        <div
          className={`p-2 rounded text-sm ${
            testResult
              ? 'bg-green-900/20 text-green-400 border border-green-800'
              : 'bg-red-900/20 text-red-400 border border-red-800'
          }`}
        >
          {testResult ? 'Connection successful!' : 'Connection failed. Check URL and try again.'}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleTest}
          disabled={!url || testing}
          className="px-3 py-1.5 bg-dark-card border border-dark-border rounded text-sm hover:bg-dark-hover disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        {config?.enabled ? (
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 bg-red-900/30 border border-red-800 rounded text-sm text-red-400 hover:bg-red-900/50"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={!url}
            className="px-3 py-1.5 bg-blue-600 rounded text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

function SyncStatesList() {
  const { syncStates, clearSyncState, refreshSyncStates } = useFederationStore();

  useEffect(() => {
    refreshSyncStates();
  }, [refreshSyncStates]);

  if (syncStates.length === 0) {
    return (
      <p className="text-dark-muted text-sm">No cards have been synced yet.</p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {syncStates.map((state) => (
        <div
          key={state.federatedId}
          className="flex items-center justify-between p-2 bg-dark-card rounded border border-dark-border"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{state.localId}</div>
            <div className="flex items-center gap-2 text-xs text-dark-muted">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  state.status === 'synced'
                    ? 'bg-green-500'
                    : state.status === 'pending'
                    ? 'bg-yellow-500'
                    : state.status === 'conflict'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`}
              />
              <span className="capitalize">{state.status}</span>
              {Object.keys(state.platformIds).length > 0 && (
                <span>
                  - {Object.keys(state.platformIds).join(', ')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => clearSyncState(state.federatedId)}
            className="ml-2 p-1 text-dark-muted hover:text-red-400"
            title="Clear sync state"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export function FederationSettings() {
  const { initialized, initialize, error, isSyncing } = useFederationStore();
  const [activeTab, setActiveTab] = useState<'platforms' | 'sync'>('platforms');

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Federation</h3>
        <p className="text-dark-muted">
          Sync character cards across platforms like SillyTavern, CardsHub, and Character Archive.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded border bg-red-900/20 border-red-700 text-red-100">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-border">
        <button
          onClick={() => setActiveTab('platforms')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'platforms'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-dark-muted hover:text-white'
          }`}
        >
          Platforms
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'sync'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-dark-muted hover:text-white'
          }`}
        >
          Sync Status
        </button>
      </div>

      {/* Platforms Tab */}
      {activeTab === 'platforms' && (
        <div className="space-y-4">
          <PlatformConfigCard platform="sillytavern" />
          <PlatformConfigCard platform="hub" />
          <PlatformConfigCard platform="archive" />

          <div className="border border-dark-border rounded-lg p-4">
            <h4 className="font-medium mb-2">How Federation Works</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-dark-muted">
              <li>Connect one or more platforms above</li>
              <li>Open a character card in the editor</li>
              <li>Use the "Sync" button in the header to push to connected platforms</li>
              <li>Cards are tracked across platforms and conflicts are detected</li>
            </ol>
          </div>
        </div>
      )}

      {/* Sync Status Tab */}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Synced Cards</h4>
            {isSyncing && (
              <span className="text-sm text-blue-400">Syncing...</span>
            )}
          </div>
          <SyncStatesList />
        </div>
      )}
    </div>
  );
}
