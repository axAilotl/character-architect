#!/usr/bin/env node
/**
 * Test client-side imports (LITE MODE) with the parseCard loader
 * This simulates what happens in the browser without an API server
 */

import { readFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';
import { parseCard } from '@character-foundry/character-foundry/loader';

const TEST_DIR = '/mnt/ai/test_cf_data/chub_v2';

console.log('Testing CLIENT-SIDE (LITE MODE) imports using parseCard loader\n');
console.log('=' .repeat(80));

const results = {
  passed: [],
  failed: [],
};

// Get all PNG files
const files = readdirSync(TEST_DIR).filter(f => f.endsWith('.png'));

console.log(`Found ${files.length} PNG files to test\n`);

for (const filename of files) {
  const filepath = join(TEST_DIR, filename);
  process.stdout.write(`Testing: ${filename.padEnd(60)} ... `);

  try {
    const buffer = readFileSync(filepath);
    const uint8Array = new Uint8Array(buffer);

    // Use parseCard (client-side loader) - this is what runs in lite mode
    const result = parseCard(uint8Array, { extractAssets: true });

    if (!result || !result.card) {
      throw new Error('parseCard returned null or no card');
    }

    // Verify we got actual data
    const cardData = result.card;
    let name = 'Unknown';
    let hasData = false;

    if (result.spec === 'v3' && cardData.data) {
      name = cardData.data.name || 'Unknown';
      hasData = !!(cardData.data.description || cardData.data.personality || cardData.data.first_mes);
    } else if (result.spec === 'v2') {
      // V2 can be wrapped or unwrapped
      const data = cardData.data || cardData;
      name = data.name || 'Unknown';
      hasData = !!(data.description || data.personality || data.first_mes);
    }

    if (!hasData) {
      throw new Error('Card has no actual character data (description/personality/first_mes all empty)');
    }

    console.log(`✓ ${name} (${result.spec}) - ${result.sourceFormat || 'unknown format'}`);
    results.passed.push({
      file: filename,
      name,
      spec: result.spec,
      format: result.sourceFormat,
    });

  } catch (err) {
    console.log(`✗ FAILED: ${err.message}`);
    results.failed.push({
      file: filename,
      error: err.message,
    });
  }
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY:');
console.log(`  ✓ Passed: ${results.passed.length}`);
console.log(`  ✗ Failed: ${results.failed.length}`);
console.log(`  Success Rate: ${((results.passed.length / files.length) * 100).toFixed(1)}%`);

if (results.failed.length > 0) {
  console.log('\nFAILED FILES:');
  for (const fail of results.failed) {
    console.log(`  - ${fail.file}: ${fail.error}`);
  }
  process.exit(1);
}

console.log('\n✅ ALL CLIENT-SIDE IMPORTS WORKING!');
process.exit(0);
