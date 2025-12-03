/**
 * Character Tavern Site Handler
 *
 * Imports character cards from character-tavern.com
 *
 * ## How It Works
 * Character Tavern provides direct PNG downloads with embedded card data.
 * The PNG is at: https://cards.character-tavern.com/{creator}/{slug}.png?action=download
 *
 * ## Format
 * Character Tavern exports CCv3 format with both 'chara' and 'ccv3' tEXt chunks.
 *
 * ## Known Quirks
 * - Timestamps are in milliseconds (fixed in normalizeCardData)
 */

import type { SiteHandler, FetchedCard } from '../types.js';
import { APP_USER_AGENT } from '../constants.js';
import { extractFromPNG } from '../../../utils/file-handlers.js';

export const characterTavernHandler: SiteHandler = {
  id: 'character-tavern',
  name: 'Character Tavern',
  patterns: [
    /^https?:\/\/(www\.)?character-tavern\.com\/character\/([^\/]+)\/([^\/\?#]+)/,
  ],

  fetchCard: async (
    _url: string,
    match: RegExpMatchArray
  ): Promise<FetchedCard> => {
    const creator = match[2];
    const slug = match[3];
    const warnings: string[] = [];

    // Download PNG directly from cards subdomain
    const pngUrl = `https://cards.character-tavern.com/${creator}/${slug}.png?action=download`;
    const pngResponse = await fetch(pngUrl, {
      headers: { 'User-Agent': APP_USER_AGENT },
    });

    if (!pngResponse.ok) {
      throw new Error(`Character Tavern returned ${pngResponse.status}`);
    }

    const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());

    // Extract card from PNG tEXt chunk
    const extracted = await extractFromPNG(pngBuffer);
    if (!extracted) {
      throw new Error('No card data found in PNG');
    }

    return {
      cardData: extracted.data,
      spec: extracted.spec,
      pngBuffer,
      assets: [], // Character Tavern doesn't provide separate assets
      warnings,
      meta: { creator, slug, source: 'character-tavern' },
    };
  },
};
