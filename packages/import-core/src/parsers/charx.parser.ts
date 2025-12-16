/**
 * CHARX Parser
 *
 * Wraps @character-foundry/loader for CHARX card imports
 */

import { parseCard as parseCardLoader } from '@character-foundry/character-foundry/loader';
import type { ParsedData, ParsedCharacter, ParsedAsset } from '../types/index.js';

/**
 * Parse CHARX card file
 */
export function parseCHARX(file: Buffer | Uint8Array): ParsedData {
  // Use the unified loader (same as PNG)
  const result = parseCardLoader(file, { extractAssets: true });

  // Determine actual spec from card data structure
  const actualSpec = (result.card as any).spec;
  const spec = actualSpec === 'chara_card_v3' ? 'v3' : 'v2';

  // Extract character name
  let name = 'Unknown Character';
  const card = result.card as any;
  if (spec === 'v3' && card?.data?.name) {
    name = card.data.name;
  } else if (spec === 'v2' && card?.name) {
    name = card.name;
  }

  // Convert loader assets to ParsedAsset format
  const assets: ParsedAsset[] = result.assets
    .filter(a => !a.isMain) // Filter out main icon
    .map(asset => {
      const ext = asset.ext || 'png';
      const mimetype = getMimeType(ext);
      const buffer = asset.data instanceof Uint8Array ? asset.data : new Uint8Array(asset.data);

      return {
        buffer,
        filename: `${asset.name || 'asset'}.${ext}`,
        mimetype,
        size: buffer.length,
        width: (asset as any).width,
        height: (asset as any).height,
        link: {
          type: asset.type as any,
          name: asset.name || `asset-${ext}`,
          ext,
          order: 0,
          isMain: false,
          tags: asset.tags || []
        }
      };
    });

  // Extract thumbnail (main icon asset)
  let thumbnail: Buffer | Uint8Array | undefined;
  const iconAsset = result.assets.find(a => a.type === 'icon' || a.isMain);
  if (iconAsset) {
    thumbnail = iconAsset.data instanceof Uint8Array ? iconAsset.data : new Uint8Array(iconAsset.data);
  }

  const character: ParsedCharacter = {
    card: {
      meta: {
        name,
        spec,
        tags: [],
        creator: card?.data?.creator || card?.creator,
        characterVersion: card?.data?.character_version
      },
      data: result.card
    },
    thumbnail,
    assets
  };

  return {
    characters: [character],
    isCollection: false
  };
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'wav': return 'audio/wav';
    case 'mp3': return 'audio/mpeg';
    case 'ogg': return 'audio/ogg';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    default: return 'application/octet-stream';
  }
}
