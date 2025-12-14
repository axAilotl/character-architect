/**
 * Federation API Routes
 *
 * Exposes Character Architect as a federation-compatible platform.
 * Other platforms (SillyTavern, Character Archive, CardsHub) can sync with us.
 *
 * Endpoints:
 * - GET  /api/federation/actor     - Discovery/health endpoint
 * - GET  /api/federation/outbox    - List all cards
 * - GET  /api/federation/outbox/:id - Get specific card
 * - POST /api/federation/inbox     - Create card (incoming sync)
 * - PUT  /api/federation/inbox/:id - Update card
 * - DELETE /api/federation/inbox/:id - Delete card
 * - GET  /api/federation/assets/:id - Get card assets
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface CardRow {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

interface AssetRow {
  id: string;
  card_id: string;
  name: string;
  type: string;
  mimetype: string;
  data: Buffer;
}

export async function federationRoutes(fastify: FastifyInstance) {
  const db = fastify.db;

  /**
   * Actor endpoint - Discovery/health check
   * Returns information about this federation instance
   */
  fastify.get('/api/federation/actor', async (request: FastifyRequest) => {
    const baseUrl = `${request.protocol}://${request.hostname}`;

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${baseUrl}/api/federation/actor`,
      type: 'Service',
      name: 'Character Architect',
      preferredUsername: 'card-architect',
      summary: 'Character card editor and federation hub',
      inbox: `${baseUrl}/api/federation/inbox`,
      outbox: `${baseUrl}/api/federation/outbox`,
      endpoints: {
        sharedInbox: `${baseUrl}/api/federation/inbox`,
      },
    };
  });

  /**
   * Outbox - List all cards
   * Returns cards in federation format for other platforms to sync
   */
  fastify.get('/api/federation/outbox', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = '100', offset = '0', since } = request.query as {
      limit?: string;
      offset?: string;
      since?: string;
    };

    try {
      let query = 'SELECT id, data, created_at, updated_at FROM cards';
      const params: (string | number)[] = [];

      if (since) {
        query += ' WHERE updated_at > ?';
        params.push(since);
      }

      query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const rows = db.prepare(query).all(...params) as CardRow[];

      // Return in federation format
      const cards = rows.map((row) => {
        const cardData = JSON.parse(row.data);
        return {
          id: row.id,
          name: cardData.data?.name || cardData.name || 'Unnamed',
          card: cardData,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
        };
      });

      return cards;
    } catch (error) {
      console.error('[Federation] Failed to list cards:', error);
      reply.status(500).send({ error: 'Failed to list cards' });
    }
  });

  /**
   * Outbox/:id - Get specific card
   */
  fastify.get('/api/federation/outbox/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const row = db.prepare('SELECT id, data, updated_at FROM cards WHERE id = ?').get(id) as CardRow | undefined;

      if (!row) {
        reply.status(404).send({ error: 'Card not found' });
        return;
      }

      const cardData = JSON.parse(row.data);

      // Set Last-Modified header for caching
      reply.header('Last-Modified', new Date(row.updated_at).toUTCString());

      return cardData;
    } catch (error) {
      console.error('[Federation] Failed to get card:', error);
      reply.status(500).send({ error: 'Failed to get card' });
    }
  });

  /**
   * Inbox - Create card (incoming sync from other platforms)
   */
  fastify.post('/api/federation/inbox', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    try {
      // Extract card data - could be wrapped in ActivityPub format or raw CCv3
      let cardData = body;
      if (body.type === 'Create' && body.object) {
        // ActivityPub Create activity
        cardData = typeof body.object === 'string' ? JSON.parse(body.object) : body.object;
        if (cardData.content) {
          // Unwrap from ActivityPub Note format
          cardData = JSON.parse(cardData.content);
        }
      }

      // Generate ID if not provided
      const id = cardData.meta?.id || crypto.randomUUID();
      const now = new Date().toISOString();

      // Ensure proper structure
      if (!cardData.spec && !cardData.spec_version) {
        cardData = {
          spec: 'chara_card_v3',
          spec_version: '3.0',
          data: cardData.data || cardData,
        };
      }

      // Insert or replace
      db.prepare(`
        INSERT OR REPLACE INTO cards (id, data, created_at, updated_at)
        VALUES (?, ?, COALESCE((SELECT created_at FROM cards WHERE id = ?), ?), ?)
      `).run(id, JSON.stringify(cardData), id, now, now);

      console.log('[Federation] Created card:', id);

      reply.status(201).send({ id, success: true });
    } catch (error) {
      console.error('[Federation] Failed to create card:', error);
      reply.status(500).send({ error: 'Failed to create card' });
    }
  });

  /**
   * Inbox/:id - Update card
   */
  fastify.put('/api/federation/inbox/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      // Check if card exists
      const existing = db.prepare('SELECT id FROM cards WHERE id = ?').get(id);
      if (!existing) {
        reply.status(404).send({ error: 'Card not found' });
        return;
      }

      // Extract card data
      let cardData = body;
      if (body.type === 'Update' && body.object) {
        cardData = typeof body.object === 'string' ? JSON.parse(body.object) : body.object;
        if (cardData.content) {
          cardData = JSON.parse(cardData.content);
        }
      }

      const now = new Date().toISOString();

      db.prepare('UPDATE cards SET data = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(cardData), now, id);

      console.log('[Federation] Updated card:', id);

      return { id, success: true };
    } catch (error) {
      console.error('[Federation] Failed to update card:', error);
      reply.status(500).send({ error: 'Failed to update card' });
    }
  });

  /**
   * Inbox/:id - Delete card
   */
  fastify.delete('/api/federation/inbox/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = db.prepare('DELETE FROM cards WHERE id = ?').run(id);

      if (result.changes === 0) {
        reply.status(404).send({ error: 'Card not found' });
        return;
      }

      // Also delete associated assets
      db.prepare('DELETE FROM assets WHERE card_id = ?').run(id);

      console.log('[Federation] Deleted card:', id);

      return { success: true };
    } catch (error) {
      console.error('[Federation] Failed to delete card:', error);
      reply.status(500).send({ error: 'Failed to delete card' });
    }
  });

  /**
   * Assets/:id - Get card assets
   */
  fastify.get('/api/federation/assets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const rows = db.prepare('SELECT id, name, type, mimetype, data FROM assets WHERE card_id = ?')
        .all(id) as AssetRow[];

      // Return assets in federation format
      const assets = rows.map((row) => ({
        name: row.name,
        type: row.type,
        mimeType: row.mimetype,
        // Return base64 encoded data
        data: row.data.toString('base64'),
      }));

      return assets;
    } catch (error) {
      console.error('[Federation] Failed to get assets:', error);
      reply.status(500).send({ error: 'Failed to get assets' });
    }
  });

  console.log('[Federation] Routes registered');
}
