import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { basename } from 'path';
import FormData from 'form-data';
import { build } from '../app.js';
import { parseCard } from '@character-foundry/character-foundry/loader';
import { readVoxta } from '@character-foundry/character-foundry/voxta';
import { getFixtureTiersToRun } from '../../../../testkit/tier';
import { resolveFixturePath, resolveFixturesDir } from '../../../../testkit/fixtures';

describe('Golden fixture conversions (CHARX/Voxta)', () => {
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

  describeWithFixtures('CHARX → import → Voxta export', () => {
    it('preserves alternate greetings', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

      const charxPath = resolveFixturePath(fixturesDir, 'synthetic/generated/charx_with_assets.charx');
      const charxBuffer = readFileSync(charxPath);
      const original = parseCard(new Uint8Array(charxBuffer), { extractAssets: false });
      const originalAlt = original.card.data.alternate_greetings || [];
      expect(originalAlt.length).toBeGreaterThan(0);

      const form = new FormData();
      form.append('file', charxBuffer, { filename: basename(charxPath), contentType: 'application/zip' });

      const importResp = await app.inject({
        method: 'POST',
        url: '/api/import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect([200, 201]).toContain(importResp.statusCode);
      const importResult = JSON.parse(importResp.body);
      const cardId = importResult.card.meta.id as string;
      createdCardIds.push(cardId);

      const voxtaResp = await app.inject({
        method: 'GET',
        url: `/api/cards/${cardId}/export?format=voxta`,
      });
      expect(voxtaResp.statusCode).toBe(200);

      const exported = parseCard(new Uint8Array(voxtaResp.rawPayload), { extractAssets: false });
      const exportedAlt = exported.card.data.alternate_greetings || [];
      expect(exportedAlt).toEqual(originalAlt);
    });
  });

  describeWithFixtures('Voxta multi-character packages', () => {
    const tiers = getFixtureTiersToRun();
    const itExtended = tiers.includes('extended') ? it : it.skip;

    itExtended('imports as collection and re-exports original package', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

      const voxpkgPath = resolveFixturePath(fixturesDir, 'extended/voxta/multi_char_scenario.voxpkg');
      const originalBuffer = readFileSync(voxpkgPath);
      const originalPackage = readVoxta(new Uint8Array(originalBuffer));
      expect(originalPackage.characters.length).toBeGreaterThan(1);

      const form = new FormData();
      form.append('file', originalBuffer, { filename: basename(voxpkgPath), contentType: 'application/zip' });

      const importResp = await app.inject({
        method: 'POST',
        url: '/api/import-voxta',
        payload: form,
        headers: form.getHeaders(),
      });

      expect([200, 201]).toContain(importResp.statusCode);
      const importResult = JSON.parse(importResp.body);
      const cards = importResult.cards || [];
      expect(cards.length).toBeGreaterThan(1);
      createdCardIds.push(...cards.map((c: any) => c?.meta?.id).filter(Boolean));

      const collection = cards.find((c: any) => c?.meta?.spec === 'collection');
      expect(collection).toBeTruthy();

      const exportResp = await app.inject({
        method: 'GET',
        url: `/api/cards/${collection.meta.id}/export?format=voxta`,
      });

      expect(exportResp.statusCode).toBe(200);
      const exportedPackage = readVoxta(new Uint8Array(exportResp.rawPayload));

      // Collection export should return the stored original .voxpkg (same character count).
      expect(exportedPackage.characters.length).toBe(originalPackage.characters.length);
      expect(exportedPackage.scenarios.length).toBe(originalPackage.scenarios.length);
    });
  });
});

