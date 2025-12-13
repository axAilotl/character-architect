/**
 * Schema Validation Tests
 *
 * Tests for Zod schemas used in API request validation.
 */

import { describe, it, expect } from 'vitest';
import {
  createCardSchema,
  updateCardSchema,
  createVersionSchema,
  createPresetSchema,
  importPresetsSchema,
  createTemplateSchema,
  createSnippetSchema,
  llmInvokeSchema,
  llmAssistSchema,
  testConnectionSchema,
  updateLLMSettingsSchema,
} from '../schemas/index.js';

describe('Card Schemas', () => {
  describe('createCardSchema', () => {
    it('accepts valid card with data and meta', () => {
      const result = createCardSchema.safeParse({
        data: { name: 'Test', description: 'A test card' },
        meta: { spec: 'v2' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts card with just data', () => {
      const result = createCardSchema.safeParse({
        data: { name: 'Test' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty body', () => {
      const result = createCardSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects missing data field', () => {
      const result = createCardSchema.safeParse({
        meta: { spec: 'v2' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateCardSchema', () => {
    it('accepts partial update with only meta', () => {
      const result = updateCardSchema.safeParse({
        meta: { tags: ['test'] },
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty update', () => {
      const result = updateCardSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('createVersionSchema', () => {
    it('accepts version with message', () => {
      const result = createVersionSchema.safeParse({
        message: 'Added lorebook entries',
      });
      expect(result.success).toBe(true);
    });

    it('accepts version without message', () => {
      const result = createVersionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects message over 500 chars', () => {
      const result = createVersionSchema.safeParse({
        message: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Preset Schemas', () => {
  describe('createPresetSchema', () => {
    it('accepts valid preset', () => {
      const result = createPresetSchema.safeParse({
        name: 'My Preset',
        instruction: 'Do something useful',
      });
      expect(result.success).toBe(true);
    });

    it('rejects preset without name', () => {
      const result = createPresetSchema.safeParse({
        instruction: 'Do something',
      });
      expect(result.success).toBe(false);
    });

    it('rejects preset without instruction', () => {
      const result = createPresetSchema.safeParse({
        name: 'My Preset',
      });
      expect(result.success).toBe(false);
    });

    it('rejects name over 100 chars', () => {
      const result = createPresetSchema.safeParse({
        name: 'a'.repeat(101),
        instruction: 'Do something',
      });
      expect(result.success).toBe(false);
    });

    it('rejects instruction over 5000 chars', () => {
      const result = createPresetSchema.safeParse({
        name: 'My Preset',
        instruction: 'a'.repeat(5001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('importPresetsSchema', () => {
    it('accepts valid preset array', () => {
      const result = importPresetsSchema.safeParse({
        presets: [
          { name: 'Preset 1', instruction: 'Do this' },
          { name: 'Preset 2', instruction: 'Do that' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-array presets', () => {
      const result = importPresetsSchema.safeParse({
        presets: 'not an array',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Template Schemas', () => {
  describe('createTemplateSchema', () => {
    it('accepts valid template', () => {
      const result = createTemplateSchema.safeParse({
        name: 'JED Template',
        category: 'format',
        content: { description: 'Test' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects template without name', () => {
      const result = createTemplateSchema.safeParse({
        category: 'format',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createSnippetSchema', () => {
    it('accepts valid snippet', () => {
      const result = createSnippetSchema.safeParse({
        name: 'Format Rules',
        content: '## Format\n- Use markdown',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('LLM Schemas', () => {
  describe('testConnectionSchema', () => {
    it('accepts valid provider ID', () => {
      const result = testConnectionSchema.safeParse({
        providerId: 'provider-123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing provider ID', () => {
      const result = testConnectionSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('llmInvokeSchema', () => {
    it('accepts valid invoke request', () => {
      const result = llmInvokeSchema.safeParse({
        providerId: 'provider-123',
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty messages array', () => {
      const result = llmInvokeSchema.safeParse({
        providerId: 'provider-123',
        messages: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
      const result = llmInvokeSchema.safeParse({
        providerId: 'provider-123',
        messages: [
          { role: 'invalid', content: 'Hello' },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('llmAssistSchema', () => {
    it('accepts valid assist request', () => {
      const result = llmAssistSchema.safeParse({
        providerId: 'provider-123',
        instruction: 'Tighten this text',
        context: {
          field: 'description',
          currentValue: 'Some long text here',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing context', () => {
      const result = llmAssistSchema.safeParse({
        providerId: 'provider-123',
        instruction: 'Tighten this',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateLLMSettingsSchema', () => {
    it('accepts partial settings update', () => {
      const result = updateLLMSettingsSchema.safeParse({
        activeProviderId: 'provider-456',
      });
      expect(result.success).toBe(true);
    });

    it('accepts provider array', () => {
      const result = updateLLMSettingsSchema.safeParse({
        providers: [
          {
            id: 'provider-123',
            name: 'My OpenAI',
            kind: 'openai',
            baseURL: 'https://api.openai.com/v1',
            apiKey: 'sk-123',
            defaultModel: 'gpt-4',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid provider kind', () => {
      const result = updateLLMSettingsSchema.safeParse({
        providers: [
          {
            id: 'provider-123',
            name: 'My Provider',
            kind: 'invalid-kind',
            baseURL: 'https://api.example.com',
            apiKey: 'key',
            defaultModel: 'model',
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
