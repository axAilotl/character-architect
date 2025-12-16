import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'fs';
import { parseCard } from '@character-foundry/character-foundry/loader';
import { normalize } from '@character-foundry/character-foundry/normalizer';
import { getFixtureTiersToRun } from '../testkit/tier';
import { resolveFixturePath, resolveFixturesDir, unwrapDefinitionWrapperJson } from '../testkit/fixtures';
import { waitForAppLoad } from './utils/test-helpers';

type ExportFormat = 'JSON' | 'PNG' | 'CHARX' | 'Voxta';

function normalizeForCompare(card: unknown): unknown {
  return JSON.parse(JSON.stringify(normalize(card as any)));
}

function pickVoxtaStableFields(normalized: any): Record<string, unknown> {
  return {
    name: normalized?.name,
    description: normalized?.description,
    personality: normalized?.personality,
    scenario: normalized?.scenario,
    firstMes: normalized?.firstMes,
    mesExample: normalized?.mesExample,
    systemPrompt: normalized?.systemPrompt,
    postHistoryInstructions: normalized?.postHistoryInstructions,
    creatorNotes: normalized?.creatorNotes,
    alternateGreetings: normalized?.alternateGreetings,
    groupOnlyGreetings: normalized?.groupOnlyGreetings,
    tags: normalized?.tags,
    creator: normalized?.creator,
    characterVersion: normalized?.characterVersion,
  };
}

function isAllowedHttpError(url: string, status: number): boolean {
  try {
    const { pathname } = new URL(url);
    if (status === 404 && pathname === '/favicon.ico') return true;
    if (status === 404 && /^\/api\/cards\/[^/]+\/(image|thumbnail)$/.test(pathname)) return true;
  } catch {
    // ignore
  }
  return false;
}

async function importFromDashboard(page: Page, filePath: string) {
  await page.goto('/');
  await waitForAppLoad(page);

  await page.getByRole('button', { name: /^Import/ }).first().click();

  const fileInput = page.locator('input#import-card-file');
  if (await fileInput.count()) {
    await fileInput.setInputFiles(filePath);
  } else {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10000 }),
      page.getByRole('button', { name: 'From File' }).first().click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  await page.waitForURL(/\/cards\//, { timeout: 60000 });
  await waitForAppLoad(page);
}

async function exportFromHeader(page: Page, format: ExportFormat, testInfo: TestInfo): Promise<Uint8Array> {
  const downloadPromise = page.waitForEvent('download', { timeout: 180000 });

  await page.getByRole('button', { name: /^Export/ }).first().click();
  const formatButton = page.getByRole('button', { name: format }).first();
  await expect(formatButton).toBeVisible({ timeout: 10000 });
  await formatButton.click();

  const download = await downloadPromise;
  const outPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(outPath);
  return new Uint8Array(readFileSync(outPath));
}

test.describe('Golden fixtures E2E (import -> export parity)', () => {
  const allowMissing = process.env.CF_ALLOW_MISSING_FIXTURES === '1';
  const fixturesDir = resolveFixturesDir({ allowMissing });
  const describeWithFixtures = fixturesDir ? test.describe : test.describe.skip;

  describeWithFixtures('basic + synthetic', () => {
    test.describe.configure({ mode: 'serial' });

    const tiers = getFixtureTiersToRun();
    const fixtures: Array<{ rel: string; exports: ExportFormat[] }> = [];

    if (tiers.includes('basic')) {
      fixtures.push(
        { rel: 'basic/json/v1_unwrapped.json', exports: ['JSON'] },
        { rel: 'basic/json/hybrid_format_v2.json', exports: ['JSON'] },
        { rel: 'basic/png/baseline_v3_small.png', exports: ['JSON', 'PNG', 'CHARX', 'Voxta'] },
        { rel: 'basic/charx/baseline_v3_small.charx', exports: ['JSON'] },
        { rel: 'basic/voxta/character_only_small.voxpkg', exports: ['JSON'] }
      );
    }

    if (tiers.includes('synthetic')) {
      fixtures.push(
        { rel: 'synthetic/generated/valid_v3_card.json', exports: ['JSON'] }
      );
    }

    for (const fixture of fixtures) {
      test(`preserves normalized card data: ${fixture.rel}`, async ({ page }, testInfo) => {
        test.setTimeout(240000);
        if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

        const absPath = resolveFixturePath(fixturesDir, fixture.rel);
        const rawBuffer = readFileSync(absPath);
        const baselineBuffer = absPath.endsWith('.json') ? unwrapDefinitionWrapperJson(rawBuffer) : rawBuffer;
        const baselineParsed = parseCard(new Uint8Array(baselineBuffer), { extractAssets: false });
        const baselineNormalized = normalizeForCompare(baselineParsed.card);

        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        const httpErrors: Array<{ url: string; status: number }> = [];
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', err => {
          pageErrors.push(err.message);
        });
        page.on('response', resp => {
          const status = resp.status();
          if (status >= 400) {
            httpErrors.push({ url: resp.url(), status });
          }
        });

        await importFromDashboard(page, absPath);
        await expect(page.getByRole('textbox').first()).not.toBeEmpty();

        for (const format of fixture.exports) {
          const exportedBytes = await exportFromHeader(page, format, testInfo);
          const exportedParsed = parseCard(exportedBytes, { extractAssets: false });
          const exportedNormalized = normalizeForCompare(exportedParsed.card);

          if (format === 'Voxta') {
            // Voxta export is not a lossless roundtrip: it drops most extensions and lorebook metadata.
            // Assert stable core fields match, and that the Voxta marker exists.
            expect(pickVoxtaStableFields(exportedNormalized)).toEqual(pickVoxtaStableFields(baselineNormalized));
            expect((exportedNormalized as any)?.extensions?.voxta).toBeTruthy();
          } else {
            expect(exportedNormalized).toEqual(baselineNormalized);
          }
        }

        expect(pageErrors).toEqual([]);

        const unexpectedHttp = httpErrors.filter(({ url, status }) => !isAllowedHttpError(url, status));
        expect(unexpectedHttp).toEqual([]);

        // Avoid failing on noisy browser network errors (we validate HTTP errors above).
        const filteredConsole = consoleErrors.filter((e) => {
          const lower = e.toLowerCase();
          if (lower.includes('favicon')) return false;
          if (lower.includes('failed to load resource') && lower.includes('404')) return false;
          return true;
        });
        expect(filteredConsole).toEqual([]);
      });
    }
  });
});
