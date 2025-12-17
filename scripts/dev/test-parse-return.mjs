import { readFileSync } from 'fs';
import { parseCard } from '@character-foundry/character-foundry/loader';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/dev/test-parse-return.mjs <path/to/card.(png|json|charx|voxpkg)>');
  process.exit(1);
}

const buffer = readFileSync(file);
const result = parseCard(new Uint8Array(buffer));

console.log('result.spec:', result.spec);
console.log('result.card keys:', Object.keys(result.card));
console.log('result.card.spec:', result.card.spec);
console.log('result.card.data exists:', !!result.card.data);
if (result.card.data) {
  console.log('result.card.data.name:', result.card.data.name);
}
console.log('result.card.name:', result.card.name);
