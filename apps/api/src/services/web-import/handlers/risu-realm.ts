/**
 * Risu Realm Site Handler
 *
 * Imports character cards from realm.risuai.net
 *
 * ## Formats Supported
 * - CHARX (preferred): ZIP-based CCv3 with embedded assets
 * - PNG: Standard character card PNG with embedded data
 *
 * ## How It Works
 * 1. Try CHARX first (more data, includes assets)
 * 2. Fall back to PNG if CHARX unavailable
 *
 * ## URLs
 * - CHARX: https://realm.risuai.net/api/v1/download/charx-v3/{uuid}
 * - PNG: https://realm.risuai.net/api/v1/download/png-v3/{uuid}
 */

import type { SiteHandler, FetchedCard } from '../types.js';
import { APP_USER_AGENT } from '../constants.js';
import { extractFromPNG } from '../../../utils/file-handlers.js';

export const risuRealmHandler: SiteHandler = {
  id: 'risu',
  name: 'Risu Realm',
  patterns: [/^https?:\/\/(www\.)?realm\.risuai\.net\/character\/([^\/\?#]+)/],

  fetchCard: async (
    url: string,
    match: RegExpMatchArray
  ): Promise<FetchedCard> => {
    const uuid = match[2];
    const warnings: string[] = [];

    // Check for format hint in URL query
    const urlObj = new URL(url);
    const formatHint = urlObj.searchParams.get('format');

    // Try CHARX first (it has more data, including embedded assets)
    if (formatHint !== 'png') {
      try {
        const charxUrl = `https://realm.risuai.net/api/v1/download/charx-v3/${uuid}`;
        const charxResponse = await fetch(charxUrl, {
          headers: { 'User-Agent': APP_USER_AGENT },
        });

        if (charxResponse.ok) {
          const charxBuffer = Buffer.from(await charxResponse.arrayBuffer());
          return {
            charxBuffer,
            assets: [], // Assets are embedded in CHARX
            warnings,
            meta: { uuid, source: 'risu-realm', format: 'charx' },
          };
        }
      } catch (err) {
        warnings.push(`CharX download failed, trying PNG: ${err}`);
      }
    }

    // Try PNG format as fallback
    const pngUrl = `https://realm.risuai.net/api/v1/download/png-v3/${uuid}`;
    const pngResponse = await fetch(pngUrl, {
      headers: { 'User-Agent': APP_USER_AGENT },
    });

    if (!pngResponse.ok) {
      throw new Error(`Risu Realm returned ${pngResponse.status}`);
    }

    const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());

    // Extract card from PNG (may have embedded base64 assets)
    const extracted = await extractFromPNG(pngBuffer);
    if (!extracted) {
      throw new Error('No card data found in PNG');
    }

    return {
      cardData: extracted.data,
      spec: extracted.spec,
      pngBuffer,
      assets: [],
      warnings,
      meta: { uuid, source: 'risu-realm', format: 'png' },
    };
  },
};
