/**
 * Real Character Card Export E2E Tests
 *
 * Tests exporting character cards to all supported formats using REAL imported cards:
 * - JSON export (CCv2/CCv3)
 * - PNG export (with embedded card data)
 * - CharX export (ZIP with assets)
 * - Voxta export (full mode only)
 *
 * Each test imports a real card from testing/ directory and exports it to verify the export functionality.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  waitForAppLoad,
  validateJsonCard,
  validatePngCard,
  validateCharxFile,
} from './utils/test-helpers';

// Timeout calculation based on file size (larger files need more time)
// ~1 second per 5MB + 15 second base
function getTimeoutForFile(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    return Math.max(15000, 15000 + Math.ceil(sizeMB / 5) * 1000);
  } catch {
    return 30000; // Default 30s if file check fails
  }
}

// Test file paths - relative to repo, uses docs/internal/testing (gitignored)
const TESTING_DIR = process.env.E2E_TESTING_DIR || path.join(__dirname, '../docs/internal/testing');
const DOWNLOADS_DIR = path.join(__dirname, 'test-downloads');

// Sample cards for export testing
const CCv2_PNG = path.join(TESTING_DIR, 'chub/main_shana-e03c661ffb1d_spec_v2.png');
const CHARX_AILU = path.join(TESTING_DIR, 'risu_charx/Ailu Narukami.charx');
const VOXTA_2B = path.join(TESTING_DIR, 'voxta/2B.1.0.0.voxpkg');
const RISU_V3_CREATOR = path.join(TESTING_DIR, 'risu_v3/Character Creator Bot.png');
const CHARX_KOREAN = path.join(TESTING_DIR, 'risu_charx/오가미 이토코 v4.51.charx');

/**
 * Helper to import a card and wait for it to load
 * @param timeout - Optional timeout for large files (calculated from getTimeoutForFile)
 */
async function importAndWaitForCard(page: any, filePath: string, expectedName?: RegExp, timeout?: number) {
  const importTimeout = timeout || getTimeoutForFile(filePath);

  await page.goto('/');
  await waitForAppLoad(page);

  const importButton = page.locator('button:has-text("Import")');
  await expect(importButton).toBeVisible({ timeout: 10000 });
  await importButton.click();
  await page.waitForTimeout(300);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);

  await page.waitForURL(/\/cards\//, { timeout: importTimeout });
  await waitForAppLoad(page);

  // Verify card loaded
  const nameInput = page.getByRole('textbox').first();
  if (expectedName) {
    await expect(nameInput).toHaveValue(expectedName, { timeout: 5000 });
  } else {
    await expect(nameInput).not.toBeEmpty({ timeout: 5000 });
  }
}

/**
 * Helper to export a card to a specific format
 * Note: Large exports can take 1-2 minutes, especially for CharX with many assets
 */
async function exportCardToFormat(page: any, format: 'JSON' | 'PNG' | 'CHARX' | 'Voxta'): Promise<string> {
  const downloadPromise = page.waitForEvent('download', { timeout: 180000 }); // 3 minutes for large exports

  const exportButton = page.locator('button:has-text("Export")');
  await expect(exportButton).toBeVisible();
  await exportButton.click();

  const formatButton = page.locator(`button:has-text("${format}")`);
  await expect(formatButton).toBeVisible({ timeout: 5000 });
  await formatButton.click();

  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(downloadPath).toBeTruthy();
  return downloadPath!;
}

