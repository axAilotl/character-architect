import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { basename } from 'path';
import FormData from 'form-data';
import sharp from 'sharp';
import { parseCard } from '@character-foundry/character-foundry/loader';
import { normalize } from '@character-foundry/character-foundry/normalizer';
import { convertCardMacros, voxtaToStandard } from '../utils/file-handlers.js';
import { normalizeCardData } from '../handlers/index.js';
import { getFixtureTiersToRun } from '../../../../testkit/tier';
import { resolveFixturePath, resolveFixturesDir, unwrapDefinitionWrapperJson } from '../../../../testkit/fixtures';

function getMimeType(filePath: string): string {
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.json')) return 'application/json';
  // CHARX and VOXPKG are ZIP containers
  if (filePath.endsWith('.charx') || filePath.endsWith('.voxpkg')) return 'application/zip';
  return 'application/octet-stream';
}

async function createTestPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 120, g: 140, b: 180, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function normalizeForCompare(card: unknown, specHint?: 'v2' | 'v3'): unknown {
  const copy = JSON.parse(JSON.stringify(card)) as unknown;
  if (specHint) normalizeCardData(copy, specHint);
  return JSON.parse(JSON.stringify(normalize(copy as any)));
}

describe('Golden fixtures (import/export parity)', () => {
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

  describeWithFixtures('basic + synthetic fixtures', () => {
    const tiersToRun = getFixtureTiersToRun();
    const fixtures: Array<{ rel: string; endpoint: '/api/import' | '/api/import-voxta' }> = [];

    if (tiersToRun.includes('basic')) {
      fixtures.push(
        { rel: 'basic/json/v1_unwrapped.json', endpoint: '/api/import' },
        { rel: 'basic/json/hybrid_format_v2.json', endpoint: '/api/import' },
        { rel: 'basic/json/null_character_book_v2.json', endpoint: '/api/import' },
        { rel: 'basic/json/null_character_book_v3.json', endpoint: '/api/import' },
        { rel: 'basic/png/baseline_v3_small.png', endpoint: '/api/import' },
        { rel: 'basic/charx/baseline_v3_small.charx', endpoint: '/api/import' },
        { rel: 'basic/voxta/character_only_small.voxpkg', endpoint: '/api/import-voxta' }
      );
    }

    if (tiersToRun.includes('synthetic')) {
      fixtures.push(
        { rel: 'synthetic/generated/valid_v2_card.json', endpoint: '/api/import' },
        { rel: 'synthetic/generated/valid_v3_card.json', endpoint: '/api/import' },
        { rel: 'synthetic/generated/charx_with_assets.charx', endpoint: '/api/import' }
      );
    }

    for (const fixture of fixtures) {
      it(`import -> export (json/png/charx) preserves normalized data: ${fixture.rel}`, async () => {
        if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

        const absPath = resolveFixturePath(fixturesDir, fixture.rel);
        const rawBuffer = readFileSync(absPath);
        const baselineBuffer = absPath.endsWith('.json') ? unwrapDefinitionWrapperJson(rawBuffer) : rawBuffer;
        const baselineParsed = parseCard(new Uint8Array(baselineBuffer), { extractAssets: false });
        const baselineCard = absPath.endsWith('.voxpkg')
          ? convertCardMacros(baselineParsed.card as unknown as Record<string, unknown>, voxtaToStandard)
          : baselineParsed.card;
        const baselineNormalized = normalizeForCompare(baselineCard, baselineParsed.spec);

        const filename = basename(absPath);
        const mimetype = getMimeType(absPath);

        const form = new FormData();
        form.append('file', rawBuffer, { filename, contentType: mimetype });

        const importResp = await app.inject({
          method: 'POST',
          url: fixture.endpoint,
          payload: form,
          headers: form.getHeaders(),
        });

        expect([200, 201]).toContain(importResp.statusCode);
        const importResult = JSON.parse(importResp.body);

        const importedCards = fixture.endpoint === '/api/import-voxta'
          ? (importResult.cards || [])
          : (importResult.card ? [importResult.card] : []);

        expect(importedCards.length).toBeGreaterThan(0);

        // Pick the first non-collection card if present, otherwise the first card.
        const target = importedCards.find((c: any) => c?.meta?.spec !== 'collection') || importedCards[0];
        const cardId = target.meta.id as string;
        createdCardIds.push(cardId);

        // Ensure we can export CHARX/Voxta by giving the card an image.
        const testImage = await createTestPng();
        const imageForm = new FormData();
        imageForm.append('file', testImage, { filename: 'test.png', contentType: 'image/png' });
        await app.inject({
          method: 'POST',
          url: `/api/cards/${cardId}/image`,
          payload: imageForm,
          headers: imageForm.getHeaders(),
        });

        // Export JSON
        const jsonResp = await app.inject({
          method: 'GET',
          url: `/api/cards/${cardId}/export?format=json`,
        });
        expect(jsonResp.statusCode).toBe(200);
        const jsonBytes = new TextEncoder().encode(jsonResp.body);
        const jsonParsed = parseCard(jsonBytes, { extractAssets: false });
        expect(normalizeForCompare(jsonParsed.card, jsonParsed.spec)).toEqual(baselineNormalized);

        // Export PNG
        const pngResp = await app.inject({
          method: 'GET',
          url: `/api/cards/${cardId}/export?format=png`,
        });
        expect(pngResp.statusCode).toBe(200);
        const pngParsed = parseCard(new Uint8Array(pngResp.rawPayload), { extractAssets: false });
        expect(normalizeForCompare(pngParsed.card, pngParsed.spec)).toEqual(baselineNormalized);

        // Export CHARX (skip only for collections; collections are not character cards)
        const cardSpec = target.meta.spec;
        if (cardSpec !== 'collection') {
          const charxResp = await app.inject({
            method: 'GET',
            url: `/api/cards/${cardId}/export?format=charx`,
          });
          expect(charxResp.statusCode).toBe(200);
          const charxParsed = parseCard(new Uint8Array(charxResp.rawPayload), { extractAssets: false });
          expect(normalizeForCompare(charxParsed.card, charxParsed.spec)).toEqual(baselineNormalized);
        }
      });
    }
  });
});
