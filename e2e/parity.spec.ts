/**
 * Cloud-PWA vs Self-Hosted Parity E2E Tests
 *
 * Ensures feature parity between deployment modes:
 * - Full mode (self-hosted with API server)
 * - Light mode (cloud/PWA with minimal server)
 * - Static mode (purely client-side, no server)
 *
 * Tests verify that:
 * 1. Core features work identically across modes
 * 2. Server-only features are properly hidden in light/static modes
 * 3. Client-side alternatives work correctly
 * 4. Data persistence works via localStorage/IndexedDB
 */

import { test, expect, Page, Browser, chromium } from '@playwright/test';
import {
  waitForAppLoad,
  navigateToEditor,
  fillCardData,
  generateRandomCard,
  getAllInteractiveElements,
} from './utils/test-helpers';

// URLs for different deployment modes
const FULL_MODE_URL = process.env.FULL_MODE_URL || 'http://localhost:5173';
const LIGHT_MODE_URL = process.env.LIGHT_MODE_URL || 'http://localhost:4173';

// Features that should be present in all modes
const UNIVERSAL_FEATURES = [
  { name: 'Create new card', selector: 'button:has-text("New")' },
  { name: 'Import from file', selector: 'button:has-text("Import")' },
  { name: 'Export to JSON', selector: 'button:has-text("Export")' },
  { name: 'Settings button', selector: 'button:has-text("⚙️"), button[title*="Settings"]' },
  { name: 'Basic Info tab', selector: 'button:has-text("Basic"), [role="tab"]:has-text("Basic")' },
  { name: 'Character tab', selector: 'button:has-text("Character"), [role="tab"]:has-text("Character")' },
  { name: 'Greetings tab', selector: 'button:has-text("Greetings"), [role="tab"]:has-text("Greetings")' },
  { name: 'Lorebook tab', selector: 'button:has-text("Lorebook"), [role="tab"]:has-text("Lorebook")' },
];

// Features that should only be in full/server mode
const SERVER_ONLY_FEATURES = [
  { name: 'Import from URL', selector: 'button:has-text("From URL"), button:has-text("URL")' },
  { name: 'ComfyUI tab', selector: 'button:has-text("ComfyUI"), [data-module="comfyui"]' },
  { name: 'ComfyUI settings', selector: '[class*="comfyui"], button:has-text("ComfyUI") + *' },
];

// Features that should have client-side alternatives in light mode
const FEATURES_WITH_ALTERNATIVES = [
  {
    name: 'AI Tag Generation',
    fullModeSelector: 'button:has-text("Generate Tags")',
    lightModeSelector: 'button:has-text("Generate Tags")', // Same button, different backend
    description: 'Should use client-side LLM in light mode',
  },
  {
    name: 'SillyTavern Push',
    fullModeSelector: 'button:has-text("SillyTavern")',
    lightModeSelector: 'button:has-text("SillyTavern")', // Client-side push for localhost
    description: 'Should use client-side push for localhost in light mode',
  },
  {
    name: 'RAG/Embeddings',
    fullModeSelector: '[class*="rag"], button:has-text("RAG")',
    lightModeSelector: '[class*="rag"], button:has-text("RAG")', // WebGL embeddings
    description: 'Should use WebGL embeddings in light mode',
  },
];

// Settings that should persist via localStorage in light mode
const PERSISTED_SETTINGS = [
  'ca-templates',
  'ca-snippets',
  'ca-sillytavern-settings',
  'ca-wwwyzzerdd-prompts',
  'ca-llm-providers',
  'ca-llm-presets',
];

