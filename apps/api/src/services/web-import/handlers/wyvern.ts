/**
 * Wyvern Site Handler
 *
 * Imports character cards from app.wyvern.chat
 *
 * ## How It Works
 * Wyvern builds the PNG client-side using their own export logic.
 * The userscript hooks URL.createObjectURL to intercept the blob
 * when the user clicks the download button.
 *
 * ## Data Flow
 * 1. Userscript intercepts PNG blob from Wyvern's export
 * 2. Userscript fetches gallery images via Wyvern's image proxy
 * 3. Both PNG and gallery data sent to Card Architect
 * 4. Server extracts card data from PNG tEXt chunk
 * 5. Server fetches sprite data from public API
 *
 * ## Gallery Images
 * Wyvern gallery images must be fetched client-side via their image proxy:
 * https://app.wyvern.chat/api/image-proxy?url={encodedUrl}
 *
 * The userscript sends gallery images as base64 in clientData.
 */

import type { SiteHandler, FetchedCard, AssetToImport } from '../types.js';
import { APP_USER_AGENT } from '../constants.js';
import { extractFromPNG } from '../../../utils/file-handlers.js';

export const wyvernHandler: SiteHandler = {
  id: 'wyvern',
  name: 'Wyvern',
  patterns: [/^https?:\/\/(www\.)?app\.wyvern\.chat\/characters\/([^\/\?#]+)/],

  fetchCard: async (
    _url: string,
    match: RegExpMatchArray,
    clientPngData?: string,
    clientData?: unknown
  ): Promise<FetchedCard> => {
    const characterId = match[2];
    const warnings: string[] = [];
    const assets: AssetToImport[] = [];

    // Client must provide PNG data (intercepted from Wyvern's export)
    if (!clientPngData) {
      throw new Error('WYVERN_NEEDS_CLIENT_PNG');
    }

    // Decode base64 PNG
    const base64Part = clientPngData.includes(',')
      ? clientPngData.split(',')[1]
      : clientPngData;
    const pngBuffer = Buffer.from(base64Part, 'base64');
    console.log(`Wyvern PNG: ${pngBuffer.length} bytes`);

    // Extract card data from PNG tEXt chunk
    const extracted = await extractFromPNG(pngBuffer);
    if (!extracted) {
      throw new Error('Could not extract card data from Wyvern PNG');
    }

    console.log(
      `Wyvern card extracted, name: ${
        (extracted.data as any)?.data?.name || (extracted.data as any)?.name
      }`
    );

    // Fetch sprites from public API
    const apiUrl = `https://api.wyvern.chat/characters/${characterId}`;
    try {
      const apiResponse = await fetch(apiUrl, {
        headers: { 'User-Agent': APP_USER_AGENT },
      });

      if (apiResponse.ok) {
        const apiData = (await apiResponse.json()) as Record<string, any>;

        if (apiData.sprite_set?.sprites) {
          for (const sprite of apiData.sprite_set.sprites) {
            if (sprite.emotion && sprite.url) {
              assets.push({
                type: 'emotion',
                name: sprite.emotion,
                url: sprite.url,
              });
            }
          }
        }
      }
    } catch (err) {
      warnings.push(`Could not fetch sprite data: ${err}`);
    }

    // Handle gallery images from client (fetched via proxy)
    // clientData: { galleryImages: [{ type, title, base64 }] }
    const wyvernClientData = clientData as
      | { galleryImages?: Array<{ type: string; title: string; base64: string }> }
      | undefined;

    if (
      wyvernClientData?.galleryImages &&
      Array.isArray(wyvernClientData.galleryImages)
    ) {
      for (const img of wyvernClientData.galleryImages) {
        if (!img.base64) continue;

        // Map Wyvern types to CCv3 asset types
        const typeMap: Record<string, 'icon' | 'background' | 'custom'> = {
          avatar: 'icon',
          background: 'background',
          other: 'custom',
        };
        const assetType = typeMap[img.type] || 'custom';

        assets.push({
          type: assetType,
          name: img.title || `gallery_${assetType}`,
          url: '', // No URL needed, we have base64 data
          base64Data: img.base64,
          isMain: assetType === 'icon', // Avatar becomes main icon
        });
      }
      console.log(
        `Wyvern gallery: ${wyvernClientData.galleryImages.length} images received`
      );
    }

    return {
      cardData: extracted.data,
      spec: extracted.spec,
      pngBuffer,
      assets,
      warnings,
      meta: { characterId, source: 'wyvern' },
    };
  },
};
