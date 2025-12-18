import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settings-store';
import { useCardStore } from '../store/card-store';

/**
 * Hook that automatically creates snapshots at configured intervals
 * when a card is loaded and has unsaved changes.
 * Works in all modes (server API or IndexedDB).
 */
export function useAutoSnapshot() {
  const { autoSnapshot } = useSettingsStore();
  const currentCard = useCardStore((state) => state.currentCard);

  // Track the last snapshot time to ensure minimum interval between snapshots
  const lastSnapshotTime = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing interval when dependencies change
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't set up auto-snapshot if disabled or no card is loaded
    if (!autoSnapshot.enabled || !currentCard?.meta.id) {
      return;
    }

    const intervalMs = autoSnapshot.intervalMinutes * 60 * 1000;

    // Set up the interval
    intervalRef.current = setInterval(async () => {
      // Only create snapshot if:
      // 1. Card is dirty (has changes)
      // 2. Enough time has passed since last snapshot
      const now = Date.now();
      const timeSinceLastSnapshot = now - lastSnapshotTime.current;

      // Get fresh state
      const currentState = useCardStore.getState();

      if (currentState.isDirty && timeSinceLastSnapshot >= intervalMs) {
        try {
          await currentState.createSnapshot(`[Auto] ${new Date().toLocaleString()}`);
          lastSnapshotTime.current = now;
        } catch (err) {
          // Silently fail - auto-snapshots shouldn't interrupt user flow
          console.warn('Auto-snapshot failed:', err);
        }
      }
    }, intervalMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoSnapshot.enabled, autoSnapshot.intervalMinutes, currentCard?.meta.id]);

  // Reset last snapshot time when card changes
  useEffect(() => {
    lastSnapshotTime.current = 0;
  }, [currentCard?.meta.id]);
}
