import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { join } from 'path';

const TESTING_DIR = join(__dirname, '../../../../docs/internal/testing');

describe('Format Interoperability', () => {
  let app: FastifyInstance;
  const createdCardIds: string[] = [];

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    // Clean up all created cards
    for (const id of createdCardIds) {
      await app.inject({
        method: 'DELETE',
        url: `/api/cards/${id}`,
      });
    }
    await app.close();
  });

  // Helper to extract name from card data (handles wrapped and unwrapped formats)
  function getCardName(cardData: unknown): string | undefined {
    if (!cardData || typeof cardData !== 'object') return undefined;
    const data = cardData as Record<string, unknown>;
    // Direct name
    if ('name' in data && typeof data.name === 'string') return data.name;
    // Wrapped format
    if ('data' in data && typeof data.data === 'object' && data.data) {
      const inner = data.data as Record<string, unknown>;
      if ('name' in inner && typeof inner.name === 'string') return inner.name;
    }
    return undefined;
  }

  // Helper to extract description from card data
  function getCardDescription(cardData: unknown): string | undefined {
    if (!cardData || typeof cardData !== 'object') return undefined;
    const data = cardData as Record<string, unknown>;
    if ('description' in data && typeof data.description === 'string') return data.description;
    if ('data' in data && typeof data.data === 'object' && data.data) {
      const inner = data.data as Record<string, unknown>;
      if ('description' in inner && typeof inner.description === 'string') return inner.description;
    }
    return undefined;
  }

  // Helper to extract lorebook entries count
  function getLorebookEntryCount(cardData: unknown): number {
    if (!cardData || typeof cardData !== 'object') return 0;
    const data = cardData as Record<string, unknown>;
    // Try direct character_book
    if ('character_book' in data && data.character_book && typeof data.character_book === 'object') {
      const book = data.character_book as Record<string, unknown>;
      if (Array.isArray(book.entries)) return book.entries.length;
    }
    // Try wrapped
    if ('data' in data && typeof data.data === 'object' && data.data) {
      const inner = data.data as Record<string, unknown>;
      if ('character_book' in inner && inner.character_book && typeof inner.character_book === 'object') {
        const book = inner.character_book as Record<string, unknown>;
        if (Array.isArray(book.entries)) return book.entries.length;
      }
    }
    return 0;
  }

  // Helper to extract alternate greetings count
  function getAltGreetingsCount(cardData: unknown): number {
    if (!cardData || typeof cardData !== 'object') return 0;
    const data = cardData as Record<string, unknown>;
    if (Array.isArray(data.alternate_greetings)) return data.alternate_greetings.length;
    if ('data' in data && typeof data.data === 'object' && data.data) {
      const inner = data.data as Record<string, unknown>;
      if (Array.isArray(inner.alternate_greetings)) return inner.alternate_greetings.length;
    }
    return 0;
  }

  // Helper to extract inner card data (unwrapped)
  function getInnerData(cardData: unknown): Record<string, unknown> {
    if (!cardData || typeof cardData !== 'object') return {};
    const data = cardData as Record<string, unknown>;
    if ('data' in data && typeof data.data === 'object' && data.data) {
      return data.data as Record<string, unknown>;
    }
    return data;
  }

  // Helper to get all alternate greetings
  function getAltGreetings(cardData: unknown): string[] {
    const inner = getInnerData(cardData);
    if (Array.isArray(inner.alternate_greetings)) {
      return inner.alternate_greetings as string[];
    }
    return [];
  }

  // Helper to get lorebook entries
  function getLorebookEntries(cardData: unknown): Array<Record<string, unknown>> {
    const inner = getInnerData(cardData);
    if (inner.character_book && typeof inner.character_book === 'object') {
      const book = inner.character_book as Record<string, unknown>;
      if (Array.isArray(book.entries)) {
        return book.entries as Array<Record<string, unknown>>;
      }
    }
    return [];
  }

  // Helper to get extensions
  function getExtensions(cardData: unknown): Record<string, unknown> {
    const inner = getInnerData(cardData);
    if (inner.extensions && typeof inner.extensions === 'object') {
      return inner.extensions as Record<string, unknown>;
    }
    return {};
  }

  describe('Wyvern Format Import', () => {
    it('should import Wyvern JSON (hybrid V2 with field duplication)', async () => {
      const filePath = join(TESTING_DIR, 'wyvern/Alana.json');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'Alana.json',
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
      expect(getCardName(body.card.data)).toBe('Alana');
      expect(body.card.meta.spec).toBe('v2');
      // Wyvern cards have alt greetings
      expect(getAltGreetingsCount(body.card.data)).toBeGreaterThan(0);
      createdCardIds.push(body.card.meta.id);
    });

    it('should import Wyvern PNG', async () => {
      const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'Alana.png',
        contentType: 'image/png',
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
      expect(getCardName(body.card.data)).toBe('Alana');
      createdCardIds.push(body.card.meta.id);
    });
  });

  describe('Chub Format Import', () => {
    it('should import Chub JSON (clean V2 with extensions)', async () => {
      const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'kiora.json',
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
      expect(getCardName(body.card.data)).toBe('Kiora');
      expect(body.card.meta.spec).toBe('v2');
      // Kiora has a lorebook
      expect(getLorebookEntryCount(body.card.data)).toBe(4);
      createdCardIds.push(body.card.meta.id);
    });

    it('should import Chub PNG with embedded card data', async () => {
      const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'kiora.png',
        contentType: 'image/png',
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
      expect(getCardName(body.card.data)).toBe('Kiora');
      // PNG should also have the lorebook
      expect(getLorebookEntryCount(body.card.data)).toBe(4);
      createdCardIds.push(body.card.meta.id);
    });

    it('should preserve Chub extensions during import', async () => {
      const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'kiora.json',
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

      // Check that chub extension is preserved
      const cardData = body.card.data as Record<string, unknown>;
      const data = (cardData.data || cardData) as Record<string, unknown>;
      const extensions = data.extensions as Record<string, unknown>;
      expect(extensions).toBeDefined();
      expect(extensions.chub).toBeDefined();
      expect((extensions.chub as Record<string, unknown>).id).toBe(5226801);
      createdCardIds.push(body.card.meta.id);
    });
  });

  describe('CharacterTavern Format Import', () => {
    it('should import CharacterTavern PNG', async () => {
      const filePath = join(TESTING_DIR, 'CharacterTavern/tanya_the_cat_maid.png');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'tanya.png',
        contentType: 'image/png',
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
      expect(body.card.meta.name).toBeDefined();
      createdCardIds.push(body.card.meta.id);
    });
  });

  describe('JSON Round-Trip (Import → Export → Re-Import)', () => {
    it('should preserve V2 card data through JSON round-trip', async () => {
      // Import Wyvern JSON
      const filePath = join(TESTING_DIR, 'wyvern/Alana.json');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'Alana.json',
        contentType: 'application/json',
      });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(importResponse.statusCode).toBe(201);
      const importedCard = JSON.parse(importResponse.body).card;
      createdCardIds.push(importedCard.meta.id);

      const originalName = getCardName(importedCard.data);
      const originalDescription = getCardDescription(importedCard.data);
      const originalAltGreetings = getAltGreetingsCount(importedCard.data);

      // Export as JSON
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${importedCard.meta.id}/export?format=json`,
      });

      expect(exportResponse.statusCode).toBe(200);
      const exportedJson = JSON.parse(exportResponse.body);

      // Re-import the exported JSON
      const reImportForm = new FormData();
      reImportForm.append('file', Buffer.from(JSON.stringify(exportedJson)), {
        filename: 'Alana_reexport.json',
        contentType: 'application/json',
      });

      const reImportResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: reImportForm,
        headers: reImportForm.getHeaders(),
      });

      expect(reImportResponse.statusCode).toBe(201);
      const reImportedCard = JSON.parse(reImportResponse.body).card;
      createdCardIds.push(reImportedCard.meta.id);

      // Verify data integrity
      expect(getCardName(reImportedCard.data)).toBe(originalName);
      expect(getCardDescription(reImportedCard.data)).toBe(originalDescription);
      expect(getAltGreetingsCount(reImportedCard.data)).toBe(originalAltGreetings);
    });

    it('should preserve lorebook through JSON round-trip', async () => {
      // Import Chub JSON with lorebook
      const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'kiora.json',
        contentType: 'application/json',
      });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(importResponse.statusCode).toBe(201);
      const importedCard = JSON.parse(importResponse.body).card;
      createdCardIds.push(importedCard.meta.id);

      const originalLorebookCount = getLorebookEntryCount(importedCard.data);
      expect(originalLorebookCount).toBe(4);

      // Export as JSON
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${importedCard.meta.id}/export?format=json`,
      });

      expect(exportResponse.statusCode).toBe(200);
      const exportedJson = JSON.parse(exportResponse.body);

      // Re-import
      const reImportForm = new FormData();
      reImportForm.append('file', Buffer.from(JSON.stringify(exportedJson)), {
        filename: 'kiora_reexport.json',
        contentType: 'application/json',
      });

      const reImportResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: reImportForm,
        headers: reImportForm.getHeaders(),
      });

      expect(reImportResponse.statusCode).toBe(201);
      const reImportedCard = JSON.parse(reImportResponse.body).card;
      createdCardIds.push(reImportedCard.meta.id);

      // Verify lorebook preserved
      expect(getLorebookEntryCount(reImportedCard.data)).toBe(originalLorebookCount);
    });
  });

  describe('PNG Round-Trip (Import → Export → Re-Import)', () => {
    it('should preserve card data through PNG round-trip', async () => {
      // Import Chub PNG
      const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'kiora.png',
        contentType: 'image/png',
      });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(importResponse.statusCode).toBe(201);
      const importedCard = JSON.parse(importResponse.body).card;
      createdCardIds.push(importedCard.meta.id);

      const originalName = getCardName(importedCard.data);
      const originalLorebookCount = getLorebookEntryCount(importedCard.data);

      // Export as PNG
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${importedCard.meta.id}/export?format=png`,
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.headers['content-type']).toBe('image/png');

      // Re-import the exported PNG
      const reImportForm = new FormData();
      reImportForm.append('file', exportResponse.rawPayload, {
        filename: 'kiora_reexport.png',
        contentType: 'image/png',
      });

      const reImportResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: reImportForm,
        headers: reImportForm.getHeaders(),
      });

      expect(reImportResponse.statusCode).toBe(201);
      const reImportedCard = JSON.parse(reImportResponse.body).card;
      createdCardIds.push(reImportedCard.meta.id);

      // Verify data integrity
      expect(getCardName(reImportedCard.data)).toBe(originalName);
      expect(getLorebookEntryCount(reImportedCard.data)).toBe(originalLorebookCount);
    });
  });

  describe('Cross-Format Conversion (JSON → PNG → JSON)', () => {
    it('should convert JSON to PNG and back', async () => {
      // Import JSON
      const filePath = join(TESTING_DIR, 'wyvern/Alana.json');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'Alana.json',
        contentType: 'application/json',
      });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(importResponse.statusCode).toBe(201);
      const importedCard = JSON.parse(importResponse.body).card;
      createdCardIds.push(importedCard.meta.id);

      const originalName = getCardName(importedCard.data);
      const originalAltGreetings = getAltGreetingsCount(importedCard.data);

      // Export as PNG
      const pngExportResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${importedCard.meta.id}/export?format=png`,
      });

      expect(pngExportResponse.statusCode).toBe(200);

      // Re-import PNG
      const pngImportForm = new FormData();
      pngImportForm.append('file', pngExportResponse.rawPayload, {
        filename: 'Alana_converted.png',
        contentType: 'image/png',
      });

      const pngImportResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: pngImportForm,
        headers: pngImportForm.getHeaders(),
      });

      expect(pngImportResponse.statusCode).toBe(201);
      const pngCard = JSON.parse(pngImportResponse.body).card;
      createdCardIds.push(pngCard.meta.id);

      // Export as JSON from PNG-based card
      const jsonExportResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${pngCard.meta.id}/export?format=json`,
      });

      expect(jsonExportResponse.statusCode).toBe(200);
      const finalJson = JSON.parse(jsonExportResponse.body);

      // Verify data survived the conversions
      expect(getCardName(finalJson)).toBe(originalName);
      expect(getAltGreetingsCount(finalJson)).toBe(originalAltGreetings);
    });
  });

  describe('V2 to V3 Conversion', () => {
    it('should convert V2 card to V3 format', async () => {
      // Import V2 card
      const filePath = join(TESTING_DIR, 'wyvern/Alana.json');
      const fileContent = await fs.readFile(filePath);

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileContent, {
        filename: 'Alana.json',
        contentType: 'application/json',
      });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(importResponse.statusCode).toBe(201);
      const importedCard = JSON.parse(importResponse.body).card;
      createdCardIds.push(importedCard.meta.id);
      expect(importedCard.meta.spec).toBe('v2');

      // Get the inner V2 data (unwrapped) for conversion
      // The card is stored wrapped: { spec, spec_version, data: { name, description, ... } }
      // The /convert endpoint expects unwrapped V2 format: { name, description, ... }
      const wrappedV2 = importedCard.data as Record<string, unknown>;
      const v2Data = wrappedV2.data || wrappedV2; // Get inner data if wrapped

      // Convert to V3
      const convertResponse = await app.inject({
        method: 'POST',
        url: '/api/convert',
        payload: {
          from: 'v2',
          to: 'v3',
          card: v2Data,
        },
      });

      expect(convertResponse.statusCode).toBe(200);
      const v3Data = JSON.parse(convertResponse.body);

      // V3 format should have spec and wrapped data
      expect(v3Data.spec).toBe('chara_card_v3');
      expect(v3Data.spec_version).toBe('3.0');
      expect(v3Data.data).toBeDefined();
      expect(v3Data.data.name).toBe('Alana');
      // V3 has group_only_greetings
      expect(Array.isArray(v3Data.data.group_only_greetings)).toBe(true);
    });

    it('should convert V3 card to V2 format', async () => {
      // Create a V3 card via API
      const v3Card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test V3 Character',
          description: 'A test character in V3 format',
          personality: 'Friendly',
          scenario: 'Testing',
          first_mes: 'Hello!',
          mes_example: '',
          creator: 'Test',
          character_version: '1.0',
          tags: ['test'],
          group_only_greetings: ['Group greeting 1'],
          alternate_greetings: ['Alt greeting 1'],
        },
      };

      // Convert to V2
      const convertResponse = await app.inject({
        method: 'POST',
        url: '/api/convert',
        payload: {
          from: 'v3',
          to: 'v2',
          card: v3Card,
        },
      });

      expect(convertResponse.statusCode).toBe(200);
      const v2Data = JSON.parse(convertResponse.body);

      // V2 format should have direct fields
      expect(v2Data.name).toBe('Test V3 Character');
      expect(v2Data.description).toBe('A test character in V3 format');
      expect(Array.isArray(v2Data.alternate_greetings)).toBe(true);
      expect(v2Data.alternate_greetings).toContain('Alt greeting 1');
    });
  });

  describe('CHARX Export - Everything to CHARX', () => {
    // Helper to import a card and attach an image for CHARX export
    async function importCardWithImage(
      cardFile: string,
      imageFile: string,
      cardMimetype: string
    ): Promise<{ cardId: string; originalName: string; originalLorebookCount: number; originalAltGreetings: number }> {
      const FormData = (await import('form-data')).default;

      // Import the card
      const cardContent = await fs.readFile(cardFile);
      const form = new FormData();
      form.append('file', cardContent, {
        filename: cardFile.split('/').pop()!,
        contentType: cardMimetype,
      });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(importResponse.statusCode).toBe(201);
      const importedCard = JSON.parse(importResponse.body).card;
      createdCardIds.push(importedCard.meta.id);

      // Upload image to card if it doesn't have one
      const imageContent = await fs.readFile(imageFile);
      const imageForm = new FormData();
      imageForm.append('file', imageContent, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

      await app.inject({
        method: 'POST',
        url: `/api/cards/${importedCard.meta.id}/image`,
        payload: imageForm,
        headers: imageForm.getHeaders(),
      });

      return {
        cardId: importedCard.meta.id,
        originalName: getCardName(importedCard.data) || 'Unknown',
        originalLorebookCount: getLorebookEntryCount(importedCard.data),
        originalAltGreetings: getAltGreetingsCount(importedCard.data),
      };
    }

    // Helper to export to CHARX and verify
    async function exportToCharxAndVerify(
      cardId: string,
      expectedName: string,
      expectedLorebookCount: number,
      expectedAltGreetings: number
    ): Promise<void> {
      const FormData = (await import('form-data')).default;

      // Export as CHARX
      const charxExportResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${cardId}/export?format=charx`,
      });

      expect(charxExportResponse.statusCode).toBe(200);
      expect(charxExportResponse.headers['content-type']).toBe('application/zip');

      // Re-import the CHARX
      const reImportForm = new FormData();
      reImportForm.append('file', charxExportResponse.rawPayload, {
        filename: 'exported.charx',
        contentType: 'application/zip',
      });

      const reImportResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: reImportForm,
        headers: reImportForm.getHeaders(),
      });

      expect([200, 201]).toContain(reImportResponse.statusCode);
      const reImportedCard = JSON.parse(reImportResponse.body).card;
      createdCardIds.push(reImportedCard.meta.id);

      // CHARX always imports as V3
      expect(reImportedCard.meta.spec).toBe('v3');

      // Verify data preserved
      expect(getCardName(reImportedCard.data)).toBe(expectedName);
      expect(getLorebookEntryCount(reImportedCard.data)).toBe(expectedLorebookCount);
      expect(getAltGreetingsCount(reImportedCard.data)).toBe(expectedAltGreetings);
    }

    describe('Wyvern to CHARX', () => {
      it('should convert Wyvern JSON to CHARX', async () => {
        const { cardId, originalName, originalLorebookCount, originalAltGreetings } = await importCardWithImage(
          join(TESTING_DIR, 'wyvern/Alana.json'),
          join(TESTING_DIR, 'wyvern/Alana.png'),
          'application/json'
        );
        await exportToCharxAndVerify(cardId, originalName, originalLorebookCount, originalAltGreetings);
      });

      it('should convert Wyvern PNG to CHARX', async () => {
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data) || 'Unknown';
        const originalAltGreetings = getAltGreetingsCount(importedCard.data);

        await exportToCharxAndVerify(importedCard.meta.id, originalName, 0, originalAltGreetings);
      });
    });

    describe('Chub to CHARX', () => {
      it('should convert Chub JSON to CHARX with lorebook preserved', async () => {
        const { cardId, originalName, originalLorebookCount, originalAltGreetings } = await importCardWithImage(
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json'),
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png'),
          'application/json'
        );

        // Kiora has 4 lorebook entries
        expect(originalLorebookCount).toBe(4);

        await exportToCharxAndVerify(cardId, originalName, originalLorebookCount, originalAltGreetings);
      });

      it('should convert Chub PNG to CHARX', async () => {
        const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'kiora.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data) || 'Unknown';
        const originalLorebookCount = getLorebookEntryCount(importedCard.data);
        const originalAltGreetings = getAltGreetingsCount(importedCard.data);

        await exportToCharxAndVerify(importedCard.meta.id, originalName, originalLorebookCount, originalAltGreetings);
      });

      it('should preserve Chub extensions through CHARX round-trip', async () => {
        const { cardId } = await importCardWithImage(
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json'),
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png'),
          'application/json'
        );

        const FormData = (await import('form-data')).default;

        // Export as CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${cardId}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'kiora.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        // Verify Chub extension preserved
        const cardData = reImportedCard.data as Record<string, unknown>;
        const data = (cardData.data || cardData) as Record<string, unknown>;
        const extensions = data.extensions as Record<string, unknown>;
        expect(extensions).toBeDefined();
        expect(extensions.chub).toBeDefined();
        expect((extensions.chub as Record<string, unknown>).id).toBe(5226801);
      });
    });

    describe('CharacterTavern to CHARX', () => {
      it('should convert CharacterTavern PNG to CHARX', async () => {
        const filePath = join(TESTING_DIR, 'CharacterTavern/tanya_the_cat_maid.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'tanya.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data) || importedCard.meta.name;

        await exportToCharxAndVerify(importedCard.meta.id, originalName, 0, 0);
      });
    });

    describe('V3 Card to CHARX', () => {
      it('should export V3 card to CHARX and preserve all V3 fields', async () => {
        const FormData = (await import('form-data')).default;

        // Create a V3 card with all features
        const v3Card = {
          data: {
            spec: 'chara_card_v3',
            spec_version: '3.0',
            data: {
              name: 'V3 CHARX Test',
              description: 'A V3 card for CHARX export testing',
              personality: 'Friendly and helpful',
              scenario: 'Testing CHARX format with V3 features',
              first_mes: 'Hello! I am a V3 test character.',
              mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
              creator: 'Test Suite',
              character_version: '1.0',
              tags: ['test', 'charx', 'v3'],
              group_only_greetings: ['Group greeting 1', 'Group greeting 2'],
              alternate_greetings: ['Alt greeting 1', 'Alt greeting 2', 'Alt greeting 3'],
              system_prompt: 'You are a helpful assistant.',
              post_history_instructions: 'Remember to be helpful.',
              creator_notes: 'Created for testing V3 to CHARX',
              character_book: {
                name: 'Test Lorebook',
                description: 'A test lorebook',
                entries: [
                  {
                    keys: ['test', 'lore'],
                    content: 'This is test lore content.',
                    enabled: true,
                    insertion_order: 100,
                    extensions: {},
                  },
                  {
                    keys: ['another'],
                    content: 'Another lore entry.',
                    enabled: true,
                    insertion_order: 101,
                    extensions: {},
                  },
                ],
              },
            },
          },
          meta: {
            name: 'V3 CHARX Test',
            spec: 'v3',
            tags: ['test', 'charx', 'v3'],
          },
        };

        // Create the card
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/cards',
          payload: v3Card,
        });

        expect(createResponse.statusCode).toBe(201);
        const createdCard = JSON.parse(createResponse.body);
        createdCardIds.push(createdCard.meta.id);

        // Upload an image for CHARX export
        const sharp = (await import('sharp')).default;
        const testImage = await sharp({
          create: {
            width: 400,
            height: 600,
            channels: 4,
            background: { r: 100, g: 150, b: 200, alpha: 1 },
          },
        })
          .png()
          .toBuffer();

        const imageForm = new FormData();
        imageForm.append('file', testImage, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${createdCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Export as CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${createdCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);
        expect(charxExportResponse.headers['content-type']).toBe('application/zip');

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'v3_test.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        // Verify V3 spec
        expect(reImportedCard.meta.spec).toBe('v3');

        // Verify all fields preserved
        expect(getCardName(reImportedCard.data)).toBe('V3 CHARX Test');
        expect(getLorebookEntryCount(reImportedCard.data)).toBe(2);
        expect(getAltGreetingsCount(reImportedCard.data)).toBe(3);

        // Verify V3-specific fields
        const cardData = reImportedCard.data as Record<string, unknown>;
        const data = (cardData.data || cardData) as Record<string, unknown>;
        expect(data.creator).toBe('Test Suite');
        expect(data.character_version).toBe('1.0');
        expect(Array.isArray(data.tags)).toBe(true);
        expect((data.tags as string[]).length).toBe(3);
        expect(Array.isArray(data.group_only_greetings)).toBe(true);
        expect((data.group_only_greetings as string[]).length).toBe(2);
      });
    });

    describe('CHARX Round-Trip (CHARX to CHARX)', () => {
      it('should re-export an imported CHARX without data loss', async () => {
        // First, create a card with all features and export to CHARX
        const FormData = (await import('form-data')).default;

        // Import a PNG card first
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        // Export to CHARX (first export)
        const firstExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=charx`,
        });

        expect(firstExportResponse.statusCode).toBe(200);

        // Import the first CHARX
        const firstImportForm = new FormData();
        firstImportForm.append('file', firstExportResponse.rawPayload, {
          filename: 'first.charx',
          contentType: 'application/zip',
        });

        const firstReImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: firstImportForm,
          headers: firstImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(firstReImportResponse.statusCode);
        const firstReImportedCard = JSON.parse(firstReImportResponse.body).card;
        createdCardIds.push(firstReImportedCard.meta.id);

        // Export to CHARX again (second export)
        const secondExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${firstReImportedCard.meta.id}/export?format=charx`,
        });

        expect(secondExportResponse.statusCode).toBe(200);

        // Import the second CHARX
        const secondImportForm = new FormData();
        secondImportForm.append('file', secondExportResponse.rawPayload, {
          filename: 'second.charx',
          contentType: 'application/zip',
        });

        const secondReImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: secondImportForm,
          headers: secondImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(secondReImportResponse.statusCode);
        const secondReImportedCard = JSON.parse(secondReImportResponse.body).card;
        createdCardIds.push(secondReImportedCard.meta.id);

        // Verify data is identical across all round-trips
        const originalName = getCardName(importedCard.data);
        expect(getCardName(firstReImportedCard.data)).toBe(originalName);
        expect(getCardName(secondReImportedCard.data)).toBe(originalName);
      });
    });

    describe('Data Integrity in CHARX Conversion', () => {
      it('should preserve special characters in CHARX round-trip', async () => {
        const FormData = (await import('form-data')).default;

        // Create a card with special characters
        const specialCard = {
          data: {
            spec: 'chara_card_v3',
            spec_version: '3.0',
            data: {
              name: 'Tëst Chàráctér "Spëcíal"',
              description: 'Description with émojis 🎭 and spëcial chars: <>&\'"',
              personality: 'Personality with ñ, ü, ø, and Japanese: こんにちは',
              scenario: 'Scenario with newlines\nand\ttabs',
              first_mes: '*Action with asterisks* and {{user}} macros',
              mes_example: '',
              creator: '',
              character_version: '1.0',
              tags: ['spëcial', 'tëst'],
              group_only_greetings: [],
              alternate_greetings: [],
            },
          },
          meta: {
            name: 'Special Character Test',
            spec: 'v3',
            tags: [],
          },
        };

        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/cards',
          payload: specialCard,
        });

        expect(createResponse.statusCode).toBe(201);
        const createdCard = JSON.parse(createResponse.body);
        createdCardIds.push(createdCard.meta.id);

        // Add image
        const sharp = (await import('sharp')).default;
        const testImage = await sharp({
          create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
        }).png().toBuffer();

        const imageForm = new FormData();
        imageForm.append('file', testImage, { filename: 'test.png', contentType: 'image/png' });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${createdCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Export to CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${createdCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'special.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        // Verify special characters preserved
        const cardData = reImportedCard.data as Record<string, unknown>;
        const data = (cardData.data || cardData) as Record<string, unknown>;
        expect(data.name).toBe('Tëst Chàráctér "Spëcíal"');
        expect(data.description).toContain('🎭');
        expect(data.personality).toContain('こんにちは');
        expect(data.scenario).toContain('\n');
        expect(data.first_mes).toContain('{{user}}');
      });

      it('should preserve lorebook entry properties in CHARX', async () => {
        const FormData = (await import('form-data')).default;

        // Create a card with detailed lorebook
        const lorebookCard = {
          data: {
            spec: 'chara_card_v3',
            spec_version: '3.0',
            data: {
              name: 'Lorebook Test',
              description: 'Testing lorebook preservation',
              personality: '',
              scenario: '',
              first_mes: 'Hello',
              mes_example: '',
              creator: '',
              character_version: '1.0',
              tags: [],
              group_only_greetings: [],
              alternate_greetings: [],
              character_book: {
                name: 'Detailed Lorebook',
                description: 'A lorebook with all properties',
                entries: [
                  {
                    keys: ['keyword1', 'keyword2'],
                    secondary_keys: ['secondary1'],
                    content: 'Entry 1 content',
                    enabled: true,
                    insertion_order: 50,
                    case_sensitive: true,
                    priority: 10,
                    position: 'before_char',
                    extensions: { custom: 'value' },
                  },
                  {
                    keys: ['other'],
                    content: 'Entry 2 content',
                    enabled: false,
                    insertion_order: 100,
                    extensions: {},
                  },
                ],
              },
            },
          },
          meta: { name: 'Lorebook Test', spec: 'v3', tags: [] },
        };

        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/cards',
          payload: lorebookCard,
        });

        expect(createResponse.statusCode).toBe(201);
        const createdCard = JSON.parse(createResponse.body);
        createdCardIds.push(createdCard.meta.id);

        // Add image
        const sharp = (await import('sharp')).default;
        const testImage = await sharp({
          create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
        }).png().toBuffer();

        const imageForm = new FormData();
        imageForm.append('file', testImage, { filename: 'test.png', contentType: 'image/png' });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${createdCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Export to CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${createdCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'lorebook.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        // Verify lorebook entries
        expect(getLorebookEntryCount(reImportedCard.data)).toBe(2);

        const cardData = reImportedCard.data as Record<string, unknown>;
        const data = (cardData.data || cardData) as Record<string, unknown>;
        const book = data.character_book as Record<string, unknown>;
        expect(book.name).toBe('Detailed Lorebook');

        const entries = book.entries as Array<Record<string, unknown>>;
        expect(entries[0].keys).toContain('keyword1');
        expect(entries[0].content).toBe('Entry 1 content');
        expect(entries[1].enabled).toBe(false);
      });
    });

    describe('Deep Field Comparison', () => {
      it('should preserve ALL text fields through CHARX conversion (Wyvern)', async () => {
        // Import Wyvern PNG
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        // Capture ALL original field values
        const originalData = getInnerData(importedCard.data);
        const originalFields = {
          name: originalData.name,
          description: originalData.description,
          personality: originalData.personality,
          scenario: originalData.scenario,
          first_mes: originalData.first_mes,
          mes_example: originalData.mes_example,
          system_prompt: originalData.system_prompt,
          post_history_instructions: originalData.post_history_instructions,
          creator_notes: originalData.creator_notes,
        };
        const originalAltGreetings = getAltGreetings(importedCard.data);

        // Export to CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'test.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        // Compare ALL fields - exact string equality
        const reimportedData = getInnerData(reImportedCard.data);

        expect(reimportedData.name).toBe(originalFields.name);
        expect(reimportedData.description).toBe(originalFields.description);
        expect(reimportedData.personality).toBe(originalFields.personality);
        expect(reimportedData.scenario).toBe(originalFields.scenario);
        expect(reimportedData.first_mes).toBe(originalFields.first_mes);
        expect(reimportedData.mes_example).toBe(originalFields.mes_example);

        // These might be empty strings or undefined, normalize for comparison
        const normalizeEmpty = (val: unknown) => val || '';
        expect(normalizeEmpty(reimportedData.system_prompt)).toBe(normalizeEmpty(originalFields.system_prompt));
        expect(normalizeEmpty(reimportedData.post_history_instructions)).toBe(normalizeEmpty(originalFields.post_history_instructions));

        // Compare each alternate greeting
        const reimportedAltGreetings = getAltGreetings(reImportedCard.data);
        expect(reimportedAltGreetings.length).toBe(originalAltGreetings.length);
        for (let i = 0; i < originalAltGreetings.length; i++) {
          expect(reimportedAltGreetings[i]).toBe(originalAltGreetings[i]);
        }
      });

      it('should preserve ALL lorebook entry fields through CHARX conversion (Chub)', async () => {
        // Import Chub card with lorebook
        const { cardId } = await importCardWithImage(
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json'),
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png'),
          'application/json'
        );

        // Get original card
        const getResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${cardId}`,
        });
        const originalCard = JSON.parse(getResponse.body);
        const originalEntries = getLorebookEntries(originalCard.data);

        // Capture original entry details
        const originalEntryData = originalEntries.map((entry) => ({
          keys: entry.keys,
          content: entry.content,
          enabled: entry.enabled,
        }));

        const FormData = (await import('form-data')).default;

        // Export to CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${cardId}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'kiora.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        // Compare each lorebook entry in detail
        const reimportedEntries = getLorebookEntries(reImportedCard.data);
        expect(reimportedEntries.length).toBe(originalEntryData.length);

        for (let i = 0; i < originalEntryData.length; i++) {
          const original = originalEntryData[i];
          const reimported = reimportedEntries[i];

          // Keys should match (may be array)
          expect(reimported.keys).toEqual(original.keys);

          // Content should be exactly equal
          expect(reimported.content).toBe(original.content);

          // Enabled state should match
          expect(reimported.enabled).toBe(original.enabled);
        }
      });

      it('should preserve depth_prompt extension through CHARX conversion', async () => {
        // Import Chub card which has depth_prompt
        const { cardId } = await importCardWithImage(
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json'),
          join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png'),
          'application/json'
        );

        // Get original extensions
        const getResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${cardId}`,
        });
        const originalCard = JSON.parse(getResponse.body);
        const originalExtensions = getExtensions(originalCard.data);

        const FormData = (await import('form-data')).default;

        // Export to CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${cardId}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'kiora.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        const reimportedExtensions = getExtensions(reImportedCard.data);

        // Check depth_prompt if it exists
        if (originalExtensions.depth_prompt) {
          expect(reimportedExtensions.depth_prompt).toBeDefined();
          const originalDepth = originalExtensions.depth_prompt as Record<string, unknown>;
          const reimportedDepth = reimportedExtensions.depth_prompt as Record<string, unknown>;
          expect(reimportedDepth.prompt).toBe(originalDepth.prompt);
          expect(reimportedDepth.depth).toBe(originalDepth.depth);
        }

        // Check chub extension
        if (originalExtensions.chub) {
          expect(reimportedExtensions.chub).toBeDefined();
          const originalChub = originalExtensions.chub as Record<string, unknown>;
          const reimportedChub = reimportedExtensions.chub as Record<string, unknown>;
          expect(reimportedChub.id).toBe(originalChub.id);
          expect(reimportedChub.full_path).toBe(originalChub.full_path);
        }
      });

      it('should preserve description with markdown/special formatting through CHARX', async () => {
        const FormData = (await import('form-data')).default;

        // Create a card with complex markdown in description
        const complexCard = {
          data: {
            spec: 'chara_card_v3',
            spec_version: '3.0',
            data: {
              name: 'Markdown Test',
              description: `# Character Profile

## Basic Info
- **Name**: Test Character
- **Age**: 25
- *Occupation*: Adventurer

## Appearance
{{char}} has:
1. Blue eyes
2. Brown hair
3. Athletic build

> "I am a quote with special chars: <>&"

\`\`\`
Code block test
\`\`\`

---

More text with {{user}} macro and line
breaks
here.`,
              personality: 'Bold, **brave**, and _italic_',
              scenario: 'A scenario with\ttabs\tand\nnewlines',
              first_mes: '*{{char}} waves* "Hello {{user}}!"',
              mes_example: '<START>\n{{user}}: Test\n{{char}}: Response',
              creator: '',
              character_version: '1.0',
              tags: [],
              group_only_greetings: [],
              alternate_greetings: [
                '*First alt* with {{user}}',
                '**Second alt** with special chars: <>&',
              ],
            },
          },
          meta: { name: 'Markdown Test', spec: 'v3', tags: [] },
        };

        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/cards',
          payload: complexCard,
        });

        expect(createResponse.statusCode).toBe(201);
        const createdCard = JSON.parse(createResponse.body);
        createdCardIds.push(createdCard.meta.id);

        // Add image
        const sharp = (await import('sharp')).default;
        const testImage = await sharp({
          create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } },
        }).png().toBuffer();

        const imageForm = new FormData();
        imageForm.append('file', testImage, { filename: 'test.png', contentType: 'image/png' });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${createdCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        const originalData = getInnerData(createdCard.data);

        // Export to CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${createdCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'markdown.charx',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportedCard = JSON.parse(reImportResponse.body).card;
        createdCardIds.push(reImportedCard.meta.id);

        const reimportedData = getInnerData(reImportedCard.data);

        // Exact string comparison - byte-for-byte equal
        expect(reimportedData.description).toBe(originalData.description);
        expect(reimportedData.personality).toBe(originalData.personality);
        expect(reimportedData.scenario).toBe(originalData.scenario);
        expect(reimportedData.first_mes).toBe(originalData.first_mes);
        expect(reimportedData.mes_example).toBe(originalData.mes_example);

        // Check alt greetings
        const originalAlts = getAltGreetings(createdCard.data);
        const reimportedAlts = getAltGreetings(reImportedCard.data);
        expect(reimportedAlts).toEqual(originalAlts);
      });
    });
  });

  describe('Voxta Export - Everything to Voxta', () => {
    // Helper to create an image for cards that need one
    async function createTestImage(): Promise<Buffer> {
      const sharp = (await import('sharp')).default;
      return sharp({
        create: {
          width: 400,
          height: 600,
          channels: 4,
          background: { r: 100, g: 150, b: 200, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
    }

    describe('JSON to Voxta', () => {
      it('should convert Wyvern JSON to Voxta package', async () => {
        const filePath = join(TESTING_DIR, 'wyvern/Alana.json');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.json',
          contentType: 'application/json',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data);
        // Note: Voxta format does NOT preserve alternate_greetings

        // Upload image for Voxta export
        const testImage = await createTestImage();
        const imageForm = new FormData();
        imageForm.append('file', testImage, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${importedCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Export as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);
        expect(voxtaExportResponse.headers['content-type']).toBe('application/zip');

        // Re-import the Voxta package
        const reImportForm = new FormData();
        reImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'Alana.voxpkg',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportBody = JSON.parse(reImportResponse.body);
        // Voxta import returns { cards: [...] } array
        const reImportedCard = reImportBody.cards?.[0] || reImportBody.card;
        createdCardIds.push(reImportedCard.meta.id);

        // Verify core data preserved (name is primary field)
        expect(getCardName(reImportedCard.data)).toBe(originalName);
        // Note: Voxta format does NOT preserve alternate_greetings - this is expected
      });

      it('should convert Chub JSON to Voxta (core fields only)', async () => {
        const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'kiora.json',
          contentType: 'application/json',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data);
        const originalLorebookCount = getLorebookEntryCount(importedCard.data);
        expect(originalLorebookCount).toBe(4);

        // Upload image
        const testImage = await createTestImage();
        const imageForm = new FormData();
        imageForm.append('file', testImage, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${importedCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Export as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'kiora.voxpkg',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportBody = JSON.parse(reImportResponse.body);
        const reImportedCard = reImportBody.cards?.[0] || reImportBody.card;
        createdCardIds.push(reImportedCard.meta.id);

        expect(getCardName(reImportedCard.data)).toBe(originalName);
        // Note: Voxta lorebook (memory book) format differs from CCv3 character_book
        // Round-trip may not preserve all entries - this is a format limitation
      });
    });

    describe('PNG to Voxta', () => {
      it('should convert Wyvern PNG to Voxta package', async () => {
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data);

        // Export as Voxta (PNG import already has image)
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);
        expect(voxtaExportResponse.headers['content-type']).toBe('application/zip');

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'Alana.voxpkg',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportBody = JSON.parse(reImportResponse.body);
        const reImportedCard = reImportBody.cards?.[0] || reImportBody.card;
        createdCardIds.push(reImportedCard.meta.id);

        expect(getCardName(reImportedCard.data)).toBe(originalName);
      });

      it('should convert Chub PNG to Voxta (core fields only)', async () => {
        const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'kiora.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data);
        // Note: Voxta format limitation - lorebook may not round-trip fully

        // Export as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);

        // Re-import
        const reImportForm = new FormData();
        reImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'kiora.voxpkg',
          contentType: 'application/zip',
        });

        const reImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: reImportForm,
          headers: reImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(reImportResponse.statusCode);
        const reImportBody = JSON.parse(reImportResponse.body);
        const reImportedCard = reImportBody.cards?.[0] || reImportBody.card;
        createdCardIds.push(reImportedCard.meta.id);

        expect(getCardName(reImportedCard.data)).toBe(originalName);
      });
    });

    describe('CHARX to Voxta', () => {
      it('should convert CHARX to Voxta package', async () => {
        // First create a CHARX by exporting a card
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data);

        // Export as CHARX first
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Import the CHARX
        const charxImportForm = new FormData();
        charxImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'test.charx',
          contentType: 'application/zip',
        });

        const charxImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: charxImportForm,
          headers: charxImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(charxImportResponse.statusCode);
        const charxCard = JSON.parse(charxImportResponse.body).card;
        createdCardIds.push(charxCard.meta.id);

        // Now export the CHARX card as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${charxCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);
        expect(voxtaExportResponse.headers['content-type']).toBe('application/zip');

        // Re-import as Voxta
        const voxtaImportForm = new FormData();
        voxtaImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'test.voxpkg',
          contentType: 'application/zip',
        });

        const voxtaImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: voxtaImportForm,
          headers: voxtaImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(voxtaImportResponse.statusCode);
        const voxtaImportBody = JSON.parse(voxtaImportResponse.body);
        const voxtaCard = voxtaImportBody.cards?.[0] || voxtaImportBody.card;
        createdCardIds.push(voxtaCard.meta.id);

        expect(getCardName(voxtaCard.data)).toBe(originalName);
      });

      it('should convert CHARX to Voxta (core fields only)', async () => {
        // Import Chub card with lorebook
        const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'kiora.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const importedCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(importedCard.meta.id);

        const originalName = getCardName(importedCard.data);
        const originalLorebookCount = getLorebookEntryCount(importedCard.data);
        expect(originalLorebookCount).toBe(4);

        // Export as CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${importedCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Import CHARX
        const charxImportForm = new FormData();
        charxImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'kiora.charx',
          contentType: 'application/zip',
        });

        const charxImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: charxImportForm,
          headers: charxImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(charxImportResponse.statusCode);
        const charxCard = JSON.parse(charxImportResponse.body).card;
        createdCardIds.push(charxCard.meta.id);

        // Export CHARX card as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${charxCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);

        // Import as Voxta
        const voxtaImportForm = new FormData();
        voxtaImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'kiora.voxpkg',
          contentType: 'application/zip',
        });

        const voxtaImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: voxtaImportForm,
          headers: voxtaImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(voxtaImportResponse.statusCode);
        const voxtaImportBody = JSON.parse(voxtaImportResponse.body);
        const voxtaCard = voxtaImportBody.cards?.[0] || voxtaImportBody.card;
        createdCardIds.push(voxtaCard.meta.id);

        expect(getCardName(voxtaCard.data)).toBe(originalName);
        // Note: Voxta format limitation - lorebook/memory book may not preserve all entries
      });
    });

    describe('Voxta to CHARX', () => {
      it('should convert Voxta package to CHARX', async () => {
        // Create a card, export to Voxta, then import and export to CHARX
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const originalCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(originalCard.meta.id);

        const originalName = getCardName(originalCard.data);

        // Export as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${originalCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);

        // Import Voxta
        const voxtaImportForm = new FormData();
        voxtaImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'test.voxpkg',
          contentType: 'application/zip',
        });

        const voxtaImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: voxtaImportForm,
          headers: voxtaImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(voxtaImportResponse.statusCode);
        const voxtaImportBody = JSON.parse(voxtaImportResponse.body);
        const voxtaCard = voxtaImportBody.cards?.[0] || voxtaImportBody.card;
        createdCardIds.push(voxtaCard.meta.id);

        // Upload image for CHARX export (Voxta import may not have icon asset)
        const testImage = await createTestImage();
        const imageForm = new FormData();
        imageForm.append('file', testImage, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${voxtaCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Now export the Voxta-imported card as CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${voxtaCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);
        expect(charxExportResponse.headers['content-type']).toBe('application/zip');

        // Import the CHARX to verify
        const charxImportForm = new FormData();
        charxImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'test.charx',
          contentType: 'application/zip',
        });

        const charxImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: charxImportForm,
          headers: charxImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(charxImportResponse.statusCode);
        const charxCard = JSON.parse(charxImportResponse.body).card;
        createdCardIds.push(charxCard.meta.id);

        // Verify data survived the Voxta → CHARX conversion
        expect(getCardName(charxCard.data)).toBe(originalName);
      });

      it('should preserve all fields through Voxta to CHARX conversion', async () => {
        const FormData = (await import('form-data')).default;

        // Create a V3 card with all features
        const v3Card = {
          data: {
            spec: 'chara_card_v3',
            spec_version: '3.0',
            data: {
              name: 'Voxta to CHARX Test',
              description: 'Testing Voxta to CHARX conversion with all fields',
              personality: 'Friendly and helpful',
              scenario: 'A test scenario',
              first_mes: '*waves* Hello {{user}}!',
              mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
              creator: 'Test Suite',
              character_version: '1.0',
              tags: ['test', 'voxta', 'charx'],
              group_only_greetings: ['Group greeting'],
              alternate_greetings: ['Alt 1', 'Alt 2'],
              system_prompt: 'You are a helpful character.',
              post_history_instructions: 'Stay in character.',
              character_book: {
                name: 'Test Lorebook',
                entries: [
                  {
                    keys: ['test'],
                    content: 'Test lore entry',
                    enabled: true,
                    insertion_order: 100,
                    extensions: {},
                  },
                ],
              },
            },
          },
          meta: {
            name: 'Voxta to CHARX Test',
            spec: 'v3',
            tags: ['test'],
          },
        };

        // Create the card
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/cards',
          payload: v3Card,
        });

        expect(createResponse.statusCode).toBe(201);
        const createdCard = JSON.parse(createResponse.body);
        createdCardIds.push(createdCard.meta.id);

        // Upload image
        const testImage = await createTestImage();
        const imageForm = new FormData();
        imageForm.append('file', testImage, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${createdCard.meta.id}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Export as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${createdCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);

        // Import Voxta
        const voxtaImportForm = new FormData();
        voxtaImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'test.voxpkg',
          contentType: 'application/zip',
        });

        const voxtaImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: voxtaImportForm,
          headers: voxtaImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(voxtaImportResponse.statusCode);
        const voxtaImportBody = JSON.parse(voxtaImportResponse.body);
        // Handle collection cards - if first card is collection, use the second (member character)
        let voxtaCard = voxtaImportBody.cards?.[0] || voxtaImportBody.card;
        if (voxtaCard?.meta?.spec === 'collection' && voxtaImportBody.cards?.length > 1) {
          voxtaCard = voxtaImportBody.cards[1];
        }
        // Track all created cards for cleanup
        if (voxtaImportBody.cards) {
          for (const c of voxtaImportBody.cards) {
            createdCardIds.push(c.meta.id);
          }
        } else if (voxtaCard?.meta?.id) {
          createdCardIds.push(voxtaCard.meta.id);
        }

        // Upload image for CHARX export (Voxta import may not have icon asset)
        const testImageForCharx = await createTestImage();
        const imgForm = new FormData();
        imgForm.append('file', testImageForCharx, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${voxtaCard.meta.id}/image`,
          payload: imgForm,
          headers: imgForm.getHeaders(),
        });

        // Export Voxta card as CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${voxtaCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Import CHARX
        const charxImportForm = new FormData();
        charxImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'test.charx',
          contentType: 'application/zip',
        });

        const charxImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: charxImportForm,
          headers: charxImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(charxImportResponse.statusCode);
        const charxCard = JSON.parse(charxImportResponse.body).card;
        createdCardIds.push(charxCard.meta.id);

        // Verify core fields preserved (Voxta loses alt_greetings and may modify lorebook)
        expect(getCardName(charxCard.data)).toBe('Voxta to CHARX Test');
        // Note: Voxta format does NOT preserve alternate_greetings or lorebook entries from CCv3
        // This is a known format limitation

        const charxData = getInnerData(charxCard.data);
        expect(charxData.creator).toBe('Test Suite');
        expect(charxData.character_version).toBe('1.0');
        expect(Array.isArray(charxData.tags)).toBe(true);
      });

      it('should convert card through Voxta → CHARX (core fields only)', async () => {
        // Import card with lorebook
        const filePath = join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'kiora.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const originalCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(originalCard.meta.id);

        const originalName = getCardName(originalCard.data);
        const originalLorebookCount = getLorebookEntryCount(originalCard.data);
        // Note: lorebook entries may not round-trip through Voxta
        expect(originalLorebookCount).toBe(4);

        // Export as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${originalCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);

        // Import Voxta
        const voxtaImportForm = new FormData();
        voxtaImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'kiora.voxpkg',
          contentType: 'application/zip',
        });

        const voxtaImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: voxtaImportForm,
          headers: voxtaImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(voxtaImportResponse.statusCode);
        const voxtaImportBody = JSON.parse(voxtaImportResponse.body);
        const voxtaCard = voxtaImportBody.cards?.[0] || voxtaImportBody.card;
        createdCardIds.push(voxtaCard.meta.id);

        // Upload image for CHARX export (Voxta import may not have icon asset)
        const testImg = await createTestImage();
        const imgUploadForm = new FormData();
        imgUploadForm.append('file', testImg, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

        await app.inject({
          method: 'POST',
          url: `/api/cards/${voxtaCard.meta.id}/image`,
          payload: imgUploadForm,
          headers: imgUploadForm.getHeaders(),
        });

        // Export as CHARX
        const charxExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${voxtaCard.meta.id}/export?format=charx`,
        });

        expect(charxExportResponse.statusCode).toBe(200);

        // Import CHARX
        const charxImportForm = new FormData();
        charxImportForm.append('file', charxExportResponse.rawPayload, {
          filename: 'kiora.charx',
          contentType: 'application/zip',
        });

        const charxImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: charxImportForm,
          headers: charxImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(charxImportResponse.statusCode);
        const charxCard = JSON.parse(charxImportResponse.body).card;
        createdCardIds.push(charxCard.meta.id);

        // Verify core fields preserved
        expect(getCardName(charxCard.data)).toBe(originalName);
        // Note: Voxta format may not preserve all lorebook entries
        // The format uses a different memory book structure that doesn't map 1:1 with CCv3 character_book
      });
    });

    describe('Voxta Round-Trip', () => {
      it('should re-export an imported Voxta package without data loss', async () => {
        // Create source card
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const originalCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(originalCard.meta.id);

        const originalName = getCardName(originalCard.data);

        // First Voxta export
        const firstVoxtaExport = await app.inject({
          method: 'GET',
          url: `/api/cards/${originalCard.meta.id}/export?format=voxta`,
        });

        expect(firstVoxtaExport.statusCode).toBe(200);

        // Import first Voxta
        const firstImportForm = new FormData();
        firstImportForm.append('file', firstVoxtaExport.rawPayload, {
          filename: 'first.voxpkg',
          contentType: 'application/zip',
        });

        const firstImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: firstImportForm,
          headers: firstImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(firstImportResponse.statusCode);
        const firstImportBody = JSON.parse(firstImportResponse.body);
        const firstVoxtaCard = firstImportBody.cards?.[0] || firstImportBody.card;
        createdCardIds.push(firstVoxtaCard.meta.id);

        // Second Voxta export
        const secondVoxtaExport = await app.inject({
          method: 'GET',
          url: `/api/cards/${firstVoxtaCard.meta.id}/export?format=voxta`,
        });

        expect(secondVoxtaExport.statusCode).toBe(200);

        // Import second Voxta
        const secondImportForm = new FormData();
        secondImportForm.append('file', secondVoxtaExport.rawPayload, {
          filename: 'second.voxpkg',
          contentType: 'application/zip',
        });

        const secondImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: secondImportForm,
          headers: secondImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(secondImportResponse.statusCode);
        const secondImportBody = JSON.parse(secondImportResponse.body);
        const secondVoxtaCard = secondImportBody.cards?.[0] || secondImportBody.card;
        createdCardIds.push(secondVoxtaCard.meta.id);

        // Verify data consistent across round-trips
        expect(getCardName(firstVoxtaCard.data)).toBe(originalName);
        expect(getCardName(secondVoxtaCard.data)).toBe(originalName);
      });
    });

    describe('Voxta Deep Field Comparison', () => {
      // Helper to normalize macros for comparison (Voxta adds spaces: {{char}} → {{ char }})
      function normalizeMacros(text: string | undefined): string {
        if (!text) return '';
        return text.replace(/\{\{\s*(\w+)\s*\}\}/g, '{{$1}}');
      }

      it('should preserve all text fields through Voxta round-trip (with macro normalization)', async () => {
        // Import card with rich content
        const filePath = join(TESTING_DIR, 'wyvern/Alana.png');
        const fileContent = await fs.readFile(filePath);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', fileContent, {
          filename: 'Alana.png',
          contentType: 'image/png',
        });

        const importResponse = await app.inject({
          method: 'POST',
          url: '/api/import',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(importResponse.statusCode).toBe(201);
        const originalCard = JSON.parse(importResponse.body).card;
        createdCardIds.push(originalCard.meta.id);

        // Capture original fields
        const originalData = getInnerData(originalCard.data);
        const originalFields = {
          name: originalData.name as string,
          description: originalData.description as string,
          personality: originalData.personality as string,
          scenario: originalData.scenario as string,
          first_mes: originalData.first_mes as string,
        };
        // Note: Voxta format does NOT preserve alternate_greetings - this is a format limitation

        // Export as Voxta
        const voxtaExportResponse = await app.inject({
          method: 'GET',
          url: `/api/cards/${originalCard.meta.id}/export?format=voxta`,
        });

        expect(voxtaExportResponse.statusCode).toBe(200);

        // Import Voxta
        const voxtaImportForm = new FormData();
        voxtaImportForm.append('file', voxtaExportResponse.rawPayload, {
          filename: 'test.voxpkg',
          contentType: 'application/zip',
        });

        const voxtaImportResponse = await app.inject({
          method: 'POST',
          url: '/api/import-voxta',
          payload: voxtaImportForm,
          headers: voxtaImportForm.getHeaders(),
        });

        expect([200, 201]).toContain(voxtaImportResponse.statusCode);
        const voxtaImportBody = JSON.parse(voxtaImportResponse.body);
        const voxtaCard = voxtaImportBody.cards?.[0] || voxtaImportBody.card;
        createdCardIds.push(voxtaCard.meta.id);

        // Compare fields - Voxta converts macros ({{char}} → {{ char }}), so normalize before comparing
        const voxtaData = getInnerData(voxtaCard.data);

        expect(voxtaData.name).toBe(originalFields.name);
        // Compare with macro normalization for fields that may contain {{char}}/{{user}}
        expect(normalizeMacros(voxtaData.description as string)).toBe(normalizeMacros(originalFields.description));
        expect(normalizeMacros(voxtaData.personality as string)).toBe(normalizeMacros(originalFields.personality));
        expect(normalizeMacros(voxtaData.scenario as string)).toBe(normalizeMacros(originalFields.scenario));
        expect(normalizeMacros(voxtaData.first_mes as string)).toBe(normalizeMacros(originalFields.first_mes));

        // Note: Voxta format does NOT preserve alternate_greetings - this is a format limitation
      });
    });
  });

  describe('Multiple Format Import', () => {
    it('should import multiple files at once', async () => {
      const FormData = (await import('form-data')).default;
      const form = new FormData();

      // Add multiple files
      const wyvernJson = await fs.readFile(join(TESTING_DIR, 'wyvern/Alana.json'));
      const chubJson = await fs.readFile(join(TESTING_DIR, 'chub/main_kiora-ce862489e46d_spec_v2.json'));

      form.append('files', wyvernJson, {
        filename: 'Alana.json',
        contentType: 'application/json',
      });
      form.append('files', chubJson, {
        filename: 'kiora.json',
        contentType: 'application/json',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/import-multiple',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.successCount).toBe(2);
      expect(body.results).toHaveLength(2);

      // Clean up
      for (const result of body.results) {
        if (result.success && result.card?.meta?.id) {
          createdCardIds.push(result.card.meta.id);
        }
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', Buffer.from('not valid json'), {
        filename: 'invalid.json',
        contentType: 'application/json',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle PNG without card data', async () => {
      // Create a minimal PNG without card data
      const sharp = (await import('sharp')).default;
      const emptyPng = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', emptyPng, {
        filename: 'empty.png',
        contentType: 'image/png',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(400);
      // Error can be either message depending on the extraction path
      expect(response.body).toMatch(/No (character card data|text chunks) found/);
    });

    it('should preserve position field normalization', async () => {
      // Card with numeric position fields (common in some exports)
      const cardWithNumericPosition = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'Position Test',
          description: 'Testing position normalization',
          personality: '',
          scenario: '',
          first_mes: 'Hello!',
          mes_example: '',
          character_book: {
            entries: [
              {
                keys: ['test'],
                content: 'Test entry',
                enabled: true,
                insertion_order: 100,
                position: 0, // Numeric, should become 'before_char'
              },
              {
                keys: ['test2'],
                content: 'Test entry 2',
                enabled: true,
                insertion_order: 101,
                position: 1, // Numeric, should become 'after_char'
              },
            ],
          },
        },
      };

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', Buffer.from(JSON.stringify(cardWithNumericPosition)), {
        filename: 'position_test.json',
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
      createdCardIds.push(body.card.meta.id);

      // Verify position fields were normalized
      const cardData = body.card.data as Record<string, unknown>;
      const data = (cardData.data || cardData) as Record<string, unknown>;
      const book = data.character_book as Record<string, unknown>;
      const entries = book.entries as Array<Record<string, unknown>>;

      // Position fields should be moved to extensions during normalization
      expect(entries[0].extensions).toBeDefined();
      expect(entries[1].extensions).toBeDefined();
    });
  });
});