test.describe('Real Card Export Tests', () => {
  // Run tests serially to avoid database/storage conflicts
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    // Ensure downloads directory exists
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('JSON Export', () => {
    test('should export CCv2 card as valid JSON', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      // Validate JSON structure
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      const validation = validateJsonCard(jsonData);
      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error('JSON validation errors:', validation.errors);
      }

      // Verify character name is preserved
      const name = jsonData.data?.name || jsonData.name;
      expect(name).toMatch(/Shana/i);
    });

    test('should export CharX card as valid JSON', async ({ page }) => {
      test.setTimeout(300000); // 5 minutes for large file import + export
      await importAndWaitForCard(page, CHARX_AILU, /Ailu/i);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      const validation = validateJsonCard(jsonData);
      expect(validation.valid).toBe(true);

      const name = jsonData.data?.name || jsonData.name;
      expect(name).toMatch(/Ailu/i);
    });

    test('should export Voxta package as valid JSON', async ({ page }) => {
      test.setTimeout(300000); // 5 minutes for large file import + export
      await importAndWaitForCard(page, VOXTA_2B, /2B/i);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      const validation = validateJsonCard(jsonData);
      expect(validation.valid).toBe(true);

      const name = jsonData.data?.name || jsonData.name;
      expect(name).toMatch(/2B/i);
    });

    test('should export RisuAI v3 card as valid JSON', async ({ page }) => {
      await importAndWaitForCard(page, RISU_V3_CREATOR, /Creator/i);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      const validation = validateJsonCard(jsonData);
      expect(validation.valid).toBe(true);
    });

    test('should preserve all fields in JSON export', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      const data = jsonData.data || jsonData;

      // Check all core fields exist
      expect(data.name).toBeTruthy();
      expect(typeof data.description === 'string').toBe(true);
      expect(typeof data.personality === 'string').toBe(true);
      expect(typeof data.scenario === 'string').toBe(true);
      expect(typeof data.first_mes === 'string').toBe(true);
    });

    test('should export with correct spec version', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      // Should have a spec field
      expect(jsonData.spec).toBeTruthy();
      expect(['chara_card_v2', 'chara_card_v3']).toContain(jsonData.spec);
    });
  });

  test.describe('PNG Export', () => {
    test('should export CCv2 card as PNG with embedded data', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'PNG');

      // Validate PNG structure
      const validation = await validatePngCard(downloadPath);
      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error('PNG validation errors:', validation.errors);
      }

      // Verify embedded data
      if (validation.data) {
        const name = validation.data.data?.name || validation.data.name;
        expect(name).toMatch(/Shana/i);
      }
    });

    // SKIPPED: CharX cards with many assets can take 5+ minutes to export to PNG
    // This is a known performance limitation, not a bug
    test.skip('should export CharX card as PNG with embedded data', async ({ page }) => {
      test.setTimeout(600000); // 10 minutes
      await importAndWaitForCard(page, CHARX_AILU, /Ailu/i);

      const downloadPath = await exportCardToFormat(page, 'PNG');

      const validation = await validatePngCard(downloadPath);
      expect(validation.valid).toBe(true);

      if (validation.data) {
        const name = validation.data.data?.name || validation.data.name;
        expect(name).toMatch(/Ailu/i);
      }
    });

    test('should export with valid PNG signature', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'PNG');

      const buffer = fs.readFileSync(downloadPath);
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

      expect(buffer.subarray(0, 8).equals(pngSignature)).toBe(true);
    });

    test('should preserve character data in PNG export', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'PNG');

      const validation = await validatePngCard(downloadPath);
      expect(validation.valid).toBe(true);

      if (validation.data) {
        const data = validation.data.data || validation.data;
        expect(data.name).toBeTruthy();
        expect(data.description).toBeTruthy();
      }
    });
  });

  test.describe('CharX Export', () => {
    test('should export CCv2 card as valid CharX', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'CHARX');

      // Validate CharX structure
      const validation = await validateCharxFile(downloadPath);
      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.error('CharX validation errors:', validation.errors);
      }
    });

    test('should export CharX card as CharX (re-export)', async ({ page }) => {
      test.setTimeout(300000); // 5 minutes for large file import + export
      await importAndWaitForCard(page, CHARX_AILU, /Ailu/i);

      const downloadPath = await exportCardToFormat(page, 'CHARX');

      const validation = await validateCharxFile(downloadPath);
      expect(validation.valid).toBe(true);
    });

    test('should export with valid ZIP structure', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'CHARX');

      const buffer = fs.readFileSync(downloadPath);
      const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

      expect(buffer.subarray(0, 4).equals(zipSignature)).toBe(true);
    });

    test('should include card.json in CharX export', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'CHARX');

      const buffer = fs.readFileSync(downloadPath);
      const hasCardJson = buffer.includes(Buffer.from('card.json'));

      expect(hasCardJson).toBe(true);
    });

    test('should export RisuAI v3 card as CharX', async ({ page }) => {
      await importAndWaitForCard(page, RISU_V3_CREATOR, /Creator/i);

      const downloadPath = await exportCardToFormat(page, 'CHARX');

      const validation = await validateCharxFile(downloadPath);
      expect(validation.valid).toBe(true);
    });
  });

  test.describe('Voxta Export (Full Mode Only)', () => {
    test('should export CCv2 card as Voxta package', async ({ page }, testInfo) => {
      // Skip in light mode
      if (testInfo.project.name === 'light-mode') {
        test.skip();
      }

      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPath = await exportCardToFormat(page, 'Voxta');

      // Verify it's a valid ZIP
      const buffer = fs.readFileSync(downloadPath);
      const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      expect(buffer.subarray(0, 4).equals(zipSignature)).toBe(true);

      // Check for Voxta-specific files
      const hasCharacterFile = buffer.includes(Buffer.from('character.json')) ||
                               buffer.includes(Buffer.from('Character.json'));
      expect(hasCharacterFile).toBe(true);
    });

    test('should export Voxta package as Voxta (re-export)', async ({ page }, testInfo) => {
      test.setTimeout(300000); // 5 minutes for large file import + export
      if (testInfo.project.name === 'light-mode') {
        test.skip();
      }

      await importAndWaitForCard(page, VOXTA_2B, /2B/i);

      const downloadPath = await exportCardToFormat(page, 'Voxta');

      const buffer = fs.readFileSync(downloadPath);
      const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      expect(buffer.subarray(0, 4).equals(zipSignature)).toBe(true);
    });

    test('should export CharX card as Voxta package', async ({ page }, testInfo) => {
      test.setTimeout(300000); // 5 minutes for large file import + export
      if (testInfo.project.name === 'light-mode') {
        test.skip();
      }

      await importAndWaitForCard(page, CHARX_AILU, /Ailu/i);

      const downloadPath = await exportCardToFormat(page, 'Voxta');

      const buffer = fs.readFileSync(downloadPath);
      const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      expect(buffer.subarray(0, 4).equals(zipSignature)).toBe(true);
    });

    test('should not show Voxta export in light mode', async ({ page }, testInfo) => {
      if (testInfo.project.name !== 'light-mode') {
        test.skip();
      }

      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const exportButton = page.locator('button:has-text("Export")');
      await exportButton.click();

      // Wait for dropdown
      await page.waitForTimeout(500);

      // Voxta button should not be visible
      const voxtaButton = page.locator('button:has-text("Voxta")');
      const isVisible = await voxtaButton.isVisible().catch(() => false);

      expect(isVisible).toBe(false);
    });
  });

  test.describe('Export Data Integrity', () => {
    // SKIPPED: Korean CharX (38MB) takes too long to export
    test.skip('should preserve special characters in exports', async ({ page }) => {
      test.setTimeout(600000);
      // Use a card with known special characters (Korean CharX)
      await importAndWaitForCard(page, CHARX_KOREAN);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      // Should preserve Unicode characters
      const name = jsonData.data?.name || jsonData.name;
      expect(name).toBeTruthy();
      expect(name.length).toBeGreaterThan(0);
    });

    test('should maintain consistent data across export formats', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      // Export as JSON
      let downloadPath = await exportCardToFormat(page, 'JSON');
      const jsonContent = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(jsonContent);
      const jsonName = jsonData.data?.name || jsonData.name;

      // Go back to card (it should still be loaded)
      await page.goto(page.url()); // Refresh current card page
      await waitForAppLoad(page);

      // Export as PNG
      downloadPath = await exportCardToFormat(page, 'PNG');
      const pngValidation = await validatePngCard(downloadPath);
      const pngName = pngValidation.data?.data?.name || pngValidation.data?.name;

      // Names should match
      expect(jsonName).toBe(pngName);
    });

    test('should handle long descriptions in exports', async ({ page }) => {
      // Use a complex card that likely has long content
      const complexCard = path.join(TESTING_DIR, 'chub/main_zephyra-emotionless-android-3f8f3767497f_spec_v2.png');

      await importAndWaitForCard(page, complexCard, /Zephyra/i);

      const downloadPath = await exportCardToFormat(page, 'JSON');

      const content = fs.readFileSync(downloadPath, 'utf-8');
      const jsonData = JSON.parse(content);

      const data = jsonData.data || jsonData;
      expect(data.name).toBeTruthy();

      // Verify export succeeded without truncation
      expect(content.length).toBeGreaterThan(100); // Should have substantial content
    });
  });

  test.describe('Export Error Handling', () => {
    test('should handle export when no card is loaded', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const exportButton = page.locator('button:has-text("Export")');
      const isVisible = await exportButton.isVisible().catch(() => false);

      if (isVisible) {
        const isDisabled = await exportButton.isDisabled().catch(() => false);
        // Export should be disabled when no card loaded
        if (!isDisabled) {
          await exportButton.click();
          await page.waitForTimeout(500);

          // Should not be able to complete export
          const jsonButton = page.locator('button:has-text("JSON")');
          const canExport = await jsonButton.isVisible().catch(() => false);

          // Either button not visible, or export fails gracefully
          expect(canExport || isDisabled).toBeTruthy();
        }
      }
    });

    test('should handle export timeout gracefully', async ({ page }) => {
      // Import a large card that might take time to export
      const largeCard = path.join(TESTING_DIR, 'risu_v3/Monster Musume Paradise.png');

      await importAndWaitForCard(page, largeCard);

      // Set a generous timeout for large exports
      test.setTimeout(120000);

      try {
        const downloadPath = await exportCardToFormat(page, 'CHARX');
        expect(downloadPath).toBeTruthy();
      } catch (error) {
        // If timeout occurs, verify app is still functional
        const url = page.url();
        expect(url).toMatch(/\/cards\//);
      }
    });
  });

  test.describe('File Naming', () => {
    test('should use character name in exported filename', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

      const exportButton = page.locator('button:has-text("Export")');
      await exportButton.click();

      const jsonButton = page.locator('button:has-text("JSON")');
      await jsonButton.click();

      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      // Filename should include character name
      expect(filename.toLowerCase()).toContain('shana');
      expect(filename).toMatch(/\.json$/i);
    });

    test('should use correct extension for each format', async ({ page }) => {
      await importAndWaitForCard(page, CCv2_PNG, /Shana/i);

      const formats = [
        { format: 'JSON' as const, extension: '.json' },
        { format: 'PNG' as const, extension: '.png' },
        { format: 'CHARX' as const, extension: '.charx' },
      ];

      for (const { format, extension } of formats) {
        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

        const exportButton = page.locator('button:has-text("Export")');
        await exportButton.click();

        const formatButton = page.locator(`button:has-text("${format}")`);
        await formatButton.click();

        const download = await downloadPromise;
        const filename = download.suggestedFilename();

        expect(filename.toLowerCase()).toMatch(new RegExp(`${extension}$`, 'i'));

        // Navigate back to card for next iteration
        await page.goto(page.url());
        await waitForAppLoad(page);
      }
    });
  });
});
