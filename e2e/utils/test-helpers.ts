/**
 * Test Helpers and Utilities
 *
 * Common functions used across E2E tests.
 */

import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Character traits for random generation
const NAMES = [
  'Luna Starweaver', 'Marcus Ironheart', 'Aria Nightshade', 'Theron Blackwood',
  'Celeste Moonfire', 'Dante Shadowmere', 'Lyra Stormwind', 'Viktor Ashford',
  'Seraphina Dawnlight', 'Kael Frostborne', 'Elara Wildwood', 'Zephyr Cloudwalker',
];

const PERSONALITIES = [
  'Curious and adventurous', 'Stoic and wise', 'Playful and mischievous',
  'Serious and dedicated', 'Warm and nurturing', 'Cold and calculating',
  'Optimistic and energetic', 'Mysterious and enigmatic', 'Loyal and protective',
];

const SCENARIOS = [
  'A chance encounter in a bustling marketplace',
  'Meeting during a dangerous quest',
  'Reuniting after years apart',
  'Discovering a shared secret',
  'Stranded together in a storm',
];

const DESCRIPTIONS = [
  'A skilled warrior with eyes that have seen countless battles.',
  'An enigmatic mage whose power rivals the ancient ones.',
  'A cunning rogue who always has an escape plan.',
  'A noble diplomat skilled in the art of persuasion.',
  'A wandering healer seeking to mend broken souls.',
];

const GREETINGS = [
  '*looks up with curiosity* "Well, well... another traveler crosses my path."',
  '"Greetings, stranger. What brings you to these parts?"',
  '*adjusts their cloak and smiles* "I was wondering when you would arrive."',
  '"Ah, finally! I have been expecting someone like you."',
];

const TAGS = [
  ['fantasy', 'adventure', 'magic'],
  ['sci-fi', 'space', 'exploration'],
  ['romance', 'drama', 'emotional'],
  ['mystery', 'thriller', 'suspense'],
  ['slice-of-life', 'comedy', 'wholesome'],
];

/**
 * Generate random card data for testing
 */
export function generateRandomCard() {
  return {
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    description: DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)],
    personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
    scenario: SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)],
    first_mes: GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    tags: TAGS[Math.floor(Math.random() * TAGS.length)],
    creator: 'E2E Test Suite',
  };
}

/**
 * Generate a random test image as base64
 */
export function generateTestImage(width = 512, height = 512): string {
  // Create a simple PNG with random colored pixels
  // This is a 1x1 pixel PNG placeholder - in real tests we'd generate actual images
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
    0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  return `data:image/png;base64,${pngHeader.toString('base64')}`;
}

/**
 * Wait for the app to be fully loaded
 */
export async function waitForAppLoad(page: Page) {
  // Wait for the main app container
  await page.waitForSelector('[class*="App"], [id="root"]', { timeout: 30000 });

  // Wait for any loading indicators to disappear
  await page.waitForFunction(() => {
    const loaders = document.querySelectorAll('[class*="loading"], [class*="spinner"]');
    return loaders.length === 0 || Array.from(loaders).every(l => {
      const style = window.getComputedStyle(l);
      return style.display === 'none' || style.visibility === 'hidden';
    });
  }, { timeout: 15000 }).catch(() => {
    // Ignore timeout - some pages may not have loading indicators
  });

  // Small delay for hydration
  await page.waitForTimeout(500);
}

/**
 * Navigate to the card editor
 */
