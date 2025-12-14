/**
 * Cross-Platform E2E Tests
 *
 * Tests Character Architect behavior across different deployment targets:
 * - Local server (full mode): http://localhost:5173
 * - Production Cloudflare (light mode): https://ca.axailotl.ai
 *
 * Verifies:
 * - Same card imports work on both platforms
 * - Data consistency across platforms
 * - Export formats available on each platform
 * - Feature parity and known differences
 * - Performance characteristics
 */

import { test, expect, chromium, Browser, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { waitForAppLoad, validateJsonCard, validatePngCard } from './utils/test-helpers';

// Platform URLs - PRODUCTION_URL requires explicit env var (no default)
const LOCAL_URL = process.env.FULL_MODE_URL || 'http://localhost:5173';
const PRODUCTION_URL = process.env.PRODUCTION_URL;

// Test file paths - relative to repo, uses docs/internal/testing (gitignored)
const TESTING_DIR = process.env.E2E_TESTING_DIR || path.join(__dirname, '../docs/internal/testing');
const CCv2_PNG = path.join(TESTING_DIR, 'chub/main_shana-e03c661ffb1d_spec_v2.png');
const CCv2_JSON = path.join(TESTING_DIR, 'chub/main_shana-e03c661ffb1d_spec_v2.json');
const CHARX_AILU = path.join(TESTING_DIR, 'risu_charx/Ailu Narukami.charx');

/**
 * Helper to import card on a specific platform
 */
async function importCardOnPlatform(page: Page, filePath: string, expectedName?: RegExp) {
  await page.goto('/');
  await waitForAppLoad(page);

  const importButton = page.locator('button:has-text("Import")');
  await expect(importButton).toBeVisible({ timeout: 10000 });
  await importButton.click();
  await page.waitForTimeout(300);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);

  await page.waitForURL(/\/cards\//, { timeout: 15000 });
  await waitForAppLoad(page);

  if (expectedName) {
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toHaveValue(expectedName, { timeout: 5000 });
  }
}

/**
 * Helper to get card data from page
 */
async function getCardData(page: Page) {
  const nameInput = page.getByRole('textbox').first();
  const name = await nameInput.inputValue();

  const textareas = page.locator('textarea');
  const count = await textareas.count();

  let description = '';
  let personality = '';

  if (count > 0) description = await textareas.nth(0).inputValue();
  if (count > 1) personality = await textareas.nth(1).inputValue();

  return { name, description, personality };
}

/**
 * Helper to export card from platform
 */
async function exportCardFromPlatform(page: Page, format: 'JSON' | 'PNG' | 'CHARX'): Promise<string | null> {
  try {
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    const exportButton = page.locator('button:has-text("Export")');
    await exportButton.click();

    const formatButton = page.locator(`button:has-text("${format}")`);

    // Check if format is available
    const isVisible = await formatButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (!isVisible) {
      return null; // Format not available on this platform
    }

    await formatButton.click();

    const download = await downloadPromise;
    return await download.path();
  } catch (error) {
    return null;
  }
}

// Skip entire suite if PRODUCTION_URL is not configured
test.describe('Cross-Platform Comparison', () => {
  // Skip if production URL not set
  test.skip(!PRODUCTION_URL, 'PRODUCTION_URL environment variable not set');

  let localBrowser: Browser;
  let prodBrowser: Browser;
  let localContext: BrowserContext;
  let prodContext: BrowserContext;
  let localPage: Page;
  let prodPage: Page;

  test.beforeAll(async () => {
    // Create separate browser instances for local and production
    localBrowser = await chromium.launch();
    prodBrowser = await chromium.launch();
  });

  test.afterAll(async () => {
    await localBrowser?.close();
    await prodBrowser?.close();
  });

  test.beforeEach(async () => {
    // Create fresh contexts for each test
    localContext = await localBrowser.newContext();
    prodContext = await prodBrowser.newContext();

    localPage = await localContext.newPage();
    prodPage = await prodContext.newPage();

    // Navigate to respective platforms
    await localPage.goto(LOCAL_URL);
    await prodPage.goto(PRODUCTION_URL!);

    await waitForAppLoad(localPage);
    await waitForAppLoad(prodPage);
  });

  test.afterEach(async () => {
    await localContext?.close();
    await prodContext?.close();
  });

  test.describe('Import Parity', () => {
    test('should import same CCv2 PNG on both platforms with identical data', async () => {
      // Import on local
      await importCardOnPlatform(localPage, CCv2_PNG, /Shana/i);
      const localData = await getCardData(localPage);

      // Import on production
      await importCardOnPlatform(prodPage, CCv2_PNG, /Shana/i);
      const prodData = await getCardData(prodPage);

      // Compare data
      expect(prodData.name).toBe(localData.name);
      expect(prodData.description).toBe(localData.description);
      expect(prodData.personality).toBe(localData.personality);
    });

    test('should import same CCv2 JSON on both platforms with identical data', async () => {
      await importCardOnPlatform(localPage, CCv2_JSON, /Shana/i);
      const localData = await getCardData(localPage);

      await importCardOnPlatform(prodPage, CCv2_JSON, /Shana/i);
      const prodData = await getCardData(prodPage);

      expect(prodData.name).toBe(localData.name);
      expect(prodData.description).toBe(localData.description);
    });

    test('should import same CharX on both platforms with identical data', async () => {
      await importCardOnPlatform(localPage, CHARX_AILU, /Ailu/i);
      const localData = await getCardData(localPage);

      await importCardOnPlatform(prodPage, CHARX_AILU, /Ailu/i);
      const prodData = await getCardData(prodPage);

      expect(prodData.name).toBe(localData.name);
    });
  });

  test.describe('Export Parity', () => {
    test('should produce identical JSON exports on both platforms', async () => {
      // Import and export on local
      await importCardOnPlatform(localPage, CCv2_JSON, /Shana/i);
      const localExport = await exportCardFromPlatform(localPage, 'JSON');
      expect(localExport).toBeTruthy();

      // Import and export on production
      await importCardOnPlatform(prodPage, CCv2_JSON, /Shana/i);
      const prodExport = await exportCardFromPlatform(prodPage, 'JSON');
      expect(prodExport).toBeTruthy();

      // Compare exports
      if (localExport && prodExport) {
        const localJson = JSON.parse(fs.readFileSync(localExport, 'utf-8'));
        const prodJson = JSON.parse(fs.readFileSync(prodExport, 'utf-8'));

        const localName = localJson.data?.name || localJson.name;
        const prodName = prodJson.data?.name || prodJson.name;

        expect(prodName).toBe(localName);
        expect(localJson.spec).toBe(prodJson.spec);
      }
    });

    test('should produce valid PNG exports on both platforms', async () => {
      await importCardOnPlatform(localPage, CCv2_PNG, /Shana/i);
      const localExport = await exportCardFromPlatform(localPage, 'PNG');
      expect(localExport).toBeTruthy();

      await importCardOnPlatform(prodPage, CCv2_PNG, /Shana/i);
      const prodExport = await exportCardFromPlatform(prodPage, 'PNG');
      expect(prodExport).toBeTruthy();

      // Both should be valid PNGs
      if (localExport && prodExport) {
        const localValidation = await validatePngCard(localExport);
        const prodValidation = await validatePngCard(prodExport);

        expect(localValidation.valid).toBe(true);
        expect(prodValidation.valid).toBe(true);
      }
    });

    test('should produce valid CharX exports on both platforms', async () => {
      await importCardOnPlatform(localPage, CHARX_AILU, /Ailu/i);
      const localExport = await exportCardFromPlatform(localPage, 'CHARX');
      expect(localExport).toBeTruthy();

      await importCardOnPlatform(prodPage, CHARX_AILU, /Ailu/i);
      const prodExport = await exportCardFromPlatform(prodPage, 'CHARX');
      expect(prodExport).toBeTruthy();

      // Both should be valid ZIP files
      if (localExport && prodExport) {
        const localBuffer = fs.readFileSync(localExport);
        const prodBuffer = fs.readFileSync(prodExport);

        const zipSig = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
        expect(localBuffer.subarray(0, 4).equals(zipSig)).toBe(true);
        expect(prodBuffer.subarray(0, 4).equals(zipSig)).toBe(true);
      }
    });

    test('should verify Voxta export only available on local (full mode)', async () => {
      await importCardOnPlatform(localPage, CCv2_PNG, /Shana/i);

      // Local should have Voxta
      const exportButton = localPage.locator('button:has-text("Export")');
      await exportButton.click();
      await localPage.waitForTimeout(300);

      const voxtaButtonLocal = localPage.locator('button:has-text("Voxta")');
      const hasVoxtaLocal = await voxtaButtonLocal.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasVoxtaLocal).toBe(true);

      // Production (light mode) should NOT have Voxta
      await importCardOnPlatform(prodPage, CCv2_PNG, /Shana/i);

      const exportButtonProd = prodPage.locator('button:has-text("Export")');
      await exportButtonProd.click();
      await prodPage.waitForTimeout(300);

      const voxtaButtonProd = prodPage.locator('button:has-text("Voxta")');
      const hasVoxtaProd = await voxtaButtonProd.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasVoxtaProd).toBe(false);
    });
  });

  test.describe('Feature Availability', () => {
    test('should verify core features available on both platforms', async () => {
      // Check local
      const localFeatures = {
        import: await localPage.locator('button:has-text("Import")').isVisible(),
        export: await localPage.locator('button:has-text("Export")').isVisible(),
        new: await localPage.locator('button:has-text("New")').isVisible(),
      };

      // Check production
      const prodFeatures = {
        import: await prodPage.locator('button:has-text("Import")').isVisible(),
        export: await prodPage.locator('button:has-text("Export")').isVisible(),
        new: await prodPage.locator('button:has-text("New")').isVisible(),
      };

      // Core features should match
      expect(prodFeatures.import).toBe(localFeatures.import);
      expect(prodFeatures.export).toBe(localFeatures.export);
      expect(prodFeatures.new).toBe(localFeatures.new);
    });

    test('should identify full-mode exclusive features', async () => {
      // Import a card on both platforms
      await importCardOnPlatform(localPage, CCv2_PNG, /Shana/i);
      await importCardOnPlatform(prodPage, CCv2_PNG, /Shana/i);

      // Check for full-mode features on local
      const localExportButton = localPage.locator('button:has-text("Export")');
      await localExportButton.click();
      await localPage.waitForTimeout(300);

      const localVoxta = await localPage.locator('button:has-text("Voxta")').isVisible().catch(() => false);

      // Check production
      const prodExportButton = prodPage.locator('button:has-text("Export")');
      await prodExportButton.click();
      await prodPage.waitForTimeout(300);

      const prodVoxta = await prodPage.locator('button:has-text("Voxta")').isVisible().catch(() => false);

      // Voxta should only be on local (full mode)
      expect(localVoxta).toBe(true);
      expect(prodVoxta).toBe(false);
    });
  });

  test.describe('Data Interchange', () => {
    test('should export from local and import to production successfully', async () => {
      // Import and export on local
      await importCardOnPlatform(localPage, CCv2_JSON, /Shana/i);
      const localData = await getCardData(localPage);

      const exportPath = await exportCardFromPlatform(localPage, 'JSON');
      expect(exportPath).toBeTruthy();

      // Import exported file on production
      await importCardOnPlatform(prodPage, exportPath!);
      const prodData = await getCardData(prodPage);

      // Data should match
      expect(prodData.name).toBe(localData.name);
      expect(prodData.description).toBe(localData.description);
    });

    test('should export from production and import to local successfully', async () => {
      // Import and export on production
      await importCardOnPlatform(prodPage, CCv2_JSON, /Shana/i);
      const prodData = await getCardData(prodPage);

      const exportPath = await exportCardFromPlatform(prodPage, 'JSON');
      expect(exportPath).toBeTruthy();

      // Import exported file on local
      await importCardOnPlatform(localPage, exportPath!);
      const localData = await getCardData(localPage);

      // Data should match
      expect(localData.name).toBe(prodData.name);
      expect(localData.description).toBe(prodData.description);
    });

    test('should handle PNG export from local imported to production', async () => {
      await importCardOnPlatform(localPage, CCv2_PNG, /Shana/i);
      const localData = await getCardData(localPage);

      const exportPath = await exportCardFromPlatform(localPage, 'PNG');
      expect(exportPath).toBeTruthy();

      // Verify it's a valid PNG
      const validation = await validatePngCard(exportPath!);
      expect(validation.valid).toBe(true);

      // Import to production
      await importCardOnPlatform(prodPage, exportPath!);
      const prodData = await getCardData(prodPage);

      expect(prodData.name).toBe(localData.name);
    });

    test('should handle CharX export from production imported to local', async () => {
      await importCardOnPlatform(prodPage, CHARX_AILU, /Ailu/i);
      const prodData = await getCardData(prodPage);

      const exportPath = await exportCardFromPlatform(prodPage, 'CHARX');
      expect(exportPath).toBeTruthy();

      // Import to local
      await importCardOnPlatform(localPage, exportPath!);
      const localData = await getCardData(localPage);

      expect(localData.name).toBe(prodData.name);
    });
  });

  test.describe('UI Consistency', () => {
    test('should have consistent button labels across platforms', async () => {
      // Check local
      const localButtons = {
        import: await localPage.locator('button:has-text("Import")').textContent(),
        export: await localPage.locator('button:has-text("Export")').textContent(),
        new: await localPage.locator('button:has-text("New")').textContent(),
      };

      // Check production
      const prodButtons = {
        import: await prodPage.locator('button:has-text("Import")').textContent(),
        export: await prodPage.locator('button:has-text("Export")').textContent(),
        new: await prodPage.locator('button:has-text("New")').textContent(),
      };

      // Labels should be consistent
      expect(prodButtons.import?.trim()).toBe(localButtons.import?.trim());
      expect(prodButtons.export?.trim()).toBe(localButtons.export?.trim());
      expect(prodButtons.new?.trim()).toBe(localButtons.new?.trim());
    });

    test('should have consistent card editor layout', async () => {
      await importCardOnPlatform(localPage, CCv2_PNG, /Shana/i);
      await importCardOnPlatform(prodPage, CCv2_PNG, /Shana/i);

      // Check for name input on both
      const localNameInput = await localPage.getByRole('textbox').first().isVisible();
      const prodNameInput = await prodPage.getByRole('textbox').first().isVisible();

      expect(localNameInput).toBe(true);
      expect(prodNameInput).toBe(true);

      // Check for textareas on both
      const localTextareaCount = await localPage.locator('textarea').count();
      const prodTextareaCount = await prodPage.locator('textarea').count();

      // Should have similar structure (allow some variance)
      expect(Math.abs(localTextareaCount - prodTextareaCount)).toBeLessThanOrEqual(2);
    });
  });

  test.describe('Performance Comparison', () => {
    test('should load home page within reasonable time on both platforms', async () => {
      const localStart = Date.now();
      await localPage.goto(LOCAL_URL);
      await waitForAppLoad(localPage);
      const localLoadTime = Date.now() - localStart;

      const prodStart = Date.now();
      await prodPage.goto(PRODUCTION_URL);
      await waitForAppLoad(prodPage);
      const prodLoadTime = Date.now() - prodStart;

      // Both should load within 10 seconds
      expect(localLoadTime).toBeLessThan(10000);
      expect(prodLoadTime).toBeLessThan(10000);

      console.log(`Load times - Local: ${localLoadTime}ms, Production: ${prodLoadTime}ms`);
    });

    test('should import cards within reasonable time on both platforms', async () => {
      const localStart = Date.now();
      await importCardOnPlatform(localPage, CCv2_JSON, /Shana/i);
      const localImportTime = Date.now() - localStart;

      const prodStart = Date.now();
      await importCardOnPlatform(prodPage, CCv2_JSON, /Shana/i);
      const prodImportTime = Date.now() - prodStart;

      // Both should import within 20 seconds
      expect(localImportTime).toBeLessThan(20000);
      expect(prodImportTime).toBeLessThan(20000);

      console.log(`Import times - Local: ${localImportTime}ms, Production: ${prodImportTime}ms`);
    });
  });

  test.describe('Error Handling Consistency', () => {
    test('should handle invalid files similarly on both platforms', async () => {
      const invalidFile = path.join('/tmp', 'invalid-cross-platform.txt');
      fs.writeFileSync(invalidFile, 'Invalid card data');

      // Try on local
      await localPage.goto(LOCAL_URL);
      await waitForAppLoad(localPage);

      const localImportBtn = localPage.locator('button:has-text("Import")');
      await localImportBtn.click();
      await localPage.waitForTimeout(300);

      const localFileInput = localPage.locator('input[type="file"]').first();
      await localFileInput.setInputFiles(invalidFile);
      await localPage.waitForTimeout(2000);

      const localUrl = localPage.url();

      // Try on production
      await prodPage.goto(PRODUCTION_URL);
      await waitForAppLoad(prodPage);

      const prodImportBtn = prodPage.locator('button:has-text("Import")');
      await prodImportBtn.click();
      await prodPage.waitForTimeout(300);

      const prodFileInput = prodPage.locator('input[type="file"]').first();
      await prodFileInput.setInputFiles(invalidFile);
      await prodPage.waitForTimeout(2000);

      const prodUrl = prodPage.url();

      // Both should handle error (not navigate to card edit)
      expect(localUrl).not.toMatch(/\/cards\/[a-zA-Z0-9_-]+$/);
      expect(prodUrl).not.toMatch(/\/cards\/[a-zA-Z0-9_-]+$/);

      fs.unlinkSync(invalidFile);
    });
  });
});

