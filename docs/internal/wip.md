# Federation WIP - What Still Needs To Be Done

## Current State

Federation is partially implemented:
- Server endpoints exist at `/api/federation/*`
- Client adapters exist for ST, AR, HUB
- LocalEditorAdapter works in both light/full modes
- Badges show sync state on cards
- Push to ST works (federation-first, fallback to direct)

## What's Working

- [x] Federation API endpoints on Card Architect server
- [x] LocalEditorAdapter dual-mode (IndexedDB vs API)
- [x] recordManualSync for manual pushes
- [x] pollPlatformSyncState to refresh sync states
- [x] ST/AR/HUB badges on cards
- [x] Federation-first push to SillyTavern

## What's NOT Working / Needs Implementation

### Critical

1. **Pull from Platforms**
   - Currently only PUSH is implemented
   - Need UI buttons to pull cards FROM ST/AR/HUB
   - Need to handle incoming cards (create local, merge, etc.)
   - File: `Header.tsx` or new PullPanel component

2. **Bi-directional Sync**
   - SyncEngine from @character-foundry/federation is imported but NOT USED
   - Need to actually wire up SyncEngine for proper bi-directional sync
   - File: `federation-store.ts`

3. **Push to AR/HUB**
   - Header only has ST push button
   - Need push buttons for Archive and CardsHub
   - Or a unified "Sync" dropdown

4. **Conflict Resolution**
   - What happens when same card edited on multiple platforms?
   - Currently no conflict detection or resolution
   - Need UI for user to choose which version to keep

### Important

5. **Periodic Polling**
   - Currently only polls on CardGrid mount
   - Should poll periodically (every 30s? 1min?)
   - Or use WebSocket for real-time updates

6. **Asset Sync**
   - Assets endpoint exists but not wired up
   - Need to sync character images, expression packs, etc.
   - File: `adapters.ts`, `federation-store.ts`

7. **Delete Propagation**
   - When card deleted locally, should notify federated platforms
   - When card deleted on platform, should update local state
   - Currently neither works

8. **Error Handling**
   - Network failures need retry logic
   - Need user-visible error messages
   - Need offline queue for pending syncs

### Nice to Have

9. **Sync History**
   - Show when each card was last synced
   - Show sync direction (push/pull)
   - File: New SyncHistory component

10. **Selective Sync**
    - Let user choose which cards to sync
    - Don't auto-sync everything
    - Per-card sync settings

11. **Sync Status Indicator**
    - Show overall sync status in header
    - "Syncing...", "All synced", "3 pending"
    - Show when last full sync happened

12. **Federation Settings UI**
    - Currently settings are probably broken
    - Need proper UI for:
      - Enable/disable per platform
      - Set base URLs
      - API keys for AR/HUB
      - Test connection button

## Files That Need Work

| File | What's Needed |
|------|---------------|
| `Header.tsx` | Pull buttons, sync dropdown, status indicator |
| `federation-store.ts` | Use SyncEngine, add pull methods, periodic poll |
| `CardGrid.tsx` | More sync actions on cards, sync indicators |
| `FederationSettings.tsx` | Full settings UI with connection tests |
| `adapters.ts` | Asset sync implementation |
| `api/federation.ts` | Asset upload endpoint, WebSocket support |

## Test Plan

1. Start Card Architect full mode
2. Connect to SillyTavern (with CForge plugin)
3. Create card in CA, push to ST
4. Verify card appears in ST
5. Edit card in ST, poll from CA
6. Verify changes appear in CA
7. Delete card in ST, poll from CA
8. Verify card shows as deleted/removed

## Known Bugs

- Polling may not work if platform returns different card structure
- Name matching is fragile (case-sensitive, exact match)
- Sync state stored in IndexedDB even in full mode (should be server-side?)
- federatedId generation may not be unique enough

## Architecture Questions

1. Should sync state live on server or client?
   - Currently: Client (IndexedDB)
   - Maybe: Server for persistence across devices

2. Should we use SyncEngine or keep manual sync?
   - SyncEngine handles conflicts, ordering, etc.
   - But adds complexity

3. How to handle large card collections?
   - Pagination in outbox
   - Incremental sync (since parameter)
   - Currently: Fetch everything every time

## Priority Order

1. Push to AR/HUB (easy, just copy ST pattern)
2. Pull from all platforms (medium, needs UI)
3. Use SyncEngine (hard, needs architecture changes)
4. Periodic polling (easy, just setInterval)
5. Asset sync (medium)
6. Everything else (as needed)
