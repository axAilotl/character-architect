import { readFileSync } from 'fs';
import { readVoxta, voxtaToCCv3 } from '@character-foundry/character-foundry/voxta';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/dev/test-voxta-server.mjs <path/to/file.voxpkg>');
  process.exit(1);
}

const buffer = readFileSync(file);
const voxtaData = readVoxta(new Uint8Array(buffer));

console.log('Voxta extraction result:');
console.log('  characters.length:', voxtaData.characters.length);
console.log('  characters[0].id:', voxtaData.characters[0].id);
console.log('  characters[0].data.Name:', voxtaData.characters[0].data.Name);
console.log('  characters[0].data keys:', Object.keys(voxtaData.characters[0].data).slice(0, 10));

const books = voxtaData.books.map(b => b.data);
const ccv3Data = voxtaToCCv3(voxtaData.characters[0].data, books);

console.log('\nvoxtaToCCv3 result:');
console.log('  spec:', ccv3Data.spec);
console.log('  spec_version:', ccv3Data.spec_version);
console.log('  data exists:', !!ccv3Data.data);
console.log('  data.name:', ccv3Data.data?.name);
console.log('  data.description:', ccv3Data.data?.description?.substring(0, 100));
console.log('  data.personality:', ccv3Data.data?.personality?.substring(0, 100));
