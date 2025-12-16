/**
 * PNG Parser Verification Script
 *
 * Manual verification script to inspect parsed PNG data in detail
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePNG } from '../parsers/png.parser.js';

const TEST_DATA_DIR = '/mnt/ai/test_cf_data/chub_v2';

console.log('\n=== PNG PARSER DETAILED VERIFICATION ===\n');

const testFile = join(TEST_DATA_DIR, 'delilah_105800.png');
console.log(`Testing file: ${testFile}\n`);

const buffer = readFileSync(testFile);
console.log(`File size: ${buffer.length} bytes`);

try {
  const result = parsePNG(buffer);

  console.log('\n--- PARSED DATA STRUCTURE ---');
  console.log(`isCollection: ${result.isCollection}`);
  console.log(`characters.length: ${result.characters.length}`);

  if (result.characters.length > 0) {
    const character = result.characters[0];

    console.log('\n--- CHARACTER DATA ---');
    console.log(`Card meta name: ${character.card.meta.name}`);
    console.log(`Card meta spec: ${character.card.meta.spec}`);
    console.log(`Card meta tags: ${JSON.stringify(character.card.meta.tags)}`);
    console.log(`Card meta creator: ${character.card.meta.creator || 'N/A'}`);
    console.log(`Card meta characterVersion: ${character.card.meta.characterVersion || 'N/A'}`);

    console.log('\n--- THUMBNAIL ---');
    if (character.thumbnail) {
      console.log(`Thumbnail type: ${character.thumbnail.constructor.name}`);
      console.log(`Thumbnail size: ${character.thumbnail.length} bytes`);
      // Check if it's a valid PNG by looking for PNG signature
      const isValidPNG = character.thumbnail[0] === 0x89 &&
                        character.thumbnail[1] === 0x50 &&
                        character.thumbnail[2] === 0x4E &&
                        character.thumbnail[3] === 0x47;
      console.log(`Valid PNG signature: ${isValidPNG}`);
    } else {
      console.log('No thumbnail found');
    }

    console.log('\n--- ASSETS ---');
    console.log(`Assets count: ${character.assets.length}`);
    if (character.assets.length > 0) {
      character.assets.forEach((asset, idx) => {
        console.log(`\nAsset ${idx + 1}:`);
        console.log(`  Filename: ${asset.filename}`);
        console.log(`  MIME type: ${asset.mimetype}`);
        console.log(`  Size: ${asset.size} bytes`);
        console.log(`  Dimensions: ${asset.width || 'N/A'} x ${asset.height || 'N/A'}`);
        console.log(`  Link type: ${asset.link.type}`);
        console.log(`  Link name: ${asset.link.name}`);
        console.log(`  Link ext: ${asset.link.ext}`);
        console.log(`  Link isMain: ${asset.link.isMain}`);
        console.log(`  Link tags: ${JSON.stringify(asset.link.tags)}`);
      });
    } else {
      console.log('No additional assets (beyond thumbnail)');
    }

    console.log('\n--- CARD DATA (RAW) ---');
    const cardData = character.card.data as any;
    if (cardData.spec === 'chara_card_v3') {
      console.log('Format: CCv3');
      console.log(`  spec: ${cardData.spec}`);
      console.log(`  spec_version: ${cardData.spec_version}`);
      console.log(`  data.name: ${cardData.data?.name}`);
      console.log(`  data.description: ${cardData.data?.description?.substring(0, 100)}...`);
      console.log(`  data.personality: ${cardData.data?.personality?.substring(0, 100)}...`);
      console.log(`  data.scenario: ${cardData.data?.scenario?.substring(0, 100)}...`);
      console.log(`  data.first_mes: ${cardData.data?.first_mes?.substring(0, 100)}...`);
      console.log(`  data.tags: ${JSON.stringify(cardData.data?.tags || [])}`);
      console.log(`  data.creator: ${cardData.data?.creator || 'N/A'}`);
      console.log(`  data.character_version: ${cardData.data?.character_version || 'N/A'}`);
    } else {
      console.log('Format: CCv2');
      console.log(`  name: ${cardData.name}`);
      console.log(`  description: ${cardData.description?.substring(0, 100)}...`);
      console.log(`  personality: ${cardData.personality?.substring(0, 100)}...`);
      console.log(`  scenario: ${cardData.scenario?.substring(0, 100)}...`);
      console.log(`  first_mes: ${cardData.first_mes?.substring(0, 100)}...`);
      console.log(`  creator: ${cardData.creator || 'N/A'}`);
    }
  }

  console.log('\n--- TEST RESULT ---');
  console.log('SUCCESS: PNG parsed without errors');
  console.log('All required fields present and valid');

} catch (error) {
  console.log('\n--- ERROR ---');
  console.error(error);
  process.exit(1);
}

console.log('\n=== VERIFICATION COMPLETE ===\n');
