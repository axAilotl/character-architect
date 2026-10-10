import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { getDeploymentConfig } from '../../../config/deployment';

export interface LumiverseSettings {
  enabled: boolean;
  baseUrl: string;
  sessionToken: string;
  sessionCookie: string;
}

export function ConnectionsSettingsPanel() {
  const [settings, setSettings] = useState<LumiverseSettings>({
    enabled: false,
    baseUrl: '',
    sessionToken: '',
    sessionCookie: '',
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const hasServer = getDeploymentConfig().mode === 'full';
  useEffect(() => {
    if (hasServer)
      void api.getLumiverseSettings().then((result) => {
        if (result.data) setSettings(result.data.settings);
        else if (result.error) setStatus(result.error);
      });
  }, [hasServer]);
  async function submit(test: boolean) {
    setBusy(true);
    const result = test
      ? await api.testLumiverseConnection(settings)
      : await api.updateLumiverseSettings(settings);
    setStatus(
      result.error ||
        (test ? 'Connected successfully. Save to keep these settings.' : 'Settings saved.')
    );
    setBusy(false);
  }
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Lumiverse</h3>
      <p className="text-dark-muted">
        Send a character and its portrait to your self-hosted Lumiverse instance.
      </p>
      {!hasServer ? (
        <p>
          Direct connections use Architect’s full server mode. Local favorites are available in
          every mode.
        </p>
      ) : (
        <>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            Enable Lumiverse connection
          </label>
          <label className="block">
            Instance URL
            <input
              className="w-full"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              placeholder="http://localhost:7860"
            />
          </label>
          <label className="block">
            Session token
            <input
              className="w-full"
              type="password"
              autoComplete="off"
              value={settings.sessionToken}
              onChange={(e) => setSettings({ ...settings, sessionToken: e.target.value })}
            />
          </label>
          <label className="block">
            Session cookie
            <input
              className="w-full"
              type="password"
              autoComplete="off"
              value={settings.sessionCookie}
              onChange={(e) => setSettings({ ...settings, sessionCookie: e.target.value })}
            />
          </label>
          <p className="text-sm text-dark-muted">
            Use a session bearer token or copy the session cookie from Lumiverse’s browser developer
            tools. Leave both blank for passwordless LAN mode. Replace expired credentials here.
          </p>
          <div className="flex gap-3">
            <button className="btn-secondary" disabled={busy} onClick={() => submit(true)}>
              Test connection
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => submit(false)}>
              Save settings
            </button>
          </div>
        </>
      )}
      <h3 className="text-lg font-semibold">Archive favorites</h3>
      <p className="text-dark-muted">
        Favorites save locally. Send a card from Archive to link it with Architect; subsequent stars
        and unstars sync automatically while Archive is running. No Chub account is needed.
      </p>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
