/**
 * JSON Schemas for validation
 */

export const ccv2Schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    personality: { type: 'string' },
    scenario: { type: 'string' },
    first_mes: { type: 'string' },
    mes_example: { type: 'string' },
    creator_notes: { type: 'string' },
    system_prompt: { type: 'string' },
    post_history_instructions: { type: 'string' },
    alternate_greetings: {
      type: 'array',
      items: { type: 'string' },
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    creator: { type: 'string' },
    character_version: { type: 'string' },
    character_book: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        scan_depth: { type: 'number', minimum: 0 },
        token_budget: { type: 'number', minimum: 0 },
        recursive_scanning: { type: 'boolean' },
        entries: {
          type: 'array',
          items: {
            type: 'object',
            required: ['keys', 'content', 'enabled', 'insertion_order', 'extensions'],
            properties: {
              keys: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
              },
              content: { type: 'string' },
              enabled: { type: 'boolean' },
              insertion_order: { type: 'number' },
              case_sensitive: { type: 'boolean' },
              name: { type: 'string' },
              priority: { type: 'number' },
              id: { type: 'number' },
              comment: { type: 'string' },
              selective: { type: 'boolean' },
              secondary_keys: {
                type: 'array',
                items: { type: 'string' },
              },
              constant: { type: 'boolean' },
              position: {
                type: 'string',
                enum: ['before_char', 'after_char'],
              },
              extensions: { type: 'object' },
            },
          },
        },
        extensions: { type: 'object' },
      },
    },
    extensions: { type: 'object' },
  },
};

export const ccv3Schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['spec', 'spec_version', 'data'],
  properties: {
    spec: {
      type: 'string',
      const: 'chara_card_v3',
    },
    spec_version: {
      type: 'string',
      const: '3.0',
    },
    data: {
      type: 'object',
      required: [
        'name',
        'description',
        'personality',
        'scenario',
        'first_mes',
        'mes_example',
        'creator',
        'character_version',
        'tags',
      ],
      properties: {
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        personality: { type: 'string' },
        scenario: { type: 'string' },
        first_mes: { type: 'string' },
        mes_example: { type: 'string' },
        creator: { type: 'string' },
        character_version: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
        creator_notes: { type: 'string' },
        system_prompt: { type: 'string' },
        post_history_instructions: { type: 'string' },
        alternate_greetings: {
          type: 'array',
          items: { type: 'string' },
        },
        group_only_greetings: {
          type: 'array',
          items: { type: 'string' },
        },
        character_book: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            scan_depth: { type: 'number', minimum: 0 },
            token_budget: { type: 'number', minimum: 0 },
            recursive_scanning: { type: 'boolean' },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                required: ['keys', 'content', 'enabled', 'insertion_order'],
                properties: {
                  keys: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                  },
                  content: { type: 'string' },
                  enabled: { type: 'boolean' },
                  insertion_order: { type: 'number' },
                  case_sensitive: { type: 'boolean' },
                  name: { type: 'string' },
                  priority: { type: 'number' },
                  id: { type: 'number' },
                  comment: { type: 'string' },
                  selective: { type: 'boolean' },
                  secondary_keys: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  constant: { type: 'boolean' },
                  position: {
                    type: 'string',
                    enum: ['before_char', 'after_char'],
                  },
                  automation_id: { type: 'string' },
                  role: {
                    type: 'string',
                    enum: ['system', 'user', 'assistant'],
                  },
                  group: { type: 'string' },
                  scan_frequency: { type: 'number' },
                  probability: { type: 'number', minimum: 0, maximum: 100 },
                  use_regex: { type: 'boolean' },
                  depth: { type: 'number' },
                  selective_logic: {
                    type: 'string',
                    enum: ['AND', 'NOT'],
                  },
                  extensions: { type: 'object' },
                },
              },
            },
            extensions: { type: 'object' },
          },
        },
        extensions: { type: 'object' },
      },
    },
  },
};
