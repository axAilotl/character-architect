import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { createTables } from '../db/schema.js';
import { cardRoutes } from '../routes/cards.js';
import { setFavorite } from '../db/favorites.js';
import type { Card } from '../types/index.js';

describe('card library queries', () => {
  let db: Database.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = new Database(':memory:');
    createTables(db);
    app = Fastify();
    app.decorate('db', db);
    await app.register(cardRoutes, { prefix: '/api' });
  });
  afterEach(async () => {
    await app.close();
    db.close();
  });

  function insert(id: string, spec: string, name: string, description = '', tags: string[] = [], extra = {}) {
    const fields = { name, description, personality: '', scenario: '', first_mes: '', mes_example: '', ...extra };
    const data = spec === 'v2' ? fields : { spec: `chara_card_${spec}`, spec_version: '3.0', data: fields };
    db.prepare(`INSERT INTO cards (id, name, spec, data, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, name, spec, JSON.stringify(data), JSON.stringify(tags), '2026-01-01', '2026-01-01');
  }

  async function list(params: string) {
    const response = await app.inject(`/api/cards?${params}`);
    expect(response.statusCode).toBe(200);
    return response.json<{ items: Card[]; total: number }>();
  }

  it('finds titles, tags, and descriptions in wrapped V3/V2 and unwrapped V2, with the same count', async () => {
    insert('title', 'v3', 'Needle title');
    insert('v3', 'v3', 'A', 'A NEEDLE in the description');
    insert('v2', 'v2', 'B', 'A needle in the description');
    insert('wrapped-v2', 'v2', 'C');
    db.prepare('UPDATE cards SET data = ? WHERE id = ?').run(
      JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'C', description: 'needle' } }), 'wrapped-v2');
    insert('tag', 'v3', 'D', '', ['needle']);
    insert('hidden-title', 'v3', 'Old title');
    db.prepare("UPDATE cards SET data = json_set(data, '$.data.name', 'Needle renamed') WHERE id = 'hidden-title'").run();
    insert('other', 'v3', 'Unrelated');
    const result = await list('query=%20needle%20&limit=20');
    expect(result.total).toBe(6);
    expect(result.items.map(card => card.meta.id).sort()).toEqual(['hidden-title', 'tag', 'title', 'v2', 'v3', 'wrapped-v2']);
  });

  it('treats search punctuation literally', async () => {
    insert('literal', 'v3', 'A', '100%_ready\\now');
    insert('other', 'v3', 'B', '100XXready\\now');
    const result = await list(`query=${encodeURIComponent('%_ready\\')}`);
    expect(result.total).toBe(1);
    expect(result.items[0].meta.id).toBe('literal');
  });

  it('filters and sorts the entire matching library before pagination', async () => {
    for (let i = 0; i < 25; i++) insert(`legacy-${i}`, 'v2', `Needle legacy ${i}`);
    insert('z', 'v3', 'Zebra', 'needle');
    insert('a', 'v3', 'Alpha', 'needle');
    for (const [page, id] of [[1, 'a'], [2, 'z']] as const) {
      const result = await list(`query=needle&filter=v3&sort=name&limit=1&page=${page}`);
      expect(result.total).toBe(2);
      expect(result.items.map(card => card.meta.id)).toEqual([id]);
    }
    setFavorite(db, 'z', true);
    const favorites = await list('query=needle&filter=v3&favoritesOnly=true&limit=1');
    expect(favorites.total).toBe(1);
    expect(favorites.items[0].meta.id).toBe('z');
  });

  it('keeps package, lorebook, and standard type filters distinct', async () => {
    insert('v2', 'v2', 'A');
    insert('v3', 'v3', 'B');
    insert('charx', 'v3', 'C', '', [], { assets: [{ type: 'icon' }] });
    insert('voxta', 'v3', 'D', '', [], { extensions: { voxta: {} } });
    insert('collection', 'collection', 'E', '', ['voxta']);
    insert('lorebook', 'lorebook', 'F');
    for (const filter of ['v2', 'v3', 'charx', 'voxta', 'collection', 'lorebook']) {
      const result = await list(`filter=${filter}`);
      expect(result.total).toBe(1);
      expect(result.items.map(card => card.meta.id)).toEqual([filter]);
    }
  });

  it('validates query options and keeps tied pages stable', async () => {
    for (const id of ['c', 'a', 'b']) insert(id, 'v3', 'Same');
    const ids = [];
    for (let page = 1; page <= 3; page++) ids.push((await list(`limit=1&page=${page}`)).items[0].meta.id);
    expect(ids).toEqual(['a', 'b', 'c']);
    expect((await app.inject('/api/cards?sort=invalid')).statusCode).toBe(400);
    expect((await app.inject('/api/cards?filter=invalid')).statusCode).toBe(400);
  });
});
