import { readFileSync } from 'fs';
import { readVoxta } from '@character-foundry/character-foundry/voxta';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/dev/check-voxta-package.mjs <path/to/file.voxpkg>');
  process.exit(1);
}

const buffer = readFileSync(file);
const data = readVoxta(new Uint8Array(buffer));

console.log('characters.length:', data.characters.length);
console.log('has package:', !!data.package);
console.log('package.Name:', data.package?.Name);
console.log('scenarios.length:', data.scenarios.length);

// Server logic
const isCollectionServer = data.characters.length > 1 || data.package !== undefined || data.scenarios.length > 0;
console.log('\nServer isCollection:', isCollectionServer);

// Client logic
const isCollectionClient = data.characters.length > 1 || data.package !== undefined;
console.log('Client isCollection:', isCollectionClient);
