import type { Card, CCv2Data } from './types';
import type { CCv3DataInner, CCv2Wrapped } from '@character-foundry/character-foundry/schemas';
import { isV3Card as isV3CardData, isWrappedV2 as isWrappedV2Data } from '@character-foundry/character-foundry/schemas';

/**
 * Extract actual card data fields from card.data, handling both wrapped and unwrapped formats
 * V2 can be: { spec, spec_version, data: {...} } or just {...}
 * V3 is always: { spec, spec_version, data: {...} }
 * Lorebook and Collection cards use V3 structure internally
 */
export function extractCardData(card: Card): CCv2Data | CCv3DataInner {
  const data = card.data;

  // Check if data has V3 wrapper structure (spec: 'chara_card_v3' with nested data)
  if (isV3CardData(data)) {
    return data.data;
  }

  // Check if data has V2 wrapper structure
  if (isWrappedV2Data(data)) {
    return (data as CCv2Wrapped).data;
  }

  // Unwrapped/legacy format - return as-is with fallback
  return (data as CCv2Data) || ({ name: 'Unknown' } as CCv2Data);
}
