import { describe, it, expect } from 'vitest';
import { validateV2, validateV3, detectSpec } from '@card-architect/schemas';
import type { CCv2Data, CCv3Data } from '@card-architect/schemas';

describe('Card Validation', () => {
  describe('V2 Cards', () => {
    it('should validate a minimal v2 card', () => {
      const card: CCv2Data = {
        name: 'Test Character',
        description: 'A test character',
        personality: 'Friendly',
        scenario: 'Testing scenario',
        first_mes: 'Hello!',
        mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
      };

      const result = validateV2(card);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate a complete v2 card with all fields', () => {
      const card: CCv2Data = {
        name: 'Complete Character',
        description: 'A complete test character',
        personality: 'Very friendly and helpful',
        scenario: 'Complex testing scenario',
        first_mes: 'Greetings!',
        mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello there!',
        creator: 'Test Creator',
        character_version: '1.0.0',
        tags: ['test', 'character'],
        creator_notes: 'This is a test',
        system_prompt: 'Be helpful',
        post_history_instructions: 'Stay in character',
        alternate_greetings: ['Hi there!', 'Hey!'],
        character_book: {
          name: 'Test Lorebook',
          description: 'Test lorebook description',
          scan_depth: 100,
          token_budget: 500,
          recursive_scanning: false,
          extensions: {},
          entries: [
            {
              keys: ['magic'],
              content: 'Magic is powerful',
              enabled: true,
              insertion_order: 0,
              case_sensitive: false,
              priority: 10,
              extensions: {},
            },
          ],
        },
      };

      const result = validateV2(card);
      expect(result.valid).toBe(true);
    });

    it('should detect v2 spec', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Test',
        mes_example: 'Test',
      };

      const spec = detectSpec(card);
      expect(spec).toBe('v2');
    });

    it('should reject v2 card missing required fields', () => {
      const invalidCard = {
        name: 'Test',
        // Missing other required fields
      };

      const result = validateV2(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('V3 Cards', () => {
    it('should validate a minimal v3 card', () => {
      const card: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test Character V3',
          description: 'A test character for v3',
          personality: 'Friendly',
          scenario: 'Testing scenario',
          first_mes: 'Hello from v3!',
          mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
          creator: 'Test Creator',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
        },
      };

      const result = validateV3(card);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate a complete v3 card with all features', () => {
      const card: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Complete V3 Character',
          description: 'A complete test character',
          personality: 'Very friendly',
          scenario: 'Complex scenario',
          first_mes: 'Greetings from v3!',
          mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
          creator: 'Advanced Creator',
          character_version: '2.0.0',
          tags: ['v3', 'test', 'advanced'],
          creator_notes: 'Advanced test character',
          system_prompt: 'Be very helpful',
          post_history_instructions: 'Maintain consistency',
          alternate_greetings: ['Hello!', 'Hi!', 'Greetings!'],
          character_book: {
            name: 'Advanced Lorebook',
            description: 'Advanced lorebook',
            entries: [
              {
                keys: ['magic', 'spell'],
                content: 'Magic is very powerful in this world',
                enabled: true,
                insertion_order: 10,
                case_sensitive: false,
                priority: 100,
                depth: 4,
                probability: 100,
                extensions: {
                  weight: 10,
                  displayIndex: 1,
                  useProbability: true,
                  excludeRecursion: true,
                },
              },
            ],
          },
        },
      };

      const result = validateV3(card);
      expect(result.valid).toBe(true);
    });

    it('should detect v3 spec', () => {
      const card: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: 'Test',
          personality: 'Test',
          scenario: 'Test',
          first_mes: 'Test',
          mes_example: 'Test',
          creator: 'Test',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
        },
      };

      const spec = detectSpec(card);
      expect(spec).toBe('v3');
    });

    it('should reject v3 card with invalid spec', () => {
      const invalidCard = {
        spec: 'invalid_spec',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: 'Test',
          personality: 'Test',
          scenario: 'Test',
          first_mes: 'Test',
          mes_example: 'Test',
          creator: 'Test',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
        },
      };

      const result = validateV3(invalidCard);
      expect(result.valid).toBe(false);
    });
  });

  describe('Lorebook Entries', () => {
    it('should validate v2 lorebook entries', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Test',
        mes_example: 'Test',
        character_book: {
          name: 'Test Lorebook',
          description: 'Test',
          scan_depth: 100,
          token_budget: 500,
          recursive_scanning: false,
          extensions: {},
          entries: [
            {
              keys: ['test', 'keyword'],
              content: 'Test content',
              enabled: true,
              insertion_order: 1,
              case_sensitive: true,
              priority: 5,
              constant: false,
              selective: false,
              extensions: {},
            },
          ],
        },
      };

      const result = validateV2(card);
      expect(result.valid).toBe(true);
    });

    it('should validate v3 lorebook with extensions', () => {
      const card: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: 'Test',
          personality: 'Test',
          scenario: 'Test',
          first_mes: 'Test',
          mes_example: 'Test',
          creator: 'Test',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
          character_book: {
            name: 'Test Lorebook',
            description: 'Test',
            entries: [
              {
                keys: ['advanced', 'keyword'],
                content: 'Advanced content',
                enabled: true,
                insertion_order: 10,
                case_sensitive: false,
                priority: 100,
                depth: 4,
                probability: 100,
                extensions: {
                  depth: 4,
                  weight: 10,
                  probability: 100,
                  displayIndex: 1,
                  useProbability: true,
                  excludeRecursion: true,
                  addMemo: true,
                  characterFilter: null,
                },
              },
            ],
          },
        },
      };

      const result = validateV3(card);
      expect(result.valid).toBe(true);
    });
  });

  describe('Alternate Greetings', () => {
    it('should validate v2 card with alternate greetings', () => {
      const card: CCv2Data = {
        name: 'Test',
        description: 'Test',
        personality: 'Test',
        scenario: 'Test',
        first_mes: 'Hello!',
        mes_example: 'Test',
        alternate_greetings: [
          'Hi there!',
          'Greetings!',
          'Hey!',
        ],
      };

      const result = validateV2(card);
      expect(result.valid).toBe(true);
    });

    it('should validate v3 card with alternate greetings', () => {
      const card: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: 'Test',
          personality: 'Test',
          scenario: 'Test',
          first_mes: 'Hello!',
          mes_example: 'Test',
          creator: 'Test',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
          alternate_greetings: [
            'Welcome!',
            'Good day!',
            'Salutations!',
          ],
        },
      };

      const result = validateV3(card);
      expect(result.valid).toBe(true);
    });
  });
});
