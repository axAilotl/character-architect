import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { build } from '../app.js';
import { validateV2, validateV3 } from '../utils/validation.js';
import { resolveFixturePath, resolveFixturesDir } from '../../../../testkit/fixtures';

describe('Convert endpoint (/api/convert)', () => {
  const allowMissing = process.env.CF_ALLOW_MISSING_FIXTURES === '1';
  const fixturesDir = resolveFixturesDir({ allowMissing });
  const describeWithFixtures = fixturesDir ? describe : describe.skip;

  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describeWithFixtures('v2 ↔ v3 conversion', () => {
    it('converts wrapped CCv2 -> CCv3 and preserves core fields', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

      const abs = resolveFixturePath(fixturesDir, 'synthetic/generated/valid_v2_card.json');
      const v2Wrapped = JSON.parse(readFileSync(abs, 'utf-8')) as any;
      const v2Data = v2Wrapped.data || v2Wrapped;

      const resp = await app.inject({
        method: 'POST',
        url: '/api/convert',
        payload: {
          from: 'v2',
          to: 'v3',
          card: v2Wrapped,
        },
      });

      expect(resp.statusCode).toBe(200);
      const converted = JSON.parse(resp.body) as any;
      expect(converted.spec).toBe('chara_card_v3');
      expect(converted.spec_version).toBe('3.0');

      const v3Data = converted.data;
      expect(v3Data.name).toBe(v2Data.name);
      expect(v3Data.description).toBe(v2Data.description);
      expect(v3Data.first_mes).toBe(v2Data.first_mes);
      expect(v3Data.mes_example).toBe(v2Data.mes_example);
      expect(v3Data.tags).toEqual(v2Data.tags);

      expect(validateV3(converted).valid).toBe(true);
    });

    it('converts CCv3 -> CCv2 and preserves core fields', async () => {
      if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

      const abs = resolveFixturePath(fixturesDir, 'synthetic/generated/valid_v3_card.json');
      const v3Wrapped = JSON.parse(readFileSync(abs, 'utf-8')) as any;
      const v3Data = v3Wrapped.data || v3Wrapped;

      const resp = await app.inject({
        method: 'POST',
        url: '/api/convert',
        payload: {
          from: 'v3',
          to: 'v2',
          card: v3Wrapped,
        },
      });

      expect(resp.statusCode).toBe(200);
      const converted = JSON.parse(resp.body) as any;
      expect(converted.spec).toBeUndefined();

      const v2Data = converted.data || converted;
      expect(v2Data.name).toBe(v3Data.name);
      expect(v2Data.description).toBe(v3Data.description);
      expect(v2Data.first_mes).toBe(v3Data.first_mes);
      expect(v2Data.mes_example).toBe(v3Data.mes_example);
      expect(v2Data.tags).toEqual(v3Data.tags);

      expect(validateV2(converted).valid).toBe(true);
    });
  });
});

