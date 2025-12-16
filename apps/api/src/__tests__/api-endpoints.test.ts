import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { CCv2Data, CCv3Data } from '@character-foundry/character-foundry/schemas';

describe('API Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Card CRUD Operations', () => {
    let createdCardId: string;

    it('should create a new v2 card', async () => {
      const card: CCv2Data = {
        name: 'API Test Character',
        description: 'Created via API test',
        personality: 'Friendly test character',
        scenario: 'Testing API',
        first_mes: 'Hello from API!',
        mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/cards',
        payload: {
          data: card,
          meta: {
            name: 'API Test Character',
            spec: 'v2',
            tags: ['test', 'api'],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.meta.id).toBeDefined();
      expect(body.meta.name).toBe('API Test Character');
      expect(body.data.name).toBe('API Test Character');
      createdCardId = body.meta.id;
    });

    it('should get the created card', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/cards/${createdCardId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.meta.id).toBe(createdCardId);
      expect(body.data.name).toBe('API Test Character');
    });

    it('should list all cards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cards',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
    });

    it('should update a card', async () => {
      // First get the existing card
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${createdCardId}`,
      });
      const existingCard = JSON.parse(getResponse.body);

      // Update with complete data
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/cards/${createdCardId}`,
        payload: {
          data: {
            ...existingCard.data,
            description: 'Updated description',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.description).toBe('Updated description');
    });

    it('should delete a card', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/cards/${createdCardId}`,
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for deleted card', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/cards/${createdCardId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('V3 Card Operations', () => {
    let v3CardId: string;

    it('should create a v3 card with full features', async () => {
      const card: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'V3 Test Character',
          description: 'Testing v3 features',
          personality: 'Advanced personality',
          scenario: 'V3 scenario',
          first_mes: 'Hello from v3!',
          mes_example: '<START>\n{{user}}: Test\n{{char}}: Response',
          creator: 'API Tester',
          character_version: '1.0.0',
          tags: ['v3', 'test'],
          system_prompt: 'Be helpful',
          post_history_instructions: 'Stay consistent',
          alternate_greetings: ['Hi!', 'Hey!'],
          group_only_greetings: [],
          character_book: {
            name: 'Test Lorebook',
            description: 'Test',
            entries: [
              {
                keys: ['test'],
                content: 'Test content',
                enabled: true,
                insertion_order: 0,
                case_sensitive: false,
                priority: 10,
                depth: 4,
                probability: 100,
              },
            ],
          },
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/cards',
        payload: {
          data: card,
          meta: {
            name: 'V3 Test Character',
            spec: 'v3',
            tags: ['v3', 'test'],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.meta.spec).toBe('v3');
      expect(body.data.data.name).toBe('V3 Test Character');
      expect(body.data.data.alternate_greetings).toHaveLength(2);
      expect(body.data.data.character_book.entries).toHaveLength(1);
      v3CardId = body.meta.id;
    });

    it('should update v3 card lorebook', async () => {
      // First get the existing card
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${v3CardId}`,
      });
      const existingCard = JSON.parse(getResponse.body);

      // Update with complete data
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/cards/${v3CardId}`,
        payload: {
          data: {
            ...existingCard.data,
            data: {
              ...existingCard.data.data,
              character_book: {
                name: 'Updated Lorebook',
                description: 'Updated',
                entries: [
                  {
                    keys: ['new'],
                    content: 'New entry',
                    enabled: true,
                    insertion_order: 0,
                    case_sensitive: false,
                    priority: 10,
                    depth: 4,
                    probability: 100,
                  },
                ],
              },
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.data.character_book.name).toBe('Updated Lorebook');
    });

    it('should clean up v3 test card', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/cards/${v3CardId}`,
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('Import/Export', () => {
    let importedCardId: string;

    // Helper to extract name from card data (handles both wrapped and unwrapped V2)
    function getCardName(cardData: unknown): string | undefined {
      if (!cardData || typeof cardData !== 'object') return undefined;
      const data = cardData as Record<string, unknown>;
      // Try direct name (unwrapped V2 or legacy)
      if ('name' in data && typeof data.name === 'string') return data.name;
      // Try wrapped format (V3 or wrapped V2)
      if ('data' in data && typeof data.data === 'object' && data.data) {
        const inner = data.data as Record<string, unknown>;
        if ('name' in inner && typeof inner.name === 'string') return inner.name;
      }
      return undefined;
    }

    it('should import a JSON v2 card', async () => {
      const card: CCv2Data = {
        name: 'Imported Character',
        description: 'Imported from JSON',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hello!',
        mes_example: 'Test',
      };

      // Create form data for file upload
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', Buffer.from(JSON.stringify(card)), {
        filename: 'card.json',
        contentType: 'application/json',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.card).toBeDefined();
      expect(getCardName(body.card.data)).toBe('Imported Character');
      importedCardId = body.card.meta.id;
    });

    it('should export card as JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/cards/${importedCardId}/export?format=json`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const card = JSON.parse(response.body);
      expect(getCardName(card)).toBe('Imported Character');
    });

    it('should export card as PNG', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/cards/${importedCardId}/export?format=png`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.rawPayload).toBeDefined();
    });

    it('should clean up imported card', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/api/cards/${importedCardId}`,
      });
    });
  });

  describe('Tokenization', () => {
    it('should tokenize text', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tokenize',
        payload: {
          model: 'gpt2-bpe-approx',
          payload: {
            text: 'Hello, world! This is a test.',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.fields).toBeDefined();
      expect(body.total).toBeGreaterThan(0);
    });

    it('should tokenize card fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tokenize',
        payload: {
          model: 'gpt2-bpe-approx',
          payload: {
            description: 'This is a test description with multiple words.',
            personality: 'Friendly and helpful',
            scenario: 'Testing scenario',
            first_mes: 'Hello!',
            mes_example: 'Example dialogue',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBeGreaterThan(0);
      expect(body.fields).toBeDefined();
      expect(body.fields.description).toBeGreaterThan(0);
    });
  });
});
