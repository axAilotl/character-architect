import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { build } from '../app.js';

async function createSolidPng(
  color: { r: number; g: number; b: number; alpha?: number },
  size = 64
): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: color.r, g: color.g, b: color.b, alpha: color.alpha ?? 1 },
    },
  })
    .png()
    .toBuffer();
}

async function getAverageRgb(imageBytes: Uint8Array): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(imageBytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const pixels = info.width * info.height;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;

  for (let i = 0; i < data.length; i += channels) {
    rSum += data[i]!;
    gSum += data[i + 1]!;
    bSum += data[i + 2]!;
  }

  return { r: rSum / pixels, g: gSum / pixels, b: bSum / pixels };
}

function expectMostlyBlue(rgb: { r: number; g: number; b: number }) {
  expect(rgb.b).toBeGreaterThan(200);
  expect(rgb.r).toBeLessThan(80);
  expect(rgb.g).toBeLessThan(80);
}

function expectMostlyRed(rgb: { r: number; g: number; b: number }) {
  expect(rgb.r).toBeGreaterThan(200);
  expect(rgb.g).toBeLessThan(80);
  expect(rgb.b).toBeLessThan(80);
}

function extractMainIconFromCharx(zipBytes: Uint8Array): Uint8Array {
  const unzipped = unzipSync(zipBytes);
  const iconPath = Object.keys(unzipped).find((p) => {
    const lower = p.toLowerCase();
    if (!lower.startsWith('assets/') && !lower.startsWith('icon/')) return false;
    return /\/main\.(png|webp|jpe?g)$/.test(lower);
  });
  expect(iconPath).toBeDefined();
  return unzipped[iconPath!]!;
}

describe('CHARX icon selection', () => {
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

  async function createV3Card(name: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cards',
      payload: {
        data: {
          spec: 'chara_card_v3',
          spec_version: '3.0',
          data: {
            name,
            description: 'Test card for CHARX icon selection',
            personality: '',
            scenario: '',
            first_mes: 'Hello',
            mes_example: '',
            creator: 'Test',
            character_version: '1.0',
            tags: [],
            alternate_greetings: [],
            group_only_greetings: [],
          },
        },
        meta: { name, spec: 'v3', tags: [] },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    const id = body.meta.id as string;
    createdCardIds.push(id);
    return id;
  }

  async function uploadCardImage(cardId: string, image: Buffer, filename: string) {
    const form = new FormData();
    form.append('file', image, { filename, contentType: 'image/png' });
    const response = await app.inject({
      method: 'POST',
      url: `/api/cards/${cardId}/image`,
      payload: form,
      headers: form.getHeaders(),
    });
    expect([200, 201]).toContain(response.statusCode);
  }

  async function uploadMainIconAsset(cardId: string, image: Buffer, filename: string) {
    const form = new FormData();
    form.append('file', image, { filename, contentType: 'image/png' });
    const response = await app.inject({
      method: 'POST',
      url: `/api/cards/${cardId}/assets/upload?type=icon&isMain=true&name=main`,
      payload: form,
      headers: form.getHeaders(),
    });
    expect([200, 201]).toContain(response.statusCode);
  }

  async function exportCharx(cardId: string): Promise<Uint8Array> {
    const response = await app.inject({
      method: 'GET',
      url: `/api/cards/${cardId}/export?format=charx`,
    });
    expect(response.statusCode).toBe(200);
    return new Uint8Array(response.rawPayload);
  }

  it('uses card image as main icon when no explicit icon asset exists', async () => {
    const cardId = await createV3Card('Default Icon Test');

    const blue = await createSolidPng({ r: 0, g: 0, b: 255 });
    await uploadCardImage(cardId, blue, 'card.png');

    const charx = await exportCharx(cardId);
    const iconBytes = extractMainIconFromCharx(charx);
    const avg = await getAverageRgb(iconBytes);
    expectMostlyBlue(avg);
  });

  it('prefers an explicit main icon asset over the card image', async () => {
    const cardId = await createV3Card('Explicit Icon Test');

    const blue = await createSolidPng({ r: 0, g: 0, b: 255 });
    await uploadCardImage(cardId, blue, 'card.png');

    const red = await createSolidPng({ r: 255, g: 0, b: 0 });
    await uploadMainIconAsset(cardId, red, 'main.png');

    const charx = await exportCharx(cardId);
    const iconBytes = extractMainIconFromCharx(charx);
    const avg = await getAverageRgb(iconBytes);
    expectMostlyRed(avg);
  });
});
