/**
 * Test Fixtures
 *
 * Helper functions to create test data for different formats
 */

import { embedIntoPNG } from '@character-foundry/character-foundry/png';

/**
 * Wrapped V2 card format (spec at top level)
 */
export interface WrappedV2Card {
  spec: 'chara_card_v2';
  spec_version: string;
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator: string;
    character_version: string;
    tags: string[];
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    group_only_greetings: string[];
    extensions: Record<string, unknown>;
  };
}

/**
 * Wrapped V3 card format
 */
export interface WrappedV3Card {
  spec: 'chara_card_v3';
  spec_version: string;
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator: string;
    character_version: string;
    tags: string[];
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    group_only_greetings: string[];
    extensions: Record<string, unknown>;
  };
}

/**
 * Create a minimal V2 card (wrapped format)
 */
export function createV2Card(name: string = 'Test Character'): WrappedV2Card {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name,
      description: 'A test character',
      personality: 'Friendly and helpful',
      scenario: 'Testing scenario',
      first_mes: 'Hello! I am a test character.',
      mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
      creator: '',
      character_version: '1.0',
      tags: [],
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      group_only_greetings: [],
      extensions: {},
    },
  };
}

/**
 * Create a minimal V3 card
 */
export function createV3Card(name: string = 'Test Character V3'): WrappedV3Card {
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
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      group_only_greetings: [],
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
export async function createPNGWithCard(card: WrappedV2Card | WrappedV3Card): Promise<Uint8Array> {
  // Create a minimal 1x1 PNG
  const minimalPNG = new Uint8Array([
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
  // Cast to any since embedIntoPNG expects the schema types
  return embedIntoPNG(minimalPNG, card as any);
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
