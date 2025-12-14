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
 * ## Data Flow (100% client-fetched)
 * 1. Userscript intercepts PNG blob from Wyvern's export
 * 2. Userscript fetches gallery images via Wyvern's image proxy
 * 3. Userscript fetches emotion sprites via Wyvern's image proxy
 * 4. All data sent to Character Architect as base64
 * 5. Server just extracts card data from PNG tEXt chunk
 *
 * ## Why Client-Side?
 * - Wyvern's API has no CORS headers
 * - But userscript runs on Wyvern's domain, so no CORS issue
 * - Uses their image proxy: https://app.wyvern.chat/api/image-proxy?url={encodedUrl}
 *
 * ## clientData Structure
 * {
 *   galleryImages: [{ type, title, base64 }],
 *   sprites: [{ emotion, base64 }]
 * }
 */

import type { SiteHandler, FetchedCard, AssetToImport } from '../types.js';
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

    // Handle assets from client (fetched via Wyvern's image proxy)
    // clientData: { galleryImages: [...], sprites: [...] }
    const wyvernClientData = clientData as
      | {
          galleryImages?: Array<{ type: string; title: string; base64: string }>;
          sprites?: Array<{ emotion: string; base64: string }>;
        }
      | undefined;

    // Handle sprites from client
    if (wyvernClientData?.sprites && Array.isArray(wyvernClientData.sprites)) {
      for (const sprite of wyvernClientData.sprites) {
        if (!sprite.base64 || !sprite.emotion) continue;

        assets.push({
          type: 'emotion',
          name: sprite.emotion,
          url: '',
          base64Data: sprite.base64,
        });
      }
      console.log(`Wyvern sprites: ${wyvernClientData.sprites.length} received from client`);
    }

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
