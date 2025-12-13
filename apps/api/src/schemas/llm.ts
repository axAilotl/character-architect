/**
 * LLM route schemas
 */

import { z } from 'zod';

// LLM message
const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

// LLM provider config
const llmProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: z.enum(['openai', 'anthropic', 'openai-compatible']),
  baseURL: z.string().url(),
  apiKey: z.string(),
  organization: z.string().optional(),
  defaultModel: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  mode: z.enum(['chat', 'responses']).optional(),
  anthropicVersion: z.string().optional(),
});

// RAG settings - use passthrough to allow additional fields
const ragSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  chunkSize: z.number().int().positive().optional(),
  chunkOverlap: z.number().int().nonnegative().optional(),
  topK: z.number().int().positive().optional(),
  indexPath: z.string(),
  activeDatabaseId: z.string().optional(),
  tokenCap: z.number().int().positive().optional(),
  embedModel: z.string().optional(),
}).passthrough().optional();

// CHARX export settings
const charxExportSettingsSchema = z.object({
  convertToWebp: z.boolean().optional(),
  webpQuality: z.number().int().min(1).max(100).optional(),
  maxMegapixels: z.number().positive().optional(),
  stripMetadata: z.boolean().optional(),
  convertMp4ToWebm: z.boolean().optional(),
  webmQuality: z.number().int().min(1).max(100).optional(),
  includedAssetTypes: z.array(z.string()).optional(),
}).optional();

// Update LLM settings request
export const updateLLMSettingsSchema = z.object({
  providers: z.array(llmProviderSchema).optional(),
  activeProviderId: z.string().optional(),
  rag: ragSettingsSchema,
  charxExport: charxExportSettingsSchema,
});

// Test connection request
export const testConnectionSchema = z.object({
  providerId: z.string().min(1),
});

// LLM invoke request
export const llmInvokeSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().optional(),
  mode: z.enum(['chat', 'responses']).optional(),
  messages: z.array(llmMessageSchema).min(1),
  system: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
});

// LLM assist context
const llmAssistContextSchema = z.object({
  field: z.string(),
  currentValue: z.string(),
  spec: z.enum(['v2', 'v3']).optional(),
  cardName: z.string().optional(),
  cardData: z.record(z.unknown()).optional(),
});

// LLM assist request
export const llmAssistSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().optional(),
  instruction: z.string().min(1),
  context: llmAssistContextSchema,
  preset: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
});

export type UpdateLLMSettingsInput = z.infer<typeof updateLLMSettingsSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
export type LLMInvokeInput = z.infer<typeof llmInvokeSchema>;
export type LLMAssistInput = z.infer<typeof llmAssistSchema>;
