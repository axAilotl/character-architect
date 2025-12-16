/**
 * Test PNG → Voxta export bug
 *
 * BUG: V3 PNG cards with embedded assets do NOT export to Voxta correctly.
 * The assets from the PNG are not being extracted and stored in the database,
 * so when exporting to Voxta, there are no assets to include.
 *
 * CHARX → Voxta works because CHARX import properly extracts and stores assets.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { basename } from 'path';
import FormData from 'form-data';
import { resolveFixturePath, resolveFixturesDir } from '../../../../testkit/fixtures';
import { getFixtureTiersToRun } from '../../../../testkit/tier';

describe('PNG → Voxta Export Bug', () => {
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
    await app?.close();
  });

  describeWithFixtures('PNG → Voxta asset extraction', () => {
    const tiers = getFixtureTiersToRun();
    const itLarge = tiers.includes('large') ? it : it.skip;

    itLarge('extracts embedded PNG assets and includes them in Voxta export', { timeout: 60000 }, async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

      const pngPath = resolveFixturePath(fixturesDir, 'large/png/risu_many_assets_small.png');
      const pngBuffer = readFileSync(pngPath);
    console.log(`[Test] PNG size: ${pngBuffer.length} bytes`);

      const form = new FormData();
      form.append('file', pngBuffer, { filename: basename(pngPath), contentType: 'image/png' });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect([200, 201]).toContain(importResponse.statusCode);
      const importResult = JSON.parse(importResponse.body);
      expect(importResult.card).toBeDefined();

      const cardId = importResult.card.meta.id;
      createdCardIds.push(cardId);
      const cardData = importResult.card.data?.data || importResult.card.data;

      console.log(`[Test] Imported card: ${cardData.name}`);
      console.log(`[Test] Card spec: ${importResult.card.data?.spec || 'unknown'}`);
      console.log(`[Test] Assets in JSON: ${cardData.assets?.length || 0}`);

      // Check if assets were imported to DB
      const assetsResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${cardId}/assets`,
      });

      const assetsResult = JSON.parse(assetsResponse.body);
      const assetsInDB = Array.isArray(assetsResult) ? assetsResult.length : (assetsResult.assets?.length || 0);
      console.log(`[Test] Assets in DB: ${assetsInDB}`);

      // 2. Export to Voxta
      const voxtaResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${cardId}/export?format=voxta`,
      });

      expect(voxtaResponse.statusCode).toBe(200);

      // Check Voxta package size
      console.log(`[Test] Voxta package size: ${voxtaResponse.rawPayload.length} bytes`);

      // Parse the voxpkg to check asset count
      const { unzipSync } = await import('fflate');
      const unzipped = unzipSync(new Uint8Array(voxtaResponse.rawPayload));
      const fileCount = Object.keys(unzipped).length;
      const assetFiles = Object.keys(unzipped).filter(f =>
        f.includes('/Assets/') || f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg')
      );

      console.log(`[Test] Files in voxpkg: ${fileCount}`);
      console.log(`[Test] Asset files: ${assetFiles.length}`);
      assetFiles.slice(0, 5).forEach(f => console.log(`  - ${f}`));

      // If the PNG had embedded assets, ensure they show up in the exported package.
      if (cardData.assets && cardData.assets.length > 0) {
        expect(assetFiles.length).toBeGreaterThan(0);
        console.log(`[Test] EXPECTED: ${cardData.assets.length} assets from PNG should be in voxpkg`);
      }
    });
  });

  describeWithFixtures('Control: CHARX → Voxta preserves assets', () => {
    it('works for a small CHARX fixture', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

      const charxPath = resolveFixturePath(fixturesDir, 'basic/charx/baseline_v3_small.charx');
      const charxBuffer = readFileSync(charxPath);

    const form = new FormData();
      form.append('file', charxBuffer, { filename: basename(charxPath), contentType: 'application/zip' });

      const importResponse = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect([200, 201]).toContain(importResponse.statusCode);
      const importResult = JSON.parse(importResponse.body);
      const cardId = importResult.card.meta.id;
      createdCardIds.push(cardId);

      // Check assets in DB
      const assetsResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${cardId}/assets`,
      });
      const assetsResult = JSON.parse(assetsResponse.body);
      const charxAssetsInDB = Array.isArray(assetsResult) ? assetsResult.length : 0;
      console.log(`[CHARX Test] Assets in DB: ${charxAssetsInDB}`);

      // Export to Voxta
      const voxtaResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${cardId}/export?format=voxta`,
      });

      expect(voxtaResponse.statusCode).toBe(200);

      const { unzipSync } = await import('fflate');
      const unzipped = unzipSync(new Uint8Array(voxtaResponse.rawPayload));
      const assetFiles = Object.keys(unzipped).filter(f =>
        f.includes('/Assets/') || f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg')
      );

      console.log(`[CHARX Test] Asset files in voxpkg: ${assetFiles.length}`);
      expect(assetFiles.length).toBeGreaterThan(0);
    });
  });
});
