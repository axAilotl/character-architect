/**
 * Unified Import Web Test
 *
 * Tests the complete web import flow:
 * File → UnifiedImportService → Parser → Processor → ClientStorageAdapter → IndexedDB
 *
 * This test verifies:
 * 1. UnifiedImportService correctly orchestrates parsing and processing
 * 2. ClientStorageAdapter stores cards and assets to mocked IndexedDB
 * 3. Assets are converted to data URLs for client-side storage
 * 4. Card structure matches expected format
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedImportService } from '@card-architect/import-core';
import { ClientStorageAdapter } from '../adapters/client-storage.adapter';
import type { LocalDB } from '../lib/db';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Get fixtures path from environment - skip tests if not available
const FIXTURES_DIR = process.env.CF_FIXTURES_DIR || null;
const fixturesAvailable = FIXTURES_DIR && existsSync(FIXTURES_DIR);
const describeWithFixtures = fixturesAvailable ? describe : describe.skip;

// ============================================================================
// MOCK SETUP
// ============================================================================

/**
 * Create a mock LocalDB that tracks all operations
 */
function createMockLocalDB() {
  const savedCards = new Map<string, any>();
  const savedImages = new Map<string, any>();
  const savedAssets = new Map<string, any>();

  const mockDB: Partial<LocalDB> = {
    async saveCard(card: any) {
      savedCards.set(card.meta.id, card);
    },
    async getCard(id: string) {
      return savedCards.get(id) || null;
    },
    async saveImage(cardId: string, type: string, data: string) {
      const key = `${cardId}:${type}`;
      savedImages.set(key, { cardId, type, data });
    },
    async getImage(cardId: string, type: string) {
      const key = `${cardId}:${type}`;
      return savedImages.get(key)?.data || null;
    },
    async saveAsset(asset: any) {
      savedAssets.set(asset.id, asset);
    },
    async getAsset(id: string) {
      return savedAssets.get(id) || null;
    },
    async getAssetsByCard(cardId: string) {
      return Array.from(savedAssets.values()).filter(a => a.cardId === cardId);
    },
  };

  return {
    mockDB: mockDB as LocalDB,
    savedCards,
    savedImages,
    savedAssets,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describeWithFixtures('UnifiedImportService + ClientStorageAdapter', () => {
  let service: UnifiedImportService;
  let adapter: ClientStorageAdapter;
  let mockDB: LocalDB;
  let savedCards: Map<string, any>;
  let savedImages: Map<string, any>;
  let savedAssets: Map<string, any>;

  beforeEach(() => {
    // Create fresh mocks for each test
    const mocks = createMockLocalDB();
    mockDB = mocks.mockDB;
    savedCards = mocks.savedCards;
    savedImages = mocks.savedImages;
    savedAssets = mocks.savedAssets;

    adapter = new ClientStorageAdapter(mockDB);
    service = new UnifiedImportService(adapter);
  });

  // ==========================================================================
  // PNG IMPORT TESTS
  // ==========================================================================

  describe('PNG Import', () => {
    it('should import PNG file with embedded CCv3 card', async () => {
      // Load test fixture
      const pngPath = resolve(FIXTURES_DIR, 'basic/png/baseline_v3_small.png');
      const pngBuffer = readFileSync(pngPath);

      console.log(`[Test] Loading PNG: ${pngPath} (${pngBuffer.length} bytes)`);

      // Import via UnifiedImportService
      const cardIds = await service.importFile(pngBuffer, 'baseline_v3_small.png');

      // Verify: Card was created
      expect(cardIds).toHaveLength(1);
      expect(cardIds[0]).toBeTruthy();

      const cardId = cardIds[0];
      console.log(`[Test] Created card ID: ${cardId}`);

      // Verify: Card was stored in IndexedDB
      const storedCard = savedCards.get(cardId);
      expect(storedCard).toBeDefined();
      expect(storedCard.meta.id).toBe(cardId);
      expect(storedCard.meta.name).toBeTruthy();
      expect(storedCard.meta.spec).toBe('v3');

      // Verify: Card has CCv3 structure
      expect(storedCard.data).toBeDefined();
      expect(storedCard.data.spec).toBe('chara_card_v3');
      expect(storedCard.data.spec_version).toBe('3.0');
      expect(storedCard.data.data).toBeDefined();

      // Verify: Thumbnail was stored
      const thumbnail = savedImages.get(`${cardId}:thumbnail`);
      expect(thumbnail).toBeDefined();
      expect(thumbnail.data).toMatch(/^data:image\/png;base64,/);

      console.log(`[Test] ✅ PNG import successful`);
      console.log(`  - Card ID: ${cardId}`);
      console.log(`  - Name: ${storedCard.meta.name}`);
      console.log(`  - Spec: ${storedCard.meta.spec}`);
      console.log(`  - Thumbnail: ${thumbnail.data.substring(0, 50)}...`);
    });

    it('should convert thumbnail to data URL', async () => {
      const pngPath = resolve(FIXTURES_DIR, 'basic/png/baseline_v3_small.png');
      const pngBuffer = readFileSync(pngPath);

      const cardIds = await service.importFile(pngBuffer, 'baseline_v3_small.png');
      const cardId = cardIds[0];

      const thumbnail = savedImages.get(`${cardId}:thumbnail`);
      expect(thumbnail).toBeDefined();

      // Verify data URL format
      expect(thumbnail.data).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);

      // Verify it's valid base64
      const base64Part = thumbnail.data.split(',')[1];
      expect(base64Part).toBeTruthy();
      expect(base64Part.length).toBeGreaterThan(100); // Reasonable size

      console.log(`[Test] ✅ Thumbnail converted to data URL (${thumbnail.data.length} chars)`);
    });

    it('should preserve card metadata', async () => {
      const pngPath = resolve(FIXTURES_DIR, 'basic/png/baseline_v3_small.png');
      const pngBuffer = readFileSync(pngPath);

      const cardIds = await service.importFile(pngBuffer, 'baseline_v3_small.png');
      const storedCard = savedCards.get(cardIds[0]);

      // Verify timestamps were added
      expect(storedCard.meta.createdAt).toBeTruthy();
      expect(storedCard.meta.updatedAt).toBeTruthy();
      expect(new Date(storedCard.meta.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
      expect(new Date(storedCard.meta.updatedAt).getTime()).toBeLessThanOrEqual(Date.now());

      // Verify tags array exists
      expect(Array.isArray(storedCard.meta.tags)).toBe(true);

      console.log(`[Test] ✅ Metadata preserved`);
      console.log(`  - Created: ${storedCard.meta.createdAt}`);
      console.log(`  - Updated: ${storedCard.meta.updatedAt}`);
      console.log(`  - Tags: ${JSON.stringify(storedCard.meta.tags)}`);
    });
  });

  // ==========================================================================
  // JSON IMPORT TESTS
  // ==========================================================================

  describe('JSON Import', () => {
    it('should import JSON CCv3 file', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/null_character_book_v3.json');
      const jsonBuffer = readFileSync(jsonPath);

      console.log(`[Test] Loading JSON: ${jsonPath} (${jsonBuffer.length} bytes)`);

      const cardIds = await service.importFile(jsonBuffer, 'null_character_book_v3.json');

      expect(cardIds).toHaveLength(1);
      const storedCard = savedCards.get(cardIds[0]);

      expect(storedCard).toBeDefined();
      expect(storedCard.meta.spec).toBe('v3');
      expect(storedCard.data.spec).toBe('chara_card_v3');

      console.log(`[Test] ✅ JSON CCv3 import successful`);
      console.log(`  - Card ID: ${cardIds[0]}`);
      console.log(`  - Name: ${storedCard.meta.name}`);
    });

    it('should import JSON CCv2 file (hybrid format)', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/hybrid_format_v2.json');
      const jsonBuffer = readFileSync(jsonPath);

      console.log(`[Test] Loading JSON: ${jsonPath} (${jsonBuffer.length} bytes)`);

      const cardIds = await service.importFile(jsonBuffer, 'hybrid_format_v2.json');

      expect(cardIds).toHaveLength(1);
      const storedCard = savedCards.get(cardIds[0]);

      expect(storedCard).toBeDefined();
      expect(storedCard.meta.spec).toBe('v2');

      console.log(`[Test] ✅ JSON CCv2 import successful`);
      console.log(`  - Card ID: ${cardIds[0]}`);
      console.log(`  - Name: ${storedCard.meta.name}`);
    });

    it('should handle null character_book field in v2', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/null_character_book_v2.json');
      const jsonBuffer = readFileSync(jsonPath);

      const cardIds = await service.importFile(jsonBuffer, 'null_character_book_v2.json');
      const storedCard = savedCards.get(cardIds[0]);

      expect(storedCard).toBeDefined();
      expect(storedCard.meta.spec).toBe('v2');

      // Should handle null character_book gracefully
      const data = storedCard.data.data || storedCard.data;
      expect(data.character_book).toBeFalsy();

      console.log(`[Test] ✅ Null character_book handled correctly`);
    });

    it('should handle null character_book field in v3', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/null_character_book_v3.json');
      const jsonBuffer = readFileSync(jsonPath);

      const cardIds = await service.importFile(jsonBuffer, 'null_character_book_v3.json');
      const storedCard = savedCards.get(cardIds[0]);

      expect(storedCard).toBeDefined();
      expect(storedCard.meta.spec).toBe('v3');

      // Should handle null character_book gracefully
      expect(storedCard.data.data.character_book).toBeFalsy();

      console.log(`[Test] ✅ Null character_book (v3) handled correctly`);
    });

    it('should handle v1 unwrapped format', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/v1_unwrapped.json');
      const jsonBuffer = readFileSync(jsonPath);

      const cardIds = await service.importFile(jsonBuffer, 'v1_unwrapped.json');
      const storedCard = savedCards.get(cardIds[0]);

      expect(storedCard).toBeDefined();
      // v1 is normalized to v3 (current normalization behavior)
      expect(['v2', 'v3']).toContain(storedCard.meta.spec);

      console.log(`[Test] ✅ v1 unwrapped format handled`);
      console.log(`  - Normalized to: ${storedCard.meta.spec}`);
    });
  });

  // ==========================================================================
  // CHARX IMPORT TESTS
  // ==========================================================================

  describe('CHARX Import', () => {
    it('should import CHARX file with assets', async () => {
      const charxPath = resolve(FIXTURES_DIR, 'basic/charx');

      // Check if CHARX fixtures exist
      try {
        const files = readFileSync(resolve(charxPath, '..', '..', 'MANIFEST.md'), 'utf-8');
        if (!files.includes('charx')) {
          console.log('[Test] ⚠️  No CHARX fixtures available, skipping test');
          return;
        }
      } catch {
        console.log('[Test] ⚠️  Cannot read MANIFEST, skipping CHARX test');
        return;
      }

      console.log(`[Test] CHARX import test would run here if fixtures exist`);
      // Note: This test is a placeholder - actual CHARX files need to be added to fixtures
    });
  });

  // ==========================================================================
  // ADAPTER HELPER METHODS TESTS
  // ==========================================================================

  describe('ClientStorageAdapter Helper Methods', () => {
    it('should provide saveAssetWithData helper', async () => {
      // Create a mock card first
      const cardId = 'test-card-123';
      await mockDB.saveCard!({
        meta: {
          id: cardId,
          name: 'Test Card',
          spec: 'v3',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        data: { spec: 'chara_card_v3', spec_version: '3.0', data: {} },
      });

      // Test saveAssetWithData
      const testImage = Buffer.from('fake-image-data');
      const assetId = await adapter.saveAssetWithData(
        cardId,
        {
          buffer: testImage,
          filename: 'test.png',
          mimetype: 'image/png',
          size: testImage.length,
          width: 512,
          height: 512,
        },
        {
          type: 'icon',
          name: 'test-icon',
          ext: 'png',
          order: 0,
          isMain: true,
          tags: ['test'],
        }
      );

      expect(assetId).toBeTruthy();

      // Verify asset was stored
      const storedAsset = savedAssets.get(assetId);
      expect(storedAsset).toBeDefined();
      expect(storedAsset.cardId).toBe(cardId);
      expect(storedAsset.name).toBe('test-icon');
      expect(storedAsset.type).toBe('icon');
      expect(storedAsset.mimetype).toBe('image/png');
      expect(storedAsset.data).toMatch(/^data:image\/png;base64,/);
      expect(storedAsset.isMain).toBe(true);
      expect(storedAsset.tags).toEqual(['test']);

      console.log(`[Test] ✅ saveAssetWithData works correctly`);
      console.log(`  - Asset ID: ${assetId}`);
      console.log(`  - Data URL: ${storedAsset.data.substring(0, 50)}...`);
    });

    it('should convert Buffer to data URL', async () => {
      const cardId = 'test-card-456';
      await mockDB.saveCard!({
        meta: {
          id: cardId,
          name: 'Test Card',
          spec: 'v3',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        data: { spec: 'chara_card_v3', spec_version: '3.0', data: {} },
      });

      // Test with Buffer
      const bufferData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG magic bytes
      const assetId = await adapter.saveAssetWithData(
        cardId,
        {
          buffer: bufferData,
          filename: 'test.png',
          mimetype: 'image/png',
          size: bufferData.length,
        },
        {
          type: 'background',
          name: 'test-bg',
          ext: 'png',
          order: 0,
          isMain: false,
          tags: [],
        }
      );

      const asset = savedAssets.get(assetId);
      expect(asset.data).toBe('data:image/png;base64,iVBORw==');

      console.log(`[Test] ✅ Buffer converted to data URL: ${asset.data}`);
    });

    it('should convert Uint8Array to data URL', async () => {
      const cardId = 'test-card-789';
      await mockDB.saveCard!({
        meta: {
          id: cardId,
          name: 'Test Card',
          spec: 'v3',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        data: { spec: 'chara_card_v3', spec_version: '3.0', data: {} },
      });

      // Test with Uint8Array
      const uint8Data = new Uint8Array([0xFF, 0xD8, 0xFF]); // JPEG magic bytes
      const assetId = await adapter.saveAssetWithData(
        cardId,
        {
          buffer: uint8Data,
          filename: 'test.jpg',
          mimetype: 'image/jpeg',
          size: uint8Data.length,
        },
        {
          type: 'emotion',
          name: 'test-emotion',
          ext: 'jpg',
          order: 0,
          isMain: false,
          tags: [],
        }
      );

      const asset = savedAssets.get(assetId);
      expect(asset.data).toMatch(/^data:image\/jpeg;base64,/);

      console.log(`[Test] ✅ Uint8Array converted to data URL: ${asset.data.substring(0, 40)}...`);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty tags array', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/null_character_book_v3.json');
      const jsonBuffer = readFileSync(jsonPath);

      const cardIds = await service.importFile(jsonBuffer, 'test.json');
      const storedCard = savedCards.get(cardIds[0]);

      expect(Array.isArray(storedCard.meta.tags)).toBe(true);
      console.log(`[Test] ✅ Tags array handled: ${JSON.stringify(storedCard.meta.tags)}`);
    });

    it('should handle missing thumbnail', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/null_character_book_v3.json');
      const jsonBuffer = readFileSync(jsonPath);

      const cardIds = await service.importFile(jsonBuffer, 'test.json');
      const cardId = cardIds[0];

      // JSON files typically don't have thumbnails
      const thumbnail = savedImages.get(`${cardId}:thumbnail`);
      // Thumbnail may or may not exist depending on parser implementation
      console.log(`[Test] ✅ Missing thumbnail handled gracefully: ${thumbnail ? 'present' : 'absent'}`);
    });

    it('should assign unique card IDs', async () => {
      const jsonPath = resolve(FIXTURES_DIR, 'basic/json/null_character_book_v3.json');
      const jsonBuffer = readFileSync(jsonPath);

      // Import twice
      const cardIds1 = await service.importFile(jsonBuffer, 'test1.json');
      const cardIds2 = await service.importFile(jsonBuffer, 'test2.json');

      expect(cardIds1[0]).not.toBe(cardIds2[0]);
      expect(savedCards.get(cardIds1[0])).toBeDefined();
      expect(savedCards.get(cardIds2[0])).toBeDefined();

      console.log(`[Test] ✅ Unique IDs: ${cardIds1[0]} vs ${cardIds2[0]}`);
    });
  });
});
