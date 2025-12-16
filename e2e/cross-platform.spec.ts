import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { parseCard } from '@character-foundry/character-foundry/loader';
import { normalize } from '@character-foundry/character-foundry/normalizer';
import { resolveFixturePath, resolveFixturesDir } from '../testkit/fixtures';
import { waitForAppLoad } from './utils/test-helpers';

const LOCAL_URL = process.env.FULL_MODE_URL || 'http://localhost:5173';
const PRODUCTION_URL = process.env.PRODUCTION_URL;

test.describe('Deployed smoke (local vs production)', () => {
  test.skip(!PRODUCTION_URL, 'PRODUCTION_URL environment variable not set');

  test('imports + exports a golden fixture on both targets', async ({ browser }, testInfo) => {
    test.setTimeout(300000);

    const allowMissing = process.env.CF_ALLOW_MISSING_FIXTURES === '1';
    const fixturesDir = resolveFixturesDir({ allowMissing });
    test.skip(!fixturesDir, 'CF_FIXTURES_DIR is required');

    const fixtureAbs = resolveFixturePath(fixturesDir!, 'basic/png/baseline_v3_small.png');
    const baselineBytes = readFileSync(fixtureAbs);
    const baselineParsed = parseCard(new Uint8Array(baselineBytes), { extractAssets: false });
    const baselineNormalized = normalize(baselineParsed.card);

    async function runOnTarget(baseURL: string, label: string) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await page.goto('/');
        await waitForAppLoad(page);

        await page.getByRole('button', { name: /^Import/ }).first().click();
        const fileInput = page.locator('input#import-card-file');
        if (await fileInput.count()) {
          await fileInput.setInputFiles(fixtureAbs);
        } else {
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            page.getByRole('button', { name: 'From File' }).first().click(),
          ]);
          await fileChooser.setFiles(fixtureAbs);
        }

        await page.waitForURL(/\/cards\//, { timeout: 60000 });
        await waitForAppLoad(page);

        const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
        await page.getByRole('button', { name: /^Export/ }).first().click();
        await page.getByRole('button', { name: 'JSON' }).first().click();

        const download = await downloadPromise;
        const outPath = testInfo.outputPath(`${label}-${download.suggestedFilename()}`);
        await download.saveAs(outPath);

        const exportedBytes = readFileSync(outPath);
        const exportedParsed = parseCard(new Uint8Array(exportedBytes), { extractAssets: false });
        expect(normalize(exportedParsed.card)).toEqual(baselineNormalized);
      } finally {
        await context.close();
      }
    }

    await runOnTarget(LOCAL_URL, 'local');
    await runOnTarget(PRODUCTION_URL!, 'production');
  });
});