export async function navigateToEditor(page: Page) {
  await waitForAppLoad(page);

  // Click "New" button to create a new card
  const newButton = page.locator('button:has-text("New")');
  if (await newButton.isVisible()) {
    await newButton.click();
    await page.waitForURL(/\/cards\//, { timeout: 10000 });
  }

  await waitForAppLoad(page);
}

/**
 * Fill in card data in the editor
 */
export async function fillCardData(page: Page, data: ReturnType<typeof generateRandomCard>) {
  // Wait for editor to load - specifically wait for visible text inputs (not hidden file inputs)
  await page.waitForSelector('input[name="name"]:visible, input[placeholder*="name" i]:visible', { timeout: 10000 });

  // Fill name
  const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill(data.name);
  }

  // Fill description
  const descriptionArea = page.locator('textarea[name="description"], textarea[placeholder*="description" i]').first();
  if (await descriptionArea.isVisible()) {
    await descriptionArea.fill(data.description);
  }

  // Fill personality
  const personalityArea = page.locator('textarea[name="personality"], textarea[placeholder*="personality" i]').first();
  if (await personalityArea.isVisible()) {
    await personalityArea.fill(data.personality);
  }

  // Fill scenario
  const scenarioArea = page.locator('textarea[name="scenario"], textarea[placeholder*="scenario" i]').first();
  if (await scenarioArea.isVisible()) {
    await scenarioArea.fill(data.scenario);
  }

  // Fill first message
  const firstMesArea = page.locator('textarea[name="first_mes"], textarea[placeholder*="greeting" i], textarea[placeholder*="first" i]').first();
  if (await firstMesArea.isVisible()) {
    await firstMesArea.fill(data.first_mes);
  }

  // Small delay for state updates
  await page.waitForTimeout(500);
}

/**
 * Export a card in the specified format
 */
export async function exportCard(page: Page, format: 'json' | 'png' | 'charx' | 'voxta'): Promise<string> {
  // Set up download handler
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

  // Click Export dropdown
  const exportButton = page.locator('button:has-text("Export")');
  await exportButton.click();

  // Wait for dropdown menu
  await page.waitForSelector('[class*="dropdown"], [class*="menu"]', { timeout: 5000 });

  // Click the format button
  const formatButton = page.locator(`button:has-text("${format.toUpperCase()}")`);
  await formatButton.click();

  // Wait for download
  const download = await downloadPromise;

  // Save to temp location
  const downloadPath = path.join(__dirname, '..', 'test-downloads', download.suggestedFilename());
  await download.saveAs(downloadPath);

  return downloadPath;
}

/**
 * Validate JSON card data structure
 */
