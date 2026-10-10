import type { FastifyInstance } from 'fastify';
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import { z } from 'zod';
import {
  instanceApiUrl,
  connectionHeaders,
  isFavoriteState,
} from '@character-foundry/character-foundry/integrations';
import { CardRepository } from '../db/repository.js';
import { getFavorite, setFavorite } from '../db/favorites.js';
import { loadSettings, saveSettings } from './settings.js';
import { createCardPNG } from '../utils/file-handlers.js';

const connectionSchema = z
  .object({
    enabled: z.boolean(),
    baseUrl: z.string().trim(),
    sessionToken: z.string().trim().default(''),
    sessionCookie: z.string().trim().default(''),
  })
  .superRefine((value, ctx) => {
    if (!value.baseUrl && !value.enabled) return;
    try {
      instanceApiUrl(value.baseUrl, 'characters');
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'Enter an HTTP or HTTPS instance URL',
      });
    }
  });

export async function directConnectionRoutes(app: FastifyInstance) {
  const repo = new CardRepository(app.db);
  app.get('/settings/lumiverse', async () => ({
    settings: loadSettings().lumiverse || {
      enabled: false,
      baseUrl: '',
      sessionToken: '',
      sessionCookie: '',
    },
  }));
  app.patch('/settings/lumiverse', async (request, reply) => {
    const parsed = connectionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const settings = loadSettings();
    settings.lumiverse = parsed.data;
    saveSettings(settings);
    return { success: true, settings: settings.lumiverse };
  });
  app.post('/settings/lumiverse/test', async (request, reply) => {
    const parsed = connectionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Enter a valid instance URL' });
    try {
      const response = await axios.get(instanceApiUrl(parsed.data.baseUrl, 'characters?limit=1'), {
        headers: connectionHeaders(parsed.data),
        timeout: 10000,
        maxRedirects: 0,
      });
      if (!Array.isArray(response.data?.data))
        throw new Error('The URL did not return the Lumiverse API');
      return { success: true };
    } catch (error) {
      return reply.code(502).send({ error: connectionError(error) });
    }
  });
  app.post<{ Params: { id: string } }>('/cards/:id/push-to-lumiverse', async (request, reply) => {
    const settings = loadSettings().lumiverse;
    if (!settings?.enabled || !settings.baseUrl)
      return reply.code(400).send({ error: 'Configure Lumiverse in Settings → Connections first' });
    const card = repo.get(request.params.id);
    if (!card) return reply.code(404).send({ error: 'Card not found' });
    try {
      const original =
        repo.getOriginalImage(card.meta.id) ||
        (await sharp({
          create: {
            width: 400,
            height: 600,
            channels: 4,
            background: { r: 100, g: 120, b: 150, alpha: 1 },
          },
        })
          .png()
          .toBuffer());
      const png = await createCardPNG(original, card);
      const form = new FormData();
      form.append('file', png, { filename: `${card.meta.id}.png`, contentType: 'image/png' });
      const { data } = await axios.post(
        instanceApiUrl(settings.baseUrl, 'characters/import'),
        form,
        {
          headers: { ...connectionHeaders(settings), ...form.getHeaders() },
          timeout: 60000,
          maxRedirects: 0,
          maxBodyLength: Infinity,
        }
      );
      if (typeof data?.character?.id !== 'string')
        throw new Error('Lumiverse did not return an imported character');
      return { success: true, remoteId: data.character.id };
    } catch (error) {
      return reply.code(502).send({ error: connectionError(error) });
    }
  });
  app.post('/favorites/sync', async (request, reply) => {
    const body = request.body as { cards?: unknown } | null;
    if (
      !Array.isArray(body?.cards) ||
      body.cards.length > 200 ||
      body.cards.some(
        (item) => !item || typeof item.cardId !== 'string' || !isFavoriteState(item.state)
      )
    ) {
      return reply
        .code(400)
        .send({ error: 'Provide up to 200 card IDs with valid favorite states' });
    }
    const cards = body.cards.map((item) => {
      if (!repo.get(item.cardId)) return { cardId: item.cardId, missing: true };
      return {
        cardId: item.cardId,
        state: setFavorite(app.db, item.cardId, item.state.favorite, item.state),
      };
    });
    return { cards };
  });
  app.get<{ Params: { id: string } }>('/cards/:id/favorite', async (request, reply) => {
    if (!repo.get(request.params.id)) return reply.code(404).send({ error: 'Card not found' });
    return getFavorite(app.db, request.params.id);
  });
  app.put<{ Params: { id: string } }>('/cards/:id/favorite', async (request, reply) => {
    if (!repo.get(request.params.id)) return reply.code(404).send({ error: 'Card not found' });
    const body = request.body;
    if (
      !body ||
      typeof body !== 'object' ||
      !('favorite' in body) ||
      typeof body.favorite !== 'boolean'
    ) {
      return reply.code(400).send({ error: 'favorite must be a boolean' });
    }
    const incoming = 'updatedAt' in body || 'changeId' in body;
    if (incoming && !isFavoriteState(body))
      return reply.code(400).send({ error: 'Invalid favorite state' });
    return setFavorite(
      app.db,
      request.params.id,
      body.favorite,
      isFavoriteState(body) ? body : undefined
    );
  });
}

function connectionError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 401)
    return 'Lumiverse session expired or missing. Update the token or cookie in Settings.';
  return error instanceof Error ? error.message : 'Connection failed';
}
