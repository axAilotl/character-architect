/**
 * Synthetic Test Fixture Generator
 *
 * Generates minimal, synthetic character card fixtures for CI/CD testing.
 * These fixtures are:
 * - Small (< 50KB each)
 * - Synthetic (no real character content)
 * - Safe for public repos (no NSFW)
 * - Cover all required formats: PNG, JSON, CharX, Voxta
 */

import fs from 'node:fs';
import path from 'node:path';

// CRC32 implementation (PNG uses IEEE polynomial)
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const OUTPUT_DIR = path.dirname(new URL(import.meta.url).pathname);

// Minimal 8x8 gray PNG (89 bytes)
function createMinimalPng(): Uint8Array {
  // PNG signature
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk (8x8, 8-bit grayscale)
  const ihdr = createChunk(
    'IHDR',
    new Uint8Array([
      0,
      0,
      0,
      8, // width: 8
      0,
      0,
      0,
      8, // height: 8
      8, // bit depth
      0, // color type: grayscale
      0, // compression
      0, // filter
      0, // interlace
    ])
  );

  // IDAT chunk (compressed image data - all gray pixels)
  const rawData = new Uint8Array(8 * 9); // 8 rows, each with filter byte + 8 pixels
  for (let row = 0; row < 8; row++) {
    rawData[row * 9] = 0; // filter: none
    for (let col = 0; col < 8; col++) {
      rawData[row * 9 + 1 + col] = 128; // gray pixel
    }
  }

  // We'll create IDAT after compression
  const idatData = deflateSync(rawData);
  const idat = createChunk('IDAT', idatData);

  // IEND chunk
  const iend = createChunk('IEND', new Uint8Array(0));

  return concatUint8Arrays([signature, ihdr, idat, iend]);
}

// Simple sync deflate for small data
function deflateSync(data: Uint8Array): Uint8Array {
  // Use zlib header (78 9c) + raw deflate
  // For tiny images, just use stored blocks
  const stored: number[] = [];

  // Zlib header
  stored.push(0x78, 0x9c);

  // Deflate stored block (final block, stored)
  const len = data.length;
  stored.push(0x01); // final block, stored
  stored.push(len & 0xff, (len >> 8) & 0xff);
  stored.push(~len & 0xff, (~len >> 8) & 0xff);

  for (let i = 0; i < data.length; i++) {
    stored.push(data[i]);
  }

  // Adler-32 checksum
  let s1 = 1,
    s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = (s2 << 16) | s1;
  stored.push((adler >> 24) & 0xff, (adler >> 16) & 0xff, (adler >> 8) & 0xff, adler & 0xff);

  return new Uint8Array(stored);
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const chunk = new Uint8Array(12 + length);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, length, false);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);

  // CRC32 over type + data
  const crcData = new Uint8Array(4 + length);
  crcData.set(chunk.subarray(4, 8), 0);
  crcData.set(data, 4);
  const crc = crc32(crcData);
  view.setUint32(8 + length, crc >>> 0, false);

  return chunk;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Create PNG with embedded tEXt chunk containing character card JSON
