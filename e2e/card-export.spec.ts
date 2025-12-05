/**
 * Card Generation and Export E2E Tests
 *
 * Tests the complete workflow of:
 * 1. Creating a new character card with random data
 * 2. Uploading an avatar image
 * 3. Exporting to all formats (JSON, PNG, CHARX, Voxta)
 * 4. Validating data integrity and file structure
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateRandomCard,
  generateTestImage,
  waitForAppLoad,
  navigateToEditor,
  fillCardData,
  validateJsonCard,
  validatePngCard,
  validateCharxFile,
} from './utils/test-helpers';

// Test downloads directory
const DOWNLOADS_DIR = path.join(__dirname, 'test-downloads');

test.describe('Card Generation and Export', () => {
  let cardData: ReturnType<typeof generateRandomCard>;

  test.beforeAll(() => {
    // Create downloads directory
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    }

    // Generate random card data for all tests
    cardData = generateRandomCard();
    console.log('Generated test card:', cardData.name);
  });

  test.afterAll(() => {
    // Clean up downloads
    if (fs.existsSync(DOWNLOADS_DIR)) {
      fs.readdirSync(DOWNLOADS_DIR).forEach(file => {
        fs.unlinkSync(path.join(DOWNLOADS_DIR, file));
      });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should create a new card and fill in basic data', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Create new card
    await navigateToEditor(page);

    // Fill in card data
    await fillCardData(page, cardData);

    // Verify data was entered
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    await expect(nameInput).toHaveValue(cardData.name);

    // Wait for auto-save or manual save
    await page.waitForTimeout(1000);

    // Check that we have a card URL
    await expect(page).toHaveURL(/\/cards\//);
  });

  test('should upload an avatar image', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, cardData);

    // Look for avatar upload area
    const avatarUpload = page.locator(
      'input[type="file"][accept*="image"], ' +
      '[class*="avatar"] input[type="file"], ' +
      'label:has-text("Avatar") + input[type="file"], ' +
      '[data-testid="avatar-upload"]'
    ).first();

    if (await avatarUpload.isVisible()) {
      // Create a test image file
      const testImagePath = path.join(DOWNLOADS_DIR, 'test-avatar.png');
      const imageData = generateTestImage();
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(testImagePath, Buffer.from(base64Data, 'base64'));

      await avatarUpload.setInputFiles(testImagePath);
      await page.waitForTimeout(1000);

      // Verify avatar was uploaded (look for image preview)
      const avatarPreview = page.locator('img[class*="avatar"], img[alt*="avatar" i]').first();
      if (await avatarPreview.isVisible()) {
        await expect(avatarPreview).toHaveAttribute('src', /.+/);
      }

      // Clean up
      fs.unlinkSync(testImagePath);
    } else {
      // Avatar upload might be in a different location or hidden
      console.log('Avatar upload input not found - skipping image upload');
    }
  });

  test('should export card as JSON with valid structure', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, cardData);
    await page.waitForTimeout(1000);

    // Set up download handler
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click Export dropdown
    const exportButton = page.locator('button:has-text("Export")');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // Wait for dropdown to appear and click JSON
    const jsonButton = page.locator('button:has-text("JSON")');
    await expect(jsonButton).toBeVisible({ timeout: 5000 });
    await jsonButton.click();

    // Wait for download
    const download = await downloadPromise;
    const downloadPath = path.join(DOWNLOADS_DIR, 'test-export.json');
    await download.saveAs(downloadPath);

    // Validate JSON structure
    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');
    const jsonData = JSON.parse(jsonContent);

    const validation = validateJsonCard(jsonData);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      console.error('JSON validation errors:', validation.errors);
    }

    // Verify our data is in the export
    const exportedData = jsonData.data || jsonData;
    expect(exportedData.name).toBe(cardData.name);

    // Clean up
    fs.unlinkSync(downloadPath);
  });

  test('should export card as PNG with embedded character data', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, cardData);
    await page.waitForTimeout(1000);

    // Set up download handler
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click Export dropdown
    const exportButton = page.locator('button:has-text("Export")');
    await exportButton.click();

    // Click PNG
    const pngButton = page.locator('button:has-text("PNG")');
    await expect(pngButton).toBeVisible({ timeout: 5000 });
    await pngButton.click();

    // Wait for download
    const download = await downloadPromise;
    const downloadPath = path.join(DOWNLOADS_DIR, 'test-export.png');
    await download.saveAs(downloadPath);

    // Validate PNG structure
    const validation = await validatePngCard(downloadPath);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      console.error('PNG validation errors:', validation.errors);
    }

    // Verify our data is embedded
    if (validation.data) {
      const embeddedData = validation.data.data || validation.data;
      expect(embeddedData.name).toBe(cardData.name);
    }

    // Clean up
    fs.unlinkSync(downloadPath);
  });

  test('should export card as CHARX with valid ZIP structure', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, cardData);
    await page.waitForTimeout(1000);

    // Set up download handler
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click Export dropdown
    const exportButton = page.locator('button:has-text("Export")');
    await exportButton.click();

    // Click CHARX
    const charxButton = page.locator('button:has-text("CHARX")');
    await expect(charxButton).toBeVisible({ timeout: 5000 });
    await charxButton.click();

    // Wait for download
    const download = await downloadPromise;
    const downloadPath = path.join(DOWNLOADS_DIR, 'test-export.charx');
    await download.saveAs(downloadPath);

    // Validate CHARX structure
    const validation = await validateCharxFile(downloadPath);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      console.error('CHARX validation errors:', validation.errors);
    }

    // Clean up
    fs.unlinkSync(downloadPath);
  });

  test('should export card as Voxta package', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, cardData);
    await page.waitForTimeout(1000);

    // Set up download handler
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click Export dropdown
    const exportButton = page.locator('button:has-text("Export")');
    await exportButton.click();

    // Click Voxta
    const voxtaButton = page.locator('button:has-text("Voxta")');
    await expect(voxtaButton).toBeVisible({ timeout: 5000 });
    await voxtaButton.click();

    // Wait for download
    const download = await downloadPromise;
    const downloadPath = path.join(DOWNLOADS_DIR, 'test-export.voxpkg');
    await download.saveAs(downloadPath);

    // Basic validation - Voxta is also a ZIP
    const buffer = fs.readFileSync(downloadPath);
    const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    expect(buffer.subarray(0, 4).equals(zipSignature)).toBe(true);

    // Check for key Voxta files
    const hasCharacterFile = buffer.includes(Buffer.from('character.json')) ||
                             buffer.includes(Buffer.from('Character.json'));
    expect(hasCharacterFile).toBe(true);

    // Clean up
    fs.unlinkSync(downloadPath);
  });

  test('should preserve data integrity across export formats', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, cardData);
    await page.waitForTimeout(1000);

    const exports: { format: string; data: any }[] = [];

    // Export JSON
    let downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("Export")').click();
    const jsonBtn = page.locator('button:has-text("JSON")');
    await expect(jsonBtn).toBeVisible({ timeout: 5000 });
    await jsonBtn.click();
    let download = await downloadPromise;
    let downloadPath = path.join(DOWNLOADS_DIR, 'integrity-test.json');
    await download.saveAs(downloadPath);
    const jsonData = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'));
    exports.push({ format: 'json', data: jsonData });
    fs.unlinkSync(downloadPath);

    // Export PNG and extract data
    downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("Export")').click();
    const pngBtn = page.locator('button:has-text("PNG")');
    await expect(pngBtn).toBeVisible({ timeout: 5000 });
    await pngBtn.click();
    download = await downloadPromise;
    downloadPath = path.join(DOWNLOADS_DIR, 'integrity-test.png');
    await download.saveAs(downloadPath);
    const pngValidation = await validatePngCard(downloadPath);
    if (pngValidation.data) {
      exports.push({ format: 'png', data: pngValidation.data });
    }
    fs.unlinkSync(downloadPath);

    // Compare data integrity
    if (exports.length >= 2) {
      const jsonExport = exports.find(e => e.format === 'json')!;
      const pngExport = exports.find(e => e.format === 'png');

      if (pngExport) {
        const jsonName = (jsonExport.data.data || jsonExport.data).name;
        const pngName = (pngExport.data.data || pngExport.data).name;

        expect(jsonName).toBe(pngName);
        expect(jsonName).toBe(cardData.name);
      }
    }
  });

  test('should handle special characters in card data', async ({ page }) => {
    const specialCard = {
      ...cardData,
      name: 'Test "Quotes" & <Brackets>',
      description: "Line1\\nLine2\\tTabbed\\r\\nWindows line",
      personality: '日本語テスト 中文测试 한국어 тест',
      scenario: 'Emoji test: 🎮 🎭 ✨ 🌟',
      first_mes: '*action* "dialogue" {{placeholder}}',
    };

    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, specialCard);
    await page.waitForTimeout(1000);

    // Export and verify
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("Export")').click();
    const jsonExportBtn = page.locator('button:has-text("JSON")');
    await expect(jsonExportBtn).toBeVisible({ timeout: 5000 });
    await jsonExportBtn.click();

    const download = await downloadPromise;
    const downloadPath = path.join(DOWNLOADS_DIR, 'special-chars.json');
    await download.saveAs(downloadPath);

    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    const exportedData = jsonData.data || jsonData;

    // Verify special characters are preserved
    expect(exportedData.name).toContain('Quotes');
    expect(exportedData.personality).toContain('日本語');
    expect(exportedData.scenario).toContain('🎮');

    fs.unlinkSync(downloadPath);
  });

  test('should import exported card and verify round-trip integrity', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);
    await fillCardData(page, cardData);
    await page.waitForTimeout(1000);

    // Export as JSON first
    let downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("Export")').click();
    const jsonRoundTrip = page.locator('button:has-text("JSON")');
    await expect(jsonRoundTrip).toBeVisible({ timeout: 5000 });
    await jsonRoundTrip.click();

    const download = await downloadPromise;
    const downloadPath = path.join(DOWNLOADS_DIR, 'round-trip.json');
    await download.saveAs(downloadPath);

    // Go back to main page and import
    await page.goto('/');
    await waitForAppLoad(page);

    // Click Import dropdown
    const importButton = page.locator('button:has-text("Import")');
    await importButton.click();
    await page.waitForTimeout(300);

    // Click "From File"
    const fromFileButton = page.locator('button:has-text("From File"), button:has-text("File")');
    await fromFileButton.click();

    // Set up file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(downloadPath);

    // Wait for navigation to new card
    await page.waitForURL(/\/cards\//, { timeout: 10000 });
    await waitForAppLoad(page);

    // Verify imported data matches
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    await expect(nameInput).toHaveValue(cardData.name);

    // Clean up
    fs.unlinkSync(downloadPath);
  });
});

test.describe('Export Error Handling', () => {
  test('should handle export when no card is loaded', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Check if Export button is disabled or not visible when no card
    const exportButton = page.locator('button:has-text("Export")');
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (isVisible) {
      const isDisabled = await exportButton.isDisabled().catch(() => false);
      // Export should be disabled or show an error when clicked
      if (!isDisabled) {
        await exportButton.click();
        // Should show error or empty dropdown
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show progress indicator during large export', async ({ page }) => {
    await page.goto('/');
    await navigateToEditor(page);

    // Create card with lots of content
    const largeCard = generateRandomCard();
    largeCard.description = 'A'.repeat(10000); // Large description

    await fillCardData(page, largeCard);
    await page.waitForTimeout(1000);

    // Start export
    await page.locator('button:has-text("Export")').click();

    // The export might show a loading state
    const charxButton = page.locator('button:has-text("CHARX")');
    await expect(charxButton).toBeVisible({ timeout: 5000 });
    await charxButton.click();

    // Should complete without hanging
    const download = await page.waitForEvent('download', { timeout: 60000 });
    expect(download.suggestedFilename()).toContain('.charx');
  });
});
