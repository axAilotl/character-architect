import type { ListCardsQuery } from '../schemas/card.js';

export type CardListOptions = Pick<ListCardsQuery, 'filter' | 'sort'>;

// Search the displayed fields, including wrapped V2/V3 and legacy unwrapped cards.
const name = "COALESCE(NULLIF(json_extract(c.data, '$.data.name'), ''), NULLIF(json_extract(c.data, '$.name'), ''), c.name)";
const description = "COALESCE(json_extract(c.data, '$.data.description'), json_extract(c.data, '$.description'), '')";
const favorite = 'c.id IN (SELECT card_id FROM card_favorites WHERE favorite = 1)';
const cardType = `CASE
  WHEN c.spec IN ('collection', 'lorebook') THEN c.spec
  WHEN EXISTS (SELECT 1 FROM json_each(c.tags) WHERE value = 'voxta')
    OR COALESCE(json_extract(c.data, '$.data.extensions.voxta'), json_extract(c.data, '$.extensions.voxta'), 0) NOT IN (0, '') THEN 'voxta'
  WHEN EXISTS (SELECT 1 FROM json_each(c.tags) WHERE value = 'charx')
    OR EXISTS (SELECT 1 FROM card_assets WHERE card_id = c.id)
    OR (c.spec IN ('v3', 'chara_card_v3') AND COALESCE(json_array_length(c.data, '$.data.assets'), 0) > 0) THEN 'charx'
  WHEN c.spec IN ('v3', 'chara_card_v3') THEN 'v3'
  ELSE 'v2'
END`;

/** One predicate for both the count and the page; all filtering precedes LIMIT. */
export function cardListQuery(query: string | undefined, favoritesOnly: boolean, options: CardListOptions) {
  const clauses: string[] = [];
  const params: string[] = [];
  const term = query?.trim();
  if (term) {
    // LIKE wildcards must be literal, just as they are in the local library search.
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push(`(${name} LIKE ? ESCAPE '\\' OR ${description} LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM json_each(c.tags) WHERE value LIKE ? ESCAPE '\\'))`);
    params.push(pattern, pattern, pattern);
  }
  if (favoritesOnly || options.filter === 'favorites') clauses.push(favorite);
  if (options.filter && options.filter !== 'all' && options.filter !== 'favorites') {
    clauses.push(`(${cardType}) = ?`);
    params.push(options.filter);
  }
  const order = {
    edited: 'c.updated_at DESC',
    newest: 'c.created_at DESC',
    oldest: 'c.created_at ASC',
    name: `${name} COLLATE NOCASE ASC`,
  }[options.sort ?? 'edited'];
  return {
    where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    params,
    // Stable ties prevent missing/duplicated cards while stepping through pages.
    orderBy: ` ORDER BY ${order}, c.id ASC`,
  };
}