function createPngWithCard(cardData: object, iconBytes?: Uint8Array): Uint8Array {
  const basePng = iconBytes || createMinimalPng();

  // Parse existing chunks
  const chunks: { type: string; data: Uint8Array }[] = [];
  let pos = 8; // Skip signature

  while (pos < basePng.length) {
    const view = new DataView(basePng.buffer, basePng.byteOffset + pos);
    const length = view.getUint32(0, false);
    const type = String.fromCharCode(
      basePng[pos + 4],
      basePng[pos + 5],
      basePng[pos + 6],
      basePng[pos + 7]
    );
    const data = basePng.subarray(pos + 8, pos + 8 + length);
    chunks.push({ type, data: new Uint8Array(data) });
    pos += 12 + length;
  }

  // Create tEXt chunk with "chara" keyword and base64 JSON
  const charaJson = JSON.stringify(cardData);
  const charaBase64 = Buffer.from(charaJson).toString('base64');
  const keyword = 'chara';
  const textData = new Uint8Array(keyword.length + 1 + charaBase64.length);
  for (let i = 0; i < keyword.length; i++) {
    textData[i] = keyword.charCodeAt(i);
  }
  textData[keyword.length] = 0; // null separator
  for (let i = 0; i < charaBase64.length; i++) {
    textData[keyword.length + 1 + i] = charaBase64.charCodeAt(i);
  }

  // Reconstruct PNG with tEXt chunk before IEND
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const output: Uint8Array[] = [signature];

  for (const chunk of chunks) {
    if (chunk.type === 'IEND') {
      // Insert tEXt before IEND
      output.push(createChunk('tEXt', textData));
    }
    output.push(createChunk(chunk.type, chunk.data));
  }

  return concatUint8Arrays(output);
}

// Create minimal ZIP file
function createZip(files: { name: string; data: Uint8Array | string }[]): Uint8Array {
  const fileEntries: Uint8Array[] = [];
  const centralEntries: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const dataBytes =
      typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data;

    const fileCrc = crc32(dataBytes);

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true); // signature
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(6, 0, true); // flags
    localView.setUint16(8, 0, true); // compression: store
    localView.setUint16(10, 0, true); // mod time
    localView.setUint16(12, 0, true); // mod date
    localView.setUint32(14, fileCrc, true); // crc
    localView.setUint32(18, dataBytes.length, true); // compressed size
    localView.setUint32(22, dataBytes.length, true); // uncompressed size
    localView.setUint16(26, nameBytes.length, true); // name length
    localView.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    fileEntries.push(localHeader, dataBytes);

    // Central directory entry
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); // signature
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(8, 0, true); // flags
    centralView.setUint16(10, 0, true); // compression
    centralView.setUint16(12, 0, true); // mod time
    centralView.setUint16(14, 0, true); // mod date
    centralView.setUint32(16, fileCrc, true); // crc
    centralView.setUint32(20, dataBytes.length, true); // compressed size
    centralView.setUint32(24, dataBytes.length, true); // uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // name length
    centralView.setUint16(30, 0, true); // extra length
    centralView.setUint16(32, 0, true); // comment length
    centralView.setUint16(34, 0, true); // disk start
    centralView.setUint16(36, 0, true); // internal attr
    centralView.setUint32(38, 0, true); // external attr
    centralView.setUint32(42, localOffset, true); // local header offset
    centralHeader.set(nameBytes, 46);

    centralEntries.push(centralHeader);
    localOffset += localHeader.length + dataBytes.length;
  }

  // End of central directory
  const centralDirStart = localOffset;
  const centralDirSize = centralEntries.reduce((sum, e) => sum + e.length, 0);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // signature
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // disk with cd
  eocdView.setUint16(8, files.length, true); // entries on disk
  eocdView.setUint16(10, files.length, true); // total entries
  eocdView.setUint32(12, centralDirSize, true); // cd size
  eocdView.setUint32(16, centralDirStart, true); // cd offset
  eocdView.setUint16(20, 0, true); // comment length

  return concatUint8Arrays([...fileEntries, ...centralEntries, eocd]);
}

