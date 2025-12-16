/**
 * Test PNG Parser with Multiple Files
 * Shows comprehensive coverage across different PNG character cards
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parsePNG } from './dist/src/parsers/png.parser.js';

const TEST_DATA_DIR = '/mnt/ai/test_cf_data/chub_v2';

console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
console.log('║     PNG PARSER - MULTIPLE FILE VERIFICATION                       ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

const pngFiles = readdirSync(TEST_DATA_DIR).filter(f => f.endsWith('.png')).slice(0, 5);

console.log(`Testing ${pngFiles.length} PNG files from ${TEST_DATA_DIR}\n`);

const results = [];
let testNumber = 1;

for (const filename of pngFiles) {
  console.log(`${'═'.repeat(67)}`);
  console.log(`TEST ${testNumber}/${pngFiles.length}: ${filename}`);
  console.log(`${'═'.repeat(67)}`);

  const pngPath = join(TEST_DATA_DIR, filename);

  try {
    const buffer = readFileSync(pngPath);
    console.log(`FILE SIZE: ${buffer.length} bytes`);

    const result = parsePNG(buffer);
    const character = result.characters[0];

    console.log('\nRESULT: ✅ PARSED SUCCESSFULLY\n');

    console.log('CHARACTER INFO:');
    console.log(`  Name:              ${character.card.meta.name}`);
    console.log(`  Spec:              ${character.card.meta.spec}`);
    console.log(`  Creator:           ${character.card.meta.creator || 'N/A'}`);
    console.log(`  Character Version: ${character.card.meta.characterVersion || 'N/A'}`);
    console.log(`  Tags:              ${JSON.stringify(character.card.meta.tags)}`);

    console.log('\nDATA:');
    console.log(`  Has thumbnail:     ${character.thumbnail ? '✅ YES (' + character.thumbnail.length + ' bytes)' : '❌ NO'}`);
    console.log(`  Assets count:      ${character.assets.length}`);
    console.log(`  Is collection:     ${result.isCollection}`);

    const cardData = character.card.data;
    const format = cardData.spec === 'chara_card_v3' ? 'CCv3' : 'CCv2';
    console.log(`  Card format:       ${format}`);

    if (format === 'CCv3') {
      const desc = cardData.data?.description || '';
      console.log(`  Description:       ${desc.substring(0, 60)}${desc.length > 60 ? '...' : ''}`);
    } else {
      const desc = cardData.description || '';
      console.log(`  Description:       ${desc.substring(0, 60)}${desc.length > 60 ? '...' : ''}`);
    }

    // Validation
    const checks = {
      hasCharacters: result.characters.length > 0,
      hasName: !!character.card.meta.name && character.card.meta.name !== 'Unknown Character',
      validSpec: ['v2', 'v3'].includes(character.card.meta.spec),
      hasThumbnail: !!character.thumbnail,
      hasAssets: Array.isArray(character.assets),
      notCollection: result.isCollection === false,
    };

    const allPassed = Object.values(checks).every(v => v);

    console.log('\nVALIDATION:');
    console.log(`  Has characters:    ${checks.hasCharacters ? '✅' : '❌'}`);
    console.log(`  Valid name:        ${checks.hasName ? '✅' : '❌'}`);
    console.log(`  Valid spec:        ${checks.validSpec ? '✅' : '❌'}`);
    console.log(`  Has thumbnail:     ${checks.hasThumbnail ? '✅' : '❌'}`);
    console.log(`  Has assets array:  ${checks.hasAssets ? '✅' : '❌'}`);
    console.log(`  Not collection:    ${checks.notCollection ? '✅' : '❌'}`);

    console.log(`\nOVERALL: ${allPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    results.push({
      filename,
      status: 'success',
      name: character.card.meta.name,
      spec: character.card.meta.spec,
      assetCount: character.assets.length,
      thumbnailSize: character.thumbnail?.length || 0,
      allChecks: allPassed,
    });

  } catch (error) {
    console.log(`\nRESULT: ❌ ERROR\n`);
    console.error(error.message);
    console.log('');

    results.push({
      filename,
      status: 'error',
      error: error.message,
    });
  }

  testNumber++;
}

console.log(`${'═'.repeat(67)}`);
console.log('SUMMARY');
console.log(`${'═'.repeat(67)}`);

const successful = results.filter(r => r.status === 'success').length;
const failed = results.filter(r => r.status === 'error').length;

console.log(`\nTotal files tested: ${results.length}`);
console.log(`Successful:         ${successful} ✅`);
console.log(`Failed:             ${failed} ${failed > 0 ? '❌' : ''}`);

if (successful > 0) {
  console.log('\nSuccessful parses:');
  results
    .filter(r => r.status === 'success')
    .forEach(r => {
      console.log(`  • ${r.name.padEnd(25)} (${r.spec}) - ${r.thumbnailSize} bytes thumbnail, ${r.assetCount} assets`);
    });
}

if (failed > 0) {
  console.log('\nFailed parses:');
  results
    .filter(r => r.status === 'error')
    .forEach(r => {
      console.log(`  • ${r.filename}: ${r.error}`);
    });
}

console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
console.log(`║  ${successful === results.length ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}                                         ║`);
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

process.exit(failed > 0 ? 1 : 0);
