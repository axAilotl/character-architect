import type { Card, CCv2Data, CCv3Data } from '@card-architect/schemas';

/**
 * Extract actual card data fields from card.data, handling both wrapped and unwrapped formats
 * V2 can be: { spec, spec_version, data: {...} } or just {...}
 * V3 is always: { spec, spec_version, data: {...} }
 */
export function extractCardData(card: Card): CCv2Data | CCv3Data['data'] {
  const isV3 = card.meta.spec === 'v3';

  if (isV3) {
    return (card.data as CCv3Data).data;
  }

  // V2 can be wrapped or unwrapped
  const data = card.data as any;
  if (data.spec === 'chara_card_v2' && 'data' in data) {
    // Wrapped V2
    return data.data as CCv2Data;
  }

  // Unwrapped/legacy V2
  return data as CCv2Data;
}