// V3 Card Template
function createV3Card(options: {
  name: string;
  description?: string;
  personality?: string;
  firstMes?: string;
  creator?: string;
  tags?: string[];
  hasLorebook?: boolean;
  lorebookEntries?: number;
  hasAlternateGreetings?: boolean;
  alternateGreetingsCount?: number;
  hasAssets?: boolean;
  assets?: Array<{ type: string; uri: string; name: string; ext: string }>;
}): object {
  const card: Record<string, unknown> = {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: options.name,
      description: options.description || 'A synthetic test character.',
      personality: options.personality || 'Friendly and helpful.',
      scenario: 'A test scenario.',
      first_mes: options.firstMes || 'Hello! I am a synthetic test character.',
      mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
      creator: options.creator || 'Synthetic Generator',
      creator_notes: 'This is a synthetic fixture for testing purposes.',
      tags: options.tags || ['synthetic', 'test'],
      character_version: '1.0.0',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: options.hasAlternateGreetings
        ? Array.from(
            { length: options.alternateGreetingsCount || 2 },
            (_, i) => `Alternate greeting ${i + 1}`
          )
        : [],
      character_book: options.hasLorebook
        ? {
            name: 'Test Lorebook',
            entries: Array.from({ length: options.lorebookEntries || 3 }, (_, i) => ({
              keys: [`key${i + 1}`],
              content: `Lorebook entry ${i + 1} content.`,
              enabled: true,
              insertion_order: i,
              case_sensitive: false,
              priority: 10,
              id: i,
              comment: `Entry ${i + 1}`,
              selective: false,
              secondary_keys: [],
              constant: false,
              position: 'before_char',
            })),
          }
        : undefined,
      extensions: {},
      assets: options.assets || [],
    },
  };

  return card;
}

// V2 Card Template
function createV2Card(options: {
  name: string;
  description?: string;
  personality?: string;
  firstMes?: string;
  creator?: string;
  tags?: string[];
  hasLorebook?: boolean;
  lorebookEntries?: number;
  hasAlternateGreetings?: boolean;
  alternateGreetingsCount?: number;
}): object {
  const card: Record<string, unknown> = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: options.name,
      description: options.description || 'A synthetic test character.',
      personality: options.personality || 'Friendly and helpful.',
      scenario: 'A test scenario.',
      first_mes: options.firstMes || 'Hello! I am a synthetic test character.',
      mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
      creator: options.creator || 'Synthetic Generator',
      creator_notes: 'This is a synthetic fixture for testing purposes.',
      tags: options.tags || ['synthetic', 'test'],
      character_version: '1.0.0',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: options.hasAlternateGreetings
        ? Array.from(
            { length: options.alternateGreetingsCount || 2 },
            (_, i) => `Alternate greeting ${i + 1}`
          )
        : [],
      character_book: options.hasLorebook
        ? {
            name: 'Test Lorebook',
            entries: Array.from({ length: options.lorebookEntries || 3 }, (_, i) => ({
              keys: [`key${i + 1}`],
              content: `Lorebook entry ${i + 1} content.`,
              enabled: true,
              insertion_order: i,
              case_sensitive: false,
              priority: 10,
              id: i,
              comment: `Entry ${i + 1}`,
              selective: false,
              secondary_keys: [],
              constant: false,
              position: 'before_char',
            })),
          }
        : undefined,
      extensions: {},
    },
  };

  return card;
}

