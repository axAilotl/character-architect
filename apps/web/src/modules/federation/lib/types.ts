/**
 * Federation Types
 *
 * Re-export types from @character-foundry/federation package.
 */

// Re-export all types from the federation package
export type {
  FederatedCardId,
  PlatformId,
  FederatedActor,
  FederatedCard,
  ActivityType,
  FederatedActivity,
  CardSyncState,
  SyncOperation,
  SyncResult,
  PlatformAdapter,
  FederationConfig,
  SyncStateStore,
  FederationEventType,
  FederationEvent,
  FederationEventListener,
} from '@character-foundry/character-foundry/federation';

// Re-export adapter types
export type {
  AdapterCard,
  AdapterAsset,
  HttpAdapterConfig,
  FetchFn,
  SillyTavernBridge,
  STCharacter,
} from '@character-foundry/character-foundry/federation';

/**
 * Platform configuration stored in settings
 */
export interface PlatformConfig {
  id: PlatformId;
  name: string;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  connected: boolean;
  lastChecked?: string;
}

/**
 * Federation settings stored in localStorage
 */
export interface FederationSettings {
  platforms: Record<PlatformId, Partial<PlatformConfig>>;
  autoSync: boolean;
  syncIntervalMinutes: number;
}

// Import PlatformId for the type above
import type { PlatformId } from '@character-foundry/character-foundry/federation';
