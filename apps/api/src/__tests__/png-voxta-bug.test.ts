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
import { join } from 'path';

const INTERNAL_FIXTURES_DIR = join(__dirname, '../../../../docs/internal/testing');
const ADELINE_PNG = join(INTERNAL_FIXTURES_DIR, 'Adeline.png');

describe('PNG → Voxta Export Bug', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should extract assets from V3 PNG and include them in Voxta export', { timeout: 60000 }, async () => {
    // 1. Import the PNG
    const pngBuffer = readFileSync(ADELINE_PNG);
    console.log(`[Test] PNG size: ${pngBuffer.length} bytes`);

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', pngBuffer, { filename: 'Adeline.png', contentType: 'image/png' });

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
    // Endpoint returns array directly, not { assets: [...] }
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

    // BUG: If the PNG had assets, but voxpkg has 0 assets, this is the bug
    if (cardData.assets && cardData.assets.length > 0) {
      expect(assetFiles.length).toBeGreaterThan(0);
      console.log(`[Test] EXPECTED: ${cardData.assets.length} assets from PNG should be in voxpkg`);
    }
  });

  it('should work: CHARX → import → Voxta export preserves assets', async () => {
    // This should work - CHARX properly extracts and stores assets
    const KASUMI_CHARX = join(INTERNAL_FIXTURES_DIR, 'Kasumi_test.charx');
    const charxBuffer = readFileSync(KASUMI_CHARX);

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', charxBuffer, { filename: 'Kasumi_test.charx', contentType: 'application/zip' });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/api/import',
      payload: form,
      headers: form.getHeaders(),
    });

    expect([200, 201]).toContain(importResponse.statusCode);
    const importResult = JSON.parse(importResponse.body);
    const cardId = importResult.card.meta.id;

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