// Main fixture generation
async function generateFixtures() {
  console.log('Generating synthetic test fixtures...\n');

  // Ensure directories exist
  const dirs = ['basic/png', 'basic/json', 'basic/charx', 'basic/voxta', 'extended/charx'];
  for (const dir of dirs) {
    const fullPath = path.join(OUTPUT_DIR, dir);
    fs.mkdirSync(fullPath, { recursive: true });
  }

  const minimalIcon = createMinimalPng();

  // 1. Basic PNG (v3 with icon)
  console.log('Creating basic/png/baseline_v3_small.png...');
  const v3CardForPng = createV3Card({
    name: 'Synthetic V3 Character',
    tags: ['synthetic', 'test', 'v3'],
    hasLorebook: true,
    lorebookEntries: 2,
    hasAlternateGreetings: true,
    alternateGreetingsCount: 1,
  });
  const pngBytes = createPngWithCard(v3CardForPng);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'basic/png/baseline_v3_small.png'), pngBytes);
  console.log(`  Size: ${pngBytes.length} bytes`);

  // 2. Basic JSON (v2 hybrid format)
  console.log('Creating basic/json/hybrid_format_v2.json...');
  const v2Card = createV2Card({
    name: 'Synthetic V2 Character',
    tags: ['synthetic', 'test', 'v2'],
    hasLorebook: true,
    lorebookEntries: 3,
    hasAlternateGreetings: true,
    alternateGreetingsCount: 2,
  });
  const jsonContent = JSON.stringify(v2Card, null, 2);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'basic/json/hybrid_format_v2.json'), jsonContent);
  console.log(`  Size: ${jsonContent.length} bytes`);

  // 3. Basic CharX (v3 ZIP with correct asset structure)
  console.log('Creating basic/charx/baseline_v3_small.charx...');
  const v3CardForCharx = createV3Card({
    name: 'Synthetic CharX Character',
    tags: ['synthetic', 'test', 'charx'],
    hasLorebook: true,
    lorebookEntries: 2,
    assets: [
      {
        type: 'icon',
        uri: 'embeded://assets/icon/image/1.png',
        name: 'main',
        ext: 'png',
      },
    ],
  });
  const charxZip = createZip([
    { name: 'card.json', data: JSON.stringify(v3CardForCharx, null, 2) },
    { name: 'assets/icon/image/1.png', data: minimalIcon },
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'basic/charx/baseline_v3_small.charx'), charxZip);
  console.log(`  Size: ${charxZip.length} bytes`);

  // 4. Basic Voxta (minimal voxpkg with correct structure)
  console.log('Creating basic/voxta/character_only_small.voxpkg...');
  const charId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const packageId = '11111111-2222-3333-4444-555555555555';

  const voxtaPackage = {
    $type: 'package',
    Description: 'Synthetic Voxta Test Character',
    Creator: 'Synthetic Generator',
    ExplicitContent: false,
    EntryResource: { Kind: 1, Id: charId },
    ThumbnailResource: { Kind: 1, Id: charId },
    Name: 'Synthetic Voxta Character',
    Version: '1.0.0',
    DateCreated: '2024-01-01T00:00:00.000+00:00',
    DateModified: '2024-01-01T00:00:00.000+00:00',
    Id: packageId,
  };

  const voxtaCharacter = {
    $type: 'character',
    Label: 'Synthetic Voxta Character',
    PackageId: packageId,
    MemoryBooks: [],
    DefaultScenarios: [],
    Culture: 'en-US',
    TextToSpeech: [],
    Profile: 'A synthetic test character for Voxta.',
    Scripts: [],
    ChatStyle: 0,
    ExplicitContent: false,
    EnableThinkingSpeech: false,
    NotifyUserAwayReturn: false,
    TimeAware: false,
    UseMemory: false,
    MaxTokens: 0,
    MaxSentences: 0,
    Augmentations: [],
    SystemPromptOverrideType: 0,
    Description: 'A synthetic test character for Voxta format testing.',
    Personality: 'Friendly and helpful.',
    Scenario: 'A test scenario.',
    FirstMessage: 'Hello! I am a synthetic Voxta character.',
    MessageExamples: '',
    Creator: 'Synthetic Generator',
    CreatorNotes: 'Synthetic fixture for testing.',
    Tags: ['synthetic', 'test'],
    Name: 'Synthetic Voxta Character',
    Version: '1.0.0',
    Thumbnail: { ETag: 1, RandomizedETag: 'test', ContentType: 'image/png' },
    DateCreated: '2024-01-01T00:00:00.000+00:00',
    DateModified: '2024-01-01T00:00:00.000+00:00',
    Id: charId,
  };

  const voxpkg = createZip([
    { name: 'package.json', data: JSON.stringify(voxtaPackage, null, 2) },
    { name: `Characters/${charId}/character.json`, data: JSON.stringify(voxtaCharacter, null, 2) },
    { name: `Characters/${charId}/thumbnail.png`, data: minimalIcon },
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'basic/voxta/character_only_small.voxpkg'), voxpkg);
  console.log(`  Size: ${voxpkg.length} bytes`);

  // 5. Extended CharX with multiple assets (for asset extraction tests)
  // Uses 'other' type for non-main assets to trigger asset extraction
  console.log('Creating extended/charx/v3_many_assets_01.charx...');
  const v3CardWithAssets = createV3Card({
    name: 'Synthetic Multi-Asset Character',
    tags: ['synthetic', 'test', 'assets'],
    hasLorebook: true,
    lorebookEntries: 3,
    hasAlternateGreetings: true,
    alternateGreetingsCount: 2,
    assets: [
      { type: 'icon', uri: 'embeded://assets/icon/image/1.png', name: 'main', ext: 'png' },
      { type: 'other', uri: 'embeded://assets/other/image/1.png', name: 'expression_happy', ext: 'png' },
      { type: 'other', uri: 'embeded://assets/other/image/2.png', name: 'expression_sad', ext: 'png' },
      { type: 'other', uri: 'embeded://assets/other/image/3.png', name: 'background', ext: 'png' },
      { type: 'other', uri: 'embeded://assets/other/image/4.png', name: 'item', ext: 'png' },
    ],
  });

  const charxWithAssets = createZip([
    { name: 'card.json', data: JSON.stringify(v3CardWithAssets, null, 2) },
    { name: 'assets/icon/image/1.png', data: minimalIcon },
    { name: 'assets/other/image/1.png', data: minimalIcon },
    { name: 'assets/other/image/2.png', data: minimalIcon },
    { name: 'assets/other/image/3.png', data: minimalIcon },
    { name: 'assets/other/image/4.png', data: minimalIcon },
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'extended/charx/v3_many_assets_01.charx'), charxWithAssets);
  console.log(`  Size: ${charxWithAssets.length} bytes`);

  // Generate MANIFEST.md
  console.log('\nCreating MANIFEST.md...');
  const manifest = `# Synthetic Test Fixtures

This directory contains synthetic (generated) test fixtures for CI/CD testing.
These fixtures are intentionally minimal to keep the repository small.

## Purpose

- Provide lightweight test data for e2e pipeline testing
- Avoid including real character cards (which may be NSFW or large)
- Enable hermetic, reproducible tests in CI environments

### Tier 1: Basic Fixtures (CI-Safe)

| Path | Format | Spec | Description |
|------|--------|------|-------------|
| \`basic/png/baseline_v3_small.png\` | png | v3 | V3 card with embedded icon |
| \`basic/json/hybrid_format_v2.json\` | json | v2 | V2 JSON with lorebook |
| \`basic/charx/baseline_v3_small.charx\` | charx | v3 | V3 CharX ZIP package |
| \`basic/voxta/character_only_small.voxpkg\` | voxta | v3 | Minimal Voxta package |

### Tier 2: Extended Fixtures (Asset Tests)

| Path | Format | Spec | Description |
|------|--------|------|-------------|
| \`extended/charx/v3_many_assets_01.charx\` | charx | v3 | V3 CharX with 5 assets |

## Generation

These fixtures are generated by \`generate.ts\`. To regenerate:

\`\`\`bash
npx tsx test-fixtures/generate.ts
\`\`\`

## Usage in Tests

Set \`CF_FIXTURES_DIR\` to point to this directory:

\`\`\`bash
export CF_FIXTURES_DIR=./test-fixtures
npm run test
\`\`\`

Or skip fixture tests if unavailable:

\`\`\`bash
export CF_ALLOW_MISSING_FIXTURES=1
npm run test
\`\`\`

## File Sizes

All fixtures are designed to be < 5KB each to minimize repository size.
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'MANIFEST.md'), manifest);
  console.log('  MANIFEST.md created');

  console.log('\nDone! All synthetic fixtures generated.');
}

generateFixtures().catch(console.error);
