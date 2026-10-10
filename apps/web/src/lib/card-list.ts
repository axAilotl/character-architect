import type { Card } from './types';
import { extractCardData } from './card-utils';
import { getExtensions } from './card-type-guards';

export type CardListSort = 'edited' | 'newest' | 'oldest' | 'name';
export type CardListFilter = 'all' | 'favorites' | 'collection' | 'lorebook' | 'voxta' | 'charx' | 'v3' | 'v2';
export interface CardListOptions { filter?: CardListFilter; sort?: CardListSort }

function cardType(card: Card): Exclude<CardListFilter, 'all' | 'favorites'> {
  if (card.meta.spec === 'collection' || card.meta.spec === 'lorebook') return card.meta.spec;
  if (card.meta.tags.includes('voxta') || getExtensions(card).voxta) return 'voxta';
  const data = extractCardData(card);
  const isV3 = card.meta.spec === 'v3' || card.meta.spec === 'chara_card_v3';
  if (card.meta.tags.includes('charx') || (card.meta.assetCount ?? 0) > 0 ||
    (isV3 && 'assets' in data && (data.assets?.length ?? 0) > 0)) return 'charx';
  return isV3 ? 'v3' : 'v2';
}

/** Light/static libraries have all cards locally; full mode uses the API query. */
export function queryLocalCards(cards: Card[], query: string, { filter = 'all', sort = 'edited' }: CardListOptions): Card[] {
  const term = query.trim().toLowerCase();
  const filtered = cards.filter(card => {
    const data = extractCardData(card);
    if (term && ![data.name, data.description, ...card.meta.tags].some(value => value?.toLowerCase().includes(term))) return false;
    if (filter === 'favorites') return !!card.meta.favorite;
    return filter === 'all' || cardType(card) === filter;
  });
  return filtered.sort((a, b) => {
    let difference: number;
    if (sort === 'name') {
      const nameA = (extractCardData(a).name || 'Untitled Card').toLowerCase();
      const nameB = (extractCardData(b).name || 'Untitled Card').toLowerCase();
      difference = nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    } else if (sort === 'newest') {
      difference = Date.parse(b.meta.createdAt) - Date.parse(a.meta.createdAt);
    } else if (sort === 'oldest') {
      difference = Date.parse(a.meta.createdAt) - Date.parse(b.meta.createdAt);
    } else {
      difference = Date.parse(b.meta.updatedAt) - Date.parse(a.meta.updatedAt);
    }
    return difference || a.meta.id.localeCompare(b.meta.id);
  });
}
