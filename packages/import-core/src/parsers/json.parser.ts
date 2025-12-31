/**
 * JSON Parser
 *
 * Handles JSON card imports (CCv2, CCv3, lorebooks)
 */

import type { ParsedData, ParsedCharacter } from '../types/index.js';

/**
 * Parse JSON card file
 */
export function parseJSON(file: Buffer | Uint8Array): ParsedData {
  const text = new TextDecoder().decode(file);
  let json: unknown = JSON.parse(text);

  // RisuAI/Realm v1 wrapper: the actual character card lives under `definition`
  if (json && typeof json === 'object' && 'definition' in json) {
    const def = (json as Record<string, unknown>).definition;
    if (def && typeof def === 'object') {
      const spec = (def as Record<string, unknown>).spec;
      if (spec === 'chara_card_v3' || spec === 'chara_card_v2') {
        json = def;
      }
    }
  }

  // Check for character card spec
  if ((json as any).spec === 'chara_card_v3') {
    const card = json as any;
    const character: ParsedCharacter = {
      card: {
        meta: {
          name: card.data?.name || 'Unknown Character',
          spec: 'v3',
          tags: card.data?.tags || [],
          creator: card.data?.creator,
          characterVersion: card.data?.character_version
        },
        data: card
      },
      assets: []
    };

    return {
      characters: [character],
      isCollection: false
    };
  }

  if ((json as any).spec === 'chara_card_v2') {
    const card = json as any;
    const v2Data =
      card.data && typeof card.data === 'object'
        ? (card.data as Record<string, unknown>)
        : (card as Record<string, unknown>);

    const name =
      (typeof v2Data.name === 'string' ? v2Data.name : undefined) ??
      (typeof card.name === 'string' ? card.name : undefined) ??
      'Unknown Character';

    const tags = (
      Array.isArray(v2Data.tags) ? v2Data.tags : Array.isArray(card.tags) ? card.tags : []
    ) as string[];

    const creator =
      (typeof v2Data.creator === 'string' ? v2Data.creator : undefined) ??
      (typeof card.creator === 'string' ? card.creator : undefined);

    const characterVersion =
      (typeof v2Data.character_version === 'string' ? v2Data.character_version : undefined) ??
      (typeof card.character_version === 'string' ? card.character_version : undefined);

    const character: ParsedCharacter = {
      card: {
        meta: {
          name,
          spec: 'v2',
          tags,
          creator,
          characterVersion
        },
        data: card
      },
      assets: []
    };

    return {
      characters: [character],
      isCollection: false
    };
  }

  // Check for standalone lorebook
  if ((json as any).entries || (json as any).name) {
    const lorebook = json as any;
    const character: ParsedCharacter = {
      card: {
        meta: {
          name: lorebook.name || 'Imported Lorebook',
          spec: 'lorebook',
          tags: ['lorebook']
        },
        data: lorebook
      },
      assets: []
    };

    return {
      characters: [character],
      isCollection: false
    };
  }

  // Legacy v2 format (no spec field)
  const card = json as any;
  if (card.name || card.description) {
    const character: ParsedCharacter = {
      card: {
        meta: {
          name: card.name || 'Unknown Character',
          spec: 'v2',
          tags: card.tags || [],
          creator: card.creator
        },
        data: card
      },
      assets: []
    };

    return {
      characters: [character],
      isCollection: false
    };
  }

  throw new Error('Unsupported JSON format - not a recognized character card or lorebook');
}
