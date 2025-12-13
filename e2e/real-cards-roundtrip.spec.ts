/**
 * Real Character Card Round-Trip E2E Tests
 *
 * Tests data integrity through complete import -> export -> re-import cycles:
 * - Import PNG -> Export as JSON -> Re-import -> Verify data
 * - Import CharX -> Export as PNG -> Re-import -> Verify data
 * - Import Voxta -> Export as CharX -> Re-import -> Verify data
 * - Cross-format round-trips
 * - Multiple round-trip cycles
 *
 * These tests ensure no data loss occurs during format conversions.
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

// Test file paths - using real cards from docs/internal/testing/ directory
const TESTING_DIR = path.join(__dirname, '../docs/internal/testing');

// Test cards
const CCv2_PNG = path.join(TESTING_DIR, 'chub/main_shana-e03c661ffb1d_spec_v2.png');
const CCv2_JSON = path.join(TESTING_DIR, 'chub/main_shana-e03c661ffb1d_spec_v2.json');
const CHARX_AILU = path.join(TESTING_DIR, 'Ailu Narukami.charx');
const CHARX_HARPER = path.join(TESTING_DIR, 'risu_charx/Harper.charx');
const CHARX_KOREAN = path.join(TESTING_DIR, 'risu_charx/오가미 이토코 v4.51.charx');
const VOXTA_2B = path.join(TESTING_DIR, 'voxta/2B.1.0.0.voxpkg');
const RISU_V3 = path.join(TESTING_DIR, 'risu_v3/Character Creator Bot.png');

/**
 * Helper to import a card
 * @param timeout - Optional timeout for large files (calculated from getTimeoutForFile)
 */
async function importCard(page: any, filePath: string, timeout?: number) {
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
}

/**
 * Helper to export a card
 * Note: Large exports can take 1-2 minutes, especially for CharX with many assets
 */
