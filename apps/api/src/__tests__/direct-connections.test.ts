import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { BackupService } from '../services/backup.service.js';
import { config } from '../config.js';
import { build } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('direct connections and local favorites', () => {
  let app: FastifyInstance;
  let cardId: string;
  beforeAll(async () => {
    app = await build({ logger: false });
    const created = await app.inject({
      method: 'POST',
      url: '/api/cards',
      payload: {
        data: {
          name: 'Connected card',
          description: 'Definition',
          personality: '',
          scenario: '',
          first_mes: 'Hello',
          mes_example: '',
        },
        meta: { name: 'Connected card', spec: 'v2', tags: [] },
      },
    });
    expect(created.statusCode).toBe(201);
    cardId = created.json().meta.id;
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => vi.restoreAllMocks());

  it('saves local stars, filters before pagination, and accepts only newer remote changes', async () => {
    const url = `/api/cards/${cardId}/favorite`;
    const set = await app.inject({ method: 'PUT', url, payload: { favorite: true } });
    expect(set.statusCode).toBe(200);
    const starred = set.json();
    expect(starred.favorite).toBe(true);
    expect(
      (await app.inject('/api/cards?favoritesOnly=true&limit=1')).json().items[0].meta.favorite
    ).toBe(true);
    const unstar = {
      favorite: false,
      updatedAt: starred.updatedAt + 1,
      changeId: 'archive-change',
    };
    expect((await app.inject({ method: 'PUT', url, payload: unstar })).json()).toEqual(unstar);
    expect((await app.inject({ method: 'PUT', url, payload: starred })).json()).toEqual(unstar);
    expect((await app.inject('/api/cards?favoritesOnly=true')).json().total).toBe(0);
    expect(
      (await app.inject({ method: 'PUT', url, payload: { favorite: 'false' } })).statusCode
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/cards/missing/favorite',
          payload: { favorite: true },
        })
      ).statusCode
    ).toBe(404);
  });

  it('uploads a PNG to an authenticated Lumiverse behind a path prefix', async () => {
    const settings = {
      enabled: true,
      baseUrl: 'http://lumiverse:7860/app/api/',
      sessionToken: 'test-session',
      sessionCookie: '',
    };
    expect(
      (await app.inject({ method: 'PATCH', url: '/api/settings/lumiverse', payload: settings }))
        .statusCode
    ).toBe(200);
    const post = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { character: { id: 'lumi-123' } } });
    const response = await app.inject({
      method: 'POST',
      url: `/api/cards/${cardId}/push-to-lumiverse`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().remoteId).toBe('lumi-123');
    const [url, form, options] = post.mock.calls[0];
    expect(url).toBe('http://lumiverse:7860/app/api/v1/characters/import');
    expect(options?.headers?.Authorization).toBe('Bearer test-session');
    expect(form.getBuffer().includes(Buffer.from('name="file"'))).toBe(true);
    expect(form.getBuffer().includes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    expect(options?.maxRedirects).toBe(0);
  });

  it('tests the Lumiverse v1 API from root, API, and versioned URLs', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: { data: [], total: 0 } });
    for (const suffix of ['', '/api/', '/api/v1/']) {
      const response = await app.inject({
        method: 'POST', url: '/api/settings/lumiverse/test',
        payload: { enabled: true, baseUrl: `http://lumiverse:7861/proxy${suffix}` },
      });
      expect(response.statusCode).toBe(200);
    }
    expect(get.mock.calls.map(([url]) => url)).toEqual(
      Array(3).fill('http://lumiverse:7861/proxy/api/v1/characters?limit=1')
    );
  });

  it('reports expired sessions and rejects invalid instance URLs', async () => {
    const settings = {
      enabled: true,
      baseUrl: 'http://lumiverse:7860',
      sessionToken: '',
      sessionCookie: '',
    };
    vi.spyOn(axios, 'get').mockRejectedValue(
      new axios.AxiosError('Unauthorized', undefined, undefined, undefined, {
        status: 401,
      } as never)
    );
    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/lumiverse/test',
      payload: settings,
    });
    expect(response.statusCode).toBe(502);
    expect(response.json().error).toContain('session expired');
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/settings/lumiverse',
          payload: { ...settings, baseUrl: 'file:///tmp' },
        })
      ).statusCode
    ).toBe(400);
  });

  it('rejects callback imports to private hosts while accepting uploaded PNG cards', async () => {
    const callback = await app.inject({
      method: 'POST',
      url: '/api/import-url',
      payload: { url: 'http://127.0.0.1:6969/static/91/91.png' },
    });
    expect(callback.statusCode).toBe(400);
    expect(callback.json().error).toMatch(/private|blocked|localhost|loopback/i);
    const exported = await app.inject(`/api/cards/${cardId}/export?format=png`);
    expect(exported.statusCode).toBe(200);
    const form = new FormData();
    form.append('file', new Blob([exported.rawPayload], { type: 'image/png' }), '91.png');
    const request = new Request('http://localhost/api/import', { method: 'POST', body: form });
    const upload = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': request.headers.get('content-type')! },
      payload: Buffer.from(await request.arrayBuffer()),
    });
    expect(upload.statusCode).toBe(201);
    expect(upload.json().card.meta.name).toBe('Connected card');
  });
  it('preserves local favorites through a full backup and replace restore', async () => {
    const url = `/api/cards/${cardId}/favorite`;
    await app.inject({ method: 'PUT', url, payload: { favorite: true } });
    const service = new BackupService(app.db, config.storagePath);
    const backup = await service.createBackup();
    await app.inject({ method: 'PUT', url, payload: { favorite: false } });
    const result = await service.restoreBackup(backup, { mode: 'replace' });
    expect(result.errors).toEqual([]);
    expect((await app.inject(url)).json().favorite).toBe(true);
  });

  it('exchanges favorite batches without requiring callbacks to Archive', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/favorites/sync',
      payload: {
        cards: [
          { cardId, state: { favorite: false, updatedAt: 0, changeId: '' } },
          { cardId: 'deleted', state: { favorite: false, updatedAt: 0, changeId: '' } },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().cards[0].state.favorite).toBe(true);
    expect(response.json().cards[1]).toEqual({ cardId: 'deleted', missing: true });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/favorites/sync',
          payload: { cards: [{ cardId, state: { favorite: 'false' } }] },
        })
      ).statusCode
    ).toBe(400);
  });
});
