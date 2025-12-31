/**
 * Provider Settings Schema
 *
 * Zod schema for LLM provider configuration.
 */

import { z } from 'zod';
import type { UIHints } from '@character-foundry/character-foundry/app-framework';

export const providerKindSchema = z.enum([
  'openai',
  'anthropic',
  'openai-compatible',
]);
export const openAIModeSchema = z.enum(['chat', 'responses']);

export const providerConfigSchema = z.object({
  id: z.string().describe('Unique provider ID'),
  name: z.string().min(1).describe('Display name'),
  label: z.string().optional().describe('Optional label'),
  kind: providerKindSchema.describe('Provider type'),
  baseURL: z.string().describe('API base URL'),
  apiKey: z.string().describe('API key (secret)'),
  defaultModel: z.string().describe('Default model'),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe('Temperature'),
  maxTokens: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max tokens'),
  streamDefault: z.boolean().optional().describe('Enable streaming'),
  // Conditional fields (optional)
  mode: openAIModeSchema.optional().describe('OpenAI mode'),
  organization: z.string().optional().describe('Organization ID'),
  anthropicVersion: z.string().optional().describe('Anthropic version'),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ProviderKind = z.infer<typeof providerKindSchema>;
export type OpenAIMode = z.infer<typeof openAIModeSchema>;

export const providerConfigUiHints: UIHints<ProviderConfig> = {
  id: { hidden: true },
  name: {
    label: 'Name',
    placeholder: 'My Provider',
    helperText: 'A friendly name for this provider.',
  },
  label: { hidden: true },
  kind: {
    label: 'Provider Type',
    widget: 'select',
    options: [
      { value: 'openai', label: 'OpenAI' },
      { value: 'openai-compatible', label: 'OpenAI-Compatible' },
      { value: 'anthropic', label: 'Anthropic' },
    ],
  },
  baseURL: {
    label: 'Base URL',
    placeholder: 'https://api.openai.com',
    helperText: 'The API endpoint URL.',
  },
  apiKey: {
    label: 'API Key',
    placeholder: 'sk-...',
    // Auto-detected as secret due to description containing "key"
  },
  defaultModel: {
    label: 'Default Model',
    widget: 'searchable-select',
    helperText: 'Click "Fetch Models" to load available models.',
  },
  temperature: {
    label: 'Temperature',
    min: 0,
    max: 2,
    step: 0.1,
  },
  maxTokens: {
    label: 'Max Tokens',
  },
  streamDefault: {
    label: 'Enable streaming by default',
    widget: 'switch',
  },
  // Conditional fields
  mode: {
    label: 'Mode',
    widget: 'select',
    condition: { field: 'kind', oneOf: ['openai', 'openai-compatible'] },
    options: [
      { value: 'chat', label: 'Chat Completions' },
      { value: 'responses', label: 'Responses API' },
    ],
  },
  organization: {
    label: 'Organization ID (Optional)',
    condition: { field: 'kind', oneOf: ['openai', 'openai-compatible'] },
    placeholder: 'org-...',
  },
  anthropicVersion: {
    label: 'Anthropic Version',
    condition: { field: 'kind', equals: 'anthropic' },
    placeholder: '2023-06-01',
  },
};
