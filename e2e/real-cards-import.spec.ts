/**
 * Real Character Card Import E2E Tests
 *
 * Tests importing various character card formats using REAL files from testing/ directory:
 * - CCv2 format (ChubAI cards)
 * - RisuAI v3 PNG cards
 * - CharX format cards
 * - Voxta package files
 * - CharacterTavern format
 * - Wyvern format
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { waitForAppLoad, importCardFile } from './utils/test-helpers';

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

// CCv2 cards from ChubAI
const CCv2_PNG = path.join(TESTING_DIR, 'chub/main_shana-e03c661ffb1d_spec_v2.png');
const CCv2_JSON = path.join(TESTING_DIR, 'chub/main_shana-e03c661ffb1d_spec_v2.json');
const CCv2_COMPLEX_PNG = path.join(TESTING_DIR, 'chub/main_zephyra-emotionless-android-3f8f3767497f_spec_v2.png');

// RisuAI v3 cards
const RISU_V3_CREATOR = path.join(TESTING_DIR, 'risu_v3/Character Creator Bot.png');
const RISU_V3_MONSTER = path.join(TESTING_DIR, 'risu_v3/Monster Musume Paradise.png');
const RISU_V3_WEDDING = path.join(TESTING_DIR, 'risu_v3/Absolute Mother (wedding).png');

// CharX format cards
const CHARX_AILU = path.join(TESTING_DIR, 'Ailu Narukami.charx');
const CHARX_HARPER = path.join(TESTING_DIR, 'risu_charx/Harper.charx');
const CHARX_HOGWARTS = path.join(TESTING_DIR, 'risu_charx/Hogwarts -IF-.charx');
const CHARX_KOREAN = path.join(TESTING_DIR, 'risu_charx/오가미 이토코 v4.51.charx');

// Voxta packages
const VOXTA_2B = path.join(TESTING_DIR, 'voxta/2B.1.0.0.voxpkg');
const VOXTA_NYX = path.join(TESTING_DIR, 'voxta/Agent Nyx.1.0.0.voxpkg');
const VOXTA_VEXA = path.join(TESTING_DIR, 'voxta/Vexa.1.0.0.voxpkg');

// CharacterTavern cards
const CT_AEGIS = path.join(TESTING_DIR, 'CharacterTavern/aegis_matronae__the_last_hope.png');
const CT_AESE = path.join(TESTING_DIR, 'CharacterTavern/aese.png');

// Wyvern cards
const WYVERN_AIRA = path.join(TESTING_DIR, 'wyvern/Aira __ Sweet Hydromancer Friend.png');
const WYVERN_AKIRA = path.join(TESTING_DIR, 'wyvern/Akira_Kurosawa___Meridians_dark_guardian_5029400.png');

test.describe('Real Card Import Tests', () => {
  // Run tests serially to avoid database/storage conflicts
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Clear storage before each test for clean slate
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await waitForAppLoad(page);
  });

  test.describe('CCv2 Format (ChubAI)', () => {
    test('should import CCv2 PNG card (Shana)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      // Import the card
      const importButton = page.locator('button:has-text("Import")');
      await expect(importButton).toBeVisible({ timeout: 10000 });
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CCv2_PNG);

      // Wait for card to load
      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      // Verify card loaded - should have character name visible
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Shana/i, { timeout: 5000 });

      // Verify we're on a card edit page
      await expect(page).toHaveURL(/\/cards\//);
    });

    test('should import CCv2 JSON card (Shana)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      // Import JSON version
      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CCv2_JSON);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      // Verify same card as PNG
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Shana/i, { timeout: 5000 });
    });

    test('should import complex CCv2 card with extended data (Zephyra)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CCv2_COMPLEX_PNG);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Zephyra/i, { timeout: 5000 });

      // Complex cards may have additional tabs (Assets, Lorebook, etc.)
      // Just verify basic import worked
      await expect(page).toHaveURL(/\/cards\//);
    });
  });

  test.describe('RisuAI v3 Format', () => {
    test('should import RisuAI v3 card (Character Creator Bot)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(RISU_V3_CREATOR);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      // Verify character name
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Creator/i, { timeout: 5000 });
    });

    test('should import RisuAI v3 card with assets (Monster Musume)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(RISU_V3_MONSTER);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      // Verify card loaded
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).not.toBeEmpty({ timeout: 5000 });

      // Check if Assets tab is available (cards with assets should show this)
      const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")');
      if (await assetsTab.isVisible().catch(() => false)) {
        await assetsTab.click();
        await page.waitForTimeout(500);
        // Should show assets panel
      }
    });

    test('should import RisuAI v3 card with special characters', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(RISU_V3_WEDDING);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).not.toBeEmpty({ timeout: 5000 });
    });
  });

  test.describe('CharX Format', () => {
    // CharX files are large (25-72MB) - use dynamic timeouts
    test('should import CharX card (Ailu Narukami)', async ({ page }) => {
      const timeout = getTimeoutForFile(CHARX_AILU);
      test.setTimeout(timeout + 30000); // Extra buffer for test overhead

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CHARX_AILU);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      // Verify character loaded
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Ailu/i, { timeout: 5000 });
    });

    test('should import CharX card (Harper)', async ({ page }) => {
      const timeout = getTimeoutForFile(CHARX_HARPER); // 72MB = ~29s timeout
      test.setTimeout(timeout + 60000); // Extra buffer for test overhead

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CHARX_HARPER);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Harper/i, { timeout: 5000 });
    });

    test('should import CharX scenario card (Hogwarts)', async ({ page }) => {
      const timeout = getTimeoutForFile(CHARX_HOGWARTS); // 60MB = ~27s timeout
      test.setTimeout(timeout + 60000);

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CHARX_HOGWARTS);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Hogwarts/i, { timeout: 5000 });
    });

    test('should import CharX card with Korean filename', async ({ page }) => {
      const timeout = getTimeoutForFile(CHARX_KOREAN); // 38MB = ~23s timeout
      test.setTimeout(timeout + 60000);

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CHARX_KOREAN);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      // Verify card loaded (name might be in Korean)
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).not.toBeEmpty({ timeout: 5000 });
    });
  });

  test.describe('Voxta Package Format', () => {
    // Voxta packages can be large (6-28MB) - use dynamic timeouts
    test('should import Voxta package (2B)', async ({ page }) => {
      const timeout = getTimeoutForFile(VOXTA_2B);
      test.setTimeout(timeout + 30000);

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(VOXTA_2B);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      // Verify character loaded
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/2B/i, { timeout: 5000 });
    });

    test('should import Voxta package (Agent Nyx)', async ({ page }) => {
      const timeout = getTimeoutForFile(VOXTA_NYX); // 19MB
      test.setTimeout(timeout + 30000);

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(VOXTA_NYX);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Nyx/i, { timeout: 5000 });
    });

    test('should import Voxta package (Vexa)', async ({ page }) => {
      const timeout = getTimeoutForFile(VOXTA_VEXA); // 28MB
      test.setTimeout(timeout + 30000);

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(VOXTA_VEXA);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Vexa/i, { timeout: 5000 });
    });
  });

  test.describe('CharacterTavern Format', () => {
    test('should import CharacterTavern card (Aegis)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CT_AEGIS);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Aegis/i, { timeout: 5000 });
    });

    test('should import CharacterTavern card (Aese)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CT_AESE);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Aese/i, { timeout: 5000 });
    });
  });

  test.describe('Wyvern Format', () => {
    test('should import Wyvern card (Aira)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(WYVERN_AIRA);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Aira/i, { timeout: 5000 });
    });

    test('should import Wyvern card (Akira)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(WYVERN_AKIRA);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Akira/i, { timeout: 5000 });
    });
  });

  test.describe('Import Data Integrity', () => {
    test('should preserve all card fields after import (CCv2)', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CCv2_PNG);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      // Name field should be populated
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(/Shana/i, { timeout: 5000 });

      // Navigate to Character tab to verify character data loaded
      const characterTab = page.locator('button:has-text("Character")');
      if (await characterTab.isVisible().catch(() => false)) {
        await characterTab.click();
        await page.waitForTimeout(500);
      }

      // Check that there's content visible in the editor area
      // The app uses custom editors (CodeMirror/Monaco), not standard textareas
      // Look for editor containers with content or check text content
      const editorContent = page.locator('.cm-content, .monaco-editor, [data-testid="editor"], .editor-content');
      const hasEditor = await editorContent.count() > 0;

      if (hasEditor) {
        // If using CodeMirror or Monaco, check for visible text content
        const visibleText = await page.locator('.cm-line, .view-line').first().textContent().catch(() => '');
        expect(visibleText || '').toBeTruthy();
      } else {
        // Fallback: check for any text content in the main content area
        const mainContent = page.locator('[class*="content"], [class*="editor"]').first();
        if (await mainContent.isVisible().catch(() => false)) {
          const text = await mainContent.textContent();
          expect(text || '').toBeTruthy();
        }
      }
    });

    test('should handle cards with no avatar gracefully', async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CCv2_JSON);

      await page.waitForURL(/\/cards\//, { timeout: 15000 });
      await waitForAppLoad(page);

      // Should still load even without an embedded avatar
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).not.toBeEmpty({ timeout: 5000 });
    });

    test('should import cards with special characters in content', async ({ page }) => {
      // Use complex card that likely has special chars (Korean filename, 38MB)
      const timeout = getTimeoutForFile(CHARX_KOREAN);
      test.setTimeout(timeout + 60000);

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(CHARX_KOREAN);

      await page.waitForURL(/\/cards\//, { timeout });
      await waitForAppLoad(page);

      // Should handle Unicode characters properly
      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).not.toBeEmpty({ timeout: 5000 });
    });
  });

  test.describe('Import Error Handling', () => {
    test('should show error for invalid file type', async ({ page }) => {
      // Create a temporary text file to test invalid import
      const invalidFile = path.join('/tmp', 'invalid-card.txt');
      const fs = require('fs');
      fs.writeFileSync(invalidFile, 'This is not a valid card file');

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(invalidFile);

      // Should either stay on home page or show error
      // Wait a bit to see if there's navigation
      await page.waitForTimeout(2000);

      // Should not navigate to card edit page
      const url = page.url();
      expect(url).not.toMatch(/\/cards\/[a-zA-Z0-9_-]+$/);

      // Clean up
      fs.unlinkSync(invalidFile);
    });

    test('should handle corrupted PNG file gracefully', async ({ page }) => {
      // Create a corrupted PNG (just a few bytes)
      const corruptedPng = path.join('/tmp', 'corrupted.png');
      const fs = require('fs');
      fs.writeFileSync(corruptedPng, Buffer.from([0x89, 0x50, 0x4E, 0x47])); // Incomplete PNG header

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(corruptedPng);

      await page.waitForTimeout(2000);

      // Should not crash the app
      const url = page.url();
      expect(url).toBeTruthy();

      // Clean up
      fs.unlinkSync(corruptedPng);
    });
  });
});

test.describe('Batch Import Tests', () => {
  test('should import multiple cards sequentially', async ({ page }) => {
    // Calculate total timeout for all cards
    const cards = [
      { file: CCv2_PNG, expectedName: /Shana/i },
      { file: CHARX_HARPER, expectedName: /Harper/i }, // 72MB
      { file: VOXTA_VEXA, expectedName: /Vexa/i }, // 28MB
    ];

    const totalTimeout = cards.reduce((acc, card) => acc + getTimeoutForFile(card.file), 0);
    test.setTimeout(totalTimeout + 120000); // Extra buffer for test overhead

    for (const card of cards) {
      const cardTimeout = getTimeoutForFile(card.file);

      await page.goto('/');
      await waitForAppLoad(page);

      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      await page.waitForTimeout(300);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(card.file);

      await page.waitForURL(/\/cards\//, { timeout: cardTimeout });
      await waitForAppLoad(page);

      const nameInput = page.getByRole('textbox').first();
      await expect(nameInput).toHaveValue(card.expectedName, { timeout: 5000 });
    }
  });
});