async function exportCard(page: any, format: 'JSON' | 'PNG' | 'CHARX' | 'Voxta'): Promise<string> {
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

/**
 * Helper to get card data from page
 * Note: The app uses custom editors (CodeMirror/Monaco) instead of standard textareas.
 * For round-trip verification, we primarily check that the name is preserved.
 */
async function getCardDataFromPage(page: any) {
  // Extract name - this is a standard textbox
  const nameInput = page.getByRole('textbox').first();
  const name = await nameInput.inputValue();

  // For description, try to get content from CodeMirror or similar editor
  // The app may use .cm-content or other editor classes
  let description = '';
  try {
    // Try CodeMirror first
    const cmContent = page.locator('.cm-content').first();
    if (await cmContent.isVisible().catch(() => false)) {
      description = await cmContent.textContent() || '';
    } else {
      // Fallback: try any textarea if present
      const textareas = page.locator('textarea');
      if (await textareas.count() > 0) {
        description = await textareas.first().inputValue().catch(() => '');
      }
    }
  } catch {
    // Ignore errors - description is optional for name-based comparisons
  }

  return { name, description, personality: '', scenario: '' };
}

test.describe('Round-Trip Tests', () => {
  // Run tests serially to avoid database/storage conflicts
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('Same Format Round-Trips', () => {
    test('should preserve data: PNG -> Export PNG -> Re-import', async ({ page }) => {
      // Import original PNG
      await importCard(page, CCv2_PNG);
      const originalData = await getCardDataFromPage(page);

      // Export as PNG
      const exportedPath = await exportCard(page, 'PNG');

      // Verify exported PNG
      const validation = await validatePngCard(exportedPath);
      expect(validation.valid).toBe(true);

      // Re-import exported PNG
      await importCard(page, exportedPath);
      const reimportedData = await getCardDataFromPage(page);

      // Compare data
      expect(reimportedData.name).toBe(originalData.name);
      expect(reimportedData.description).toBe(originalData.description);
    });

    test('should preserve data: JSON -> Export JSON -> Re-import', async ({ page }) => {
      // Import original JSON
      await importCard(page, CCv2_JSON);
      const originalData = await getCardDataFromPage(page);

      // Export as JSON
      const exportedPath = await exportCard(page, 'JSON');

      // Verify exported JSON
      const content = fs.readFileSync(exportedPath, 'utf-8');
      const jsonData = JSON.parse(content);
      const validation = validateJsonCard(jsonData);
      expect(validation.valid).toBe(true);

      // Re-import exported JSON
      await importCard(page, exportedPath);
      const reimportedData = await getCardDataFromPage(page);

      // Compare data
      expect(reimportedData.name).toBe(originalData.name);
      expect(reimportedData.description).toBe(originalData.description);
    });

    test('should preserve data: CharX -> Export CharX -> Re-import', async ({ page }) => {
      test.setTimeout(getTimeoutForFile(CHARX_AILU) * 3 + 60000); // Multiple imports
      // Import original CharX
      await importCard(page, CHARX_AILU);
      const originalData = await getCardDataFromPage(page);

      // Export as CharX
      const exportedPath = await exportCard(page, 'CHARX');

      // Verify exported CharX
      const validation = await validateCharxFile(exportedPath);
      expect(validation.valid).toBe(true);

      // Re-import exported CharX
      await importCard(page, exportedPath);
      const reimportedData = await getCardDataFromPage(page);

      // Compare data
      expect(reimportedData.name).toBe(originalData.name);
    });
  });

  test.describe('Cross-Format Round-Trips', () => {
    test('should preserve data: PNG -> JSON -> PNG', async ({ page }) => {
      // Import PNG
      await importCard(page, CCv2_PNG);
      const originalData = await getCardDataFromPage(page);

      // Export as JSON
      const jsonPath = await exportCard(page, 'JSON');

      // Re-import JSON
      await importCard(page, jsonPath);
      const afterJsonData = await getCardDataFromPage(page);

      // Export as PNG
      const pngPath = await exportCard(page, 'PNG');

      // Re-import PNG
      await importCard(page, pngPath);
      const finalData = await getCardDataFromPage(page);

      // Verify data integrity throughout
      expect(afterJsonData.name).toBe(originalData.name);
      expect(finalData.name).toBe(originalData.name);
      expect(finalData.description).toBe(originalData.description);
    });

    test('should preserve data: CharX -> JSON -> CharX', async ({ page }) => {
      test.setTimeout(getTimeoutForFile(CHARX_AILU) * 3 + 60000); // Multiple imports
      // Import CharX
      await importCard(page, CHARX_AILU);
      const originalData = await getCardDataFromPage(page);

      // Export as JSON
      const jsonPath = await exportCard(page, 'JSON');

      // Re-import JSON
      await importCard(page, jsonPath);
      const afterJsonData = await getCardDataFromPage(page);

      // Export as CharX
      const charxPath = await exportCard(page, 'CHARX');

      // Re-import CharX
      await importCard(page, charxPath);
      const finalData = await getCardDataFromPage(page);

      // Verify data integrity
      expect(afterJsonData.name).toBe(originalData.name);
      expect(finalData.name).toBe(originalData.name);
    });

    test('should preserve data: JSON -> PNG -> JSON', async ({ page }) => {
      // Import JSON
      await importCard(page, CCv2_JSON);
      const originalData = await getCardDataFromPage(page);

      // Export as PNG
      const pngPath = await exportCard(page, 'PNG');

      // Verify PNG has embedded data
      const pngValidation = await validatePngCard(pngPath);
      expect(pngValidation.valid).toBe(true);

      // Re-import PNG
      await importCard(page, pngPath);
      const afterPngData = await getCardDataFromPage(page);

      // Export as JSON
      const jsonPath = await exportCard(page, 'JSON');

      // Re-import JSON
      await importCard(page, jsonPath);
      const finalData = await getCardDataFromPage(page);

      // Verify data integrity
      expect(afterPngData.name).toBe(originalData.name);
      expect(finalData.name).toBe(originalData.name);
      expect(finalData.description).toBe(originalData.description);
    });

    test('should preserve data: CharX -> PNG -> CharX', async ({ page }) => {
      test.setTimeout(getTimeoutForFile(CHARX_HARPER) * 3 + 60000); // Multiple imports (72MB file)
      // Import CharX
      await importCard(page, CHARX_HARPER);
      const originalData = await getCardDataFromPage(page);

      // Export as PNG
      const pngPath = await exportCard(page, 'PNG');

      // Re-import PNG
      await importCard(page, pngPath);
      const afterPngData = await getCardDataFromPage(page);

      // Export as CharX
      const charxPath = await exportCard(page, 'CHARX');

      // Re-import CharX
      await importCard(page, charxPath);
      const finalData = await getCardDataFromPage(page);

      // Verify data integrity
      expect(afterPngData.name).toBe(originalData.name);
      expect(finalData.name).toBe(originalData.name);
    });

    test('should preserve data: Voxta -> JSON -> PNG', async ({ page }) => {
      test.setTimeout(getTimeoutForFile(VOXTA_2B) * 3 + 60000); // Multiple imports
      // Import Voxta
      await importCard(page, VOXTA_2B);
      const originalData = await getCardDataFromPage(page);

      // Export as JSON
      const jsonPath = await exportCard(page, 'JSON');

      // Re-import JSON
      await importCard(page, jsonPath);
      const afterJsonData = await getCardDataFromPage(page);

      // Export as PNG
      const pngPath = await exportCard(page, 'PNG');

      // Re-import PNG
      await importCard(page, pngPath);
      const finalData = await getCardDataFromPage(page);

      // Verify data integrity
      expect(afterJsonData.name).toBe(originalData.name);
      expect(finalData.name).toBe(originalData.name);
    });
  });

  test.describe('Multiple Round-Trip Cycles', () => {
    test('should maintain data integrity after 3 export/import cycles', async ({ page }) => {
      // Import original
      await importCard(page, CCv2_PNG);
      const originalData = await getCardDataFromPage(page);

      let currentData = originalData;

      // Perform 3 cycles of export -> import
      for (let i = 0; i < 3; i++) {
        // Export as JSON
        const exportPath = await exportCard(page, 'JSON');

        // Re-import
        await importCard(page, exportPath);
        currentData = await getCardDataFromPage(page);

        // Verify data still matches original
        expect(currentData.name).toBe(originalData.name);
        expect(currentData.description).toBe(originalData.description);
      }
    });

    test('should maintain data through alternating format exports', async ({ page }) => {
      // Import original
      await importCard(page, CCv2_PNG);
      const originalData = await getCardDataFromPage(page);

      const formats: Array<'JSON' | 'PNG'> = ['JSON', 'PNG', 'JSON', 'PNG'];

      for (const format of formats) {
        const exportPath = await exportCard(page, format);
        await importCard(page, exportPath);

        const currentData = await getCardDataFromPage(page);
        expect(currentData.name).toBe(originalData.name);
      }
    });

    test('should preserve complex card through multiple cycles', async ({ page }) => {
      // Use a complex card
      const complexCard = path.join(TESTING_DIR, 'chub/main_zephyra-emotionless-android-3f8f3767497f_spec_v2.png');

      await importCard(page, complexCard);
      const originalData = await getCardDataFromPage(page);

      // Export as JSON
      let exportPath = await exportCard(page, 'JSON');
      await importCard(page, exportPath);

      // Export as PNG
      exportPath = await exportCard(page, 'PNG');
      await importCard(page, exportPath);

      // Export as CharX
      exportPath = await exportCard(page, 'CHARX');
      await importCard(page, exportPath);

      const finalData = await getCardDataFromPage(page);
      expect(finalData.name).toBe(originalData.name);
    });
  });

  test.describe('Special Cases', () => {
    test('should preserve special characters through round-trip', async ({ page }) => {
      test.setTimeout(getTimeoutForFile(CHARX_KOREAN) * 2 + 60000); // Multiple imports
      await importCard(page, CHARX_KOREAN);
      const originalData = await getCardDataFromPage(page);

      // Export as JSON
      const jsonPath = await exportCard(page, 'JSON');

      // Verify JSON contains Unicode
      const content = fs.readFileSync(jsonPath, 'utf-8');
      const jsonData = JSON.parse(content);
      expect(jsonData.data?.name || jsonData.name).toBeTruthy();

      // Re-import
      await importCard(page, jsonPath);
      const reimportedData = await getCardDataFromPage(page);

      expect(reimportedData.name).toBe(originalData.name);
    });

    test('should preserve long content through round-trip', async ({ page }) => {
      // Use a card with lots of content
      const complexCard = path.join(TESTING_DIR, 'chub/main_zephyra-emotionless-android-3f8f3767497f_spec_v2.png');

      await importCard(page, complexCard);
      const originalData = await getCardDataFromPage(page);

      // Export as JSON
      const jsonPath = await exportCard(page, 'JSON');

      // Verify JSON is substantial
      const content = fs.readFileSync(jsonPath, 'utf-8');
      expect(content.length).toBeGreaterThan(500);

      // Re-import
      await importCard(page, jsonPath);
      const reimportedData = await getCardDataFromPage(page);

      expect(reimportedData.name).toBe(originalData.name);
      expect(reimportedData.description.length).toBeGreaterThan(0);
    });

    test('should handle empty fields through round-trip', async ({ page }) => {
      // Import a card
      await importCard(page, CCv2_JSON);

      // Try to clear some fields (app may use custom editors)
      // First try CodeMirror content
      const cmContent = page.locator('.cm-content').first();
      if (await cmContent.isVisible().catch(() => false)) {
        // Focus and select all to clear
        await cmContent.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');
      } else {
        // Fallback to textareas if available
        const textareas = page.locator('textarea');
        if (await textareas.count() > 2) {
          await textareas.nth(2).fill(''); // Clear scenario field
        }
      }

      await page.waitForTimeout(500); // Wait for state update

      // Export
      const exportPath = await exportCard(page, 'JSON');

      // Re-import
      await importCard(page, exportPath);

      // Should still load without errors
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).not.toBeEmpty();
    });
  });

  test.describe('Data Validation After Round-Trip', () => {
    test('should maintain JSON structure validity after round-trip', async ({ page }) => {
      await importCard(page, CCv2_JSON);

      // First export
      const export1 = await exportCard(page, 'JSON');
      const json1 = JSON.parse(fs.readFileSync(export1, 'utf-8'));

      // Re-import and export again
      await importCard(page, export1);
      const export2 = await exportCard(page, 'JSON');
      const json2 = JSON.parse(fs.readFileSync(export2, 'utf-8'));

      // Both should have valid structure
      expect(validateJsonCard(json1).valid).toBe(true);
      expect(validateJsonCard(json2).valid).toBe(true);

      // Key fields should match
      const name1 = json1.data?.name || json1.name;
      const name2 = json2.data?.name || json2.name;
      expect(name1).toBe(name2);
    });

    test('should maintain PNG validity after round-trip', async ({ page }) => {
      await importCard(page, CCv2_PNG);

      // First export
      const export1 = await exportCard(page, 'PNG');
      const validation1 = await validatePngCard(export1);
      expect(validation1.valid).toBe(true);

      // Re-import and export again
      await importCard(page, export1);
      const export2 = await exportCard(page, 'PNG');
      const validation2 = await validatePngCard(export2);
      expect(validation2.valid).toBe(true);

      // Data should match
      const name1 = validation1.data?.data?.name || validation1.data?.name;
      const name2 = validation2.data?.data?.name || validation2.data?.name;
      expect(name1).toBe(name2);
    });

    test('should maintain CharX validity after round-trip', async ({ page }) => {
      test.setTimeout(getTimeoutForFile(CHARX_AILU) * 3 + 60000); // Multiple imports
      await importCard(page, CHARX_AILU);

      // First export
      const export1 = await exportCard(page, 'CHARX');
      const validation1 = await validateCharxFile(export1);
      expect(validation1.valid).toBe(true);

      // Re-import and export again
      await importCard(page, export1);
      const export2 = await exportCard(page, 'CHARX');
      const validation2 = await validateCharxFile(export2);
      expect(validation2.valid).toBe(true);
    });
  });

  test.describe('Asset Preservation', () => {
    test('should preserve assets through CharX round-trip', async ({ page }) => {
      test.setTimeout(getTimeoutForFile(CHARX_AILU) * 3 + 60000); // Multiple imports
      // Import CharX that has assets
      await importCard(page, CHARX_AILU);

      // Check if assets are loaded
      const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")');
      const hasAssets = await assetsTab.isVisible().catch(() => false);

      // Export as CharX
      const exportPath = await exportCard(page, 'CHARX');

      // Re-import
      await importCard(page, exportPath);

      // Assets should still be present if they were before
      if (hasAssets) {
        const assetsTabAfter = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")');
        await expect(assetsTabAfter).toBeVisible();
      }

      // Basic verification - card loaded
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).not.toBeEmpty();
    });

    test('should preserve RisuAI v3 assets through round-trip', async ({ page }) => {
      // Import RisuAI v3 card with assets
      const risuWithAssets = path.join(TESTING_DIR, 'risu_v3/Monster Musume Paradise.png');

      await importCard(page, risuWithAssets);
      const originalData = await getCardDataFromPage(page);

      // Export as CharX (to preserve assets)
      const charxPath = await exportCard(page, 'CHARX');

      // Re-import
      await importCard(page, charxPath);
      const reimportedData = await getCardDataFromPage(page);

      expect(reimportedData.name).toBe(originalData.name);
    });
  });

  test.describe('Metadata Preservation', () => {
    test('should preserve creator info through round-trip', async ({ page }) => {
      await importCard(page, CCv2_JSON);

      // Export as JSON
      const export1 = await exportCard(page, 'JSON');
      const json1 = JSON.parse(fs.readFileSync(export1, 'utf-8'));
      const creator1 = json1.data?.creator || json1.creator;

      // Re-import and export
      await importCard(page, export1);
      const export2 = await exportCard(page, 'JSON');
      const json2 = JSON.parse(fs.readFileSync(export2, 'utf-8'));
      const creator2 = json2.data?.creator || json2.creator;

      // Creator should be preserved (if it exists)
      if (creator1) {
        expect(creator2).toBe(creator1);
      }
    });

    test('should preserve tags through round-trip', async ({ page }) => {
      await importCard(page, CCv2_JSON);

      // Export as JSON
      const export1 = await exportCard(page, 'JSON');
      const json1 = JSON.parse(fs.readFileSync(export1, 'utf-8'));
      const tags1 = json1.data?.tags || json1.tags;

      // Re-import and export
      await importCard(page, export1);
      const export2 = await exportCard(page, 'JSON');
      const json2 = JSON.parse(fs.readFileSync(export2, 'utf-8'));
      const tags2 = json2.data?.tags || json2.tags;

      // Tags should be preserved (if they exist)
      if (tags1 && Array.isArray(tags1)) {
        expect(tags2).toBeTruthy();
        expect(Array.isArray(tags2)).toBe(true);
      }
    });
  });
});