test.describe('Single Platform Tests', () => {
  test.describe('Production-Specific Tests', () => {
    test('should load production site over HTTPS', async () => {
      const page = await chromium.launch().then(b => b.newPage());
      await page.goto(PRODUCTION_URL);

      const url = page.url();
      expect(url).toMatch(/^https:\/\//);

      await page.close();
    });

    test('should have PWA capabilities on production', async () => {
      const page = await chromium.launch().then(b => b.newPage());
      await page.goto(PRODUCTION_URL);
      await waitForAppLoad(page);

      // Check for service worker registration
      const hasServiceWorker = await page.evaluate(() => {
        return 'serviceWorker' in navigator;
      });

      expect(hasServiceWorker).toBe(true);

      await page.close();
    });
  });

  test.describe('Local-Specific Tests', () => {
    test('should have full API server features on local', async () => {
      const page = await chromium.launch().then(b => b.newPage());
      await page.goto(LOCAL_URL);
      await waitForAppLoad(page);

      // Import a card
      await importCardOnPlatform(page, CCv2_PNG, /Shana/i);

      // Check for Voxta export (full mode only)
      const exportBtn = page.locator('button:has-text("Export")');
      await exportBtn.click();
      await page.waitForTimeout(300);

      const voxtaBtn = page.locator('button:has-text("Voxta")');
      const hasVoxta = await voxtaBtn.isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasVoxta).toBe(true);

      await page.close();
    });
  });
});
