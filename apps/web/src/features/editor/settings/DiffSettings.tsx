/**
 * Diff Module Settings Panel
 *
 * Settings for version comparison and auto-snapshot functionality.
 */

import { useSettingsStore } from '../../../store/settings-store';

export function DiffSettings() {
  const autoSnapshot = useSettingsStore((state) => state.autoSnapshot);
  const setAutoSnapshotEnabled = useSettingsStore((state) => state.setAutoSnapshotEnabled);
  const setAutoSnapshotInterval = useSettingsStore((state) => state.setAutoSnapshotInterval);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Diff & Snapshot Settings</h3>
        <p className="text-dark-muted">
          Configure version comparison and automatic snapshot settings.
        </p>
      </div>

      {/* Auto-Snapshot Settings */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Auto-Snapshot</h4>
        <p className="text-sm text-dark-muted">
          Automatically create version snapshots while editing cards.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoSnapshotEnabledDiff"
            checked={autoSnapshot.enabled}
            onChange={(e) => setAutoSnapshotEnabled(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="autoSnapshotEnabledDiff" className="text-sm font-medium">
            Enable Auto-Snapshot
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Snapshot Interval
          </label>
          <select
            value={autoSnapshot.intervalMinutes}
            onChange={(e) => setAutoSnapshotInterval(parseInt(e.target.value))}
            disabled={!autoSnapshot.enabled}
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 disabled:opacity-50"
          >
            <option value={1}>Every 1 minute</option>
            <option value={5}>Every 5 minutes</option>
            <option value={10}>Every 10 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
          </select>
          <p className="text-xs text-dark-muted mt-1">
            A snapshot will be created automatically at this interval when you have unsaved changes.
          </p>
        </div>

        <div className="p-3 bg-dark-bg rounded border border-dark-border">
          <h5 className="font-medium text-sm mb-2">How Auto-Snapshot Works</h5>
          <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
            <li>Snapshots are only created when you have unsaved changes</li>
            <li>Auto-snapshots are labeled with "[Auto]" in the version history</li>
            <li>You can view and restore auto-snapshots from the Diff tab</li>
            <li>Auto-snapshots do not replace manual snapshots</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
