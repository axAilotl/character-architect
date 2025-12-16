/**
 * Test Fixtures
 *
 * Helper functions to create test data for different formats
 */

import type { CCv2Data, CCv3Data } from '@character-foundry/character-foundry/schemas';
import { embedIntoPNG } from '@character-foundry/character-foundry/png';

/**
 * Create a minimal V2 card
 */
export function createV2Card(name: string = 'Test Character'): CCv2Data {
  return {
    spec: 'chara_card_v2',
    name,
    description: 'A test character',
    personality: 'Friendly and helpful',
    scenario: 'Testing scenario',
    first_mes: 'Hello! I am a test character.',
    mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
  };
}

/**
 * Create a minimal V3 card
 */
export function createV3Card(name: string = 'Test Character V3'): CCv3Data {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name,
      description: 'A test character for v3',
      personality: 'Friendly and helpful',
      scenario: 'Testing scenario',
      first_mes: 'Hello from v3!',
      mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
      creator: 'Test Creator',
      character_version: '1.0.0',
      tags: ['test'],
      extensions: {},
    },
  };
}

/**
 * Create a minimal standalone lorebook
 */
export function createLorebook(name: string = 'Test Lorebook'): any {
  return {
    name,
    description: 'A test lorebook',
    entries: [
      {
        keys: ['magic', 'spell'],
        content: 'Magic is powerful in this world.',
        enabled: true,
        insertion_order: 0,
        case_sensitive: false,
      },
    ],
  };
}

/**
 * Create a minimal PNG file with embedded card data
 */
export async function createPNGWithCard(card: CCv2Data | CCv3Data): Promise<Buffer> {
  // Create a minimal 1x1 PNG
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
    0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  // Add character card data using embedIntoPNG
  return embedIntoPNG(minimalPNG, card);
}

/**
 * Create a JSON buffer for a card
 */
export function createJSONBuffer(data: any): Buffer {
  return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Create a minimal ZIP file structure (for CHARX/Voxta testing)
 */
export function createMinimalZIP(): Buffer {
  // ZIP local file header signature: 50 4B 03 04
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
}

/**
 * Invalid file format (not a valid card)
 */
export function createInvalidFile(): Buffer {
  return Buffer.from('This is not a valid card file', 'utf-8');
}
