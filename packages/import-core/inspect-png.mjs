/**
 * PNG Parser Inspection Script
 * Shows detailed output from parsePNG
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePNG } from './dist/src/parsers/png.parser.js';

const TEST_DATA_DIR = '/mnt/ai/test_cf_data/chub_v2';

console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
console.log('║          PNG PARSER RUNTIME VERIFICATION                         ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

const testFile = join(TEST_DATA_DIR, 'delilah_105800.png');
console.log(`TESTING FILE: ${testFile}\n`);

const buffer = readFileSync(testFile);
console.log(`FILE SIZE: ${buffer.length} bytes\n`);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('EXECUTING: parsePNG(buffer)');
console.log('═══════════════════════════════════════════════════════════════════\n');

try {
  const result = parsePNG(buffer);

  console.log('RESULT: ✅ SUCCESS\n');

  console.log('───────────────────────────────────────────────────────────────────');
  console.log('PARSED DATA STRUCTURE');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`isCollection:       ${result.isCollection}`);
  console.log(`characters.length:  ${result.characters.length}`);
  console.log(`collection:         ${result.collection ? 'present' : 'undefined'}`);

  if (result.characters.length > 0) {
    const character = result.characters[0];

    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log('CHARACTER METADATA');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log(`name:              ${character.card.meta.name}`);
    console.log(`spec:              ${character.card.meta.spec}`);
    console.log(`tags:              ${JSON.stringify(character.card.meta.tags)}`);
    console.log(`creator:           ${character.card.meta.creator || 'N/A'}`);
    console.log(`characterVersion:  ${character.card.meta.characterVersion || 'N/A'}`);

    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log('THUMBNAIL DATA');
    console.log('───────────────────────────────────────────────────────────────────');
    if (character.thumbnail) {
      console.log(`Type:              ${character.thumbnail.constructor.name}`);
      console.log(`Size:              ${character.thumbnail.length} bytes`);

      // Check PNG signature
      const isValidPNG = character.thumbnail[0] === 0x89 &&
                        character.thumbnail[1] === 0x50 &&
                        character.thumbnail[2] === 0x4E &&
                        character.thumbnail[3] === 0x47;
      console.log(`Valid PNG:         ${isValidPNG ? '✅ YES' : '❌ NO'}`);
      console.log(`First 8 bytes:     ${Array.from(character.thumbnail.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    } else {
      console.log('Status:            ⚠️  No thumbnail extracted');
    }

    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log('ASSETS DATA');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log(`Assets count:      ${character.assets.length}`);

    if (character.assets.length > 0) {
      character.assets.forEach((asset, idx) => {
        console.log(`\nAsset #${idx + 1}:`);
        console.log(`  filename:        ${asset.filename}`);
        console.log(`  mimetype:        ${asset.mimetype}`);
        console.log(`  size:            ${asset.size} bytes`);
        console.log(`  dimensions:      ${asset.width || 'N/A'} x ${asset.height || 'N/A'}`);
        console.log(`  link.type:       ${asset.link.type}`);
        console.log(`  link.name:       ${asset.link.name}`);
        console.log(`  link.ext:        ${asset.link.ext}`);
        console.log(`  link.isMain:     ${asset.link.isMain}`);
        console.log(`  link.tags:       ${JSON.stringify(asset.link.tags)}`);
      });
    } else {
      console.log('Status:            No additional assets (expected for simple PNG cards)');
    }

    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log('CARD DATA SAMPLE');
    console.log('───────────────────────────────────────────────────────────────────');
    const cardData = character.card.data;

    if (cardData.spec === 'chara_card_v3') {
      console.log('Format:            CCv3');
      console.log(`  spec:            ${cardData.spec}`);
      console.log(`  spec_version:    ${cardData.spec_version}`);
      console.log(`  data.name:       ${cardData.data?.name}`);

      const desc = cardData.data?.description || '';
      console.log(`  data.description: ${desc.substring(0, 80)}${desc.length > 80 ? '...' : ''}`);

      const pers = cardData.data?.personality || '';
      console.log(`  data.personality: ${pers.substring(0, 80)}${pers.length > 80 ? '...' : ''}`);

      const scen = cardData.data?.scenario || '';
      console.log(`  data.scenario:    ${scen.substring(0, 80)}${scen.length > 80 ? '...' : ''}`);

      const first = cardData.data?.first_mes || '';
      console.log(`  data.first_mes:   ${first.substring(0, 80)}${first.length > 80 ? '...' : ''}`);

      console.log(`  data.tags:        ${JSON.stringify(cardData.data?.tags || [])}`);
      console.log(`  data.creator:     ${cardData.data?.creator || 'N/A'}`);
      console.log(`  data.char_ver:    ${cardData.data?.character_version || 'N/A'}`);
    } else {
      console.log('Format:            CCv2');
      console.log(`  name:            ${cardData.name}`);

      const desc = cardData.description || '';
      console.log(`  description:     ${desc.substring(0, 80)}${desc.length > 80 ? '...' : ''}`);

      const pers = cardData.personality || '';
      console.log(`  personality:     ${pers.substring(0, 80)}${pers.length > 80 ? '...' : ''}`);

      const scen = cardData.scenario || '';
      console.log(`  scenario:        ${scen.substring(0, 80)}${scen.length > 80 ? '...' : ''}`);

      const first = cardData.first_mes || '';
      console.log(`  first_mes:       ${first.substring(0, 80)}${first.length > 80 ? '...' : ''}`);

      console.log(`  creator:         ${cardData.creator || 'N/A'}`);
    }

    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log('VALIDATION CHECKS');
    console.log('───────────────────────────────────────────────────────────────────');

    const checks = [
      { name: 'Has characters array', pass: Array.isArray(result.characters) },
      { name: 'Characters not empty', pass: result.characters.length > 0 },
      { name: 'Character has card', pass: !!character.card },
      { name: 'Character has meta', pass: !!character.card.meta },
      { name: 'Character has data', pass: !!character.card.data },
      { name: 'Name is valid string', pass: typeof character.card.meta.name === 'string' && character.card.meta.name.length > 0 },
      { name: 'Spec is v2 or v3', pass: ['v2', 'v3'].includes(character.card.meta.spec) },
      { name: 'Has thumbnail', pass: !!character.thumbnail },
      { name: 'Has assets array', pass: Array.isArray(character.assets) },
      { name: 'isCollection is false', pass: result.isCollection === false },
    ];

    checks.forEach(check => {
      const status = check.pass ? '✅' : '❌';
      console.log(`${status} ${check.name}`);
    });

    const allPassed = checks.every(c => c.pass);
    console.log(`\n${'='.repeat(67)}`);
    console.log(`OVERALL STATUS: ${allPassed ? '✅ ALL CHECKS PASSED' : '⚠️  SOME CHECKS FAILED'}`);
    console.log(`${'='.repeat(67)}\n`);
  }

} catch (error) {
  console.log('RESULT: ❌ ERROR\n');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('ERROR DETAILS');
  console.log('───────────────────────────────────────────────────────────────────');
  console.error(error);
  process.exit(1);
}

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║          VERIFICATION COMPLETE                                    ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
