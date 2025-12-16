import { readFileSync } from 'fs';
import { readVoxta, voxtaToCCv3 } from '@character-foundry/character-foundry/voxta';

const file = '/home/vega/ai/character-foundry/fixtures/extended/voxta/minimal_character.voxpkg';
const buffer = readFileSync(file);
const data = readVoxta(new Uint8Array(buffer));

const char = data.characters[0];
const books = data.books.map(b => b.data);
const ccv3 = voxtaToCCv3(char.data, books);

console.log('Input char.data.Name:', char.data.Name);
console.log('\nOutput ccv3:');
console.log('  spec:', ccv3.spec);
console.log('  spec_version:', ccv3.spec_version);
console.log('  data.name:', ccv3.data.name);
console.log('  data.description:', ccv3.data.description?.substring(0, 100));
console.log('  data.personality:', ccv3.data.personality?.substring(0, 100));
