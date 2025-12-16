/**
 * PNG Parser Error Handling Test
 * Verifies proper error handling with invalid inputs
 */

import { parsePNG } from './dist/src/parsers/png.parser.js';

console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
console.log('║     PNG PARSER - ERROR HANDLING VERIFICATION                      ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

const tests = [
  {
    name: 'Empty Buffer',
    data: Buffer.alloc(0),
    expectError: true,
  },
  {
    name: 'Invalid PNG (plain text)',
    data: Buffer.from('This is not a PNG file'),
    expectError: true,
  },
  {
    name: 'Invalid PNG (wrong header)',
    data: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
    expectError: true,
  },
  {
    name: 'PNG signature only (incomplete)',
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    expectError: true,
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(`${'─'.repeat(67)}`);
  console.log(`TEST: ${test.name}`);
  console.log(`${'─'.repeat(67)}`);
  console.log(`Input size: ${test.data.length} bytes`);
  console.log(`First 16 bytes: ${Array.from(test.data.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  console.log(`Expected result: ${test.expectError ? 'ERROR (should throw)' : 'SUCCESS'}`);

  try {
    const result = parsePNG(test.data);

    if (test.expectError) {
      console.log('\nACTUAL RESULT: ❌ DID NOT THROW ERROR (unexpected)');
      console.log('Parser returned:', result);
      failed++;
    } else {
      console.log('\nACTUAL RESULT: ✅ SUCCESS (as expected)');
      console.log(`  Characters: ${result.characters.length}`);
      console.log(`  Name: ${result.characters[0]?.card.meta.name}`);
      passed++;
    }
  } catch (error) {
    if (test.expectError) {
      console.log('\nACTUAL RESULT: ✅ THREW ERROR (as expected)');
      console.log(`  Error type: ${error.constructor.name}`);
      console.log(`  Error message: ${error.message}`);
      passed++;
    } else {
      console.log('\nACTUAL RESULT: ❌ UNEXPECTED ERROR');
      console.log(`  Error type: ${error.constructor.name}`);
      console.log(`  Error message: ${error.message}`);
      console.error(error);
      failed++;
    }
  }

  console.log(`\nTEST RESULT: ${test.expectError ? (failed === 0 ? '✅ PASS' : '❌ FAIL') : (failed === 0 ? '✅ PASS' : '❌ FAIL')}\n`);
}

console.log(`${'═'.repeat(67)}`);
console.log('SUMMARY');
console.log(`${'═'.repeat(67)}`);
console.log(`Total tests:   ${tests.length}`);
console.log(`Passed:        ${passed} ✅`);
console.log(`Failed:        ${failed} ${failed > 0 ? '❌' : ''}`);

console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
console.log(`║  ${failed === 0 ? 'ALL ERROR HANDLING TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}                        ║`);
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

process.exit(failed > 0 ? 1 : 0);