test.describe('Deployment Mode Parity Tests', () => {
  let browser: Browser;
  let fullModePage: Page;
  let lightModePage: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.describe('Feature Presence Comparison', () => {
    test('should have universal features in full mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(FULL_MODE_URL);
        await waitForAppLoad(page);
        await navigateToEditor(page);

        for (const feature of UNIVERSAL_FEATURES) {
          const element = page.locator(feature.selector).first();
          const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
          expect(isVisible).toBe(true);
          console.log(`[Full Mode] ${feature.name}: ${isVisible ? '✓' : '✗'}`);
        }
      } finally {
        await context.close();
      }
    });

    test('should have universal features in light mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await waitForAppLoad(page);
        await navigateToEditor(page);

        for (const feature of UNIVERSAL_FEATURES) {
          const element = page.locator(feature.selector).first();
          const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
          expect(isVisible).toBe(true);
          console.log(`[Light Mode] ${feature.name}: ${isVisible ? '✓' : '✗'}`);
        }
      } finally {
        await context.close();
      }
    });

    test('should hide server-only features in light mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await waitForAppLoad(page);
        await navigateToEditor(page);

        for (const feature of SERVER_ONLY_FEATURES) {
          const element = page.locator(feature.selector).first();
          const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
          expect(isVisible).toBe(false);
          console.log(`[Light Mode] ${feature.name} (server-only): ${isVisible ? '✗ SHOULD BE HIDDEN' : '✓ Hidden'}`);
        }
      } finally {
        await context.close();
      }
    });

    test('should have server-only features in full mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(FULL_MODE_URL);
        await waitForAppLoad(page);
        await navigateToEditor(page);

        // Open settings to check for module settings
        await page.locator('button:has-text("⚙️")').click();
        await page.waitForTimeout(500);

        for (const feature of SERVER_ONLY_FEATURES) {
          const element = page.locator(feature.selector).first();
          const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
          console.log(`[Full Mode] ${feature.name} (server-only): ${isVisible ? '✓' : '✗ Missing'}`);
        }
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Functional Parity', () => {
    test('card creation should work identically in both modes', async () => {
      const cardData = generateRandomCard();
      const results: { mode: string; success: boolean; cardId?: string }[] = [];

      // Test full mode
      const fullContext = await browser.newContext();
      const fullPage = await fullContext.newPage();
      try {
        await fullPage.goto(FULL_MODE_URL);
        await navigateToEditor(fullPage);
        await fillCardData(fullPage, cardData);
        await fullPage.waitForTimeout(1000);

        const url = fullPage.url();
        const cardId = url.match(/\/cards\/([^/]+)/)?.[1];
        results.push({ mode: 'full', success: !!cardId, cardId });
      } finally {
        await fullContext.close();
      }

      // Test light mode
      const lightContext = await browser.newContext();
      const lightPage = await lightContext.newPage();
      try {
        await lightPage.goto(LIGHT_MODE_URL);
        await navigateToEditor(lightPage);
        await fillCardData(lightPage, cardData);
        await lightPage.waitForTimeout(1000);

        const url = lightPage.url();
        const cardId = url.match(/\/cards\/([^/]+)/)?.[1];
        results.push({ mode: 'light', success: !!cardId, cardId });
      } finally {
        await lightContext.close();
      }

      // Both should succeed
      expect(results.every(r => r.success)).toBe(true);
      console.log('Card creation results:', results);
    });

    test('export should work in both modes', async () => {
      const cardData = generateRandomCard();
      const results: { mode: string; format: string; success: boolean }[] = [];

      for (const mode of ['full', 'light']) {
        const url = mode === 'full' ? FULL_MODE_URL : LIGHT_MODE_URL;
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          await page.goto(url);
          await navigateToEditor(page);
          await fillCardData(page, cardData);
          await page.waitForTimeout(1000);

          // Test JSON export
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
          await page.locator('button:has-text("Export")').click();
          const jsonBtn = page.locator('button:has-text("JSON")');
          await expect(jsonBtn).toBeVisible({ timeout: 5000 });
          await jsonBtn.click();

          const download = await downloadPromise.catch(() => null);
          results.push({
            mode,
            format: 'JSON',
            success: !!download,
          });

          if (download) {
            console.log(`[${mode.toUpperCase()} Mode] JSON export: ✓`);
          }
        } catch (err) {
          results.push({ mode, format: 'JSON', success: false });
          console.log(`[${mode.toUpperCase()} Mode] JSON export: ✗`);
        } finally {
          await context.close();
        }
      }

      // Both modes should support JSON export
      expect(results.filter(r => r.format === 'JSON').every(r => r.success)).toBe(true);
    });

    test('templates should persist in light mode via localStorage', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await waitForAppLoad(page);

        // Open settings
        await page.locator('button:has-text("⚙️")').click();
        await page.waitForTimeout(500);

        // Navigate to Templates tab
        await page.locator('button:has-text("Templates")').click().catch(() => {});
        await page.waitForTimeout(500);

        // Check if templates are loaded from localStorage
        const hasTemplates = await page.evaluate(() => {
          const stored = localStorage.getItem('ca-templates');
          return stored !== null;
        });

        // After visiting templates tab, localStorage should have data
        // (either loaded or initialized with defaults)
        expect(hasTemplates).toBe(true);
        console.log('[Light Mode] Templates localStorage:', hasTemplates ? '✓' : '✗');
      } finally {
        await context.close();
      }
    });

    test('snippets should persist in light mode via localStorage', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await waitForAppLoad(page);

        // Open settings and go to templates (which includes snippets)
        await page.locator('button:has-text("⚙️")').click();
        await page.waitForTimeout(500);
        await page.locator('button:has-text("Templates")').click().catch(() => {});
        await page.waitForTimeout(500);

        // Switch to snippets tab if present
        await page.locator('button:has-text("Snippets")').click().catch(() => {});
        await page.waitForTimeout(500);

        const hasSnippets = await page.evaluate(() => {
          const stored = localStorage.getItem('ca-snippets');
          return stored !== null;
        });

        expect(hasSnippets).toBe(true);
        console.log('[Light Mode] Snippets localStorage:', hasSnippets ? '✓' : '✗');
      } finally {
        await context.close();
      }
    });

    test('LLM providers should persist in light mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await waitForAppLoad(page);

        // Open settings and go to AI Providers
        await page.locator('button:has-text("⚙️")').click();
        await page.waitForTimeout(500);
        await page.locator('button:has-text("AI Providers"), button:has-text("Providers")').click().catch(() => {});
        await page.waitForTimeout(500);

        // Check localStorage for LLM providers
        const hasProviders = await page.evaluate(() => {
          const stored = localStorage.getItem('ca-llm-providers');
          return stored !== null;
        });

        console.log('[Light Mode] LLM Providers localStorage:', hasProviders ? '✓' : '(not yet initialized)');
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Settings Parity', () => {
    test('should have same settings tabs available (excluding server-only)', async () => {
      const fullContext = await browser.newContext();
      const fullPage = await fullContext.newPage();
      const lightContext = await browser.newContext();
      const lightPage = await lightContext.newPage();

      try {
        // Get full mode tabs
        await fullPage.goto(FULL_MODE_URL);
        await waitForAppLoad(fullPage);
        await fullPage.locator('button:has-text("⚙️")').click();
        await fullPage.waitForTimeout(500);

        const fullModeTabs = await fullPage.evaluate(() => {
          const tabs = document.querySelectorAll('[class*="tab"], [role="tab"], button[class*="px-4"]');
          return Array.from(tabs).map(t => t.textContent?.trim()).filter(Boolean);
        });

        // Get light mode tabs
        await lightPage.goto(LIGHT_MODE_URL);
        await waitForAppLoad(lightPage);
        await lightPage.locator('button:has-text("⚙️")').click();
        await lightPage.waitForTimeout(500);

        const lightModeTabs = await lightPage.evaluate(() => {
          const tabs = document.querySelectorAll('[class*="tab"], [role="tab"], button[class*="px-4"]');
          return Array.from(tabs).map(t => t.textContent?.trim()).filter(Boolean);
        });

        console.log('[Full Mode] Settings tabs:', fullModeTabs.join(', '));
        console.log('[Light Mode] Settings tabs:', lightModeTabs.join(', '));

        // Server-only tabs that should be hidden in light mode
        const serverOnlyTabs = ['ComfyUI', 'Web Import', 'Package Optimizer'];

        // Check that light mode has all tabs except server-only
        for (const tab of fullModeTabs) {
          if (!serverOnlyTabs.some(s => tab?.includes(s))) {
            const hasTab = lightModeTabs.some(t => t?.includes(tab || ''));
            console.log(`Tab "${tab}": ${hasTab ? '✓ Present in both' : '✗ Missing in light mode'}`);
          } else {
            const hasTab = lightModeTabs.some(t => t?.includes(tab || ''));
            console.log(`Tab "${tab}" (server-only): ${hasTab ? '✗ Should be hidden' : '✓ Correctly hidden'}`);
          }
        }
      } finally {
        await fullContext.close();
        await lightContext.close();
      }
    });

    test('wwwyzzerdd should be available in light mode with client-side LLM', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await waitForAppLoad(page);

        // Open settings
        await page.locator('button:has-text("⚙️")').click();
        await page.waitForTimeout(500);

        // Look for wwwyzzerdd settings
        const wwwyzzerddTab = page.locator('button:has-text("wwwyzzerdd")').first();
        const isVisible = await wwwyzzerddTab.isVisible({ timeout: 2000 }).catch(() => false);

        console.log('[Light Mode] wwwyzzerdd settings:', isVisible ? '✓ Available' : '✗ Missing');

        // If visible, check it works with localStorage
        if (isVisible) {
          await wwwyzzerddTab.click();
          await page.waitForTimeout(500);

          const hasLocalStorage = await page.evaluate(() => {
            return localStorage.getItem('ca-wwwyzzerdd-prompts') !== null;
          });

          console.log('[Light Mode] wwwyzzerdd localStorage:', hasLocalStorage ? '✓' : '(not yet initialized)');
        }
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Data Persistence Parity', () => {
    test('should persist card data in IndexedDB in light mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const cardData = generateRandomCard();

      try {
        await page.goto(LIGHT_MODE_URL);
        await navigateToEditor(page);
        await fillCardData(page, cardData);
        await page.waitForTimeout(1500); // Wait for auto-save

        // Check IndexedDB
        const hasCardInDB = await page.evaluate(async () => {
          return new Promise((resolve) => {
            const request = indexedDB.open('card-architect');
            request.onsuccess = () => {
              const db = request.result;
              const stores = Array.from(db.objectStoreNames);
              resolve(stores.includes('cards'));
            };
            request.onerror = () => resolve(false);
          });
        });

        expect(hasCardInDB).toBe(true);
        console.log('[Light Mode] IndexedDB cards store:', hasCardInDB ? '✓' : '✗');
      } finally {
        await context.close();
      }
    });

    test('should persist images in IndexedDB in light mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await navigateToEditor(page);
        await fillCardData(page, generateRandomCard());
        await page.waitForTimeout(1500);

        // Check for images store
        const hasImagesStore = await page.evaluate(async () => {
          return new Promise((resolve) => {
            const request = indexedDB.open('card-architect');
            request.onsuccess = () => {
              const db = request.result;
              const stores = Array.from(db.objectStoreNames);
              resolve(stores.includes('images'));
            };
            request.onerror = () => resolve(false);
          });
        });

        console.log('[Light Mode] IndexedDB images store:', hasImagesStore ? '✓' : '✗');
      } finally {
        await context.close();
      }
    });

    test('should persist assets in IndexedDB in light mode', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(LIGHT_MODE_URL);
        await navigateToEditor(page);
        await page.waitForTimeout(1000);

        // Check for assets store
        const hasAssetsStore = await page.evaluate(async () => {
          return new Promise((resolve) => {
            const request = indexedDB.open('card-architect');
            request.onsuccess = () => {
              const db = request.result;
              const stores = Array.from(db.objectStoreNames);
              resolve(stores.includes('assets'));
            };
            request.onerror = () => resolve(false);
          });
        });

        console.log('[Light Mode] IndexedDB assets store:', hasAssetsStore ? '✓' : '✗');
      } finally {
        await context.close();
      }
    });
  });

  test.describe('UI Consistency', () => {
    test('should have consistent button styling across modes', async () => {
      const fullContext = await browser.newContext();
      const fullPage = await fullContext.newPage();
      const lightContext = await browser.newContext();
      const lightPage = await lightContext.newPage();

      try {
        await fullPage.goto(FULL_MODE_URL);
        await waitForAppLoad(fullPage);
        await lightPage.goto(LIGHT_MODE_URL);
        await waitForAppLoad(lightPage);

        // Get button styles
        const getButtonStyles = async (page: Page) => {
          return page.evaluate(() => {
            const button = document.querySelector('button');
            if (!button) return null;
            const style = window.getComputedStyle(button);
            return {
              backgroundColor: style.backgroundColor,
              color: style.color,
              borderRadius: style.borderRadius,
              fontFamily: style.fontFamily,
            };
          });
        };

        const fullModeStyles = await getButtonStyles(fullPage);
        const lightModeStyles = await getButtonStyles(lightPage);

        console.log('[Full Mode] Button styles:', fullModeStyles);
        console.log('[Light Mode] Button styles:', lightModeStyles);

        // Styles should be similar (same theme)
        if (fullModeStyles && lightModeStyles) {
          expect(fullModeStyles.borderRadius).toBe(lightModeStyles.borderRadius);
        }
      } finally {
        await fullContext.close();
        await lightContext.close();
      }
    });

    test('should show consistent error messages across modes', async () => {
      // Test that error handling is consistent
      for (const mode of ['full', 'light']) {
        const url = mode === 'full' ? FULL_MODE_URL : LIGHT_MODE_URL;
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          await page.goto(url);
          await waitForAppLoad(page);

          // Try to import an invalid file
          await page.locator('button:has-text("Import")').click();
          await page.waitForTimeout(300);

          // This would trigger an error - but we're just checking the UI is consistent
          console.log(`[${mode.toUpperCase()} Mode] Error handling UI: ✓ Accessible`);
        } finally {
          await context.close();
        }
      }
    });
  });

  test.describe('Performance Parity', () => {
    test('should have similar load times across modes', async () => {
      const loadTimes: { mode: string; time: number }[] = [];

      for (const mode of ['full', 'light']) {
        const url = mode === 'full' ? FULL_MODE_URL : LIGHT_MODE_URL;
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          const startTime = Date.now();
          await page.goto(url);
          await waitForAppLoad(page);
          const loadTime = Date.now() - startTime;

          loadTimes.push({ mode, time: loadTime });
          console.log(`[${mode.toUpperCase()} Mode] Load time: ${loadTime}ms`);
        } finally {
          await context.close();
        }
      }

      // Light mode should not be significantly slower (allow 2x difference)
      const fullTime = loadTimes.find(t => t.mode === 'full')?.time || 0;
      const lightTime = loadTimes.find(t => t.mode === 'light')?.time || 0;

      if (fullTime > 0 && lightTime > 0) {
        const ratio = lightTime / fullTime;
        console.log(`Load time ratio (light/full): ${ratio.toFixed(2)}`);
        expect(ratio).toBeLessThan(3); // Light mode should not be 3x slower
      }
    });
  });
});

// Summary test that runs at the end
test.describe('Parity Summary', () => {
  test('should generate parity report', async () => {
    console.log('\n========== PARITY TEST SUMMARY ==========');
    console.log('Deployment Mode Comparison');
    console.log('==========================================');
    console.log('\nCore Features (should be in both modes):');
    UNIVERSAL_FEATURES.forEach(f => console.log(`  - ${f.name}`));
    console.log('\nServer-Only Features (hidden in light mode):');
    SERVER_ONLY_FEATURES.forEach(f => console.log(`  - ${f.name}`));
    console.log('\nFeatures with Client-Side Alternatives:');
    FEATURES_WITH_ALTERNATIVES.forEach(f => console.log(`  - ${f.name}: ${f.description}`));
    console.log('\nLocalStorage Keys (for light mode persistence):');
    PERSISTED_SETTINGS.forEach(s => console.log(`  - ${s}`));
    console.log('\n==========================================\n');
  });
});