export function validateJsonCard(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields based on spec
  if (!data.spec && !data.name) {
    errors.push('Missing spec field (CCv3) or name field (CCv2)');
  }

  if (data.spec === 'chara_card_v3') {
    // CCv3 validation
    if (!data.data) {
      errors.push('CCv3: Missing data object');
    } else {
      if (!data.data.name) errors.push('CCv3: Missing data.name');
      if (typeof data.data.description !== 'string') errors.push('CCv3: Missing data.description');
      if (typeof data.data.personality !== 'string') errors.push('CCv3: Missing data.personality');
      if (typeof data.data.scenario !== 'string') errors.push('CCv3: Missing data.scenario');
      if (typeof data.data.first_mes !== 'string') errors.push('CCv3: Missing data.first_mes');
      if (!Array.isArray(data.data.group_only_greetings)) errors.push('CCv3: Missing data.group_only_greetings array');
    }
  } else if (data.spec === 'chara_card_v2' || data.name) {
    // CCv2 validation
    const cardData = data.data || data;
    if (!cardData.name) errors.push('CCv2: Missing name');
    if (typeof cardData.description !== 'string') errors.push('CCv2: Missing description');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate PNG file has embedded character data
 */
export async function validatePngCard(filePath: string): Promise<{ valid: boolean; errors: string[]; data?: any }> {
  const errors: string[] = [];

  try {
    const buffer = fs.readFileSync(filePath);

    // Check PNG signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (!buffer.subarray(0, 8).equals(pngSignature)) {
      errors.push('Invalid PNG signature');
      return { valid: false, errors };
    }

    // Look for tEXt chunk with "chara" keyword
    let offset = 8;
    let foundChara = false;
    let charaData: any = null;

    while (offset < buffer.length - 8) {
      const chunkLength = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('ascii', offset + 4, offset + 8);

      if (chunkType === 'tEXt') {
        const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLength);
        const nullIndex = chunkData.indexOf(0);
        const keyword = chunkData.toString('ascii', 0, nullIndex);

        if (keyword === 'chara') {
          foundChara = true;
          const base64Data = chunkData.toString('ascii', nullIndex + 1);
          try {
            const jsonStr = Buffer.from(base64Data, 'base64').toString('utf8');
            charaData = JSON.parse(jsonStr);
          } catch {
            errors.push('Failed to parse character data from PNG');
          }
          break;
        }
      }

      offset += 12 + chunkLength;
    }

    if (!foundChara) {
      errors.push('PNG does not contain character data (no tEXt chunk with "chara" keyword)');
    }

    if (charaData) {
      const jsonValidation = validateJsonCard(charaData);
      errors.push(...jsonValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      data: charaData,
    };
  } catch (err) {
    errors.push(`Failed to read PNG file: ${err}`);
    return { valid: false, errors };
  }
}

/**
 * Validate CHARX file structure
 */
export async function validateCharxFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const buffer = fs.readFileSync(filePath);

    // Check for ZIP signature (CHARX is a ZIP file)
    const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    if (!buffer.subarray(0, 4).equals(zipSignature)) {
      errors.push('Invalid CHARX file - not a valid ZIP archive');
      return { valid: false, errors };
    }

    // For now, just check it's a valid ZIP
    // In a real test, we'd extract and validate card.json
    const hasCardJson = buffer.includes(Buffer.from('card.json'));
    if (!hasCardJson) {
      errors.push('CHARX file does not contain card.json');
    }

  } catch (err) {
    errors.push(`Failed to read CHARX file: ${err}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get all interactive elements on the page
 */
export async function getAllInteractiveElements(page: Page) {
  return page.evaluate(() => {
    const elements: Array<{
      tagName: string;
      type?: string;
      text?: string;
      id?: string;
      className?: string;
      isVisible: boolean;
      isEnabled: boolean;
    }> = [];

    const selectors = [
      'button',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])',
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        elements.push({
          tagName: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || undefined,
          text: el.textContent?.slice(0, 50) || undefined,
          id: el.id || undefined,
          className: el.className?.toString().slice(0, 100) || undefined,
          isVisible: rect.width > 0 && rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0',
          isEnabled: !(el as HTMLButtonElement).disabled,
        });
      });
    });

    return elements;
  });
}

/**
 * Check for console errors
 */
export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  return errors;
}

/**
 * Get deployment mode from the page
 */
export async function getDeploymentMode(page: Page): Promise<string> {
  return page.evaluate(() => {
    // Try to access deployment config
    const config = (window as any).__DEPLOYMENT_CONFIG__;
    if (config?.mode) return config.mode;

    // Check for indicators
    if (document.querySelector('[data-mode]')) {
      return document.querySelector('[data-mode]')?.getAttribute('data-mode') || 'unknown';
    }

    // Fallback: check if API endpoints work
    return 'unknown';
  });
}

/**
 * Compare features between two pages (parity test)
 */
export async function compareFeatures(fullModePage: Page, lightModePage: Page) {
  const differences: Array<{
    feature: string;
    fullMode: boolean;
    lightMode: boolean;
  }> = [];

  const featuresToCheck = [
    { selector: 'button:has-text("Export")', name: 'Export button' },
    { selector: 'button:has-text("Import")', name: 'Import button' },
    { selector: '[class*="template"], button:has-text("Templates")', name: 'Templates' },
    { selector: '[class*="snippet"], button:has-text("Snippets")', name: 'Snippets' },
    { selector: 'button:has-text("Assets")', name: 'Assets tab' },
    { selector: 'button:has-text("Lorebook")', name: 'Lorebook tab' },
    { selector: 'button:has-text("Settings"), button:text("⚙️")', name: 'Settings button' },
  ];

  for (const feature of featuresToCheck) {
    const fullModeHas = await fullModePage.locator(feature.selector).first().isVisible().catch(() => false);
    const lightModeHas = await lightModePage.locator(feature.selector).first().isVisible().catch(() => false);

    if (fullModeHas !== lightModeHas) {
      differences.push({
        feature: feature.name,
        fullMode: fullModeHas,
        lightMode: lightModeHas,
      });
    }
  }

  return differences;
}
