/**
 * Voxta Parser Tests
 *
 * Tests the Voxta parser with real .voxpkg fixtures to verify:
 * - Single character packages parse correctly
 * - Multi-character packages are detected as collections
 * - Character-scenario mapping works
 * - Thumbnail extraction works
 * - voxtaToCCv3 conversion produces valid CCv3
 * - Assets are properly extracted and tagged
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parseVoxta } from '../parsers/voxta.parser.js';

// Fixture paths - use env var or skip tests
const FIXTURES_DIR = process.env.CF_FIXTURES_DIR
  ? `${process.env.CF_FIXTURES_DIR}/extended/voxta`
  : null;

// Skip all tests if fixtures not available
const describeWithFixtures = FIXTURES_DIR && existsSync(FIXTURES_DIR) ? describe : describe.skip;
const MINIMAL_CHAR = `${FIXTURES_DIR}/minimal_character.voxpkg`;
const CHAR_WITH_AVATARS = `${FIXTURES_DIR}/character_with_avatars.voxpkg`;
const MULTI_CHAR_PACKAGE = `${FIXTURES_DIR}/multi_char_package.voxpkg`;
const MULTI_CHAR_SCENARIO = `${FIXTURES_DIR}/multi_char_scenario.voxpkg`;
const SCENARIO_WITH_CHAR = `${FIXTURES_DIR}/scenario_with_char.voxpkg`;

describeWithFixtures('Voxta Parser - Single Character', () => {
  it('parses minimal single character package', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    // Note: minimal_character.voxpkg has package metadata, so it's detected as collection
    // This is expected behavior - package metadata indicates a collection
    expect(result.isCollection).toBe(true);
    expect(result.collection).toBeDefined();

    // Should have exactly one character
    expect(result.characters).toHaveLength(1);
    const char = result.characters[0]!;

    // Character card should have valid structure
    expect(char.card).toBeDefined();
    expect(char.card.meta).toBeDefined();
    expect(char.card.meta.spec).toBe('v3');
    expect(char.card.meta.name).toBeTruthy();
    expect(char.card.meta.tags).toContain('voxta');

    // CCv3 data structure
    expect(char.card.data).toBeDefined();
    expect(char.card.data.spec).toBe('chara_card_v3');
    expect(char.card.data.spec_version).toBe('3.0');
    expect(char.card.data.data).toBeDefined();

    // CCv3 required fields
    const ccv3Data = char.card.data.data;
    expect(ccv3Data.name).toBeTruthy();
    expect(ccv3Data.description).toBeDefined();
    expect(ccv3Data.personality).toBeDefined();
    expect(ccv3Data.scenario).toBeDefined();
    expect(ccv3Data.first_mes).toBeDefined();
    expect(ccv3Data.mes_example).toBeDefined();

    // Assets array exists
    expect(char.assets).toBeDefined();
    expect(Array.isArray(char.assets)).toBe(true);
  });

  it('extracts thumbnail from single character (if present)', () => {
    const buffer = readFileSync(CHAR_WITH_AVATARS);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    // Some characters may not have thumbnails
    if (char.thumbnail) {
      expect(char.thumbnail.length).toBeGreaterThan(0);
    }
  });

  it('parses character with avatar assets', () => {
    const buffer = readFileSync(CHAR_WITH_AVATARS);
    const result = parseVoxta(buffer);

    expect(result.characters).toHaveLength(1);
    const char = result.characters[0]!;

    // Should have avatar assets
    const iconAssets = char.assets.filter(a => a.link.type === 'icon');
    expect(iconAssets.length).toBeGreaterThan(0);

    // Check asset structure
    const firstIcon = iconAssets[0]!;
    expect(firstIcon.buffer).toBeDefined();
    expect(firstIcon.buffer.length).toBeGreaterThan(0);
    expect(firstIcon.filename).toBeTruthy();
    expect(firstIcon.mimetype).toMatch(/^image\//);
    expect(firstIcon.size).toBe(firstIcon.buffer.length);

    // Check asset link metadata
    expect(firstIcon.link.type).toBe('icon');
    expect(firstIcon.link.name).toBeTruthy();
    expect(firstIcon.link.ext).toBeTruthy();
    expect(firstIcon.link.order).toBeGreaterThanOrEqual(0);
    expect(firstIcon.link.tags).toBeDefined();
    expect(Array.isArray(firstIcon.link.tags)).toBe(true);
  });

  it('parses Voxta avatar emotion tags correctly', () => {
    const buffer = readFileSync(CHAR_WITH_AVATARS);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    const iconAssets = char.assets.filter(a => a.link.type === 'icon');

    if (iconAssets.length > 0) {
      // At least one icon should have emotion tags
      const hasEmotionTags = iconAssets.some(asset =>
        asset.link.tags.some(tag => tag.startsWith('emotion:'))
      );
      expect(hasEmotionTags).toBe(true);
    }
  });
});

describeWithFixtures('Voxta Parser - Multi-Character Collections', () => {
  it('detects multi-character package as collection', () => {
    const buffer = readFileSync(MULTI_CHAR_PACKAGE);
    const result = parseVoxta(buffer);

    // Should be a collection
    expect(result.isCollection).toBe(true);
    expect(result.collection).toBeDefined();

    // Should have multiple characters
    expect(result.characters.length).toBeGreaterThan(1);
  });

  it('creates valid collection metadata', () => {
    const buffer = readFileSync(MULTI_CHAR_PACKAGE);
    const result = parseVoxta(buffer);

    const collection = result.collection!;
    expect(collection.card).toBeDefined();
    expect(collection.card.meta.spec).toBe('collection');
    expect(collection.card.meta.tags).toContain('Collection');
    expect(collection.card.meta.tags).toContain('voxta');
    expect(collection.card.meta.memberCount).toBe(result.characters.length);

    // Collection data
    expect(collection.card.data).toBeDefined();
    expect(collection.card.data.name).toBeTruthy();
    expect(collection.card.data.description).toBeTruthy();
    expect(collection.card.data.members).toBeDefined();
    expect(collection.card.data.members.length).toBe(result.characters.length);
  });

  it('preserves original package buffer', () => {
    const buffer = readFileSync(MULTI_CHAR_PACKAGE);
    const result = parseVoxta(buffer);

    const collection = result.collection!;
    expect(collection.originalPackage).toBeDefined();
    expect(collection.originalPackage).toBeInstanceOf(Buffer);
    expect(collection.originalPackage!.length).toBe(buffer.length);
    expect(Buffer.compare(collection.originalPackage as Buffer, buffer)).toBe(0);
  });

  it('creates collection members with correct structure', () => {
    const buffer = readFileSync(MULTI_CHAR_PACKAGE);
    const result = parseVoxta(buffer);

    const members = result.collection!.members;
    expect(members).toBeDefined();
    expect(members.length).toBeGreaterThan(1);

    members.forEach((member, index) => {
      expect(member.name).toBeTruthy();
      expect(member.order).toBe(index);
      expect(member.voxtaCharacterId).toBeTruthy();
      // scenarioIds is optional
      if (member.scenarioIds) {
        expect(Array.isArray(member.scenarioIds)).toBe(true);
      }
    });
  });

  it('extracts collection thumbnail', () => {
    const buffer = readFileSync(MULTI_CHAR_PACKAGE);
    const result = parseVoxta(buffer);

    const collection = result.collection!;
    expect(collection.thumbnail).toBeDefined();
    // Thumbnail can be Buffer or Uint8Array
    expect(collection.thumbnail).toSatisfy((t: any) =>
      t instanceof Buffer || t instanceof Uint8Array
    );
    expect(collection.thumbnail!.length).toBeGreaterThan(0);
  });
});

describeWithFixtures('Voxta Parser - Scenarios', () => {
  it('parses package with scenarios', () => {
    const buffer = readFileSync(MULTI_CHAR_SCENARIO);
    const result = parseVoxta(buffer);

    expect(result.isCollection).toBe(true);
    const collection = result.collection!;

    expect(collection.scenarios).toBeDefined();
    expect(collection.scenarios!.length).toBeGreaterThan(0);
  });

  it('creates valid scenario metadata', () => {
    const buffer = readFileSync(MULTI_CHAR_SCENARIO);
    const result = parseVoxta(buffer);

    const scenarios = result.collection!.scenarios!;
    expect(scenarios.length).toBeGreaterThan(0);

    scenarios.forEach((scenario, index) => {
      expect(scenario.voxtaScenarioId).toBeTruthy();
      expect(scenario.name).toBeTruthy();
      expect(scenario.order).toBe(index);
      expect(scenario.characterIds).toBeDefined();
      expect(Array.isArray(scenario.characterIds)).toBe(true);

      // Optional fields
      if (scenario.description !== undefined) {
        expect(typeof scenario.description).toBe('string');
      }
      if (scenario.version !== undefined) {
        expect(typeof scenario.version).toBe('string');
      }
      if (scenario.creator !== undefined) {
        expect(typeof scenario.creator).toBe('string');
      }
      if (scenario.explicitContent !== undefined) {
        expect(typeof scenario.explicitContent).toBe('boolean');
      }
      if (scenario.hasThumbnail !== undefined) {
        expect(typeof scenario.hasThumbnail).toBe('boolean');
      }
    });
  });

  it('maps characters to scenarios correctly', () => {
    const buffer = readFileSync(MULTI_CHAR_SCENARIO);
    const result = parseVoxta(buffer);

    const collection = result.collection!;
    const scenarios = collection.scenarios!;
    const members = collection.members;

    // Check if any members have scenario IDs
    const membersWithScenarios = members.filter(m => m.scenarioIds && m.scenarioIds.length > 0);

    // If there are scenarios, verify the mapping is valid
    if (membersWithScenarios.length > 0) {
      expect(membersWithScenarios.length).toBeGreaterThan(0);

      // Verify scenario IDs reference actual scenarios
      membersWithScenarios.forEach(member => {
        member.scenarioIds!.forEach(scenarioId => {
          const scenarioExists = scenarios.some(s => s.voxtaScenarioId === scenarioId);
          expect(scenarioExists).toBe(true);
        });
      });
    }

    // Verify scenarios reference actual characters (when they have character IDs)
    scenarios.forEach(scenario => {
      if (scenario.characterIds.length > 0) {
        scenario.characterIds.forEach(charId => {
          const memberExists = members.some(m => m.voxtaCharacterId === charId);
          expect(memberExists).toBe(true);
        });
      }
    });
  });

  it('handles scenario with character correctly', () => {
    const buffer = readFileSync(SCENARIO_WITH_CHAR);
    const result = parseVoxta(buffer);

    // scenario_with_char has no package metadata, so not a collection
    // Single character + scenario doesn't trigger collection mode
    expect(result.characters).toHaveLength(1);

    // Collection may or may not be created depending on scenario presence
    // The important thing is that the character parses correctly
    const char = result.characters[0]!;
    expect(char.card).toBeDefined();
    expect(char.card.meta.spec).toBe('v3');
  });
});

describeWithFixtures('Voxta Parser - Asset Handling', () => {
  it('assigns correct MIME types to assets', () => {
    const buffer = readFileSync(CHAR_WITH_AVATARS);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;

    char.assets.forEach(asset => {
      expect(asset.mimetype).toBeTruthy();

      // Check MIME type matches extension
      if (asset.link.ext === 'png') {
        expect(asset.mimetype).toBe('image/png');
      } else if (asset.link.ext === 'jpg' || asset.link.ext === 'jpeg') {
        expect(asset.mimetype).toBe('image/jpeg');
      } else if (asset.link.ext === 'webp') {
        expect(asset.mimetype).toBe('image/webp');
      } else if (asset.link.ext === 'wav') {
        expect(asset.mimetype).toBe('audio/wav');
      }
    });
  });

  it('extracts filename from asset path correctly', () => {
    const buffer = readFileSync(CHAR_WITH_AVATARS);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;

    char.assets.forEach(asset => {
      expect(asset.filename).toBeTruthy();
      expect(asset.filename).not.toContain('/');
      expect(asset.filename).not.toContain('\\');
      expect(asset.filename).toContain('.');
    });
  });

  it('categorizes voice samples as sound assets', () => {
    const buffer = readFileSync(CHAR_WITH_AVATARS);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    const soundAssets = char.assets.filter(a => a.link.type === 'sound');

    soundAssets.forEach(asset => {
      expect(asset.link.tags).toContain('voice');
      expect(asset.mimetype).toMatch(/^audio\//);
    });
  });

  it('assigns sequential order to assets', () => {
    const buffer = readFileSync(CHAR_WITH_AVATARS);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;

    if (char.assets.length > 1) {
      const orders = char.assets.map(a => a.link.order);

      // Check orders are sequential starting from 0
      orders.forEach((order, index) => {
        expect(order).toBe(index);
      });
    }
  });
});

describeWithFixtures('Voxta Parser - Edge Cases', () => {
  it('handles empty or minimal assets gracefully', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    expect(char.assets).toBeDefined();
    expect(Array.isArray(char.assets)).toBe(true);
    // Assets array may be empty for minimal character
  });

  it('handles Buffer and Uint8Array inputs', () => {
    const buffer = readFileSync(MINIMAL_CHAR);

    // Test with Buffer
    const resultBuffer = parseVoxta(buffer);
    expect(resultBuffer.characters).toHaveLength(1);

    // Test with Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const resultUint8 = parseVoxta(uint8Array);
    expect(resultUint8.characters).toHaveLength(1);

    // Results should be equivalent
    expect(resultBuffer.characters[0]!.card.meta.name).toBe(
      resultUint8.characters[0]!.card.meta.name
    );
  });

  it('preserves creator information', () => {
    const buffer = readFileSync(MULTI_CHAR_PACKAGE);
    const result = parseVoxta(buffer);

    // Check collection creator
    const collection = result.collection!;
    if (collection.card.data.creator) {
      expect(typeof collection.card.data.creator).toBe('string');
    }

    // Check character creators
    result.characters.forEach(char => {
      if (char.card.meta.creator) {
        expect(typeof char.card.meta.creator).toBe('string');
      }
    });
  });

  it('preserves character version information', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    if (char.card.meta.characterVersion) {
      expect(typeof char.card.meta.characterVersion).toBe('string');
    }
  });
});

describeWithFixtures('Voxta Parser - voxtaToCCv3 Conversion', () => {
  it('converts Voxta character to valid CCv3 structure', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    const ccv3 = char.card.data;

    // Root level
    expect(ccv3.spec).toBe('chara_card_v3');
    expect(ccv3.spec_version).toBe('3.0');
    expect(ccv3.data).toBeDefined();

    // Data level - required CCv3 fields
    const data = ccv3.data;
    expect(data.name).toBeTruthy();
    expect(typeof data.description).toBe('string');
    expect(typeof data.personality).toBe('string');
    expect(typeof data.scenario).toBe('string');
    expect(typeof data.first_mes).toBe('string');
    expect(typeof data.mes_example).toBe('string');
  });

  it('includes character metadata in CCv3', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    const data = char.card.data.data;

    // Optional but common fields
    expect(data.creator).toBeDefined();
    expect(data.character_version).toBeDefined();
    expect(data.tags).toBeDefined();
    expect(Array.isArray(data.tags)).toBe(true);
  });

  it('includes alternate greetings if present', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    const data = char.card.data.data;

    expect(data.alternate_greetings).toBeDefined();
    expect(Array.isArray(data.alternate_greetings)).toBe(true);
  });

  it('includes group_only_greetings array', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    const data = char.card.data.data;

    expect(data.group_only_greetings).toBeDefined();
    expect(Array.isArray(data.group_only_greetings)).toBe(true);
  });

  it('preserves lorebook data if present', () => {
    const buffer = readFileSync(MINIMAL_CHAR);
    const result = parseVoxta(buffer);

    const char = result.characters[0]!;
    const data = char.card.data.data;

    if (data.character_book) {
      expect(data.character_book).toBeDefined();
      expect(data.character_book.entries).toBeDefined();
      expect(Array.isArray(data.character_book.entries)).toBe(true);
    }
  });
});
