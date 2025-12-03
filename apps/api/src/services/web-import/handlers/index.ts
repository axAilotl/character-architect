/**
 * Web Import Handlers - Registry
 *
 * This file exports all site handlers and provides a lookup function.
 *
 * ## Adding a New Site Handler
 *
 * 1. Create a new file in this directory (e.g., `mysite.ts`)
 * 2. Implement the SiteHandler interface:
 *    ```typescript
 *    import type { SiteHandler, FetchedCard, AssetToImport } from '../types.js';
 *    import { BROWSER_USER_AGENT } from '../constants.js';
 *
 *    export const mySiteHandler: SiteHandler = {
 *      id: 'mysite',
 *      name: 'My Site',
 *      patterns: [/^https?:\/\/(www\.)?mysite\.com\/characters\/([^\/]+)/],
 *      fetchCard: async (url, match, clientPngData, clientData) => {
 *        // Implementation
 *      },
 *    };
 *    ```
 * 3. Import and add it to SITE_HANDLERS array below
 * 4. Add @match pattern to userscript in userscript.ts
 * 5. Add site detection in userscript's detectSite() function
 * 6. Update CLAUDE.md documentation
 */

import type { SiteHandler } from '../types.js';

// Import individual handlers
import { chubHandler } from './chub.js';
import { wyvernHandler } from './wyvern.js';
import { characterTavernHandler } from './character-tavern.js';
import { risuRealmHandler } from './risu-realm.js';

/**
 * All registered site handlers
 * Order matters - first matching pattern wins
 */
export const SITE_HANDLERS: SiteHandler[] = [
  chubHandler,
  wyvernHandler,
  characterTavernHandler,
  risuRealmHandler,
];

/**
 * Find a handler that matches the given URL
 *
 * @param url - URL to match against handler patterns
 * @returns Handler and match result, or null if no match
 */
export function findSiteHandler(
  url: string
): { handler: SiteHandler; match: RegExpMatchArray } | null {
  for (const handler of SITE_HANDLERS) {
    for (const pattern of handler.patterns) {
      const match = url.match(pattern);
      if (match) {
        return { handler, match };
      }
    }
  }
  return null;
}

/**
 * Get all handlers for listing supported sites
 */
export function getSiteList(): Array<{ id: string; name: string; patterns: string[] }> {
  return SITE_HANDLERS.map((h) => ({
    id: h.id,
    name: h.name,
    patterns: h.patterns.map((p) => p.source),
  }));
}
