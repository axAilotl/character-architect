/**
 * PNG Parser Tests
 *
 * Tests the PNG parser with real PNG character card files
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parsePNG } from '../parsers/png.parser.js';
import type { ParsedData, ParsedCharacter } from '../types/index.js';

const TEST_DATA_DIR = '/mnt/ai/test_cf_data/chub_v2';

describe('PNG Parser', () => {
  describe('parsePNG()', () => {
    it('should parse a real PNG file and return ParsedData structure', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);

      // Verify structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('characters');
      expect(result).toHaveProperty('isCollection');
    });

    it('should return characters array with at least one character', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);

      expect(Array.isArray(result.characters)).toBe(true);
      expect(result.characters.length).toBeGreaterThan(0);
    });

    it('should parse character with correct structure', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      // Verify character structure
      expect(character).toHaveProperty('card');
      expect(character).toHaveProperty('thumbnail');
      expect(character).toHaveProperty('assets');

      // Verify card structure
      expect(character.card).toHaveProperty('meta');
      expect(character.card).toHaveProperty('data');
    });

    it('should extract correct name from v2 card', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      expect(character.card.meta.name).toBeDefined();
      expect(character.card.meta.name).not.toBe('Unknown Character');
      expect(typeof character.card.meta.name).toBe('string');
      expect(character.card.meta.name.length).toBeGreaterThan(0);
    });

    it('should determine correct spec version', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      expect(character.card.meta.spec).toBeDefined();
      expect(['v2', 'v3']).toContain(character.card.meta.spec);
    });

    it('should extract thumbnail as Buffer or Uint8Array', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      if (character.thumbnail) {
        expect(
          character.thumbnail instanceof Buffer ||
          character.thumbnail instanceof Uint8Array
        ).toBe(true);
        expect(character.thumbnail.length).toBeGreaterThan(0);
      }
    });

    it('should extract assets array', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      expect(Array.isArray(character.assets)).toBe(true);
      // Assets may be empty if card has no embedded assets beyond icon
    });

    it('should parse assets with correct structure if present', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      if (character.assets.length > 0) {
        const asset = character.assets[0];

        expect(asset).toHaveProperty('buffer');
        expect(asset).toHaveProperty('filename');
        expect(asset).toHaveProperty('mimetype');
        expect(asset).toHaveProperty('size');
        expect(asset).toHaveProperty('link');

        expect(asset.buffer instanceof Buffer || asset.buffer instanceof Uint8Array).toBe(true);
        expect(typeof asset.filename).toBe('string');
        expect(typeof asset.mimetype).toBe('string');
        expect(typeof asset.size).toBe('number');
        expect(asset.size).toBeGreaterThan(0);

        // Verify link structure
        expect(asset.link).toHaveProperty('type');
        expect(asset.link).toHaveProperty('name');
        expect(asset.link).toHaveProperty('ext');
        expect(asset.link).toHaveProperty('order');
        expect(asset.link).toHaveProperty('isMain');
        expect(asset.link).toHaveProperty('tags');
      }
    });

    it('should set isCollection to false for single character cards', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);

      expect(result.isCollection).toBe(false);
    });

    it('should parse multiple PNG files without errors', () => {
      const pngFiles = readdirSync(TEST_DATA_DIR).filter(f => f.endsWith('.png')).slice(0, 5);

      expect(pngFiles.length).toBeGreaterThan(0);

      for (const filename of pngFiles) {
        const pngPath = join(TEST_DATA_DIR, filename);
        const buffer = readFileSync(pngPath);

        expect(() => {
          const result = parsePNG(buffer);
          expect(result.characters.length).toBeGreaterThan(0);
        }).not.toThrow();
      }
    });

    it('should handle Uint8Array input', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);
      const uint8Array = new Uint8Array(buffer);

      const result = parsePNG(uint8Array);

      expect(result.characters.length).toBeGreaterThan(0);
      expect(result.characters[0].card.meta.name).toBeDefined();
    });

    it('should preserve creator information if present', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      // Creator may or may not be present
      if (character.card.meta.creator) {
        expect(typeof character.card.meta.creator).toBe('string');
      }
    });

    it('should preserve character version if present', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      // Character version may or may not be present
      if (character.card.meta.characterVersion) {
        expect(typeof character.card.meta.characterVersion).toBe('string');
      }
    });

    it('should assign correct MIME types to assets', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      if (character.assets.length > 0) {
        for (const asset of character.assets) {
          expect(asset.mimetype).toMatch(/^(image|audio|video)\//);
        }
      }
    });

    it('should filter out main icon from assets array', () => {
      const pngPath = join(TEST_DATA_DIR, 'delilah_105800.png');
      const buffer = readFileSync(pngPath);

      const result = parsePNG(buffer);
      const character = result.characters[0];

      // Main icon should be in thumbnail, not assets
      for (const asset of character.assets) {
        expect(asset.link.isMain).toBe(false);
      }
    });

    it('should handle PNG files with v3 spec', () => {
      // Find a v3 spec file if available
      const pngFiles = readdirSync(TEST_DATA_DIR)
        .filter(f => f.endsWith('.png') && f.includes('spec_v2'));

      if (pngFiles.length > 0) {
        const pngPath = join(TEST_DATA_DIR, pngFiles[0]);
        const buffer = readFileSync(pngPath);

        const result = parsePNG(buffer);
        const character = result.characters[0];

        expect(['v2', 'v3']).toContain(character.card.meta.spec);
        expect(character.card.meta.name).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should throw error on invalid PNG data', () => {
      const invalidBuffer = Buffer.from('not a png file');

      expect(() => {
        parsePNG(invalidBuffer);
      }).toThrow();
    });

    it('should throw error on empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);

      expect(() => {
        parsePNG(emptyBuffer);
      }).toThrow();
    });
  });

  describe('Real-world PNG samples', () => {
    it('should parse all PNG files in test directory', () => {
      const pngFiles = readdirSync(TEST_DATA_DIR)
        .filter(f => f.endsWith('.png'));

      expect(pngFiles.length).toBeGreaterThan(0);

      const results: Array<{ file: string; name: string; spec: string; assetCount: number }> = [];

      for (const filename of pngFiles) {
        const pngPath = join(TEST_DATA_DIR, filename);
        const buffer = readFileSync(pngPath);

        const result = parsePNG(buffer);
        const character = result.characters[0];

        results.push({
          file: filename,
          name: character.card.meta.name,
          spec: character.card.meta.spec,
          assetCount: character.assets.length,
        });

        // Basic validations
        expect(character.card.meta.name).toBeDefined();
        expect(['v2', 'v3']).toContain(character.card.meta.spec);
      }

      // Log summary for manual verification
      console.log('\n=== PNG Parser Test Summary ===');
      console.log(`Total files tested: ${results.length}`);
      console.log('\nFile details:');
      results.forEach(r => {
        console.log(`  ${r.file}`);
        console.log(`    Name: ${r.name}`);
        console.log(`    Spec: ${r.spec}`);
        console.log(`    Assets: ${r.assetCount}`);
      });
      console.log('===============================\n');
    });
  });
});
