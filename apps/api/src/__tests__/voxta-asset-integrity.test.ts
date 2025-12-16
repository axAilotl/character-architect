import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync, createReadStream } from 'fs';
import { basename } from 'path';
import FormData from 'form-data';
import { unzipSync } from 'fflate';
import { build } from '../app.js';
import { getFixtureTiersToRun } from '../../../../testkit/tier';
import { resolveFixturePath, resolveFixturesDir } from '../../../../testkit/fixtures';

function listZipContents(buffer: Buffer): string[] {
  const unzipped = unzipSync(new Uint8Array(buffer));
  return Object.keys(unzipped);
}

function hasMainIconInVoxtaAssets(zipContents: string[]): boolean {
  return zipContents.some(entry => {
    const lower = entry.toLowerCase();
    if (lower.includes('/assets/avatars/') && lower.includes('main.')) return true;
    if (lower.includes('/avatars/') && /\/main\.(png|jpg|jpeg|webp)$/i.test(entry)) return true;
    return false;
  });
}

function hasMainIconInCharx(zipContents: string[]): boolean {
  return zipContents.some(entry => {
    const lower = entry.toLowerCase();
    return lower === 'assets/main.png' ||
      lower === 'assets/main.jpg' ||
      lower === 'assets/main.webp' ||
      (lower.startsWith('assets/') && lower.includes('main.'));
  });
}

describe('Voxta asset integrity (golden fixtures)', () => {
  const allowMissing = process.env.CF_ALLOW_MISSING_FIXTURES === '1';
  const fixturesDir = resolveFixturesDir({ allowMissing });
  const describeWithFixtures = fixturesDir ? describe : describe.skip;

  let app: FastifyInstance;
  const createdCardIds: string[] = [];

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    for (const id of createdCardIds) {
      await app.inject({ method: 'DELETE', url: `/api/cards/${id}` }).catch(() => {});
    }
    await app.close();
  });

  async function importVoxtaFile(filePath: string): Promise<{ cardIds: string[]; cards: any[] }> {
    const form = new FormData();
    form.append('file', createReadStream(filePath), {
      filename: basename(filePath),
      contentType: 'application/zip',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/import-voxta',
      payload: form,
      headers: form.getHeaders(),
    });

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw new Error(`Import failed: ${response.statusCode} - ${response.body}`);
    }

    const result = JSON.parse(response.body);
    const cardIds = result.cards?.map((c: any) => c?.meta?.id).filter(Boolean) || [];
    createdCardIds.push(...cardIds);
    return { cardIds, cards: result.cards || [] };
  }

  async function getCardAssets(cardId: string): Promise<any[]> {
    const response = await app.inject({
      method: 'GET',
      url: `/api/cards/${cardId}/assets`,
    });
    expect(response.statusCode).toBe(200);
    return JSON.parse(response.body);
  }

  async function exportCard(cardId: string, format: 'voxta' | 'charx'): Promise<Buffer> {
    const response = await app.inject({
      method: 'GET',
      url: `/api/cards/${cardId}/export?format=${format}`,
    });
    if (response.statusCode !== 200) {
      throw new Error(`Export failed: ${response.statusCode} - ${response.body}`);
    }
    return response.rawPayload;
  }

  describeWithFixtures('Voxta import/export rules', () => {
    it('does not create a main icon asset on import', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');
      const testFile = resolveFixturePath(fixturesDir, 'basic/voxta/character_only_small.voxpkg');

      const importResult = await importVoxtaFile(testFile);
      expect(importResult.cardIds.length).toBeGreaterThan(0);

      const target = importResult.cards.find((c: any) => c?.meta?.spec !== 'collection') || importResult.cards[0];
      expect(target).toBeTruthy();
      const assets = await getCardAssets(target.meta.id);

      const mainIconAsset = assets.find((a: any) =>
        a.type === 'icon' && (a.isMain === true || a.name === 'main')
      );

      expect(mainIconAsset).toBeUndefined();
    });

    it('does not include a main icon in Voxta export Assets/', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');
      const testFile = resolveFixturePath(fixturesDir, 'basic/voxta/character_only_small.voxpkg');

      const importResult = await importVoxtaFile(testFile);
      const target = importResult.cards.find((c: any) => c?.meta?.spec !== 'collection') || importResult.cards[0];
      expect(target).toBeTruthy();

      const voxtaBuffer = await exportCard(target.meta.id, 'voxta');
      const zipContents = listZipContents(voxtaBuffer);
      expect(hasMainIconInVoxtaAssets(zipContents)).toBe(false);
    });

    it('includes a main icon in CHARX export', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');
      const testFile = resolveFixturePath(fixturesDir, 'basic/voxta/character_only_small.voxpkg');

      const importResult = await importVoxtaFile(testFile);
      const target = importResult.cards.find((c: any) => c?.meta?.spec !== 'collection') || importResult.cards[0];
      expect(target).toBeTruthy();

      const charxBuffer = await exportCard(target.meta.id, 'charx');
      const zipContents = listZipContents(charxBuffer);
      expect(hasMainIconInCharx(zipContents)).toBe(true);
    });
  });

  describeWithFixtures('No injected main icon in Voxta Assets/', () => {
    const tiers = getFixtureTiersToRun();
    const itExtended = tiers.includes('extended') ? it : it.skip;

    itExtended('does not add extra main icon assets during Voxta round-trip', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');
      const testFile = resolveFixturePath(fixturesDir, 'extended/voxta/character_with_avatars.voxpkg');

      const originalBuffer = readFileSync(testFile);
      const originalZipContents = listZipContents(originalBuffer);
      const originalHasMain = hasMainIconInVoxtaAssets(originalZipContents);

      const importResult = await importVoxtaFile(testFile);
      const target = importResult.cards.find((c: any) => c?.meta?.spec !== 'collection') || importResult.cards[0];
      expect(target).toBeTruthy();

      const exportedBuffer = await exportCard(target.meta.id, 'voxta');
      const exportedZipContents = listZipContents(exportedBuffer);

      // If original didn't have a 'main' icon in Assets, export must not invent one.
      if (!originalHasMain) {
        expect(hasMainIconInVoxtaAssets(exportedZipContents)).toBe(false);
      }
    });
  });
});

