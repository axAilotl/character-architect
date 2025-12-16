#!/usr/bin/env node
/**
 * Debug card data structures to find why some cards show "Unknown Character"
 */

import { readFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';
import { parseCard } from '@character-foundry/character-foundry/loader';

const TEST_DIR = '/mnt/ai/test_cf_data/chub_v2';

console.log('Debugging card data structures\n');
console.log('=' .repeat(80));

const files = readdirSync(TEST_DIR).filter(f => f.endsWith('.png'));

for (const filename of files) {
  const filepath = join(TEST_DIR, filename);
  console.log(`\n${filename}:`);

  try {
    const buffer = readFileSync(filepath);
    const uint8Array = new Uint8Array(buffer);
    const result = parseCard(uint8Array, { extractAssets: true });

    if (!result || !result.card) {
      console.log('  ✗ parseCard returned null');
      continue;
    }

    console.log(`  spec: ${result.spec}`);
    console.log(`  sourceFormat: ${result.sourceFormat}`);

    const cardData = result.card;

    // Check V3 structure
    if (result.spec === 'v3') {
      console.log(`  v3Data.data exists: ${!!cardData.data}`);
      console.log(`  v3Data.data.name: ${cardData.data?.name}`);
    }

    // Check V2 structure
    if (result.spec === 'v2') {
      console.log(`  Has 'data' property: ${!!('data' in cardData)}`);
      console.log(`  cardData.data exists: ${!!cardData.data}`);
      console.log(`  cardData.data.name: ${cardData.data?.name}`);
      console.log(`  cardData.name (unwrapped): ${cardData.name}`);

      // Show structure
      const keys = Object.keys(cardData).slice(0, 10);
      console.log(`  Top-level keys: ${keys.join(', ')}`);

      if (cardData.data) {
        const dataKeys = Object.keys(cardData.data).slice(0, 10);
        console.log(`  data.* keys: ${dataKeys.join(', ')}`);
      }
    }

  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  }
}
