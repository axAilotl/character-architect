/**
 * Persistence Adapter
 *
 * Factory and singleton for the persistence adapter.
 * Automatically selects ServerAdapter or LocalAdapter based on deployment mode.
 *
 * Usage:
 * ```typescript
 * import { persistence } from '@/adapters/persistence';
 *
 * // All operations are async and mode-agnostic
 * const cards = await persistence.listCards();
 * const card = await persistence.getCard(id);
 * await persistence.saveCard(card);
 * ```
 */

import { getDeploymentConfig } from '../../config/deployment';
import { ServerPersistenceAdapter } from './server-adapter';
import { LocalPersistenceAdapter } from './local-adapter';
import type { PersistenceAdapter } from './types';

// Re-export types
export type {
  PersistenceAdapter,
  CardListItem,
  AssetSaveOptions,
  AssetUpdateOptions,
  Version,
  ImageType,
  PersistenceResult,
} from './types';

// Re-export adapter classes for testing
export { ServerPersistenceAdapter } from './server-adapter';
export { LocalPersistenceAdapter } from './local-adapter';

/**
 * Create the appropriate persistence adapter based on deployment mode
 */
export function createPersistenceAdapter(): PersistenceAdapter {
  const config = getDeploymentConfig();

  if (config.mode === 'light' || config.mode === 'static') {
    return new LocalPersistenceAdapter();
  }

  return new ServerPersistenceAdapter();
}

/**
 * Singleton persistence adapter instance
 *
 * This is the primary export - use this for all persistence operations.
 * The adapter is created once when the module loads and shared across the app.
 */
export const persistence = createPersistenceAdapter();

/**
 * Check if current adapter uses local storage
 */
export function isLocalPersistence(): boolean {
  return persistence.mode === 'local';
}

/**
 * Check if current adapter uses server API
 */
export function isServerPersistence(): boolean {
  return persistence.mode === 'server';
}

/**
 * Hook for React components to access persistence
 * Can be used to ensure consistent access pattern
 *
 * Usage:
 * ```typescript
 * import { usePersistence } from '@/adapters/persistence';
 *
 * function MyComponent() {
 *   const persistence = usePersistence();
 *   // ...
 * }
 * ```
 */
export function usePersistence(): PersistenceAdapter {
  return persistence;
}
