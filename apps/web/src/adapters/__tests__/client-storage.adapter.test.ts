/**
 * ClientStorageAdapter Tests
 *
 * Tests the client-side storage adapter that wraps IndexedDB (LocalDB)
 * and converts assets to data URLs for browser storage.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ClientStorageAdapter } from '../client-storage.adapter';
import type { LocalDB, StoredAsset } from '../../lib/db';
import type { CardData, AssetData, AssetLink } from '@card-architect/import-core';

// Mock LocalDB
vi.mock('../../lib/db', () => {
  return {
    LocalDB: vi.fn(),
  };
});

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-id-12345'),
}));

describe('ClientStorageAdapter', () => {
  let adapter: ClientStorageAdapter;
  let mockDB: {
    saveCard: Mock;
    getCard: Mock;
    saveImage: Mock;
    saveAsset: Mock;
    init: Mock;
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock DB with all required methods
    mockDB = {
      saveCard: vi.fn().mockResolvedValue(undefined),
      getCard: vi.fn().mockResolvedValue(null),
      saveImage: vi.fn().mockResolvedValue(undefined),
      saveAsset: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
    };

    // Create adapter with mocked DB
    adapter = new ClientStorageAdapter(mockDB as unknown as LocalDB);
  });

  // ============================================================================
  // HELPER FUNCTION TESTS
  // ============================================================================

  describe('bufferToDataURL (via createAsset)', () => {
    it('should convert Buffer to data URL', async () => {
      const buffer = Buffer.from('test-image-data');
      const assetData: AssetData = {
        buffer,
        filename: 'test.png',
        mimetype: 'image/png',
        size: buffer.length,
        width: 100,
        height: 100,
      };

      const result = await adapter.createAsset(assetData);

      expect(result.assetId).toBe('mock-id-12345');
      expect(result.url).toMatch(/^data:image\/png;base64,/);
      expect(result.url).toContain('dGVzdC1pbWFnZS1kYXRh'); // base64 of "test-image-data"
    });

    it('should convert Uint8Array to data URL', async () => {
      const uint8Array = new Uint8Array([116, 101, 115, 116]); // "test" in ASCII
      const assetData: AssetData = {
        buffer: uint8Array,
        filename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: uint8Array.length,
        width: 200,
        height: 150,
      };

      const result = await adapter.createAsset(assetData);

      expect(result.assetId).toBe('mock-id-12345');
      expect(result.url).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.url).toContain('dGVzdA=='); // base64 of "test"
    });

    it('should handle different mimetypes', async () => {
      const buffer = Buffer.from('audio-data');
      const assetData: AssetData = {
        buffer,
        filename: 'sound.mp3',
        mimetype: 'audio/mpeg',
        size: buffer.length,
      };

      const result = await adapter.createAsset(assetData);

      expect(result.url).toMatch(/^data:audio\/mpeg;base64,/);
    });
  });

  // ============================================================================
  // CARD OPERATIONS
  // ============================================================================

  describe('createCard', () => {
    it('should create card with generated ID and timestamps', async () => {
      const cardData: CardData = {
        meta: {
          name: 'Test Character',
          spec: 'v3',
          tags: ['fantasy', 'adventure'],
        },
        data: {
          spec: 'chara_card_v3',
          spec_version: '3.0',
          data: {
            name: 'Test Character',
            description: 'A test character',
          },
        },
      };

      const result = await adapter.createCard(cardData);

      expect(result.cardId).toBe('mock-id-12345');
      expect(mockDB.saveCard).toHaveBeenCalledTimes(1);

      const savedCard = mockDB.saveCard.mock.calls[0][0];
      expect(savedCard.meta.id).toBe('mock-id-12345');
      expect(savedCard.meta.name).toBe('Test Character');
      expect(savedCard.meta.spec).toBe('v3');
      expect(savedCard.meta.tags).toEqual(['fantasy', 'adventure']);
      expect(savedCard.meta.createdAt).toBeDefined();
      expect(savedCard.meta.updatedAt).toBeDefined();
      expect(savedCard.data).toEqual(cardData.data);
    });

    it('should preserve all metadata fields', async () => {
      const cardData: CardData = {
        meta: {
          name: 'Collection Card',
          spec: 'collection',
          tags: ['collection'],
          creator: 'Test Creator',
          characterVersion: '1.0',
          memberCount: 3,
        },
        data: { spec: 'collection', data: {} },
      };

      await adapter.createCard(cardData);

      const savedCard = mockDB.saveCard.mock.calls[0][0];
      expect(savedCard.meta.creator).toBe('Test Creator');
      expect(savedCard.meta.characterVersion).toBe('1.0');
      expect(savedCard.meta.memberCount).toBe(3);
    });
  });

  describe('updateCard', () => {
    it('should merge updates with existing card', async () => {
      const existingCard = {
        meta: {
          id: 'card-123',
          name: 'Original Name',
          spec: 'v3',
          tags: ['tag1'],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        data: { spec: 'chara_card_v3', data: { name: 'Original' } },
      };

      mockDB.getCard.mockResolvedValueOnce(existingCard);

      await adapter.updateCard('card-123', {
        meta: {
          name: 'Updated Name',
          spec: 'v3',
          tags: ['tag1', 'tag2'],
        },
      });

      expect(mockDB.getCard).toHaveBeenCalledWith('card-123');
      expect(mockDB.saveCard).toHaveBeenCalledTimes(1);

      const updatedCard = mockDB.saveCard.mock.calls[0][0];
      expect(updatedCard.meta.id).toBe('card-123');
      expect(updatedCard.meta.name).toBe('Updated Name');
      expect(updatedCard.meta.tags).toEqual(['tag1', 'tag2']);
      expect(updatedCard.meta.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(updatedCard.meta.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
      expect(updatedCard.data).toEqual(existingCard.data);
    });

    it('should update card data when provided', async () => {
      const existingCard = {
        meta: {
          id: 'card-456',
          name: 'Character',
          spec: 'v3',
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        data: { spec: 'chara_card_v3', data: { name: 'Old' } },
      };

      mockDB.getCard.mockResolvedValueOnce(existingCard);

      const newData = { spec: 'chara_card_v3', data: { name: 'New' } };
      await adapter.updateCard('card-456', { data: newData });

      const updatedCard = mockDB.saveCard.mock.calls[0][0];
      expect(updatedCard.data).toEqual(newData);
    });

    it('should throw error when card not found', async () => {
      mockDB.getCard.mockResolvedValueOnce(null);

      await expect(
        adapter.updateCard('nonexistent', { meta: { name: 'Test', spec: 'v3', tags: [] } })
      ).rejects.toThrow('Card nonexistent not found');

      expect(mockDB.saveCard).not.toHaveBeenCalled();
    });

    it('should preserve card ID even if update tries to change it', async () => {
      const existingCard = {
        meta: {
          id: 'card-original',
          name: 'Name',
          spec: 'v3',
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        data: {},
      };

      mockDB.getCard.mockResolvedValueOnce(existingCard);

      await adapter.updateCard('card-original', {
        meta: { name: 'Updated', spec: 'v3', tags: [] },
      });

      const updatedCard = mockDB.saveCard.mock.calls[0][0];
      expect(updatedCard.meta.id).toBe('card-original');
    });
  });

  describe('setCardImage', () => {
    it('should convert Buffer to data URL and save as thumbnail', async () => {
      const buffer = Buffer.from('image-data');

      await adapter.setCardImage('card-789', buffer);

      expect(mockDB.saveImage).toHaveBeenCalledWith(
        'card-789',
        'thumbnail',
        expect.stringMatching(/^data:image\/png;base64,/)
      );
    });

    it('should convert Uint8Array to data URL', async () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4]);

      await adapter.setCardImage('card-999', uint8Array);

      expect(mockDB.saveImage).toHaveBeenCalledWith(
        'card-999',
        'thumbnail',
        expect.stringMatching(/^data:image\/png;base64,/)
      );
    });

    it('should preserve data URL if already formatted', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';

      await adapter.setCardImage('card-111', dataUrl);

      expect(mockDB.saveImage).toHaveBeenCalledWith('card-111', 'thumbnail', dataUrl);
    });

    it('should convert base64 string to data URL', async () => {
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAUA';

      await adapter.setCardImage('card-222', base64);

      expect(mockDB.saveImage).toHaveBeenCalledWith(
        'card-222',
        'thumbnail',
        `data:image/png;base64,${base64}`
      );
    });
  });

  // ============================================================================
  // ASSET OPERATIONS
  // ============================================================================

  describe('createAsset', () => {
    it('should generate asset ID and return data URL', async () => {
      const buffer = Buffer.from('asset-content');
      const assetData: AssetData = {
        buffer,
        filename: 'background.jpg',
        mimetype: 'image/jpeg',
        size: buffer.length,
        width: 1920,
        height: 1080,
      };

      const result = await adapter.createAsset(assetData);

      expect(result.assetId).toBe('mock-id-12345');
      expect(result.url).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should handle assets without dimensions', async () => {
      const buffer = Buffer.from('audio-content');
      const assetData: AssetData = {
        buffer,
        filename: 'sound.mp3',
        mimetype: 'audio/mpeg',
        size: buffer.length,
      };

      const result = await adapter.createAsset(assetData);

      expect(result.assetId).toBeDefined();
      expect(result.url).toMatch(/^data:audio\/mpeg;base64,/);
    });
  });

  describe('linkAssetToCard', () => {
    it('should log warning about incomplete implementation', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const link: AssetLink = {
        type: 'background',
        name: 'test-background',
        ext: '.jpg',
        order: 1,
        isMain: true,
        tags: ['dark', 'forest'],
      };

      await adapter.linkAssetToCard('card-123', 'asset-456', link);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('linkAssetToCard not fully implemented')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not throw error when called', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const link: AssetLink = {
        type: 'icon',
        name: 'icon',
        ext: '.png',
        order: 0,
        isMain: true,
        tags: [],
      };

      await expect(
        adapter.linkAssetToCard('card-id', 'asset-id', link)
      ).resolves.not.toThrow();

      consoleWarnSpy.mockRestore();
    });
  });

  // ============================================================================
  // COLLECTION OPERATIONS
  // ============================================================================

  describe('linkCardToCollection', () => {
    it('should update child card packageId', async () => {
      const childCard = {
        meta: {
          id: 'child-123',
          name: 'Child Character',
          spec: 'v3' as const,
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        data: {},
      };

      mockDB.getCard.mockResolvedValueOnce(childCard);

      await adapter.linkCardToCollection('child-123', 'collection-456');

      expect(mockDB.getCard).toHaveBeenCalledWith('child-123');
      expect(mockDB.saveCard).toHaveBeenCalledTimes(1);

      const updatedCard = mockDB.saveCard.mock.calls[0][0];
      expect(updatedCard.meta.packageId).toBe('collection-456');
      expect(updatedCard.meta.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
    });

    it('should throw error when child card not found', async () => {
      mockDB.getCard.mockResolvedValueOnce(null);

      await expect(
        adapter.linkCardToCollection('nonexistent', 'collection-123')
      ).rejects.toThrow('Card nonexistent not found');

      expect(mockDB.saveCard).not.toHaveBeenCalled();
    });

    it('should update existing packageId', async () => {
      const childCard = {
        meta: {
          id: 'child-789',
          name: 'Child',
          spec: 'v3' as const,
          tags: [],
          packageId: 'old-collection',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        data: {},
      };

      mockDB.getCard.mockResolvedValueOnce(childCard);

      await adapter.linkCardToCollection('child-789', 'new-collection');

      const updatedCard = mockDB.saveCard.mock.calls[0][0];
      expect(updatedCard.meta.packageId).toBe('new-collection');
    });
  });

  // ============================================================================
  // HELPER METHODS (Client-specific)
  // ============================================================================

  describe('saveAssetWithData', () => {
    it('should save asset with data URL directly', async () => {
      const buffer = Buffer.from('test-asset');
      const assetData: AssetData = {
        buffer,
        filename: 'emotion.png',
        mimetype: 'image/png',
        size: buffer.length,
        width: 512,
        height: 512,
      };

      const link: AssetLink = {
        type: 'emotion',
        name: 'happy',
        ext: '.png',
        order: 1,
        isMain: false,
        tags: ['expression', 'positive'],
      };

      const assetId = await adapter.saveAssetWithData('card-123', assetData, link);

      expect(assetId).toBe('mock-id-12345');
      expect(mockDB.saveAsset).toHaveBeenCalledTimes(1);

      const savedAsset = mockDB.saveAsset.mock.calls[0][0];
      expect(savedAsset.id).toBe('mock-id-12345');
      expect(savedAsset.cardId).toBe('card-123');
      expect(savedAsset.name).toBe('happy');
      expect(savedAsset.type).toBe('emotion');
      expect(savedAsset.ext).toBe('.png');
      expect(savedAsset.mimetype).toBe('image/png');
      expect(savedAsset.size).toBe(buffer.length);
      expect(savedAsset.width).toBe(512);
      expect(savedAsset.height).toBe(512);
      expect(savedAsset.data).toMatch(/^data:image\/png;base64,/);
      expect(savedAsset.isMain).toBe(false);
      expect(savedAsset.tags).toEqual(['expression', 'positive']);
      expect(savedAsset.createdAt).toBeDefined();
      expect(savedAsset.updatedAt).toBeDefined();
    });

    it('should handle main assets', async () => {
      const buffer = Buffer.from('main-icon');
      const assetData: AssetData = {
        buffer,
        filename: 'icon.png',
        mimetype: 'image/png',
        size: buffer.length,
        width: 256,
        height: 256,
      };

      const link: AssetLink = {
        type: 'icon',
        name: 'main-icon',
        ext: '.png',
        order: 0,
        isMain: true,
        tags: ['profile'],
      };

      await adapter.saveAssetWithData('card-456', assetData, link);

      const savedAsset = mockDB.saveAsset.mock.calls[0][0];
      expect(savedAsset.isMain).toBe(true);
    });

    it('should handle assets without dimensions', async () => {
      const buffer = Buffer.from('audio-file');
      const assetData: AssetData = {
        buffer,
        filename: 'theme.mp3',
        mimetype: 'audio/mpeg',
        size: buffer.length,
      };

      const link: AssetLink = {
        type: 'sound',
        name: 'theme-song',
        ext: '.mp3',
        order: 0,
        isMain: false,
        tags: ['music'],
      };

      await adapter.saveAssetWithData('card-789', assetData, link);

      const savedAsset = mockDB.saveAsset.mock.calls[0][0];
      expect(savedAsset.width).toBeUndefined();
      expect(savedAsset.height).toBeUndefined();
      expect(savedAsset.mimetype).toBe('audio/mpeg');
    });

    it('should handle custom asset types', async () => {
      const buffer = Buffer.from('custom-data');
      const assetData: AssetData = {
        buffer,
        filename: 'custom.dat',
        mimetype: 'application/octet-stream',
        size: buffer.length,
      };

      const link: AssetLink = {
        type: 'custom',
        name: 'custom-asset',
        ext: '.dat',
        order: 5,
        isMain: false,
        tags: ['metadata'],
      };

      await adapter.saveAssetWithData('card-999', assetData, link);

      const savedAsset = mockDB.saveAsset.mock.calls[0][0];
      expect(savedAsset.type).toBe('custom');
      expect(savedAsset.ext).toBe('.dat');
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('error handling', () => {
    it('should propagate DB errors on saveCard failure', async () => {
      mockDB.saveCard.mockRejectedValueOnce(new Error('DB write failed'));

      const cardData: CardData = {
        meta: { name: 'Test', spec: 'v3', tags: [] },
        data: {},
      };

      await expect(adapter.createCard(cardData)).rejects.toThrow('DB write failed');
    });

    it('should propagate DB errors on getCard failure', async () => {
      mockDB.getCard.mockRejectedValueOnce(new Error('DB read failed'));

      await expect(
        adapter.updateCard('card-123', { meta: { name: 'Test', spec: 'v3', tags: [] } })
      ).rejects.toThrow('DB read failed');
    });

    it('should propagate DB errors on saveImage failure', async () => {
      mockDB.saveImage.mockRejectedValueOnce(new Error('Image save failed'));

      await expect(adapter.setCardImage('card-123', Buffer.from('img'))).rejects.toThrow(
        'Image save failed'
      );
    });

    it('should propagate DB errors on saveAsset failure', async () => {
      mockDB.saveAsset.mockRejectedValueOnce(new Error('Asset save failed'));

      const assetData: AssetData = {
        buffer: Buffer.from('test'),
        filename: 'test.png',
        mimetype: 'image/png',
        size: 4,
      };

      const link: AssetLink = {
        type: 'icon',
        name: 'test',
        ext: '.png',
        order: 0,
        isMain: false,
        tags: [],
      };

      await expect(adapter.saveAssetWithData('card-123', assetData, link)).rejects.toThrow(
        'Asset save failed'
      );
    });
  });

  // ============================================================================
  // ASYNC OPERATIONS
  // ============================================================================

  describe('async operations', () => {
    it('should handle concurrent card creates', async () => {
      const cardData1: CardData = {
        meta: { name: 'Card 1', spec: 'v3', tags: [] },
        data: {},
      };
      const cardData2: CardData = {
        meta: { name: 'Card 2', spec: 'v3', tags: [] },
        data: {},
      };

      const results = await Promise.all([
        adapter.createCard(cardData1),
        adapter.createCard(cardData2),
      ]);

      expect(results).toHaveLength(2);
      expect(mockDB.saveCard).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent updates', async () => {
      const existingCard = {
        meta: {
          id: 'card-123',
          name: 'Original',
          spec: 'v3' as const,
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        data: {},
      };

      mockDB.getCard.mockResolvedValue(existingCard);

      await Promise.all([
        adapter.updateCard('card-123', { meta: { name: 'Update 1', spec: 'v3', tags: [] } }),
        adapter.setCardImage('card-123', Buffer.from('img')),
      ]);

      expect(mockDB.saveCard).toHaveBeenCalledTimes(1);
      expect(mockDB.saveImage).toHaveBeenCalledTimes(1);
    });
  });
});
